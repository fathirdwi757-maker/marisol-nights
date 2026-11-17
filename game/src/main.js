// Boot and the game loop for Marisol Nights: fixed-step simulation,
// mouse aim translated into world space, synth audio fed by world events,
// and the ?shot= staging mode the screenshot captures use.

import { VIEW_W, VIEW_H, STEP } from './config.js';
import { createInput } from './input.js';
import { createWorld, applySave, stepWorld } from './world.js';
import { drawWorld } from './render.js';
import { drawHud, drawScreen } from './hud.js';
import { currentObjective } from './missions.js';
import { createAudio } from './audio.js';
import { loadSave, clearSave } from './save.js';
import { stageShot } from './shots.js';
import { tryShoot } from './combat.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');

let G = createWorld(shotName ? Number(params.get('seed') || 1) : 7);
if (!shotName) {
  const saved = loadSave();
  if (saved) applySave(G, saved);
}
window.__game = G;

window.addEventListener('keydown', () => audio.unlock(), { once: false });
canvas.addEventListener('mousedown', () => audio.unlock());

function frame() {
  G.objectiveCache = currentObjective(G);
  drawWorld(ctx, G);
  if (G.mode !== 'title') drawHud(ctx, G);
  drawScreen(ctx, G);
}

function playEvents() {
  for (const ev of G.events) {
    if (ev === 'shot') audio.shot();
    else if (ev === 'crash') audio.crash();
    else if (ev === 'pickup') audio.pickup();
    else if (ev === 'cash') audio.cash();
    else if (ev === 'missionOk') audio.missionOk();
    else if (ev === 'fail') audio.missionFail();
    else if (ev === 'busted') audio.bustedJingle();
    else if (ev === 'enter') audio.enterCar();
  }
  G.events.length = 0;
}

if (shotName) {
  // Staged screenshot: arrange the scene, run it briefly, draw, signal.
  const staged = stageShot(G, shotName);
  for (let i = 0; i < staged.steps; i++) {
    G.mouseWorld.x = G.player.x + 260;
    G.mouseWorld.y = G.player.y;
    stepWorld(G, staged.input, STEP);
    G.events.length = 0;
  }
  if (staged.shootAtEnd) tryShoot(G);
  G.dialog && (G.dialog.t = 0.4);
  frame();
  frame();
  window.__shotReady = true;
} else {
  let last = performance.now();
  let acc = 0;
  let statusT = 0;
  function loop(now) {
    requestAnimationFrame(loop);
    let elapsed = (now - last) / 1000;
    last = now;
    if (elapsed > 0.25) elapsed = 0.25;
    acc += elapsed;
    while (acc >= STEP) {
      G.mouseWorld.x = G.camera.x + input.mouse.x;
      G.mouseWorld.y = G.camera.y + input.mouse.y;
      if (G.mode === 'title' && input.wasPressed('newgame')) {
        clearSave();
        G = createWorld(7);
        window.__game = G;
      }
      stepWorld(G, input, STEP);
      input.endFrame();
      acc -= STEP;
    }
    playEvents();
    audio.step(elapsed, G);
    frame();
    statusT += elapsed;
    if (statusT > 1) {
      statusT = 0;
      const obj = currentObjective(G);
      status.textContent = obj ? `Misi ${obj.title}: ${obj.text}` : `Mode ${G.mode}`;
    }
  }
  requestAnimationFrame(loop);
}
