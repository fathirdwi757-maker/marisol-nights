// The live minimap: the whole bay at a glance — block grid, traffic,
// police, hidden packages, the mission objective and Nilo himself.
// Drawn every frame in the HUD corner; cheap flat shapes only.

import { WORLD_W, WORLD_H } from './config.js';

export function drawMinimap(ctx, G, x, y, w, h) {
  const sx = w / WORLD_W, sy = h / WORLD_H;
  ctx.save();
  ctx.fillStyle = 'rgba(12,18,24,0.82)';
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();
  ctx.clip();

  // Blocks as soft green-grey slabs, roads stay dark between them.
  for (const b of G.city.blocks) {
    ctx.fillStyle = b.kind === 'beach' ? '#cbb26a' : b.kind === 'park' ? '#4e7d3a' : b.kind === 'harbor' ? '#707880' : '#5d7350';
    ctx.fillRect(x + b.x * sx, y + b.y * sy, b.w * sx, b.h * sy);
  }

  const dot = (wx, wy, r, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + wx * sx, y + wy * sy, r, 0, Math.PI * 2);
    ctx.fill();
  };

  for (const pk of G.pickups) if (!pk.taken) dot(pk.x, pk.y, 2, '#ffd76a');
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.kind === 'traffic') dot(car.x, car.y, 2, '#aab4bd');
  }
  const flash = Math.floor(G.time * 3) % 2 === 0;
  for (const cop of G.cops) dot(cop.x, cop.y, 3, flash ? '#ff5252' : '#4fa3ff');

  // Mission objective: a pulsing gold diamond.
  const obj = G.objectiveCache;
  if (obj && obj.hasPoint) {
    const ox = x + obj.x * sx, oy = y + obj.y * sy;
    const r = 4 + Math.sin(G.time * 5) * 1.2;
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(ox, oy - r); ctx.lineTo(ox + r, oy); ctx.lineTo(ox, oy + r); ctx.lineTo(ox - r, oy);
    ctx.closePath(); ctx.fill();
  }

  // Player: white dot with a heading tick.
  const px = x + G.player.x * sx, py = y + G.player.y * sy;
  dot(G.player.x, G.player.y, 3.4, '#ffffff');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px + Math.cos(G.player.angle) * 8, py + Math.sin(G.player.angle) * 8);
  ctx.stroke();

  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '600 9px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('MARISOL BAY', x + 5, y + h - 5);
}
