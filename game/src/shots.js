// Screenshot staging for Marisol Nights. Each scene arranges the REAL
// game state — real cars, cops, missions and dialogue — then lets the
// simulation run briefly so traffic and pedestrians settle naturally.
// Nothing here draws anything the game itself would not draw.

import { createCar } from './vehicles.js';
import { spawnCop } from './police.js';
import { say } from './missions.js';

function stubInput(drive) {
  return {
    mouse: { x: 900, y: 300, down: false },
    isHeld: (n) => (drive ? n === 'up' : false),
    wasPressed: () => false,
    axisX: () => 0,
    axisY: () => 0,
    endFrame: () => {},
  };
}

function putPlayerInCar(G, x, y, angle, speed, color) {
  const car = createCar(x, y, angle, color || '#d95f4b', 'player');
  car.speed = speed;
  car.wasPlayers = true;
  G.cars.push(car);
  G.player.car = car;
  G.player.x = x; G.player.y = y; G.player.angle = angle;
  return car;
}

// Returns { steps, input } for main.js to run before drawing the frame.
export function stageShot(G, name) {
  const city = G.city;
  G.mode = 'play';
  if (name === 'cover') {
    // Cruising east through Aurora Downtown at midday, traffic all around,
    // first mission objective live on the minimap.
    const road = city.hRoads[1];
    putPlayerInCar(G, city.vRoads[2].cx - 150, road.cy + 18, 0, 215);
    G.dayT = 0.45;
    return { steps: 70, input: stubInput(true) };
  }
  if (name === 'chase') {
    // Mission 5's escape, mid-chase: four stars, three cop cars behind,
    // the park hideout marked as the objective.
    G.missionIndex = 4;
    G.stageIndex = 0;
    G.missionIntroShown = false;
    const road = city.hRoads[1];
    const car = putPlayerInCar(G, city.vRoads[2].cx + 140, road.cy + 18, 0, 300, '#57a773');
    G.heat = 340;
    for (let i = 0; i < 3; i++) {
      const cop = spawnCop(G);
      if (cop) {
        cop.x = car.x - 130 - i * 95;
        cop.y = road.cy + (i % 2 === 0 ? 18 : -18);
        cop.angle = 0;
        cop.speed = 265;
      }
    }
    G.dayT = 0.55;
    return { steps: 55, input: stubInput(true) };
  }
  if (name === 'mission') {
    // On foot at Sinta's workshop, parcel in hand, delivery objective and
    // dialogue on screen, market-day crowd around.
    const w = city.landmarks.workshop;
    G.missionIndex = 0;
    G.stageIndex = 1;
    G.missionIntroShown = true;
    G.player.x = w.x + 88;
    G.player.y = w.y + 66;
    G.player.aim = Math.PI;
    G.dayT = 0.42;
    say(G, 'Sinta', 'Itu dia paketnya, Nilo! Sini, biar kubantu angkat ke bengkel.', 30);
    return { steps: 26, input: stubInput(false) };
  }
  // 'night': a harbour delivery after dark — headlights, lamp glow, one
  // star of trouble and a shot just fired at a fleeing troublemaker.
  G.nightOverride = 1;
  G.missionIndex = 1;
  G.stageIndex = 1;
  G.missionIntroShown = true;
  const d = city.landmarks.harborDock;
  G.player.x = d.x - 120;
  G.player.y = d.y - 40;
  G.player.aim = 0.25;
  G.heat = 130;
  const cop = spawnCop(G);
  if (cop) { cop.x = G.player.x - 210; cop.y = G.player.y + 60; cop.angle = 0.4; }
  say(G, 'Pak Rudi', 'Dermaga gelap begini… hati-hati, Nilo. Kotaknya jangan sampai jatuh.', 30);
  return { steps: 22, input: stubInput(false), shootAtEnd: true };
}
