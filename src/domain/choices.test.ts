import { describe, expect, it } from 'vitest';
import { createRng } from './rng.ts';
import { generateChoices } from './choices.ts';
import { generateQuestion, judge } from './question.ts';
import type { Difficulty, Question } from './types.ts';

const difficulties: Difficulty[] = ['standard', 'advanced', 'expert'];

function assertValidChoices(q: Question, difficulty: Difficulty, seed: number) {
  const choices = generateChoices(q, difficulty, createRng(seed));
  expect(choices).toHaveLength(4);
  const correct = choices.filter((c) => judge(q, c, difficulty).correct);
  expect(correct).toHaveLength(1);
  const keys = choices.map((c) => (typeof c === 'number' ? String(c) : [...c].sort((x, y) => x - y).join('x')));
  expect(new Set(keys).size).toBe(4);
  for (const c of choices) {
    const nums = typeof c === 'number' ? [c] : [...c];
    for (const n of nums) {
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThan(0);
    }
  }
}

describe('generateChoices', () => {
  it.each(difficulties)('%s: どの形式でも 4 択・正解 1 つ・重複なし・正の整数', (difficulty) => {
    const rng = createRng(10);
    for (let i = 0; i < 300; i++) {
      const q = generateQuestion('mix', difficulty, rng);
      assertValidChoices(q, difficulty, i);
    }
  });

  it('答えを出す: 誤答はありがちなミス（隣の段・一の位違い）から作る', () => {
    const q: Question = { kind: 'product', a: 7, b: 8 };
    const plausible = new Set([49, 63, 48, 64, 54, 58, 55, 57, 46, 66]);
    for (let seed = 0; seed < 30; seed++) {
      const wrong = generateChoices(q, 'standard', createRng(seed)).filter((c) => c !== 56);
      for (const w of wrong) expect(plausible.has(w as number)).toBe(true);
    }
  });

  it('上級の答えを出す: 繰り上がりミス（±10）も誤答に使う', () => {
    const q: Question = { kind: 'product', a: 14, b: 7 };
    const seen = new Set<number>();
    for (let seed = 0; seed < 50; seed++) {
      for (const c of generateChoices(q, 'advanced', createRng(seed))) seen.add(c as number);
    }
    expect(seen.has(88) || seen.has(108)).toBe(true);
  });

  it('穴埋め: 選択肢は数で、正解の近くの値', () => {
    const q: Question = { kind: 'blank', a: 7, b: 8, blank: 'right' };
    for (let seed = 0; seed < 20; seed++) {
      const choices = generateChoices(q, 'standard', createRng(seed));
      for (const c of choices) {
        expect(typeof c).toBe('number');
        expect(Math.abs((c as number) - 8)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('逆算: 選択肢は組で、範囲内の組だけを使う', () => {
    const q: Question = { kind: 'factor', product: 24 };
    for (let seed = 0; seed < 20; seed++) {
      for (const c of generateChoices(q, 'standard', createRng(seed))) {
        expect(Array.isArray(c)).toBe(true);
        const [x, y] = c as readonly [number, number];
        expect(x).toBeGreaterThanOrEqual(1);
        expect(x).toBeLessThanOrEqual(9);
        expect(y).toBeGreaterThanOrEqual(1);
        expect(y).toBeLessThanOrEqual(9);
      }
    }
  });

  it('正解の位置は偏らない', () => {
    const q: Question = { kind: 'product', a: 6, b: 7 };
    const positions = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      positions.add(generateChoices(q, 'standard', createRng(seed)).indexOf(42));
    }
    expect(positions.size).toBe(4);
  });
});
