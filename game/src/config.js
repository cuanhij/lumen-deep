// Every tuning number, colour and upgrade in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size. Depth is measured in metres and grows as pearls are
// collected and waves are cleared; the water gets darker the deeper you go.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The submersible: a small, slightly floaty craft with strong thrusters. */
export const SUB = {
  radius: 22,
  speed: 275,
  accel: 1500,
  drag: 2.4,
  /** Seconds of blinking safety after a hit or an oxygen blackout. */
  invuln: 2.0,
  /** How far the headlamp reaches, in pixels. */
  lamp: 300,
};

export const OXYGEN = {
  max: 100,
  /** Units drained per second at wave 1; it grows a little every wave. */
  drain: 1.7,
  drainPerWave: 0.15,
  /** Oxygen an air bubble restores. */
  bubbleRefill: 32,
  /** Below this the HUD flashes and the alarm beeps. */
  lowAt: 25,
};

export const LIVES = 3;

export const PEARL = {
  radius: 12,
  points: 100,
  /** Pearls to collect to clear wave 1, plus one more each wave. */
  quotaBase: 5,
  quotaPerWave: 1,
  /** Pearls kept on the field at once. */
  maxOnField: 6,
  spawnInterval: 1.1,
  /** How fast a pearl drifts, in pixels per second. */
  drift: 14,
};

export const MINE = {
  radius: 20,
  baseCount: 3,
  perWave: 1,
  maxCount: 9,
  /** Slow aimless drift, in pixels per second. */
  drift: 12,
};

export const ANGLER = {
  radius: 26,
  /** Cruising speed; it swims faster when it spots the sub. */
  speed: 55,
  speedPerWave: 11,
  chaseSpeed: 100,
  chaseRadius: 230,
  baseCount: 1,
  perWave: 1,
  maxCount: 5,
};

export const JELLY = {
  radius: 24,
  speed: 26,
  speedPerWave: 5,
  baseCount: 1,
  perWave: 1,
  maxCount: 4,
};

export const BUBBLE = {
  radius: 11,
  /** Pixels per second it rises. */
  rise: 55,
  spawnInterval: 3.2,
};

export const WAVE = {
  clearBonusBase: 200,
  clearBonusPerWave: 100,
};

/** The upgrade pool offered between waves: three different ones, pick one. */
export const UPGRADES = [
  {
    id: 'thrusters',
    name: 'Turbo Thrusters',
    desc: 'Thrusters +18% faster. Outrun anything down here.',
    apply(state) { state.speedMult *= 1.18; },
  },
  {
    id: 'tank',
    name: 'Big Oxygen Tank',
    desc: 'Max oxygen +30 and a full refill right now.',
    apply(state) { state.maxOxygen += 30; state.oxygen = state.maxOxygen; },
  },
  {
    id: 'magnet',
    name: 'Pearl Magnet',
    desc: 'Pearls within 200px drift toward your sub.',
    apply(state) { state.magnetRadius = 200; },
  },
  {
    id: 'shield',
    name: 'Shield Plating',
    desc: 'Start the next wave with a shield that absorbs one hit.',
    apply(state) { state.shield = true; },
  },
  {
    id: 'hull',
    name: 'Spare Hull',
    desc: 'Patch the sub: +1 life, up to the 3-life maximum.',
    needs(state) { return state.lives < LIVES; },
    apply(state) { state.lives = Math.min(LIVES, state.lives + 1); },
  },
];

export const PALETTE = {
  backdrop: '#01060d',
  waterTop: '#0d4a6e',
  waterMid: '#07304e',
  waterDeep: '#020d1a',
  ray: 'rgba(140, 220, 255, 0.05)',
  rock: '#0a1e2e',
  rockEdge: '#12344a',
  weed: '#0e4d3a',
  sub: '#ffb703',
  subDark: '#c77f02',
  subGlass: '#8ef1ff',
  lamp: 'rgba(255, 244, 180, 0.16)',
  pearl: '#ffd166',
  pearlGlow: 'rgba(255, 209, 102, 0.55)',
  bubble: 'rgba(180, 235, 255, 0.75)',
  mine: '#e5534b',
  mineGlow: 'rgba(229, 83, 75, 0.5)',
  angler: '#2a1e4f',
  anglerBelly: '#4b3a7a',
  lure: '#7cf5d3',
  jelly: 'rgba(247, 143, 179, 0.85)',
  jellyGlow: 'rgba(247, 143, 179, 0.35)',
  panel: 'rgba(2, 16, 30, 0.78)',
  panelEdge: 'rgba(120, 200, 255, 0.35)',
  text: '#eaf6ff',
  muted: '#8fb8d8',
  gold: '#ffd166',
  danger: '#ff6b5e',
  oxygen: '#37d6ff',
  oxygenLow: '#ff6b5e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-deep.best';
