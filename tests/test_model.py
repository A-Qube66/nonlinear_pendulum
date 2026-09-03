import numpy as np
import pytest

from pendulum_sim.model import PendulumParameters, simulate


def test_small_angle_period_matches_theory():
    result = simulate(PendulumParameters(initial_angle_deg=2.0, duration=8.0))
    assert result.measured_period == pytest.approx(result.theoretical_period, rel=2e-3)


def test_large_angle_period_is_longer():
    result = simulate(PendulumParameters(initial_angle_deg=100.0, duration=12.0))
    assert result.measured_period > result.theoretical_period
    assert result.period_deviation_percent > 10.0


def test_undamped_energy_is_conserved():
    result = simulate(PendulumParameters(initial_angle_deg=70.0, damping_enabled=False))
    drift = np.ptp(result.total_energy) / result.total_energy[0]
    assert drift < 1e-7


def test_damping_dissipates_energy():
    result = simulate(PendulumParameters(initial_angle_deg=70.0, damping_enabled=True))
    assert result.total_energy[-1] < result.total_energy[0] * 0.1
    assert np.all(np.diff(result.total_energy) <= 1e-7)


@pytest.mark.parametrize("field,value", [("initial_angle_deg", 180), ("length", 0.1), ("gravity", 0)])
def test_invalid_parameters(field, value):
    values = {field: value}
    with pytest.raises(ValueError):
        simulate(PendulumParameters(**values))

