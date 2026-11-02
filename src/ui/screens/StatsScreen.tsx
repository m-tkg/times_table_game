import { useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../../app/AppContext.tsx';
import { DIFFICULTY_HINT, formatDate, formatPercent, formatScore, formatSeconds, settingsLabel } from '../../app/labels.ts';
import { ACHIEVEMENTS } from '../../domain/achievements.ts';
import { answerText, correctAnswerOf, correctAnswerText, questionText } from '../../domain/question.ts';
import { cellKey, heatmapAxes } from '../../domain/range.ts';
import { DEFAULT_SETTINGS, settingsKey, type NormalSettings, type PlayRecord } from '../../domain/records.ts';
import { accuracyOf, compareResults } from '../../domain/score.ts';
import { combinedCellStats, localDateKey, streakDays, type CellStats } from '../../domain/stats.ts';
import type { Difficulty, Rule } from '../../domain/types.ts';
import { bestKeyOf } from '../../storage/repository.ts';
import { Segmented } from '../Segmented.tsx';
import { TopBar } from '../TopBar.tsx';
import { DIFFICULTY_OPTIONS, FORMAT_OPTIONS, METHOD_OPTIONS, RULE_OPTIONS } from './SetupScreen.tsx';

type Tab = 'overview' | 'best' | 'trend' | 'heatmap' | 'history';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: '概要' },
  { id: 'best', label: 'ベスト' },
  { id: 'trend', label: '推移' },
  { id: 'heatmap', label: '苦手マップ' },
  { id: 'history', label: '履歴' },
];

export function StatsScreen() {
  const [tab, setTab] = useState<Tab>('overview');
  return (
    <main className="screen">
      <TopBar title="成績" />
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'best' && <Best />}
      {tab === 'trend' && <Trend />}
      {tab === 'heatmap' && <Heatmap />}
      {tab === 'history' && <History />}
    </main>
  );
}

function Overview() {
  const { repo } = useApp();
  const days = repo.loadDays();
  const today = localDateKey(new Date());
  const total = Object.values(days).reduce((a, b) => a + b, 0);
  const kpis = [
    { label: '累計解答数', value: total.toLocaleString() },
    { label: '今日の解答数', value: String(days[today] ?? 0) },
    { label: '累計プレイ日数', value: `${Object.keys(days).length} 日` },
    { label: '連続プレイ日数', value: `${streakDays(Object.keys(days), today)} 日` },
    { label: '記録したプレイ', value: `${repo.loadPlays().length} 回` },
    { label: '実績', value: `${Object.keys(repo.loadAchievements()).length} / ${ACHIEVEMENTS.length}` },
  ];
  return (
    <div className="kpis">
      {kpis.map((k) => (
        <div key={k.label} className="kpi">
          <small>{k.label}</small>
          <b className="num">{k.value}</b>
        </div>
      ))}
    </div>
  );
}

function SettingsFilter({ value, onChange }: { value: NormalSettings; onChange(v: NormalSettings): void }) {
  const set = <K extends keyof NormalSettings>(key: K) => (v: NormalSettings[K]) => onChange({ ...value, [key]: v });
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Segmented label="ルール" value={value.rule} options={RULE_OPTIONS} onChange={set('rule')} />
      <Segmented label="問題形式" value={value.format} options={FORMAT_OPTIONS} onChange={set('format')} />
      <Segmented label="回答方法" value={value.method} options={METHOD_OPTIONS} onChange={set('method')} />
      <Segmented label="難易度" value={value.difficulty} options={DIFFICULTY_OPTIONS} onChange={set('difficulty')} />
    </div>
  );
}

function scoreText(rule: Rule, score: number): string {
  const s = formatScore(rule, score);
  return `${s.value} ${s.unit}`;
}

