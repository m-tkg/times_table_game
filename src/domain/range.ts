import type { Difficulty, Pair } from './types.ts';

const SMALL: readonly [number, number] = [1, 9];
const BIG: readonly [number, number] = [10, 19];

const within = (n: number, [min, max]: readonly [number, number]) => Number.isInteger(n) && n >= min && n <= max;

/** 因数の組 (a, b) が難易度の範囲内か。SPEC §2 */
export function isInRange(difficulty: Difficulty, a: number, b: number): boolean {
  switch (difficulty) {
    case 'standard':
      return within(a, SMALL) && within(b, SMALL);
    case 'advanced':
      return (within(a, BIG) && within(b, SMALL)) || (within(a, SMALL) && within(b, BIG));
    case 'expert':
      return within(a, BIG) && within(b, BIG);
  }
}

const pairCache = new Map<Difficulty, Pair[]>();

/** 範囲内の順序付きの組をすべて返す（a, b の昇順） */
export function pairsInRange(difficulty: Difficulty): Pair[] {
  const cached = pairCache.get(difficulty);
  if (cached) return cached;
  const pairs: Pair[] = [];
  for (let a = 1; a <= 19; a++) {
    for (let b = 1; b <= 19; b++) {
      if (isInRange(difficulty, a, b)) pairs.push([a, b]);
    }
  }
  pairCache.set(difficulty, pairs);
  return pairs;
}

/** 積が product になる範囲内の組（a の昇順） */
export function factorPairsInRange(difficulty: Difficulty, product: number): Pair[] {
  return pairsInRange(difficulty).filter(([a, b]) => a * b === product);
}

/** 範囲内で作れる積（重複なし、昇順） */
export function productsInRange(difficulty: Difficulty): number[] {
  return [...new Set(pairsInRange(difficulty).map(([a, b]) => a * b))].sort((x, y) => x - y);
}

/**
 * ヒートマップ・苦手度の集計に使う組み合わせのキー。
 * 標準・超上級は順序を区別する（SPEC §13-7）。
 * 上級は表が 10〜19 × 1〜9 なので、10〜19 側を先にそろえる。
 */
export function cellKey(difficulty: Difficulty, a: number, b: number): string {
  if (difficulty === 'advanced' && a < b) return `${b}x${a}`;
  return `${a}x${b}`;
}

/** cellKey を因数の組に戻す */
export function parseCellKey(key: string): Pair {
  const [a, b] = key.split('x').map(Number);
  return [a ?? 0, b ?? 0];
}

/** ヒートマップの行・列。SPEC §6.5 */
export function heatmapAxes(difficulty: Difficulty): { rows: number[]; cols: number[] } {
  const range = (min: number, max: number) => Array.from({ length: max - min + 1 }, (_, i) => min + i);
  switch (difficulty) {
    case 'standard':
      return { rows: range(1, 9), cols: range(1, 9) };
    case 'advanced':
      return { rows: range(10, 19), cols: range(1, 9) };
    case 'expert':
      return { rows: range(10, 19), cols: range(10, 19) };
  }
}
