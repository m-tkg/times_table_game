import type { Rng } from './types.ts';

/** 苦手度の計算に使う 1 回分の観測（古い順に並べて渡す） */
export interface CellObservation {
  key: string;
  correct: boolean;
  responseMs: number;
}

/** 新しい記録ほど重くする減衰率（1 つ古くなるごとに重みを掛ける） */
const DECAY = 0.7;
/** 誤答率と遅さの配分 */
const ERROR_WEIGHT = 0.7;
const SLOW_WEIGHT = 0.3;
/** データ不足のセルを寄せる「中程度」の値と、その強さ（観測何回分か） */
const PRIOR_SCORE = 0.4;
const PRIOR_STRENGTH = 1;

/**
 * 組み合わせごとの苦手度（0〜1）。SPEC §4.1
 *
 * - 誤答率と遅さを、新しい記録ほど重く（指数減衰）して平均する
 * - 遅さは全体の中央値に対する比で測る（中央値の 3 倍以上で最大）
 * - 観測が少ないセルは「中程度」に寄せる（ベイズ的な平滑化）
 */
export function weaknessScores(observations: readonly CellObservation[], keys: readonly string[]): Map<string, number> {
  const target = new Set(keys);
  const byKey = new Map<string, CellObservation[]>();
  for (const o of observations) {
    if (!target.has(o.key)) continue;
    const list = byKey.get(o.key) ?? [];
    list.push(o);
    byKey.set(o.key, list);
  }

  const times = observations.filter((o) => target.has(o.key)).map((o) => o.responseMs);
  const median = medianOf(times);

  const scores = new Map<string, number>();
  for (const key of keys) {
    const list = byKey.get(key) ?? [];
    let weightSum = 0;
    let errorSum = 0;
    let slowSum = 0;
    for (let i = 0; i < list.length; i++) {
      const o = list[list.length - 1 - i] as CellObservation; // 新しい順
      const w = DECAY ** i;
      weightSum += w;
      if (!o.correct) errorSum += w;
      if (median > 0) slowSum += w * clamp01((o.responseMs / median - 1) / 2);
    }
    const raw = weightSum === 0 ? 0 : (ERROR_WEIGHT * errorSum + SLOW_WEIGHT * slowSum) / weightSum;
    scores.set(key, clamp01((weightSum * raw + PRIOR_STRENGTH * PRIOR_SCORE) / (weightSum + PRIOR_STRENGTH)));
  }
  return scores;
}

/**
 * 苦手度で重み付けして count 個のキーを選ぶ。
 * - 苦手度が高いほど選ばれやすい
 * - 1 回の出題で同じ組み合わせが半分を超えない
 * - 同じキーは連続させない
 */
export function pickWeakKeys(scores: ReadonlyMap<string, number>, count: number, rng: Rng): string[] {
  const keys = [...scores.keys()];
  if (keys.length === 0 || count <= 0) return [];
  if (keys.length === 1) return Array.from({ length: count }, () => keys[0] as string);

  const weightOf = (k: string) => (scores.get(k) ?? 0) ** 2 + 0.02;
  const draw = (candidates: string[]) => {
    const total = candidates.reduce((sum, k) => sum + weightOf(k), 0);
    let r = rng.next() * total;
    for (const k of candidates) {
      r -= weightOf(k);
      if (r < 0) return k;
    }
    return candidates[candidates.length - 1] as string;
  };

  // 1. 重み付きで復元抽出して出題回数を決める
  const counts = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const k = draw(keys);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  // 2. 半分を超えたキーの超過分を、他のキーから引き直す
  const cap = Math.ceil(count / 2);
  for (const k of keys) {
    let surplus = (counts.get(k) ?? 0) - cap;
    if (surplus <= 0) continue;
    counts.set(k, cap);
    while (surplus-- > 0) {
      const others = keys.filter((o) => o !== k && (counts.get(o) ?? 0) < cap);
      if (others.length === 0) break;
      const o = draw(others);
      counts.set(o, (counts.get(o) ?? 0) + 1);
    }
  }

  // 3. 同じキーが隣り合わないように並べる（並べられる候補の中からランダムに）
  const result: string[] = [];
  let prev: string | null = null;
  let remaining = [...counts.values()].reduce((a, b) => a + b, 0);
  while (remaining > 0) {
    const candidates = keys.filter((k) => k !== prev && (counts.get(k) ?? 0) > 0);
    const feasible = candidates.filter((c) => canArrange(counts, c, remaining - 1));
    const pool = feasible.length > 0 ? feasible : candidates.length > 0 ? candidates : keys.filter((k) => (counts.get(k) ?? 0) > 0);
    const totalCount = pool.reduce((sum, k) => sum + (counts.get(k) ?? 0), 0);
    let r = rng.next() * totalCount;
    let chosen = pool[pool.length - 1] as string;
    for (const k of pool) {
      r -= counts.get(k) ?? 0;
      if (r < 0) {
        chosen = k;
        break;
      }
    }
    result.push(chosen);
    counts.set(chosen, (counts.get(chosen) ?? 0) - 1);
    prev = chosen;
    remaining--;
  }
  return result;
}

/** picked を置いた後、残り rest 個を隣り合わずに並べられるか */
function canArrange(counts: ReadonlyMap<string, number>, picked: string, rest: number): boolean {
  for (const [k, c] of counts) {
    const after = k === picked ? c - 1 : c;
    // 直前が picked なので、picked は先頭に置けない
    const limit = k === picked ? Math.floor(rest / 2) : Math.ceil(rest / 2);
    if (after > limit) return false;
  }
  return true;
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2 : (sorted[mid] as number);
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
