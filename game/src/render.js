// Everything the player sees: the dark water, the god rays, the seabed, the sub
// and its headlamp, the pearls, mines, creatures and bubbles, the particles, the
// HUD and the title / upgrade / pause / game-over screens. The logical field is
// 1280x720; this file scales it to the window and letterboxes it. Nothing here
// changes the simulation: it only paints the state it is given.

import { FIELD, FONT, OXYGEN, PALETTE, PEARL, SUB } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

function hexRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a, b, t) {
  const ca = hexRgb(a);
  const cb = hexRgb(b);
  return `rgb(${Math.round(ca[0] + (cb[0] - ca[0]) * t)},${Math.round(ca[1] + (cb[1] - ca[1]) * t)},${Math.round(ca[2] + (cb[2] - ca[2]) * t)})`;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0, w: 1280, h: 720, dpr: 1 };
  const cardRects = [];

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    view.w = w;
    view.h = h;
    view.dpr = dpr;
    view.scale = Math.min(w / FIELD.width, h / FIELD.height);
    view.ox = (w - FIELD.width * view.scale) / 2;
    view.oy = (h - FIELD.height * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  /** Canvas CSS pixels to field coordinates (for mouse steering and clicks). */
  function toField(cx, cy) {
    return { x: (cx - view.ox) / view.scale, y: (cy - view.oy) / view.scale };
  }

  function panel(x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = PALETTE.panel;
    ctx.fill();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function text(str, x, y, size, color, align = 'center', weight = 700) {
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function glowCircle(x, y, r, color) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBackground(state) {
    const deep = clamp((state.depth - 150) / 1600, 0, 1);
    const top = mix(PALETTE.waterTop, PALETTE.waterDeep, deep * 0.7);
    const bottom = mix(PALETTE.waterMid, PALETTE.waterDeep, deep);
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // God rays from the surface, fading with depth.
    ctx.save();
    ctx.globalAlpha = 0.05 * (1 - deep * 0.8);
    ctx.fillStyle = '#bfe9ff';
    for (let i = 0; i < 5; i += 1) {
      const x = 180 + i * 230 + Math.sin(state.time * 0.22 + i * 1.7) * 26;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 90, 0);
      ctx.lineTo(x + 210, FIELD.height);
      ctx.lineTo(x + 60, FIELD.height);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Marine snow: tiny specks drifting down, placed by a hash so they need no state.
    ctx.fillStyle = 'rgba(200, 230, 255, 0.35)';
    for (let i = 0; i < 70; i += 1) {
      const x = (i * 137.5 + state.time * 9) % FIELD.width;
      const y = (i * 89.3 + state.time * 13) % FIELD.height;
      ctx.fillRect(x, y, 2, 2);
    }

    // The seabed ridge.
    ctx.fillStyle = PALETTE.rock;
    ctx.beginPath();
    ctx.moveTo(0, FIELD.height);
    for (let x = 0; x <= FIELD.width; x += 80) {
      ctx.lineTo(x, FIELD.height - 26 - Math.sin(x * 0.011 + 2) * 14 - Math.sin(x * 0.004) * 10);
    }
    ctx.lineTo(FIELD.width, FIELD.height);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.rockEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 80) {
      const y = FIELD.height - 26 - Math.sin(x * 0.011 + 2) * 14 - Math.sin(x * 0.004) * 10;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Swaying seaweed.
    ctx.strokeStyle = PALETTE.weed;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i += 1) {
      const x = 70 + i * 140 + Math.sin(i * 7.3) * 30;
      const sway = Math.sin(state.time * 0.9 + i * 1.3) * 16;
      const h = 46 + (i % 3) * 18;
      ctx.beginPath();
      ctx.moveTo(x, FIELD.height - 18);
      ctx.quadraticCurveTo(x + sway * 0.4, FIELD.height - 18 - h * 0.6, x + sway, FIELD.height - 18 - h);
      ctx.stroke();
    }

    // A few dark boulders.
    ctx.fillStyle = '#081a29';
    for (let i = 0; i < 5; i += 1) {
      const x = 150 + i * 260 + Math.sin(i * 3.1) * 40;
      const y = FIELD.height - 24;
      ctx.beginPath();
      ctx.ellipse(x, y, 52 + (i % 2) * 22, 20, 0, Math.PI, 0);
      ctx.fill();
    }
  }

  function drawPearl(p, time) {
    const pulse = 1 + 0.12 * Math.sin(time * 3 + p.phase);
    glowCircle(p.x, p.y, 34 * pulse, PALETTE.pearlGlow);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = PALETTE.pearl;
    ctx.beginPath();
    ctx.arc(0, 0, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6d8';
    ctx.beginPath();
    ctx.arc(-3.5, -4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBubble(b) {
    ctx.strokeStyle = PALETTE.bubble;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(b.x - 3.5, b.y - 4, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMine(m, time) {
    glowCircle(m.x, m.y, 44, PALETTE.mineGlow);
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(Math.sin(time * 0.8 + m.phase) * 0.15);
    ctx.fillStyle = '#3a1512';
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.22) * 12, Math.sin(a - 0.22) * 12);
      ctx.lineTo(Math.cos(a) * 27, Math.sin(a) * 27);
      ctx.lineTo(Math.cos(a + 0.22) * 12, Math.sin(a + 0.22) * 12);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#1c0a08';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    const blink = 0.5 + 0.5 * Math.sin(time * 4 + m.phase);
    ctx.fillStyle = `rgba(255, 80, 60, ${0.55 + blink * 0.45})`;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawAngler(a, time) {
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(a.dir >= 0 ? 1 : -1, 1);
    glowCircle(0, 0, 52, 'rgba(124, 245, 211, 0.14)');
    ctx.fillStyle = PALETTE.angler;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.anglerBelly;
    ctx.beginPath();
    ctx.ellipse(2, 8, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail fin.
    ctx.fillStyle = PALETTE.angler;
    ctx.beginPath();
    ctx.moveTo(-26, 0);
    ctx.lineTo(-44, -13);
    ctx.lineTo(-44, 13);
    ctx.closePath();
    ctx.fill();
    // Jaw with teeth.
    ctx.fillStyle = '#160d33';
    ctx.beginPath();
    ctx.ellipse(14, 7, 15, 9, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 4; i += 1) {
      ctx.beginPath();
      ctx.moveTo(4 + i * 6, 1);
      ctx.lineTo(7 + i * 6, 8);
      ctx.lineTo(10 + i * 6, 1);
      ctx.closePath();
      ctx.fill();
    }
    // The glowing lure.
    const lureX = 16 + Math.sin(time * 2 + a.phase) * 2;
    const lureY = -26 + Math.cos(time * 1.6 + a.phase) * 3;
    ctx.strokeStyle = '#5b4a8a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, -14);
    ctx.quadraticCurveTo(14, -22, lureX, lureY);
    ctx.stroke();
    glowCircle(lureX, lureY, 13, 'rgba(124, 245, 211, 0.75)');
    ctx.fillStyle = PALETTE.lure;
    ctx.beginPath();
    ctx.arc(lureX, lureY, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // Eye.
    ctx.fillStyle = '#d9fff4';
    ctx.beginPath();
    ctx.arc(16, -7, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawJelly(j, time) {
    const pulse = 1 + 0.14 * Math.sin(time * 2.2 + j.phase);
    glowCircle(j.x, j.y, 46 * pulse, PALETTE.jellyGlow);
    ctx.save();
    ctx.translate(j.x, j.y);
    ctx.scale(pulse, 2 - pulse);
    ctx.fillStyle = PALETTE.jelly;
    ctx.beginPath();
    ctx.arc(0, 0, j.r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(247, 143, 179, 0.6)';
    ctx.lineWidth = 2;
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 8, 2);
      ctx.quadraticCurveTo(i * 8 + Math.sin(time * 3 + j.phase + i) * 7, 20, i * 8 + Math.sin(time * 2 + j.phase + i * 2) * 10, 36);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSub(sub, time) {
    // The headlamp cone, in world space along the facing angle.
    ctx.save();
    ctx.translate(sub.x, sub.y);
    ctx.rotate(sub.angle);
    const lampGrad = ctx.createLinearGradient(0, 0, SUB.lamp, 0);
    lampGrad.addColorStop(0, 'rgba(255, 244, 180, 0.20)');
    lampGrad.addColorStop(1, 'rgba(255, 244, 180, 0)');
    ctx.fillStyle = lampGrad;
    ctx.beginPath();
    ctx.moveTo(18, -8);
    ctx.lineTo(SUB.lamp, -64);
    ctx.lineTo(SUB.lamp, 64);
    ctx.lineTo(18, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const blink = sub.invuln > 0 && Math.floor(time * 9) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blink ? 0.35 : 1;
    glowCircle(sub.x, sub.y, 64, 'rgba(80, 200, 255, 0.20)');
    ctx.translate(sub.x, sub.y);
    ctx.rotate(sub.angle);
    // Propeller at the stern.
    const prop = time * 22;
    ctx.strokeStyle = '#9db8c8';
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i += 1) {
      const a = prop + (i * Math.PI * 2) / 3;
      ctx.beginPath();
      ctx.moveTo(-26, 0);
      ctx.lineTo(-26 + Math.cos(a) * 10, Math.sin(a) * 10);
      ctx.stroke();
    }
    // Hull.
    const hull = ctx.createLinearGradient(0, -20, 0, 20);
    hull.addColorStop(0, '#ffd166');
    hull.addColorStop(0.55, PALETTE.sub);
    hull.addColorStop(1, PALETTE.subDark);
    ctx.fillStyle = hull;
    ctx.beginPath();
    ctx.ellipse(0, 0, 30, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7a5200';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Conning tower and periscope.
    ctx.fillStyle = PALETTE.subDark;
    ctx.beginPath();
    ctx.roundRect(-8, -26, 18, 10, 4);
    ctx.fill();
    ctx.fillRect(4, -34, 3, 9);
    // The glass dome.
    ctx.fillStyle = PALETTE.subGlass;
    ctx.beginPath();
    ctx.arc(12, -3, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(10, -6, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Headlamp lens.
    ctx.fillStyle = '#fff3b0';
    ctx.beginPath();
    ctx.arc(29, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    if (sub.shield) {
      ctx.strokeStyle = 'rgba(80, 220, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sub.x, sub.y, 36 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawParticles(particles) {
    for (const p of particles) {
      const t = 1 - p.life / p.max;
      if (p.color === 'bubble') {
        ctx.strokeStyle = `rgba(180, 235, 255, ${0.7 * t})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const color = p.color === 'pearl' ? '255, 209, 102' : p.color === 'shield' ? '80, 220, 255' : '255, 120, 80';
        ctx.fillStyle = `rgba(${color}, ${t})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * t + 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawHud(state, ui) {
    const oxygenFrac = Math.max(0, state.oxygen / state.maxOxygen);
    const low = oxygenFrac < OXYGEN.lowAt / 100;
    const pulse = low ? 0.55 + 0.45 * Math.sin(state.time * 6) : 1;

    panel(14, 12, 330, 66, 12);
    text('OXYGEN', 30, 32, 15, PALETTE.muted, 'left', 800);
    ctx.fillStyle = '#06283d';
    ctx.beginPath();
    ctx.roundRect(30, 44, 220, 18, 9);
    ctx.fill();
    ctx.fillStyle = low ? PALETTE.oxygenLow : PALETTE.oxygen;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.roundRect(30, 44, Math.max(18, 220 * oxygenFrac), 18, 9);
    ctx.fill();
    ctx.globalAlpha = 1;
    text(`${Math.ceil(state.oxygen)}`, 262, 54, 20, PALETTE.text, 'left');
    // Lives as little subs.
    for (let i = 0; i < 3; i += 1) {
      const x = 298 + i * 16;
      const y = 32;
      ctx.fillStyle = i < state.lives ? PALETTE.sub : 'rgba(120,140,160,0.35)';
      ctx.beginPath();
      ctx.ellipse(x, y, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    panel(FIELD.width / 2 - 150, 12, 300, 66, 12);
    text(`DEPTH ${Math.round(state.depth)} m`, FIELD.width / 2, 36, 24, PALETTE.text);
    text(`WAVE ${state.wave}`, FIELD.width / 2, 62, 16, PALETTE.muted, 'center', 800);

    panel(FIELD.width - 344, 12, 330, 66, 12);
    text(`SCORE ${state.score.toLocaleString('en-US')}`, FIELD.width - 30, 36, 24, PALETTE.gold, 'right');
    text(`PEARLS ${state.pearlsCollected}/${state.pearlQuota}`, FIELD.width - 30, 62, 16, PALETTE.muted, 'right', 800);

    const chips = [];
    if (state.magnetRadius > 0) chips.push('MAGNET');
    if (state.speedMult > 1.01) chips.push('TURBO');
    if (state.sub.shield) chips.push('SHIELD');
    if (state.maxOxygen > OXYGEN.max) chips.push('BIG TANK');
    if (chips.length > 0) {
      text(chips.join('  ·  '), 30, 96, 14, PALETTE.subGlass, 'left', 700);
    }
    if (ui.muted) text('MUTED (M)', FIELD.width - 30, 96, 14, PALETTE.muted, 'right', 700);
  }

  function dim(alpha) {
    ctx.fillStyle = `rgba(1, 6, 13, ${alpha})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function drawTitle(state, best) {
    dim(0.45);
    text('LUMEN DEEP', FIELD.width / 2, 150, 96, PALETTE.gold, 'center', 900);
    ctx.save();
    ctx.shadowColor = 'rgba(255, 209, 102, 0.8)';
    ctx.shadowBlur = 34;
    text('LUMEN DEEP', FIELD.width / 2, 150, 96, '#ffe9a8', 'center', 900);
    ctx.restore();
    text('A deep-sea pearl dive', FIELD.width / 2, 205, 26, PALETTE.subGlass, 'center', 600);

    panel(FIELD.width / 2 - 330, 250, 660, 190, 16);
    text('◆  Collect pearls to dive deeper — clear the quota for the next wave', FIELD.width / 2, 286, 20, PALETTE.text, 'center', 600);
    text('✖  Dodge mines, anglerfish and jellyfish — you have 3 lives', FIELD.width / 2, 322, 20, PALETTE.text, 'center', 600);
    text('○  Grab air bubbles — your oxygen is always draining', FIELD.width / 2, 358, 20, PALETTE.text, 'center', 600);
    text('★  Between waves, pick 1 of 3 upgrades', FIELD.width / 2, 394, 20, PALETTE.text, 'center', 600);

    text('Move: Arrow keys / WASD or hold the mouse  •  Pause: P  •  Mute: M', FIELD.width / 2, 478, 18, PALETTE.muted, 'center', 600);
    if (best > 0) text(`BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, 516, 22, PALETTE.gold, 'center', 800);
    const blink = 0.75 + 0.25 * Math.sin(state.time * 4);
    ctx.globalAlpha = blink;
    text('PRESS ENTER OR CLICK TO DIVE', FIELD.width / 2, 580, 30, PALETTE.text, 'center', 900);
    ctx.globalAlpha = 1;
  }

  function drawUpgrade(state, mouse) {
    dim(0.6);
    text(`WAVE ${state.wave} CLEARED!`, FIELD.width / 2, 120, 44, PALETTE.gold, 'center', 900);
    text('Choose one upgrade', FIELD.width / 2, 168, 24, PALETTE.text, 'center', 600);
    cardRects.length = 0;
    const cardW = 300;
    const cardH = 230;
    const gap = 30;
    const total = cardW * 3 + gap * 2;
    const x0 = (FIELD.width - total) / 2;
    const y0 = 220;
    state.upgrades.forEach((u, i) => {
      const x = x0 + i * (cardW + gap);
      const hover = mouse && mouse.x >= x && mouse.x <= x + cardW && mouse.y >= y0 && mouse.y <= y0 + cardH;
      ctx.save();
      if (hover) {
        ctx.shadowColor = 'rgba(120, 200, 255, 0.7)';
        ctx.shadowBlur = 22;
      }
      panel(x, y0, cardW, cardH, 16);
      ctx.restore();
      cardRects.push({ x, y: y0, w: cardW, h: cardH, index: i });
      text(`[${i + 1}]`, x + cardW / 2, y0 + 44, 22, PALETTE.muted, 'center', 800);
      text(u.name, x + cardW / 2, y0 + 96, 26, PALETTE.text, 'center', 900);
      ctx.save();
      ctx.font = `600 17px ${FONT}`;
      ctx.fillStyle = PALETTE.muted;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const words = u.desc.split(' ');
      const lines = [''];
      for (const w of words) {
        const test = lines[lines.length - 1] === '' ? w : `${lines[lines.length - 1]} ${w}`;
        if (ctx.measureText(test).width > cardW - 44 && lines[lines.length - 1] !== '') lines.push(w);
        else lines[lines.length - 1] = test;
      }
      lines.forEach((line, li) => {
        ctx.fillText(line, x + cardW / 2, y0 + 140 + li * 24);
      });
      ctx.restore();
    });
    text('Click a card or press 1, 2 or 3', FIELD.width / 2, 510, 18, PALETTE.muted, 'center', 600);
  }

  function drawPaused() {
    dim(0.6);
    text('PAUSED', FIELD.width / 2, 330, 64, PALETTE.text, 'center', 900);
    text('Press P to keep diving', FIELD.width / 2, 400, 22, PALETTE.muted, 'center', 600);
  }

  function drawOver(state, best, isNewBest) {
    dim(0.62);
    panel(FIELD.width / 2 - 330, 150, 660, 400, 20);
    text('THE DEEP CLAIMS YOU', FIELD.width / 2, 214, 46, PALETTE.danger, 'center', 900);
    text('GAME OVER', FIELD.width / 2, 262, 22, PALETTE.muted, 'center', 700);
    text(`${state.score.toLocaleString('en-US')}`, FIELD.width / 2, 340, 64, PALETTE.gold, 'center', 900);
    text('SCORE', FIELD.width / 2, 388, 16, PALETTE.muted, 'center', 800);
    if (isNewBest) text('★ NEW BEST! ★', FIELD.width / 2, 424, 22, PALETTE.gold, 'center', 800);
    else text(`BEST  ${best.toLocaleString('en-US')}`, FIELD.width / 2, 424, 22, PALETTE.muted, 'center', 700);
    text(`WAVE ${state.wave}   •   DEPTH ${Math.round(state.depth)} m   •   PEARLS ${state.pearlsCollected}`, FIELD.width / 2, 466, 19, PALETTE.text, 'center', 600);
    const blink = 0.75 + 0.25 * Math.sin(state.time * 4);
    ctx.globalAlpha = blink;
    text('PRESS ENTER OR CLICK TO DIVE AGAIN', FIELD.width / 2, 520, 24, PALETTE.text, 'center', 900);
    ctx.globalAlpha = 1;
  }

  function draw(state, screen, ui) {
    resize();
    const shakeX = state.shake > 0 ? Math.sin(state.time * 91) * state.shake * 0.45 : 0;
    const shakeY = state.shake > 0 ? Math.cos(state.time * 83) * state.shake * 0.45 : 0;
    ctx.setTransform(view.dpr * view.scale, 0, 0, view.dpr * view.scale, view.dpr * (view.ox + shakeX * view.scale), view.dpr * (view.oy + shakeY * view.scale));
    ctx.clearRect(-40, -40, FIELD.width + 80, FIELD.height + 80);
    drawBackground(state);
    for (const p of state.pearls) drawPearl(p, state.time);
    for (const b of state.bubbles) drawBubble(b);
    for (const m of state.mines) drawMine(m, state.time);
    for (const j of state.jellies) drawJelly(j, state.time);
    for (const a of state.anglers) drawAngler(a, state.time);
    drawSub(state.sub, state.time);
    drawParticles(state.particles);

    if (screen === SCREEN_PLAY || screen === SCREEN_UPGRADE || screen === SCREEN_PAUSED) {
      drawHud(state, ui);
    }
    if (screen === SCREEN_TITLE) drawTitle(state, ui.best);
    if (screen === SCREEN_UPGRADE) drawUpgrade(state, ui.mouse);
    if (screen === SCREEN_PAUSED) drawPaused();
    if (screen === SCREEN_OVER) drawOver(state, ui.best, ui.isNewBest);

    // Low-oxygen warning: a red vignette that pulses.
    const oxygenFrac = state.oxygen / state.maxOxygen;
    if ((screen === SCREEN_PLAY || screen === SCREEN_UPGRADE) && oxygenFrac < OXYGEN.lowAt / 100) {
      const a = (0.16 + 0.12 * Math.sin(state.time * 6)) * (1 - oxygenFrac / (OXYGEN.lowAt / 100));
      const vg = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.42, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.75);
      vg.addColorStop(0, 'rgba(255, 40, 30, 0)');
      vg.addColorStop(1, `rgba(255, 40, 30, ${a})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }

    // Damage flash.
    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255, 60, 40, ${state.flash * 0.28})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }

    // A soft dark vignette so the edges read as deep water.
    const vg = ctx.createRadialGradient(FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.45, FIELD.width / 2, FIELD.height / 2, FIELD.height * 0.85);
    vg.addColorStop(0, 'rgba(1, 6, 13, 0)');
    vg.addColorStop(1, 'rgba(1, 6, 13, 0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    if (screen === SCREEN_PLAY && state.wave === 1 && state.time < 7) {
      text('Arrows / WASD to swim  •  Hold mouse to steer  •  P pause  •  M mute', FIELD.width / 2, FIELD.height - 30, 17, PALETTE.muted, 'center', 600);
    }
  }

  return { draw, toField, view, cardRects };
}
