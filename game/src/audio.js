// Every sound in Lumen Deep, synthesised live with Web Audio: no audio files, no
// network. The context is created on the first user gesture (browsers block sound
// before one), and every effect is an oscillator or a burst of filtered noise with a
// short gain envelope. Mute is M; the setting lives only for the visit.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let noiseBuffer = null;

  /** Build the context on a gesture; a no-op until the browser allows sound. */
  function resume() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.45;
        master.connect(ctx.destination);
        const len = Math.floor(ctx.sampleRate * 0.5);
        noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      // Sound stays off; the game plays fine without it.
    }
  }

  function tone(freq, endFreq, dur, type, vol, delay = 0) {
    if (!ctx || !master || muted) return;
    try {
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // A failed note never stops the game.
    }
  }

  function noise(dur, vol, filterFreq, delay = 0) {
    if (!ctx || !master || !noiseBuffer || muted) return;
    try {
      const t0 = ctx.currentTime + delay;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
      src.stop(t0 + dur + 0.05);
    } catch {
      // A failed burst never stops the game.
    }
  }

  return {
    resume,
    setMuted(value) { muted = value; },
    isMuted() { return muted; },
    /** A pearl's bright two-note chime. */
    pearl() {
      tone(880, 880, 0.1, 'sine', 0.5);
      tone(1318, 1318, 0.16, 'sine', 0.4, 0.07);
    },
    /** An air bubble's soft pop. */
    bubble() {
      tone(320, 640, 0.12, 'sine', 0.35);
    },
    /** A hit: a low thud and a burst of noise. */
    hit() {
      tone(110, 45, 0.28, 'square', 0.5);
      noise(0.22, 0.5, 900);
    },
    /** The shield giving way: a metallic ping. */
    shieldBreak() {
      tone(1500, 900, 0.12, 'triangle', 0.4);
      noise(0.1, 0.3, 3000);
    },
    /** The low-oxygen alarm: two short beeps. */
    alarm() {
      tone(660, 660, 0.09, 'square', 0.22);
      tone(660, 660, 0.09, 'square', 0.22, 0.14);
    },
    /** A wave cleared: a rising arpeggio. */
    waveClear() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.16, 'sine', 0.4, i * 0.09));
    },
    /** An upgrade picked: a warm chime. */
    upgrade() {
      tone(784, 784, 0.12, 'sine', 0.4);
      tone(1046, 1046, 0.2, 'sine', 0.35, 0.08);
    },
    /** Game over: three descending notes. */
    gameOver() {
      [392, 311, 233].forEach((f, i) => tone(f, f, 0.3, 'triangle', 0.4, i * 0.22));
    },
    /** A UI tick for menus and buttons. */
    click() {
      tone(1200, 1200, 0.05, 'sine', 0.25);
    },
    /** The dive begins: a rising swell. */
    start() {
      tone(330, 660, 0.35, 'sine', 0.35);
      tone(495, 990, 0.35, 'sine', 0.2, 0.1);
    },
  };
}
