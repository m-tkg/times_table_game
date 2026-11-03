/** Cloudflare Web Analytics のビーコン用トークン（公開ページに埋め込む前提の値） */
const CLOUDFLARE_BEACON_TOKEN = '289ee26afded45d2b01632b4757a7717';

/**
 * 利用者数の把握のため、公開版（本番ビルド）でだけ Cloudflare Web Analytics を読み込む。
 * Cookie は使わず、プレイの内容は送らない。オフラインのときは読み込めず、何も送られない。
 */
export function loadAnalytics(): void {
  if (!import.meta.env.PROD) return;
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.dataset.cfBeacon = JSON.stringify({ token: CLOUDFLARE_BEACON_TOKEN });
  document.head.appendChild(script);
}
