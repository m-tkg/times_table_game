import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../app/AppContext.tsx';
import {
  DIFFICULTY_HINT,
  DIFFICULTY_LABEL,
  FORMAT_HINT,
  FORMAT_LABEL,
  formatScore,
  METHOD_LABEL,
  RULE_HINT,
  RULE_LABEL,
} from '../../app/labels.ts';
import { DEFAULT_SETTINGS, settingsKey, type NormalSettings } from '../../domain/records.ts';
import type { AnswerMethod, Difficulty, FormatSetting, Rule } from '../../domain/types.ts';
import { Segmented } from '../Segmented.tsx';
import { TopBar } from '../TopBar.tsx';

export const RULE_OPTIONS = (['timeAttack', 'timed60', 'survival'] as Rule[]).map((value) => ({ value, label: RULE_LABEL[value] }));
export const FORMAT_OPTIONS = (['product', 'blank', 'factor', 'mix'] as FormatSetting[]).map((value) => ({ value, label: FORMAT_LABEL[value] }));
export const METHOD_OPTIONS = (['input', 'choice'] as AnswerMethod[]).map((value) => ({ value, label: METHOD_LABEL[value] }));
export const DIFFICULTY_OPTIONS = (['standard', 'advanced', 'expert'] as Difficulty[]).map((value) => ({ value, label: DIFFICULTY_LABEL[value] }));

export function SetupScreen() {
  const { repo, startSession } = useApp();
  const navigate = useNavigate();
  const [s, setS] = useState<NormalSettings>(() => repo.loadLastSettings() ?? DEFAULT_SETTINGS);
  const best = repo.loadBests()[settingsKey(s)];
  const set = <K extends keyof NormalSettings>(key: K) => (value: NormalSettings[K]) => setS((prev) => ({ ...prev, [key]: value }));

  const start = () => {
    repo.saveLastSettings(s);
    startSession({ mode: 'normal', settings: s });
    navigate('/play');
  };

  const bestText = best ? formatScore(best.settings.rule, best.score) : null;

  return (
    <main className="screen">
      <TopBar title="ゲーム設定" />
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Segmented label="ルール" value={s.rule} options={RULE_OPTIONS} onChange={set('rule')} hint={RULE_HINT[s.rule]} />
        <Segmented label="問題形式" value={s.format} options={FORMAT_OPTIONS} onChange={set('format')} hint={FORMAT_HINT[s.format]} />
        <Segmented label="回答方法" value={s.method} options={METHOD_OPTIONS} onChange={set('method')} />
        <Segmented label="難易度" value={s.difficulty} options={DIFFICULTY_OPTIONS} onChange={set('difficulty')} hint={DIFFICULTY_HINT[s.difficulty]} />
      </div>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted" style={{ fontWeight: 800 }}>
          この設定のベスト
        </span>
        <b className="num" style={{ fontSize: 22 }}>
          {bestText ? `${bestText.value} ${bestText.unit}` : '—'}
        </b>
      </div>
      <button type="button" className="btn primary" onClick={start}>
        スタート
      </button>
    </main>
  );
}
