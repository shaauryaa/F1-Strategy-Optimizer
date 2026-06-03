"""
Tests that lock in the rebuild's correctness - especially the specific bugs
the original repo had (mismatched features, backwards safety-car physics, no
FIA two-compound enforcement).
"""
import numpy as np
import pytest

from f1opt.model.features import BASE_FEATURES, make_X, base_row
from f1opt.model.tyre_model import TyreModel, COMPOUNDS
from f1opt.strategy import conditions as C
from f1opt.strategy.simulator import Strategy, simulate
from f1opt.strategy.optimizer import optimise, _feasible


# ---- features: one schema, used everywhere -----------------------------------
def test_base_row_matches_feature_schema():
    r = base_row("silverstone", 2024, 0.5, 35.0)
    assert list(r.columns) == BASE_FEATURES
    assert list(make_X(r).columns) == BASE_FEATURES


# ---- conditions: the directional fixes ---------------------------------------
def test_safety_car_makes_laps_slower_not_faster():
    # Original bug: SC multiplied lap time by 0.5 (faster). It must be slower.
    assert C.lap_multiplier(C.SC) > 1.0
    assert C.lap_multiplier(C.VSC) > 1.0
    assert C.lap_multiplier(C.SC) > C.lap_multiplier(C.VSC)


def test_pit_loss_is_cheaper_under_safety_car():
    # The whole reason teams pit under SC.
    assert C.pit_loss(C.SC) < C.pit_loss(C.GREEN)
    assert C.pit_loss(C.VSC) < C.pit_loss(C.GREEN)


# ---- tyre layer: realistic crossover -----------------------------------------
def test_soft_fastest_fresh_hard_slowest_fresh():
    tm = TyreModel()
    assert tm.delta("SOFT", 1, 35) < tm.delta("MEDIUM", 1, 35) < tm.delta("HARD", 1, 35)


def test_soft_cliffs_past_hard_when_old():
    tm = TyreModel()
    # By a long age the soft should be worse than the durable hard.
    assert tm.delta("SOFT", 35, 35) > tm.delta("HARD", 35, 35)


def test_degradation_is_monotonic_in_age():
    tm = TyreModel()
    for c in COMPOUNDS:
        ages = [tm.delta(c, a, 35) for a in range(1, 40)]
        assert all(b >= a - 1e-9 for a, b in zip(ages, ages[1:]))


# ---- simulator ---------------------------------------------------------------
def test_simulate_length_and_monotonic_cumulative():
    s = Strategy("MEDIUM", [(20, "HARD")])
    r = simulate(s, "silverstone", 2024, 52, temp=35.0)
    assert len(r.cumulative) == 52
    assert np.all(np.diff(r.cumulative) > 0)          # time only moves forward


def test_safety_car_laps_cost_more_total_time():
    s = Strategy("MEDIUM", [(20, "HARD")])
    green = simulate(s, "silverstone", 2024, 52, 35.0).total_time
    with_sc = simulate(s, "silverstone", 2024, 52, 35.0,
                       status_by_lap={l: C.SC for l in range(10, 15)}).total_time
    assert with_sc > green


# ---- optimizer: FIA rule + feasibility ---------------------------------------
def test_feasible_requires_two_compounds():
    one = Strategy("MEDIUM", [(20, "MEDIUM")])        # only one compound
    assert not _feasible(one, 52)
    two = Strategy("MEDIUM", [(20, "HARD")])
    assert _feasible(two, 52)


def test_optimiser_recommends_two_compound_plan():
    res = optimise("silverstone", 2024, 52, temp=35.0, max_stops=2, mc_rerank=4)
    assert len(res["best"].strategy.compounds_used()) >= 2


def test_optimum_beats_a_tyre_killing_strategy():
    res = optimise("silverstone", 2024, 52, temp=35.0, max_stops=2, mc_rerank=4)
    cliff = Strategy("SOFT", [(40, "HARD")])          # 40 laps on softs
    cliff_t = simulate(cliff, "silverstone", 2024, 52, 35.0).total_time
    assert res["best"].time < cliff_t


if __name__ == "__main__":
    raise SystemExit(pytest.main([__file__, "-q"]))
