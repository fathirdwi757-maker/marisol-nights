// The wanted system: crimes witnessed by pedestrians, drivers or police
// raise heat; heat becomes stars; stars send cop cars that hunt Nilo and
// fill the busted meter on close contact. Hiding cools the heat down.

import { HEAT_PER_STAR, HEAT_DECAY, HEAT_DECAY_SEEN, BUSTED_FILL_TIME, CAR_RADIUS } from './config.js';
import { createCar, stepCarPhysics } from './vehicles.js';
import { isOnRoad } from './city.js';

export function starsForHeat(heat) {
  if (heat <= 0) return 0;
  return Math.max(1, Math.min(5, Math.floor(heat / HEAT_PER_STAR) + (heat % HEAT_PER_STAR > 0 ? 1 : 0) - (heat >= HEAT_PER_STAR ? 0 : 0)));
}

export function addCrime(G, amount, x, y) {
  const px = x !== undefined ? x : G.player.x;
  const py = y !== undefined ? y : G.player.y;
  let witnessed = false;
  const watch = (ox, oy) => Math.hypot(ox - px, oy - py) < 260;
  for (const ped of G.peds) if (!ped.dead && watch(ped.x, ped.y)) { witnessed = true; break; }
  if (!witnessed) for (const car of G.cars) if (!car.dead && car.driver && watch(car.x, car.y)) { witnessed = true; break; }
  G.heat = Math.min(HEAT_PER_STAR * 5 + 60, G.heat + (witnessed ? amount : amount * 0.2));
  return witnessed;
}

export function spawnCop(G) {
  const { city, rng } = G;
  // Enter from a road roughly 650px away, never inside a building.
  for (let tries = 0; tries < 10; tries++) {
    const ang = rng() * Math.PI * 2;
    const x = G.player.x + Math.cos(ang) * 660;
    const y = G.player.y + Math.sin(ang) * 660;
    if (x < 40 || y < 40 || x > 2160 || y > 1630) continue;
    if (!isOnRoad(city, x, y)) continue;
    const cop = createCar(x, y, ang + Math.PI, '#20242c', 'cop');
    cop.driver = true;
    G.cars.push(cop);
    G.cops.push(cop);
    return cop;
  }
  return null;
}

function desiredCopCount(G) {
  return G.wanted; // one car per star, up to five
}

export function stepPolice(G, dt) {
  G.wanted = G.heat <= 0 ? 0 : Math.min(5, Math.ceil(G.heat / HEAT_PER_STAR));

  // Who can see Nilo right now?
  G.seenByCop = false;
  for (const cop of G.cops) {
    if (Math.hypot(cop.x - G.player.x, cop.y - G.player.y) < 470) { G.seenByCop = true; break; }
  }
  G.heat = Math.max(0, G.heat - (G.seenByCop ? HEAT_DECAY_SEEN : HEAT_DECAY) * dt);

  // Reinforce or release.
  if (G.cops.length < desiredCopCount(G)) {
    G.copSpawnT -= dt;
    if (G.copSpawnT <= 0) { spawnCop(G); G.copSpawnT = 1.4; }
  }
  if (G.wanted === 0) {
    // Chase over: cops give up and drive off, then vanish.
    for (const cop of G.cops) cop.giveUp = true;
  }
  G.cops = G.cops.filter((cop) => {
    const far = Math.hypot(cop.x - G.player.x, cop.y - G.player.y) > 1150;
    if ((cop.giveUp && far) || cop.dead) {
      G.cars = G.cars.filter((c) => c !== cop);
      return false;
    }
    return true;
  });

  // Roadblock once per high-wanted episode.
  if (G.wanted >= 4 && !G.roadblockSet) {
    setRoadblock(G);
    G.roadblockSet = true;
  }
  if (G.wanted < 3) G.roadblockSet = false;

  // Drive the hunt.
  let busting = false;
  for (const cop of G.cops) {
    if (!cop.driver) continue; // roadblock cars stay put
    const target = G.player.car || G.player;
    const dx = target.x - cop.x, dy = target.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (cop.giveUp) {
      stepCarPhysics(G, cop, 0.6, 0, dt, false);
      continue;
    }
    const want = Math.atan2(dy, dx);
    let diff = want - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const steer = Math.max(-1, Math.min(1, diff * 2.4));
    let throttle = 1;
    if (dist < 64) throttle = 0.15;
    if (!G.player.car && dist < 78) throttle = 0; // foot chase: stop and arrest
    stepCarPhysics(G, cop, throttle, steer, dt, false);
    // Arrest contact.
    const pd = Math.hypot(G.player.x - cop.x, G.player.y - cop.y);
    const playerSlow = G.player.car ? Math.abs(G.player.car.speed) < 42 : true;
    if (pd < CAR_RADIUS + 34 && playerSlow && G.wanted > 0) busting = true;
  }
  if (busting) G.busted = Math.min(1, G.busted + dt / BUSTED_FILL_TIME);
  else G.busted = Math.max(0, G.busted - dt * 1.8);
}

function setRoadblock(G) {
  const { city } = G;
  // Park two cop cars across the road nearest to a point ahead of Nilo.
  const ahead = 300;
  const px = G.player.x + Math.cos(G.player.angle) * ahead;
  const py = G.player.y + Math.sin(G.player.angle) * ahead;
  let bx = px, by = py, vertical = false;
  let bd = Infinity;
  for (const r of city.vRoads) { const d = Math.abs(r.cx - px); if (d < bd) { bd = d; bx = r.cx; by = py; vertical = true; } }
  bd = Infinity;
  for (const r of city.hRoads) { const d = Math.abs(r.cy - py); if (d < bd) { bd = d; by = r.cy; bx = px; vertical = false; } }
  for (let i = -1; i <= 1; i += 2) {
    const x = vertical ? bx : bx + i * 30;
    const y = vertical ? by + i * 30 : by;
    const cop = createCar(x, y, vertical ? 0 : Math.PI / 2, '#20242c', 'cop');
    cop.driver = false;
    cop.roadblock = true;
    G.cars.push(cop);
    G.cops.push(cop);
  }
}