function Best() {
  const { repo } = useApp();
  const [filter, setFilter] = useState<NormalSettings>(() => repo.loadLastSettings() ?? DEFAULT_SETTINGS);
  const key = settingsKey(filter);
  const best = repo.loadBests()[key];
  const recent = repo
    .loadPlays()
    .filter((p) => bestKeyOf(p) === key)
    .slice(-10)
    .reverse();
  return (
    <>
      <SettingsFilter value={filter} onChange={setFilter} />
      <div className="card">
        <h2>ベスト</h2>
        {best ? (
          <div className="list-row num">
            <b style={{ fontSize: 24 }}>{scoreText(filter.rule, best.score)}</b>
            <span className="muted">
              正答率 {formatPercent(accuracyOf(best))} ・ {formatDate(best.at)}
            </span>
          </div>
        ) : (
          <div className="empty">まだ記録がありません</div>
        )}
      </div>
      <div className="card">
        <h2>直近 10 回</h2>
        {recent.length === 0 ? (
          <div className="empty">まだ記録がありません</div>
        ) : (
          recent.map((p) => (
            <div key={p.id} className="list-row num">
              <span>{scoreText(filter.rule, p.score)}</span>
              <span className="muted">
                {formatPercent(accuracyOf(p))} ・ {formatDate(p.at)}
              </span>
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Trend() {
  const { repo } = useApp();
  const [daily, setDaily] = useState(false);
  const [filter, setFilter] = useState<NormalSettings>(() => repo.loadLastSettings() ?? DEFAULT_SETTINGS);
  const rule: Rule = daily ? 'timeAttack' : filter.rule;

  const points = useMemo(() => {
    const plays = daily ? Object.values(repo.loadDaily()) : repo.loadPlays().filter((p) => p.mode === 'normal' && settingsKey(p.settings) === settingsKey(filter));
    const byDay = new Map<string, PlayRecord>();
    for (const p of plays) {
      const day = p.dailyDate ?? localDateKey(new Date(p.at));
      const cur = byDay.get(day);
      if (!cur || compareResults(rule, p, cur) < 0) byDay.set(day, p);
    }
    return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, p]) => ({ day, score: p.score }));
  }, [repo, daily, filter, rule]);

  return (
    <>
      <Segmented
        label="対象"
        value={daily ? 'daily' : 'normal'}
        options={[
          { value: 'normal', label: '通常モード' },
          { value: 'daily', label: 'デイリー' },
        ]}
        onChange={(v) => setDaily(v === 'daily')}
      />
      {!daily && <SettingsFilter value={filter} onChange={setFilter} />}
      <div className="card chart">
        <h2>日ごとのベスト{rule === 'timeAttack' ? '（秒・下ほど速い）' : '（問）'}</h2>
        {points.length === 0 ? <div className="empty">まだ記録がありません</div> : <LineChart points={points} rule={rule} />}
      </div>
    </>
  );
}

function LineChart({ points, rule }: { points: Array<{ day: string; score: number }>; rule: Rule }) {
  const W = 320;
  const H = 180;
  const pad = { l: 36, r: 12, t: 12, b: 26 };
  const values = points.map((p) => (rule === 'timeAttack' ? p.score / 1000 : p.score));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const lo = min - span * 0.1;
  const hi = max + span * 0.1;
  const x = (i: number) => pad.l + (points.length === 1 ? (W - pad.l - pad.r) / 2 : (i / (points.length - 1)) * (W - pad.l - pad.r));
  // タイムアタックは小さいほど良いので、良い方が上に来るように反転する
  const y = (v: number) => {
    const ratio = (v - lo) / (hi - lo);
    return pad.t + (rule === 'timeAttack' ? ratio : 1 - ratio) * (H - pad.t - pad.b);
  };
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const fmt = (v: number) => (rule === 'timeAttack' ? v.toFixed(1) : String(Math.round(v)));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="日ごとのベストの推移">
      {[lo, (lo + hi) / 2, hi].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="3 4" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--muted)">
            {fmt(v)}
          </text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="4" fill="var(--surface)" stroke="var(--primary)" strokeWidth="2.5">
          <title>{`${points[i]?.day}: ${fmt(v)}`}</title>
        </circle>
      ))}
      {[0, points.length - 1].filter((v, i, a) => a.indexOf(v) === i).map((i) => (
        <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--muted)">
          {points[i]?.day.slice(5).replace('-', '/')}
        </text>
      ))}
    </svg>
  );
}

