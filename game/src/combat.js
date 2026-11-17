// Pistol combat: mouse-aimed shots on foot or as drive-by, fast bullets,
// spark and hit particles, and the crime heat that gunfire brings.

import { BULLET_SPEED, BULLET_LIFE, FIRE_COOLDOWN } from './config.js';
import { circleHitsBuilding } from './city.js';
import { addCrime } from './police.js';

export function burst(G, x, y, color, n, speed) {
  for (let i = 0; i < n; i++) {
    const a = G.rng() * Math.PI * 2;
    const s = (0.3 + G.rng() * 0.7) * (speed || 90);
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.32 + G.rng() * 0.25, t: 0, color, r: 2 + G.rng() * 2 });
  }
}

export function tryShoot(G) {
  if (G.fireCool > 0) return;
  G.fireCool = FIRE_COOLDOWN;
  const p = G.player;
  const a = p.aim;
  const sx = p.x + Math.cos(a) * 20, sy = p.y + Math.sin(a) * 20;
  G.bullets.push({ x: sx, y: sy, vx: Math.cos(a) * BULLET_SPEED, vy: Math.sin(a) * BULLET_SPEED, life: BULLET_LIFE });
  G.threat = { x: p.x, y: p.y, t: G.time };
  G.events.push('shot');
  burst(G, sx, sy, '#ffd76a', 3, 60);
  addCrime(G, 26, p.x, p.y);
}

export function stepBullets(G, dt) {
  const kept = [];
  for (const b of G.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (circleHitsBuilding(G.city, b.x, b.y, 3)) {
      burst(G, b.x, b.y, '#f5d76e', 4, 70);
      continue;
    }
    let hit = false;
    for (const ped of G.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - b.x, ped.y - b.y) < 13) {
        ped.hp -= 55;
        burst(G, ped.x, ped.y, '#c0392b', 6, 90);
        if (ped.hp <= 0) { ped.dead = true; addCrime(G, 95, ped.x, ped.y); }
        else { ped.state = 'flee'; ped.fleeT = 1.6; ped.fx = b.x; ped.fy = b.y; }
        hit = true; break;
      }
    }
    if (hit) continue;
    for (const car of G.cars) {
      if (car === G.player.car) continue;
      if (Math.hypot(car.x - b.x, car.y - b.y) < 24) {
        car.hp -= 11;
        burst(G, b.x, b.y, '#f5d76e', 4, 80);
        if (car.kind === 'cop') addCrime(G, 55, car.x, car.y);
        if (car.hp <= 0 && !car.dead) { car.dead = true; burst(G, car.x, car.y, '#e67e22', 16, 130); G.events.push('crash'); }
        hit = true; break;
      }
    }
    if (!hit) kept.push(b);
  }
  G.bullets = kept;
}

export function stepParticles(G, dt) {
  const kept = [];
  for (const pt of G.particles) {
    pt.t += dt;
    if (pt.t >= pt.life) continue;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92; pt.vy *= 0.92;
    kept.push(pt);
  }
  G.particles = kept;
}
