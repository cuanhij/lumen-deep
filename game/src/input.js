// Keyboard and mouse, read by the game loop. Movement is arrows or WASD; holding the
// mouse button steers the sub toward the cursor. Confirm is Enter or Space, pause is
// P or Escape, mute is M, and 1/2/3 pick an upgrade card. Edge-triggered actions are
// consumed when read, so one press never fires twice.

export const ACTION_CONFIRM = 'confirm';
export const ACTION_PAUSE = 'pause';
export const ACTION_MUTE = 'mute';

const MOVE_KEYS = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  let click = null;
  const mouse = { x: 0, y: 0, held: false };

  function onKeyDown(event) {
    if (MOVE_KEYS[event.code] || event.code === 'Space' || event.code.startsWith('Arrow')) {
      event.preventDefault();
    }
    if (event.repeat) return;
    held.add(event.code);
    pressed.add(event.code);
  }
  function onKeyUp(event) {
    held.delete(event.code);
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    mouse.held = true;
    click = { x: mouse.x, y: mouse.y };
  }
  function onMouseUp() {
    mouse.held = false;
  }
  function onBlur() {
    held.clear();
    mouse.held = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  /** The movement vector from the keys, normalised to length 1 at most. */
  function axis() {
    let x = 0;
    let y = 0;
    if (held.has('ArrowLeft') || held.has('KeyA')) x -= 1;
    if (held.has('ArrowRight') || held.has('KeyD')) x += 1;
    if (held.has('ArrowUp') || held.has('KeyW')) y -= 1;
    if (held.has('ArrowDown') || held.has('KeyS')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.hypot(x, y);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  /** True once per press of Enter, Space or NumpadEnter. */
  function confirmPressed() {
    if (pressed.has('Enter') || pressed.has('Space') || pressed.has('NumpadEnter')) {
      pressed.delete('Enter');
      pressed.delete('Space');
      pressed.delete('NumpadEnter');
      return true;
    }
    return false;
  }

  /** True once per press of P or Escape. */
  function pausePressed() {
    if (pressed.has('KeyP') || pressed.has('Escape')) {
      pressed.delete('KeyP');
      pressed.delete('Escape');
      return true;
    }
    return false;
  }

  /** True once per press of M. */
  function mutePressed() {
    if (pressed.has('KeyM')) {
      pressed.delete('KeyM');
      return true;
    }
    return false;
  }

  /** The upgrade digit pressed this frame (1, 2 or 3), or 0. */
  function digitPressed() {
    for (const n of [1, 2, 3]) {
      if (pressed.has(`Digit${n}`) || pressed.has(`Numpad${n}`)) {
        pressed.delete(`Digit${n}`);
        pressed.delete(`Numpad${n}`);
        return n;
      }
    }
    return 0;
  }

  /** The most recent click in canvas CSS pixels, or null; consumed when read. */
  function takeClick() {
    const c = click;
    click = null;
    return c;
  }

  /** True if any key is held right now. */
  function anyKey() {
    return held.size > 0;
  }

  return { axis, confirmPressed, pausePressed, mutePressed, digitPressed, takeClick, anyKey, mouse };
}
