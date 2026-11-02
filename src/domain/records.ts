import type { Answer, AnswerMethod, Difficulty, FormatSetting, Question, Rule } from './types.ts';

/** プレイの種類。記録対象は normal と daily だけ（SPEC §4） */
export type PlayMode = 'normal' | 'daily' | 'weakness' | 'practice';

/** 1 問ごとの記録。SPEC §7.1 */
export interface AnswerRecord {
  /** 回答した日時（エポックミリ秒） */
  at: number;
  playId: string;
  mode: PlayMode;
  difficulty: Difficulty;
  method: AnswerMethod;
  question: Question;
  /** 時間切れは null */
  answer: Answer | null;
  correct: boolean;
  responseMs: number;
}

/** 通常モードの設定（ベスト記録の単位）。SPEC §3 */
export interface NormalSettings {
  rule: Rule;
  format: FormatSetting;
  method: AnswerMethod;
  difficulty: Difficulty;
}

/** プレイ単位の記録（完了したもののみ）。SPEC §7.3 */
export interface PlayRecord {
  id: string;
  /** 終了日時（エポックミリ秒） */
  at: number;
  mode: 'normal' | 'daily';
  settings: NormalSettings;
  /** デイリーチャレンジの日付（YYYY-MM-DD） */
  dailyDate?: string;
  correctCount: number;
  answeredCount: number;
  totalMs: number;
  score: number;
}

/** ベスト記録の単位となる設定のキー */
export function settingsKey(s: NormalSettings): string {
  return `${s.rule}/${s.format}/${s.method}/${s.difficulty}`;
}

/** デイリーチャレンジの固定設定。SPEC §5 */
export const DAILY_SETTINGS: NormalSettings = {
  rule: 'timeAttack',
  format: 'mix',
  method: 'input',
  difficulty: 'standard',
};

/** 初回起動時の既定設定。SPEC §13-8 */
export const DEFAULT_SETTINGS: NormalSettings = {
  rule: 'timeAttack',
  format: 'product',
  method: 'input',
  difficulty: 'standard',
};
