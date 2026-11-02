import { describe, expect, it } from 'vitest';
import { cellKey, factorPairsInRange, isInRange, pairsInRange, productsInRange } from './range.ts';

describe('isInRange', () => {
  it('標準は 1〜9 × 1〜9', () => {
    expect(isInRange('standard', 1, 1)).toBe(true);
    expect(isInRange('standard', 9, 9)).toBe(true);
    expect(isInRange('standard', 0, 5)).toBe(false);
    expect(isInRange('standard', 10, 5)).toBe(false);
    expect(isInRange('standard', 2, 12)).toBe(false);
  });

  it('上級は片方が 10〜19、もう片方が 1〜9（順序は問わない）', () => {
    expect(isInRange('advanced', 14, 7)).toBe(true);
    expect(isInRange('advanced', 7, 14)).toBe(true);
    expect(isInRange('advanced', 7, 8)).toBe(false);
    expect(isInRange('advanced', 12, 13)).toBe(false);
    expect(isInRange('advanced', 20, 3)).toBe(false);
  });

  it('超上級は両方 10〜19', () => {
    expect(isInRange('expert', 10, 19)).toBe(true);
    expect(isInRange('expert', 9, 19)).toBe(false);
  });
});

describe('pairsInRange', () => {
  it('順序付きの組の数: 標準 81、上級 180、超上級 100', () => {
    expect(pairsInRange('standard')).toHaveLength(81);
    expect(pairsInRange('advanced')).toHaveLength(180);
    expect(pairsInRange('expert')).toHaveLength(100);
  });
});

describe('factorPairsInRange', () => {
  it('標準で 24 は 3×8, 4×6, 6×4, 8×3', () => {
    expect(factorPairsInRange('standard', 24)).toEqual([
      [3, 8],
      [4, 6],
      [6, 4],
      [8, 3],
    ]);
  });

  it('上級で 56 は 14×4 と 4×14 だけ（7×8 は範囲外）', () => {
    expect(factorPairsInRange('advanced', 56)).toEqual([
      [4, 14],
      [14, 4],
    ]);
  });

  it('範囲内に組がなければ空', () => {
    expect(factorPairsInRange('standard', 97)).toEqual([]);
  });
});

describe('productsInRange', () => {
  it('重複のない積の一覧を昇順で返す', () => {
    const products = productsInRange('standard');
    expect(products[0]).toBe(1);
    expect(products.at(-1)).toBe(81);
    expect(new Set(products).size).toBe(products.length);
    expect(products).toContain(24);
    expect(products).not.toContain(11);
  });
});

describe('cellKey', () => {
  it('標準・超上級は順序を区別する', () => {
    expect(cellKey('standard', 7, 8)).toBe('7x8');
    expect(cellKey('standard', 8, 7)).toBe('8x7');
    expect(cellKey('expert', 12, 15)).toBe('12x15');
  });

  it('上級は 10〜19 側を先にそろえる（表が 10〜19 × 1〜9 のため）', () => {
    expect(cellKey('advanced', 14, 7)).toBe('14x7');
    expect(cellKey('advanced', 7, 14)).toBe('14x7');
  });
});
