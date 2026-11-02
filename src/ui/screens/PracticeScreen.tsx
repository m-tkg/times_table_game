import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../app/AppContext.tsx';
import type { PracticeFormat } from '../../game/types.ts';
import type { PracticeSettings } from '../../storage/repository.ts';
import { Segmented } from '../Segmented.tsx';
import { TopBar } from '../TopBar.tsx';
import { METHOD_OPTIONS } from './SetupScreen.tsx';

const TABLES = Array.from({ length: 19 }, (_, i) => i + 1);

const DEFAULT_PRACTICE: PracticeSettings = { tables: [7], order: 'sequential', count: 10, format: 'product', method: 'input' };

const FORMAT_OPTIONS: Array<{ value: PracticeFormat; label: string }> = [
  { value: 'product', label: '答え' },
  { value: 'blank', label: '穴埋め' },
  { value: 'mix', label: 'ミックス' },
];

const COUNT_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 10, label: '10 問' },
  { value: 20, label: '20 問' },
  { value: 0, label: 'エンドレス' },
];

export function PracticeScreen() {
  const { repo, startSession } = useApp();
  const navigate = useNavigate();
  const [p, setP] = useState<PracticeSettings>(() => repo.loadPracticeSettings() ?? DEFAULT_PRACTICE);
  const set = <K extends keyof PracticeSettings>(key: K) => (value: PracticeSettings[K]) => setP((prev) => ({ ...prev, [key]: value }));

  const toggleTable = (t: number) =>
    setP((prev) => ({ ...prev, tables: prev.tables.includes(t) ? prev.tables.filter((x) => x !== t) : [...prev.tables, t].sort((a, b) => a - b) }));

  const start = () => {
    if (p.tables.length === 0) return;
    repo.savePracticeSettings(p);
    startSession({ mode: 'practice', ...p });
    navigate('/play');
  };

  return (
    <main className="screen">
      <TopBar title="練習" />
      <p className="muted" style={{ margin: 0, fontSize: 14 }}>
        時間制限なし。記録には残りません（苦手の分析には使います）。
      </p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="field">
          <span className="label">段（複数選べます）</span>
          <div className="tables num">
            {TABLES.map((t) => (
              <button key={t} type="button" aria-pressed={p.tables.includes(t)} onClick={() => toggleTable(t)}>
                {t}
              </button>
            ))}
          </div>
          <small className="muted">10〜19 の段でも、掛ける数は 1〜9 です</small>
        </div>
        <Segmented
          label="順番"
          value={p.order}
          options={[
            { value: 'sequential', label: '順番通り' },
            { value: 'random', label: 'ランダム' },
          ]}
          onChange={set('order')}
        />
        <Segmented label="問題数" value={p.count ?? 0} options={COUNT_OPTIONS} onChange={(v) => set('count')(v === 0 ? null : v)} />
        <Segmented label="問題形式" value={p.format} options={FORMAT_OPTIONS} onChange={set('format')} />
        <Segmented label="回答方法" value={p.method} options={METHOD_OPTIONS} onChange={set('method')} />
      </div>
      <button type="button" className="btn primary" onClick={start} disabled={p.tables.length === 0}>
        {p.tables.length === 0 ? '段を選んでください' : 'スタート'}
      </button>
    </main>
  );
}
