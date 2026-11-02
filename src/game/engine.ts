import { generateChoices } from '../domain/choices.ts';
import { correctAnswerOf, generateQuestion, judge, questionFromPair } from '../domain/question.ts';
import { parseCellKey } from '../domain/range.ts';
import { DAILY_SETTINGS, type AnswerRecord, type NormalSettings, type PlayMode } from '../domain/records.ts';
import { createRng, seedFromString } from '../domain/rng.ts';
import {
  nextSurvivalLimit,
  SURVIVAL_LIVES,
  survivalInitialLimit,
  TIME_ATTACK_PENALTY_MS,
  TIME_ATTACK_QUESTIONS,
  TIMED60_MS,
  type ScoreSummary,
} from '../domain/score.ts';
import type { Answer, Difficulty, Question, Rng } from '../domain/types.ts';
import type { GameAction, GameConfig, GameState } from './types.ts';

export const FEEDBACK_MS = 1500;

interface CreateOptions {
  seed: number;
  now: number;
  playId: string;
}

/** ゲームを開始する */
export function createGame(config: GameConfig, { seed, now, playId }: CreateOptions): GameState {
  const settings = settingsOf(config);
  const rng = createRng(config.mode === 'daily' ? seedFromString(config.date) : seed);
  const base: Omit<GameState, 'question' | 'questionDifficulty' | 'choices'> = {
    config,
    playId,
    settings,
    phase: 'playing',
    pausedFrom: null,
    questionNumber: 1,
    questionStartMs: 0,
    firstWrongAnswer: null,
    clockElapsedMs: 0,
    clockRunningSince: now,
    penaltyMs: 0,
    correctCount: 0,
    answeredCount: 0,
    lives: SURVIVAL_LIVES,
    streak: 0,
    maxStreak: 0,
    survivalLimitMs: survivalInitialLimit(settings.difficulty),
    feedback: null,
    flash: null,
    records: [],
    wrongRecords: [],
    rngState: rng.state,
    aborted: false,
  };
  return { ...base, ...buildQuestion(config, settings, 1, rng, null), rngState: rng.state };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'answer':
      return onAnswer(state, action.answer, action.now, action.at);
    case 'tick':
      return onTick(state, action.now, action.at);
    case 'pause':
      return onPause(state, action.now);
    case 'resume':
      return onResume(state, action.now);
    case 'quit':
      return onQuit(state, action.now);
  }
}

/** ゲーム時計（正答表示中・一時停止中は止まる） */
export function gameClockMs(state: GameState, now: number): number {
  return state.clockElapsedMs + (state.clockRunningSince === null ? 0 : now - state.clockRunningSince);
}

/** 60 秒チャレンジの残り時間。他のルールでは null */
export function timeRemainingMs(state: GameState, now: number): number | null {
  if (!isRule(state, 'timed60')) return null;
  return Math.max(0, TIMED60_MS - gameClockMs(state, now));
}

/** サバイバルの、この問題の残り時間。他のルールでは null */
export function questionRemainingMs(state: GameState, now: number): number | null {
  if (!isRule(state, 'survival')) return null;
  return Math.max(0, state.survivalLimitMs - (gameClockMs(state, now) - state.questionStartMs));
}

/** 総問題数。上限がなければ null */
export function totalQuestions(state: GameState): number | null {
  const { config } = state;
  switch (config.mode) {
    case 'daily':
      return TIME_ATTACK_QUESTIONS;
    case 'normal':
      return config.settings.rule === 'timeAttack' ? TIME_ATTACK_QUESTIONS : null;
    case 'weakness':
      return config.keys.length;
    case 'practice':
      return config.count;
  }
}

export function summaryOf(state: GameState): ScoreSummary {
  const clock = state.clockElapsedMs;
  const totalMs = isRule(state, 'timeAttack')
    ? clock + state.penaltyMs
    : isRule(state, 'timed60')
      ? Math.min(clock, TIMED60_MS)
      : clock;
  return { correctCount: state.correctCount, answeredCount: state.answeredCount, totalMs };
}

/** ベスト記録・プレイ記録に残すか（通常・デイリーで、最後まで遊んだもの） */
export function isRecordable(state: GameState): boolean {
  return state.phase === 'finished' && !state.aborted && (state.config.mode === 'normal' || state.config.mode === 'daily');
}

// ---- 内部 ----

function settingsOf(config: GameConfig): NormalSettings {
  switch (config.mode) {
    case 'normal':
      return config.settings;
    case 'daily':
      return DAILY_SETTINGS;
    case 'weakness':
      return { rule: 'timeAttack', format: 'mix', method: config.method, difficulty: config.difficulty };
    case 'practice':
      return {
        rule: 'timeAttack',
        format: config.format,
        method: config.method,
        difficulty: config.tables.some((t) => t >= 10) ? 'advanced' : 'standard',
      };
  }
}

