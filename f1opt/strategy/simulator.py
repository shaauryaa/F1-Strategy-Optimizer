"""
Race simulator - deterministic and Monte Carlo.

simulate() runs a single strategy through the lap-time model and returns total
time plus the cumulative curve. monte_carlo() runs it many times with random
safety-car windows so a strategy is judged on its EXPECTED outcome and its
risk, not one lucky deterministic run. This is what lets the optimiser prefer
strategies that are robust to a safety car rather than fragile to one.
"""
from __future__ import annotations

from dataclasses import dataclass, field
import numpy as np

from ..model.lap_time import LapTimeModel
from .conditions import GREEN, VSC, SC, pit_loss, BASE_PIT_LOSS


@dataclass
class Strategy:
    start_compound: str
    pits: list[tuple[int, str]] = field(default_factory=list)  # (lap, new_compound)

    def compounds_used(self) -> set[str]:
        return {self.start_compound, *(c for _, c in self.pits)}

    def stints(self, total_laps: int) -> list[tuple[str, int, int]]:
        """List of (compound, start_lap, end_lap) inclusive."""
        out, cur, start = [], self.start_compound, 1
        for lap, comp in self.pits:
            out.append((cur, start, lap))
            cur, start = comp, lap + 1
        out.append((cur, start, total_laps))
        return out


@dataclass
class SimResult:
    total_time: float
    cumulative: np.ndarray
    strategy: Strategy


def simulate(strategy: Strategy, circuit: str, year: int, total_laps: int,
             temp: float = 30.0, status_by_lap: dict[int, str] | None = None,
             ltm: LapTimeModel | None = None, base_pit_loss: float = BASE_PIT_LOSS) -> SimResult:
    ltm = ltm or LapTimeModel()
    status_by_lap = status_by_lap or {}
    pit_map = {lap: comp for lap, comp in strategy.pits}

    total, cum = 0.0, []
    compound, age = strategy.start_compound, 1
    for lap in range(1, total_laps + 1):
        status = status_by_lap.get(lap, GREEN)
        if lap in pit_map:                       # pit at the start of this lap
            total += pit_loss(status, base_pit_loss)
            compound, age = pit_map[lap], 1
        total += ltm.lap_time(circuit, year, lap, total_laps, compound, age, temp, status)
        cum.append(total)
        age += 1
    return SimResult(total, np.array(cum), strategy)


def _random_safety_cars(total_laps: int, rng: np.random.Generator,
                        sc_prob: float, vsc_prob: float) -> dict[int, str]:
    status: dict[int, str] = {}
    if rng.random() < sc_prob:                   # one SC window, 3-5 laps
        start = int(rng.integers(2, max(3, total_laps - 5)))
        for l in range(start, min(total_laps, start + int(rng.integers(3, 6)))):
            status[l] = SC
    if rng.random() < vsc_prob:                  # one VSC window, 1-3 laps
        start = int(rng.integers(2, max(3, total_laps - 3)))
        for l in range(start, min(total_laps, start + int(rng.integers(1, 4)))):
            status.setdefault(l, VSC)
    return status


def monte_carlo(strategy: Strategy, circuit: str, year: int, total_laps: int,
                temp: float = 30.0, n: int = 300, sc_prob: float = 0.55,
                vsc_prob: float = 0.45, ltm: LapTimeModel | None = None,
                seed: int = 0) -> dict:
    """Expected time + spread over random safety-car scenarios."""
    ltm = ltm or LapTimeModel()
    rng = np.random.default_rng(seed)
    times = np.empty(n)
    for i in range(n):
        sbl = _random_safety_cars(total_laps, rng, sc_prob, vsc_prob)
        times[i] = simulate(strategy, circuit, year, total_laps, temp, sbl, ltm).total_time
    return {"mean": float(times.mean()), "p10": float(np.percentile(times, 10)),
            "p90": float(np.percentile(times, 90)), "std": float(times.std())}
