"""
Lap-time model = learned base pace  +  physical tyre layer  +  conditions.

This is the single function the strategy engine and the app call. It composes
the two trustworthy pieces:
    base pace (circuit + fuel + temp, learned from real laps)
  + tyre delta (compound + age + temp, physical/calibrated)
  x track-status multiplier (green / VSC / SC)

Keeping it in one place means the optimiser and the simulator can never again
drift apart on how a lap time is computed (the original repo's core bug).
"""
from __future__ import annotations

from functools import lru_cache

from .features import base_row
from .pace_model import load as load_pace
from .tyre_model import TyreModel
from ..strategy.conditions import lap_multiplier


class LapTimeModel:
    def __init__(self, pace_pipe=None, tyre: TyreModel | None = None):
        self.pace = pace_pipe if pace_pipe is not None else load_pace()
        self.tyre = tyre if tyre is not None else TyreModel.load()

    @lru_cache(maxsize=200_000)
    def _base(self, circuit: str, year: int, progress_q: int, temp: float) -> float:
        # progress is quantised to 0.5% buckets for cache hits; cheap and accurate.
        progress = progress_q / 200.0
        return float(self.pace.predict(base_row(circuit, year, progress, temp))[0])

    def lap_time(self, circuit: str, year: int, lap: int, total_laps: int,
                 compound: str, tyre_age: float, temp: float = 30.0,
                 status: str = "GREEN") -> float:
        progress_q = int(round((lap / max(total_laps, 1)) * 200))
        base = self._base(circuit, year, progress_q, temp)
        tyre = self.tyre.delta(compound, tyre_age, temp)
        return (base + tyre) * lap_multiplier(status)
