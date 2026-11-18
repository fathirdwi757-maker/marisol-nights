// World state and the one fixed-step simulation that ties every system
// together: player on foot and in cars, traffic, police, combat, missions,
// pickups, shop robberies, camera and day cycle. No drawing, no DOM — the
// renderer and HUD only read what this produces.

import { STEP, WALK_SPEED, WALK_RADIUS, WORLD_W, WORLD_H, VIEW_W, VIEW_H } from './config.js';
import { mulberry32, randRange } from './random.js';
import { buildCity, collideCircle, circleHitsBuilding, districtLabelAt } from './city.js';
import { spawnParkedCars, stepCarPhysics, collideCarPair, nearestEnterableCar } from './vehicles.js';
import { spawnPeds, stepTraffic, stepPeds } from './traffic.js';
import { stepPolice, addCrime } from './police.js';
import { tryShoot, stepBullets, stepParticles, burst } from './combat.js';
import { setupMissions, armMission, stepMissions, notifyEnterCar, say } from './missions.js';
import { storeSave } from './save.js';

export function createWorld(seed) {
  const rng = mulberry32(seed || 1);
  const city = buildCity(rng);
  const start = city.landmarks.start;
  const G = {
    rng, city,
    time: 0, dayT: 0.32, // late-morning light at spawn
    mode: 'title',
    player: { x: start.x + 30, y: start.y + 20, angle: -Math.PI / 2, aim: -Math.PI / 2, hp: 100, car: null, speedMag: 0, vx: 0, vy: 0, walkDist: 0 },
    cars: [], cops: [], peds: [], bullets: [], particles: [], pickups: [],
    events: [], threat: null, dialog: null,
    heat: 0, wanted: 0, busted: 0, seenByCop: false, copSpawnT: 0, roadblockSet: false,
    money: 40, packagesFound: 0, storyDone: false,
    fireCool: 0, robT: 0, saveT: 0, prompt: '',
    camera: { x: 0, y: 0 },
    district: '',
    mouseWorld: { x: start.x + 30, y: start.y - 100 },
  };
  spawnParkedCars(G);
  spawnPeds(G);
  spawnPackages(G);
  setupMissions(G);
  armMission(G);
  updateCamera(G);
  return G;
}

function spawnPackages(G) {
  const { city, rng } = G;
  let placed = 0, guard = 0;
  while (placed < 10 && guard++ < 300) {
    const b = city.blocks[Math.floor(rng() * city.blocks.length)];
    const x = b.x + randRange(rng, 24, b.w - 24);
    const y = b.y + randRange(rng, 24, b.h - 24);
    if (circleHitsBuilding(city, x, y, 16)) continue;
    G.pickups.push({ x, y, taken: false, phase: rng() * Math.PI * 2 });
    placed++;
  }
}

export function applySave(G, data) {
  if (!data) return;
  if (typeof data.money === 'number') G.money = data.money;
  if (typeof data.packages === 'number') {
    G.packagesFound = data.packages;
    let left = data.packages;
    for (const p of G.pickups) { if (left > 0) { p.taken = true; left--; } }
  }
  if (typeof data.missionIndex === 'number') {
    G.missionIndex = Math.min(data.missionIndex, G.missionList.length);
    if (G.missionIndex >= G.missionList.length) G.storyDone = true;
    armMission(G);
  }
  if (typeof data.x === 'number' && typeof data.y === 'number') {
    G.player.x = data.x; G.player.y = data.y;
  }
  if (data.storyDone) G.storyDone = true;
}

