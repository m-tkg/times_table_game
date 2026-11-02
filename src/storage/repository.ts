import { compareResults } from '../domain/score.ts';
import { settingsKey, type AnswerRecord, type NormalSettings, type PlayRecord } from '../domain/records.ts';
import { compactLog, emptyCellStats, localDateKey, MAX_RAW_RECORDS, type CellStatsMap } from '../domain/stats.ts';
import type { PracticeFormat } from '../game/types.ts';
import type { AnswerMethod } from '../domain/types.ts';
import type { KVStore } from './kv.ts';

/** 保存形式のバージョン。形式を変えたら上げて migrate に処理を足す */
export const SCHEMA_VERSION = 1;

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface AppSettings {
  sound: boolean;
  vibration: boolean;
  theme: ThemeSetting;
}

export const DEFAULT_APP_SETTINGS: AppSettings = { sound: false, vibration: false, theme: 'system' };

export interface PracticeSettings {
  tables: number[];
  order: 'sequential' | 'random';
  count: number | null;
  format: PracticeFormat;
  method: AnswerMethod;
}

export interface WeaknessSettings {
  difficulty: NormalSettings['difficulty'];
  method: AnswerMethod;
}

const KEYS = {
  version: 'kuku:version',
  settings: 'kuku:settings',
  lastSettings: 'kuku:lastSettings',
  practice: 'kuku:practice',
  weakness: 'kuku:weakness',
  answers: 'kuku:answers',
  cellStats: 'kuku:cellStats',
  plays: 'kuku:plays',
  bests: 'kuku:bests',
  daily: 'kuku:daily',
  days: 'kuku:days',
  achievements: 'kuku:achievements',
  counters: 'kuku:counters',
} as const;

/** プレイ一覧の保持件数（ベスト・デイリーは別に保持するので消えない） */
const MAX_PLAYS = 3000;

/** ベスト記録のキー。デイリーは通常モードと分けて 'daily' にまとめる */
export function bestKeyOf(play: Pick<PlayRecord, 'mode' | 'settings'>): string {
  return play.mode === 'daily' ? 'daily' : settingsKey(play.settings);
}

export interface Counters {
  weaknessCompleted: number;
}

const DEFAULT_COUNTERS: Counters = { weaknessCompleted: 0 };

export interface SaveResult {
  ok: boolean;
  isNewBest: boolean;
  previousBest: PlayRecord | null;
  /** 同じ設定の直前のプレイ（前回比の表示用） */
  previousPlay: PlayRecord | null;
  dailyRecorded: boolean;
}

interface RepositoryOptions {
  maxRawRecords?: number;
}

export class Repository {
  private readonly store: KVStore;
  private readonly maxRawRecords: number;

  constructor(store: KVStore, options: RepositoryOptions = {}) {
    this.store = store;
    this.maxRawRecords = options.maxRawRecords ?? MAX_RAW_RECORDS;
    this.migrate();
  }

  // ---- 読み込み ----

  loadAppSettings(): AppSettings {
    const v = this.read<Partial<AppSettings>>(KEYS.settings, {});
    const saved = isObject(v) ? (v as Partial<AppSettings>) : {};
    // 知っている項目だけを読む（以前の版の項目が残っていても無視する）
    return {
      sound: saved.sound ?? DEFAULT_APP_SETTINGS.sound,
      vibration: saved.vibration ?? DEFAULT_APP_SETTINGS.vibration,
      theme: saved.theme ?? DEFAULT_APP_SETTINGS.theme,
    };
  }

  loadLastSettings(): NormalSettings | null {
    const v = this.read<NormalSettings | null>(KEYS.lastSettings, null);
    return isObject(v) ? v : null;
  }

  loadPracticeSettings(): PracticeSettings | null {
    const v = this.read<PracticeSettings | null>(KEYS.practice, null);
    return isObject(v) ? v : null;
  }

  loadWeaknessSettings(): WeaknessSettings | null {
    const v = this.read<WeaknessSettings | null>(KEYS.weakness, null);
    return isObject(v) ? v : null;
  }

  loadAnswers(): AnswerRecord[] {
    return this.readArray<AnswerRecord>(KEYS.answers);
  }

  loadCellStats(): CellStatsMap {
    const v = this.read<CellStatsMap | null>(KEYS.cellStats, null);
    return isObject(v) ? { ...emptyCellStats(), ...v } : emptyCellStats();
  }

  loadPlays(): PlayRecord[] {
    return this.readArray<PlayRecord>(KEYS.plays);
  }

  loadBests(): Record<string, PlayRecord> {
    return this.readRecord<PlayRecord>(KEYS.bests);
  }

  loadDaily(): Record<string, PlayRecord> {
    return this.readRecord<PlayRecord>(KEYS.daily);
  }

