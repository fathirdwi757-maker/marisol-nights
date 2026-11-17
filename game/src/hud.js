// Heads-up display and full-screen states, all on the canvas: money and
// health, wanted stars, the mission banner with its timer, dialogue,
// prompts, the busted meter, the minimap — and the title / pause /
// busted / wasted screens that frame the game.

import { VIEW_W, VIEW_H } from './config.js';
import { drawMinimap } from './minimap.js';
import { currentObjective } from './missions.js';

function panel(ctx, x, y, w, h, alpha) {
  ctx.fillStyle = `rgba(10,14,20,${alpha || 0.55})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 10);
  ctx.fill();
}

export function drawHud(ctx, G) {
  G.objectiveCache = currentObjective(G);
  const obj = G.objectiveCache;

  // Minimap, top-right, with wanted stars under it.
  drawMinimap(ctx, G, VIEW_W - 224, 14, 210, 160);
  drawStars(ctx, G, VIEW_W - 224, 182);

  // Money + health, top-left.
  panel(ctx, 14, 14, 208, 62);
  ctx.fillStyle = '#ffd76a';
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`$${G.money}`, 26, 42);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 11px system-ui, sans-serif';
  ctx.fillText(`PAKET ${G.packagesFound}/10`, 130, 42);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(26, 52, 180, 10);
  ctx.fillStyle = G.player.hp > 30 ? '#57c256' : '#e74c3c';
  ctx.fillRect(26, 52, 180 * Math.max(0, G.player.hp) / 100, 10);

  // Mission banner, top-centre.
  if (obj) {
    const w = 470;
    panel(ctx, VIEW_W / 2 - w / 2, 14, w, obj.timeLeft !== undefined || obj.progress !== undefined ? 66 : 52, 0.62);
    ctx.fillStyle = '#ffd76a';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`MISI: ${obj.title.toUpperCase()}`, VIEW_W / 2, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillText(obj.text, VIEW_W / 2, 56);
    if (obj.timeLeft !== undefined) {
      ctx.fillStyle = obj.timeLeft < 15 ? '#ff6b5e' : '#9adcff';
      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillText(`Sisa waktu ${Math.ceil(obj.timeLeft)} dtk`, VIEW_W / 2, 76);
    } else if (obj.progress !== undefined) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.fillRect(VIEW_W / 2 - 90, 64, 180, 7);
      ctx.fillStyle = '#ffd76a';
      ctx.fillRect(VIEW_W / 2 - 90, 64, 180 * obj.progress, 7);
    }
  } else if (G.storyDone) {
    panel(ctx, VIEW_W / 2 - 190, 14, 380, 40, 0.5);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CERITA SELESAI — jelajahi Marisol Bay sesukamu', VIEW_W / 2, 39);
  }

  // Busted meter, centre.
  if (G.busted > 0.02 && G.mode === 'play') {
    panel(ctx, VIEW_W / 2 - 130, 120, 260, 44, 0.7);
    ctx.fillStyle = '#ff6b5e';
    ctx.font = '700 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('POLISI MENANGKAPMU…', VIEW_W / 2, 140);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(VIEW_W / 2 - 110, 148, 220, 8);
    ctx.fillStyle = '#ff6b5e';
    ctx.fillRect(VIEW_W / 2 - 110, 148, 220 * G.busted, 8);
  }

  // Dialogue box, bottom-centre.
  if (G.dialog) {
    const w = 640;
    panel(ctx, VIEW_W / 2 - w / 2, VIEW_H - 118, w, 62, 0.78);
    ctx.fillStyle = '#ffd76a';
    ctx.font = '700 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(G.dialog.who, VIEW_W / 2 - w / 2 + 18, VIEW_H - 92);
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px system-ui, sans-serif';
    wrapText(ctx, G.dialog.text, VIEW_W / 2 - w / 2 + 18, VIEW_H - 70, w - 36, 19);
  }

  // Prompt + district + speed, bottom corners.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  if (G.prompt) ctx.fillText(G.prompt, 16, VIEW_H - 16);
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  if (G.district) ctx.fillText(G.district, VIEW_W - 16, VIEW_H - 16);
  if (G.player.car) {
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 20px system-ui, sans-serif';
    ctx.fillText(`${Math.round(Math.abs(G.player.car.speed) * 0.36)} km/j`, VIEW_W - 16, VIEW_H - 42);
  }
}

function drawStars(ctx, G, x, y) {
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i++) {
    const active = i < G.wanted;
    const flash = G.seenByCop && Math.floor(G.time * 4) % 2 === 0;
    ctx.fillStyle = active ? (flash ? '#ff5252' : '#ffd700') : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', x + i * 30, y + 22);
  }
  if (G.wanted > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(G.seenByCop ? 'TERLIHAT POLISI!' : 'Bersembunyi…', VIEW_W - 14, y + 44);
    ctx.textAlign = 'left';
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '', cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word; cy += lh;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, cy);
}

export function drawScreen(ctx, G) {
  if (G.mode === 'play') return;
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (G.mode === 'title') {
    ctx.fillStyle = '#ffd76a';
    ctx.font = '800 74px system-ui, sans-serif';
    ctx.fillText('MARISOL NIGHTS', VIEW_W / 2, 218);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 19px system-ui, sans-serif';
    ctx.fillText('Kisah Nilo, kurir sepeda kota Marisol Bay — yang terus "dipinjam" semua orang.', VIEW_W / 2, 262);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    const lines = [
      'Antar paket, curi mobil pinjaman, pepet kurir saingan, dan kabur dari polisi —',
      'enam misi berantai di kota teluk yang hidup: traffic, pejalan kaki, dan bintang wanted.',
      '',
      'WASD / panah — jalan & menyetir    •    E — masuk/keluar mobil    •    Klik mouse — tembak (arah = kursor)',
      'F (tahan) — rampok warung    •    Shift — lari    •    Spasi — rem tangan    •    P — jeda',
      '',
      'Progres tersimpan otomatis di peramban ini.',
    ];
    lines.forEach((ln, i) => ctx.fillText(ln, VIEW_W / 2, 320 + i * 27));
    ctx.fillStyle = '#ffd76a';
    ctx.font = '700 22px system-ui, sans-serif';
    ctx.fillText('Tekan ENTER untuk mulai', VIEW_W / 2, 580);
  } else if (G.mode === 'pause') {
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 52px system-ui, sans-serif';
    ctx.fillText('JEDA', VIEW_W / 2, 330);
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText('Tekan P atau ENTER untuk lanjut', VIEW_W / 2, 380);
  } else if (G.mode === 'busted') {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = '800 64px system-ui, sans-serif';
    ctx.fillText('TERTANGKAP!', VIEW_W / 2, 320);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText('Polisi Marisol membawamu pergi. Denda $50 — tekan ENTER, Sinta akan menjemputmu di bengkel.', VIEW_W / 2, 372);
  } else if (G.mode === 'wasted') {
    ctx.fillStyle = '#ff6b5e';
    ctx.font = '800 64px system-ui, sans-serif';
    ctx.fillText('PINGSAN!', VIEW_W / 2, 320);
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillText('Kau sadar di bengkel Sinta. Biaya perawatan $80 — tekan ENTER untuk lanjut.', VIEW_W / 2, 372);
  }
}
