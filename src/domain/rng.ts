import type { Rng } from './types.ts';

/**
 * mulberry32 による擬似乱数。状態が 32bit 整数 1 つなので、
 * ゲーム状態に保存して再開できる（reducer を純粋に保つため）。
 */
export function createRng(seed: number): Rng {
  let s = seed >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number): number => min + Math.floor(next() * (max - min + 1));

  return {
    next,
    int,
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('空の配列からは選べません');
      return items[int(0, items.length - 1)] as T;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i);
        [out[i], out[j]] = [out[j] as T, out[i] as T];
      }
      return out;
    },
    get state() {
      return s;
    },
  };
}

/** 文字列（日付など）から 32bit のシードを作る（FNV-1a） */
export function seedFromString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 初期シードを作る（実行時のみ。テストでは固定値を渡す） */
export function randomSeed(): number {
  return Math.floor(Math.random() * 4294967296) >>> 0;
}
