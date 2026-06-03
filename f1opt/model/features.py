"""
Single source of truth for model features.

The original codebase engineered features in three different places
(models.py, strategy_dp.py, simulate_strategy.py) and they disagreed - so the
optimiser and the simulator fed the same model different inputs. Everything
now flows through here.

Clean separation of concerns, so the two layers never double-count degradation:
  * BASE pace model  -> circuit + fuel(race_progress) + temp + year.
    "What pace would a car do at this fuel load on a neutral tyre?"
  * TYRE layer (tyre_model.py) -> owns compound + tyre_age entirely.
    "What does this compound, this many laps old, add or remove?"

track_temp is NaN on Ergast (HistGradientBoosting handles NaN natively) and
real on FastF1, so the same code path serves both data sources.
"""
from __future__ import annotations

import pandas as pd

# Base-pace model inputs (NO compound, NO tyre_age - those belong to the tyre layer).
BASE_NUMERIC = ["year", "race_progress", "track_temp"]
BASE_CATEGORICAL = ["circuitRef"]
BASE_FEATURES = BASE_CATEGORICAL + BASE_NUMERIC
TARGET = "sec"


def make_X(df: pd.DataFrame) -> pd.DataFrame:
    return df.reindex(columns=BASE_FEATURES).copy()


def base_row(circuit: str, year: int, race_progress: float,
             track_temp: float = float("nan")) -> pd.DataFrame:
    """One-row base-feature frame for inference."""
    return pd.DataFrame([{
        "circuitRef": circuit, "year": year,
        "race_progress": race_progress, "track_temp": track_temp,
    }])
