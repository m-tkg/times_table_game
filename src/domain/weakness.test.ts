import { describe, expect, it } from 'vitest';
import { createRng } from './rng.ts';
import { pickWeakKeys, weaknessScores, type CellObservation } from './weakness.ts';

const obs = (key: string, correct: boolean, responseMs = 2000): CellObservation => ({ key, correct, responseMs });

/** 3 つのセルを、同じ回数・同じ速さで観測した記録を作る */
const repeat = (key: string, pattern: boolean[], ms = 2000) => pattern.map((c) => obs(key, c, ms));

describe('weaknessScores', () => {
  const keys = ['7x8', '6x7', '3x3', '9x9'];

  it('誤答の多い組み合わせほど苦手度が高い', () => {
    const records = [...repeat('7x8', [false, false, true, false]), ...repeat('6x7', [true, true, true, true])];
    const scores = weaknessScores(records, keys);
    expect(scores.get('7x8')!).toBeGreaterThan(scores.get('6x7')!);
  });

  it('新しい記録ほど重い: 昔間違えて最近正解したセルは、最近間違えたセルより苦手度が低い', () => {
    const records = [
      ...repeat('7x8', [false, false, false, true, true, true]),
      ...repeat('6x7', [true, true, true, false, false, false]),
    ];
    const scores = weaknessScores(records, keys);
    expect(scores.get('7x8')!).toBeLessThan(scores.get('6x7')!);
  });

  it('正答率が同じなら、回答が遅い方が苦手度が高い', () => {
    const records = [...repeat('7x8', [true, true, true, true], 6000), ...repeat('6x7', [true, true, true, true], 1500)];
    const scores = weaknessScores(records, keys);
    expect(scores.get('7x8')!).toBeGreaterThan(scores.get('6x7')!);
  });

  it('データのないセルは中程度: 全問正解かつ速いセルより高く、全問不正解のセルより低い', () => {
    const records = [...repeat('7x8', [false, false, false, false]), ...repeat('6x7', [true, true, true, true], 1500)];
    const scores = weaknessScores(records, keys);
    const unseen = scores.get('3x3')!;
    expect(unseen).toBeGreaterThan(scores.get('6x7')!);
    expect(unseen).toBeLessThan(scores.get('7x8')!);
  });

  it('すべてのキーにスコアがあり、0〜1 に収まる', () => {
    const scores = weaknessScores(repeat('7x8', [false]), keys);
    expect([...scores.keys()].sort()).toEqual([...keys].sort());
    for (const v of scores.values()) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('対象外のキーの記録は無視する', () => {
    const scores = weaknessScores(repeat('12x3', [false, false]), keys);
    expect(scores.has('12x3')).toBe(false);
  });
});

describe('pickWeakKeys', () => {
  it('指定した数だけ選ぶ', () => {
    const scores = new Map([
      ['a', 0.9],
      ['b', 0.1],
      ['c', 0.5],
    ]);
    expect(pickWeakKeys(scores, 20, createRng(1))).toHaveLength(20);
  });

  it('苦手度の高いキーほど多く選ばれる', () => {
    const scores = new Map([
      ['weak', 0.95],
      ['strong', 0.05],
      ['mid', 0.5],
    ]);
    const counts = new Map<string, number>();
    for (let seed = 0; seed < 20; seed++) {
      for (const k of pickWeakKeys(scores, 20, createRng(seed))) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    expect(counts.get('weak')!).toBeGreaterThan(counts.get('mid')!);
    expect(counts.get('mid')!).toBeGreaterThan(counts.get('strong') ?? 0);
  });

  it('同じキーが連続しない（キーが 2 つ以上あるとき）', () => {
    const scores = new Map([
      ['weak', 1],
      ['other', 0.01],
    ]);
    const picked = pickWeakKeys(scores, 20, createRng(3));
    for (let i = 1; i < picked.length; i++) expect(picked[i]).not.toBe(picked[i - 1]);
  });

  it('毎回まったく同じ並びにはならない', () => {
    const scores = new Map(Array.from({ length: 30 }, (_, i) => [`k${i}`, (i + 1) / 30] as const));
    const a = pickWeakKeys(scores, 20, createRng(1)).join(',');
    const b = pickWeakKeys(scores, 20, createRng(2)).join(',');
    expect(a).not.toBe(b);
  });
});
