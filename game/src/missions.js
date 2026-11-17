// The story of Marisol Nights: six chained missions for Nilo, a bicycle
// courier who keeps getting borrowed by everyone in the bay. Each mission
// is a list of stages (go somewhere, steal a car, chase a rival, lose the
// police, beat the clock); finishing pays cash and opens the next one.

import { createCar, stepCarPhysics } from './vehicles.js';
import { storeSave } from './save.js';

export function say(G, who, text, dur) {
  G.dialog = { who, text, t: 0, dur: dur || Math.max(2.6, text.length / 16) };
}

export function setupMissions(G) {
  const L = G.city.landmarks;
  const dock = L.harborDock, shop = L.workshop, park = L.hideout, market = L.marketStall;
  G.missionList = [
    {
      title: 'Paket Pertama', giver: 'Sinta',
      intro: 'Sinta: Bengkelku butuh suku cadang. Ambil paketnya di Pasar Lama, jangan lama-lama ya, Nilo.',
      outro: 'Sinta: Nah, cepat juga kau. Ini upahnya.',
      pay: 60,
      stages: [
        { kind: 'goto', x: market.x, y: market.y, r: 52, text: 'Ambil paket di Pasar Lama' },
        { kind: 'goto', x: shop.x, y: shop.y, r: 52, text: 'Antar paket ke bengkel Sinta' },
      ],
    },
    {
      title: 'Antar ke Pelabuhan', giver: 'Pak Rudi',
      intro: 'Pak Rudi: Kotak ini harus sampai dermaga sebelum kapalnya berangkat. Lewat jalan besar saja!',
      outro: 'Pak Rudi: Pas waktunya! Kaptennya pasti senang.',
      pay: 90,
      stages: [
        { kind: 'goto', x: shop.x, y: shop.y, r: 52, text: 'Ambil kotak di bengkel Sinta' },
        { kind: 'goto', x: dock.x, y: dock.y, r: 58, text: 'Antar ke Dermaga Timur — cepat!', time: 75 },
      ],
    },
    {
      title: 'Mobil Pinjaman', giver: 'Sinta',
      intro: 'Sinta: Mobil emas dekat pasar itu milik pelanggan yang tak mau bayar. Bawa ke garasiku, pelan-pelan saja.',
      outro: 'Sinta: Hah! Biar dia belajar jangan macam-macam sama bengkelku.',
      pay: 120,
      stages: [
        { kind: 'steal', text: 'Curi mobil emas di dekat Pasar Lama' },
        { kind: 'goto', x: L.garage.x, y: L.garage.y, r: 58, text: 'Parkir mobil emas di garasi' },
      ],
    },
    {
      title: 'Kurir Saingan', giver: 'Bu Tini',
      intro: 'Bu Tini: Kurir seberang itu mencuri rute pelanggan kita! Kejar dia, pepet terus sampai dia menyerah.',
      outro: 'Bu Tini: Kapok dia. Rute pasar aman lagi, terima kasih Nilo.',
      pay: 150,
      stages: [
        { kind: 'chase', need: 4, text: 'Pepet kurir saingan sampai menyerah' },
      ],
    },
    {
      title: 'Kabur ke Taman', giver: 'Sinta',
      intro: 'Sinta: Polisi mengincarmu gara-gara mobil emas itu. Sembunyi di Taman Melati sampai keadaan aman!',
      outro: 'Sinta: Aman. Sekarang mereka mengira mobilnya hilang di pelabuhan. Kerja bagus.',
      pay: 180,
      stages: [
        { kind: 'goto', x: park.x, y: park.y, r: 64, text: 'Lari ke Taman Melati', alarm: true },
        { kind: 'lose', text: 'Bersembunyi sampai bintang wanted padam' },
      ],
    },
    {
      title: 'Tiga Singgah Terakhir', giver: 'Pak Rudi',
      intro: 'Pak Rudi: Satu malam, tiga kiriman: pasar, dermaga, lalu bengkel. Selesaikan sebelum fajar, Nilo!',
      outro: 'Pak Rudi: Tiga-tiganya sampai! Kau kurir terbaik di Marisol, Nilo.',
      pay: 260,
      stages: [
        { kind: 'goto', x: market.x, y: market.y, r: 52, text: 'Singgah 1: Pasar Lama', time: 170 },
        { kind: 'goto', x: dock.x, y: dock.y, r: 58, text: 'Singgah 2: Dermaga Timur', time: 170 },
        { kind: 'goto', x: shop.x, y: shop.y, r: 52, text: 'Singgah 3: Bengkel Sinta', time: 170 },
      ],
    },
  ];
  G.missionIndex = 0;
  G.stageIndex = 0;
  G.stageTime = 0;
  G.chaseGot = 0;
  G.missionIntroShown = false;
  G.targetCar = null;
}

export function currentMission(G) {
  if (G.storyDone || G.missionIndex >= G.missionList.length) return null;
  return G.missionList[G.missionIndex];
}

export function currentStage(G) {
  const m = currentMission(G);
  return m ? m.stages[G.stageIndex] : null;
}

