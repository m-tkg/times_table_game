import { describe, expect, it } from 'vitest';
import { createRng, seedFromString } from './rng.ts';

describe('createRng', () => {
  it('同じシードなら同じ列を返す', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('異なるシードなら異なる列を返す', () => {
    const a = createRng(1);
    const b = createRng(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('next は [0, 1) に収まる', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int は両端を含む範囲の整数を返し、両端とも出る', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = rng.int(1, 9);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(9);
      seen.add(v);
    }
    expect(seen.size).toBe(9);
  });

  it('state から作り直すと続きの列を再現できる', () => {
    const a = createRng(99);
    a.next();
    a.next();
    const resumed = createRng(a.state);
    expect(resumed.next()).toBe(a.next());
  });

  it('shuffle は元の配列を変えずに同じ要素の並べ替えを返す', () => {
    const rng = createRng(5);
    const src = [1, 2, 3, 4, 5, 6];
    const out = rng.shuffle(src);
    expect(src).toEqual([1, 2, 3, 4, 5, 6]);
    expect([...out].sort()).toEqual(src);
  });
});

describe('seedFromString', () => {
  it('同じ文字列は同じシード、違う文字列は違うシードになる', () => {
    expect(seedFromString('2026-11-02')).toBe(seedFromString('2026-11-02'));
    expect(seedFromString('2026-11-02')).not.toBe(seedFromString('2026-11-03'));
  });
});
