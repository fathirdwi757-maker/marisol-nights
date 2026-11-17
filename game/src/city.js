// City generation for Marisol Bay: a 4x3 grid of named blocks in six
// districts, solid buildings, trees, lamps, shops and story landmarks.
// Pure data + geometry helpers; nothing here draws or touches the DOM.

import {
  ROAD_W, BLOCK_W, BLOCK_H, COLS, ROWS, WORLD_W, WORLD_H,
  DISTRICT_INFO, BLOCK_KINDS, BUILDING_NAMES,
} from './config.js';
import { randRange, randInt, pick, chance } from './random.js';

const ROOF_SHADES = {
  heights: ['#c96f4a', '#b8573f', '#d98a5f', '#a34d68'],
  downtown: ['#8fa3b8', '#7488a0', '#a7b8c9', '#5f748c', '#c2cedb'],
  market: ['#c0392b', '#d35400', '#b9770e', '#7d6608'],
  harbor: ['#6e7f8d', '#5a6b76', '#8795a1', '#4f6152'],
  beach: ['#e08e45', '#d96f32', '#c95d63'],
  park: [],
};

export function blockOrigin(col, row) {
  return { x: ROAD_W + col * (BLOCK_W + ROAD_W), y: ROAD_W + row * (BLOCK_H + ROAD_W) };
}

export function buildCity(rng) {
  const city = {
    buildings: [],
    trees: [],
    lamps: [],
    blocks: [],
    shops: [],
    landmarks: {},
    vRoads: [],
    hRoads: [],
  };

  for (let i = 0; i <= COLS; i++) {
    const x0 = i * (BLOCK_W + ROAD_W);
    city.vRoads.push({ x0, x1: x0 + ROAD_W, cx: x0 + ROAD_W / 2 });
  }
  for (let j = 0; j <= ROWS; j++) {
    const y0 = j * (BLOCK_H + ROAD_W);
    city.hRoads.push({ y0, y1: y0 + ROAD_W, cy: y0 + ROAD_W / 2 });
  }

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const kind = BLOCK_KINDS[row * COLS + col];
      const { x, y } = blockOrigin(col, row);
      const block = { col, row, kind, x, y, w: BLOCK_W, h: BLOCK_H, label: DISTRICT_INFO[kind].label };
      city.blocks.push(block);
      scatterBlock(city, block, rng);
    }
  }

  // Lamps along every road, alternating sides.
  for (const r of city.vRoads) {
    for (let y = 60; y < WORLD_H; y += 170) city.lamps.push({ x: r.x0 + 8, y });
    for (let y = 140; y < WORLD_H; y += 170) city.lamps.push({ x: r.x1 - 8, y });
  }
  for (const r of city.hRoads) {
    for (let x = 100; x < WORLD_W; x += 190) city.lamps.push({ x, y: r.y0 + 8 });
  }

  // Story landmarks sit on sidewalks at block corners, reachable on foot.
  const at = (col, row, dx, dy) => {
    const { x, y } = blockOrigin(col, row);
    return { x: x + dx, y: y + dy };
  };
  city.landmarks = {
    start: { x: city.vRoads[1].cx, y: city.hRoads[1].cy },
    workshop: at(2, 1, 30, BLOCK_H / 2), // Sinta's workshop, west edge of a downtown block
    garage: at(1, 1, BLOCK_W - 30, BLOCK_H / 2),
    harborDock: at(3, 2, BLOCK_W / 2, BLOCK_H - 26),
    hideout: at(1, 0, BLOCK_W / 2, BLOCK_H / 2), // middle of Taman Melati park
    marketStall: at(0, 1, BLOCK_W / 2, 40),
  };

  // Robbable shops on market + downtown corners.
  city.shops = [
    { ...at(0, 1, 60, 60), name: 'Warung Bu Tini' },
    { ...at(0, 1, BLOCK_W - 60, BLOCK_H - 60), name: 'Toko Berkah' },
    { ...at(3, 1, 60, BLOCK_H - 60), name: 'Kios Pelabuhan' },
  ];

  return city;
}

