import { Link, useNavigate } from 'react-router';
import { useApp } from '../../app/AppContext.tsx';
import { formatScore, settingsLabel } from '../../app/labels.ts';
import { ACHIEVEMENTS } from '../../domain/achievements.ts';
import { DEFAULT_SETTINGS, settingsKey } from '../../domain/records.ts';
import { localDateKey, streakDays } from '../../domain/stats.ts';

export function HomeScreen() {
  const { repo, persistent, startSession, dataVersion } = useApp();
  const navigate = useNavigate();
  void dataVersion;

  const last = repo.loadLastSettings();
  const settings = last ?? DEFAULT_SETTINGS;
  const best = repo.loadBests()[settingsKey(settings)];
  const today = localDateKey(new Date());
  const days = repo.loadDays();
  const streak = streakDays(Object.keys(days), today);
  const dailyToday = repo.loadDaily()[today];
  const achieved = Object.keys(repo.loadAchievements()).length;

  const quickStart = () => {
    repo.saveLastSettings(settings);
    startSession({ mode: 'normal', settings });
    navigate('/play');
  };

  const startDaily = () => {
    startSession({ mode: 'daily', date: today });
    navigate('/play');
  };

  const bestText = best ? formatScore(best.settings.rule, best.score) : null;

  return (
    <main className="screen">
      <header className="topbar">
        <div className="logo">
          KU<span>KU</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="chip">
            🔥 <b className="num">{streak}</b> 日連続
          </span>
          <Link to="/settings" className="icon-btn" aria-label="アプリ設定">
            ⚙
          </Link>
        </div>
      </header>

      {!persistent && <div className="notice">このブラウザでは記録を保存できません。遊ぶことはできます。</div>}

      <button type="button" className="hero" onClick={quickStart}>
        <small>{last ? '前回と同じ設定で開始' : 'まずはここから'}</small>
        <div className="big">▶ スタート</div>
        <div className="sub">{settingsLabel(settings)}</div>
        {bestText && (
          <div className="sub num" style={{ marginTop: 6 }}>
            ベスト {bestText.value} {bestText.unit}
          </div>
        )}
      </button>

      <button type="button" className="card daily" onClick={startDaily} style={{ textAlign: 'left' }}>
        <span className="badge">DAILY</span>
        <span style={{ flex: 1 }}>
          <b>デイリーチャレンジ</b>
          <span className="muted num" style={{ display: 'block', fontSize: 13 }}>
            {today.slice(5).replace('-', '/')} ・{' '}
            {dailyToday ? `挑戦済み ${formatScore('timeAttack', dailyToday.score).value} 秒（もう一度は記録されません）` : '未挑戦'}
          </span>
        </span>
        <span style={{ fontWeight: 900, color: 'var(--primary)' }}>›</span>
      </button>

      <div className="grid2">
        <Link to="/setup" className="tile">
          <div className="ico" style={{ background: 'var(--info)' }}>
            ⚙
          </div>
          設定を変えて開始
          <small>ルール・形式・難易度</small>
        </Link>
        <Link to="/weakness" className="tile">
          <div className="ico" style={{ background: 'var(--wrong)' }}>
            ◎
          </div>
          苦手克服
          <small>苦手な 20 問</small>
        </Link>
        <Link to="/practice" className="tile">
          <div className="ico" style={{ background: 'var(--secondary)' }}>
            ✎
          </div>
          練習
          <small>段を選んで</small>
        </Link>
        <Link to="/stats" className="tile">
          <div className="ico" style={{ background: 'var(--accent)' }}>
            ▤
          </div>
          成績
          <small>ベスト・推移・苦手マップ</small>
        </Link>
      </div>

      <Link to="/achievements" className="card daily">
        <span style={{ fontSize: 22 }}>🏅</span>
        <span style={{ flex: 1 }}>
          <b>実績</b>
          <span className="muted num" style={{ display: 'block', fontSize: 13 }}>
            {achieved} / {ACHIEVEMENTS.length} 獲得
          </span>
        </span>
        <span style={{ fontWeight: 900, color: 'var(--primary)' }}>›</span>
      </Link>
    </main>
  );
}
