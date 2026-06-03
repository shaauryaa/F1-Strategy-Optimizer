"""
Race conditions - correct safety-car physics.

The original repo had this backwards and dead. `race_conditions.py` *multiplied*
lap time by 0.5 under SC (i.e. made the car faster) and was never imported;
meanwhile the live code added a flat +2s. Both are wrong.

Reality:
  * Under a Safety Car the field circulates slowly: a lap takes far LONGER
    (~+45%). Under a Virtual SC drivers hold a delta: ~+35%.
  * But the PIT LOSS shrinks, because the whole field is slow while you pit -
    you give up much less track time. This is *why* teams pit under SC.

Both effects live here so the simulator and optimiser share one definition.
"""
from __future__ import annotations

GREEN, VSC, SC = "GREEN", "VSC", "SC"

# Lap-time multiplier applied to the racing lap time under each status.
LAP_MULTIPLIER = {GREEN: 1.0, VSC: 1.35, SC: 1.45}

# Fraction of the green-flag pit loss actually paid under each status.
PIT_LOSS_FACTOR = {GREEN: 1.0, VSC: 0.60, SC: 0.45}

# Default green-flag pit loss (pit-lane delta), seconds. Circuit-tunable.
BASE_PIT_LOSS = 22.0


def lap_multiplier(status: str) -> float:
    return LAP_MULTIPLIER.get(status, 1.0)


def pit_loss(status: str, base: float = BASE_PIT_LOSS) -> float:
    return base * PIT_LOSS_FACTOR.get(status, 1.0)
