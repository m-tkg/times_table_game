import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useApp } from '../../app/AppContext.tsx';
import { DIFFICULTY_HINT } from '../../app/labels.ts';
import { cellKey, pairsInRange } from '../../domain/range.ts';
import { createRng, randomSeed } from '../../domain/rng.ts';
import { recordCellKey } from '../../domain/stats.ts';
import type { AnswerMethod, Difficulty } from '../../domain/types.ts';
import { pickWeakKeys, weaknessScores } from '../../domain/weakness.ts';
import { Segmented } from '../Segmented.tsx';
import { TopBar } from '../TopBar.tsx';
import { DIFFICULTY_OPTIONS, METHOD_OPTIONS } from './SetupScreen.tsx';

const QUESTIONS = 20;

export function WeaknessScreen() {
  const { repo, startSession } = useApp();
  const navigate = useNavigate();
  const saved = repo.loadWeaknessSettings();
  const [difficulty, setDifficulty] = useState<Difficulty>(saved?.difficulty ?? 'standard');
  const [method, setMethod] = useState<AnswerMethod>(saved?.method ?? 'input');

  const scores = useMemo(() => {
    const keys = [...new Set(pairsInRange(difficulty).map(([a, b]) => cellKey(difficulty, a, b)))];
    const observations = repo
      .loadAnswers()
      .filter((r) => r.difficulty === difficulty)
      .flatMap((r) => {
        const key = recordCellKey(r);
        return key ? [{ key, correct: r.correct, responseMs: r.responseMs }] : [];
      });
    return { map: weaknessScores(observations, keys), observed: observations.length };
  }, [repo, difficulty]);

  const top = [...scores.map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const start = () => {
    repo.saveWeaknessSettings({ difficulty, method });
    const keys = pickWeakKeys(scores.map, QUESTIONS, createRng(randomSeed()));
    startSession({ mode: 'weakness', difficulty, method, keys });
    navigate('/play');
  };

  return (
    <main className="screen">
      <TopBar title="苦手克服" />
      <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
        間違えやすい・時間がかかる組み合わせを多めに 20 問出します。時間制限なし、記録には残りません。
      </p>
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Segmented label="難易度" value={difficulty} options={DIFFICULTY_OPTIONS} onChange={setDifficulty} hint={DIFFICULTY_HINT[difficulty]} />
        <Segmented label="回答方法" value={method} options={METHOD_OPTIONS} onChange={setMethod} />
      </div>
      <div className="card">
        <h2>いまの苦手（上位）</h2>
        {scores.observed === 0 ? (
          <div className="muted" style={{ fontWeight: 700 }}>
            まだこの難易度の記録がありません。まんべんなく出題します。
          </div>
        ) : (
          <div className="num" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {top.map(([key, score]) => (
              <span key={key} className="chip">
                {key.replace('x', ' × ')} <b>{Math.round(score * 100)}</b>
              </span>
            ))}
          </div>
        )}
      </div>
      <button type="button" className="btn primary" onClick={start}>
        スタート
      </button>
    </main>
  );
}