function Heatmap() {
  const { repo } = useApp();
  const [difficulty, setDifficulty] = useState<Difficulty>('standard');
  const [metric, setMetric] = useState<'accuracy' | 'time'>('accuracy');
  const [selected, setSelected] = useState<string | null>(null);
  const table = useMemo(() => combinedCellStats(repo.loadAnswers(), repo.loadCellStats())[difficulty], [repo, difficulty]);
  const { rows, cols } = heatmapAxes(difficulty);

  const avgTimes = Object.values(table).filter((c) => c.count > 0).map((c) => c.totalMs / c.count);
  const fast = avgTimes.length ? Math.min(...avgTimes) : 0;
  const slow = avgTimes.length ? Math.max(...avgTimes) : 1;

  // 0（苦手）〜1（得意）を赤→黄→緑に
  const color = (goodness: number) => `hsl(${Math.round(goodness * 140)} 65% 46%)`;
  const goodnessOf = (c: CellStats) => {
    if (metric === 'accuracy') return c.correct / c.count;
    const avg = c.totalMs / c.count;
    return slow === fast ? 1 : 1 - (avg - fast) / (slow - fast);
  };
  const label = (c: CellStats) => (metric === 'accuracy' ? Math.round((c.correct / c.count) * 100) : formatSeconds(c.totalMs / c.count));

  const detail = selected ? table[selected] : undefined;

  return (
    <>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Segmented label="難易度" value={difficulty} options={DIFFICULTY_OPTIONS} onChange={(d) => (setDifficulty(d), setSelected(null))} hint={DIFFICULTY_HINT[difficulty]} />
        <Segmented
          label="表示"
          value={metric}
          options={[
            { value: 'accuracy', label: '正答率' },
            { value: 'time', label: '平均時間' },
          ]}
          onChange={setMetric}
        />
      </div>
      <div className="card">
        <div className="heatmap num" style={{ gridTemplateColumns: `24px repeat(${cols.length}, 1fr)` }}>
          <span />
          {cols.map((c) => (
            <span key={c} className="head">
              {c}
            </span>
          ))}
          {rows.map((r) => (
            <Row key={r}>
              <span className="head">{r}</span>
              {cols.map((c) => {
                const key = cellKey(difficulty, r, c);
                const cell = table[key];
                return cell && cell.count > 0 ? (
                  <button key={key} type="button" style={{ background: color(goodnessOf(cell)) }} onClick={() => setSelected(key)} aria-label={`${r} × ${c}`}>
                    {label(cell)}
                  </button>
                ) : (
                  <button key={key} type="button" className="none" onClick={() => setSelected(key)} aria-label={`${r} × ${c} 記録なし`}>
                    ·
                  </button>
                );
              })}
            </Row>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="legend-bar" />
          <div className="legend">
            <span>{metric === 'accuracy' ? '低い' : '遅い'}</span>
            <span>{metric === 'accuracy' ? '高い' : '速い'}</span>
          </div>
        </div>
        <small className="muted">行 × 列。逆算の問題は含みません。</small>
      </div>
      {selected && (
        <div className="card num">
          <h2>{selected.replace('x', ' × ')}</h2>
          {detail && detail.count > 0 ? (
            <>
              <div className="list-row">
                <span>回答回数</span>
                <span>{detail.count} 回</span>
              </div>
              <div className="list-row">
                <span>正答率</span>
                <span>{formatPercent(detail.correct / detail.count)}</span>
              </div>
              <div className="list-row">
                <span>平均時間</span>
                <span>{formatSeconds(detail.totalMs / detail.count)} 秒</span>
              </div>
            </>
          ) : (
            <div className="muted">まだ記録がありません</div>
          )}
        </div>
      )}
    </>
  );
}

/** グリッドの 1 行（display: contents で親のグリッドに並べる） */
function Row({ children }: { children: ReactNode }) {
  return <div style={{ display: 'contents' }}>{children}</div>;
}

function History() {
  const { repo } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const plays = repo.loadPlays().slice(-50).reverse();
  const answers = useMemo(() => repo.loadAnswers(), [repo]);

  if (plays.length === 0) return <div className="card empty">まだ記録がありません</div>;

  return (
    <div className="card">
      {plays.map((p) => {
        const rows = open === p.id ? answers.filter((a) => a.playId === p.id) : [];
        return (
          <div key={p.id}>
            <button type="button" className="list-row num" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
              <span>
                <b>{scoreText(p.settings.rule, p.score)}</b>
                <small className="muted" style={{ display: 'block', fontSize: 12 }}>
                  {p.mode === 'daily' ? 'デイリー' : settingsLabel(p.settings)}
                </small>
              </span>
              <span className="muted">{formatDate(p.at)}</span>
            </button>
            {open === p.id && (
              <div style={{ padding: '4px 0 10px 8px' }}>
                {rows.length === 0 ? (
                  <small className="muted">このプレイの 1 問ごとの記録は保存期間を過ぎています</small>
                ) : (
                  rows.map((r, i) => (
                    <div key={i} className="list-row num" style={{ fontSize: 14 }}>
                      <span>
                        {r.correct ? '○' : <span className="x">✕</span>} {questionText(r.question)}
                      </span>
                      <span className="muted">
                        {r.correct ? answerText(r.answer) : `${answerText(r.answer)} → ${correctAnswerText(correctAnswerOf(r.question, r.difficulty))}`} ・{' '}
                        {formatSeconds(r.responseMs)}s
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
