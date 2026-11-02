import { useApp } from '../../app/AppContext.tsx';
import { formatDate } from '../../app/labels.ts';
import { ACHIEVEMENTS } from '../../domain/achievements.ts';
import { TopBar } from '../TopBar.tsx';

export function AchievementsScreen() {
  const { repo } = useApp();
  const unlocked = repo.loadAchievements();
  const count = Object.keys(unlocked).length;
  return (
    <main className="screen">
      <TopBar title="実績" />
      <div className="muted num" style={{ fontWeight: 800 }}>
        {count} / {ACHIEVEMENTS.length} 獲得
      </div>
      <div className="card">
        {ACHIEVEMENTS.map((a) => {
          const at = unlocked[a.id];
          return (
            <div key={a.id} className={`achievement ${at ? 'got' : ''}`}>
              <span className="medal" aria-hidden>
                🏅
              </span>
              <span style={{ flex: 1 }}>
                <b>{a.title}</b>
                <small>{a.description}</small>
              </span>
              <small className="muted num">{at ? formatDate(at) : '未獲得'}</small>
            </div>
          );
        })}
      </div>
    </main>
  );
}
