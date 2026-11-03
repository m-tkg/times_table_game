import { useMemo, useState, type CSSProperties } from 'react';
import { useApp } from '../../app/AppContext.tsx';
import { kukuReading } from '../../domain/reading.ts';
import { chartMisses, combinedCellStats } from '../../domain/stats.ts';
import { Segmented } from '../Segmented.tsx';
import { TopBar } from '../TopBar.tsx';

type Size = 9 | 19;

const SIZE_OPTIONS: Array<{ value: Size; label: string }> = [
  { value: 9, label: '9 × 9' },
  { value: 19, label: '19 × 19' },
];

/** 暗記用の九九表。間違えた回数が多いマスほど赤くする。9 × 9 ではマスをタップすると九九の読み方を出す */
export function ChartScreen() {
  const { repo } = useApp();
  const [size, setSize] = useState<Size>(9);
  const stats = useMemo(() => combinedCellStats(repo.loadAnswers(), repo.loadCellStats()), [repo]);
  const { misses, max } = useMemo(() => chartMisses(stats, size), [stats, size]);
  const [selected, setSelected] = useState<readonly [number, number] | null>(null);
  const axis = Array.from({ length: size }, (_, i) => i + 1);
  const n = size + 1;

  const changeSize = (next: Size) => {
    setSize(next);
    setSelected(null);
  };
  const toggle = (r: number, c: number) => setSelected((prev) => (prev && prev[0] === r && prev[1] === c ? null : [r, c]));

  return (
    <main className="screen">
      <TopBar title="九九表" />
      <Segmented<Size>
        label="範囲"
        value={size}
        options={SIZE_OPTIONS}
        onChange={changeSize}
        hint={size === 9 ? 'マスをタップすると読み方が出ます' : 'マスをタップすると段と列に色がつきます。横にスクロールできます'}
      />
      <div className={`chart-scroll ${size === 19 ? 'big' : ''}`}>
        <div
          className={`table-grid chart num ${size === 19 ? 'big' : ''}`}
          style={{ gridTemplateColumns: `repeat(${n}, 1fr)`, '--n': n } as CSSProperties}
          role="grid"
          aria-label="九九表"
        >
          <span className="corner" aria-hidden>
            ×
          </span>
          {axis.map((c) => (
            <span key={`h${c}`} className={`head col ${selected?.[1] === c ? 'on' : ''}`}>
              {c}
            </span>
          ))}
          {axis.map((r) => (
            <div key={r} style={{ display: 'contents' }}>
              <span className={`head row ${selected?.[0] === r ? 'on' : ''}`}>{r}</span>
              {axis.map((c) => {
                const isSelected = selected?.[0] === r && selected[1] === c;
                const inLine = selected !== null && (selected[0] === r || selected[1] === c);
                const reading = size === 9 && isSelected ? kukuReading(r, c) : null;
                const miss = misses.get(`${r}x${c}`) ?? 0;
                const heat = max > 0 ? miss / max : 0;
                return (
                  <button
                    key={c}
                    type="button"
                    className={`cell ${isSelected ? 'selected' : inLine ? 'line' : ''} ${heat > 0.55 && !isSelected ? 'hot' : ''}`}
                    style={miss > 0 && !isSelected ? { background: `color-mix(in srgb, var(--wrong) ${Math.round(15 + heat * 70)}%, var(--surface))` } : undefined}
                    aria-label={`${r} × ${c} = ${r * c}${miss > 0 ? `（間違えた回数 ${miss}）` : ''}`}
                    aria-pressed={isSelected}
                    onClick={() => toggle(r, c)}
                  >
                    {r * c}
                    {reading && (
                      <span className={`hint-bubble chart-bubble ${r > 5 ? 'up' : ''} ${c <= 3 ? 'left' : c >= 7 ? 'right' : ''}`} role="tooltip">
                        {reading}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        {max > 0 ? (
          <>
            <div className="legend-row">
              <span>間違い 少</span>
              <i className="chart-legend-bar" />
              <span>多</span>
            </div>
            <small className="muted">赤いほど間違えた回数が多いマスです（逆算の問題は含みません）</small>
          </>
        ) : (
          <small className="muted">ゲームで間違えたマスは赤く表示されます</small>
        )}
      </div>
    </main>
  );
}