export function stepWorld(G, input, dt) {
  G.time += dt;
  if (G.mode === 'title') {
    if (input.wasPressed('confirm')) { G.mode = 'play'; G.events.push('enter'); }
    updateCamera(G, dt);
    return;
  }
  if (G.mode === 'pause') {
    if (input.wasPressed('pause') || input.wasPressed('confirm')) G.mode = 'play';
    return;
  }
  if (G.mode === 'busted' || G.mode === 'wasted') {
    if (input.wasPressed('confirm')) respawn(G);
    return;
  }
  if (input.wasPressed('pause')) { G.mode = 'pause'; return; }

  G.dayT = (G.dayT + dt / 260) % 1;
  G.fireCool = Math.max(0, G.fireCool - dt);
  if (G.dialog) { G.dialog.t += dt; if (G.dialog.t > G.dialog.dur) G.dialog = null; }

  stepPlayer(G, input, dt);
  stepTraffic(G, dt);
  stepPeds(G, dt);
  stepCarContacts(G, dt);
  stepPolice(G, dt);
  stepBullets(G, dt);
  stepParticles(G, dt);
  stepMissions(G, dt);
  stepPickups(G);
  stepRobbery(G, input, dt);

  if (G.busted >= 1) {
    G.mode = 'busted';
    G.events.push('busted');
    return;
  }
  if (G.player.hp <= 0) {
    G.mode = 'wasted';
    G.events.push('fail');
    return;
  }
  if (G.wanted === 0 && G.player.hp < 100) G.player.hp = Math.min(100, G.player.hp + 1.1 * dt);

  G.district = districtLabelAt(G.city, G.player.x, G.player.y);
  updateCamera(G, dt);

  G.saveT += dt;
  if (G.saveT > 15) { G.saveT = 0; storeSave(G); }
}

// Move `value` toward `target` by at most `maxDelta` (a linear ramp).
function approach(value, target, maxDelta) {
  if (value < target) return Math.min(target, value + maxDelta);
  return Math.max(target, value - maxDelta);
}

function stepPlayer(G, input, dt) {
  const p = G.player;
  p.aim = Math.atan2(G.mouseWorld.y - p.y, G.mouseWorld.x - p.x);

  if (p.car) {
    const car = p.car;
    const throttle = (input.isHeld('up') ? 1 : 0) - (input.isHeld('down') ? 1 : 0);
    const steer = (input.isHeld('right') ? 1 : 0) - (input.isHeld('left') ? 1 : 0);
    const impact = stepCarPhysics(G, car, throttle, steer, dt, input.isHeld('brake'));
    if (impact > 0) {
      G.events.push('crash');
      burst(G, car.x, car.y, '#f5d76e', 8, 120);
      if (impact > 290) p.hp -= 7;
    }
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    p.speedMag = Math.abs(car.speed);
    p.vx = 0; p.vy = 0;
    if (input.wasPressed('interact')) exitCar(G);
    if (input.mouse.down) tryShoot(G);
    return;
  }

  // On foot: velocity-based movement. Nilo accelerates toward the input
  // direction and glides to a stop under friction when it is released,
  // instead of snapping between full speed and a standstill in one step.
  // The top speed is unchanged: WALK_SPEED (x1.35 while running).
  const mx = input.axisX(), my = input.axisY();
  const moving = mx !== 0 || my !== 0;
  const run = input.isHeld('run') ? 1.35 : 1;
  let tx = 0, ty = 0;
  if (moving) {
    const len = Math.hypot(mx, my);
    tx = (mx / len) * WALK_SPEED * run;
    ty = (my / len) * WALK_SPEED * run;
  }
  const rate = moving ? 1250 : 950; // px/s^2 toward the target velocity
  p.vx = approach(p.vx || 0, tx, rate * dt);
  p.vy = approach(p.vy || 0, ty, rate * dt);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.speedMag = Math.hypot(p.vx, p.vy);
  p.walkDist = (p.walkDist || 0) + p.speedMag * dt;
  // Facing eases toward the aim along the shortest arc (frame-rate
  // independent), so turns read as a swing, not a snap.
  let faceDiff = p.aim - p.angle;
  while (faceDiff > Math.PI) faceDiff -= Math.PI * 2;
  while (faceDiff < -Math.PI) faceDiff += Math.PI * 2;
  p.angle += faceDiff * (1 - Math.exp(-14 * dt));
  const pos = { x: p.x, y: p.y };
  collideCircle(G.city, pos, WALK_RADIUS);
  p.x = pos.x; p.y = pos.y;
  // Cars are solid on foot too.
  for (const car of G.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    const min = 30;
    if (d > 0.01 && d < min) {
      p.x = car.x + (p.x - car.x) / d * min;
      p.y = car.y + (p.y - car.y) / d * min;
    }
  }
  if (input.wasPressed('interact')) {
    const car = nearestEnterableCar(G, p.x, p.y, 56);
    if (car) enterCar(G, car);
  }
  if (input.mouse.down) tryShoot(G);
}

