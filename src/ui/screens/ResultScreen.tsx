import { Link, Navigate, useNavigate } from 'react-router';
import { useApp } from '../../app/AppContext.tsx';
import { formatPercent, formatScore, formatSeconds, settingsLabel } from '../../app/labels.ts';
import { answerText, correctAnswerOf, correctAnswerText, questionText } from '../../domain/question.ts';
import { accuracyOf } from '../../domain/score.ts';
import type { PlayRecord } from '../../domain/records.ts';
import type { Rule } from '../../domain/types.ts';

function Diff({ rule, current, base, label }: { rule: Rule; current: number; base: PlayRecord | null; label: string }) {
  if (!base) {
    return (
      <div className="stat">
        <b className="num muted">—</b>
        <small>{label}</small>
      </div>
    );
  }
  const diff = current - base.score;
  // タイムアタックは小さいほど良い
  const better = rule === 'timeAttack' ? diff < 0 : diff > 0;
  const text = rule === 'timeAttack' ? `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${formatSeconds(Math.abs(diff))}s` : `${diff > 0 ? '+' : diff < 0 ? '−' : '±'}${Math.abs(diff)}`;
  return (
    <div className="stat">
      <b className={`num ${diff === 0 ? '' : better ? 'better' : 'worse'}`}>{text}</b>
      <small>{label}</small>
    </div>
  );
}

export function ResultScreen() {
  const { result, session, startSession } = useApp();
  const navigate = useNavigate();
  if (!result) return <Navigate to="/" replace />;

  const { state, summary, play, save, newAchievements } = result;
  const { config, settings } = state;
  const recordMode = config.mode === 'normal' || config.mode === 'daily';
  const accuracy = accuracyOf(summary);

  const again = () => {
    if (!session) return;
    startSession(session.config);
    navigate('/play', { replace: true });
  };

  const title =
    config.mode === 'daily' ? 'デイリーチャレンジ' : config.mode === 'weakness' ? '苦手克服' : config.mode === 'practice' ? '練習' : settingsLabel(settings);

  return (
    <main className="screen">
      <div className="result-head">
        {save.isNewBest && save.previousBest && <div className="newrec">NEW RECORD!</div>}
        {save.isNewBest && !save.previousBest && <div className="newrec">FIRST RECORD</div>}
        {state.aborted ? (
          <div className="score" style={{ fontSize: 32 }}>
            中断しました
          </div>
        ) : recordMode ? (
          <div className="score num">
            {formatScore(settings.rule, play?.score ?? 0).value}
            <small>{formatScore(settings.rule, play?.score ?? 0).unit}</small>
          </div>
        ) : (
          <div className="score num">
            {formatPercent(accuracy)}
            <small>正答率</small>
          </div>
        )}
        <div className="muted" style={{ fontWeight: 700, marginTop: 6 }}>
          {title}
        </div>
        {config.mode === 'daily' && !save.dailyRecorded && !state.aborted && (
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            今日の記録は 1 回目のプレイで保存済みです
          </div>
        )}
        {state.aborted && recordMode && (
          <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            途中でやめたプレイのスコアは記録されません
          </div>
        )}
        {!save.ok && (
          <div className="notice" style={{ marginTop: 8 }}>
            記録を保存できませんでした（ブラウザの保存容量が足りない可能性があります）
          </div>
        )}
      </div>

      {recordMode && play ? (
        <div className="stats">
          <div className="stat">
            <b className="num">{formatPercent(accuracy)}</b>
            <small>正答率</small>
          </div>
          <Diff rule={settings.rule} current={play.score} base={save.previousBest} label="ベスト比" />
          <Diff rule={settings.rule} current={play.score} base={save.previousPlay} label="前回比" />
        </div>
      ) : (
        <div className="stats">
          <div className="stat">
            <b className="num">{summary.correctCount}</b>
            <small>正解</small>
          </div>
          <div className="stat">
            <b className="num">{summary.answeredCount}</b>
            <small>回答</small>
          </div>
          <div className="stat">
            <b className="num">{formatSeconds(summary.totalMs)}s</b>
            <small>時間</small>
          </div>
        </div>
      )}

      {newAchievements.length > 0 && (
        <div className="card">
          <h2>🏅 実績獲得</h2>
          {newAchievements.map((a) => (
            <div key={a.id} className="achievement got">
              <span className="medal" aria-hidden>
                🏅
              </span>
              <span>
                <b>{a.title}</b>
                <small>{a.description}</small>
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>間違えた問題</h2>
        {state.wrongRecords.length === 0 ? (
          <div className="muted" style={{ fontWeight: 700 }}>
            {summary.answeredCount > 0 ? 'ノーミス！' : 'なし'}
          </div>
        ) : (
          state.wrongRecords.map((r, i) => (
            <div key={i} className="list-row num">
              <span>{questionText(r.question)}</span>
              <span>
                <span className="x">{answerText(r.answer)}</span> → {correctAnswerText(correctAnswerOf(r.question, r.difficulty))}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="btn-row">
        <Link to="/" className="btn" replace>
          ホーム
        </Link>
        <button type="button" className="btn primary" onClick={again} autoFocus>
          もう一度
        </button>
      </div>
    </main>
  );
}