  /** 日付ごとの回答数 */
  loadDays(): Record<string, number> {
    return this.readRecord<number>(KEYS.days);
  }

  loadAchievements(): Record<string, number> {
    return this.readRecord<number>(KEYS.achievements);
  }

  loadCounters(): Counters {
    const v = this.read<Partial<Counters>>(KEYS.counters, {});
    return { ...DEFAULT_COUNTERS, ...(isObject(v) ? v : {}) };
  }

  // ---- 書き込み ----

  incrementCounter(name: keyof Counters): boolean {
    const counters = this.loadCounters();
    counters[name] += 1;
    return this.write(KEYS.counters, counters);
  }

  saveAppSettings(settings: AppSettings): boolean {
    return this.write(KEYS.settings, settings);
  }

  saveLastSettings(settings: NormalSettings): boolean {
    return this.write(KEYS.lastSettings, settings);
  }

  savePracticeSettings(settings: PracticeSettings): boolean {
    return this.write(KEYS.practice, settings);
  }

  saveWeaknessSettings(settings: WeaknessSettings): boolean {
    return this.write(KEYS.weakness, settings);
  }

  /**
   * ゲーム 1 回分の結果を保存する。
   * records（1 問ごとの記録）は中断したプレイでも渡す。play は記録対象のときだけ渡す。
   */
  saveGameResult({ records, play }: { records: AnswerRecord[]; play: PlayRecord | null }): SaveResult {
    const result: SaveResult = { ok: true, isNewBest: false, previousBest: null, previousPlay: null, dailyRecorded: false };
    try {
      if (records.length > 0) {
        const compacted = compactLog([...this.loadAnswers(), ...records], this.loadCellStats(), this.maxRawRecords);
        const days = this.loadDays();
        for (const r of records) {
          const key = localDateKey(new Date(r.at));
          days[key] = (days[key] ?? 0) + 1;
        }
        this.writeOrThrow(KEYS.answers, compacted.records);
        this.writeOrThrow(KEYS.cellStats, compacted.cellStats);
        this.writeOrThrow(KEYS.days, days);
      }

      if (play) {
        if (play.mode === 'daily') {
          const daily = this.loadDaily();
          const date = play.dailyDate ?? localDateKey(new Date(play.at));
          if (daily[date]) return result;
          daily[date] = play;
          this.writeOrThrow(KEYS.daily, daily);
          result.dailyRecorded = true;
        }

        const key = bestKeyOf(play);
        const plays = this.loadPlays();
        result.previousPlay = [...plays].reverse().find((p) => bestKeyOf(p) === key) ?? null;

        const bests = this.loadBests();
        const prevBest = bests[key] ?? null;
        result.previousBest = prevBest;
        if (!prevBest || compareResults(play.settings.rule, play, prevBest) < 0) {
          bests[key] = play;
          result.isNewBest = true;
          this.writeOrThrow(KEYS.bests, bests);
        }

        plays.push(play);
        this.writeOrThrow(KEYS.plays, plays.slice(-MAX_PLAYS));
      }
    } catch {
      result.ok = false;
    }
    return result;
  }

  unlockAchievements(ids: string[], at: number): boolean {
    const current = this.loadAchievements();
    let changed = false;
    for (const id of ids) {
      if (current[id] === undefined) {
        current[id] = at;
        changed = true;
      }
    }
    return changed ? this.write(KEYS.achievements, current) : true;
  }

  clearAll(): void {
    for (const key of Object.values(KEYS)) this.store.removeItem(key);
  }

  // ---- 内部 ----

  private migrate(): void {
    const raw = this.store.getItem(KEYS.version);
    const version = raw === null ? null : Number(raw);
    if (version === SCHEMA_VERSION) return;
    // 現時点では v1 のみ。形式を変えたらここに変換を足す（version < SCHEMA_VERSION のとき）
  }

  private read<T>(key: string, fallback: T): T {
    const raw = this.store.getItem(key);
    if (raw === null) return fallback;
    try {
      const parsed = JSON.parse(raw) as T | null;
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  private readArray<T>(key: string): T[] {
    const v = this.read<unknown>(key, []);
    return Array.isArray(v) ? (v as T[]) : [];
  }

  private readRecord<T>(key: string): Record<string, T> {
    const v = this.read<unknown>(key, {});
    return isObject(v) ? (v as Record<string, T>) : {};
  }

  private writeOrThrow(key: string, value: unknown): void {
    this.store.setItem(key, JSON.stringify(value));
    this.store.setItem(KEYS.version, String(SCHEMA_VERSION));
  }

  private write(key: string, value: unknown): boolean {
    try {
      this.writeOrThrow(key, value);
      return true;
    } catch {
      return false;
    }
  }
}

function isObject(v: unknown): v is Record<string, never> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
