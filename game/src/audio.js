// All sound is synthesised with WebAudio — no audio files, no network.
// One-shots (gunshot, pickup, crash, jingles) plus two looping voices:
// the engine hum while driving and the two-tone siren while police chase.
// Created lazily on the first user gesture; safe to call before that.

export function createAudio() {
  const A = {
    ctx: null, master: null, engineOsc: null, engineGain: null,
    sirenOsc: null, sirenGain: null, sirenFlip: 0, beatTimer: 0, beat: 0,
  };

  A.unlock = function unlock() {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      A.ctx = new Ctx();
      A.master = A.ctx.createGain();
      A.master.gain.value = 0.5;
      A.master.connect(A.ctx.destination);
    } catch { A.ctx = null; }
  };

  function tone(freq, dur, type, vol, slideTo) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    const osc = A.ctx.createOscillator();
    const g = A.ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(A.master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise(dur, vol, freq) {
    if (!A.ctx) return;
    const t = A.ctx.currentTime;
    const len = Math.max(1, Math.floor(A.ctx.sampleRate * dur));
    const buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A.ctx.createBufferSource(); src.buffer = buf;
    const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
    const g = A.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(A.master);
    src.start(t);
  }

  A.shot = () => { noise(0.12, 0.5, 2600); tone(160, 0.1, 'square', 0.25, 60); };
  A.crash = () => { noise(0.25, 0.55, 500); tone(90, 0.2, 'sawtooth', 0.2, 45); };
  A.pickup = () => { tone(880, 0.09, 'sine', 0.3); setTimeout(() => tone(1320, 0.12, 'sine', 0.3), 60); };
  A.cash = () => { tone(1180, 0.07, 'triangle', 0.3); setTimeout(() => tone(1560, 0.1, 'triangle', 0.3), 55); };
  A.missionOk = () => { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.32), i * 90)); };
  A.missionFail = () => { tone(300, 0.25, 'sawtooth', 0.25, 140); };
  A.bustedJingle = () => { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'square', 0.25), i * 130)); };
  A.enterCar = () => { tone(220, 0.08, 'sine', 0.25, 330); };
  A.horn = () => { tone(370, 0.18, 'square', 0.18); };

  // Looping voices, driven once per frame from the game loop.
  A.step = function step(dt, G) {
    if (!A.ctx) return;
    const driving = G.mode === 'play' && G.player.car;
    // Engine: a low saw whose pitch follows speed.
    if (driving) {
      if (!A.engineOsc) {
        A.engineOsc = A.ctx.createOscillator(); A.engineOsc.type = 'sawtooth';
        A.engineGain = A.ctx.createGain(); A.engineGain.gain.value = 0.0;
        const f = A.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
        A.engineOsc.connect(f); f.connect(A.engineGain); A.engineGain.connect(A.master);
        A.engineOsc.start();
      }
      const sp = Math.abs(G.player.car.speed);
      A.engineOsc.frequency.value = 55 + sp * 0.35;
      A.engineGain.gain.value = 0.05 + Math.min(0.05, sp / 430 * 0.05);
    } else if (A.engineOsc) {
      try { A.engineOsc.stop(); } catch { /* already stopped */ }
      A.engineOsc = null; A.engineGain = null;
    }
    // Siren: two alternating tones while any cop is close and hunting.
    const sirenOn = G.mode === 'play' && G.wanted > 0 && G.cops.length > 0;
    if (sirenOn) {
      if (!A.sirenOsc) {
        A.sirenOsc = A.ctx.createOscillator(); A.sirenOsc.type = 'triangle';
        A.sirenGain = A.ctx.createGain(); A.sirenGain.gain.value = 0.045;
        A.sirenOsc.connect(A.sirenGain); A.sirenGain.connect(A.master);
        A.sirenOsc.start();
      }
      A.sirenFlip += dt;
      if (A.sirenFlip > 0.42) { A.sirenFlip = 0; A.sirenOsc.frequency.value = A.sirenOsc.frequency.value > 800 ? 660 : 950; }
    } else if (A.sirenOsc) {
      try { A.sirenOsc.stop(); } catch { /* already stopped */ }
      A.sirenOsc = null; A.sirenGain = null;
    }
    // Music: a relaxed four-note bass loop while playing.
    if (G.mode === 'play') {
      A.beatTimer += dt;
      const notes = [110, 110, 131, 98, 110, 110, 165, 147];
      if (A.beatTimer > 0.24) {
        A.beatTimer = 0;
        tone(notes[A.beat % notes.length], 0.2, 'triangle', 0.10);
        A.beat++;
      }
    }
  };

  return A;
}
