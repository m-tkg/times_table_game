/** 難易度（= 出題範囲）。SPEC §2 */
export type Difficulty = 'standard' | 'advanced' | 'expert';

/** 1 問ごとの問題形式。SPEC §3.1 */
export type QuestionFormat = 'product' | 'blank' | 'factor';

/** 設定で選べる問題形式（ミックスを含む） */
export type FormatSetting = QuestionFormat | 'mix';

/** 回答方法。SPEC §3.2 */
export type AnswerMethod = 'input' | 'choice';

/** ルール。SPEC §3.3 */
export type Rule = 'timeAttack' | 'timed60' | 'survival';

export type BlankSide = 'left' | 'right';

export type Question =
  | { kind: 'product'; a: number; b: number }
  | { kind: 'blank'; a: number; b: number; blank: BlankSide }
  | { kind: 'factor'; product: number };

/** 逆算の回答・選択肢に使う因数の組 */
export type Pair = readonly [number, number];

/** 利用者の回答。product/blank は数、factor は組 */
export type Answer = number | Pair;

export interface Rng {
  /** [0, 1) の一様乱数 */
  next(): number;
  /** [min, max] の整数 */
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  /** 現在の内部状態（保存して再開できる） */
  readonly state: number;
}
