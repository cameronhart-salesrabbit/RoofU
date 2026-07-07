import React, { useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'fa-solid fa-chart-line', end: true },
  { to: '/admin/programs', label: 'Programs', icon: 'fa-solid fa-layer-group' },
  { to: '/admin/courses', label: 'Courses', icon: 'fa-solid fa-book-open' },
  { to: '/admin/users', label: 'Users', icon: 'fa-solid fa-users' },
  { to: '/admin/progress', label: 'Progress', icon: 'fa-solid fa-chart-bar' },
  { to: '/admin/completion', label: 'Completion', icon: 'fa-solid fa-circle-check' },
];

export default function AdminLayout() {
  const { isAdmin, logout } = useAdminAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) navigate('/admin/login');
  }, [isAdmin, navigate]);

  if (!isAdmin) return null;

  return (
    <div style={styles.shell} className="admin-shell">
      <aside style={styles.sidebar} className="admin-sidebar">
        <div style={styles.logoWrap}>
          <span style={styles.logoText}>Roof<span style={styles.logoU}>U</span></span>
          <span style={styles.adminBadge}>Admin</span>
        </div>
        <nav style={styles.nav} className="admin-nav">
          {NAV.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              <i className={icon} style={styles.navIcon} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => { logout(); navigate('/admin/login'); }}
          style={styles.logoutBtn}
        >
          Sign Out
        </button>
      </aside>
      <main style={styles.main} className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    width: '220px',
    minWidth: '220px',
    background: 'var(--gray-900)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 0',
    position: 'sticky',
    top: 0,
    height: '100vh',
  },
  logoWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 20px 24px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: '8px',
  },
  logoText: {
    fontSize: '20px',
    fontFamily: 'var(--font-display)',
    fontWeight: '400',
    color: 'var(--white)',
    letterSpacing: '0',
  },
  logoU: {
    color: 'var(--red)',
  },
  adminBadge: {
    background: 'rgba(244,97,0,0.18)',
    color: '#F46100',
    fontSize: '10px',
    fontWeight: '700',
    padding: '2px 7px',
    borderRadius: '999px',
    letterSpacing: '0.5px',
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 12px',
    gap: '2px',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '9px 12px',
    borderRadius: '7px',
    fontSize: '14px',
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    transition: 'all 0.15s',
  },
  navLinkActive: {
    background: 'var(--red)',
    color: 'var(--white)',
  },
  navIcon: {
    fontSize: '13px',
    width: '14px',
  },
  logoutBtn: {
    margin: '0 12px',
    padding: '9px 12px',
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '7px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    fontWeight: '500',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  main: {
    flex: 1,
    padding: '32px',
    overflowY: 'auto',
    maxWidth: '1100px',
  },
};
