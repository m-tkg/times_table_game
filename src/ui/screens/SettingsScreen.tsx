import { useState } from 'react';
import { useApp } from '../../app/AppContext.tsx';
import { playSound, vibrate } from '../../app/feedback.ts';
import type { ThemeSetting } from '../../storage/repository.ts';
import { Segmented } from '../Segmented.tsx';
import { TopBar } from '../TopBar.tsx';

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange(v: boolean): void }) {
  return (
    <div className="toggle-row">
      <span>{label}</span>
      <button type="button" role="switch" aria-checked={checked} aria-label={label} className="switch" onClick={() => onChange(!checked)} />
    </div>
  );
}

export function SettingsScreen() {
  const { repo, appSettings, updateAppSettings, bumpDataVersion, setResult } = useApp();
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);

  const clearAll = () => {
    repo.clearAll();
    repo.saveAppSettings(appSettings);
    setResult(null);
    bumpDataVersion();
    setConfirming(false);
    setCleared(true);
  };

  return (
    <main className="screen">
      <TopBar title="アプリ設定" />
      <div className="card">
        <Toggle label="自動で判定する" checked={appSettings.autoSubmit} onChange={(v) => updateAppSettings({ autoSubmit: v })} />
        <small className="muted" style={{ display: 'block', margin: '-2px 0 8px', fontSize: 12 }}>
          正答と同じ桁数まで入力したら、決定を押さなくても判定します
        </small>
        <Toggle
          label="効果音"
          checked={appSettings.sound}
          onChange={(v) => {
            updateAppSettings({ sound: v });
            if (v) playSound('correct');
          }}
        />
        <Toggle
          label="振動（Android のみ）"
          checked={appSettings.vibration}
          onChange={(v) => {
            updateAppSettings({ vibration: v });
            if (v) vibrate('correct');
          }}
        />
      </div>
      <div className="card">
        <Segmented<ThemeSetting>
          label="テーマ"
          value={appSettings.theme}
          options={[
            { value: 'system', label: 'OS に従う' },
            { value: 'light', label: 'ライト' },
            { value: 'dark', label: 'ダーク' },
          ]}
          onChange={(theme) => updateAppSettings({ theme })}
        />
      </div>
      <div className="card">
        <h2>ホーム画面に追加する</h2>
        <p style={{ margin: '0 0 8px', fontSize: 14, lineHeight: 1.6 }}>
          アプリのように起動でき、電波がなくても遊べます。
          <b>iPhone・iPad では、ホーム画面に追加しておくと記録が消えにくくなります</b>
          （Safari は 7 日間開かなかったサイトのデータを消すことがあるため）。
        </p>
        <b style={{ fontSize: 14 }}>iPhone・iPad（Safari）</b>
        <ol className="howto">
          <li>画面下の共有ボタン（□ に ↑）を押す</li>
          <li>「ホーム画面に追加」を選ぶ</li>
        </ol>
        <b style={{ fontSize: 14 }}>Android（Chrome）</b>
        <ol className="howto">
          <li>右上の ⋮ メニューを開く</li>
          <li>「ホーム画面に追加」または「アプリをインストール」を選ぶ</li>
        </ol>
      </div>
      <div className="card">
        <h2>データ</h2>
        <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
          記録はこの端末のこのブラウザだけに保存されています。
        </p>
        {cleared && <div className="notice" style={{ marginBottom: 10 }}>すべての記録を削除しました</div>}
        <button type="button" className="btn danger" onClick={() => setConfirming(true)}>
          すべての記録を削除
        </button>
      </div>

      {confirming && (
        <div className="overlay" role="alertdialog" aria-modal="true" aria-label="記録の削除の確認">
          <div className="panel card">
            <h2>本当に削除しますか？</h2>
            <p style={{ margin: 0 }}>成績・ベスト記録・実績・苦手の分析がすべて消えます。元に戻せません。</p>
            <button type="button" className="btn primary" onClick={() => setConfirming(false)} autoFocus>
              やめる
            </button>
            <button type="button" className="btn danger" onClick={clearAll}>
              削除する
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
