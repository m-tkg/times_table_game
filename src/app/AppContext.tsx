import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { GameConfig } from '../game/types.ts';
import { resolveStore } from '../storage/kv.ts';
import { Repository, type AppSettings } from '../storage/repository.ts';
import type { GameResult } from './finishGame.ts';

interface Session {
  config: GameConfig;
  /** 同じ設定でもう一度遊ぶときにゲームを作り直すための番号 */
  key: number;
}

interface AppContextValue {
  repo: Repository;
  /** localStorage に保存できるか */
  persistent: boolean;
  appSettings: AppSettings;
  updateAppSettings(patch: Partial<AppSettings>): void;
  session: Session | null;
  startSession(config: GameConfig): void;
  result: GameResult | null;
  setResult(result: GameResult | null): void;
  /** 記録を消したときなどに画面を読み直すための番号 */
  dataVersion: number;
  bumpDataVersion(): void;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [{ repo, persistent }] = useState(() => {
    const { store, persistent } = resolveStore();
    return { repo: new Repository(store), persistent };
  });
  const [appSettings, setAppSettings] = useState(() => repo.loadAppSettings());
  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const updateAppSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      setAppSettings((prev) => {
        const next = { ...prev, ...patch };
        repo.saveAppSettings(next);
        return next;
      });
    },
    [repo],
  );

  const startSession = useCallback((config: GameConfig) => {
    setSession((prev) => ({ config, key: (prev?.key ?? 0) + 1 }));
  }, []);

  const bumpDataVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  // テーマ: OS に従う / ライト / ダーク。SPEC §9
  useEffect(() => {
    const root = document.documentElement;
    if (appSettings.theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', appSettings.theme);
  }, [appSettings.theme]);

  const value = useMemo<AppContextValue>(
    () => ({
      repo,
      persistent,
      appSettings,
      updateAppSettings,
      session,
      startSession,
      result,
      setResult,
      dataVersion,
      bumpDataVersion,
    }),
    [repo, persistent, appSettings, updateAppSettings, session, startSession, result, dataVersion, bumpDataVersion],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider の外では使えません');
  return v;
}
