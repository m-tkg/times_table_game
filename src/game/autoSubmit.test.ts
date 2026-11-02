import { describe, expect, it } from 'vitest';
import { autoSubmitAnswer } from './autoSubmit.ts';

describe('autoSubmitAnswer', () => {
  it('答えを出す: 正答と同じ桁数になったら、その数で判定する', () => {
    const q = { kind: 'product', a: 7, b: 8 } as const; // 56
    expect(autoSubmitAnswer(q, 'standard', ['5', ''])).toBeNull();
    expect(autoSubmitAnswer(q, 'standard', ['56', ''])).toBe(56);
    expect(autoSubmitAnswer(q, 'standard', ['54', ''])).toBe(54);
  });

  it('答えが 1 桁なら 1 桁目で判定する', () => {
    expect(autoSubmitAnswer({ kind: 'product', a: 2, b: 3 }, 'standard', ['6', ''])).toBe(6);
    expect(autoSubmitAnswer({ kind: 'product', a: 2, b: 3 }, 'standard', ['7', ''])).toBe(7);
  });

  it('答えが 3 桁なら 3 桁目で判定する', () => {
    const q = { kind: 'product', a: 14, b: 9 } as const; // 126
    expect(autoSubmitAnswer(q, 'advanced', ['12', ''])).toBeNull();
    expect(autoSubmitAnswer(q, 'advanced', ['126', ''])).toBe(126);
  });

  it('穴埋め: 空欄に入る数の桁数で判定する', () => {
    const q = { kind: 'blank', a: 13, b: 7, blank: 'left' } as const; // 13
    expect(autoSubmitAnswer(q, 'advanced', ['1', ''])).toBeNull();
    expect(autoSubmitAnswer(q, 'advanced', ['13', ''])).toBe(13);
  });

  it('空のときは判定しない', () => {
    expect(autoSubmitAnswer({ kind: 'product', a: 2, b: 3 }, 'standard', ['', ''])).toBeNull();
  });

  it('逆算: 両方の欄が埋まり、範囲内の正しい組になったときだけ判定する', () => {
    const q = { kind: 'factor', product: 24 } as const;
    expect(autoSubmitAnswer(q, 'standard', ['3', ''])).toBeNull();
    expect(autoSubmitAnswer(q, 'standard', ['3', '7'])).toBeNull();
    expect(autoSubmitAnswer(q, 'standard', ['3', '8'])).toEqual([3, 8]);
  });

  it('逆算: 積は合っても範囲外の組は自動では判定しない（決定キーで判定する）', () => {
    expect(autoSubmitAnswer({ kind: 'factor', product: 24 }, 'standard', ['2', '12'])).toBeNull();
  });

  it('逆算（上級）: 2 桁の因数を打ち終えたときに判定する', () => {
    const q = { kind: 'factor', product: 56 } as const;
    expect(autoSubmitAnswer(q, 'advanced', ['4', '1'])).toBeNull();
    expect(autoSubmitAnswer(q, 'advanced', ['4', '14'])).toEqual([4, 14]);
  });
});
