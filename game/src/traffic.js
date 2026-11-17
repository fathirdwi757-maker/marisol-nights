// Ambient life: NPC cars cruising the road grid on the correct side, and
// pedestrians strolling the sidewalks who scatter when danger comes near.
// Traffic cars drive lane-by-lane between intersections and mostly go
// straight on, which reads as believable city flow from above.

import { CAR_RADIUS } from './config.js';
import { makeTrafficCar, dirVector, dirAngle } from './vehicles.js';
import { randRange, pick, chance } from './random.js';
import { PED_COLORS } from './config.js';

const LANE = 18;
const TARGET_TRAFFIC = 13;
const TARGET_PEDS = 26;

export function spawnPeds(G) {
  const { city, rng } = G;
  for (let i = 0; i < TARGET_PEDS; i++) {
    const b = pick(rng, city.blocks);
    const ped = {
      x: b.x + randRange(rng, 14, b.w - 14),
      y: b.y + randRange(rng, 14, b.h - 14),
      tx: 0, ty: 0, angle: 0, speed: randRange(rng, 34, 58),
      color: pick(rng, PED_COLORS), state: 'walk', fleeT: 0, hp: 100, dead: false, waitT: 0,
    };
    retargetPed(G, ped);
    G.peds.push(ped);
  }
}

function retargetPed(G, ped) {
  // Walk the sidewalk ring of a nearby block: pick a point on a block edge.
  const { city, rng } = G;
  const b = pick(rng, city.blocks);
  const side = Math.floor(rng() * 4);
  if (side === 0) { ped.tx = b.x + randRange(rng, 10, b.w - 10); ped.ty = b.y + 14; }
  else if (side === 1) { ped.tx = b.x + randRange(rng, 10, b.w - 10); ped.ty = b.y + b.h - 14; }
  else if (side === 2) { ped.tx = b.x + 14; ped.ty = b.y + randRange(rng, 10, b.h - 10); }
  else { ped.tx = b.x + b.w - 14; ped.ty = b.y + randRange(rng, 10, b.h - 10); }
}

export function stepTraffic(G, dt) {
  const { city, rng } = G;
  // Keep the city populated.
  let trafficCount = 0;
  for (const c of G.cars) if (c.kind === 'traffic' && !c.dead) trafficCount++;
  if (trafficCount < TARGET_TRAFFIC && chance(rng, 0.03)) {
    const car = makeTrafficCar(G);
    if (car) G.cars.push(car);
  }

  for (const car of G.cars) {
    if (car.kind !== 'traffic' || car.dead) continue;
    const [vx, vy] = dirVector(car.dir);
    // Slow for a car ahead or a pedestrian crossing.
    let want = car.cruise;
    for (const other of G.cars) {
      if (other === car || other.dead) continue;
      const ahead = (other.x - car.x) * vx + (other.y - car.y) * vy;
      const side = Math.abs((other.x - car.x) * vy - (other.y - car.y) * vx);
      if (ahead > 0 && ahead < 74 && side < 30) want = Math.min(want, Math.max(0, (ahead - 46) * 3));
    }
    for (const ped of G.peds) {
      if (ped.dead) continue;
      const ahead = (ped.x - car.x) * vx + (ped.y - car.y) * vy;
      const side = Math.abs((ped.x - car.x) * vy - (ped.y - car.y) * vx);
      if (ahead > 0 && ahead < 56 && side < 24) { want = 0; break; }
    }
    car.speed += Math.sign(want - car.speed) * Math.min(Math.abs(want - car.speed), 190 * dt);
    car.x += vx * car.speed * dt;
    car.y += vy * car.speed * dt;

    // Snap back to the lane centre line of the current road band.
    if (car.dir === 0 || car.dir === 2) {
      const road = nearestHRoad(city, car.y);
      const target = road.cy + (car.dir === 0 ? LANE : -LANE);
      car.y += (target - car.y) * Math.min(1, 3 * dt);
    } else {
      const road = nearestVRoad(city, car.x);
      const target = road.cx + (car.dir === 1 ? -LANE : LANE);
      car.x += (target - car.x) * Math.min(1, 3 * dt);
    }

    // At an intersection, mostly go straight, sometimes turn.
    if (atIntersection(city, car.x, car.y)) {
      if (!car.turnCool || G.time > car.turnCool) {
        car.turnCool = G.time + 1.2;
        if (chance(rng, 0.3)) {
          const turn = chance(rng, 0.5) ? 1 : 3;
          car.dir = (car.dir + turn) % 4;
        }
      }
    }
    car.angle = dirAngle(car.dir);
    // Recycle cars that leave the world.
    if (car.x < -60 || car.y < -60 || car.x > 2260 || car.y > 1740) {
      car.dead = true;
    }
  }
  // Remove wrecks and recycled cars (but never the player's or a cop).
  G.cars = G.cars.filter((c) => !(c.dead && c.kind === 'traffic'));
}

function nearestVRoad(city, x) {
  let best = city.vRoads[0], bd = Infinity;
  for (const r of city.vRoads) { const d = Math.abs(r.cx - x); if (d < bd) { bd = d; best = r; } }
  return best;
}

function nearestHRoad(city, y) {
  let best = city.hRoads[0], bd = Infinity;
  for (const r of city.hRoads) { const d = Math.abs(r.cy - y); if (d < bd) { bd = d; best = r; } }
  return best;
}

function atIntersection(city, x, y) {
  let onV = false, onH = false;
  for (const r of city.vRoads) if (x > r.x0 + 20 && x < r.x1 - 20) onV = true;
  for (const r of city.hRoads) if (y > r.y0 + 20 && y < r.y1 - 20) onH = true;
  return onV && onH;
}

export function stepPeds(G, dt) {
  for (const ped of G.peds) {
    if (ped.dead) continue;
    let speed = ped.speed;
    // Flee from gunfire, fast cars and police chases nearby.
    const threat = G.threat;
    if (threat && G.time - threat.t < 1.4) {
      const d = Math.hypot(ped.x - threat.x, ped.y - threat.y);
      if (d < 170) { ped.state = 'flee'; ped.fleeT = 1.2; ped.fx = threat.x; ped.fy = threat.y; }
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const dx = ped.x - ped.fx, dy = ped.y - ped.fy;
      const d = Math.hypot(dx, dy) || 1;
      ped.x += (dx / d) * 128 * dt;
      ped.y += (dy / d) * 128 * dt;
      ped.angle = Math.atan2(dy, dx);
      if (ped.fleeT <= 0) { ped.state = 'walk'; retargetPed(G, ped); }
      continue;
    }
    if (ped.waitT > 0) { ped.waitT -= dt; continue; }
    const dx = ped.tx - ped.x, dy = ped.ty - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) {
      if (chance(G.rng, 0.3)) ped.waitT = randRange(G.rng, 0.4, 1.6);
      retargetPed(G, ped);
      continue;
    }
    ped.x += (dx / d) * speed * dt;
    ped.y += (dy / d) * speed * dt;
    ped.angle = Math.atan2(dy, dx);
  }
}
