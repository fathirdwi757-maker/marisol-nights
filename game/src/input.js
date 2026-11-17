// Keyboard + mouse input for an open-world game: held movement keys, the
// mouse aim point in screen space, and one-shot actions (interact, pause,
// confirm) queued so a press between frames is never lost.

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  const mouse = { x: 640, y: 360, down: false };

  const KEYMAP = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyE: 'interact', KeyF: 'action',
    Space: 'brake', ShiftLeft: 'run', ShiftRight: 'run',
    KeyP: 'pause', Escape: 'pause', Enter: 'confirm', KeyN: 'newgame', KeyM: 'mute',
  };

  window.addEventListener('keydown', (e) => {
    const name = KEYMAP[e.code];
    if (name) {
      if (!held.has(name)) pressed.add(name);
      held.add(name);
      if (name === 'up' || name === 'down' || name === 'left' || name === 'right' || name === 'brake') e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => {
    const name = KEYMAP[e.code];
    if (name) held.delete(name);
  });
  window.addEventListener('blur', () => { held.clear(); mouse.down = false; });

  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - r.left) / r.width * canvas.width;
    mouse.y = (e.clientY - r.top) / r.height * canvas.height;
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) { mouse.down = true; pressed.add('confirm'); } });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    mouse,
    isHeld: (name) => held.has(name),
    wasPressed: (name) => pressed.has(name),
    axisX: () => (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
    axisY: () => (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0),
    endFrame: () => pressed.clear(),
  };
}
