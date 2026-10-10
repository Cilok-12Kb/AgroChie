import numpy as np

from app.ml.features import season_frame, weekly_frame
from app.ml.registry import Registry


def predict_cost(reg: Registry, inp: dict) -> dict:
    """Total biaya musim (rentang 80%) + pola biaya mingguan yang jumlahnya sama dengan total."""
    total = reg.season.predict_total(season_frame(inp))
    low, mid, high = total["low"], total["mid"], total["high"]

    w_df = weekly_frame(inp)
    raw = reg.weekly.predict_share(w_df)
    share = raw / raw.sum()          # porsi per minggu, dinormalkan per musim (jumlah = 1)
    weekly = share * mid             # jumlah biaya mingguan = total musim (titik tengah)

    return {
        "total_jt": {"low": round(low, 2), "mid": round(mid, 2), "high": round(high, 2)},
        "per_ha_jt": round(mid / inp["luas_ha"], 2),
        "weekly": [
            {"minggu": int(r.minggu_ke), "fase": int(r.fase), "biaya_jt": round(float(c), 3),
             "porsi": round(float(sh), 5)}
            for r, c, sh in zip(w_df.itertuples(), weekly, share)
        ],
        "models": {"season": reg.season.version, "weekly": reg.weekly.version},
        "warnings": reg.season.out_of_range(inp),
    }