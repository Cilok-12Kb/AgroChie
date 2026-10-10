"""Uji lapisan model tanpa FastAPI. Angka acuan berasal dari keluaran notebook 04 dan 05 Anda
untuk masukan contoh yang sama (cabai 0,5 ha, Jawa Tengah, tanam bulan 10)."""
from pathlib import Path
from types import SimpleNamespace

from app.ml.predictors import predict_cost
from app.ml.registry import SeasonArtifact, WeeklyArtifact

MODELS = Path(__file__).resolve().parents[1] / "models"


def load_registry():
    """Hanya model biaya (XGBoost), tanpa memuat TensorFlow, supaya tes cepat."""
    return SimpleNamespace(season=SeasonArtifact(MODELS / "biaya_musim"),
                           weekly=WeeklyArtifact(MODELS / "biaya_mingguan"))

BODY = {
    "komoditas": "cabai", "luas_ha": 0.5, "jenis_tanah": "Lempung", "sumber_air": "Sumur atau pompa",
    "provinsi": "Jawa Tengah", "bulan_tanam": 10, "hujan_mm_rata_per_minggu": 110.0, "minggu_hujan_lebat": 3,
    "suhu_maks_rata": 31.0, "ph": 5.8, "fosfor": "rendah", "nitrogen": "sedang", "kalium": "sedang",
    "indeks_harga_pupuk": 105.0, "indeks_upah": 103.0, "indeks_harga_pestisida": 104.0,
}
# dari notebook 05, sel "Forecast musim baru"
NB_WEEKLY = [4.401, 3.305, 4.255, 2.232, 1.849, 2.518, 3.438, 1.850, 2.615, 3.444, 1.900, 2.609,
             1.139, 2.110, 1.727, 1.123]


def test_cocok_dengan_notebook():
    reg = load_registry()
    d = predict_cost(reg, BODY)
    # notebook 04: {'prediksi_juta': 40.51, 'bawah_juta': 35.55, 'atas_juta': 46.23}
    assert d["total_jt"] == {"low": 35.55, "mid": 40.51, "high": 46.23}
    got = [w["biaya_jt"] for w in d["weekly"]]
    assert len(got) == 16
    assert max(abs(a - b) for a, b in zip(got, NB_WEEKLY)) < 0.0015   # selisih hanya pembulatan
    assert abs(sum(got) - d["total_jt"]["mid"]) < 0.02
    assert d["warnings"] == []


def test_peringatan_di_luar_rentang():
    reg = load_registry()
    d = predict_cost(reg, {**BODY, "luas_ha": 4.5})
    assert any("luas_ha" in w for w in d["warnings"])


def test_tanaman_lain_dan_durasinya():
    reg = load_registry()
    for crop, weeks in [("tomat", 14), ("bawang", 10)]:
        d = predict_cost(reg, {**BODY, "komoditas": crop})
        assert len(d["weekly"]) == weeks
        t = d["total_jt"]
        assert t["low"] <= t["mid"] <= t["high"]