export function currentObjective(G) {
  const m = currentMission(G);
  const s = currentStage(G);
  if (!m || !s) return null;
  const obj = { title: m.title, text: s.text, x: s.x, y: s.y, hasPoint: typeof s.x === 'number' };
  if (s.kind === 'chase' && G.targetCar) { obj.x = G.targetCar.x; obj.y = G.targetCar.y; obj.hasPoint = true; }
  if (s.kind === 'steal' && G.targetCar) { obj.x = G.targetCar.x; obj.y = G.targetCar.y; obj.hasPoint = true; }
  if (s.kind === 'lose') obj.hasPoint = false;
  if (typeof s.time === 'number') obj.timeLeft = Math.max(0, s.time - G.stageTime);
  if (s.kind === 'chase') obj.progress = Math.min(1, G.chaseGot / s.need);
  return obj;
}

// Called when a mission becomes active (start of game or after a finish).
export function armMission(G) {
  const m = currentMission(G);
  G.stageIndex = 0;
  G.stageTime = 0;
  G.chaseGot = 0;
  G.missionIntroShown = false;
  G.targetCar = null;
  if (!m) return;
  const s = m.stages[0];
  if (s.kind === 'steal') spawnTargetCar(G, 'steal');
  if (s.kind === 'chase') spawnTargetCar(G, 'chase');
}

function spawnTargetCar(G, mode) {
  const L = G.city.landmarks;
  if (mode === 'steal') {
    const car = createCar(L.marketStall.x + 90, L.marketStall.y - 70, 0, '#e9b44c', 'target');
    car.driver = false;
    G.cars.push(car);
    G.targetCar = car;
  } else {
    const road = G.city.hRoads[2];
    const car = createCar(G.city.vRoads[3].cx, road.cy + 18, 0, '#7d5ba6', 'target');
    car.dir = 0;
    car.driver = true;
    car.cruise = 235;
    G.cars.push(car);
    G.targetCar = car;
  }
}

export function notifyEnterCar(G, car) {
  const s = currentStage(G);
  if (s && s.kind === 'steal' && car === G.targetCar) {
    advanceStage(G);
  }
}

function advanceStage(G) {
  const m = currentMission(G);
  G.stageIndex++;
  G.stageTime = 0;
  G.chaseGot = 0;
  if (G.stageIndex >= m.stages.length) {
    completeMission(G);
    return;
  }
  const s = currentStage(G);
  if (s.kind === 'chase') spawnTargetCar(G, 'chase');
  if (s.kind === 'steal') spawnTargetCar(G, 'steal');
  if (s.alarm) G.heat = Math.max(G.heat, 300);
  G.events.push('pickup');
}

function completeMission(G) {
  const m = currentMission(G);
  G.money += m.pay;
  G.events.push('missionOk');
  say(G, m.giver, m.outro, 3.4);
  G.missionIndex++;
  if (G.missionIndex >= G.missionList.length) {
    G.storyDone = true;
    say(G, 'Marisol', 'Cerita selesai! Nilo bebas berkeliling — kumpulkan paket tersembunyi dan coba rampok warung kalau berani.', 5);
  } else {
    armMission(G);
  }
  storeSave(G);
}

function failMission(G) {
  const m = currentMission(G);
  G.events.push('fail');
  say(G, m.giver, 'Waktunya habis! Tidak apa, kita coba lagi dari awal misi ini.', 3.2);
  // Reset the mission's special car, then re-arm the same mission.
  if (G.targetCar) {
    G.cars = G.cars.filter((c) => c !== G.targetCar);
    G.targetCar = null;
  }
  armMission(G);
}

export function stepMissions(G, dt) {
  const m = currentMission(G);
  if (!m) return;
  if (!G.missionIntroShown) {
    G.missionIntroShown = true;
    say(G, m.giver, m.intro, Math.max(3.4, m.intro.length / 17));
  }
  const s = currentStage(G);
  if (!s) return;
  G.stageTime += dt;
  if (typeof s.time === 'number' && G.stageTime > s.time) { failMission(G); return; }

  if (s.kind === 'goto') {
    if (Math.hypot(G.player.x - s.x, G.player.y - s.y) < s.r) advanceStage(G);
  } else if (s.kind === 'lose') {
    if (G.wanted === 0 && G.heat <= 0) advanceStage(G);
  } else if (s.kind === 'chase' && G.targetCar) {
    const car = G.targetCar;
    if (car.dead) { advanceStage(G); return; }
    if (G.player.car === car) { advanceStage(G); return; }
    // The rival flees along the roads, turning at intersections.
    const dx = car.x - G.player.x, dy = car.y - G.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 58) {
      G.chaseGot += dt;
      if (G.chaseGot >= s.need) {
        car.kind = 'parked'; car.driver = false; car.speed = 0;
        say(G, 'Kurir Saingan', 'Cukup! Aku menyerah, rute pasar milik kalian!', 3);
        advanceStage(G);
        return;
      }
    }
    // Flee: aim away from the player, snapped to the road grid.
    let fleeAngle = Math.atan2(dy, dx);
    if (G.city && dist < 420) {
      const step = stepCarPhysics(G, car, 0.9, steerToward(car, fleeAngle), dt, false);
      if (step > 200) G.events.push('crash');
    }
  }
}

function steerToward(car, wantAngle) {
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-1, Math.min(1, diff * 2.2));
}
