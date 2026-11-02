import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS, newlyUnlocked, type AchievementContext } from './achievements.ts';

const ctx = (overrides: Partial<AchievementContext['game']> = {}, totals: Partial<Omit<AchievementContext, 'game'>> = {}): AchievementContext => ({
  game: {
    mode: 'normal',
    settings: { rule: 'timeAttack', format: 'product', method: 'input', difficulty: 'standard' },
    completed: true,
    recordable: true,
    correctCount: 20,
    answeredCount: 20,
    wrongCount: 1,
    totalMs: 60_000,
    maxStreak: 10,
    factorQuestions: 0,
    ...overrides,
  },
  totalAnswers: 20,
  streak: 1,
  dailyCount: 0,
  weaknessCompleted: 0,
  ...totals,
});

const ids = (c: AchievementContext, unlocked: string[] = []) => newlyUnlocked(c, new Set(unlocked)).map((a) => a.id);

describe('実績の定義', () => {
  it('20 個あり、ID が重複しない', () => {
    expect(ACHIEVEMENTS).toHaveLength(20);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(20);
  });
});

describe('newlyUnlocked', () => {
  it('初めて最後まで遊ぶと「はじめの一歩」', () => {
    expect(ids(ctx())).toContain('first-play');
  });

  it('中断したプレイでは何も獲得しない', () => {
    expect(ids(ctx({ completed: false, recordable: false }), [])).toEqual([]);
  });

  it('獲得済みの実績は返さない', () => {
    expect(ids(ctx(), ['first-play'])).not.toContain('first-play');
  });

  it('連続プレイ日数・累計解答数・デイリー回数・苦手克服回数', () => {
    const got = ids(ctx({}, { streak: 7, totalAnswers: 1000, dailyCount: 7, weaknessCompleted: 10 }));
    expect(got).toEqual(expect.arrayContaining(['streak-3', 'streak-7', 'answers-1000', 'daily-7', 'weakness-10']));
    expect(got).not.toContain('streak-30');
    expect(got).not.toContain('answers-10000');
  });

  it('タイムアタックのノーミス完走と時間', () => {
    expect(ids(ctx({ wrongCount: 0, totalMs: 24_000 }))).toEqual(expect.arrayContaining(['ta-perfect', 'ta-40', 'ta-25']));
    expect(ids(ctx({ wrongCount: 0, totalMs: 39_999 }))).not.toContain('ta-25');
  });

  it('タイムアタックの時間は標準のみ対象', () => {
    const advanced = ctx({ totalMs: 20_000, settings: { rule: 'timeAttack', format: 'product', method: 'input', difficulty: 'advanced' } });
    expect(ids(advanced)).not.toContain('ta-40');
  });

  it('60 秒チャレンジ・サバイバルは正答数で判定する', () => {
    const t60 = ctx({ correctCount: 45, settings: { rule: 'timed60', format: 'product', method: 'choice', difficulty: 'standard' } });
    expect(ids(t60)).toEqual(expect.arrayContaining(['t60-30', 't60-45']));
    const sv = ctx({ correctCount: 30, settings: { rule: 'survival', format: 'mix', method: 'input', difficulty: 'standard' } });
    expect(ids(sv)).toContain('sv-30');
    expect(ids(sv)).not.toContain('sv-50');
  });

  it('ルール系の実績は記録対象のプレイ（通常・デイリー）だけ', () => {
    const practice = ctx({ mode: 'practice', recordable: false, correctCount: 50, settings: { rule: 'survival', format: 'mix', method: 'input', difficulty: 'standard' } });
    expect(ids(practice)).not.toContain('sv-50');
    expect(ids(practice)).toContain('first-play');
  });

  it('上級・超上級の完走、超上級で正答率 90%（20 問以上）', () => {
    const expert = (correct: number, answered: number) =>
      ctx({ correctCount: correct, answeredCount: answered, settings: { rule: 'timed60', format: 'product', method: 'input', difficulty: 'expert' } });
    expect(ids(expert(18, 20))).toEqual(expect.arrayContaining(['expert-clear', 'expert-90']));
    expect(ids(expert(17, 20))).not.toContain('expert-90');
    expect(ids(expert(10, 10))).not.toContain('expert-90');
    const advanced = ctx({ settings: { rule: 'timeAttack', format: 'product', method: 'input', difficulty: 'advanced' } });
    expect(ids(advanced)).toContain('advanced-clear');
  });

  it('逆算を含むプレイで 20 問以上・全問正解', () => {
    expect(ids(ctx({ factorQuestions: 5, wrongCount: 0, answeredCount: 20 }))).toContain('factor-perfect');
    expect(ids(ctx({ factorQuestions: 0, wrongCount: 0, answeredCount: 20 }))).not.toContain('factor-perfect');
    expect(ids(ctx({ factorQuestions: 5, wrongCount: 1, answeredCount: 20 }))).not.toContain('factor-perfect');
  });

  it('1 回のプレイで 30 連続正解', () => {
    expect(ids(ctx({ maxStreak: 30 }))).toContain('combo-30');
    expect(ids(ctx({ maxStreak: 29 }))).not.toContain('combo-30');
  });
});
