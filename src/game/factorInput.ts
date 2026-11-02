import { isInRange } from '../domain/range.ts';
import type { Difficulty } from '../domain/types.ts';

/**
 * 逆算で、左の欄をこれ以上長くできない（範囲内の因数にならない）なら true。
 * 右の欄へ自動で移るために使う。上級の「1」のように 1 と 10〜19 のどちらもありうるときは待つ。
 */
export function shouldMoveToRight(difficulty: Difficulty, left: string): boolean {
  if (left === '') return false;
  const canExtend = Array.from({ length: 19 }, (_, i) => i + 1).some(
    (n) => String(n).length > left.length && String(n).startsWith(left) && isFactorInRange(difficulty, n),
  );
  return !canExtend;
}

/** n が範囲内のどれかの組の因数になりうるか */
function isFactorInRange(difficulty: Difficulty, n: number): boolean {
  return Array.from({ length: 19 }, (_, i) => i + 1).some((m) => isInRange(difficulty, n, m));
}
