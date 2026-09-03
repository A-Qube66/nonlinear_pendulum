import { drawPhaseChart, drawTimeChart, COLORS } from "./charts.js";
import { drawPendulum } from "./pendulum.js";

const defaults = { angle: 28, length: 1.65, gravity: 9.81, damping: false };
const state = {
  parameters: { ...defaults }, data: null, index: 0, playing: true, speed: 1,
  lastFrame: performance.now(), accumulator: 0, loadingToken: 0,
};

const $ = (id) => document.getElementById(id);
const elements = {
  angle: $("angleSlider"), length: $("lengthSlider"), gravity: $("gravitySlider"),
  angleValue: $("angleValue"), lengthValue: $("lengthValue"), gravityValue: $("gravityValue"),
  damping: $("dampingToggle"), dampingLabel: $("dampingLabel"), play: $("playButton"),
  playLabel: $("playLabel"), reset: $("resetButton"), speed: $("speedSelect"),
  pendulum: $("pendulumCanvas"), displacement: $("displacementChart"), error: $("errorChart"),
  energy: $("energyChart"), phase: $("phaseChart"), formula: $("mainFormula"),
  formulaMode: $("formulaMode"), numericFormula: $("numericFormula"), measured: $("measuredPeriod"),
  theory: $("theoryPeriod"), deviation: $("periodDeviation"), deviationHint: $("deviationHint"),
  energyReadout: $("energyReadout"), energyHint: $("energyHint"), errorReadout: $("errorReadout"),
  phaseCaption: $("phaseCaption"), status: $("motionStatus"), angleReadout: $("angleReadout"),
  elapsed: $("elapsedTime"), headerTime: $("headerTime"), timeline: $("timeline"),
  timelineFill: $("timelineFill"), timelineHandle: $("timelineHandle"), toast: $("toast"),
};

function updateRange(input) {
  const percent = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty("--progress", `${percent}%`);
}

function syncControls() {
  elements.angle.value = state.parameters.angle;
  elements.length.value = state.parameters.length;
  elements.gravity.value = state.parameters.gravity;
  elements.angleValue.value = `${state.parameters.angle.toFixed(0)}°`;
  elements.lengthValue.value = `${state.parameters.length.toFixed(2)} m`;
  elements.gravityValue.value = `${state.parameters.gravity.toFixed(2)} m/s²`;
  [elements.angle, elements.length, elements.gravity].forEach(updateRange);
  elements.damping.setAttribute("aria-checked", String(state.parameters.damping));
  elements.dampingLabel.textContent = state.parameters.damping ? "已开启 · γ = 0.18 s⁻¹" : "已关闭";
  elements.formulaMode.textContent = state.parameters.damping ? "线性空气阻尼" : "无阻尼";
  elements.formula.innerHTML = state.parameters.damping
    ? 'θ̈ + <span class="fraction"><em>b</em><em>m</em></span> θ̇ + <span class="fraction"><em>g</em><em>L</em></span> sin θ = 0'
    : 'θ̈ + <span class="fraction"><em>g</em><em>L</em></span> sin θ = 0';
  const stiffness = state.parameters.gravity / state.parameters.length;
  elements.numericFormula.textContent = state.parameters.damping
    ? `θ̈ + 0.18 θ̇ + ${stiffness.toFixed(3)} sin θ = 0`
    : `θ̈ + ${stiffness.toFixed(3)} sin θ = 0`;
}

function showToast(message) {
  elements.toast.textContent = message; elements.toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => elements.toast.classList.remove("show"), 1800);
}

async function loadSimulation({ resetClock = true } = {}) {
  const token = ++state.loadingToken;
  document.body.classList.add("is-loading");
  try {
    const response = await fetch("/api/simulate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state.parameters),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || "仿真服务未响应");
    if (token !== state.loadingToken) return;
    state.data = payload.result;
    if (resetClock) { state.index = 0; state.accumulator = 0; }
    updateSummary(); render();
  } catch (error) {
    showToast(error.message);
  } finally {
    if (token === state.loadingToken) document.body.classList.remove("is-loading");
  }
}

function updateSummary() {
  const data = state.data; if (!data) return;
  elements.measured.textContent = `${data.measuredPeriod.toFixed(3)} s`;
  elements.theory.textContent = `${data.theoreticalPeriod.toFixed(3)} s`;
  const sign = data.periodDeviationPercent >= 0 ? "+" : "";
  elements.deviation.textContent = `${sign}${data.periodDeviationPercent.toFixed(2)}%`;
  elements.deviationHint.textContent = Math.abs(data.periodDeviationPercent) < 0.5 ? "SIMPLE HARMONIC LIMIT" : "NONLINEAR PERIOD SHIFT";
  elements.phaseCaption.textContent = state.parameters.damping ? "螺旋内收表示机械能持续耗散" : "闭合轨道表示机械能守恒";
  elements.energyHint.textContent = state.parameters.damping ? "DISSIPATING" : "CONSERVED";
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60); const rest = seconds - minutes * 60;
  return `${String(minutes).padStart(2, "0")}:${rest.toFixed(2).padStart(5, "0")}`;
}

