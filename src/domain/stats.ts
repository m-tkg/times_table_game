import { cellKey } from './range.ts';
import { pairOfQuestion } from './question.ts';
import type { AnswerRecord } from './records.ts';
import type { Difficulty } from './types.ts';

export interface CellStats {
  count: number;
  correct: number;
  totalMs: number;
}

export type CellStatsMap = Record<Difficulty, Record<string, CellStats>>;

export const MAX_RAW_RECORDS = 5000;

export function emptyCellStats(): CellStatsMap {
  return { standard: {}, advanced: {}, expert: {} };
}

/** 記録のセルキー。逆算は組み合わせに対応しないので null（SPEC §13-6） */
export function recordCellKey(record: AnswerRecord): string | null {
  const pair = pairOfQuestion(record.question);
  return pair ? cellKey(record.difficulty, pair[0], pair[1]) : null;
}

function addRecord(map: CellStatsMap, record: AnswerRecord): void {
  const key = recordCellKey(record);
  if (!key) return;
  const table = map[record.difficulty];
  const cell = table[key] ?? { count: 0, correct: 0, totalMs: 0 };
  table[key] = {
    count: cell.count + 1,
    correct: cell.correct + (record.correct ? 1 : 0),
    totalMs: cell.totalMs + record.responseMs,
  };
}

function cloneCellStats(map: CellStatsMap): CellStatsMap {
  return {
    standard: { ...map.standard },
    advanced: { ...map.advanced },
    expert: { ...map.expert },
  };
}

/**
 * 生ログを上限件数に収め、あふれた古い記録を集計値に畳む。SPEC §7.2
 * records は古い順に並んでいること。
 */
export function compactLog(
  records: AnswerRecord[],
  cellStats: CellStatsMap,
  limit: number = MAX_RAW_RECORDS,
): { records: AnswerRecord[]; cellStats: CellStatsMap } {
  if (records.length <= limit) return { records, cellStats };
  const overflow = records.slice(0, records.length - limit);
  const next = cloneCellStats(cellStats);
  for (const r of overflow) addRecord(next, r);
  return { records: records.slice(records.length - limit), cellStats: next };
}

/** 集計値と生ログを合わせたセルごとの成績（ヒートマップ用） */
export function combinedCellStats(records: readonly AnswerRecord[], cellStats: CellStatsMap): CellStatsMap {
  const map = cloneCellStats(cellStats);
  for (const r of records) addRecord(map, r);
  return map;
}

/** ローカル日付の YYYY-MM-DD */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 日付キーに日数を足す */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return localDateKey(new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
}

/**
 * 連続プレイ日数。SPEC §8
 * 今日遊んでいれば今日から、まだなら昨日から遡って数える。
 */
export function streakDays(playedDays: Iterable<string>, today: string): number {
  const days = new Set(playedDays);
  let cursor = days.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (days.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/** 九九表（1〜size の段）のマスごとの間違えた回数。キーは `${行}x${列}` */
export function chartMisses(stats: CellStatsMap, size: 9 | 19): { misses: Map<string, number>; max: number } {
  const misses = new Map<string, number>();
  let max = 0;
  for (let r = 1; r <= size; r++) {
    for (let c = 1; c <= size; c++) {
      const difficulty: Difficulty = r <= 9 && c <= 9 ? 'standard' : r >= 10 && c >= 10 ? 'expert' : 'advanced';
      const cell = stats[difficulty][cellKey(difficulty, r, c)];
      const n = cell ? cell.count - cell.correct : 0;
      misses.set(`${r}x${c}`, n);
      max = Math.max(max, n);
    }
  }
  return { misses, max };
}
