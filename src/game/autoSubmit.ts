import { correctAnswerOf } from '../domain/question.ts';
import { isInRange } from '../domain/range.ts';
import type { Answer, Difficulty, Question } from '../domain/types.ts';

/**
 * 入力の途中で自動的に判定してよい回答を返す。判定しないなら null。SPEC §3.2
 *
 * - 答えを出す・穴埋め: 正答と同じ桁数まで入力したら、その数で判定する
 *   （正答より短い数で答えたいときは決定キーを使う）
 * - 逆算: 両方の欄が埋まり、範囲内の正しい組になったときだけ判定する
 *   （積は合っても範囲外の組や、間違った組は決定キーで判定する）
 */
export function autoSubmitAnswer(question: Question, difficulty: Difficulty, slots: readonly [string, string]): Answer | null {
  if (question.kind === 'factor') {
    const [left, right] = slots;
    if (left === '' || right === '') return null;
    const x = Number(left);
    const y = Number(right);
    return x * y === question.product && isInRange(difficulty, x, y) ? [x, y] : null;
  }
  const correct = correctAnswerOf(question, difficulty);
  if (correct.kind !== 'number' || slots[0] === '') return null;
  return slots[0].length === String(correct.value).length ? Number(slots[0]) : null;
}

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
