// The world: the sub, the pearls, the mines, the creatures, the bubbles, the
// oxygen and the waves. Pure simulation — each step takes a movement vector and
// answers with an event bitmask, so the screens and the sounds live outside it.
// A wave is cleared by collecting its pearl quota; the next wave is deeper, darker
// and busier, and between waves the player picks one of three upgrades.

import {
  ANGLER, BUBBLE, FIELD, JELLY, LIVES, MINE, OXYGEN, PEARL, SUB, UPGRADES, WAVE,
} from './config.js';

export const EVENT_PEARL = 1;
export const EVENT_BUBBLE = 2;
export const EVENT_HIT = 4;
export const EVENT_SHIELD = 8;
export const EVENT_OXYGEN_OUT = 16;
export const EVENT_WAVE_CLEAR = 32;
export const EVENT_OVER = 64;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createWorld(rng) {
  const state = {
    sub: { x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, angle: 0, invuln: 0, shield: false },
    oxygen: OXYGEN.max,
    maxOxygen: OXYGEN.max,
    lives: LIVES,
    score: 0,
    wave: 1,
    depth: 150,
    pearlsCollected: 0,
    pearlQuota: PEARL.quotaBase,
    speedMult: 1,
    magnetRadius: 0,
    shield: false,
    pearls: [],
    mines: [],
    anglers: [],
    jellies: [],
    bubbles: [],
    particles: [],
    spawnPearlIn: 0,
    spawnBubbleIn: 1,
    spawnAnglerIn: 20,
    spawnJellyIn: 16,
    shake: 0,
    flash: 0,
    time: 0,
    waveCleared: false,
    upgrades: [],
    over: false,
  };

  /** A point inside the field, away from the sub and away from every mine. */
  function clearSpot(minSubDist) {
    for (let tries = 0; tries < 24; tries += 1) {
      const x = rng.range(70, FIELD.width - 70);
      const y = rng.range(90, FIELD.height - 70);
      if (dist2(x, y, state.sub.x, state.sub.y) < minSubDist * minSubDist) continue;
      let nearMine = false;
      for (const m of state.mines) {
        if (dist2(x, y, m.x, m.y) < 90 * 90) { nearMine = true; break; }
      }
      if (!nearMine) return { x, y };
    }
    return { x: rng.range(70, FIELD.width - 70), y: rng.range(90, FIELD.height - 70) };
  }

  function spawnPearl() {
    const p = clearSpot(150);
    state.pearls.push({
      x: p.x, y: p.y, r: PEARL.radius,
      phase: rng.range(0, Math.PI * 2),
      vx: rng.range(-PEARL.drift, PEARL.drift),
      vy: rng.range(-PEARL.drift, PEARL.drift),
    });
  }

  function spawnMine() {
    const p = clearSpot(190);
    state.mines.push({
      x: p.x, y: p.y, r: MINE.radius,
      phase: rng.range(0, Math.PI * 2),
      vx: rng.range(-MINE.drift, MINE.drift),
      vy: rng.range(-MINE.drift, MINE.drift),
    });
  }

  function spawnAngler() {
    const fromLeft = rng.chance(0.5);
    state.anglers.push({
      x: fromLeft ? -30 : FIELD.width + 30,
      y: rng.range(90, FIELD.height - 90),
      r: ANGLER.radius,
      dir: fromLeft ? 1 : -1,
      phase: rng.range(0, Math.PI * 2),
      speed: ANGLER.speed + ANGLER.speedPerWave * (state.wave - 1),
    });
  }

  function spawnJelly() {
    state.jellies.push({
      x: rng.range(60, FIELD.width - 60),
      y: -30,
      r: JELLY.radius,
      phase: rng.range(0, Math.PI * 2),
      speed: JELLY.speed + JELLY.speedPerWave * (state.wave - 1),
    });
  }

  function spawnBubble() {
    state.bubbles.push({
      x: rng.range(50, FIELD.width - 50),
      y: FIELD.height - 20,
      r: BUBBLE.radius,
      phase: rng.range(0, Math.PI * 2),
      rise: BUBBLE.rise * rng.range(0.8, 1.2),
    });
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 20,
        life: 0, max: rng.range(0.35, 0.8),
        size: rng.range(2, 5), color,
      });
    }
  }

  function bubbleTrail() {
    if (rng.chance(0.35)) {
      state.particles.push({
        x: state.sub.x - Math.cos(state.sub.angle) * 26 + rng.range(-4, 4),
        y: state.sub.y - Math.sin(state.sub.angle) * 26 + rng.range(-4, 4),
        vx: rng.range(-8, 8),
        vy: rng.range(-45, -25),
        life: 0, max: rng.range(0.5, 1.1),
        size: rng.range(2, 4), color: 'bubble',
      });
    }
  }

  /** Set up wave n: its quota, its mines and creatures, a full oxygen tank. */
  function startWave(n) {
    state.wave = n;
    state.pearlQuota = PEARL.quotaBase + PEARL.quotaPerWave * (n - 1);
    state.pearlsCollected = 0;
    state.waveCleared = false;
    state.upgrades = [];
    state.oxygen = state.maxOxygen;
    state.pearls = [];
    state.mines = [];
    state.anglers = [];
    state.jellies = [];
    const mines = Math.min(MINE.maxCount, MINE.baseCount + MINE.perWave * (n - 1));
    for (let i = 0; i < mines; i += 1) spawnMine();
    const anglers = Math.min(ANGLER.maxCount, ANGLER.baseCount + ANGLER.perWave * (n - 1));
    for (let i = 0; i < anglers; i += 1) spawnAngler();
    const jellies = Math.min(JELLY.maxCount, JELLY.baseCount + JELLY.perWave * (n - 1));
    for (let i = 0; i < jellies; i += 1) spawnJelly();
    for (let i = 0; i < PEARL.maxOnField; i += 1) spawnPearl();
    state.spawnPearlIn = PEARL.spawnInterval;
    state.spawnBubbleIn = 1.5;
    state.spawnAnglerIn = 20;
    state.spawnJellyIn = 16;
  }

  /** A fresh run: three lives, wave one, the sub in the middle of the trench. */
  function reset() {
    state.sub.x = FIELD.width / 2;
    state.sub.y = FIELD.height / 2;
    state.sub.vx = 0;
    state.sub.vy = 0;
    state.sub.angle = 0;
    state.sub.invuln = 0;
    state.sub.shield = false;
    state.oxygen = OXYGEN.max;
    state.maxOxygen = OXYGEN.max;
    state.lives = LIVES;
    state.score = 0;
    state.speedMult = 1;
    state.magnetRadius = 0;
    state.shield = false;
    state.particles = [];
    state.bubbles = [];
    state.shake = 0;
    state.flash = 0;
    state.time = 0;
    state.over = false;
    startWave(1);
  }

  /** Three different upgrades to offer, drawn from the pool. */
  function offerUpgrades() {
    const pool = UPGRADES.filter((u) => !u.needs || u.needs(state));
    const picks = [];
    const bag = [...pool];
    while (picks.length < 3 && bag.length > 0) {
      const i = Math.floor(rng.next() * bag.length);
      picks.push(bag.splice(i, 1)[0]);
    }
    state.upgrades = picks;
  }

  /** Take upgrade i, then dive into the next wave. */
  function chooseUpgrade(i) {
    const pick = state.upgrades[i];
    if (!pick) return;
    pick.apply(state);
    if (pick.id === 'shield') state.sub.shield = true;
    startWave(state.wave + 1);
  }

  /** The depth in metres: deeper every wave, and a little deeper per pearl. */
  function depthMeters() {
    return 150 + (state.wave - 1) * 180 + state.pearlsCollected * 7;
  }

  function loseLife(events) {
    state.lives -= 1;
    state.sub.invuln = SUB.invuln;
    state.shake = 14;
    state.flash = 0.7;
    burst(state.sub.x, state.sub.y, 'debris', 22, 260);
    if (state.lives <= 0) {
      state.over = true;
      return events | EVENT_OVER;
    }
    return events;
  }

  function stepSub(dt, move) {
    const sub = state.sub;
    const maxSpeed = SUB.speed * state.speedMult;
    sub.vx += move.x * SUB.accel * dt;
    sub.vy += move.y * SUB.accel * dt;
    const damp = Math.max(0, 1 - SUB.drag * dt);
    sub.vx *= damp;
    sub.vy *= damp;
    const speed = Math.hypot(sub.vx, sub.vy);
    if (speed > maxSpeed) {
      sub.vx = (sub.vx / speed) * maxSpeed;
      sub.vy = (sub.vy / speed) * maxSpeed;
    }
    sub.x = clamp(sub.x + sub.vx * dt, SUB.radius, FIELD.width - SUB.radius);
    sub.y = clamp(sub.y + sub.vy * dt, SUB.radius + 40, FIELD.height - SUB.radius);
    if (speed > 40) {
      const want = Math.atan2(sub.vy, sub.vx);
      let d = want - sub.angle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      sub.angle += d * Math.min(1, dt * 10);
    }
    if (speed > 60) bubbleTrail();
    if (sub.invuln > 0) sub.invuln -= dt;
  }

  function step(dt, move) {
    if (state.over) return 0;
    let events = 0;
    state.time += dt;
    state.depth = depthMeters();
    state.shake = Math.max(0, state.shake - dt * 30);
    state.flash = Math.max(0, state.flash - dt * 1.6);

    stepSub(dt, move);

    // Oxygen drains; an empty tank costs a life and a partial refill.
    state.oxygen -= (OXYGEN.drain + OXYGEN.drainPerWave * (state.wave - 1)) * dt;
    if (state.oxygen <= 0) {
      state.oxygen = state.maxOxygen * 0.6;
      events |= EVENT_OXYGEN_OUT;
      events = loseLife(events);
      if (state.over) return events | EVENT_OVER;
    }

    // Pearls drift, and the magnet pulls them in.
    for (const p of state.pearls) {
      p.x += p.vx * dt;
      p.y += p.vy * dt + Math.sin(state.time * 2 + p.phase) * 6 * dt;
      if (state.magnetRadius > 0) {
        const d2 = dist2(p.x, p.y, state.sub.x, state.sub.y);
        if (d2 < state.magnetRadius * state.magnetRadius) {
          const d = Math.sqrt(d2) || 1;
          p.x += ((state.sub.x - p.x) / d) * 170 * dt;
          p.y += ((state.sub.y - p.y) / d) * 170 * dt;
        }
      }
      if (p.x < 20 || p.x > FIELD.width - 20) p.vx *= -1;
      if (p.y < 60 || p.y > FIELD.height - 20) p.vy *= -1;
    }

    // Mines drift aimlessly and bounce off the walls.
    for (const m of state.mines) {
      m.x += m.vx * dt;
      m.y += m.vy * dt + Math.sin(state.time + m.phase) * 8 * dt;
      if (m.x < 30 || m.x > FIELD.width - 30) m.vx *= -1;
      if (m.y < 70 || m.y > FIELD.height - 30) m.vy *= -1;
    }

    // Anglerfish cruise, then chase when the sub comes close.
    for (const a of state.anglers) {
      const d2 = dist2(a.x, a.y, state.sub.x, state.sub.y);
      if (d2 < ANGLER.chaseRadius * ANGLER.chaseRadius && state.sub.invuln <= 0) {
        const d = Math.sqrt(d2) || 1;
        a.x += ((state.sub.x - a.x) / d) * a.speed * 1.8 * dt;
        a.y += ((state.sub.y - a.y) / d) * a.speed * 1.8 * dt;
      } else {
        a.x += a.dir * a.speed * dt;
        a.y += Math.sin(state.time * 1.4 + a.phase) * 22 * dt;
      }
      if (a.x < -60) { a.x = -60; a.dir = 1; }
      if (a.x > FIELD.width + 60) { a.x = FIELD.width + 60; a.dir = -1; }
      a.y = clamp(a.y, 70, FIELD.height - 40);
    }

    // Jellyfish sink slowly, swaying side to side, and wrap back to the top.
    for (const j of state.jellies) {
      j.y += j.speed * dt;
      j.x += Math.sin(state.time * 1.1 + j.phase) * 26 * dt;
      if (j.y > FIELD.height + 40) {
        j.y = -30;
        j.x = rng.range(60, FIELD.width - 60);
      }
    }

    // Air bubbles rise and sway; they are gone at the surface.
    for (const b of state.bubbles) {
      b.y -= b.rise * dt;
      b.x += Math.sin(state.time * 2.4 + b.phase) * 14 * dt;
    }
    state.bubbles = state.bubbles.filter((b) => b.y > 50);

    // Particles fade.
    for (const p of state.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 12 * dt;
    }
    state.particles = state.particles.filter((p) => p.life < p.max);

    // Spawning on timers.
    state.spawnPearlIn -= dt;
    if (state.spawnPearlIn <= 0 && state.pearls.length < PEARL.maxOnField && state.pearlsCollected + state.pearls.length < state.pearlQuota) {
      spawnPearl();
      state.spawnPearlIn = PEARL.spawnInterval;
    }
    state.spawnBubbleIn -= dt;
    if (state.spawnBubbleIn <= 0 && state.bubbles.length < 6) {
      spawnBubble();
      state.spawnBubbleIn = BUBBLE.spawnInterval;
    }
    state.spawnAnglerIn -= dt;
    if (state.spawnAnglerIn <= 0 && state.anglers.length < ANGLER.maxCount) {
      spawnAngler();
      state.spawnAnglerIn = 20;
    }
    state.spawnJellyIn -= dt;
    if (state.spawnJellyIn <= 0 && state.jellies.length < JELLY.maxCount) {
      spawnJelly();
      state.spawnJellyIn = 16;
    }

    // Picking up pearls.
    const sub = state.sub;
    for (let i = state.pearls.length - 1; i >= 0; i -= 1) {
      const p = state.pearls[i];
      if (dist2(p.x, p.y, sub.x, sub.y) < (SUB.radius + p.r + 6) ** 2) {
        state.pearls.splice(i, 1);
        state.pearlsCollected += 1;
        state.score += PEARL.points * state.wave;
        burst(p.x, p.y, 'pearl', 14, 160);
        events |= EVENT_PEARL;
        if (state.pearlsCollected >= state.pearlQuota) {
          state.score += WAVE.clearBonusBase + WAVE.clearBonusPerWave * state.wave;
          state.waveCleared = true;
          offerUpgrades();
          events |= EVENT_WAVE_CLEAR;
        }
      }
    }

    // Picking up air.
    for (let i = state.bubbles.length - 1; i >= 0; i -= 1) {
      const b = state.bubbles[i];
      if (dist2(b.x, b.y, sub.x, sub.y) < (SUB.radius + b.r) ** 2) {
        state.bubbles.splice(i, 1);
        state.oxygen = Math.min(state.maxOxygen, state.oxygen + OXYGEN.bubbleRefill);
        burst(b.x, b.y, 'bubble', 8, 90);
        events |= EVENT_BUBBLE;
      }
    }

    // Hitting something that hurts.
    if (sub.invuln <= 0) {
      let hitX = 0;
      let hitY = 0;
      let hitKind = '';
      for (let i = state.mines.length - 1; i >= 0; i -= 1) {
        const m = state.mines[i];
        if (dist2(m.x, m.y, sub.x, sub.y) < (SUB.radius + m.r - 4) ** 2) {
          hitKind = 'mine';
          hitX = m.x;
          hitY = m.y;
          burst(m.x, m.y, 'debris', 26, 320);
          state.mines.splice(i, 1);
          break;
        }
      }
      if (!hitKind) {
        for (const a of state.anglers) {
          if (dist2(a.x, a.y, sub.x, sub.y) < (SUB.radius + a.r - 6) ** 2) {
            hitKind = 'angler';
            hitX = a.x;
            hitY = a.y;
            break;
          }
        }
      }
      if (!hitKind) {
        for (const j of state.jellies) {
          if (dist2(j.x, j.y, sub.x, sub.y) < (SUB.radius + j.r - 6) ** 2) {
            hitKind = 'jelly';
            hitX = j.x;
            hitY = j.y;
            break;
          }
        }
      }
      if (hitKind) {
        // Knock the sub away from the blow.
        const hx = sub.x - hitX;
        const hy = sub.y - hitY;
        const hd = Math.hypot(hx, hy) || 1;
        sub.vx = (hx / hd) * 420;
        sub.vy = (hy / hd) * 420;
        if (sub.shield) {
          sub.shield = false;
          state.shield = false;
          sub.invuln = 1.5;
          burst(sub.x, sub.y, 'shield', 18, 220);
          events |= EVENT_SHIELD;
        } else {
          events |= EVENT_HIT;
          events = loseLife(events);
        }
      }
    }

    return events;
  }

  /** Advance the scenery without the rules: the title screen's living backdrop. */
  function ambient(dt) {
    state.time += dt;
    for (const p of state.pearls) {
      p.x += p.vx * dt;
      p.y += p.vy * dt + Math.sin(state.time * 2 + p.phase) * 6 * dt;
    }
    for (const m of state.mines) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
    for (const a of state.anglers) {
      a.x += a.dir * a.speed * dt;
      a.y += Math.sin(state.time * 1.4 + a.phase) * 22 * dt;
      if (a.x < -60) { a.x = -60; a.dir = 1; }
      if (a.x > FIELD.width + 60) { a.x = FIELD.width + 60; a.dir = -1; }
    }
    for (const j of state.jellies) {
      j.y += j.speed * dt;
      j.x += Math.sin(state.time * 1.1 + j.phase) * 26 * dt;
      if (j.y > FIELD.height + 40) {
        j.y = -30;
        j.x = rng.range(60, FIELD.width - 60);
      }
    }
    for (const b of state.bubbles) {
      b.y -= b.rise * dt;
      b.x += Math.sin(state.time * 2.4 + b.phase) * 14 * dt;
    }
    state.bubbles = state.bubbles.filter((b) => b.y > 50);
    state.spawnBubbleIn -= dt;
    if (state.spawnBubbleIn <= 0 && state.bubbles.length < 6) {
      spawnBubble();
      state.spawnBubbleIn = BUBBLE.spawnInterval;
    }
    for (const p of state.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    state.particles = state.particles.filter((p) => p.life < p.max);
    if (rng.chance(0.1)) {
      state.particles.push({
        x: state.sub.x + rng.range(-6, 6), y: state.sub.y - 20,
        vx: 0, vy: -35, life: 0, max: 1, size: 3, color: 'bubble',
      });
    }
  }

  return { state, reset, startWave, step, ambient, chooseUpgrade, offerUpgrades, depthMeters };
}
