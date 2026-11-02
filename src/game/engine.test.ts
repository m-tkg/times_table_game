import { describe, expect, it } from 'vitest';
import { correctAnswerOf, judge } from '../domain/question.ts';
import type { NormalSettings } from '../domain/records.ts';
import type { Answer } from '../domain/types.ts';
import { createGame, gameClockMs, gameReducer, isRecordable, questionRemainingMs, summaryOf, timeRemainingMs } from './engine.ts';
import type { GameConfig, GameState } from './types.ts';

const AT = Date.UTC(2026, 10, 2, 10);

const normal = (overrides: Partial<NormalSettings> = {}): GameConfig => ({
  mode: 'normal',
  settings: { rule: 'timeAttack', format: 'product', method: 'input', difficulty: 'standard', ...overrides },
});

const start = (config: GameConfig, now = 0) => createGame(config, { seed: 123, now, playId: 'play-1' });

function rightAnswer(state: GameState): Answer {
  const correct = correctAnswerOf(state.question, state.questionDifficulty);
  return correct.kind === 'number' ? correct.value : (correct.pairs[0] as [number, number]);
}

function wrongAnswer(state: GameState): Answer {
  if (state.choices) {
    const wrong = state.choices.find((c) => !judge(state.question, c, state.questionDifficulty).correct);
    if (wrong === undefined) throw new Error('誤答の選択肢がない');
    return wrong;
  }
  return state.question.kind === 'factor' ? [1, 1] : 999;
}

const answer = (state: GameState, value: Answer, now: number) => gameReducer(state, { type: 'answer', answer: value, now, at: AT + now });
const tick = (state: GameState, now: number) => gameReducer(state, { type: 'tick', now, at: AT + now });

describe('createGame', () => {
  it('入力モードは選択肢なしで 1 問目から始まる', () => {
    const s = start(normal());
    expect(s.phase).toBe('playing');
    expect(s.questionNumber).toBe(1);
    expect(s.question.kind).toBe('product');
    expect(s.choices).toBeNull();
  });

  it('4 択モードは選択肢を 4 つ持つ', () => {
    const s = start(normal({ method: 'choice' }));
    expect(s.choices).toHaveLength(4);
  });
});

describe('タイムアタック', () => {
  it('20 問正解すると終了し、スコアは経過時間', () => {
    let s = start(normal());
    for (let i = 0; i < 20; i++) s = answer(s, rightAnswer(s), (i + 1) * 1000);
    expect(s.phase).toBe('finished');
    expect(s.correctCount).toBe(20);
    expect(summaryOf(s)).toEqual({ correctCount: 20, answeredCount: 20, totalMs: 20_000 });
    expect(isRecordable(s)).toBe(true);
  });

  it('入力モードの誤答は同じ問題のまま +3 秒、正答表示なし', () => {
    let s = start(normal());
    const q = s.question;
    s = answer(s, wrongAnswer(s), 1000);
    expect(s.phase).toBe('playing');
    expect(s.question).toEqual(q);
    expect(s.feedback).toBeNull();
    expect(s.penaltyMs).toBe(3000);
    expect(s.flash?.kind).toBe('wrong');
    s = answer(s, rightAnswer(s), 2000);
    expect(s.questionNumber).toBe(2);
    expect(s.records).toHaveLength(1);
    expect(s.records[0]).toMatchObject({ correct: false, responseMs: 2000 });
  });

  it('入力モードで誤答のあと正解しても、正答数には数えるが記録は誤答扱い', () => {
    let s = start(normal());
    s = answer(s, wrongAnswer(s), 500);
    s = answer(s, rightAnswer(s), 1000);
    expect(s.answeredCount).toBe(1);
    expect(s.correctCount).toBe(1);
  });

  it('結果の正答数は一発で正解した問題だけを数える（正答率の表示に使う）', () => {
    let s = start(normal());
    for (let i = 0; i < 20; i++) {
      if (i === 0) s = answer(s, wrongAnswer(s), 500);
      s = answer(s, rightAnswer(s), (i + 1) * 1000);
    }
    expect(s.phase).toBe('finished');
    expect(summaryOf(s)).toEqual({ correctCount: 19, answeredCount: 20, totalMs: 20_000 + 3000 });
  });

  it('4 択モードの誤答は +3 秒して正答を表示し、表示中はタイマーが止まる', () => {
    let s = start(normal({ method: 'choice' }));
    s = answer(s, wrongAnswer(s), 1000);
    expect(s.phase).toBe('feedback');
    expect(s.penaltyMs).toBe(3000);
    expect(s.feedback?.correctAnswer.kind).toBe('number');
    expect(gameClockMs(s, 2000)).toBe(1000);
    s = tick(s, 2400);
    expect(s.phase).toBe('feedback');
    s = tick(s, 2500);
    expect(s.phase).toBe('playing');
    expect(s.questionNumber).toBe(2);
    expect(gameClockMs(s, 3500)).toBe(2000);
  });

  it('4 択モードは誤答も 1 問として数え、20 問で終わる', () => {
    let s = start(normal({ method: 'choice' }));
    let now = 0;
    for (let i = 0; i < 20; i++) {
      now += 1000;
      if (i === 0) {
        s = answer(s, wrongAnswer(s), now);
        now += 1500;
        s = tick(s, now);
      } else {
        s = answer(s, rightAnswer(s), now);
      }
    }
    expect(s.phase).toBe('finished');
    expect(summaryOf(s)).toEqual({ correctCount: 19, answeredCount: 20, totalMs: 20_000 + 3000 });
  });
});

