import type { CorrectAnswer } from '../domain/question.ts';
import type { AnswerRecord, NormalSettings } from '../domain/records.ts';
import type { Answer, AnswerMethod, Difficulty, Question } from '../domain/types.ts';

export type PracticeFormat = 'product' | 'blank' | 'mix';

/** ゲームの開始設定 */
export type GameConfig =
  | { mode: 'normal'; settings: NormalSettings }
  | { mode: 'daily'; date: string }
  /** keys は苦手度で選んだ組み合わせ（cellKey）を出題順に並べたもの */
  | { mode: 'weakness'; difficulty: Difficulty; method: AnswerMethod; keys: string[] }
  | {
      mode: 'practice';
      tables: number[];
      order: 'sequential' | 'random';
      /** null はエンドレス */
      count: number | null;
      format: PracticeFormat;
      method: AnswerMethod;
    };

export type GamePhase = 'playing' | 'feedback' | 'paused' | 'finished';

export interface Feedback {
  /** 表示を終える時刻（実時間） */
  until: number;
  /** 一時停止したときの残り表示時間 */
  remainingMs: number;
  /** 正解演出なら true、誤答・時間切れの正答表示なら false */
  correct: boolean;
  answer: Answer | null;
  outOfRange: boolean;
  timeout: boolean;
  correctAnswer: CorrectAnswer;
}

/** 正誤の軽い演出用の合図。id が変わるたびに演出する */
export interface Flash {
  kind: 'correct' | 'wrong';
  id: number;
}

export interface GameState {
  config: GameConfig;
  playId: string;
  /** 通常・デイリーの設定。苦手克服・練習では表示用の近い値 */
  settings: NormalSettings;
  phase: GamePhase;
  pausedFrom: 'playing' | 'feedback' | null;

  question: Question;
  /** この問題の難易度（練習モードでは段によって変わる） */
  questionDifficulty: Difficulty;
  choices: Answer[] | null;
  /** 1 から始まる問題番号 */
  questionNumber: number;
  /** 問題を表示したときのゲーム時計 */
  questionStartMs: number;
  /** タイムアタック入力で、この問題を一度でも間違えたか（最初の誤答） */
  firstWrongAnswer: Answer | null;

  /** ゲーム時計（正答表示中・一時停止中は止まる） */
  clockElapsedMs: number;
  clockRunningSince: number | null;

  penaltyMs: number;
  correctCount: number;
  answeredCount: number;
  lives: number;
  streak: number;
  maxStreak: number;
  survivalLimitMs: number;

  feedback: Feedback | null;
  flash: Flash | null;
  records: AnswerRecord[];
  wrongRecords: AnswerRecord[];
  rngState: number;
  aborted: boolean;
}

export type GameAction =
  | { type: 'answer'; answer: Answer; now: number; at: number }
  | { type: 'tick'; now: number; at: number }
  | { type: 'pause'; now: number }
  | { type: 'resume'; now: number }
  | { type: 'quit'; now: number };
