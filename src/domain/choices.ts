import { factorPairsInRange, isInRange, pairsInRange } from './range.ts';
import type { Answer, Difficulty, Pair, Question, Rng } from './types.ts';

const CHOICE_COUNT = 4;

/**
 * 4 択の選択肢を作る。誤答は「ありがちなミス」を模す。SPEC §3.2
 * 正解はちょうど 1 つ、重複なし、正の整数のみ。
 */
export function generateChoices(question: Question, difficulty: Difficulty, rng: Rng): Answer[] {
  switch (question.kind) {
    case 'product':
      return productChoices(question.a, question.b, difficulty, rng);
    case 'blank':
      return blankChoices(question, difficulty, rng);
    case 'factor':
      return factorChoices(question.product, difficulty, rng);
  }
}

/** 優先度つき候補から、足りない分を予備候補で埋めつつ 3 つ選ぶ */
function pickDistractors<T>(primary: T[], fallback: T[], rng: Rng, keyOf: (v: T) => string, exclude: Set<string>): T[] {
  const chosen: T[] = [];
  const used = new Set(exclude);
  for (const pool of [rng.shuffle(primary), fallback]) {
    for (const candidate of pool) {
      if (chosen.length >= CHOICE_COUNT - 1) return chosen;
      const key = keyOf(candidate);
      if (used.has(key)) continue;
      used.add(key);
      chosen.push(candidate);
    }
  }
  if (chosen.length < CHOICE_COUNT - 1) throw new Error('選択肢を 4 つ作れませんでした');
  return chosen;
}

function productChoices(a: number, b: number, difficulty: Difficulty, rng: Rng): number[] {
  const answer = a * b;
  // 隣の段・隣の数の答え、一の位違い
  const primary = [a * (b - 1), a * (b + 1), (a - 1) * b, (a + 1) * b, answer - 2, answer + 2, answer - 1, answer + 1];
  // 上級以上は繰り上がりミス
  if (difficulty !== 'standard') primary.push(answer - 10, answer + 10);
  const fallback = [3, 4, 5, 6, 7, 8, 9, 10].flatMap((d) => [answer - d, answer + d]);
  const valid = (n: number) => n > 0 && n !== answer;
  const wrong = pickDistractors(primary.filter(valid), fallback.filter(valid), rng, String, new Set([String(answer)]));
  return rng.shuffle([answer, ...wrong]);
}

function blankChoices(question: Extract<Question, { kind: 'blank' }>, difficulty: Difficulty, rng: Rng): number[] {
  const { a, b, blank } = question;
  const hidden = blank === 'left' ? a : b;
  const other = blank === 'left' ? b : a;
  // 空欄に入る数として範囲内に収まる近い値を優先する
  const inRange = (n: number) => (blank === 'left' ? isInRange(difficulty, n, other) : isInRange(difficulty, other, n));
  const near = [hidden - 1, hidden + 1, hidden - 2, hidden + 2, hidden - 3, hidden + 3];
  const valid = (n: number) => n > 0 && n !== hidden;
  const primary = near.filter((n) => valid(n) && inRange(n) && Math.abs(n - hidden) <= 2);
  const fallback = near.filter(valid).sort((x, y) => Math.abs(x - hidden) - Math.abs(y - hidden) || (inRange(y) ? 1 : 0) - (inRange(x) ? 1 : 0));
  const wrong = pickDistractors(primary, fallback, rng, String, new Set([String(hidden)]));
  return rng.shuffle([hidden, ...wrong]);
}

const unorderedKey = ([x, y]: Pair) => (x <= y ? `${x}x${y}` : `${y}x${x}`);

function factorChoices(product: number, difficulty: Difficulty, rng: Rng): Pair[] {
  const correctPairs = factorPairsInRange(difficulty, product);
  const answer = rng.pick(correctPairs);
  const [x, y] = answer;
  const notCorrect = (p: Pair) => isInRange(difficulty, p[0], p[1]) && p[0] * p[1] !== product;
  // 正解の組を少しずらした組（積が近く、見た目も似ている）
  const primary: Pair[] = (
    [
      [x, y - 1],
      [x, y + 1],
      [x - 1, y],
      [x + 1, y],
      [x - 1, y + 1],
      [x + 1, y - 1],
    ] as Pair[]
  ).filter(notCorrect);
  // 予備: 積が近い範囲内の組
  const fallback = pairsInRange(difficulty)
    .filter(notCorrect)
    .sort((p, q) => Math.abs(p[0] * p[1] - product) - Math.abs(q[0] * q[1] - product));
  // 正解と同じ数の組（順序違い）や他の正解の組は除外する
  const exclude = new Set(correctPairs.map(unorderedKey));
  const wrong = pickDistractors(primary, fallback, rng, unorderedKey, exclude);
  return rng.shuffle([answer, ...wrong]);
}
