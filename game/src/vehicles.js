// Cars: creation, arcade driving physics and parked-car placement.
// One car shape serves the player, traffic, police and mission targets;
// the `kind` field says who is driving it.

import { CAR_ACCEL, CAR_MAX_SPEED, CAR_MAX_REVERSE, CAR_TURN, CAR_RADIUS, CAR_COLORS } from './config.js';
import { collideCircle, circleHitsBuilding, isOnRoad } from './city.js';
import { pick, randRange } from './random.js';

let nextCarId = 1;

export function createCar(x, y, angle, color, kind) {
  return {
    id: nextCarId++,
    x, y, angle, speed: 0,
    w: 44, h: 22,
    color, kind, // 'player' | 'traffic' | 'parked' | 'cop' | 'target'
    hp: 100,
    driver: kind === 'traffic' || kind === 'cop',
    dir: 0, // traffic heading: 0 east, 1 south, 2 west, 3 north
    cruise: 150,
    honkT: 0,
    dead: false,
  };
}

export function spawnParkedCars(G) {
  const { city, rng } = G;
  // Parked cars hug block edges (on the road, next to the sidewalk).
  for (const b of city.blocks) {
    if (b.kind === 'park') continue;
    const n = b.kind === 'beach' ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const side = Math.floor(rng() * 4);
      let x, y, angle;
      if (side === 0) { x = b.x + randRange(rng, 40, b.w - 40); y = b.y - 26; angle = 0; }
      else if (side === 1) { x = b.x + randRange(rng, 40, b.w - 40); y = b.y + b.h + 26; angle = Math.PI; }
      else if (side === 2) { x = b.x - 26; y = b.y + randRange(rng, 40, b.h - 40); angle = Math.PI / 2; }
      else { x = b.x + b.w + 26; y = b.y + randRange(rng, 40, b.h - 40); angle = -Math.PI / 2; }
      if (circleHitsBuilding(city, x, y, CAR_RADIUS + 4)) continue;
      const car = createCar(x, y, angle, pick(rng, CAR_COLORS), 'parked');
      car.driver = false;
      G.cars.push(car);
    }
  }
  // A few already cruising the grid when the world starts.
  for (let i = 0; i < 7; i++) {
    const car = makeTrafficCar(G);
    if (car) G.cars.push(car);
  }
}

export function makeTrafficCar(G) {
  const { city, rng } = G;
  for (let tries = 0; tries < 12; tries++) {
    const vertical = rng() < 0.5;
    let x, y, dir;
    if (vertical) {
      const road = city.vRoads[Math.floor(rng() * city.vRoads.length)];
      dir = rng() < 0.5 ? 1 : 3; // south or north
      x = road.cx + (dir === 1 ? -18 : 18);
      y = randRange(rng, 80, 1600);
    } else {
      const road = city.hRoads[Math.floor(rng() * city.hRoads.length)];
      dir = rng() < 0.5 ? 0 : 2; // east or west
      y = road.cy + (dir === 0 ? 18 : -18);
      x = randRange(rng, 80, 2100);
    }
    if (circleHitsBuilding(city, x, y, CAR_RADIUS + 2)) continue;
    const car = createCar(x, y, dirAngle(dir), pick(rng, CAR_COLORS), 'traffic');
    car.dir = dir;
    car.cruise = randRange(rng, 120, 185);
    return car;
  }
  return null;
}

export function dirAngle(dir) {
  return [0, Math.PI / 2, Math.PI, -Math.PI / 2][dir];
}

export function dirVector(dir) {
  return [[1, 0], [0, 1], [-1, 0], [0, -1]][dir];
}

// Advance one car with driver inputs: throttle -1..1, steer -1..1.
// Returns impact speed if it slammed a building this step, else 0.
export function stepCarPhysics(G, car, throttle, steer, dt, handbrake) {
  const accel = throttle > 0 ? CAR_ACCEL : CAR_ACCEL * 0.7;
  car.speed += throttle * accel * dt;
  // Drag and rolling friction.
  car.speed -= car.speed * (handbrake ? 2.6 : 0.55) * dt;
  if (throttle === 0) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
  car.speed = Math.max(-CAR_MAX_REVERSE, Math.min(CAR_MAX_SPEED, car.speed));
  if (Math.abs(car.speed) > 4) {
    const grip = Math.min(1, Math.abs(car.speed) / 130);
    car.angle += steer * CAR_TURN * grip * dt * (car.speed >= 0 ? 1 : -1);
  }
  const before = Math.abs(car.speed);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const p = { x: car.x, y: car.y };
  const hit = collideCircle(G.city, p, CAR_RADIUS);
  car.x = p.x; car.y = p.y;
  if (hit && before > 150) {
    car.speed *= 0.25;
    car.hp -= (before - 150) / 14;
    return before;
  }
  if (hit) car.speed *= 0.6;
  return 0;
}

// Soft push-apart between two cars; returns true if they touched hard.
export function collideCarPair(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const min = CAR_RADIUS * 1.7;
  if (dist === 0 || dist >= min) return false;
  const push = (min - dist) / 2;
  const nx = dx / dist, ny = dy / dist;
  const aMovable = a.kind !== 'parked';
  const bMovable = b.kind !== 'parked';
  if (aMovable) { a.x -= nx * push; a.y -= ny * push; }
  if (bMovable) { b.x += nx * push; b.y += ny * push; }
  const rel = Math.abs(a.speed) + Math.abs(b.speed);
  if (rel > 130) {
    a.hp -= 4; b.hp -= 4;
    a.speed *= 0.55; b.speed *= 0.55;
    return true;
  }
  return false;
}

export function nearestEnterableCar(G, x, y, maxDist) {
  let best = null, bestD = maxDist;
  for (const car of G.cars) {
    if (car.dead || car.kind === 'cop') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function isCarOnRoad(G, car) {
  return isOnRoad(G.city, car.x, car.y);
}
