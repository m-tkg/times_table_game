import { useRegisterSW } from 'virtual:pwa-register/react';

/** 新しいバージョンがあるときに更新を促す。SPEC §12 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;
  return (
    <div className="toast" role="status">
      新しいバージョンがあります
      <button type="button" onClick={() => void updateServiceWorker(true)}>
        更新
      </button>
      <button type="button" onClick={() => setNeedRefresh(false)} style={{ background: 'transparent', color: 'inherit' }} aria-label="閉じる">
        ✕
      </button>
    </div>
  );
}
