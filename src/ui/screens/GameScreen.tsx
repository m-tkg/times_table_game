import { useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { useApp } from '../../app/AppContext.tsx';
import { playSound, vibrate } from '../../app/feedback.ts';
import { finishGame } from '../../app/finishGame.ts';
import { DIFFICULTY_HINT, formatSeconds } from '../../app/labels.ts';
import { correctAnswerText, judge } from '../../domain/question.ts';
import { randomSeed } from '../../domain/rng.ts';
import { SURVIVAL_LIVES, TIMED60_MS } from '../../domain/score.ts';
import type { Answer, Question } from '../../domain/types.ts';
import { createGame, gameClockMs, gameReducer, questionRemainingMs, timeRemainingMs, totalQuestions } from '../../game/engine.ts';
import type { GameConfig, GameState } from '../../game/types.ts';

const MAX_DIGITS = 3;

export function GameScreen() {
  const { session } = useApp();
  if (!session) return <Navigate to="/" replace />;
  return <GameView key={session.key} config={session.config} />;
}

function newPlayId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function GameView({ config }: { config: GameConfig }) {
  const { repo, appSettings, setResult, bumpDataVersion } = useApp();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(gameReducer, config, (c) =>
    createGame(c, { seed: randomSeed(), now: performance.now(), playId: newPlayId() }),
  );
  const [now, setNow] = useState(() => performance.now());
  // 入力中の値。素早いキー入力でも最新の値で判定できるよう ref にも持つ
  const inputRef = useRef<InputState>(EMPTY_INPUT);
  const [input, setInputState] = useState<InputState>(EMPTY_INPUT);
  const setInput = useCallback((next: InputState) => {
    inputRef.current = next;
    setInputState(next);
  }, []);
  const { slots, active: activeSlot } = input;
  const setActiveSlot = useCallback((active: 0 | 1) => setInput({ ...inputRef.current, active }), [setInput]);
  const finishedRef = useRef(false);

  // 時計: 表示の更新と、時間切れ・正答表示の終了の判定
  useEffect(() => {
    const id = window.setInterval(() => {
      const n = performance.now();
      setNow(n);
      dispatch({ type: 'tick', now: n, at: Date.now() });
    }, 50);
    return () => window.clearInterval(id);
  }, []);

  // タブ・アプリが非表示になったら自動で一時停止。SPEC §6.3
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) dispatch({ type: 'pause', now: performance.now() });
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onVisibility);
    };
  }, []);

  // 終了したら保存して結果画面へ
  useEffect(() => {
    if (state.phase !== 'finished' || finishedRef.current) return;
    finishedRef.current = true;
    const result = finishGame(repo, state, Date.now());
    setResult(result);
    bumpDataVersion();
    if (result.save.isNewBest && appSettings.sound) playSound('record');
    navigate('/result', { replace: true });
  }, [state, repo, setResult, bumpDataVersion, navigate, appSettings.sound]);

  // 問題が変わったら入力を消す
  useEffect(() => {
    setInput(EMPTY_INPUT);
  }, [state.questionNumber, setInput]);

  // 正誤の演出に合わせて効果音・振動。誤答（タイムアタック入力）なら入力を消す
  const lastFlash = useRef(0);
  useEffect(() => {
    const flash = state.flash;
    if (!flash || flash.id === lastFlash.current) return;
    lastFlash.current = flash.id;
    if (flash.kind === 'wrong') setInput(EMPTY_INPUT);
    if (appSettings.sound) {
      playSound(flash.kind === 'correct' && state.streak > 0 && state.streak % 5 === 0 ? 'combo' : flash.kind);
    }
    if (appSettings.vibration) vibrate(flash.kind);
  }, [state.flash, state.streak, appSettings.sound, appSettings.vibration, setInput]);

  const submitAnswer = useCallback((answer: Answer) => {
    dispatch({ type: 'answer', answer, now: performance.now(), at: Date.now() });
  }, []);

  const isFactor = state.question.kind === 'factor';
  const playing = state.phase === 'playing';

  const pressDigit = useCallback(
    (d: string) => {
      const { slots, active } = inputRef.current;
      const current = slots[active];
      if (current.length >= MAX_DIGITS) return;
      const next: [string, string] = [...slots];
      next[active] = current === '0' ? d : current + d;
      setInput({ slots: next, active });
    },
    [setInput],
  );

  const pressDelete = useCallback(() => {
    const { slots, active } = inputRef.current;
    // 右の欄が空なら左の欄に戻る
    if (slots[active] === '' && active === 1) {
      setInput({ slots, active: 0 });
      return;
    }
    const next: [string, string] = [...slots];
    next[active] = next[active].slice(0, -1);
    setInput({ slots: next, active });
  }, [setInput]);

  const switchSlot = useCallback(() => {
    if (!isFactor) return;
    const { slots, active } = inputRef.current;
    setInput({ slots, active: active === 0 ? 1 : 0 });
  }, [isFactor, setInput]);

  const pressSubmit = useCallback(() => {
    const { slots } = inputRef.current;
    if (isFactor) {
      if (slots[0] === '') return;
      if (slots[1] === '') {
        setInput({ slots, active: 1 });
        return;
      }
      submitAnswer([Number(slots[0]), Number(slots[1])]);
    } else if (slots[0] !== '') {
      submitAnswer(Number(slots[0]));
    }
  }, [isFactor, setInput, submitAnswer]);

  const togglePause = useCallback(() => {
    const n = performance.now();
    dispatch({ type: state.phase === 'paused' ? 'resume' : 'pause', now: n });
  }, [state.phase]);

  // PC のキーボード操作。SPEC §11
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        togglePause();
        return;
      }
      if (!playing) return;
      if (state.choices) {
        const index = Number(e.key) - 1;
        const choice = state.choices[index];
        if (choice !== undefined) {
          e.preventDefault();
          submitAnswer(choice);
        }
        return;
      }
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault();
        pressDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        pressDelete();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        pressSubmit();
      } else if (e.key === 'Tab' || e.key === 'x' || e.key === 'X' || e.key === '*') {
        e.preventDefault();
        switchSlot();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, state.choices, pressDigit, pressDelete, pressSubmit, switchSlot, submitAnswer, togglePause]);

  const quit = () => dispatch({ type: 'quit', now: performance.now() });
  const endless = config.mode === 'practice' && config.count === null;

  return (
    <main className="game">
      <Hud state={state} now={now} onPause={togglePause} onEnd={endless ? quit : undefined} />

      <div className="question-area">
        {state.phase === 'paused' ? (
          <div className="muted" style={{ fontWeight: 800 }}>
            一時停止中
          </div>
        ) : (
          <div>
            <div
              key={state.flash?.id ?? 0}
              className={`question num ${state.flash ? (state.flash.kind === 'correct' ? 'flash-correct' : 'flash-wrong') : ''}`}
            >
              <QuestionView question={state.question} slots={state.choices ? null : slots} activeSlot={activeSlot} onSlot={setActiveSlot} />
            </div>
            {state.streak >= 3 && <div className="combo num">COMBO ×{state.streak}</div>}
          </div>
        )}
      </div>

      {state.phase === 'feedback' && state.feedback && <FeedbackBanner state={state} />}

      {state.choices ? (
        <div className="choices">
          {state.choices.map((c, i) => {
            const fb = state.phase === 'feedback' ? state.feedback : null;
            const isRight = fb !== null && judge(state.question, c, state.questionDifficulty).correct;
            const isChosenWrong = fb !== null && fb.answer !== null && sameAnswer(fb.answer, c) && !isRight;
            return (
              <button
                key={`${state.questionNumber}-${i}`}
                type="button"
                className={`choice num ${isRight ? 'right' : ''} ${isChosenWrong ? 'wrong' : ''}`}
                disabled={!playing}
                onClick={() => submitAnswer(c)}
              >
                <small>{i + 1}</small>
                {typeof c === 'number' ? c : `${c[0]}×${c[1]}`}
              </button>
            );
          })}
        </div>
      ) : (
        <Keypad factor={isFactor} disabled={!playing} onDigit={pressDigit} onDelete={pressDelete} onSubmit={pressSubmit} onSwitch={switchSlot} />
      )}

      {state.phase === 'paused' && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label="一時停止">
          <div className="panel">
            <h2>一時停止</h2>
            <button type="button" className="btn primary" onClick={togglePause} autoFocus>
              再開する
            </button>
            <button type="button" className="btn" onClick={quit}>
              {config.mode === 'practice' ? '終了する' : 'やめる'}
            </button>
            {(config.mode === 'normal' || config.mode === 'daily') && (
              <small className="muted">途中でやめたプレイのスコアは記録されません</small>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

interface InputState {
  slots: [string, string];
  active: 0 | 1;
}

const EMPTY_INPUT: InputState = { slots: ['', ''], active: 0 };

function sameAnswer(a: Answer, b: Answer): boolean {
  if (typeof a === 'number' || typeof b === 'number') return a === b;
  return a[0] === b[0] && a[1] === b[1];
}

function Hud({ state, now, onPause, onEnd }: { state: GameState; now: number; onPause(): void; onEnd?: () => void }) {
  const { config, settings } = state;
  const timed = config.mode === 'normal' || config.mode === 'daily';
  const total = totalQuestions(state);
  let center: ReactNode;
  let progress: number | null = null;
  let warn = false;

  if (timed && settings.rule === 'timeAttack') {
    center = (
      <>
        <span className="num">
          {state.questionNumber} / {total}
        </span>
        <span className="num">{formatSeconds(gameClockMs(state, now) + state.penaltyMs)}s</span>
      </>
    );
    progress = state.answeredCount / (total ?? 1);
  } else if (timed && settings.rule === 'timed60') {
    const remaining = timeRemainingMs(state, now) ?? 0;
    center = (
      <>
        <span className="num">残り {formatSeconds(remaining)}s</span>
        <span className="num">{state.correctCount} 問</span>
      </>
    );
    progress = remaining / TIMED60_MS;
    warn = remaining < 10_000;
  } else if (timed && settings.rule === 'survival') {
    const remaining = questionRemainingMs(state, now) ?? 0;
    center = (
      <>
        <span className="lives" aria-label={`ライフ ${state.lives}`}>
          {'♥'.repeat(Math.max(0, state.lives))}
          {'♡'.repeat(Math.max(0, SURVIVAL_LIVES - state.lives))}
        </span>
        <span className="num">{state.correctCount} 問</span>
        <span className="num muted">{formatSeconds(state.survivalLimitMs)}s</span>
      </>
    );
    progress = state.phase === 'playing' ? remaining / state.survivalLimitMs : 0;
    warn = progress < 0.3;
  } else {
    center = (
      <>
        <span className="num">{total ? `${state.questionNumber} / ${total}` : `${state.questionNumber} 問目`}</span>
        <span className="num">正解 {state.correctCount}</span>
      </>
    );
    progress = total ? state.answeredCount / total : null;
  }

  return (
    <>
      <div className="hud">
        <button type="button" className="icon-btn" onClick={onPause} aria-label="一時停止">
          ❚❚
        </button>
        <div className="center">{center}</div>
        {onEnd ? (
          <button type="button" className="icon-btn" onClick={onEnd} aria-label="練習を終了" style={{ fontSize: 13 }}>
            終了
          </button>
        ) : (
          <span />
        )}
      </div>
      {progress !== null && (
        <div className={`progress ${warn ? 'warn' : ''}`}>
          <i style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }} />
        </div>
      )}
    </>
  );
}

function Slot({ value, active, onClick }: { value: string; active: boolean; onClick?: () => void }) {
  return (
    <span className={`slot ${active ? 'active' : ''} ${value === '' ? 'empty' : ''}`} onClick={onClick} role={onClick ? 'button' : undefined}>
      {value === '' ? '?' : value}
    </span>
  );
}

function QuestionView({
  question,
  slots,
  activeSlot,
  onSlot,
}: {
  question: Question;
  slots: [string, string] | null;
  activeSlot: 0 | 1;
  onSlot(s: 0 | 1): void;
}) {
  const slot = (i: 0 | 1) => (slots ? <Slot value={slots[i]} active={activeSlot === i} onClick={() => onSlot(i)} /> : <span className="slot empty">?</span>);
  switch (question.kind) {
    case 'product':
      return (
        <>
          {question.a} × {question.b} = {slot(0)}
        </>
      );
    case 'blank':
      return question.blank === 'left' ? (
        <>
          {slot(0)} × {question.b} = {question.a * question.b}
        </>
      ) : (
        <>
          {question.a} × {slot(0)} = {question.a * question.b}
        </>
      );
    case 'factor':
      return (
        <>
          {question.product} = {slot(0)} × {slot(1)}
        </>
      );
  }
}

function FeedbackBanner({ state }: { state: GameState }) {
  const fb = state.feedback;
  if (!fb) return null;
  return (
    <div className="feedback" role="status">
      <span className="mark" aria-hidden>
        ✕
      </span>
      <div>
        {fb.timeout ? '時間切れ ・ ' : ''}正解: <span className="num">{correctAnswerText(fb.correctAnswer)}</span>
        {fb.outOfRange && <small>その組は範囲外です（{DIFFICULTY_HINT[state.questionDifficulty]}）</small>}
      </div>
    </div>
  );
}

function Keypad({
  factor,
  disabled,
  onDigit,
  onDelete,
  onSubmit,
  onSwitch,
}: {
  factor: boolean;
  disabled: boolean;
  onDigit(d: string): void;
  onDelete(): void;
  onSubmit(): void;
  onSwitch(): void;
}) {
  const digit = (d: string) => (
    <button key={d} type="button" className="key num" disabled={disabled} onClick={() => onDigit(d)}>
      {d}
    </button>
  );
  return (
    <div className="pad">
      {['7', '8', '9', '4', '5', '6', '1', '2', '3'].map(digit)}
      <button type="button" className="key sub" disabled={disabled} onClick={onDelete} aria-label="1 文字消す">
        ⌫
      </button>
      {digit('0')}
      {factor ? (
        <button type="button" className="key sub" disabled={disabled} onClick={onSwitch} aria-label="左右の入力欄を切り替え">
          ⇄
        </button>
      ) : (
        <button type="button" className="key ok" disabled={disabled} onClick={onSubmit}>
          決定
        </button>
      )}
      {factor && (
        <button type="button" className="key ok" disabled={disabled} onClick={onSubmit} style={{ gridColumn: '1 / -1' }}>
          決定
        </button>
      )}
    </div>
  );
}
