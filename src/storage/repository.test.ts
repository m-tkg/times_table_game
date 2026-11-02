import { beforeEach, describe, expect, it } from 'vitest';
import type { AnswerRecord, PlayRecord } from '../domain/records.ts';
import { createMemoryStore, type KVStore } from './kv.ts';
import { DEFAULT_APP_SETTINGS, Repository, SCHEMA_VERSION } from './repository.ts';

const day = (d: number, h = 10) => new Date(2026, 10, d, h).getTime();

const answerRecord = (overrides: Partial<AnswerRecord> = {}): AnswerRecord => ({
  at: day(2),
  playId: 'p1',
  mode: 'normal',
  difficulty: 'standard',
  method: 'input',
  question: { kind: 'product', a: 7, b: 8 },
  answer: 56,
  correct: true,
  responseMs: 2000,
  ...overrides,
});

const play = (overrides: Partial<PlayRecord> = {}): PlayRecord => ({
  id: 'p1',
  at: day(2),
  mode: 'normal',
  settings: { rule: 'timeAttack', format: 'product', method: 'input', difficulty: 'standard' },
  correctCount: 20,
  answeredCount: 20,
  totalMs: 40_000,
  score: 40_000,
  ...overrides,
});

describe('Repository', () => {
  let store: KVStore;
  let repo: Repository;

  beforeEach(() => {
    store = createMemoryStore();
    repo = new Repository(store);
  });

  it('何も保存していなければ既定値を返す', () => {
    expect(repo.loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
    expect(repo.loadLastSettings()).toBeNull();
    expect(repo.loadAnswers()).toEqual([]);
    expect(repo.loadPlays()).toEqual([]);
    expect(repo.loadBests()).toEqual({});
    expect(repo.loadDays()).toEqual({});
  });

  it('効果音・振動の既定値は OFF、テーマは OS に従う', () => {
    expect(DEFAULT_APP_SETTINGS).toEqual({ sound: false, vibration: false, theme: 'system' });
  });

  it('以前の版で保存した自動判定の項目は読み込まない', () => {
    store.setItem('kuku:settings', JSON.stringify({ sound: true, vibration: false, theme: 'dark', autoSubmit: true }));
    expect(repo.loadAppSettings()).toEqual({ sound: true, vibration: false, theme: 'dark' });
  });

  it('アプリ設定と前回の設定を保存して読み戻せる', () => {
    repo.saveAppSettings({ sound: true, vibration: false, theme: 'dark' });
    const s = { rule: 'survival', format: 'mix', method: 'choice', difficulty: 'expert' } as const;
    repo.saveLastSettings(s);
    const reloaded = new Repository(store);
    expect(reloaded.loadAppSettings()).toEqual({ sound: true, vibration: false, theme: 'dark' });
    expect(reloaded.loadLastSettings()).toEqual(s);
  });

  it('保存時にスキーマバージョンを書く', () => {
    repo.saveAppSettings(DEFAULT_APP_SETTINGS);
    expect(store.getItem('kuku:version')).toBe(String(SCHEMA_VERSION));
  });

  it('壊れた JSON があっても例外にせず既定値を返す', () => {
    store.setItem('kuku:answers', '{oops');
    store.setItem('kuku:settings', 'null');
    expect(repo.loadAnswers()).toEqual([]);
    expect(repo.loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
  });

  describe('saveGameResult', () => {
    it('1 問ごとの記録とプレイ日ごとの回答数を保存する', () => {
      repo.saveGameResult({ records: [answerRecord(), answerRecord({ at: day(3) })], play: null });
      expect(repo.loadAnswers()).toHaveLength(2);
      expect(repo.loadDays()).toEqual({ '2026-11-02': 1, '2026-11-03': 1 });
    });

    it('プレイ記録を保存し、初回はベスト記録になる', () => {
      const result = repo.saveGameResult({ records: [answerRecord()], play: play() });
      expect(result.ok).toBe(true);
      expect(result.isNewBest).toBe(true);
      expect(result.previousBest).toBeNull();
      expect(repo.loadPlays()).toHaveLength(1);
      expect(repo.loadBests()['timeAttack/product/input/standard']?.score).toBe(40_000);
    });

    it('ベストより良ければ更新し、悪ければ更新しない', () => {
      repo.saveGameResult({ records: [], play: play({ id: 'a', totalMs: 40_000, score: 40_000 }) });
      const worse = repo.saveGameResult({ records: [], play: play({ id: 'b', totalMs: 45_000, score: 45_000 }) });
      expect(worse.isNewBest).toBe(false);
      expect(worse.previousBest?.id).toBe('a');
      expect(worse.previousPlay?.id).toBe('a');
      const better = repo.saveGameResult({ records: [], play: play({ id: 'c', totalMs: 35_000, score: 35_000 }) });
      expect(better.isNewBest).toBe(true);
      expect(better.previousPlay?.id).toBe('b');
      expect(repo.loadBests()['timeAttack/product/input/standard']?.id).toBe('c');
    });

    it('表うめのベスト記録は「難易度 × マス数」ごとに分かれ、通常モードとは別', () => {
      const tablePlay = (id: string, count: 20 | 'all', score: number) =>
        play({ id, mode: 'table', tableCount: count, totalMs: score, score });
      repo.saveGameResult({ records: [], play: play() });
      expect(repo.saveGameResult({ records: [], play: tablePlay('t1', 20, 50_000) }).isNewBest).toBe(true);
      expect(repo.saveGameResult({ records: [], play: tablePlay('t2', 'all', 90_000) }).isNewBest).toBe(true);
      const bests = repo.loadBests();
      expect(bests['table/standard/20']?.id).toBe('t1');
      expect(bests['table/standard/all']?.id).toBe('t2');
      expect(bests['timeAttack/product/input/standard']?.id).toBe('p1');
    });

    it('ベスト記録は設定ごとに分かれる', () => {
      repo.saveGameResult({ records: [], play: play() });
      const other = play({ id: 'x', settings: { rule: 'timeAttack', format: 'product', method: 'choice', difficulty: 'standard' } });
      expect(repo.saveGameResult({ records: [], play: other }).isNewBest).toBe(true);
      expect(Object.keys(repo.loadBests())).toHaveLength(2);
    });

    it('デイリーはその日最初の 1 回だけ記録する', () => {
      const daily = (id: string, score: number) =>
        play({ id, mode: 'daily', dailyDate: '2026-11-02', settings: { rule: 'timeAttack', format: 'mix', method: 'input', difficulty: 'standard' }, totalMs: score, score });
      expect(repo.saveGameResult({ records: [], play: daily('d1', 50_000) }).dailyRecorded).toBe(true);
      expect(repo.saveGameResult({ records: [], play: daily('d2', 30_000) }).dailyRecorded).toBe(false);
      expect(repo.loadDaily()['2026-11-02']?.id).toBe('d1');
      expect(repo.loadPlays().map((p) => p.id)).toEqual(['d1']);
    });

    it('生ログが上限を超えたら古い分を集計値に畳む', () => {
      const small = new Repository(store, { maxRawRecords: 2 });
      small.saveGameResult({
        records: [answerRecord({ at: 1, correct: false }), answerRecord({ at: 2 }), answerRecord({ at: 3 })],
        play: null,
      });
      expect(small.loadAnswers().map((r) => r.at)).toEqual([2, 3]);
      expect(small.loadCellStats().standard['7x8']).toEqual({ count: 1, correct: 0, totalMs: 2000 });
    });

    it('容量超過で保存できなくても例外にせず ok: false を返す', () => {
      const failing: KVStore = {
        ...store,
        getItem: (k) => store.getItem(k),
        removeItem: (k) => store.removeItem(k),
        setItem: () => {
          throw new DOMException('quota', 'QuotaExceededError');
        },
      };
      const result = new Repository(failing).saveGameResult({ records: [answerRecord()], play: play() });
      expect(result.ok).toBe(false);
    });
  });

  it('実績の獲得日時を保存し、獲得済みは上書きしない', () => {
    repo.unlockAchievements(['first-play'], 100);
    repo.unlockAchievements(['first-play', 'streak-7'], 200);
    expect(repo.loadAchievements()).toEqual({ 'first-play': 100, 'streak-7': 200 });
  });

  it('表うめの前回の設定を保存して読み戻せる', () => {
    expect(repo.loadTableSettings()).toBeNull();
    repo.saveTableSettings({ difficulty: 'advanced', count: 'all' });
    expect(new Repository(store).loadTableSettings()).toEqual({ difficulty: 'advanced', count: 'all' });
  });

  it('カウンタを加算して読み戻せる（苦手克服の完了回数など）', () => {
    expect(repo.loadCounters()).toEqual({ weaknessCompleted: 0 });
    repo.incrementCounter('weaknessCompleted');
    repo.incrementCounter('weaknessCompleted');
    expect(new Repository(store).loadCounters()).toEqual({ weaknessCompleted: 2 });
  });

  it('全記録の削除でアプリのキーだけを消す', () => {
    store.setItem('other-app', 'keep');
    repo.saveAppSettings({ sound: true, vibration: true, theme: 'light' });
    repo.saveGameResult({ records: [answerRecord()], play: play() });
    repo.clearAll();
    expect(repo.loadAnswers()).toEqual([]);
    expect(repo.loadPlays()).toEqual([]);
    expect(repo.loadAppSettings()).toEqual(DEFAULT_APP_SETTINGS);
    expect(store.getItem('other-app')).toBe('keep');
  });
});