/** 制限時間やルールが効くのは通常・デイリーだけ。苦手克服・練習は時間制限なし */
function isRule(state: GameState, rule: NormalSettings['rule']): boolean {
  const { mode } = state.config;
  return (mode === 'normal' || mode === 'daily') && state.settings.rule === rule;
}

function playModeOf(config: GameConfig): PlayMode {
  return config.mode;
}

function sameQuestion(a: Question, b: Question | null): boolean {
  return b !== null && JSON.stringify(a) === JSON.stringify(b);
}

function difficultyOfTable(table: number): Difficulty {
  return table >= 10 ? 'advanced' : 'standard';
}

function buildQuestion(
  config: GameConfig,
  settings: NormalSettings,
  questionNumber: number,
  rng: Rng,
  prev: Question | null,
): Pick<GameState, 'question' | 'questionDifficulty' | 'choices'> {
  let question: Question;
  let difficulty: Difficulty = settings.difficulty;

  switch (config.mode) {
    case 'normal':
    case 'daily': {
      question = generateQuestion(settings.format, difficulty, rng);
      // 同じ問題が続かないようにする（引き直しは数回まで）
      for (let i = 0; i < 5 && sameQuestion(question, prev); i++) question = generateQuestion(settings.format, difficulty, rng);
      break;
    }
    case 'weakness': {
      let [a, b] = parseCellKey(config.keys[questionNumber - 1] ?? config.keys[0] ?? '1x1');
      if (difficulty === 'advanced' && rng.next() < 0.5) [a, b] = [b, a];
      question = questionFromPair(rng.next() < 0.5 ? 'product' : 'blank', [a, b], rng);
      break;
    }
    case 'practice': {
      const tables = [...config.tables].sort((x, y) => x - y);
      const format = () => (config.format === 'mix' ? (rng.next() < 0.5 ? 'product' : 'blank') : config.format);
      if (config.order === 'sequential') {
        const index = (questionNumber - 1) % (tables.length * 9);
        const a = tables[Math.floor(index / 9)] ?? 1;
        question = questionFromPair(format(), [a, (index % 9) + 1], rng);
      } else {
        const draw = () => questionFromPair(format(), [rng.pick(tables), rng.int(1, 9)], rng);
        question = draw();
        for (let i = 0; i < 5 && sameQuestion(question, prev); i++) question = draw();
      }
      difficulty = difficultyOfTable(question.kind === 'factor' ? 1 : question.a);
      break;
    }
  }

  const choices = settings.method === 'choice' ? generateChoices(question, difficulty, rng) : null;
  return { question, questionDifficulty: difficulty, choices };
}

function makeRecord(state: GameState, answer: Answer | null, correct: boolean, responseMs: number, at: number): AnswerRecord {
  return {
    at,
    playId: state.playId,
    mode: playModeOf(state.config),
    difficulty: state.questionDifficulty,
    method: state.settings.method,
    question: state.question,
    answer,
    correct,
    responseMs,
  };
}

function nextFlash(state: GameState, kind: 'correct' | 'wrong') {
  return { kind, id: (state.flash?.id ?? 0) + 1 };
}

function stopClock(state: GameState, now: number, cap?: number): Pick<GameState, 'clockElapsedMs' | 'clockRunningSince'> {
  const elapsed = gameClockMs(state, now);
  return { clockElapsedMs: cap === undefined ? elapsed : Math.min(elapsed, cap), clockRunningSince: null };
}

function finish(state: GameState, now: number): GameState {
  const cap = isRule(state, 'timed60') ? TIMED60_MS : undefined;
  return { ...state, ...stopClock(state, now, cap), phase: 'finished', feedback: null, pausedFrom: null };
}

function isComplete(state: GameState): boolean {
  const total = totalQuestions(state);
  if (total !== null && state.answeredCount >= total) return true;
  return isRule(state, 'survival') && state.lives <= 0;
}

/** 次の問題へ進む（時計は now から動かす） */
function advance(state: GameState, now: number): GameState {
  if (isComplete(state)) return finish(state, now);
  const rng = createRng(state.rngState);
  const questionNumber = state.questionNumber + 1;
  const built = buildQuestion(state.config, state.settings, questionNumber, rng, state.question);
  const clockElapsedMs = gameClockMs(state, now);
  return {
    ...state,
    ...built,
    rngState: rng.state,
    questionNumber,
    questionStartMs: clockElapsedMs,
    clockElapsedMs,
    clockRunningSince: now,
    firstWrongAnswer: null,
    phase: 'playing',
    feedback: null,
  };
}

/** 誤答・時間切れの正答表示に入る（時計を止める） */
function enterFeedback(state: GameState, now: number, answer: Answer | null, outOfRange: boolean, timeout: boolean): GameState {
  return {
    ...state,
    phase: 'feedback',
    feedback: {
      until: now + FEEDBACK_MS,
      remainingMs: FEEDBACK_MS,
      answer,
      outOfRange,
      timeout,
      correctAnswer: correctAnswerOf(state.question, state.questionDifficulty),
    },
  };
}

