import { useState, type CSSProperties } from 'react';
import { kukuReading } from '../../domain/reading.ts';
import { Segmented } from '../Segmented.tsx';
import { TopBar } from '../TopBar.tsx';

type Size = 9 | 19;

const SIZE_OPTIONS: Array<{ value: Size; label: string }> = [
  { value: 9, label: '9 × 9' },
  { value: 19, label: '19 × 19' },
];

/** 暗記用の九九表。9 × 9 ではマスをタップすると九九の読み方を出す */
export function ChartScreen() {
  const [size, setSize] = useState<Size>(9);
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
                return (
                  <button
                    key={c}
                    type="button"
                    className={`cell ${isSelected ? 'selected' : inLine ? 'line' : ''}`}
                    aria-label={`${r} × ${c} = ${r * c}`}
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
    </main>
  );
}
