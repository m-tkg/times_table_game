import { factorPairsInRange, isInRange, pairsInRange, productsInRange } from './range.ts';
import type { Answer, Difficulty, FormatSetting, Pair, Question, QuestionFormat, Rng } from './types.ts';

const FORMATS: readonly QuestionFormat[] = ['product', 'blank', 'factor'];

/** 形式設定（ミックスを含む）から 1 問ぶんの形式を決める */
export function resolveFormat(format: FormatSetting, rng: Rng): QuestionFormat {
  return format === 'mix' ? rng.pick(FORMATS) : format;
}

/** 因数の組から問題を作る */
export function questionFromPair(format: 'product' | 'blank', [a, b]: Pair, rng: Rng): Question {
  if (format === 'product') return { kind: 'product', a, b };
  return { kind: 'blank', a, b, blank: rng.next() < 0.5 ? 'left' : 'right' };
}

/** 難易度の範囲から 1 問作る。SPEC §3.1 */
export function generateQuestion(format: FormatSetting, difficulty: Difficulty, rng: Rng): Question {
  const resolved = resolveFormat(format, rng);
  if (resolved === 'factor') {
    // 積を一様に選ぶ。組の多い積ほど選ばれやすくなる偏りを避けつつ、組が 1 つの数だけにもならない
    return { kind: 'factor', product: rng.pick(productsInRange(difficulty)) };
  }
  return questionFromPair(resolved, rng.pick(pairsInRange(difficulty)), rng);
}

export interface JudgeResult {
  correct: boolean;
  /** 逆算で、積は合っているが範囲外の組を答えたとき true */
  outOfRange: boolean;
}

/** 正誤判定。SPEC §3.1「逆算の正解条件」 */
export function judge(question: Question, answer: Answer, difficulty: Difficulty): JudgeResult {
  switch (question.kind) {
    case 'product':
      return { correct: typeof answer === 'number' && answer === question.a * question.b, outOfRange: false };
    case 'blank': {
      const hidden = question.blank === 'left' ? question.a : question.b;
      return { correct: typeof answer === 'number' && answer === hidden, outOfRange: false };
    }
    case 'factor': {
      if (typeof answer === 'number') return { correct: false, outOfRange: false };
      const [x, y] = answer;
      if (x * y !== question.product) return { correct: false, outOfRange: false };
      const inRange = isInRange(difficulty, x, y);
      return { correct: inRange, outOfRange: !inRange };
    }
  }
}

export type CorrectAnswer = { kind: 'number'; value: number } | { kind: 'pairs'; pairs: Pair[] };

/** 正答（不正解時の表示用）。逆算は範囲内の組をすべて返す */
export function correctAnswerOf(question: Question, difficulty: Difficulty): CorrectAnswer {
  switch (question.kind) {
    case 'product':
      return { kind: 'number', value: question.a * question.b };
    case 'blank':
      return { kind: 'number', value: question.blank === 'left' ? question.a : question.b };
    case 'factor':
      return { kind: 'pairs', pairs: factorPairsInRange(difficulty, question.product) };
  }
}

/** 問題の表示用テキスト（? は空欄） */
export function questionText(question: Question): string {
  switch (question.kind) {
    case 'product':
      return `${question.a} × ${question.b} = ?`;
    case 'blank':
      return question.blank === 'left'
        ? `? × ${question.b} = ${question.a * question.b}`
        : `${question.a} × ? = ${question.a * question.b}`;
    case 'factor':
      return `${question.product} = ? × ?`;
  }
}

/** 正答をテキストにする（例: "56"、"3×8, 4×6"） */
export function correctAnswerText(answer: CorrectAnswer): string {
  if (answer.kind === 'number') return String(answer.value);
  return answer.pairs.map(([a, b]) => `${a}×${b}`).join(', ');
}

/** 回答をテキストにする */
export function answerText(answer: Answer | null): string {
  if (answer === null) return '時間切れ';
  if (typeof answer === 'number') return String(answer);
  return `${answer[0]}×${answer[1]}`;
}

/** 問題の答えに含まれる因数の組（ヒートマップ・苦手度の集計用）。逆算は対象外（SPEC §13-6） */
export function pairOfQuestion(question: Question): Pair | null {
  return question.kind === 'factor' ? null : [question.a, question.b];
}