function statusFor(theta, omega) {
  const amplitude = Math.max(Math.abs(state.data.theta[0]), 0.02);
  if (state.parameters.damping && state.index > 20) return Math.abs(omega) < .08 ? "阻尼作用 · 接近转折点" : "空气阻尼持续耗散机械能";
  if (Math.abs(theta) < amplitude * .08) return omega < 0 ? "越过平衡位置 · 向左高速运动" : "越过平衡位置 · 向右高速运动";
  if (Math.abs(omega) < .08) return theta > 0 ? "到达右侧转折点" : "到达左侧转折点";
  return theta * omega < 0 ? "向平衡位置加速" : "背离平衡位置减速";
}

function render() {
  const d = state.data; if (!d) return;
  const i = Math.max(0, Math.min(state.index, d.time.length - 1)); state.index = i;
  const progress = i / (d.time.length - 1); const t = d.time[i]; const thetaDeg = d.thetaDeg[i];
  drawPendulum(elements.pendulum, d, i, state.parameters);
  drawTimeChart(elements.displacement, {
    time: d.time, index: i, symmetric: true, yUnit: "°",
    series: [
      { values: d.idealThetaDeg, color: COLORS.muted, dash: [4, 4], width: 1, full: true },
      { values: d.thetaDeg, color: COLORS.cyan, width: 1.7 },
    ],
  });
  drawTimeChart(elements.error, { time: d.time, index: i, floorZero: true, yUnit: "%", series: [{ values: d.relativeError, color: COLORS.red, fill: "rgba(244,125,115,.06)" }] });
  drawTimeChart(elements.energy, { time: d.time, index: i, floorZero: true, yUnit: "J", series: [
    { values: d.kinetic, color: COLORS.blue }, { values: d.potential, color: COLORS.amber }, { values: d.totalEnergy, color: COLORS.cyan, width: 1.8 },
  ] });
  drawPhaseChart(elements.phase, d.theta, d.omega, i);
  elements.angleReadout.textContent = `${thetaDeg >= 0 ? "+" : ""}${thetaDeg.toFixed(2)}°`;
  elements.status.textContent = statusFor(d.theta[i], d.omega[i]);
  elements.elapsed.textContent = formatTime(t); elements.headerTime.textContent = `t = ${t.toFixed(2)} s`;
  elements.timelineFill.style.width = `${progress * 100}%`; elements.timelineHandle.style.left = `${progress * 100}%`;
  elements.timeline.setAttribute("aria-valuenow", t.toFixed(2));
  elements.errorReadout.textContent = `${d.relativeError[i].toFixed(2)}%`;
  elements.energyReadout.textContent = `${d.totalEnergy[i].toFixed(3)} J`;
}

function setPlaying(playing) {
  state.playing = playing;
  elements.play.classList.toggle("is-playing", playing);
  elements.playLabel.textContent = playing ? "暂停" : "播放";
  state.lastFrame = performance.now();
}

function frame(now) {
  if (state.playing && state.data) {
    const dt = Math.min((now - state.lastFrame) / 1000, .1) * state.speed;
    state.accumulator += dt;
    const frameDuration = state.data.time[1] - state.data.time[0];
    if (state.accumulator >= frameDuration) {
      const steps = Math.floor(state.accumulator / frameDuration);
      state.accumulator -= steps * frameDuration;
      state.index += steps;
      if (state.index >= state.data.time.length) { state.index = 0; state.accumulator = 0; }
      render();
    }
  }
  state.lastFrame = now; requestAnimationFrame(frame);
}

let debounceTimer;
function parametersChanged() {
  state.parameters.angle = Number(elements.angle.value);
  state.parameters.length = Number(elements.length.value);
  state.parameters.gravity = Number(elements.gravity.value);
  syncControls(); clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadSimulation(), 180);
}

[elements.angle, elements.length, elements.gravity].forEach((input) => input.addEventListener("input", parametersChanged));
elements.damping.addEventListener("click", () => { state.parameters.damping = !state.parameters.damping; syncControls(); loadSimulation(); });
elements.play.addEventListener("click", () => setPlaying(!state.playing));
elements.reset.addEventListener("click", () => { state.index = 0; state.accumulator = 0; setPlaying(true); render(); showToast("仿真已回到初始状态"); });
elements.speed.addEventListener("change", () => { state.speed = Number(elements.speed.value); });
elements.timeline.addEventListener("pointerdown", (event) => {
  if (!state.data) return;
  const rect = elements.timeline.getBoundingClientRect();
  const seek = (event.clientX - rect.left) / rect.width;
  state.index = Math.round(Math.max(0, Math.min(1, seek)) * (state.data.time.length - 1)); render();
});

document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => {
  const presets = {
    small: { angle: 5, length: 1.65, gravity: 9.81, damping: false },
    large: { angle: 70, length: 1.65, gravity: 9.81, damping: false },
    damped: { angle: 55, length: 1.65, gravity: 9.81, damping: true },
  };
  state.parameters = { ...presets[button.dataset.preset] }; syncControls(); setPlaying(true); loadSimulation();
}));

window.addEventListener("keydown", (event) => {
  if (event.target.matches("input, select, button")) return;
  if (event.code === "Space") { event.preventDefault(); setPlaying(!state.playing); }
  if (event.key.toLowerCase() === "r") { state.index = 0; state.accumulator = 0; render(); }
});
window.addEventListener("resize", render);

syncControls(); setPlaying(true); loadSimulation(); requestAnimationFrame(frame);