function scatterBlock(city, block, rng) {
  const { x, y, kind } = block;
  if (kind === 'park') {
    for (let i = 0; i < 26; i++) {
      city.trees.push({ x: x + randRange(rng, 30, BLOCK_W - 30), y: y + randRange(rng, 30, BLOCK_H - 30), r: randRange(rng, 13, 22) });
    }
    return;
  }
  if (kind === 'beach') {
    // A few huts near the north edge, palms scattered on open sand.
    for (let i = 0; i < 2; i++) {
      const bx = x + 40 + i * 190, by = y + 34;
      city.buildings.push({ x: bx, y: by, w: 120, h: 74, color: pick(rng, ROOF_SHADES.beach), name: pick(rng, BUILDING_NAMES.beach), kind });
    }
    for (let i = 0; i < 12; i++) {
      city.trees.push({ x: x + randRange(rng, 26, BLOCK_W - 26), y: y + randRange(rng, 130, BLOCK_H - 26), r: randRange(rng, 11, 17), palm: true });
    }
    return;
  }

  // Built-up blocks: a 2x2 plot grid with margins; a plot or two may stay
  // empty as a parking court or a small green.
  const margin = 42, gap = 30;
  const pw = (BLOCK_W - margin * 2 - gap) / 2;
  const ph = (BLOCK_H - margin * 2 - gap) / 2;
  const names = [...BUILDING_NAMES[kind]];
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      if (chance(rng, 0.14)) {
        // Empty plot: a couple of trees instead of a building.
        city.trees.push({ x: x + margin + i * (pw + gap) + pw / 2, y: y + margin + j * (ph + gap) + ph / 2, r: 16 });
        continue;
      }
      const inset = kind === 'harbor' ? 6 : randRange(rng, 4, 18);
      const name = names.length ? names.splice(randInt(rng, 0, names.length - 1), 1)[0] : DISTRICT_INFO[kind].label;
      city.buildings.push({
        x: x + margin + i * (pw + gap) + inset,
        y: y + margin + j * (ph + gap) + inset,
        w: pw - inset * 2,
        h: ph - inset * 2,
        color: pick(rng, ROOF_SHADES[kind]),
        name,
        kind,
      });
    }
  }
  // Sidewalk trees on leafy districts.
  if (kind === 'heights' || kind === 'downtown') {
    for (let i = 0; i < 5; i++) {
      city.trees.push({ x: x + randRange(rng, 18, BLOCK_W - 18), y: chance(rng, 0.5) ? y + 16 : y + BLOCK_H - 16, r: randRange(rng, 10, 15) });
    }
  }
}

export function isOnRoad(city, x, y) {
  for (const r of city.vRoads) if (x >= r.x0 && x <= r.x1) return true;
  for (const r of city.hRoads) if (y >= r.y0 && y <= r.y1) return true;
  return false;
}

export function districtLabelAt(city, x, y) {
  for (const b of city.blocks) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.label;
  }
  return 'Jalan Marisol';
}

// Push a circle out of every building it overlaps. Returns true on any hit.
export function collideCircle(city, p, radius) {
  let hit = false;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - nx, dy = p.y - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = nx + (dx / d) * radius;
        p.y = ny + (dy / d) * radius;
      } else {
        // Centre inside the rect: push out through the nearest face.
        const left = p.x - b.x, right = b.x + b.w - p.x, top = p.y - b.y, bottom = b.y + b.h - p.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) p.x = b.x - radius;
        else if (m === right) p.x = b.x + b.w + radius;
        else if (m === top) p.y = b.y - radius;
        else p.y = b.y + b.h + radius;
      }
    }
  }
  p.x = Math.max(radius, Math.min(WORLD_W - radius, p.x));
  p.y = Math.max(radius, Math.min(WORLD_H - radius, p.y));
  return hit;
}

export function circleHitsBuilding(city, x, y, radius) {
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(x, b.x + b.w));
    const ny = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - nx, dy = y - ny;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}
