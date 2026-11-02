import { describe, expect, it } from 'vitest';
import { kukuReading } from './reading.ts';

describe('kukuReading', () => {
  it('1〜9 の段の 81 通りすべてに読み方がある', () => {
    for (let a = 1; a <= 9; a++) {
      for (let b = 1; b <= 9; b++) {
        expect(kukuReading(a, b), `${a}×${b}`).toMatch(/^[ぁ-ん]+$/);
      }
    }
  });

  it('代表的な読み方', () => {
    expect(kukuReading(1, 1)).toBe('いんいちがいち');
    expect(kukuReading(2, 2)).toBe('ににんがし');
    expect(kukuReading(3, 3)).toBe('さざんがく');
    expect(kukuReading(3, 6)).toBe('さぶろくじゅうはち');
    expect(kukuReading(3, 8)).toBe('さんぱにじゅうし');
    expect(kukuReading(4, 9)).toBe('しくさんじゅうろく');
    expect(kukuReading(5, 9)).toBe('ごっくしじゅうご');
    expect(kukuReading(8, 8)).toBe('はっぱろくじゅうし');
    expect(kukuReading(9, 9)).toBe('くくはちじゅういち');
  });

  it('範囲外は null', () => {
    expect(kukuReading(10, 3)).toBeNull();
    expect(kukuReading(3, 0)).toBeNull();
  });
});