describe('60 秒チャレンジ', () => {
  const config = normal({ rule: 'timed60' });

  it('60 秒たつと終了する', () => {
    let s = start(config);
    s = answer(s, rightAnswer(s), 1000);
    s = tick(s, 59_999);
    expect(s.phase).toBe('playing');
    expect(timeRemainingMs(s, 59_999)).toBe(1);
    s = tick(s, 60_000);
    expect(s.phase).toBe('finished');
    expect(summaryOf(s)).toEqual({ correctCount: 1, answeredCount: 1, totalMs: 60_000 });
  });

  it('時間切れ後の回答は数えない', () => {
    let s = start(config);
    s = answer(s, rightAnswer(s), 61_000);
    expect(s.phase).toBe('finished');
    expect(s.correctCount).toBe(0);
  });

  it('誤答の正答表示中は時間が減らない', () => {
    let s = start(config);
    s = answer(s, wrongAnswer(s), 10_000);
    expect(s.phase).toBe('feedback');
    s = tick(s, 11_500);
    expect(s.phase).toBe('playing');
    expect(timeRemainingMs(s, 11_500)).toBe(50_000);
  });
});

describe('サバイバル', () => {
  const config = normal({ rule: 'survival' });

  it('制限時間を過ぎると時間切れで 1 ミス、正答を表示する', () => {
    let s = start(config);
    expect(questionRemainingMs(s, 0)).toBe(6000);
    s = tick(s, 5999);
    expect(s.phase).toBe('playing');
    s = tick(s, 6000);
    expect(s.phase).toBe('feedback');
    expect(s.lives).toBe(2);
    expect(s.feedback?.timeout).toBe(true);
    expect(s.records[0]).toMatchObject({ answer: null, correct: false, responseMs: 6000 });
  });

  it('3 回ミスすると、正答表示のあとに終了する', () => {
    let s = start(config);
    let now = 0;
    for (let i = 0; i < 3; i++) {
      now += 1000;
      s = answer(s, wrongAnswer(s), now);
      now += 1500;
      s = tick(s, now);
    }
    expect(s.lives).toBe(0);
    expect(s.phase).toBe('finished');
  });

  it('5 問連続正解ごとに制限時間が 0.5 秒短くなり、ミスで連続数だけがリセットされる', () => {
    let s = start(config);
    let now = 0;
    for (let i = 0; i < 5; i++) s = answer(s, rightAnswer(s), (now += 100));
    expect(s.survivalLimitMs).toBe(5500);
    s = answer(s, wrongAnswer(s), (now += 100));
    s = tick(s, (now += 1500));
    expect(s.streak).toBe(0);
    expect(s.survivalLimitMs).toBe(5500);
  });

  it('正解すると次の問題の制限時間がリセットされる', () => {
    let s = start(config);
    s = answer(s, rightAnswer(s), 4000);
    expect(questionRemainingMs(s, 4000)).toBe(6000);
  });
});

