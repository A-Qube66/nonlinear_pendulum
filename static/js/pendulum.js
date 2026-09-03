import { COLORS } from "./charts.js";

function prepare(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(rect.width * ratio); const h = Math.round(rect.height * ratio);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return { ctx, width: rect.width, height: rect.height };
}

function arrow(ctx, x1, y1, x2, y2, color, label) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.save(); ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 8 * Math.cos(angle - Math.PI / 6), y2 - 8 * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - 8 * Math.cos(angle + Math.PI / 6), y2 - 8 * Math.sin(angle + Math.PI / 6));
  ctx.closePath(); ctx.fill();
  ctx.font = '9px "DM Mono", monospace'; ctx.fillText(label, x2 + 7, y2 + (y2 >= y1 ? 2 : -4));
  ctx.restore();
}

export function drawPendulum(canvas, data, index, parameters) {
  const { ctx, width, height } = prepare(canvas);
  if (!data?.theta?.length) return;
  const theta = data.theta[index]; const omega = data.omega[index];
  const pivot = { x: width / 2, y: Math.max(56, height * 0.13) };
  const rodLength = Math.min(height * 0.59, 155 + parameters.length * 35);
  const bob = { x: pivot.x + rodLength * Math.sin(theta), y: pivot.y + rodLength * Math.cos(theta) };
  const baseline = height - 43;

  ctx.save();
  ctx.strokeStyle = "rgba(128, 162, 186, .28)"; ctx.lineWidth = 1; ctx.setLineDash([4, 5]);
  ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(pivot.x, pivot.y + rodLength + 30); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(28, baseline); ctx.lineTo(width - 28, baseline); ctx.stroke();
  ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(bob.x, bob.y + 16); ctx.lineTo(bob.x, baseline); ctx.stroke();
  ctx.restore();

  const trailCount = 18;
  for (let n = trailCount; n >= 1; n -= 1) {
    const trailIndex = Math.max(0, index - n * 3);
    const trailTheta = data.theta[trailIndex];
    const tx = pivot.x + rodLength * Math.sin(trailTheta);
    const ty = pivot.y + rodLength * Math.cos(trailTheta);
    const alpha = ((trailCount - n + 1) / trailCount) * 0.16;
    ctx.beginPath(); ctx.arc(tx, ty, 3.2, 0, Math.PI * 2); ctx.fillStyle = `rgba(106,216,210,${alpha})`; ctx.fill();
  }

  ctx.save();
  ctx.strokeStyle = "rgba(225, 237, 241, .82)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(pivot.x, pivot.y); ctx.lineTo(bob.x, bob.y); ctx.stroke();
  ctx.beginPath(); ctx.arc(pivot.x, pivot.y, 5.5, 0, Math.PI * 2); ctx.fillStyle = COLORS.cyan; ctx.fill();
  ctx.strokeStyle = "rgba(106,216,210,.25)"; ctx.lineWidth = 6; ctx.stroke();
  ctx.restore();

  const radius = 15;
  const glow = ctx.createRadialGradient(bob.x - 4, bob.y - 5, 2, bob.x, bob.y, radius * 1.6);
  glow.addColorStop(0, "#f3ffff"); glow.addColorStop(.22, COLORS.cyan); glow.addColorStop(1, "rgba(106,216,210,0)");
  ctx.beginPath(); ctx.arc(bob.x, bob.y, radius * 1.6, 0, Math.PI * 2); ctx.fillStyle = glow; ctx.fill();
  ctx.beginPath(); ctx.arc(bob.x, bob.y, radius, 0, Math.PI * 2); ctx.fillStyle = "#70d9d4"; ctx.fill();
  ctx.strokeStyle = "rgba(227,255,252,.75)"; ctx.lineWidth = 1; ctx.stroke();

  const tension = parameters.gravity * Math.cos(theta) + parameters.length * omega * omega;
  const towardPivot = Math.atan2(pivot.y - bob.y, pivot.x - bob.x);
  const tensionLength = Math.max(28, Math.min(67, Math.abs(tension) * 4));
  const tensionDirection = tension >= 0 ? towardPivot : towardPivot + Math.PI;
  arrow(ctx, bob.x, bob.y, bob.x + Math.cos(tensionDirection) * tensionLength, bob.y + Math.sin(tensionDirection) * tensionLength, COLORS.cyan, "T");
  arrow(ctx, bob.x, bob.y, bob.x, bob.y + 54, COLORS.amber, "mg");

  const maxProjection = Math.min(width * .38, rodLength);
  const projectionX = pivot.x + Math.sin(theta) * maxProjection;
  ctx.beginPath(); ctx.arc(projectionX, baseline, 4.2, 0, Math.PI * 2); ctx.fillStyle = COLORS.amber; ctx.fill();
  ctx.fillStyle = COLORS.text; ctx.font = '8px "DM Mono", monospace'; ctx.textAlign = "center";
  ctx.fillText(`x = ${data.horizontal[index].toFixed(3)} m`, projectionX, baseline + 18);

  const arcRadius = 31;
  ctx.save(); ctx.strokeStyle = "rgba(106,216,210,.55)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(pivot.x, pivot.y, arcRadius, Math.PI / 2 - theta, Math.PI / 2, theta > 0); ctx.stroke();
  ctx.restore();
}

