import type { CSSProperties, ReactNode } from 'react';
import { heatmapAxes } from '../domain/range.ts';
import type { AnswerRecord } from '../domain/records.ts';
import type { Difficulty, Pair } from '../domain/types.ts';

export interface TableGridProps {
  difficulty: Difficulty;
  /** 埋まったマス（1 問ごとの記録。表うめでは正解したときに 1 件ずつ増える） */
  records: readonly AnswerRecord[];
  /** いま答えるマス（なければ null） */
  current: Pair | null;
  /** いまのマスが正解演出中か */
  justSolved?: boolean;
  /** 正解演出中に表示する値 */
  justSolvedValue?: number | null;
  /** いまのマスで間違え、正答を見せているか（4 択） */
  revealed?: boolean;
  /** 親の残りの高さ・幅に収まるように縮める（ゲーム画面） */
  fit?: boolean;
}

const keyOf = (a: number, b: number) => `${a}x${b}`;

/** 表うめの九九表。埋まったマスは数字を残し、一度間違えたマスには印をつける */
export function TableGrid({ difficulty, records, current, justSolved = false, justSolvedValue = null, revealed = false, fit = false }: TableGridProps) {
  const { rows, cols } = heatmapAxes(difficulty);
  const solved = new Map<string, boolean>();
  for (const r of records) {
    if (r.question.kind !== 'product') continue;
    solved.set(keyOf(r.question.a, r.question.b), r.correct);
  }
  const currentKey = current ? keyOf(current[0], current[1]) : null;

  const n = cols.length + 1;
  const m = rows.length + 1;
  const style = {
    gridTemplateColumns: `repeat(${n}, 1fr)`,
    gridTemplateRows: `repeat(${m}, 1fr)`,
    aspectRatio: `${n} / ${m}`,
    '--n': n,
  } as CSSProperties;
  const grid = (
    <div className={`table-grid num ${difficulty === 'standard' ? '' : 'wide'}`} style={style} role="grid" aria-label="九九表">
      <span className="corner" aria-hidden>
        ×
      </span>
      {cols.map((c) => (
        <span key={`h${c}`} className={`head ${current?.[1] === c ? 'on' : ''}`}>
          {c}
        </span>
      ))}
      {rows.map((r) => (
        <Row key={r}>
          <span className={`head ${current?.[0] === r ? 'on' : ''}`}>{r}</span>
          {cols.map((c) => {
            const key = keyOf(r, c);
            const isCurrent = key === currentKey;
            const firstTry = solved.get(key);
            if (isCurrent && revealed) {
              return (
                <span key={key} className="cell reveal" aria-current="true" aria-label={`${r} × ${c} = ${r * c}（正解）`}>
                  {r * c}
                </span>
              );
            }
            if (isCurrent) {
              return (
                <span key={key} className={`cell ${justSolved ? 'just' : 'current'}`} aria-current="true" aria-label={`${r} × ${c}`}>
                  {justSolved ? justSolvedValue : '?'}
                </span>
              );
            }
            if (firstTry !== undefined) {
              return (
                <span key={key} className={`cell solved ${firstTry ? '' : 'missed'}`} aria-label={`${r} × ${c} = ${r * c}${firstTry ? '' : '（一度間違えた）'}`}>
                  {r * c}
                </span>
              );
            }
            return <span key={key} className="cell" aria-label={`${r} × ${c} 未回答`} />;
          })}
        </Row>
      ))}
    </div>
  );
  return fit ? <div className="table-fit" style={{ '--ratio': n / m } as CSSProperties}>{grid}</div> : grid;
}

function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'contents' }}>{children}</div>;
}
