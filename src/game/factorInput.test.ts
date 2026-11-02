import { describe, expect, it } from 'vitest';
import { shouldMoveToRight } from './factorInput.ts';

describe('shouldMoveToRight（逆算で左の欄を打ち終えたか）', () => {
  it('標準: 因数は 1 桁なので 1 桁で右へ移る', () => {
    expect(shouldMoveToRight('standard', '3')).toBe(true);
  });

  it('上級: 2〜9 は右へ移る、1 は 1 か 10〜19 か分からないので待つ、1x は移る', () => {
    expect(shouldMoveToRight('advanced', '5')).toBe(true);
    expect(shouldMoveToRight('advanced', '1')).toBe(false);
    expect(shouldMoveToRight('advanced', '14')).toBe(true);
  });

  it('超上級: 因数は 2 桁なので 2 桁で右へ移る', () => {
    expect(shouldMoveToRight('expert', '1')).toBe(false);
    expect(shouldMoveToRight('expert', '12')).toBe(true);
  });

  it('超上級: 範囲外の 1 桁（2〜9）は自動では移らず、2 桁目を待つ（範囲外の組も入力できる）', () => {
    expect(shouldMoveToRight('expert', '7')).toBe(false);
    expect(shouldMoveToRight('expert', '24')).toBe(true);
  });

  it('空なら移らない', () => {
    expect(shouldMoveToRight('standard', '')).toBe(false);
  });
});
