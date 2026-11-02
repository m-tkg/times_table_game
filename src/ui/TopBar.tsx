import type { ReactNode } from 'react';
import { Link } from 'react-router';

export function TopBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <header className="topbar">
      <Link to="/" className="icon-btn" aria-label="ホームへ戻る">
        ‹
      </Link>
      <h1>{title}</h1>
      <div style={{ width: 44 }}>{right}</div>
    </header>
  );
}
