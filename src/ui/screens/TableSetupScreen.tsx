import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../app/AppContext.tsx';
import { DIFFICULTY_HINT, formatScore } from '../../app/labels.ts';
import type { TableCount } from '../../domain/records.ts';
import type { AnswerMethod, Difficulty } from '../../domain/types.ts';
import { tableBestKey, type TableSettings } from '../../storage/repository.ts';
import { Segmented } from '../Segmented.tsx';
import { TopBar } from '../TopBar.tsx';
import { DIFFICULTY_OPTIONS, METHOD_OPTIONS } from './SetupScreen.tsx';

const CELLS: Record<Difficulty, number> = { standard: 81, advanced: 90, expert: 100 };

export function TableSetupScreen() {
  const { repo, startSession } = useApp();
  const navigate = useNavigate();
  const [t, setT] = useState<TableSettings>(() => repo.loadTableSettings() ?? { difficulty: 'standard', count: 20, method: 'input' });
  const best = repo.loadBests()[tableBestKey(t.difficulty, t.count, t.method)];

  const start = () => {
    repo.saveTableSettings(t);
    startSession({ mode: 'table', difficulty: t.difficulty, count: t.count, method: t.method });
    navigate('/play');
  };

  const countOptions: Array<{ value: TableCount; label: string }> = [
    { value: 20, label: '20 マス' },
    { value: 'all', label: `全部（${CELLS[t.difficulty]} マス）` },
  ];

  return (
    <main className="screen">
      <TopBar title="表うめ" />
      <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
        九九表の赤いマスに入る数を答えて、表を埋めていきます。
      </p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Segmented<Difficulty>
          label="難易度"
          value={t.difficulty}
          options={DIFFICULTY_OPTIONS}
          onChange={(difficulty) => setT((prev) => ({ ...prev, difficulty }))}
          hint={DIFFICULTY_HINT[t.difficulty]}
        />
        <Segmented<TableCount> label="マス数" value={t.count} options={countOptions} onChange={(count) => setT((prev) => ({ ...prev, count }))} />
        <Segmented<AnswerMethod>
          label="回答方法"
          value={t.method}
          options={METHOD_OPTIONS}
          onChange={(method) => setT((prev) => ({ ...prev, method }))}
          hint={t.method === 'choice' ? '間違えたら +3 秒して正解を見せ、次のマスへ進みます' : '間違えたら同じマスのまま +3 秒'}
        />
      </div>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="muted" style={{ fontWeight: 800 }}>
          この設定のベスト
        </span>
        <b className="num" style={{ fontSize: 22 }}>
          {best ? `${formatScore('timeAttack', best.score).value} 秒` : '—'}
        </b>
      </div>
      <button type="button" className="btn primary" onClick={start}>
        スタート
      </button>
    </main>
  );
}
