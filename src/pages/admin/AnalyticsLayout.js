import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: 'dashboard', label: 'Dashboard' },
  { to: 'progress', label: 'Progress' },
  { to: 'completion', label: 'Completion' },
  { to: 'quiz', label: 'Quiz Analytics' },
];

export default function AnalyticsLayout() {
  return (
    <div>
      <div className="page-header">
        <h1>Analytics</h1>
      </div>
      <div style={styles.tabs}>
        {TABS.map(t => (
          <NavLink key={t.to} to={t.to} style={({ isActive }) => ({ ...styles.tab, ...(isActive ? styles.tabActive : {}) })}>
            {t.label}
          </NavLink>
        ))}
      </div>
      <Outlet />
    </div>
  );
}

const styles = {
  tabs: { display: 'flex', gap: 4, borderBottom: '1px solid var(--gray-200)', marginBottom: 24 },
  tab: { padding: '10px 16px', fontSize: 14, fontWeight: 600, color: 'var(--gray-500)', borderBottom: '2px solid transparent', marginBottom: -1, textDecoration: 'none' },
  tabActive: { color: 'var(--red)', borderBottomColor: 'var(--red)' },
};
