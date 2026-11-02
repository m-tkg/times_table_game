import { describe, expect, it } from 'vitest';
import { createRng } from './rng.ts';
import { factorPairsInRange, isInRange } from './range.ts';
import { correctAnswerOf, generateQuestion, judge } from './question.ts';
import type { Question } from './types.ts';

describe('generateQuestion', () => {
  const difficulties = ['standard', 'advanced', 'expert'] as const;

  it.each(difficulties)('%s: 答えを出す問題の因数は範囲内', (difficulty) => {
    const rng = createRng(1);
    for (let i = 0; i < 300; i++) {
      const q = generateQuestion('product', difficulty, rng);
      expect(q.kind).toBe('product');
      if (q.kind !== 'product') return;
      expect(isInRange(difficulty, q.a, q.b)).toBe(true);
    }
  });

  it('上級では 10〜19 が左右どちらにも来る', () => {
    const rng = createRng(2);
    let bigLeft = 0;
    let bigRight = 0;
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion('product', 'advanced', rng);
      if (q.kind !== 'product') continue;
      if (q.a >= 10) bigLeft++;
      else bigRight++;
    }
    expect(bigLeft).toBeGreaterThan(0);
    expect(bigRight).toBeGreaterThan(0);
  });

  it('穴埋めの空欄は左右どちらにも来る', () => {
    const rng = createRng(3);
    const sides = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const q = generateQuestion('blank', 'standard', rng);
      if (q.kind === 'blank') sides.add(q.blank);
    }
    expect(sides).toEqual(new Set(['left', 'right']));
  });

  it.each(difficulties)('%s: 逆算の積は範囲内に組を持つ', (difficulty) => {
    const rng = createRng(4);
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion('factor', difficulty, rng);
      expect(q.kind).toBe('factor');
      if (q.kind !== 'factor') return;
      expect(factorPairsInRange(difficulty, q.product).length).toBeGreaterThan(0);
    }
  });

  it('逆算は組が複数ある数も出題する（平方数ばかりに偏らない）', () => {
    const rng = createRng(5);
    let multi = 0;
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion('factor', 'standard', rng);
      if (q.kind === 'factor' && factorPairsInRange('standard', q.product).length > 2) multi++;
    }
    expect(multi).toBeGreaterThan(20);
  });

  it('ミックスは 3 形式すべてを出す', () => {
    const rng = createRng(6);
    const kinds = new Set<string>();
    for (let i = 0; i < 100; i++) kinds.add(generateQuestion('mix', 'standard', rng).kind);
    expect(kinds).toEqual(new Set(['product', 'blank', 'factor']));
  });
});

describe('judge', () => {
  it('答えを出す: 積と一致すれば正解', () => {
    const q: Question = { kind: 'product', a: 7, b: 8 };
    expect(judge(q, 56, 'standard')).toEqual({ correct: true, outOfRange: false });
    expect(judge(q, 54, 'standard')).toEqual({ correct: false, outOfRange: false });
  });

  it('穴埋め: 隠れた側の数と一致すれば正解', () => {
    const left: Question = { kind: 'blank', a: 7, b: 8, blank: 'left' };
    const right: Question = { kind: 'blank', a: 7, b: 8, blank: 'right' };
    expect(judge(left, 7, 'standard').correct).toBe(true);
    expect(judge(left, 8, 'standard').correct).toBe(false);
    expect(judge(right, 8, 'standard').correct).toBe(true);
  });

  it('逆算: 範囲内の組なら順序違いも正解', () => {
    const q: Question = { kind: 'factor', product: 24 };
    expect(judge(q, [3, 8], 'standard').correct).toBe(true);
    expect(judge(q, [8, 3], 'standard').correct).toBe(true);
    expect(judge(q, [4, 6], 'standard').correct).toBe(true);
  });

  it('逆算: 積は合っていても範囲外なら不正解で outOfRange', () => {
    const q: Question = { kind: 'factor', product: 24 };
    expect(judge(q, [2, 12], 'standard')).toEqual({ correct: false, outOfRange: true });
    expect(judge(q, [1, 24], 'standard')).toEqual({ correct: false, outOfRange: true });
  });

  it('逆算: 上級で 56 = 7×8 は範囲外', () => {
    const q: Question = { kind: 'factor', product: 56 };
    expect(judge(q, [14, 4], 'advanced').correct).toBe(true);
    expect(judge(q, [7, 8], 'advanced')).toEqual({ correct: false, outOfRange: true });
  });

  it('逆算: 積が違えば不正解（outOfRange ではない）', () => {
    const q: Question = { kind: 'factor', product: 24 };
    expect(judge(q, [3, 7], 'standard')).toEqual({ correct: false, outOfRange: false });
  });

  it('形式に合わない回答は不正解', () => {
    expect(judge({ kind: 'product', a: 2, b: 3 }, [2, 3], 'standard').correct).toBe(false);
    expect(judge({ kind: 'factor', product: 6 }, 6, 'standard').correct).toBe(false);
  });
});

describe('correctAnswerOf', () => {
  it('答えを出す・穴埋めは数を返す', () => {
    expect(correctAnswerOf({ kind: 'product', a: 7, b: 8 }, 'standard')).toEqual({ kind: 'number', value: 56 });
    expect(correctAnswerOf({ kind: 'blank', a: 7, b: 8, blank: 'right' }, 'standard')).toEqual({ kind: 'number', value: 8 });
  });

  it('逆算は範囲内の組をすべて返す', () => {
    expect(correctAnswerOf({ kind: 'factor', product: 24 }, 'standard')).toEqual({
      kind: 'pairs',
      pairs: [
        [3, 8],
        [4, 6],
        [6, 4],
        [8, 3],
      ],
    });
  });
});
