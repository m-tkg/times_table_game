import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { loadAnalytics } from './app/analytics.ts';
import './styles/global.css';

const root = document.getElementById('root');
if (!root) throw new Error('#root が見つかりません');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

loadAnalytics();
