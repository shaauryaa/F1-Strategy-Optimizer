"""
Build a clean, *real* lap-pace dataset from the Ergast lap-time dump.

The Ergast data gives us real lap times, lap number and position for every
driver in every race (1996-2024). It does NOT contain tyre compound or pit
data, so we infer stint structure from the lap-time signal itself:

  * A pit in/out lap shows up as a large positive spike over the driver's
    running pace -> we use that to segment the race into stints.
  * Tyre age = laps completed within the current stint (a real degradation axis).
  * Fuel proxy = race progress; cars get lighter and faster through a race,
    independent of tyre state.

What this dataset teaches the model is genuinely learned from real laps:
base circuit pace, the fuel-burn trend, and within-stint degradation.
Compound-specific behaviour is layered on separately (see model/tyre_model.py),
because it simply isn't present in this source.
"""
from __future__ import annotations

import pandas as pd
import numpy as np
from pathlib import Path

# Spike over rolling pace that we treat as a pit/incident lap.
PIT_SPIKE = 1.16
# Residual slow laps (SC / traffic / lock-ups) dropped from *pace* training.
OUTLIER_KEEP = 1.10
MIN_STINT_LAPS = 4
MIN_RACE_LAPS = 25


def _parse_laps(raw_dir: Path) -> pd.DataFrame:
    laps = pd.read_csv(raw_dir / "lap_times.csv")
    races = pd.read_csv(raw_dir / "races.csv")
    circuits = pd.read_csv(raw_dir / "circuits.csv")
    races = races.merge(circuits[["circuitId", "circuitRef", "country"]], on="circuitId", how="left")
    laps = laps.merge(races[["raceId", "year", "circuitRef", "country"]], on="raceId", how="inner")
    laps["sec"] = laps["milliseconds"] / 1000.0
    return laps


def _segment_driver_race(g: pd.DataFrame) -> pd.DataFrame:
    """Infer stints + tyre age for one driver in one race."""
    g = g.sort_values("lap").reset_index(drop=True)
    total = int(g["lap"].max())
    # Robust per-stint baseline: median of the cleaner half of laps (skip lap 1).
    body = g[g["lap"] > 1]["sec"]
    if len(body) < MIN_STINT_LAPS:
        return pd.DataFrame()
    baseline = body[body < body.quantile(0.85)].median()
    g["baseline"] = baseline

    # A pit-affected lap is a spike over baseline (after the opening lap).
    g["is_pit"] = (g["sec"] > baseline * PIT_SPIKE) & (g["lap"] > 1)

    stint_id, tyre_age, stints, ages = 0, 0, [], []
    for i, row in g.iterrows():
        if row["is_pit"] and i > 0:
            stint_id += 1
            tyre_age = 0
        stints.append(stint_id)
        ages.append(tyre_age)
        tyre_age += 1
    g["stint_id"] = stints
    g["tyre_age"] = ages
    g["total_laps"] = total
    g["race_progress"] = g["lap"] / total
    return g


def build(raw_dir: str | Path, year_min: int = 2014, year_max: int = 2024) -> pd.DataFrame:
    raw_dir = Path(raw_dir)
    laps = _parse_laps(raw_dir)
    laps = laps[(laps["year"] >= year_min) & (laps["year"] <= year_max)].copy()

    # Drop races that are too short / data-poor.
    race_len = laps.groupby("raceId")["lap"].max()
    good = race_len[race_len >= MIN_RACE_LAPS].index
    laps = laps[laps["raceId"].isin(good)]

    out = []
    for (_, _), g in laps.groupby(["raceId", "driverId"], sort=False):
        seg = _segment_driver_race(g)
        if not seg.empty:
            out.append(seg)
    df = pd.concat(out, ignore_index=True)

    # Keep clean racing laps for *pace* learning.
    df = df[df["lap"] > 1]                                  # no standing start
    df = df[~df["is_pit"]]                                  # no in/out laps
    df = df[df["sec"] < df["baseline"] * OUTLIER_KEEP]      # no SC / incidents
    df = df[df["sec"] > df["baseline"] * 0.85]              # no timing glitches
    # Drop unreliable micro-stints.
    stint_len = df.groupby(["raceId", "driverId", "stint_id"])["lap"].transform("count")
    df = df[stint_len >= MIN_STINT_LAPS]
    # Cap tyre age to a sane window (long green-flag stints only).
    df = df[df["tyre_age"] <= 45]

    # Unified schema shared with the FastF1 pipeline. Ergast lacks compound and
    # temperature, so they are placeholders here; FastF1 fills them for real.
    df["compound"] = "UNKNOWN"
    df["track_temp"] = np.nan
    cols = ["sec", "circuitRef", "year", "tyre_age", "race_progress",
            "stint_id", "total_laps", "lap", "compound", "track_temp"]
    return df[cols].reset_index(drop=True)


if __name__ == "__main__":
    import sys
    from ..paths import RAW_DIR, DATASET
    raw = sys.argv[1] if len(sys.argv) > 1 else RAW_DIR
    df = build(raw)
    df.to_parquet(DATASET)
    print(f"rows: {len(df):,} | circuits: {df.circuitRef.nunique()} | "
          f"years: {df.year.min()}-{df.year.max()}")
    print(f"lap-time sec: {df.sec.min():.1f} - {df.sec.max():.1f} "
          f"(median {df.sec.median():.1f})")
    print(df.head())
