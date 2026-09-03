"""Nonlinear pendulum model solved with :func:`scipy.integrate.solve_ivp`.

The angular equation of motion is

    theta_ddot + gamma * theta_dot + (g / length) * sin(theta) = 0

where ``gamma`` is a viscous damping rate in s^-1.  The bob mass is fixed at
one kilogram because it cancels from the equation of motion; keeping it in the
energy expressions gives the returned values their usual SI units.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.integrate import solve_ivp


@dataclass(frozen=True, slots=True)
class PendulumParameters:
    """Validated parameters for one simulation run."""

    initial_angle_deg: float = 28.0
    length: float = 1.65
    gravity: float = 9.81
    damping_enabled: bool = False
    damping_rate: float = 0.18
    duration: float = 30.0
    sample_rate: float = 60.0
    mass: float = 1.0

    def validate(self) -> None:
        numeric_values = (
            self.initial_angle_deg,
            self.length,
            self.gravity,
            self.damping_rate,
            self.duration,
            self.sample_rate,
            self.mass,
        )
        if not all(np.isfinite(value) for value in numeric_values):
            raise ValueError("所有物理参数都必须是有限数值")
        if not 1.0 <= self.initial_angle_deg <= 80.0:
            raise ValueError("初始摆角必须在 1° 到 80° 之间")
        if not 0.3 <= self.length <= 3.0:
            raise ValueError("摆长必须在 0.3 m 到 3.0 m 之间")
        if not 1.0 <= self.gravity <= 20.0:
            raise ValueError("重力加速度必须在 1.0 到 20.0 m/s² 之间")
        if self.duration <= 0 or self.sample_rate <= 0:
            raise ValueError("仿真时长与采样率必须为正数")
        if self.damping_rate < 0 or self.mass <= 0:
            raise ValueError("阻尼率不能为负，质量必须为正")

    @property
    def initial_angle_rad(self) -> float:
        return float(np.deg2rad(self.initial_angle_deg))

    @property
    def effective_damping(self) -> float:
        return self.damping_rate if self.damping_enabled else 0.0


@dataclass(frozen=True, slots=True)
class SimulationResult:
    """Sampled trajectory plus derived physical quantities."""

    time: np.ndarray
    theta: np.ndarray
    omega: np.ndarray
    ideal_theta: np.ndarray
    relative_error: np.ndarray
    kinetic: np.ndarray
    potential: np.ndarray
    total_energy: np.ndarray
    horizontal: np.ndarray
    theoretical_period: float
    measured_period: float
    period_deviation_percent: float

    def to_dict(self) -> dict[str, object]:
        def series(values: np.ndarray) -> list[float]:
            return np.round(values.astype(float), 8).tolist()

        return {
            "time": series(self.time),
            "theta": series(self.theta),
            "thetaDeg": series(np.rad2deg(self.theta)),
            "omega": series(self.omega),
            "idealTheta": series(self.ideal_theta),
            "idealThetaDeg": series(np.rad2deg(self.ideal_theta)),
            "relativeError": series(self.relative_error),
            "kinetic": series(self.kinetic),
            "potential": series(self.potential),
            "totalEnergy": series(self.total_energy),
            "horizontal": series(self.horizontal),
            "theoreticalPeriod": round(self.theoretical_period, 8),
            "measuredPeriod": round(self.measured_period, 8),
            "periodDeviationPercent": round(self.period_deviation_percent, 6),
        }


def _derivative(
    _time: float, state: np.ndarray, *, gravity: float, length: float, damping: float
) -> tuple[float, float]:
    theta, omega = state
    return float(omega), float(-(gravity / length) * np.sin(theta) - damping * omega)


def simulate(parameters: PendulumParameters) -> SimulationResult:
    """Integrate a pendulum trajectory and calculate all display quantities."""

    parameters.validate()
    theta0 = parameters.initial_angle_rad
    damping = parameters.effective_damping
    samples = int(round(parameters.duration * parameters.sample_rate)) + 1
    times = np.linspace(0.0, parameters.duration, samples)
    kwargs = {
        "gravity": parameters.gravity,
        "length": parameters.length,
        "damping": damping,
    }

    solution = solve_ivp(
        lambda t, y: _derivative(t, y, **kwargs),
        (0.0, parameters.duration),
        (theta0, 0.0),
        t_eval=times,
        method="DOP853",
        rtol=1e-9,
        atol=1e-11,
        max_step=1.0 / parameters.sample_rate,
    )

    if not solution.success:
        raise RuntimeError(f"数值积分失败：{solution.message}")

    theta, omega = solution.y
    theoretical_period = float(2.0 * np.pi * np.sqrt(parameters.length / parameters.gravity))

    # The lambda wrapper used by solve_ivp does not retain event attributes, so
    # determine successive positive maxima robustly from the dense sample grid.
    peak_indices = np.flatnonzero(
        (omega[:-1] >= 0.0) & (omega[1:] < 0.0) & (times[:-1] > 1e-7)
    )
    if peak_indices.size:
        index = int(peak_indices[0])
        # Linear zero-crossing interpolation improves the period beyond one frame.
        w0, w1 = omega[index], omega[index + 1]
        fraction = float(w0 / (w0 - w1)) if w0 != w1 else 0.0
        measured_period = float(times[index] + fraction * (times[index + 1] - times[index]))
    else:
        measured_period = theoretical_period

    ideal_theta = theta0 * np.cos(np.sqrt(parameters.gravity / parameters.length) * times)
    # A symmetric, bounded relative difference avoids singular spikes when the
    # ideal reference crosses zero while still exposing nonlinear phase drift.
    scale = max(abs(theta0), 1e-12)
    relative_error = np.abs(theta - ideal_theta) / scale * 100.0

    speed = parameters.length * omega
    kinetic = 0.5 * parameters.mass * speed**2
    potential = parameters.mass * parameters.gravity * parameters.length * (1.0 - np.cos(theta))
    total_energy = kinetic + potential
    horizontal = parameters.length * np.sin(theta)
    period_deviation = (measured_period - theoretical_period) / theoretical_period * 100.0

    return SimulationResult(
        time=times,
        theta=theta,
        omega=omega,
        ideal_theta=ideal_theta,
        relative_error=relative_error,
        kinetic=kinetic,
        potential=potential,
        total_energy=total_energy,
        horizontal=horizontal,
        theoretical_period=theoretical_period,
        measured_period=measured_period,
        period_deviation_percent=period_deviation,
    )
