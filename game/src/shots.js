// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (chase the nearest pearl, or an air bubble when oxygen runs low, and
// keep clear of mines and creatures), so the frame is what a short game really
// looks like and the same seed always gives the same frame. The end scene's pilot
// is greedy — pearls only, no dodging — so it is caught out and the game ends.

import { STEP } from './config.js';
import { EVENT_OVER, EVENT_WAVE_CLEAR } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 14;
const END_LIMIT_SECONDS = 150;

/** The autopilot's move vector: toward the target, pushed away from hazards. */
function autopilot(state, avoid) {
  let target = null;
  if (state.oxygen < 45) {
    let best = Infinity;
    for (const b of state.bubbles) {
      const d = Math.hypot(b.x - state.sub.x, b.y - state.sub.y);
      if (d < best) {
        best = d;
        target = b;
      }
    }
  }
  if (!target) {
    let best = Infinity;
    for (const p of state.pearls) {
      const d = Math.hypot(p.x - state.sub.x, p.y - state.sub.y);
      if (d < best) {
        best = d;
        target = p;
      }
    }
  }
  if (!target) return { x: 0, y: 0 };
  let mx = target.x - state.sub.x;
  let my = target.y - state.sub.y;
  const md = Math.hypot(mx, my) || 1;
  mx /= md;
  my /= md;
  if (avoid) {
    const hazards = [...state.mines, ...state.anglers, ...state.jellies];
    for (const h of hazards) {
      const dx = state.sub.x - h.x;
      const dy = state.sub.y - h.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < 170) {
        const w = ((170 - d) / 170) * 2.0;
        mx += (dx / d) * w;
        my += (dy / d) * w;
      }
    }
    const len = Math.hypot(mx, my) || 1;
    mx /= len;
    my /= len;
  }
  return { x: mx, y: my };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 });
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const limit = name === 'end' ? END_LIMIT_SECONDS : PLAY_SECONDS;
  const avoid = name !== 'end';
  for (let i = 0; i < limit / STEP; i += 1) {
    const events = world.step(STEP, autopilot(state, avoid));
    if (events & EVENT_WAVE_CLEAR) world.chooseUpgrade(0);
    if (events & EVENT_OVER) break;
  }
  if (name === 'end' && !state.over) {
    state.lives = 0;
    state.over = true;
    state.oxygen = 0;
  }
  const over = state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
}
