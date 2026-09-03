const COLORS = {
  grid: "rgba(137, 169, 191, 0.10)",
  axis: "rgba(137, 169, 191, 0.28)",
  text: "#647d90",
  cyan: "#6ad8d2",
  cyanFill: "rgba(106, 216, 210, 0.08)",
  amber: "#f0ad62",
  red: "#f47d73",
  blue: "#71a9ff",
  muted: "#8298aa",
};

function fitCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * ratio));
  const height = Math.max(1, Math.round(rect.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width: rect.width, height: rect.height };
}

function niceBounds(values, symmetric = false, floorZero = false) {
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [-1, 1];
  if (symmetric) {
    const bound = Math.max(Math.abs(min), Math.abs(max), 1e-4) * 1.12;
    return [-bound, bound];
  }
  if (floorZero) min = 0;
  const span = Math.max(max - min, Math.abs(max) * 0.05, 1e-6);
  return [min - (floorZero ? 0 : span * 0.08), max + span * 0.12];
}

function formatAxis(value, unit = "") {
  const magnitude = Math.abs(value);
  let number;
  if (magnitude >= 100) number = value.toFixed(0);
  else if (magnitude >= 10) number = value.toFixed(1);
  else if (magnitude >= 1) number = value.toFixed(2);
  else number = value.toFixed(3);
  return `${number}${unit}`;
}

function drawGrid(ctx, frame, xBounds, yBounds, xUnit, yUnit) {
  const { left, top, width, height } = frame;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.font = '8px "DM Mono", monospace';
  ctx.fillStyle = COLORS.text;
  ctx.strokeStyle = COLORS.grid;

  for (let i = 0; i <= 4; i += 1) {
    const y = top + (height * i) / 4;
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(left + width, y); ctx.stroke();
    const value = yBounds[1] - ((yBounds[1] - yBounds[0]) * i) / 4;
    ctx.textAlign = "right"; ctx.textBaseline = "middle";
    ctx.fillText(formatAxis(value, yUnit), left - 7, y);
  }
  for (let i = 0; i <= 5; i += 1) {
    const x = left + (width * i) / 5;
    ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + height); ctx.stroke();
    const value = xBounds[0] + ((xBounds[1] - xBounds[0]) * i) / 5;
    ctx.textAlign = i === 0 ? "left" : i === 5 ? "right" : "center";
    ctx.textBaseline = "top";
    ctx.fillText(formatAxis(value, xUnit), x, top + height + 7);
  }
  ctx.strokeStyle = COLORS.axis;
  ctx.strokeRect(left, top, width, height);
  ctx.restore();
}

function drawSeries(ctx, points, frame, xBounds, yBounds, options) {
  if (!points.length) return;
  const xScale = (x) => frame.left + ((x - xBounds[0]) / (xBounds[1] - xBounds[0])) * frame.width;
  const yScale = (y) => frame.top + (1 - (y - yBounds[0]) / (yBounds[1] - yBounds[0])) * frame.height;

  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.left, frame.top, frame.width, frame.height);
  ctx.clip();
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xScale(point[0]); const y = yScale(point[1]);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  if (options.fill) {
    const lastX = xScale(points[points.length - 1][0]);
    const firstX = xScale(points[0][0]);
    ctx.lineTo(lastX, yScale(yBounds[0])); ctx.lineTo(firstX, yScale(yBounds[0])); ctx.closePath();
    ctx.fillStyle = options.fill; ctx.fill();
  }
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xScale(point[0]); const y = yScale(point[1]);
    if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineWidth = options.width || 1.5;
  ctx.strokeStyle = options.color;
  ctx.setLineDash(options.dash || []);
  ctx.lineJoin = "round";
  ctx.stroke();
  ctx.restore();
}

function drawCursor(ctx, frame, progress) {
  const x = frame.left + frame.width * Math.max(0, Math.min(progress, 1));
  ctx.save();
  ctx.strokeStyle = "rgba(233, 240, 244, 0.34)";
  ctx.setLineDash([2, 4]);
  ctx.beginPath(); ctx.moveTo(x, frame.top); ctx.lineTo(x, frame.top + frame.height); ctx.stroke();
  ctx.restore();
}

export function drawTimeChart(canvas, config) {
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (!config.time?.length) return;
  const frame = { left: 43, top: 8, width: width - 52, height: height - 29 };
  const xBounds = [0, config.time[config.time.length - 1]];
  const allY = config.series.flatMap((item) => item.values);
  const yBounds = niceBounds(allY, config.symmetric, config.floorZero);
  drawGrid(ctx, frame, xBounds, yBounds, "s", config.yUnit || "");
  config.series.forEach((item) => {
    const end = item.full ? item.values.length : Math.min(config.index + 1, item.values.length);
    const points = [];
    const stride = Math.max(1, Math.floor(end / Math.max(width * 1.5, 1)));
    for (let i = 0; i < end; i += stride) points.push([config.time[i], item.values[i]]);
    if (end > 0 && points.at(-1)?.[0] !== config.time[end - 1]) points.push([config.time[end - 1], item.values[end - 1]]);
    drawSeries(ctx, points, frame, xBounds, yBounds, item);
  });
  drawCursor(ctx, frame, config.index / Math.max(1, config.time.length - 1));
}

export function drawPhaseChart(canvas, theta, omega, index) {
  const { ctx, width, height } = fitCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  if (!theta?.length) return;
  const frame = { left: 43, top: 8, width: width - 52, height: height - 29 };
  const xBounds = niceBounds(theta, true);
  const yBounds = niceBounds(omega, true);
  drawGrid(ctx, frame, xBounds, yBounds, "", "");
  const end = Math.min(index + 1, theta.length);
  const points = [];
  for (let i = 0; i < end; i += 2) points.push([theta[i], omega[i]]);
  if (end) points.push([theta[end - 1], omega[end - 1]]);
  drawSeries(ctx, points, frame, xBounds, yBounds, { color: COLORS.cyan, width: 1.5 });
  if (end) {
    const x = frame.left + ((theta[end - 1] - xBounds[0]) / (xBounds[1] - xBounds[0])) * frame.width;
    const y = frame.top + (1 - (omega[end - 1] - yBounds[0]) / (yBounds[1] - yBounds[0])) * frame.height;
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = COLORS.amber; ctx.fill();
    ctx.strokeStyle = "rgba(240,173,98,.25)"; ctx.lineWidth = 5; ctx.stroke();
  }
  ctx.save(); ctx.fillStyle = COLORS.text; ctx.font = '8px "DM Mono", monospace';
  ctx.fillText("θ / rad", frame.left + frame.width - 42, frame.top + frame.height - 8);
  ctx.fillText("θ̇ / rad·s⁻¹", frame.left + 5, frame.top + 12); ctx.restore();
}

export { COLORS };

