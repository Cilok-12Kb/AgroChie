"""Pembentuk fitur untuk inferensi.

HARUS sama persis dengan rekayasa fitur di notebook training (02, 03, dan fungsi forecast di 05)
dan dengan aturan di view `dataset_latih`. Jangan diubah sepihak: ubah di semua tempat sekaligus,
lalu latih ulang bila fitur berubah.
"""
import math

import numpy as np
import pandas as pd

# lama fase (minggu): persiapan, tanam, rawat, panen
CROP_PHASES = {"cabai": [2, 2, 8, 4], "tomat": [2, 2, 7, 3], "bawang": [2, 1, 5, 2]}

ORD_COLS = ["fosfor", "nitrogen", "kalium"]
ORD_MAP = {"rendah": 0, "sedang": 1, "tinggi": 2}

# 16 isian tingkat-musim (masukan dari backend)
SEASON_FEATURES = [
    "komoditas", "luas_ha", "jenis_tanah", "sumber_air", "provinsi", "bulan_tanam",
    "hujan_mm_rata_per_minggu", "minggu_hujan_lebat", "suhu_maks_rata",
    "ph", "fosfor", "nitrogen", "kalium",
    "indeks_harga_pupuk", "indeks_upah", "indeks_harga_pestisida",
]


def duration(crop: str) -> int:
    return sum(CROP_PHASES[crop])


def rain_clim(month: int) -> float:
    """Hujan klimatologi per minggu (mm) menurut bulan. Sama dengan notebook 05."""
    return 75 + 55 * math.cos(2 * math.pi * (month - 1) / 12)


def _add_season_features(d: pd.DataFrame) -> pd.DataFrame:
    """Sama persis dengan add_season_features di notebook 02."""
    d = d.copy()
    for c in ORD_COLS:
        d[c] = d[c].map(ORD_MAP).astype("int8")
    d["bulan_tanam_sin"] = np.sin(2 * np.pi * d["bulan_tanam"] / 12)
    d["bulan_tanam_cos"] = np.cos(2 * np.pi * d["bulan_tanam"] / 12)
    d["defisit_ph"] = (6 - d["ph"]).clip(lower=0)
    d["hujan_di_atas_60"] = (d["hujan_mm_rata_per_minggu"] - 60).clip(lower=0)
    d["suhu_panas"] = (d["suhu_maks_rata"] > 31).astype("int8")
    d["skor_hara_rendah"] = (2 - d["fosfor"]) + (2 - d["nitrogen"]) + (2 - d["kalium"])
    d["indeks_biaya_input"] = 0.309 * d["indeks_harga_pupuk"] + 0.263 * d["indeks_upah"]
    return d


def season_frame(inp: dict) -> pd.DataFrame:
    """Satu baris fitur tingkat-musim (24 kolom model musim, belum diurutkan)."""
    row = {k: inp[k] for k in SEASON_FEATURES}
    row["durasi_musim"] = duration(inp["komoditas"])
    return _add_season_features(pd.DataFrame([row]))


def weekly_frame(inp: dict) -> pd.DataFrame:
    """Satu baris per minggu musim (38 kolom model mingguan, belum diurutkan)."""
    lens = CROP_PHASES[inp["komoditas"]]
    dur = sum(lens)
    rows, n_wk = [], 0
    for fase, n in enumerate(lens, start=1):
        for i in range(1, n + 1):
            n_wk += 1
            bln = ((inp["bulan_tanam"] - 1) + (n_wk - 1) // 4) % 12 + 1
            rows.append({
                "minggu_ke": n_wk, "durasi_musim": dur, "posisi_relatif": round(n_wk / dur, 3),
                "fase": fase, "minggu_dalam_fase": i, "jumlah_minggu_fase": n,
                "bulan_kalender_minggu": bln, "hujan_mm_minggu_klimatologi": round(rain_clim(bln)),
                "ada_tanam": int(fase == 2 and i == 1),
                "ada_pupuk_dasar": int(fase == 1 and i == n),
                "ada_panen": int(fase == 4),
            })
    d = pd.DataFrame(rows)
    for k in SEASON_FEATURES:
        d[k] = inp[k]
    d = _add_season_features(d)
    d["minggu_tersisa"] = d["durasi_musim"] - d["minggu_ke"]
    d["bulan_minggu_sin"] = np.sin(2 * np.pi * d["bulan_kalender_minggu"] / 12)
    d["bulan_minggu_cos"] = np.cos(2 * np.pi * d["bulan_kalender_minggu"] / 12)
    d["selisih_hujan_minggu"] = d["hujan_mm_minggu_klimatologi"] - d["hujan_mm_rata_per_minggu"]
    return d