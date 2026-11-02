import { describe, expect, it } from 'vitest';
import { compareResults, nextSurvivalLimit, scoreOf, survivalInitialLimit, type ScoreSummary } from './score.ts';

const summary = (overrides: Partial<ScoreSummary>): ScoreSummary => ({
  correctCount: 0,
  answeredCount: 0,
  totalMs: 0,
  ...overrides,
});

describe('scoreOf', () => {
  it('タイムアタックは合計時間、他は正答数', () => {
    const s = summary({ correctCount: 18, answeredCount: 20, totalMs: 45_000 });
    expect(scoreOf('timeAttack', s)).toBe(45_000);
    expect(scoreOf('timed60', s)).toBe(18);
    expect(scoreOf('survival', s)).toBe(18);
  });
});

describe('compareResults', () => {
  it('タイムアタックは時間が短い方が上位', () => {
    const fast = summary({ totalMs: 30_000 });
    const slow = summary({ totalMs: 40_000 });
    expect(compareResults('timeAttack', fast, slow)).toBeLessThan(0);
    expect(compareResults('timeAttack', slow, fast)).toBeGreaterThan(0);
  });

  it('60秒チャレンジは正答数が多い方が上位、同点なら正答率が高い方', () => {
    const many = summary({ correctCount: 30, answeredCount: 35 });
    const few = summary({ correctCount: 25, answeredCount: 25 });
    expect(compareResults('timed60', many, few)).toBeLessThan(0);
    const accurate = summary({ correctCount: 30, answeredCount: 30 });
    expect(compareResults('timed60', accurate, many)).toBeLessThan(0);
  });

  it('サバイバルは正答数が多い方が上位', () => {
    expect(compareResults('survival', summary({ correctCount: 12 }), summary({ correctCount: 8 }))).toBeLessThan(0);
  });

  it('同じ成績なら 0', () => {
    const s = summary({ correctCount: 10, answeredCount: 12, totalMs: 1000 });
    expect(compareResults('timed60', s, { ...s })).toBe(0);
  });
});

describe('サバイバルの制限時間', () => {
  it('初期値は 標準 6 秒 / 上級 10 秒 / 超上級 20 秒', () => {
    expect(survivalInitialLimit('standard')).toBe(6000);
    expect(survivalInitialLimit('advanced')).toBe(10_000);
    expect(survivalInitialLimit('expert')).toBe(20_000);
  });

  it('5 問連続正解ごとに 0.5 秒短くなる', () => {
    expect(nextSurvivalLimit('standard', 6000, 4)).toBe(6000);
    expect(nextSurvivalLimit('standard', 6000, 5)).toBe(5500);
    expect(nextSurvivalLimit('standard', 5500, 6)).toBe(5500);
    expect(nextSurvivalLimit('standard', 5500, 10)).toBe(5000);
  });

  it('最短を下回らない（標準 2 秒 / 上級 4 秒 / 超上級 8 秒）', () => {
    expect(nextSurvivalLimit('standard', 2000, 5)).toBe(2000);
    expect(nextSurvivalLimit('advanced', 4000, 5)).toBe(4000);
    expect(nextSurvivalLimit('expert', 8200, 5)).toBe(8000);
  });

  it('連続正解数 0（ミス直後）では変わらない', () => {
    expect(nextSurvivalLimit('standard', 5000, 0)).toBe(5000);
  });
});
