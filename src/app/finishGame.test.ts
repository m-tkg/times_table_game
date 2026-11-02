import { describe, expect, it } from 'vitest';
import { correctAnswerOf } from '../domain/question.ts';
import type { Answer } from '../domain/types.ts';
import { createGame, gameReducer } from '../game/engine.ts';
import type { GameConfig, GameState } from '../game/types.ts';
import { createMemoryStore } from '../storage/kv.ts';
import { Repository } from '../storage/repository.ts';
import { finishGame } from './finishGame.ts';

const AT = new Date(2026, 10, 2, 10).getTime();

function playThrough(config: GameConfig, count: number): GameState {
  let s = createGame(config, { seed: 1, now: 0, playId: 'play-1' });
  for (let i = 0; i < count && s.phase === 'playing'; i++) {
    const c = correctAnswerOf(s.question, s.questionDifficulty);
    const answer: Answer = c.kind === 'number' ? c.value : (c.pairs[0] as [number, number]);
    s = gameReducer(s, { type: 'answer', answer, now: (i + 1) * 1000, at: AT + i });
  }
  return s;
}

const timeAttack: GameConfig = { mode: 'normal', settings: { rule: 'timeAttack', format: 'product', method: 'input', difficulty: 'standard' } };

describe('finishGame', () => {
  it('完走した通常プレイは記録し、ベスト更新と実績を返す', () => {
    const repo = new Repository(createMemoryStore());
    const result = finishGame(repo, playThrough(timeAttack, 20), AT + 100);
    expect(result.play?.score).toBe(20_000);
    expect(result.save.isNewBest).toBe(true);
    expect(result.newAchievements.map((a) => a.id)).toEqual(expect.arrayContaining(['first-play', 'ta-perfect', 'ta-25']));
    expect(repo.loadPlays()).toHaveLength(1);
    expect(repo.loadAnswers()).toHaveLength(20);
    expect(Object.keys(repo.loadAchievements())).toContain('first-play');
  });

  it('獲得済みの実績は 2 回目に返さない', () => {
    const repo = new Repository(createMemoryStore());
    finishGame(repo, playThrough(timeAttack, 20), AT + 100);
    const second = finishGame(repo, playThrough(timeAttack, 20), AT + 200);
    expect(second.newAchievements.map((a) => a.id)).not.toContain('first-play');
  });

  it('中断したプレイは 1 問ごとの記録だけ保存する', () => {
    const repo = new Repository(createMemoryStore());
    const quit = gameReducer(playThrough(timeAttack, 5), { type: 'quit', now: 6000 });
    const result = finishGame(repo, quit, AT + 100);
    expect(result.play).toBeNull();
    expect(result.newAchievements).toEqual([]);
    expect(repo.loadPlays()).toHaveLength(0);
    expect(repo.loadAnswers()).toHaveLength(5);
  });

  it('苦手克服をやりきると完了回数を数える', () => {
    const repo = new Repository(createMemoryStore());
    const keys = Array.from({ length: 20 }, (_, i) => `${(i % 9) + 1}x${((i + 3) % 9) + 1}`);
    finishGame(repo, playThrough({ mode: 'weakness', difficulty: 'standard', method: 'input', keys }, 20), AT);
    expect(repo.loadCounters().weaknessCompleted).toBe(1);
  });

  it('デイリーは日付つきで記録する', () => {
    const repo = new Repository(createMemoryStore());
    const result = finishGame(repo, playThrough({ mode: 'daily', date: '2026-11-02' }, 20), AT);
    expect(result.play?.dailyDate).toBe('2026-11-02');
    expect(repo.loadDaily()['2026-11-02']).toBeDefined();
  });
});
