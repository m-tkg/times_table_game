/**
 * 効果音（Web Audio API で合成。音声ファイルは使わない）と振動。SPEC §10
 */
export type SoundKind = 'correct' | 'wrong' | 'combo' | 'record';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(ac: AudioContext, freq: number, start: number, duration: number, type: OscillatorType, volume: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

const PATTERNS: Record<SoundKind, Array<[freq: number, offset: number, duration: number]>> = {
  correct: [
    [880, 0, 0.09],
    [1320, 0.06, 0.12],
  ],
  wrong: [
    [220, 0, 0.18],
    [196, 0.1, 0.2],
  ],
  combo: [
    [784, 0, 0.08],
    [988, 0.07, 0.08],
    [1319, 0.14, 0.16],
  ],
  record: [
    [523, 0, 0.12],
    [659, 0.1, 0.12],
    [784, 0.2, 0.12],
    [1047, 0.3, 0.3],
  ],
};

export function playSound(kind: SoundKind): void {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const type: OscillatorType = kind === 'wrong' ? 'square' : 'triangle';
  for (const [freq, offset, duration] of PATTERNS[kind]) tone(ac, freq, now + offset, duration, type, kind === 'wrong' ? 0.06 : 0.12);
}

export function vibrate(kind: 'correct' | 'wrong'): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(kind === 'wrong' ? [60, 40, 60] : 15);
}
