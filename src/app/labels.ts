import type { NormalSettings, PlayRecord, TableCount } from '../domain/records.ts';
import type { AnswerMethod, Difficulty, FormatSetting, Rule } from '../domain/types.ts';

export const RULE_LABEL: Record<Rule, string> = {
  timeAttack: 'タイムアタック',
  timed60: '60秒チャレンジ',
  survival: 'サバイバル',
};

export const RULE_HINT: Record<Rule, string> = {
  timeAttack: '20 問を解く時間を競う。誤答 +3 秒',
  timed60: '60 秒で何問正解できるか',
  survival: 'ライフ 3。1 問ごとに制限時間',
};

export const FORMAT_LABEL: Record<FormatSetting, string> = {
  product: '答え',
  blank: '穴埋め',
  factor: '逆算',
  mix: 'ミックス',
};

export const FORMAT_HINT: Record<FormatSetting, string> = {
  product: '7 × 8 = ?',
  blank: '7 × ? = 56',
  factor: '56 = ? × ?',
  mix: '3 つの形式が混ざる',
};

export const METHOD_LABEL: Record<AnswerMethod, string> = {
  input: '入力',
  choice: '4 択',
};

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  standard: '標準',
  advanced: '上級',
  expert: '超上級',
};

export const DIFFICULTY_HINT: Record<Difficulty, string> = {
  standard: '1〜9 × 1〜9',
  advanced: '10〜19 × 1〜9',
  expert: '10〜19 × 10〜19',
};

export function settingsLabel(s: NormalSettings): string {
  return [RULE_LABEL[s.rule], FORMAT_LABEL[s.format], METHOD_LABEL[s.method], DIFFICULTY_LABEL[s.difficulty]].join(' ・ ');
}

export function tableLabel(difficulty: NormalSettings['difficulty'], count: TableCount, method: AnswerMethod): string {
  return `表うめ ・ ${DIFFICULTY_LABEL[difficulty]} ・ ${count === 'all' ? '全部' : `${count} マス`} ・ ${METHOD_LABEL[method]}`;
}

/** プレイ記録の表示名 */
export function playLabel(p: PlayRecord): string {
  if (p.mode === 'daily') return 'デイリー';
  if (p.mode === 'table') return tableLabel(p.settings.difficulty, p.tableCount ?? 20, p.settings.method);
  return settingsLabel(p.settings);
}

/** 秒表示（小数 1 桁） */
export function formatSeconds(ms: number): string {
  return (Math.max(0, ms) / 1000).toFixed(1);
}

/** ルールに応じたスコアの表示 */
export function formatScore(rule: Rule, score: number): { value: string; unit: string } {
  return rule === 'timeAttack' ? { value: formatSeconds(score), unit: '秒' } : { value: String(score), unit: '問' };
}

export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function formatDate(at: number): string {
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
