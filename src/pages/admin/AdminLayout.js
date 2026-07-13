import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { supabase } from '../../supabase/client';

const BASE_NAV = [
  { to: '/admin/analytics', label: 'Analytics', icon: 'fa-solid fa-chart-line' },
  { to: '/admin/programs', label: 'Programs', icon: 'fa-solid fa-layer-group' },
  { to: '/admin/courses', label: 'Courses', icon: 'fa-solid fa-book-open' },
  { to: '/admin/users', label: 'Users', icon: 'fa-solid fa-users' },
];

export default function AdminLayout() {
  const { isAdmin, isSuperAdmin, loading, selectedClientId, setSelectedClientId, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState([]);

  useEffect(() => {
    if (!loading && !isAdmin) navigate('/admin/login');
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    async function loadClients() {
      const { data } = await supabase.from('clients').select('id, name').order('name');
      setClients(data || []);
    }
    loadClients();
  }, [isSuperAdmin]);

  // Default to the first client so a super-admin never lands on an empty screen.
  useEffect(() => {
    if (isSuperAdmin && !selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
  }, [isSuperAdmin, selectedClientId, clients, setSelectedClientId]);

  if (loading) return null;
  if (!isAdmin) return null;

  const nav = isSuperAdmin
    ? [...BASE_NAV, { to: '/admin/clients', label: 'Clients', icon: 'fa-solid fa-building' }]
    : BASE_NAV;

  return (
    <div style={styles.shell} className="admin-shell">
      <aside style={styles.sidebar} className="admin-sidebar">
        <div style={styles.logoWrap}>
          <span style={styles.logoText}>Roof<span style={styles.logoU}>U</span></span>
          <span style={styles.adminBadge}>Admin</span>
        </div>

        {isSuperAdmin && (
          <div style={styles.clientSwitcher}>
            <div style={styles.clientSwitcherLabel}>Managing</div>
            <select
              value={selectedClientId || ''}
              onChange={e => setSelectedClientId(e.target.value)}
              style={styles.clientSelect}
            >
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}

        <nav style={styles.nav} className="admin-nav">
          {nav.map(({ to, label, icon, end }) => (
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
          onClick={() => navigate('/')}
          style={{ ...styles.logoutBtn, marginBottom: 8, color: 'rgba(255,255,255,0.7)', borderColor: 'rgba(255,255,255,0.2)' }}
        >
          <i className="fa-solid fa-graduation-cap" style={{ marginRight: 8, fontSize: 12 }} />
          Learner View
        </button>
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
  clientSwitcher: {
    padding: '0 20px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    marginBottom: '8px',
  },
  clientSwitcherLabel: {
    fontSize: '10px',
    fontWeight: '700',
    letterSpacing: '0.8px',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: '6px',
  },
  clientSelect: {
    width: '100%',
    padding: '7px 8px',
    fontSize: '13px',
    borderRadius: '7px',
    border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--white)',
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
