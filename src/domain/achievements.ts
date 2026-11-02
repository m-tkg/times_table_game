import type { NormalSettings, PlayMode } from './records.ts';

export interface AchievementContext {
  /** 今終わったプレイ */
  game: {
    mode: PlayMode;
    settings: NormalSettings;
    /** 最後まで遊んだ（中断していない） */
    completed: boolean;
    /** 通常・デイリーで最後まで遊んだ */
    recordable: boolean;
    correctCount: number;
    answeredCount: number;
    wrongCount: number;
    totalMs: number;
    maxStreak: number;
    /** 逆算の問題の数 */
    factorQuestions: number;
  };
  /** 今回のプレイを含む累計 */
  totalAnswers: number;
  streak: number;
  dailyCount: number;
  weaknessCompleted: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  check(ctx: AchievementContext): boolean;
}

type Game = AchievementContext['game'];

const ruleIs = (g: Game, rule: NormalSettings['rule']) => g.recordable && g.settings.rule === rule;
const difficultyIs = (g: Game, d: NormalSettings['difficulty']) => g.recordable && g.settings.difficulty === d;
const timeAttackStandardUnder = (g: Game, ms: number) => ruleIs(g, 'timeAttack') && g.settings.difficulty === 'standard' && g.totalMs < ms;

/** 実績の一覧。SPEC §8、§14 */
export const ACHIEVEMENTS: readonly Achievement[] = [
  { id: 'first-play', title: 'はじめの一歩', description: '初めて最後まで遊ぶ', check: () => true },
  { id: 'streak-3', title: '3 日連続', description: '3 日続けて遊ぶ', check: (c) => c.streak >= 3 },
  { id: 'streak-7', title: '7 日連続', description: '7 日続けて遊ぶ', check: (c) => c.streak >= 7 },
  { id: 'streak-30', title: '30 日連続', description: '30 日続けて遊ぶ', check: (c) => c.streak >= 30 },
  { id: 'answers-1000', title: '1,000 問', description: '累計 1,000 問に答える', check: (c) => c.totalAnswers >= 1000 },
  { id: 'answers-10000', title: '10,000 問', description: '累計 10,000 問に答える', check: (c) => c.totalAnswers >= 10_000 },
  { id: 'daily-7', title: 'デイリー常連', description: 'デイリーチャレンジに 7 回挑戦する', check: (c) => c.dailyCount >= 7 },
  { id: 'weakness-10', title: '苦手と向き合う', description: '苦手克服モードを 10 回やりきる', check: (c) => c.weaknessCompleted >= 10 },
  { id: 'ta-perfect', title: 'ノーミス', description: 'タイムアタックをノーミスで完走する', check: (c) => ruleIs(c.game, 'timeAttack') && c.game.wrongCount === 0 },
  { id: 'ta-40', title: '40 秒の壁', description: 'タイムアタック（標準）を 40 秒未満で完走する', check: (c) => timeAttackStandardUnder(c.game, 40_000) },
  { id: 'ta-25', title: '25 秒の壁', description: 'タイムアタック（標準）を 25 秒未満で完走する', check: (c) => timeAttackStandardUnder(c.game, 25_000) },
  { id: 't60-30', title: '60 秒で 30 問', description: '60 秒チャレンジで 30 問正解する', check: (c) => ruleIs(c.game, 'timed60') && c.game.correctCount >= 30 },
  { id: 't60-45', title: '60 秒で 45 問', description: '60 秒チャレンジで 45 問正解する', check: (c) => ruleIs(c.game, 'timed60') && c.game.correctCount >= 45 },
  { id: 'sv-30', title: 'しぶとい', description: 'サバイバルで 30 問正解する', check: (c) => ruleIs(c.game, 'survival') && c.game.correctCount >= 30 },
  { id: 'sv-50', title: '生き残り', description: 'サバイバルで 50 問正解する', check: (c) => ruleIs(c.game, 'survival') && c.game.correctCount >= 50 },
  { id: 'advanced-clear', title: '上級デビュー', description: '上級を最後まで遊ぶ', check: (c) => difficultyIs(c.game, 'advanced') },
  { id: 'expert-clear', title: '超上級デビュー', description: '超上級を最後まで遊ぶ', check: (c) => difficultyIs(c.game, 'expert') },
  {
    id: 'expert-90',
    title: '超上級の使い手',
    description: '超上級で 20 問以上答え、正答率 90% 以上',
    check: (c) => difficultyIs(c.game, 'expert') && c.game.answeredCount >= 20 && c.game.correctCount / c.game.answeredCount >= 0.9,
  },
  {
    id: 'factor-perfect',
    title: '逆算マスター',
    description: '逆算を含むプレイで 20 問以上答え、全問正解',
    check: (c) => c.game.factorQuestions > 0 && c.game.answeredCount >= 20 && c.game.wrongCount === 0,
  },
  { id: 'combo-30', title: '30 コンボ', description: '1 回のプレイで 30 問連続正解する', check: (c) => c.game.maxStreak >= 30 },
];

/** 今回のプレイで新しく獲得した実績 */
export function newlyUnlocked(ctx: AchievementContext, unlocked: ReadonlySet<string>): Achievement[] {
  if (!ctx.game.completed) return [];
  return ACHIEVEMENTS.filter((a) => !unlocked.has(a.id) && a.check(ctx));
}