describe('一時停止', () => {
  it('一時停止中は時間が進まず、再開すると続きから数える', () => {
    let s = start(normal());
    s = gameReducer(s, { type: 'pause', now: 1000 });
    expect(s.phase).toBe('paused');
    expect(gameClockMs(s, 50_000)).toBe(1000);
    s = gameReducer(s, { type: 'resume', now: 50_000 });
    expect(s.phase).toBe('playing');
    s = answer(s, rightAnswer(s), 51_000);
    expect(s.records[0]?.responseMs).toBe(2000);
  });

  it('一時停止中の回答・時間切れは無視する', () => {
    let s = start(normal({ rule: 'survival' }));
    s = gameReducer(s, { type: 'pause', now: 1000 });
    s = tick(s, 100_000);
    expect(s.phase).toBe('paused');
    s = answer(s, rightAnswer(s), 100_000);
    expect(s.correctCount).toBe(0);
  });

  it('正答表示中に一時停止したら、再開後に残りの表示時間を使う', () => {
    let s = start(normal({ rule: 'timed60', method: 'choice' }));
    s = answer(s, wrongAnswer(s), 1000); // 表示は 2500 まで
    s = gameReducer(s, { type: 'pause', now: 2000 });
    s = gameReducer(s, { type: 'resume', now: 10_000 });
    expect(s.phase).toBe('feedback');
    s = tick(s, 10_499);
    expect(s.phase).toBe('feedback');
    s = tick(s, 10_500);
    expect(s.phase).toBe('playing');
  });
});

describe('中断', () => {
  it('通常モードでやめると中断扱いで記録対象外、1 問ごとの記録は残る', () => {
    let s = start(normal());
    s = answer(s, rightAnswer(s), 1000);
    s = gameReducer(s, { type: 'quit', now: 2000 });
    expect(s.phase).toBe('finished');
    expect(s.aborted).toBe(true);
    expect(isRecordable(s)).toBe(false);
    expect(s.records).toHaveLength(1);
  });
});

describe('デイリーチャレンジ', () => {
  it('同じ日付なら同じ問題列、違う日付なら違う問題列', () => {
    const firstQuestions = (date: string, seed: number) => {
      let s = createGame({ mode: 'daily', date }, { seed, now: 0, playId: 'd' });
      const qs = [];
      for (let i = 0; i < 5; i++) {
        qs.push(s.question);
        s = answer(s, rightAnswer(s), (i + 1) * 1000);
      }
      return qs;
    };
    expect(firstQuestions('2026-11-02', 1)).toEqual(firstQuestions('2026-11-02', 999));
    expect(firstQuestions('2026-11-02', 1)).not.toEqual(firstQuestions('2026-11-03', 1));
  });

  it('タイムアタック・入力・標準で動く', () => {
    const s = createGame({ mode: 'daily', date: '2026-11-02' }, { seed: 1, now: 0, playId: 'd' });
    expect(s.choices).toBeNull();
    expect(s.settings).toEqual({ rule: 'timeAttack', format: 'mix', method: 'input', difficulty: 'standard' });
  });
});

