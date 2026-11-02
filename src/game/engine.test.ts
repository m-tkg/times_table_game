import { describe, expect, it } from 'vitest';
import { correctAnswerOf, judge } from '../domain/question.ts';
import type { NormalSettings } from '../domain/records.ts';
import type { Answer } from '../domain/types.ts';
import { CORRECT_FEEDBACK_MS, TABLE_CORRECT_FEEDBACK_MS, createGame, gameClockMs, gameReducer, isRecordable, questionRemainingMs, summaryOf, timeRemainingMs } from './engine.ts';
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
/** now に正解し、正解演出（CORRECT_FEEDBACK_MS）が終わるまで進める */
const right = (state: GameState, now: number) => tick(answer(state, rightAnswer(state), now), now + CORRECT_FEEDBACK_MS);
/** i 問目（0 始まり）を、問題表示の 1 秒後に答える時刻。正解演出の 1 秒を挟むので 2 秒ごと */
const at = (i: number) => i * 2000 + 1000;

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
    for (let i = 0; i < 20; i++) s = right(s, at(i));
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
    expect(s.records).toHaveLength(1);
    s = tick(s, 2000 + CORRECT_FEEDBACK_MS);
    expect(s.questionNumber).toBe(2);
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
      s = right(s, at(i));
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
        s = right(s, now);
        now += CORRECT_FEEDBACK_MS;
      }
    }
    expect(s.phase).toBe('finished');
    expect(summaryOf(s)).toEqual({ correctCount: 19, answeredCount: 20, totalMs: 20_000 + 3000 });
  });
});

describe('正解演出', () => {
  it('正解すると約 1 秒、入力した値と ✓ を見せてから次の問題へ進む', () => {
    let s = start(normal());
    const value = rightAnswer(s);
    s = answer(s, value, 1000);
    expect(s.phase).toBe('feedback');
    expect(s.feedback).toMatchObject({ correct: true, answer: value, timeout: false });
    expect(s.questionNumber).toBe(1);
    s = tick(s, 1000 + CORRECT_FEEDBACK_MS - 1);
    expect(s.phase).toBe('feedback');
    s = tick(s, 1000 + CORRECT_FEEDBACK_MS);
    expect(s.phase).toBe('playing');
    expect(s.questionNumber).toBe(2);
  });

  it('演出中はタイマーが止まり、回答は受け付けない', () => {
    let s = start(normal());
    s = answer(s, rightAnswer(s), 1000);
    expect(gameClockMs(s, 1900)).toBe(1000);
    const before = s;
    s = answer(s, 42, 1500);
    expect(s).toBe(before);
  });

  it('誤答の表示は correct: false', () => {
    let s = start(normal({ method: 'choice' }));
    s = answer(s, wrongAnswer(s), 1000);
    expect(s.feedback?.correct).toBe(false);
  });

  it('最後の問題でも演出を見せてから終了する', () => {
    let s = start(normal());
    for (let i = 0; i < 19; i++) s = right(s, at(i));
    s = answer(s, rightAnswer(s), at(19));
    expect(s.phase).toBe('feedback');
    s = tick(s, at(19) + CORRECT_FEEDBACK_MS);
    expect(s.phase).toBe('finished');
    expect(summaryOf(s).totalMs).toBe(20_000);
  });
});

describe('逆算で範囲外の組を答えたとき', () => {
  // 超上級は両方 10〜19。1 × 積 は積が合っていても範囲外
  const outOfRange = (state: GameState): Answer => {
    if (state.question.kind !== 'factor') throw new Error('逆算ではない');
    return [1, state.question.product];
  };
  const factor = (rule: NormalSettings['rule']) => normal({ rule, format: 'factor', difficulty: 'expert' });

  it.each(['timeAttack', 'timed60', 'survival'] as const)('%s: 不正解にせず、同じ問題のまま答え直せる（ペナルティなし）', (rule) => {
    let s = right(start(factor(rule)), 1000);
    const before = s;
    s = answer(s, outOfRange(s), 2500);
    expect(s.phase).toBe('playing');
    expect(s.questionNumber).toBe(before.questionNumber);
    expect(s.question).toEqual(before.question);
    expect(s.penaltyMs).toBe(0);
    expect(s.lives).toBe(before.lives);
    expect(s.streak).toBe(1);
    expect(s.answeredCount).toBe(before.answeredCount);
    expect(s.records).toEqual(before.records);
    expect(s.firstWrongAnswer).toBeNull();
    expect(s.notice).toEqual({ kind: 'outOfRange', id: 1 });
  });

  it('答え直して正解すれば、一発正解として記録し、お知らせは消える', () => {
    let s = start(factor('timeAttack'));
    s = answer(s, outOfRange(s), 1000);
    s = answer(s, rightAnswer(s), 1500);
    expect(s.notice).toBeNull();
    expect(s.records.at(-1)?.correct).toBe(true);
    expect(s.records.at(-1)?.responseMs).toBe(1500);
  });

  it('続けて範囲外を答えるたびに id が変わる（表示し直す合図）', () => {
    let s = start(factor('timeAttack'));
    s = answer(s, outOfRange(s), 1000);
    s = answer(s, outOfRange(s), 1200);
    expect(s.notice?.id).toBe(2);
  });

  it('積が違う答えは、これまでどおり誤答', () => {
    let s = start(factor('timeAttack'));
    const product = s.question.kind === 'factor' ? s.question.product : 0;
    s = answer(s, product === 100 ? [10, 11] : [10, 10], 1000);
    expect(s.penaltyMs).toBe(3000);
    expect(s.notice).toBeNull();
  });
});

