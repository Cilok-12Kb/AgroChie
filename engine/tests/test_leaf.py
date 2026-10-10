"""Uji pra-proses, pemetaan kelas, dan ambang pada LeafArtifact tanpa memuat model asli."""
import base64
import io
import json
from pathlib import Path

import numpy as np
from PIL import Image

from app.ml.registry import LeafArtifact

META = json.loads((Path(__file__).resolve().parents[1] / "models" / "kualitas_tanaman" / "metadata.json")
                  .read_text(encoding="utf-8"))


def fake_leaf(prob_by_index):
    """LeafArtifact dengan keluaran model palsu (tanpa TensorFlow)."""
    leaf = object.__new__(LeafArtifact)
    leaf.meta = META
    probs = np.full(len(META["classes"]), 0.0, dtype=np.float32)
    for i, p in prob_by_index.items():
        probs[i] = p
    leaf.seen = []
    leaf._infer = lambda x: (leaf.seen.append(x), probs[None, :])[1]
    return leaf


def png_b64(size=(300, 200), color=(200, 30, 30)):
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


def test_praproses_sesuai_model():
    leaf = fake_leaf({0: 1.0})
    leaf.predict(png_b64())
    x = leaf.seen[0]
    assert x.shape == (1, 224, 224, 3) and x.dtype == np.float32
    assert x.max() > 100          # tetap 0-255: pembagian 127,5 dikerjakan di dalam model
    assert META["rescale"] == "none"


def test_pemetaan_kelas_dan_ambang():
    names = META["classes"]
    i = names.index("tomat__health")
    r = fake_leaf({i: 0.9, names.index("tomat__Late blight"): 0.06}).predict(png_b64())
    assert (r["label"], r["crop"], r["healthy"]) == ("tomat__health", "tomat", True)
    assert r["label_id"] == "Tomat: sehat" and not r["needs_retake"]
    assert len(r["top3"]) == 3 and r["top3"][1]["label"] == "tomat__Late blight"

    j = names.index("cabai__murda complex(mites,trips)")
    r = fake_leaf({j: 0.45, i: 0.3}).predict(png_b64())
    assert r["crop"] == "cabai" and not r["healthy"] and r["needs_retake"]