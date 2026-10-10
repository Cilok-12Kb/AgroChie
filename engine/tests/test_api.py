"""Uji lapisan API (FastAPI). Angka acuan dari keluaran notebook 04 Anda untuk masukan yang sama."""
import os

os.environ["ENGINE_INTERNAL_KEY"] = "kunci-uji"

from fastapi.testclient import TestClient

from app.main import app

H = {"x-internal-key": "kunci-uji"}
BODY = {
    "komoditas": "cabai", "luas_ha": 0.5, "jenis_tanah": "Lempung", "sumber_air": "Sumur atau pompa",
    "provinsi": "Jawa Tengah", "bulan_tanam": 10, "hujan_mm_rata_per_minggu": 110.0, "minggu_hujan_lebat": 3,
    "suhu_maks_rata": 31.0, "ph": 5.8, "fosfor": "rendah", "nitrogen": "sedang", "kalium": "sedang",
    "indeks_harga_pupuk": 105.0, "indeks_upah": 103.0, "indeks_harga_pestisida": 104.0,
}


def test_health_and_auth():
    with TestClient(app) as c:
        models = c.get("/health").json()["models"]
        assert models["season"].startswith("biaya-musim") and models["weekly"].startswith("biaya-mingguan")
        assert c.post("/predict/cost", json=BODY).status_code == 401           # tanpa kunci
        assert c.post("/predict/cost", json=BODY, headers={"x-internal-key": "salah"}).status_code == 401


def test_cost_prediction_matches_notebook():
    with TestClient(app) as c:
        r = c.post("/predict/cost", json=BODY, headers=H)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_jt"] == {"low": 35.55, "mid": 40.51, "high": 46.23}   # notebook 04
        assert len(d["weekly"]) == 16                                          # cabai 16 minggu
        assert abs(sum(w["biaya_jt"] for w in d["weekly"]) - d["total_jt"]["mid"]) < 0.02
        assert abs(sum(w["porsi"] for w in d["weekly"]) - 1) < 1e-3
        assert d["warnings"] == []


def test_scenario_changes_result_and_range_warning():
    with TestClient(app) as c:
        base = c.post("/predict/cost", json=BODY, headers=H).json()["total_jt"]["mid"]
        wet = c.post("/predict/cost", json={**BODY, "hujan_mm_rata_per_minggu": 150.0, "minggu_hujan_lebat": 8},
                     headers=H).json()["total_jt"]["mid"]
        assert wet != base
        big = c.post("/predict/cost", json={**BODY, "luas_ha": 4.5}, headers=H).json()
        assert any("luas_ha" in w for w in big["warnings"])                    # di luar rentang latih (3 ha)


def test_validation_rejects_unknown_values():
    with TestClient(app) as c:
        assert c.post("/predict/cost", json={**BODY, "provinsi": "Bali"}, headers=H).status_code == 422
        assert c.post("/predict/cost", json={**BODY, "ph": 12}, headers=H).status_code == 422