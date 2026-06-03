"""
Base-pace model: learns circuit pace + fuel-burn trend from REAL Ergast laps.

Unlike the original (which trained on np.random synthetic rows and a hardcoded
formula, then evaluated with a leaky random split), this:
  * trains on real laps,
  * evaluates with a GroupKFold over races, so the test set is races the model
    has never seen - the honest measure of generalisation.

The model deliberately does not try to be the whole physics; it provides the
fuel-corrected base lap time for a circuit. Compound/tyre effects are added by
the physical tyre layer at lap-time-assembly time.
"""
from __future__ import annotations

import joblib
import numpy as np
import pandas as pd
from pathlib import Path
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder
from sklearn.pipeline import Pipeline
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.model_selection import GroupKFold
from sklearn.metrics import mean_absolute_error, r2_score

from .features import BASE_FEATURES, BASE_CATEGORICAL, TARGET, make_X, base_row

from ..paths import PACE_MODEL, DATASET, MODEL_CARD
ARTIFACT = PACE_MODEL


def _pipeline() -> Pipeline:
    pre = ColumnTransformer(
        [("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), BASE_CATEGORICAL)],
        remainder="passthrough",
    )
    model = HistGradientBoostingRegressor(
        max_iter=400, learning_rate=0.05, max_depth=6,
        l2_regularization=1.0, random_state=42,
    )
    return Pipeline([("pre", pre), ("gb", model)])


def evaluate(df: pd.DataFrame) -> dict:
    """Race-weekend-grouped CV. We hold out whole race weekends
    (circuit+year) while keeping every circuit represented in training - the
    honest test for how the optimiser is actually used: a known circuit, a
    race it hasn't seen."""
    X, y = make_X(df), df[TARGET].values
    groups = (df["circuitRef"].astype(str) + "_" + df["year"].astype(str)).values
    gkf = GroupKFold(n_splits=5)
    maes, r2s = [], []
    for tr, te in gkf.split(X, y, groups):
        pipe = _pipeline().fit(X.iloc[tr], y[tr])
        pred = pipe.predict(X.iloc[te])
        maes.append(mean_absolute_error(y[te], pred))
        r2s.append(r2_score(y[te], pred))
    return {"cv_mae_s": float(np.mean(maes)), "cv_mae_std": float(np.std(maes)),
            "cv_r2": float(np.mean(r2s))}


def fuel_coef(df: pd.DataFrame) -> float:
    """Seconds gained from full to empty fuel, learned from the data,
    reported for sanity/interpretability."""
    pipe = train(df, save=False)
    c = df["circuitRef"].unique()[0]
    yr = int(df["year"].median())
    start = pipe.predict(base_row(c, yr, 0.05))[0]
    end = pipe.predict(base_row(c, yr, 0.95))[0]
    return float(start - end)


def train(df: pd.DataFrame, save: bool = True) -> Pipeline:
    X, y = make_X(df), df[TARGET].values
    pipe = _pipeline().fit(X, y)
    if save:
        joblib.dump(pipe, ARTIFACT)
    return pipe


def load() -> Pipeline:
    return joblib.load(ARTIFACT)


if __name__ == "__main__":
    import json
    df = pd.read_parquet(DATASET)
    print("Evaluating (race-weekend-grouped 5-fold CV on real data)...")
    metrics = evaluate(df)
    fuel = fuel_coef(df)
    print(f"  CV MAE : {metrics['cv_mae_s']:.3f}s  (+/- {metrics['cv_mae_std']:.3f})")
    print(f"  CV R2  : {metrics['cv_r2']:.3f}")
    print(f"  Learned fuel effect (full->empty): {fuel:.2f}s")
    train(df)
    card = {**metrics, "fuel_effect_s": fuel, "n_laps": int(len(df)),
            "n_circuits": int(df.circuitRef.nunique()),
            "years": [int(df.year.min()), int(df.year.max())]}
    json.dump(card, open(MODEL_CARD, "w"), indent=2)
    print(f"  Saved -> {ARTIFACT} + {MODEL_CARD}")
