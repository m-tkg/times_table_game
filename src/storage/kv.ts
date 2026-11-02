/** localStorage と同じ形の最小インターフェース（テストではメモリ版を使う） */
export interface KVStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function createMemoryStore(): KVStore {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

/**
 * 使える localStorage を返す。使えない環境（プライベートモードの一部など）では
 * メモリ版を返し、persistent: false で知らせる。SPEC §7.4
 */
export function resolveStore(): { store: KVStore; persistent: boolean } {
  try {
    const ls = globalThis.localStorage;
    const probe = '__kuku_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return { store: ls, persistent: true };
  } catch {
    return { store: createMemoryStore(), persistent: false };
  }
}
