import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { AppProvider } from './app/AppContext.tsx';
import { AchievementsScreen } from './ui/screens/AchievementsScreen.tsx';
import { GameScreen } from './ui/screens/GameScreen.tsx';
import { HomeScreen } from './ui/screens/HomeScreen.tsx';
import { PracticeScreen } from './ui/screens/PracticeScreen.tsx';
import { ResultScreen } from './ui/screens/ResultScreen.tsx';
import { SettingsScreen } from './ui/screens/SettingsScreen.tsx';
import { SetupScreen } from './ui/screens/SetupScreen.tsx';
import { StatsScreen } from './ui/screens/StatsScreen.tsx';
import { TableSetupScreen } from './ui/screens/TableSetupScreen.tsx';
import { WeaknessScreen } from './ui/screens/WeaknessScreen.tsx';
import { UpdatePrompt } from './ui/UpdatePrompt.tsx';

export function App() {
  return (
    <AppProvider>
      {/* GitHub Pages ではサーバー側でルーティングできないのでハッシュ方式 */}
      <HashRouter>
        <div className="app">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/setup" element={<SetupScreen />} />
            <Route path="/play" element={<GameScreen />} />
            <Route path="/result" element={<ResultScreen />} />
            <Route path="/weakness" element={<WeaknessScreen />} />
            <Route path="/practice" element={<PracticeScreen />} />
            <Route path="/table" element={<TableSetupScreen />} />
            <Route path="/stats" element={<StatsScreen />} />
            <Route path="/achievements" element={<AchievementsScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <UpdatePrompt />
      </HashRouter>
    </AppProvider>
  );
}