function enterCar(G, car) {
  const p = G.player;
  if (car.kind === 'traffic' && car.driver) {
    // The driver bails out and runs.
    G.peds.push({ x: car.x + 18, y: car.y + 10, tx: car.x, ty: car.y, angle: 0, speed: 52, color: '#ecf0f1', state: 'flee', fleeT: 2, fx: p.x, fy: p.y, hp: 100, dead: false, waitT: 0 });
    car.driver = false;
    addCrime(G, 55, car.x, car.y);
  } else if (!car.wasPlayers && car.kind !== 'target') {
    addCrime(G, 45, car.x, car.y); // stealing a parked car
  }
  if (car.kind === 'target') addCrime(G, 30, car.x, car.y);
  car.kind = 'player';
  car.wasPlayers = true;
  p.car = car;
  p.x = car.x; p.y = car.y;
  G.events.push('enter');
  notifyEnterCar(G, car);
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  car.kind = 'parked';
  car.speed = 0;
  car.throttleSm = 0;
  car.steerSm = 0;
  p.car = null;
  p.vx = 0; p.vy = 0;
  // Step out to the left of the car, unless a building blocks it.
  const lx = car.x + Math.cos(car.angle - Math.PI / 2) * 34;
  const ly = car.y + Math.sin(car.angle - Math.PI / 2) * 34;
  if (!circleHitsBuilding(G.city, lx, ly, WALK_RADIUS + 2)) { p.x = lx; p.y = ly; }
  else { p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34; p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34; }
  const pos = { x: p.x, y: p.y };
  collideCircle(G.city, pos, WALK_RADIUS);
  p.x = pos.x; p.y = pos.y;
}

function stepCarContacts(G, dt) {
  // Car vs car.
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.dead || b.dead) continue;
      if (collideCarPair(a, b)) {
        if (a === G.player.car || b === G.player.car) {
          G.events.push('crash');
          if (a.kind === 'cop' || b.kind === 'cop') addCrime(G, 18, G.player.x, G.player.y);
        }
      }
    }
  }
  // Cars vs pedestrians: fast cars are lethal, and it is a crime.
  for (const car of cars) {
    if (car.dead || Math.abs(car.speed) < 110) continue;
    for (const ped of G.peds) {
      if (ped.dead) continue;
      if (Math.hypot(ped.x - car.x, ped.y - car.y) < 24) {
        ped.hp -= 75;
        burst(G, ped.x, ped.y, '#c0392b', 7, 110);
        G.threat = { x: car.x, y: car.y, t: G.time };
        if (ped.hp <= 0) ped.dead = true;
        if (car === G.player.car) { addCrime(G, 85, ped.x, ped.y); G.events.push('crash'); }
      }
    }
  }
}

function stepPickups(G) {
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - G.player.x, pk.y - G.player.y) < 30) {
      pk.taken = true;
      G.packagesFound++;
      G.money += 25;
      G.events.push('pickup');
      say(G, 'Paket', `Paket tersembunyi ditemukan (${G.packagesFound}/10) — +$25`, 2.2);
    }
  }
}

