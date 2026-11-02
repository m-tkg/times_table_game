import { describe, expect, it } from 'vitest';
import { addDays, compactLog, emptyCellStats, localDateKey, streakDays, type CellStatsMap } from './stats.ts';
import type { AnswerRecord } from './records.ts';

const record = (overrides: Partial<AnswerRecord> = {}): AnswerRecord => ({
  at: Date.UTC(2026, 10, 2, 3),
  playId: 'p1',
  mode: 'normal',
  difficulty: 'standard',
  method: 'input',
  question: { kind: 'product', a: 7, b: 8 },
  answer: 56,
  correct: true,
  responseMs: 2000,
  ...overrides,
});

describe('localDateKey / addDays', () => {
  it('ローカル日付を YYYY-MM-DD にする', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it('日付キーに日数を足す（月またぎ・年またぎ）', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('streakDays', () => {
  it('今日まで連続した日数を数える', () => {
    expect(streakDays(['2026-10-31', '2026-11-01', '2026-11-02'], '2026-11-02')).toBe(3);
  });

  it('今日まだ遊んでいなければ、昨日までの連続を数える', () => {
    expect(streakDays(['2026-10-31', '2026-11-01'], '2026-11-02')).toBe(2);
  });

  it('昨日も今日も遊んでいなければ 0', () => {
    expect(streakDays(['2026-10-30'], '2026-11-02')).toBe(0);
  });

  it('途中で途切れたら、そこまでで止める', () => {
    expect(streakDays(['2026-10-28', '2026-10-29', '2026-11-01', '2026-11-02'], '2026-11-02')).toBe(2);
  });
});

describe('compactLog', () => {
  it('上限以下なら何もしない', () => {
    const records = [record(), record()];
    const result = compactLog(records, emptyCellStats(), 5);
    expect(result.records).toBe(records);
    expect(result.cellStats).toEqual(emptyCellStats());
  });

  it('上限を超えた古い記録を集計値に畳み、新しい記録を残す', () => {
    const records = [
      record({ at: 1, correct: false, responseMs: 3000 }),
      record({ at: 2, correct: true, responseMs: 1000 }),
      record({ at: 3 }),
      record({ at: 4 }),
    ];
    const result = compactLog(records, emptyCellStats(), 2);
    expect(result.records.map((r) => r.at)).toEqual([3, 4]);
    expect(result.cellStats.standard['7x8']).toEqual({ count: 2, correct: 1, totalMs: 4000 });
  });

  it('既存の集計値に足し込む', () => {
    const existing: CellStatsMap = { ...emptyCellStats(), standard: { '7x8': { count: 5, correct: 5, totalMs: 5000 } } };
    const result = compactLog([record({ at: 1 }), record({ at: 2 })], existing, 1);
    expect(result.cellStats.standard['7x8']).toEqual({ count: 6, correct: 6, totalMs: 7000 });
  });

  it('逆算の記録は集計値に入れない（組み合わせに対応しないため）', () => {
    const records = [record({ at: 1, question: { kind: 'factor', product: 24 }, answer: [3, 8] }), record({ at: 2 })];
    const result = compactLog(records, emptyCellStats(), 1);
    expect(result.cellStats.standard).toEqual({});
  });

  it('上級の記録は 10〜19 側を先にしたキーで集計する', () => {
    const records = [record({ at: 1, difficulty: 'advanced', question: { kind: 'product', a: 7, b: 14 } }), record({ at: 2 })];
    const result = compactLog(records, emptyCellStats(), 1);
    expect(result.cellStats.advanced['14x7']).toEqual({ count: 1, correct: 1, totalMs: 2000 });
  });
});
