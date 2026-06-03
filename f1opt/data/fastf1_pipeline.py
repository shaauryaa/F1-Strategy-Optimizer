"""
FastF1 ingestion -> the *good* dataset (run this locally; needs network).

This is the upgrade path. Where the Ergast builder has to infer stints from
lap-time spikes and has no compound or temperature, FastF1 gives ground truth
for 2018+:

  Compound    real tyre compound (SOFT/MEDIUM/HARD/INTERMEDIATE/WET)
  TyreLife    real tyre age in laps  -> the degradation axis, measured
  Stint       real stint index       -> exact segmentation
  TrackStatus real green/SC/VSC flag -> we keep only green laps for pace
  TrackTemp   real track temperature -> replaces the app's guess slider
  PitIn/Out   real pit laps          -> exact, not a heuristic

Output schema is identical to build_dataset.build() PLUS `compound`,
`track_temp`, so every downstream module (features, model, engine, app) works
unchanged and simply gets richer once this dataset is present.

Usage:
    python -m f1opt.data.fastf1_pipeline 2018 2024 --cache .fastf1_cache
First run downloads a lot and is slow; subsequent runs hit the cache.
"""
from __future__ import annotations

import argparse
import warnings
from pathlib import Path

import pandas as pd

CANON_COLS = ["sec", "circuitRef", "year", "tyre_age", "race_progress",
              "stint_id", "total_laps", "lap", "compound", "track_temp"]


def _slug(name: str) -> str:
    return (name.lower().replace(" grand prix", "").replace(" ", "_")
            .replace("-", "_").replace("'", ""))


def _session_laps(year: int, rnd: int) -> pd.DataFrame:
    import fastf1
    session = fastf1.get_session(year, rnd, "R")
    session.load(telemetry=False, weather=True, messages=False)
    laps = session.laps
    if laps is None or len(laps) == 0:
        return pd.DataFrame()

    # Green-flag racing laps only, no in/out laps, drop slow outliers.
    laps = laps.pick_wo_box().pick_track_status("1", how="equals")
    laps = laps.pick_quicklaps(threshold=1.10)
    if len(laps) == 0:
        return pd.DataFrame()

    weather = laps.get_weather_data()
    laps = laps.reset_index(drop=True)
    weather = weather.reset_index(drop=True)

    total = int(session.total_laps) if session.total_laps else int(laps["LapNumber"].max())
    out = pd.DataFrame({
        "sec": laps["LapTime"].dt.total_seconds(),
        "circuitRef": _slug(session.event["EventName"]),
        "year": year,
        "tyre_age": laps["TyreLife"].astype("float"),
        "race_progress": laps["LapNumber"] / max(total, 1),
        "stint_id": laps["Stint"].astype("float"),
        "total_laps": total,
        "lap": laps["LapNumber"].astype("int"),
        "compound": laps["Compound"].fillna("UNKNOWN"),
        "track_temp": weather["TrackTemp"].astype("float"),
    })
    out = out.dropna(subset=["sec", "tyre_age"])
    out = out[(out["sec"] > 50) & (out["sec"] < 200)]
    return out[CANON_COLS]


def build(year_min: int, year_max: int, cache: str = ".fastf1_cache") -> pd.DataFrame:
    import fastf1
    Path(cache).mkdir(exist_ok=True)
    fastf1.Cache.enable_cache(cache)

    frames = []
    for year in range(year_min, year_max + 1):
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        for rnd in schedule["RoundNumber"]:
            if rnd == 0:
                continue
            try:
                df = _session_laps(year, int(rnd))
                if not df.empty:
                    frames.append(df)
                    print(f"  {year} R{int(rnd):02d} {df['circuitRef'].iloc[0]:20s} "
                          f"{len(df):4d} laps")
            except Exception as e:  # a missing/unloadable session shouldn't kill the run
                warnings.warn(f"skip {year} R{rnd}: {e}")
    if not frames:
        raise RuntimeError("No sessions loaded - check network / cache.")
    return pd.concat(frames, ignore_index=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("year_min", type=int)
    ap.add_argument("year_max", type=int)
    from ..paths import FASTF1_CACHE
    ap.add_argument("--cache", default=str(FASTF1_CACHE))
    from ..paths import DATASET
    a = ap.parse_args()
    df = build(a.year_min, a.year_max, a.cache)
    df.to_parquet(DATASET)
    print(f"\nrows: {len(df):,} | circuits: {df.circuitRef.nunique()} | "
          f"compounds: {sorted(df.compound.unique())}")
    print(f"real track temp: {df.track_temp.min():.0f}-{df.track_temp.max():.0f}C")
