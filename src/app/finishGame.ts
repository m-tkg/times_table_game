import { newlyUnlocked, type Achievement } from '../domain/achievements.ts';
import type { PlayRecord } from '../domain/records.ts';
import { scoreOf, type ScoreSummary } from '../domain/score.ts';
import { localDateKey, streakDays } from '../domain/stats.ts';
import { isRecordable, summaryOf } from '../game/engine.ts';
import type { GameState } from '../game/types.ts';
import type { Repository, SaveResult } from '../storage/repository.ts';

export interface GameResult {
  state: GameState;
  summary: ScoreSummary;
  play: PlayRecord | null;
  save: SaveResult;
  newAchievements: Achievement[];
}

/** 終わったゲームを保存し、実績を判定する */
export function finishGame(repo: Repository, state: GameState, at: number): GameResult {
  const summary = summaryOf(state);
  const completed = state.phase === 'finished' && !state.aborted;
  const recordable = isRecordable(state);
  const { config } = state;

  const play: PlayRecord | null = recordable
    ? {
        id: state.playId,
        at,
        mode: config.mode === 'daily' ? 'daily' : config.mode === 'table' ? 'table' : 'normal',
        settings: state.settings,
        ...(config.mode === 'daily' ? { dailyDate: config.date } : {}),
        ...(config.mode === 'table' ? { tableCount: config.count } : {}),
        ...summary,
        score: scoreOf(state.settings.rule, summary),
      }
    : null;

  const save = repo.saveGameResult({ records: state.records, play });

  if (completed && config.mode === 'weakness') repo.incrementCounter('weaknessCompleted');

  const days = repo.loadDays();
  const newAchievements = newlyUnlocked(
    {
      game: {
        mode: config.mode,
        settings: state.settings,
        completed,
        // ルール・難易度の実績は通常・デイリーだけが対象（表うめは別の遊び方なので含めない）
        recordable: recordable && config.mode !== 'table',
        correctCount: summary.correctCount,
        answeredCount: summary.answeredCount,
        wrongCount: state.wrongRecords.length,
        totalMs: summary.totalMs,
        maxStreak: state.maxStreak,
        factorQuestions: state.records.filter((r) => r.question.kind === 'factor').length,
      },
      totalAnswers: Object.values(days).reduce((a, b) => a + b, 0),
      streak: streakDays(Object.keys(days), localDateKey(new Date(at))),
      dailyCount: Object.keys(repo.loadDaily()).length,
      weaknessCompleted: repo.loadCounters().weaknessCompleted,
    },
    new Set(Object.keys(repo.loadAchievements())),
  );
  if (newAchievements.length > 0) repo.unlockAchievements(newAchievements.map((a) => a.id), at);

  return { state, summary, play, save, newAchievements };
}
