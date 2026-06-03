"""
Tyre layer: the compound + degradation model the strategy engine runs on.

Two modes, same interface:
  * Physical prior (default, works offline / on Ergast): a Pirelli-style
    3-compound model - each compound has a fresh-tyre offset vs the medium
    reference, a linear wear rate, and a 'cliff' once it ages past a threshold.
    Temperature scales wear. These are transparent, tunable parameters, not a
    black box, and they produce the realistic soft-fast-then-falls-off /
    hard-slow-but-durable crossover that strategy depends on.
  * Learned (when FastF1 data with real Compound + TyreLife is present):
    fit_from_data() regresses the lap-time *residual* left over after the base
    pace model on tyre age, per compound, recovering real wear rates. It only
    overrides the prior for compounds with enough clean samples.

delta(compound, age, temp) returns seconds to ADD to the base pace. The base
model owns fuel + circuit; this owns everything tyre. No double counting.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
import json
from pathlib import Path

import numpy as np

from ..paths import TYRE_MODEL as ARTIFACT, DATASET
COMPOUNDS = ("SOFT", "MEDIUM", "HARD")


@dataclass
class CompoundParams:
    offset: float      # fresh-tyre pace vs medium reference (s); negative = faster
    wear: float        # linear degradation (s per lap)
    cliff_age: float   # tyre age (laps) where the cliff kicks in
    cliff_wear: float  # extra degradation past the cliff (s per lap)


def _prior() -> dict[str, CompoundParams]:
    return {
        "SOFT":   CompoundParams(offset=-0.60, wear=0.100, cliff_age=18, cliff_wear=0.30),
        "MEDIUM": CompoundParams(offset=0.00,  wear=0.060, cliff_age=28, cliff_wear=0.18),
        "HARD":   CompoundParams(offset=0.55,  wear=0.035, cliff_age=40, cliff_wear=0.10),
    }


@dataclass
class TyreModel:
    params: dict[str, CompoundParams] = field(default_factory=_prior)
    ref_temp: float = 30.0
    temp_sensitivity: float = 0.04  # +4% wear per degC above ref
    source: str = "physical_prior"

    def delta(self, compound: str, age: float, temp: float = 30.0) -> float:
        """Seconds added to base pace for this compound at this age/temp."""
        p = self.params.get((compound or "MEDIUM").upper(), self.params["MEDIUM"])
        temp_factor = max(0.6, 1.0 + self.temp_sensitivity * (temp - self.ref_temp))
        wear = p.wear * temp_factor * age
        if age > p.cliff_age:
            wear += p.cliff_wear * temp_factor * (age - p.cliff_age)
        return p.offset + wear

    # ---- calibration from real FastF1 data -------------------------------
    def fit_from_data(self, df, base_pipe, min_samples: int = 400) -> "TyreModel":
        from .features import make_X
        d = df[df["compound"].isin(COMPOUNDS)].copy()
        if d.empty:
            self.source = "physical_prior (no real compound data found)"
            return self
        d["residual"] = d["sec"].values - base_pipe.predict(make_X(d))
        # Anchor offsets to MEDIUM so the base model isn't double-counted.
        med = d[d["compound"] == "MEDIUM"]
        med_intercept = med["residual"].median() if len(med) else 0.0
        learned = dict(self.params)
        for comp in COMPOUNDS:
            sub = d[(d["compound"] == comp) & (d["tyre_age"] <= 45)]
            if len(sub) < min_samples:
                continue
            age = sub["tyre_age"].values.astype(float)
            res = sub["residual"].values - med_intercept
            # Robust linear fit residual ~ offset + wear * age.
            A = np.vstack([np.ones_like(age), age]).T
            offset, wear = np.linalg.lstsq(A, res, rcond=None)[0]
            cliff = learned[comp].cliff_age
            mask = age > cliff
            cliff_wear = learned[comp].cliff_wear
            if mask.sum() > 50:
                A2 = np.vstack([np.ones(mask.sum()), age[mask] - cliff]).T
                _, extra = np.linalg.lstsq(A2, res[mask] - (offset + wear * age[mask]), rcond=None)[0]
                cliff_wear = max(0.0, float(extra))
            learned[comp] = CompoundParams(
                offset=float(offset), wear=max(0.0, float(wear)),
                cliff_age=cliff, cliff_wear=cliff_wear)
        self.params = learned
        self.source = f"learned from {len(d):,} FastF1 laps"
        return self

    # ---- persistence -----------------------------------------------------
    def save(self, path: Path = ARTIFACT) -> None:
        blob = {"params": {k: asdict(v) for k, v in self.params.items()},
                "ref_temp": self.ref_temp,
                "temp_sensitivity": self.temp_sensitivity,
                "source": self.source}
        path.write_text(json.dumps(blob, indent=2))

    @classmethod
    def load(cls, path: Path = ARTIFACT) -> "TyreModel":
        if not path.exists():
            return cls()
        blob = json.loads(path.read_text())
        params = {k: CompoundParams(**v) for k, v in blob["params"].items()}
        return cls(params=params, ref_temp=blob["ref_temp"],
                   temp_sensitivity=blob["temp_sensitivity"], source=blob["source"])


if __name__ == "__main__":
    import pandas as pd
    from .pace_model import load as load_pace
    tm = TyreModel()
    df = pd.read_parquet(DATASET)
    try:
        tm.fit_from_data(df, load_pace())
    except Exception as e:
        print("calibration skipped:", e)
    tm.save()
    print("Tyre model source:", tm.source)
    print("\nCompound deltas vs base pace (seconds added), temp=35C:")
    print(f"{'age':>4} {'SOFT':>8} {'MEDIUM':>8} {'HARD':>8}")
    for age in (1, 5, 10, 15, 20, 25, 30, 35):
        print(f"{age:>4} " + " ".join(f"{tm.delta(c, age, 35):>8.2f}" for c in COMPOUNDS))
