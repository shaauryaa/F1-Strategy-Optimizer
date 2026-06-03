"""
Strategy optimiser.

Instead of the original's fragile hand-tuned DP (which also silently never
enforced the two-compound rule and compared against a strawman baseline), this
enumerates the realistic strategy space - 1, 2 and 3-stop plans across all
compound sequences and a grid of pit laps - simulates each through the shared
lap-time model, and ranks them. The space is small enough to search exhaustively
and the result is fully transparent.

It enforces the real FIA dry-race rule (at least two different compounds), can
re-rank the leading candidates by Monte Carlo expected time so the recommended
plan is robust to a safety car, and reports the undercut/overcut trade around
the chosen pit lap.
"""
from __future__ import annotations

from dataclasses import dataclass
from itertools import product

from ..model.lap_time import LapTimeModel
from .simulator import Strategy, simulate, monte_carlo
from .conditions import BASE_PIT_LOSS

COMPOUNDS = ("SOFT", "MEDIUM", "HARD")
# Plausible stint length per compound (min, max laps) - prunes the search.
STINT_BOUNDS = {"SOFT": (8, 26), "MEDIUM": (12, 34), "HARD": (16, 48)}


@dataclass
class Candidate:
    strategy: Strategy
    time: float
    mc: dict | None = None


def _valid_pit_laps(stops: int, total_laps: int, step: int = 2) -> list[tuple[int, ...]]:
    """Pit-lap combos with sane spacing, on a coarse grid for speed."""
    lo, hi = 6, total_laps - 6
    grid = range(lo, hi + 1, step)
    combos = []
    for laps in product(grid, repeat=stops):
        if all(laps[i] + 6 <= laps[i + 1] for i in range(len(laps) - 1)):
            combos.append(laps)
    return combos


def _feasible(strategy: Strategy, total_laps: int) -> bool:
    if len(strategy.compounds_used()) < 2:        # FIA: >=2 compounds in a dry race
        return False
    for comp, s, e in strategy.stints(total_laps):
        lo, hi = STINT_BOUNDS[comp]
        if not (lo <= (e - s + 1) <= hi):
            return False
    return True


def optimise(circuit: str, year: int, total_laps: int, temp: float = 30.0,
             start_compound: str | None = None, max_stops: int = 2,
             status_by_lap: dict[int, str] | None = None,
             base_pit_loss: float = BASE_PIT_LOSS, mc_rerank: int = 8,
             ltm: LapTimeModel | None = None) -> dict:
    ltm = ltm or LapTimeModel()
    starts = [start_compound] if start_compound else list(COMPOUNDS)

    cands: list[Candidate] = []
    for stops in range(1, max_stops + 1):
        for start in starts:
            for seq in product(COMPOUNDS, repeat=stops):
                for pit_laps in _valid_pit_laps(stops, total_laps):
                    strat = Strategy(start, list(zip(pit_laps, seq)))
                    if not _feasible(strat, total_laps):
                        continue
                    res = simulate(strat, circuit, year, total_laps, temp,
                                   status_by_lap, ltm, base_pit_loss)
                    cands.append(Candidate(strat, res.total_time))

    cands.sort(key=lambda c: c.time)
    if not cands:
        raise RuntimeError("No feasible strategy - check inputs.")

    # Re-rank the leaders by Monte Carlo expected time (safety-car robustness).
    leaders = cands[:mc_rerank]
    for c in leaders:
        c.mc = monte_carlo(c.strategy, circuit, year, total_laps, temp, n=200, ltm=ltm)
    leaders.sort(key=lambda c: c.mc["mean"])

    best = leaders[0]
    return {
        "best": best,
        "deterministic_best": cands[0],
        "alternatives": cands[1:6],
        "undercut": _undercut_analysis(best.strategy, circuit, year, total_laps,
                                       temp, ltm, base_pit_loss),
    }


def _undercut_analysis(strategy: Strategy, circuit: str, year: int, total_laps: int,
                       temp: float, ltm: LapTimeModel, base_pit_loss: float) -> list[dict]:
    """Time impact of pitting one lap earlier (undercut) vs later (overcut)."""
    out = []
    for i, (lap, comp) in enumerate(strategy.pits):
        row = {"pit": i + 1, "lap": lap, "compound": comp}
        for label, shift in (("undercut(-1)", -1), ("overcut(+1)", +1)):
            new_lap = lap + shift
            if 6 <= new_lap <= total_laps - 6:
                alt = Strategy(strategy.start_compound,
                               [(new_lap, c) if j == i else (l, c)
                                for j, (l, c) in enumerate(strategy.pits)])
                base = simulate(strategy, circuit, year, total_laps, temp, None, ltm, base_pit_loss).total_time
                got = simulate(alt, circuit, year, total_laps, temp, None, ltm, base_pit_loss).total_time
                row[label] = round(got - base, 2)   # +ve = slower
        out.append(row)
    return out