describe('60 秒チャレンジ', () => {
  const config = normal({ rule: 'timed60' });

  it('60 秒たつと終了する', () => {
    let s = start(config);
    s = right(s, 1000); // 演出中の 1 秒は時計が止まる
    s = tick(s, 60_999);
    expect(s.phase).toBe('playing');
    expect(timeRemainingMs(s, 60_999)).toBe(1);
    s = tick(s, 61_000);
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
    for (let i = 0; i < 5; i++) {
      s = right(s, (now += 100));
      now += CORRECT_FEEDBACK_MS;
    }
    expect(s.survivalLimitMs).toBe(5500);
    s = answer(s, wrongAnswer(s), (now += 100));
    s = tick(s, (now += 1500));
    expect(s.streak).toBe(0);
    expect(s.survivalLimitMs).toBe(5500);
  });

  it('正解すると次の問題の制限時間がリセットされる', () => {
    let s = start(config);
    s = right(s, 4000);
    expect(questionRemainingMs(s, 4000 + CORRECT_FEEDBACK_MS)).toBe(6000);
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
        s = right(s, at(i));
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
      s = right(s, i * 120_000 + 60_000);
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
      s = right(s, at(i));
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
      s = right(s, at(i));
    }
    expect(s.phase).toBe('finished');
  });

  it('問題数 10 なら 10 問で終わる', () => {
    let s = createGame(
      { mode: 'practice', tables: [2], order: 'random', count: 10, format: 'product', method: 'input' },
      { seed: 1, now: 0, playId: 'p' },
    );
    for (let i = 0; i < 10; i++) s = right(s, at(i));
    expect(s.phase).toBe('finished');
  });

  it('エンドレスは終わらず、やめると中断ではなく終了になる', () => {
    let s = createGame(
      { mode: 'practice', tables: [2], order: 'sequential', count: null, format: 'product', method: 'input' },
      { seed: 1, now: 0, playId: 'p' },
    );
    for (let i = 0; i < 30; i++) s = right(s, at(i));
    expect(s.phase).toBe('playing');
    s = gameReducer(s, { type: 'quit', now: at(30) });
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

describe('表うめモード', () => {
  const table = (difficulty: 'standard' | 'advanced' | 'expert', count: 20 | 'all', method: 'input' | 'choice' = 'input'): GameConfig => ({
    mode: 'table',
    difficulty,
    count,
    method,
  });
  const keyOf = (s: GameState) => {
    const q = s.question as { a: number; b: number };
    return `${q.a}x${q.b}`;
  };

  it.each([
    ['standard', 81],
    ['advanced', 90],
    ['expert', 100],
  ] as const)('%s の「全部」は表の全マス（%i）を重複なく出題順に持つ', (difficulty, cells) => {
    const s = start(table(difficulty, 'all'));
    expect(s.tableOrder).toHaveLength(cells);
    expect(new Set(s.tableOrder!.map(([a, b]) => `${a}x${b}`)).size).toBe(cells);
  });

  it('上級の表は 行 10〜19 × 列 1〜9 で、問題は行 × 列の向きで出す', () => {
    const s = start(table('advanced', 'all'));
    for (const [a, b] of s.tableOrder!) {
      expect(a).toBeGreaterThanOrEqual(10);
      expect(b).toBeLessThanOrEqual(9);
    }
    const q = s.question as { a: number; b: number };
    expect(q.a).toBeGreaterThanOrEqual(10);
  });

  it('20 マスは表の中から 20 マスを選ぶ', () => {
    const s = start(table('standard', 20));
    expect(s.tableOrder).toHaveLength(20);
  });

  it('問題は出題順どおり、答えを出す形式・入力で出す', () => {
    let s = start(table('standard', 20));
    const order = s.tableOrder!.map(([a, b]) => `${a}x${b}`);
    expect(s.question.kind).toBe('product');
    expect(s.choices).toBeNull();
    for (let i = 0; i < 3; i++) {
      expect(keyOf(s)).toBe(order[i]);
      s = tick(answer(s, rightAnswer(s), at(i)), at(i) + TABLE_CORRECT_FEEDBACK_MS);
    }
  });

  it('正解演出は 0.5 秒で、演出中はタイマーが止まる', () => {
    let s = start(table('standard', 20));
    s = answer(s, rightAnswer(s), 1000);
    expect(s.feedback?.correct).toBe(true);
    expect(gameClockMs(s, 1400)).toBe(1000);
    s = tick(s, 1000 + TABLE_CORRECT_FEEDBACK_MS - 1);
    expect(s.phase).toBe('feedback');
    s = tick(s, 1000 + TABLE_CORRECT_FEEDBACK_MS);
    expect(s.questionNumber).toBe(2);
  });

  it('誤答は同じマスのまま +3 秒、正答は見せない', () => {
    let s = start(table('standard', 20));
    const key = keyOf(s);
    s = answer(s, wrongAnswer(s), 1000);
    expect(s.phase).toBe('playing');
    expect(keyOf(s)).toBe(key);
    expect(s.penaltyMs).toBe(3000);
    expect(s.feedback).toBeNull();
  });

  it('全マス埋めると終了し、スコアはペナルティ込みの時間、記録対象になる', () => {
    let s = start(table('standard', 20));
    // 問題表示の 1 秒後に答え、0.5 秒の演出を挟むので 1.5 秒ごと
    const tableAt = (i: number) => i * 1500 + 1000;
    for (let i = 0; i < 20; i++) {
      if (i === 0) s = answer(s, wrongAnswer(s), 500);
      s = tick(answer(s, rightAnswer(s), tableAt(i)), tableAt(i) + TABLE_CORRECT_FEEDBACK_MS);
    }
    expect(s.phase).toBe('finished');
    expect(summaryOf(s)).toEqual({ correctCount: 19, answeredCount: 20, totalMs: 20_000 + 3000 });
    expect(isRecordable(s)).toBe(true);
    expect(s.records[0]?.mode).toBe('table');
  });

  it('表示用の設定はタイムアタック・答えを出す・選んだ回答方法', () => {
    expect(start(table('expert', 20)).settings).toEqual({ rule: 'timeAttack', format: 'product', method: 'input', difficulty: 'expert' });
    expect(start(table('expert', 20, 'choice')).settings).toEqual({ rule: 'timeAttack', format: 'product', method: 'choice', difficulty: 'expert' });
  });

  it('4 択: 選択肢を 4 つ持ち、正解はそのマスの答え', () => {
    const s = start(table('standard', 20, 'choice'));
    expect(s.choices).toHaveLength(4);
    const q = s.question as { a: number; b: number };
    expect(s.choices).toContain(q.a * q.b);
  });

  it('4 択: 誤答は +3 秒、正答を 1.5 秒見せてから次のマスへ進み、そのマスは一度間違えた扱いで埋まる', () => {
    let s = start(table('standard', 20, 'choice'));
    const first = keyOf(s);
    s = answer(s, wrongAnswer(s), 1000);
    expect(s.phase).toBe('feedback');
    expect(s.feedback?.correct).toBe(false);
    expect(s.penaltyMs).toBe(3000);
    expect(s.records[0]).toMatchObject({ correct: false });
    s = tick(s, 2500);
    expect(s.phase).toBe('playing');
    expect(s.questionNumber).toBe(2);
    expect(keyOf(s)).not.toBe(first);
  });

  it('4 択: 誤答があっても全マスで終わる', () => {
    let s = start(table('standard', 20, 'choice'));
    let now = 0;
    for (let i = 0; i < 20; i++) {
      now += 1000;
      if (i === 0) {
        s = answer(s, wrongAnswer(s), now);
        now += 1500;
      } else {
        s = answer(s, rightAnswer(s), now);
        now += TABLE_CORRECT_FEEDBACK_MS;
      }
      s = tick(s, now);
    }
    expect(s.phase).toBe('finished');
    expect(summaryOf(s)).toEqual({ correctCount: 19, answeredCount: 20, totalMs: 20_000 + 3000 });
  });
});
