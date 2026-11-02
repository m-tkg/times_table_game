import type { Difficulty, Rule } from './types.ts';

export interface ScoreSummary {
  correctCount: number;
  /** 回答した問題数（タイムアタック入力のやり直しは 1 問として数える） */
  answeredCount: number;
  /** ペナルティ込みの合計時間（ミリ秒） */
  totalMs: number;
}

/** ルールごとのスコア。SPEC §3.3 */
export function scoreOf(rule: Rule, summary: ScoreSummary): number {
  return rule === 'timeAttack' ? summary.totalMs : summary.correctCount;
}

export function accuracyOf(summary: Pick<ScoreSummary, 'correctCount' | 'answeredCount'>): number {
  return summary.answeredCount === 0 ? 0 : summary.correctCount / summary.answeredCount;
}

/** a が上位なら負、b が上位なら正、同じなら 0 */
export function compareResults(rule: Rule, a: ScoreSummary, b: ScoreSummary): number {
  switch (rule) {
    case 'timeAttack':
      return a.totalMs - b.totalMs;
    case 'timed60':
      return b.correctCount - a.correctCount || accuracyOf(b) - accuracyOf(a);
    case 'survival':
      return b.correctCount - a.correctCount;
  }
}

const SURVIVAL_LIMITS: Record<Difficulty, { initial: number; min: number }> = {
  standard: { initial: 6000, min: 2000 },
  advanced: { initial: 10_000, min: 4000 },
  expert: { initial: 20_000, min: 8000 },
};

const SURVIVAL_STEP_MS = 500;
const SURVIVAL_STREAK_STEP = 5;

export function survivalInitialLimit(difficulty: Difficulty): number {
  return SURVIVAL_LIMITS[difficulty].initial;
}

/**
 * 正解した直後の制限時間。streak は正解後の連続正解数。
 * 5 問連続正解ごとに 0.5 秒短くし、最短を下回らない。
 */
export function nextSurvivalLimit(difficulty: Difficulty, currentMs: number, streak: number): number {
  if (streak === 0 || streak % SURVIVAL_STREAK_STEP !== 0) return currentMs;
  return Math.max(SURVIVAL_LIMITS[difficulty].min, currentMs - SURVIVAL_STEP_MS);
}

export const TIME_ATTACK_QUESTIONS = 20;
export const TIME_ATTACK_PENALTY_MS = 3000;
export const TIMED60_MS = 60_000;
export const SURVIVAL_LIVES = 3;
