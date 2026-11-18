// Drawing the world: Marisol Bay from above — sunlit blocks and named
// rooftops, two-lane roads, traffic, pedestrians, police with flashing
// light bars, the mission beacon, and a night tint with headlights after
// dark. Reads state only; the simulation lives in world.js.
//
// HD pass: the frame is drawn under the RENDER_SCALE base transform
// (see main.js), and the city carries cheap precomputed-style detail —
// per-building shade variation and rooftop clutter from a position
// hash (no RNG, so the seeded city looks identical every load), road
// edge lines, soft elliptical shadows, two-tone cars and a graded bay
// shoreline along the south edge of the map.

import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, PALETTE, DISTRICT_INFO } from './config.js';

// Deterministic 0..1 hash of a world position: stable per building or
// tree across frames and loads, without touching the seeded RNG.
function hash2(x, y) {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

export function nightFactor(G) {
  if (typeof G.nightOverride === 'number') return G.nightOverride;
  // dayT 0.30 ≈ morning, 0.55 noon, 0.80 dusk, 0.95+ night, back by 0.20.
  const t = G.dayT;
  if (t > 0.30 && t < 0.72) return 0;
  if (t >= 0.72 && t <= 0.86) return (t - 0.72) / 0.14; // sunset fades in
  if (t > 0.86 || t < 0.10) return 1;
  return 1 - (t - 0.10) / 0.20; // dawn
}

export function drawWorld(ctx, G) {
  const cam = G.camera;
  ctx.fillStyle = PALETTE.road;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  drawGround(ctx, G);
  drawRoadMarkings(ctx, G);
  drawPickups(ctx, G);
  drawObjectiveBeacon(ctx, G);
  for (const ped of G.peds) drawPed(ctx, G, ped);
  for (const car of G.cars) drawCar(ctx, G, car);
  if (!G.player.car) drawPlayer(ctx, G);
  drawBullets(ctx, G);
  drawParticles(ctx, G);

  ctx.restore();

  const night = nightFactor(G);
  if (night > 0.02) {
    ctx.fillStyle = `rgba(13,20,54,${0.40 * night})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Lamp glow and headlights punch back through the dark.
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    ctx.globalCompositeOperation = 'lighter';
    for (const lamp of G.city.lamps) {
      if (!onScreen(G, lamp.x, lamp.y, 60)) continue;
      const g = ctx.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 44);
      g.addColorStop(0, `rgba(255,214,120,${0.20 * night})`);
      g.addColorStop(1, 'rgba(255,214,120,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lamp.x - 44, lamp.y - 44, 88, 88);
    }
    ctx.restore();
  }
  drawObjectiveArrow(ctx, G);
}

function onScreen(G, x, y, pad) {
  return x > G.camera.x - pad && y > G.camera.y - pad && x < G.camera.x + VIEW_W + pad && y < G.camera.y + VIEW_H + pad;
}

function drawGround(ctx, G) {
  const { city } = G;
  for (const b of city.blocks) {
    if (!onScreen(G, b.x + b.w / 2, b.y + b.h / 2, 340)) continue;
    // Sidewalk rim, then the district ground inside it.
    ctx.fillStyle = PALETTE.sidewalk;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = DISTRICT_INFO[b.kind].ground;
    ctx.fillRect(b.x + 13, b.y + 13, b.w - 26, b.h - 26);
    if (b.kind === 'beach') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(b.x + 13, b.y + b.h - 60, b.w - 26, 12); // foam line
    }
  }
  drawBay(ctx, G);
  for (const bd of city.buildings) {
    if (!onScreen(G, bd.x + bd.w / 2, bd.y + bd.h / 2, 200)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.20)';
    ctx.fillRect(bd.x + 6, bd.y + 8, bd.w, bd.h);
    ctx.fillStyle = bd.color;
    ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
    // Per-building shade variation: neighbouring roofs no longer share
    // one flat tone — a whisper of sun or shadow, fixed by position.
    const v = hash2(bd.x, bd.y);
    if (v < 0.5) {
      ctx.fillStyle = `rgba(20,16,8,${(0.5 - v) * 0.30})`;
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
    } else {
      ctx.fillStyle = `rgba(255,250,235,${(v - 0.5) * 0.22})`;
      ctx.fillRect(bd.x, bd.y, bd.w, bd.h);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(bd.x, bd.y, bd.w, bd.h);
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(bd.x + 7, bd.y + 7, bd.w - 14, 10); // roof ridge highlight
    // Rooftop clutter: an AC box and a vent, placed by the same hash.
    if (bd.w > 64 && bd.h > 54) {
      const ax = bd.x + 12 + hash2(bd.y, bd.x) * Math.max(1, bd.w - 52);
      const ay = bd.y + bd.h - 30 - hash2(bd.x * 3, bd.y) * Math.max(1, bd.h - 64);
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      ctx.fillRect(ax, ay, 20, 13);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(ax + 2, ay + 2, 16, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.16)';
      ctx.beginPath(); ctx.arc(bd.x + bd.w - 20 - v * 18, bd.y + 24, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (bd.w > 120 && bd.h > 70) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '600 12px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bd.name, bd.x + bd.w / 2, bd.y + bd.h / 2 + 4);
    }
  }
  for (const t of city.trees) {
    if (!onScreen(G, t.x, t.y, 50)) continue;
    // Soft elliptical ground shadow, then the canopy.
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(t.x + 3, t.y + 5, t.r * 0.95, t.r * 0.58, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.palm ? '#58a34c' : '#3f7d33';
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5, 0, Math.PI * 2); ctx.fill();
  }
  // Shops get a striped awning and a coin sign so robbery spots read clearly.
  for (const shop of city.shops) {
    if (!onScreen(G, shop.x, shop.y, 60)) continue;
    ctx.fillStyle = '#e67e22';
    ctx.fillRect(shop.x - 16, shop.y - 16, 32, 32);
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 19px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('$', shop.x, shop.y + 7);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText(shop.name, shop.x, shop.y + 30);
  }
  // Landmark workshop/garage signs.
  signAt(ctx, G, city.landmarks.workshop, 'BENGKEL SINTA', '#4fa3ff');
  signAt(ctx, G, city.landmarks.garage, 'GARASI', '#4fa3ff');
  signAt(ctx, G, city.landmarks.harborDock, 'DERMAGA', '#ffd76a');
}

// The bay itself: a graded water strip along the south edge of the map,
// below the last lane of the shore road, with a bright shoreline where
// the promenade meets the water. Only drawn when the shore is in view.
function drawBay(ctx, G) {
  if (G.camera.y + VIEW_H < WORLD_H - 190) return;
  const y0 = WORLD_H - 16;
  const grad = ctx.createLinearGradient(0, y0, 0, WORLD_H);
  grad.addColorStop(0, '#57b8cf');
  grad.addColorStop(0.45, PALETTE.water);
  grad.addColorStop(1, '#2f7ea6');
  ctx.fillStyle = grad;
  ctx.fillRect(0, y0, WORLD_W, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(0, y0 - 2, WORLD_W, 2.5); // shoreline highlight
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (let x = 26; x < WORLD_W; x += 118) {
    ctx.fillRect(x + (hash2(x, 7) * 40 - 20), y0 + 5 + hash2(7, x) * 6, 22, 1.6); // foam flecks
  }
}

function signAt(ctx, G, pos, text, color) {
  if (!onScreen(G, pos.x, pos.y, 80)) return;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(pos.x, pos.y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.font = '700 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, pos.x, pos.y - 14);
}

function drawRoadMarkings(ctx, G) {
  // Solid edge lines framing each road band.
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 2;
  for (const r of G.city.vRoads) {
    ctx.beginPath(); ctx.moveTo(r.x0 + 5, Math.max(0, G.camera.y - 20)); ctx.lineTo(r.x0 + 5, G.camera.y + VIEW_H + 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(r.x1 - 5, Math.max(0, G.camera.y - 20)); ctx.lineTo(r.x1 - 5, G.camera.y + VIEW_H + 20); ctx.stroke();
  }
  for (const r of G.city.hRoads) {
    ctx.beginPath(); ctx.moveTo(Math.max(0, G.camera.x - 20), r.y0 + 5); ctx.lineTo(G.camera.x + VIEW_W + 20, r.y0 + 5); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(Math.max(0, G.camera.x - 20), r.y1 - 5); ctx.lineTo(G.camera.x + VIEW_W + 20, r.y1 - 5); ctx.stroke();
  }
  // Dashed centre lines.
  ctx.strokeStyle = PALETTE.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  for (const r of G.city.vRoads) {
    ctx.beginPath(); ctx.moveTo(r.cx, Math.max(0, G.camera.y - 20)); ctx.lineTo(r.cx, G.camera.y + VIEW_H + 20); ctx.stroke();
  }
  for (const r of G.city.hRoads) {
    ctx.beginPath(); ctx.moveTo(Math.max(0, G.camera.x - 20), r.cy); ctx.lineTo(G.camera.x + VIEW_W + 20, r.cy); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Lamp posts.
  ctx.fillStyle = '#6b7280';
  for (const lamp of G.city.lamps) {
    if (!onScreen(G, lamp.x, lamp.y, 30)) continue;
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
  }
}

function drawPickups(ctx, G) {
  for (const pk of G.pickups) {
    if (pk.taken || !onScreen(G, pk.x, pk.y, 40)) continue;
    const bob = Math.sin(G.time * 3 + pk.phase) * 3;
    ctx.fillStyle = 'rgba(255,215,106,0.30)';
    ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 17, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e9b44c';
    ctx.fillRect(pk.x - 8, pk.y - 8 + bob, 16, 16);
    ctx.strokeStyle = '#8a6420';
    ctx.lineWidth = 2;
    ctx.strokeRect(pk.x - 8, pk.y - 8 + bob, 16, 16);
  }
}

function drawObjectiveBeacon(ctx, G) {
  const obj = G.objectiveCache;
  if (!obj || !obj.hasPoint) return;
  const pulse = 14 + Math.sin(G.time * 4) * 4;
  const grad = ctx.createLinearGradient(0, obj.y - 300, 0, obj.y);
  grad.addColorStop(0, 'rgba(255,215,0,0)');
  grad.addColorStop(1, 'rgba(255,215,0,0.30)');
  ctx.fillStyle = grad;
  ctx.fillRect(obj.x - 13, obj.y - 300, 26, 300);
  ctx.strokeStyle = '#ffd700';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(obj.x, obj.y, pulse + 10, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd700';
  ctx.beginPath(); ctx.arc(obj.x, obj.y, 6, 0, Math.PI * 2); ctx.fill();
}

function drawObjectiveArrow(ctx, G) {
  const obj = G.objectiveCache;
  if (!obj || !obj.hasPoint || G.mode !== 'play') return;
  const sx = obj.x - G.camera.x, sy = obj.y - G.camera.y;
  if (sx > 30 && sx < VIEW_W - 30 && sy > 30 && sy < VIEW_H - 30) return;
  const cx = VIEW_W / 2, cy = VIEW_H / 2;
  const a = Math.atan2(sy - cy, sx - cx);
  const ax = cx + Math.cos(a) * (VIEW_W / 2 - 46);
  const ay = cy + Math.sin(a) * (VIEW_H / 2 - 46);
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(a);
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.moveTo(16, 0); ctx.lineTo(-10, -10); ctx.lineTo(-10, 10);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function drawCar(ctx, G, car) {
  if (car.dead) {
    // Wreck: dark, smoking husk.
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.ellipse(3, 4, 27, 13, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#26262a';
    ctx.fillRect(-22, -11, 44, 22);
    ctx.restore();
    return;
  }
  if (!onScreen(G, car.x, car.y, 70)) return;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Soft elliptical ground shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath(); ctx.ellipse(3, 4, 27, 13, 0, 0, Math.PI * 2); ctx.fill();
  // Two-tone body: base colour, a shaded lower band and a sunlit roof
  // panel, all clipped to the body outline.
  ctx.fillStyle = car.kind === 'cop' ? '#23272f' : car.color;
  ctx.beginPath();
  ctx.roundRect(-22, -11, 44, 22, 6);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.17)';
  ctx.fillRect(-22, 4, 44, 7); // shaded lower band
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(-22, -11, 44, 4); // sunlit top edge
  ctx.fillStyle = 'rgba(255,255,255,0.20)';
  ctx.beginPath();
  ctx.roundRect(-9, -8, 17, 16, 3);
  ctx.fill(); // roof panel highlight
  ctx.restore();
  if (car.kind === 'cop') {
    ctx.fillStyle = '#eef1f4';
    ctx.fillRect(-8, -11, 16, 22); // white door band
    const flash = Math.floor(G.time * 4) % 2 === 0;
    ctx.fillStyle = flash ? '#ff4040' : '#4040ff';
    ctx.fillRect(-3, -7, 6, 5);
    ctx.fillStyle = flash ? '#4040ff' : '#ff4040';
    ctx.fillRect(-3, 2, 6, 5);
  }
  // Windshield (front) and rear window.
  ctx.fillStyle = 'rgba(170,220,245,0.9)';
  ctx.fillRect(6, -8, 7, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(6, -8, 2.5, 16); // windshield glint
  ctx.fillStyle = 'rgba(120,160,190,0.8)';
  ctx.fillRect(-13, -8, 5, 16);
  // Wheels.
  ctx.fillStyle = '#14161a';
  ctx.fillRect(-16, -13, 10, 4); ctx.fillRect(7, -13, 10, 4);
  ctx.fillRect(-16, 9, 10, 4); ctx.fillRect(7, 9, 10, 4);
  ctx.restore();
  if (car.kind === 'target') {
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(car.x, car.y, 34 + Math.sin(G.time * 5) * 3, 0, Math.PI * 2); ctx.stroke();
  }
  if (car === G.player.car) {
    // A small chevron so the player always finds their car.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(car.x, car.y - 30 + Math.sin(G.time * 4) * 2);
    ctx.lineTo(car.x - 7, car.y - 40 + Math.sin(G.time * 4) * 2);
    ctx.lineTo(car.x + 7, car.y - 40 + Math.sin(G.time * 4) * 2);
    ctx.closePath(); ctx.fill();
  }
}

function drawPed(ctx, G, ped) {
  if (ped.dead) {
    ctx.fillStyle = 'rgba(90,30,30,0.7)';
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (!onScreen(G, ped.x, ped.y, 30)) return;
  ctx.fillStyle = 'rgba(0,0,0,0.20)';
  ctx.beginPath(); ctx.ellipse(ped.x + 2, ped.y + 3, 9, 5.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(ped.x, ped.y, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath(); ctx.arc(ped.x, ped.y, 4.4, 0, Math.PI * 2); ctx.fill();
  if (ped.state === 'flee') {
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', ped.x, ped.y - 13);
  }
}

function drawPlayer(ctx, G) {
  const p = G.player;
  // A subtle walk bob: the body lifts with distance travelled while the
  // ground shadow stays planted, so steps read as steps, not gliding.
  const bob = p.speedMag > 24 ? Math.abs(Math.sin((p.walkDist || 0) * 0.055)) * 2.4 : 0;
  const by = p.y - bob;
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 4, 12.5, 7, 0, 0, Math.PI * 2); ctx.fill();
  // Aim tick toward the cursor.
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(p.x + Math.cos(p.aim) * 12, by + Math.sin(p.aim) * 12);
  ctx.lineTo(p.x + Math.cos(p.aim) * 21, by + Math.sin(p.aim) * 21);
  ctx.stroke();
  // Nilo: teal jacket, unmistakable among the crowd.
  ctx.fillStyle = '#0e7c86';
  ctx.beginPath(); ctx.arc(p.x, by, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c79b';
  ctx.beginPath(); ctx.arc(p.x, by, 5.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd76a';
  ctx.beginPath(); ctx.arc(p.x, by - 2, 3, 0, Math.PI * 2); ctx.fill(); // cap
}

function drawBullets(ctx, G) {
  ctx.strokeStyle = '#ffe27a';
  ctx.lineWidth = 2.5;
  for (const b of G.bullets) {
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
}

function drawParticles(ctx, G) {
  for (const pt of G.particles) {
    const a = 1 - pt.t / pt.life;
    ctx.globalAlpha = a;
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