describe('苦手克服モード', () => {
  const keys = ['7x8', '6x9', '8x7', '4x6', '7x8', '6x9', '8x7', '4x6', '7x8', '6x9', '8x7', '4x6', '7x8', '6x9', '8x7', '4x6', '7x8', '6x9', '8x7', '4x6'];
  const config: GameConfig = { mode: 'weakness', difficulty: 'standard', method: 'input', keys };

  it('渡された組み合わせを順に、答えを出す・穴埋めで出題し、20 問で終わる', () => {
    let s = createGame(config, { seed: 5, now: 0, playId: 'w' });
    for (let i = 0; i < 20; i++) {
      expect(['product', 'blank']).toContain(s.question.kind);
      const q = s.question as { a: number; b: number };
      expect(`${q.a}x${q.b}`).toBe(keys[i]);
      s = answer(s, rightAnswer(s), (i + 1) * 60_000);
    }
    expect(s.phase).toBe('finished');
    expect(isRecordable(s)).toBe(false);
  });

  it('制限時間はない', () => {
    let s = createGame(config, { seed: 5, now: 0, playId: 'w' });
    s = tick(s, 10_000_000);
    expect(s.phase).toBe('playing');
  });
});

describe('練習モード', () => {
  it('順番通り: 選んだ段を小さい順に × 1〜9 で出す', () => {
    let s = createGame(
      { mode: 'practice', tables: [7, 3], order: 'sequential', count: 20, format: 'product', method: 'input' },
      { seed: 1, now: 0, playId: 'p' },
    );
    const seen: string[] = [];
    for (let i = 0; i < 11; i++) {
      const q = s.question as { a: number; b: number };
      seen.push(`${q.a}x${q.b}`);
      s = answer(s, rightAnswer(s), (i + 1) * 1000);
    }
    expect(seen).toEqual(['3x1', '3x2', '3x3', '3x4', '3x5', '3x6', '3x7', '3x8', '3x9', '7x1', '7x2']);
  });

  it('10〜19 の段でも掛ける数は 1〜9', () => {
    let s = createGame(
      { mode: 'practice', tables: [13], order: 'random', count: 20, format: 'mix', method: 'choice' },
      { seed: 1, now: 0, playId: 'p' },
    );
    for (let i = 0; i < 20; i++) {
      const q = s.question as { a: number; b: number };
      expect(['product', 'blank']).toContain(s.question.kind);
      expect(q.a).toBe(13);
      expect(q.b).toBeGreaterThanOrEqual(1);
      expect(q.b).toBeLessThanOrEqual(9);
      s = answer(s, rightAnswer(s), (i + 1) * 1000);
    }
    expect(s.phase).toBe('finished');
  });

  it('問題数 10 なら 10 問で終わる', () => {
    let s = createGame(
      { mode: 'practice', tables: [2], order: 'random', count: 10, format: 'product', method: 'input' },
      { seed: 1, now: 0, playId: 'p' },
    );
    for (let i = 0; i < 10; i++) s = answer(s, rightAnswer(s), (i + 1) * 1000);
    expect(s.phase).toBe('finished');
  });

  it('エンドレスは終わらず、やめると中断ではなく終了になる', () => {
    let s = createGame(
      { mode: 'practice', tables: [2], order: 'sequential', count: null, format: 'product', method: 'input' },
      { seed: 1, now: 0, playId: 'p' },
    );
    for (let i = 0; i < 30; i++) s = answer(s, rightAnswer(s), (i + 1) * 1000);
    expect(s.phase).toBe('playing');
    s = gameReducer(s, { type: 'quit', now: 40_000 });
    expect(s.phase).toBe('finished');
    expect(s.aborted).toBe(false);
  });
});

describe('1 問ごとの記録', () => {
  it('プレイ ID・モード・難易度・回答方法・問題・回答・日時を持つ', () => {
    let s = start(normal({ method: 'choice', difficulty: 'advanced' }));
    const q = s.question;
    const value = rightAnswer(s);
    s = answer(s, value, 1500);
    expect(s.records[0]).toEqual({
      at: AT + 1500,
      playId: 'play-1',
      mode: 'normal',
      difficulty: 'advanced',
      method: 'choice',
      question: q,
      answer: value,
      correct: true,
      responseMs: 1500,
    });
  });
});
