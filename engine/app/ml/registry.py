"""Memuat artefak model SEKALI saat engine menyala, lalu dipakai ulang untuk tiap prediksi.

Setiap folder artefak berisi file model + metadata.json (dibuat oleh build_artifacts.py).
"""
import base64
import io
import json
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb


def read_meta(folder: Path) -> dict:
    return json.loads((folder / "metadata.json").read_text(encoding="utf-8"))


class XgbArtifact:
    """Model XGBoost tabular. Dibaca lewat pembungkus sklearn agar pohon yang dipakai
    otomatis dibatasi sampai best_iteration (model tersimpan memuat 50 pohon ekstra)."""

    def __init__(self, folder: Path):
        self.meta = read_meta(folder)
        self.model = xgb.XGBRegressor(enable_categorical=True)
        self.model.load_model(str(folder / self.meta["model_file"]))

    @property
    def version(self) -> str:
        return f'{self.meta["name"]}@{self.meta["version"]}'

    def _prepare(self, df: pd.DataFrame) -> pd.DataFrame:
        X = df[self.meta["features"]].copy()  # urutan kolom persis seperti saat training
        for col, levels in self.meta["categorical"].items():
            X[col] = pd.Categorical(X[col], categories=levels)  # urutan kategori sama dengan training
        return X

    def predict_raw(self, df: pd.DataFrame) -> np.ndarray:
        return np.asarray(self.model.predict(self._prepare(df)), dtype=float)


class SeasonArtifact(XgbArtifact):
    """Model 2: total biaya satu musim. Dilatih pada log1p; rentang dari galat log validasi."""

    def predict_total(self, df: pd.DataFrame) -> dict:
        lp = float(self.predict_raw(df)[0])
        q = self.meta["interval"]
        return {
            "low": float(np.expm1(lp + q["log_q10"])),
            "mid": float(np.expm1(lp)),
            "high": float(np.expm1(lp + q["log_q90"])),
        }

    def out_of_range(self, inp: dict) -> list[str]:
        notes = []
        for col, (lo, hi) in self.meta.get("ranges", {}).items():
            if col in inp and not (lo <= inp[col] <= hi):
                notes.append(f"{col} di luar rentang data latih ({lo:g} sampai {hi:g})")
        return notes


class WeeklyArtifact(XgbArtifact):
    """Model 1 (varian B): porsi biaya tiap minggu. Dinormalkan per musim oleh pemanggil."""

    def predict_share(self, df: pd.DataFrame) -> np.ndarray:
        return np.clip(self.predict_raw(df), 0, None)


class LeafArtifact:
    """CNN kualitas tanaman (tomat dan cabai). Format: keras atau onnx."""

    def __init__(self, folder: Path):
        self.meta = read_meta(folder)
        path = folder / self.meta["file"]
        fmt = self.meta["format"]
        if fmt == "keras":
            import tensorflow as tf  # impor malas: berat, hanya bila dipakai

            self._model = tf.keras.models.load_model(path, compile=False)
            self._infer = lambda x: np.asarray(self._model(x, training=False))
        elif fmt == "onnx":
            import onnxruntime as ort

            sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
            name = sess.get_inputs()[0].name
            self._infer = lambda x: sess.run(None, {name: x})[0]
        else:
            raise ValueError(f"format tidak dikenal: {fmt}")

    @property
    def version(self) -> str:
        return f'{self.meta["name"]}@{self.meta["version"]}'

    def _preprocess(self, image_bytes: bytes) -> np.ndarray:
        from PIL import Image

        h, w = self.meta["input_size"]
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((w, h), Image.BILINEAR)
        x = np.asarray(img, dtype=np.float32)
        scale = self.meta.get("rescale", "none")  # harus sama dengan saat training
        if scale == "0-1":
            x = x / 255.0
        elif scale == "-1-1":
            x = x / 127.5 - 1.0
        return x[None, ...]  # (1, h, w, 3)

    def _describe(self, i: int, conf: float) -> dict:
        label = self.meta["classes"][i]
        crop, _, condition = label.partition("__")
        return {
            "label": label,
            "label_id": self.meta.get("labels_id", {}).get(label, label),
            "crop": crop,
            "condition": condition,
            "healthy": condition.lower() in ("healthy", "health"),
            "confidence": round(conf, 4),
        }

    def predict(self, image_b64: str) -> dict:
        probs = np.asarray(self._infer(self._preprocess(base64.b64decode(image_b64))))[0]
        top = np.argsort(probs)[::-1][:3]
        best = self._describe(int(top[0]), float(probs[top[0]]))
        return {
            **best,
            "top3": [self._describe(int(i), float(probs[i])) for i in top],
            # di bawah ambang batas, minta foto ulang (bukan diagnosis pasti)
            "needs_retake": best["confidence"] < float(self.meta.get("threshold", 0.6)),
        }


class Registry:
    def __init__(self, models_dir: Path):
        self.season = self._try(SeasonArtifact, models_dir / "biaya_musim")
        self.weekly = self._try(WeeklyArtifact, models_dir / "biaya_mingguan")
        self.leaf = self._try(LeafArtifact, models_dir / "kualitas_tanaman")

    @staticmethod
    def _try(cls, folder: Path):
        if not (folder / "metadata.json").exists():
            print(f"[engine] artefak tidak ditemukan: {folder}")
            return None
        try:
            return cls(folder)
        except Exception as e:  # satu model gagal dimuat tidak boleh mematikan model lain
            print(f"[engine] GAGAL memuat {folder.name}: {e!r}")
            return None

    def status(self) -> dict:
        return {k: (v.version if v else None) for k, v in
                {"season": self.season, "weekly": self.weekly, "leaf": self.leaf}.items()}