function onAnswer(state: GameState, answer: Answer, now: number, at: number): GameState {
  if (state.phase !== 'playing') return state;

  const clock = gameClockMs(state, now);
  if (isRule(state, 'timed60') && clock >= TIMED60_MS) return finish(state, now);
  if (isRule(state, 'survival') && clock - state.questionStartMs >= state.survivalLimitMs) return onTimeout(state, now, at);

  const responseMs = clock - state.questionStartMs;
  const result = judge(state.question, answer, state.questionDifficulty);
  const timeAttackInput = isRule(state, 'timeAttack') && state.settings.method === 'input';

  if (result.correct) {
    const firstTry = state.firstWrongAnswer === null;
    const record = makeRecord(state, firstTry ? answer : state.firstWrongAnswer, firstTry, responseMs, at);
    const streak = state.streak + 1;
    const next: GameState = {
      ...state,
      correctCount: state.correctCount + 1,
      answeredCount: state.answeredCount + 1,
      streak,
      maxStreak: Math.max(state.maxStreak, streak),
      survivalLimitMs: isRule(state, 'survival')
        ? nextSurvivalLimit(state.settings.difficulty, state.survivalLimitMs, streak)
        : state.survivalLimitMs,
      records: [...state.records, record],
      wrongRecords: firstTry ? state.wrongRecords : [...state.wrongRecords, record],
      flash: nextFlash(state, 'correct'),
    };
    return advance(next, now);
  }

  if (timeAttackInput) {
    // 正解するまで同じ問題。正答は見せず、ペナルティと演出だけ
    return {
      ...state,
      penaltyMs: state.penaltyMs + TIME_ATTACK_PENALTY_MS,
      firstWrongAnswer: state.firstWrongAnswer ?? answer,
      streak: 0,
      flash: nextFlash(state, 'wrong'),
    };
  }

  const record = makeRecord(state, answer, false, responseMs, at);
  const missed: GameState = {
    ...state,
    ...stopClock(state, now),
    answeredCount: state.answeredCount + 1,
    penaltyMs: isRule(state, 'timeAttack') ? state.penaltyMs + TIME_ATTACK_PENALTY_MS : state.penaltyMs,
    lives: isRule(state, 'survival') ? state.lives - 1 : state.lives,
    streak: 0,
    records: [...state.records, record],
    wrongRecords: [...state.wrongRecords, record],
    flash: nextFlash(state, 'wrong'),
  };
  return enterFeedback(missed, now, answer, result.outOfRange, false);
}

function onTimeout(state: GameState, now: number, at: number): GameState {
  const responseMs = state.survivalLimitMs;
  const record = makeRecord(state, null, false, responseMs, at);
  const missed: GameState = {
    ...state,
    clockElapsedMs: state.questionStartMs + state.survivalLimitMs,
    clockRunningSince: null,
    answeredCount: state.answeredCount + 1,
    lives: state.lives - 1,
    streak: 0,
    records: [...state.records, record],
    wrongRecords: [...state.wrongRecords, record],
    flash: nextFlash(state, 'wrong'),
  };
  return enterFeedback(missed, now, null, false, true);
}

function onTick(state: GameState, now: number, at: number): GameState {
  if (state.phase === 'feedback') {
    return state.feedback && now >= state.feedback.until ? advance(state, now) : state;
  }
  if (state.phase !== 'playing') return state;
  const clock = gameClockMs(state, now);
  if (isRule(state, 'timed60') && clock >= TIMED60_MS) return finish(state, now);
  if (isRule(state, 'survival') && clock - state.questionStartMs >= state.survivalLimitMs) return onTimeout(state, now, at);
  return state;
}

function onPause(state: GameState, now: number): GameState {
  if (state.phase !== 'playing' && state.phase !== 'feedback') return state;
  const feedback = state.feedback ? { ...state.feedback, remainingMs: Math.max(0, state.feedback.until - now) } : null;
  return { ...state, ...stopClock(state, now), phase: 'paused', pausedFrom: state.phase, feedback };
}

function onResume(state: GameState, now: number): GameState {
  if (state.phase !== 'paused') return state;
  if (state.pausedFrom === 'feedback' && state.feedback) {
    return { ...state, phase: 'feedback', pausedFrom: null, feedback: { ...state.feedback, until: now + state.feedback.remainingMs } };
  }
  return { ...state, phase: 'playing', pausedFrom: null, clockRunningSince: now };
}

function onQuit(state: GameState, now: number): GameState {
  if (state.phase === 'finished') return state;
  const finished = finish(state, now);
  return { ...finished, aborted: state.config.mode !== 'practice' };
}