function stepRobbery(G, input, dt) {
  G.prompt = '';
  const p = G.player;
  if (p.car) {
    const near = nearestEnterableCar(G, p.x, p.y, 10); // unused while driving
    G.prompt = 'E — keluar mobil • Klik — tembak • P — jeda';
    return;
  }
  const carNear = nearestEnterableCar(G, p.x, p.y, 56);
  if (carNear) G.prompt = 'E — masuk mobil';
  for (const shop of G.city.shops) {
    if (Math.hypot(shop.x - p.x, shop.y - p.y) < 46 && G.time - (shop.robbedAt || -999) > 60) {
      G.prompt = `Tahan F — rampok ${shop.name}`;
      if (input.isHeld('action')) {
        G.robT += dt;
        G.prompt = `Merampok ${shop.name}… ${Math.round(G.robT / 1.6 * 100)}%`;
        if (G.robT >= 1.6) {
          G.robT = 0;
          shop.robbedAt = G.time;
          G.money += 60;
          G.events.push('cash');
          addCrime(G, 75, shop.x, shop.y);
          say(G, shop.name, 'Ambil uangnya! Aku panggil polisi!', 2);
        }
      } else G.robT = Math.max(0, G.robT - dt * 2);
      return;
    }
  }
  if (!G.prompt) G.prompt = 'WASD — jalan • E — mobil • Klik — tembak';
}

function respawn(G) {
  const fine = G.mode === 'busted' ? 50 : 80;
  G.money = Math.max(0, G.money - fine);
  G.heat = 0; G.wanted = 0; G.busted = 0;
  G.cars = G.cars.filter((c) => c.kind !== 'cop');
  G.cops = [];
  if (G.player.car) { G.player.car.kind = 'parked'; G.player.car = null; }
  const s = G.city.landmarks.workshop;
  G.player.x = s.x; G.player.y = s.y;
  G.player.vx = 0; G.player.vy = 0;
  G.player.hp = 100;
  G.mode = 'play';
  say(G, 'Sinta', G.mode === 'play' && fine === 50 ? 'Sudah kubilang hati-hati. Bengkelku jadi tempat persembunyianmu lagi.' : 'Kau sadar di bengkelku. Istirahat dulu, baru lanjut.', 3.2);
  storeSave(G);
}

function updateCamera(G, dt) {
  // A gentle lookahead: the view leads Nilo a little along his motion —
  // by car speed and heading when driving, by walk velocity on foot —
  // capped so it never feels like the world is sliding away.
  let lx = 0, ly = 0;
  const p = G.player;
  if (p.car) {
    lx = Math.cos(p.angle) * p.car.speed * 0.22;
    ly = Math.sin(p.angle) * p.car.speed * 0.22;
    const m = Math.hypot(lx, ly);
    if (m > 64) { lx = lx / m * 64; ly = ly / m * 64; }
  } else {
    lx = (p.vx || 0) * 0.18;
    ly = (p.vy || 0) * 0.18;
    const m = Math.hypot(lx, ly);
    if (m > 40) { lx = lx / m * 40; ly = ly / m * 40; }
  }
  const tx = Math.max(0, Math.min(WORLD_W - VIEW_W, p.x + lx - VIEW_W / 2));
  const ty = Math.max(0, Math.min(WORLD_H - VIEW_H, p.y + ly - VIEW_H / 2));
  if (dt === undefined || !G.camInit) {
    // First framing (world creation): snap, exactly as before.
    G.camera.x = tx; G.camera.y = ty;
    G.camInit = true;
    return;
  }
  // Exponential smoothing, frame-rate independent: the camera glides
  // after its target instead of being hard-locked to the player.
  const k = 1 - Math.exp(-7.5 * dt);
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
  G.camera.x = Math.max(0, Math.min(WORLD_W - VIEW_W, G.camera.x));
  G.camera.y = Math.max(0, Math.min(WORLD_H - VIEW_H, G.camera.y));
}

export { STEP };
