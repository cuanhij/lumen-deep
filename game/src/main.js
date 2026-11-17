// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between five screens: title, play, upgrade,
// paused and game over.
//
// ?seed=N fixes the random pattern. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BUBBLE, EVENT_HIT, EVENT_OVER, EVENT_OXYGEN_OUT, EVENT_PEARL, EVENT_SHIELD, EVENT_WAVE_CLEAR,
} from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds between low-oxygen alarm beeps. */
const ALARM_EVERY = 2.2;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function announce(text) {
  status.textContent = text;
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, {
      best: Math.max(scene.best, readBest()),
      muted: false,
      mouse: null,
      isNewBest: false,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let isNewBest = false;
  let accumulator = 0;
  let last = performance.now();
  let lastAlarm = -10;

  world.reset();

  // A small handle for automated play-testing (read-only state for a test driver).
  window.__lumen = {
    world,
    get screen() { return screen; },
    get best() { return best; },
  };
  function drainStale() {
    input.confirmPressed();
    input.digitPressed();
    input.takeClick();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > MAX_FRAME) dt = MAX_FRAME;
    if (dt <= 0) return;

    if (input.mutePressed()) {
      audio.setMuted(!audio.isMuted());
      announce(audio.isMuted() ? 'Sound off.' : 'Sound on.');
    }

    if (screen === SCREEN_TITLE) {
      world.ambient(dt);
      if (input.confirmPressed() || input.takeClick()) {
        audio.resume();
        audio.start();
        world.reset();
        screen = SCREEN_PLAY;
        announce('Diving! Collect pearls, dodge mines and creatures, watch your oxygen.');
      }
    } else if (screen === SCREEN_PLAY) {
      drainStale();
      let move = input.axis();
      if (move.x === 0 && move.y === 0 && input.mouse.held) {
        const f = renderer.toField(input.mouse.x, input.mouse.y);
        const dx = f.x - world.state.sub.x;
        const dy = f.y - world.state.sub.y;
        const d = Math.hypot(dx, dy);
        if (d > 12) move = { x: dx / d, y: dy / d };
      }
      accumulator += dt;
      let events = 0;
      while (accumulator >= STEP) {
        events |= world.step(STEP, move);
        accumulator -= STEP;
        if (events & (EVENT_WAVE_CLEAR | EVENT_OVER)) break;
      }
      if (events & EVENT_PEARL) audio.pearl();
      if (events & EVENT_BUBBLE) audio.bubble();
      if (events & EVENT_HIT) audio.hit();
      if (events & EVENT_SHIELD) audio.shieldBreak();
      if (events & EVENT_OXYGEN_OUT) audio.alarm();
      if (world.state.oxygen < 25 && world.state.time - lastAlarm > ALARM_EVERY) {
        audio.alarm();
        lastAlarm = world.state.time;
      }
      if (events & EVENT_WAVE_CLEAR) {
        audio.waveClear();
        screen = SCREEN_UPGRADE;
        announce(`Wave ${world.state.wave} cleared! Choose an upgrade.`);
      } else if (events & EVENT_OVER) {
        audio.gameOver();
        isNewBest = world.state.score > best;
        if (isNewBest) {
          best = world.state.score;
          saveBest(best);
        }
        screen = SCREEN_OVER;
        announce(`Game over. Score ${world.state.score}.`);
      } else if (input.pausePressed()) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
    } else if (screen === SCREEN_UPGRADE) {
      input.confirmPressed();
      const digit = input.digitPressed();
      const click = input.takeClick();
      let pick = digit >= 1 && digit <= 3 ? digit - 1 : -1;
      if (pick === -1 && click) {
        const f = renderer.toField(click.x, click.y);
        for (const rect of renderer.cardRects) {
          if (f.x >= rect.x && f.x <= rect.x + rect.w && f.y >= rect.y && f.y <= rect.y + rect.h) {
            pick = rect.index;
            break;
          }
        }
      }
      if (pick >= 0 && pick < world.state.upgrades.length) {
        audio.upgrade();
        world.chooseUpgrade(pick);
        screen = SCREEN_PLAY;
        announce(`Upgrade taken. Wave ${world.state.wave} — dive deeper.`);
      }
    } else if (screen === SCREEN_PAUSED) {
      drainStale();
      if (input.pausePressed() || input.confirmPressed()) {
        screen = SCREEN_PLAY;
        announce('Diving again.');
      }
    } else if (screen === SCREEN_OVER) {
      if (input.confirmPressed() || input.takeClick()) {
        audio.click();
        world.reset();
        isNewBest = false;
        screen = SCREEN_PLAY;
        announce('Diving! Collect pearls, dodge mines and creatures, watch your oxygen.');
      }
    }

    const mouseField = renderer.toField(input.mouse.x, input.mouse.y);
    renderer.draw(world.state, screen, {
      best,
      muted: audio.isMuted(),
      mouse: mouseField,
      isNewBest,
    });
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
