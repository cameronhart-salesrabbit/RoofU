import React, { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import LearnerLogin from './LearnerLogin';

export default function LearnerLayout() {
  const [user, setUser] = useState(null);         // row from users table
  const [authLoading, setAuthLoading] = useState(true);
  const [searchVal, setSearchVal] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const isLessonView = location.pathname.startsWith('/lessons/');

  useEffect(() => {
    async function loadProfile(authUserId) {
      if (!authUserId) { setUser(null); setAuthLoading(false); return; }
      const { data } = await supabase.from('users').select('*').eq('auth_id', authUserId).single();
      setUser(data || null);
      setAuthLoading(false);
    }

    supabase.auth.getSession().then(({ data }) => {
      loadProfile(data.session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      loadProfile(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  }

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--gray-300)' }}>Roof<span style={{ color: 'var(--red)' }}>U</span></div>
      </div>
    );
  }

  if (!user) return <LearnerLogin />;

  return (
    <div style={styles.shell}>
      <header style={styles.header} className="learner-header">
        <Link to="/" style={styles.logo}>ROOFU</Link>
        <nav style={styles.nav}>
          <NavLink to="/" end style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}>My Programs</NavLink>
          <NavLink to="/dashboard" style={({ isActive }) => ({ ...styles.navLink, ...(isActive ? styles.navLinkActive : {}) })}>Progress</NavLink>
        </nav>
        {!isLessonView && (
          <form onSubmit={e => { e.preventDefault(); if (searchVal.trim()) { navigate(`/?q=${encodeURIComponent(searchVal.trim())}`); searchRef.current?.blur(); } }} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={styles.searchWrap}>
              <i className="fa-solid fa-magnifying-glass" style={styles.searchIcon} />
              <input
                ref={searchRef}
                type="search"
                placeholder="Search programs…"
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
                style={styles.searchInput}
              />
            </div>
          </form>
        )}
        <div style={styles.userArea}>
          <span style={styles.userName}>{user.name}</span>
          <button onClick={handleLogout} style={styles.logoutBtn}>Sign Out</button>
        </div>
      </header>
      <main style={isLessonView ? styles.mainFull : styles.main} className="learner-main">
        <Outlet context={{ user }} />
      </main>
    </div>
  );
}

const styles = {
  shell: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: {
    height: 56,
    background: 'var(--pitch)',
    borderBottom: '1px solid var(--pitch-800)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 28px',
    gap: 24,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  logo: { fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: '400', color: 'var(--white)', letterSpacing: '0', textDecoration: 'none' },
  nav: { display: 'flex', gap: 2, flex: 1 },
  navLink: { padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)' },
  navLinkActive: { background: 'rgba(244,97,0,0.15)', color: 'var(--red)' },
  searchWrap: { position: 'relative', display: 'flex', alignItems: 'center' },
  searchIcon: { position: 'absolute', left: 10, fontSize: 11, color: 'rgba(255,255,255,0.35)', pointerEvents: 'none' },
  searchInput: { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '6px 10px 6px 28px', fontSize: 13, color: 'rgba(255,255,255,0.8)', outline: 'none', width: 200 },
  userArea: { display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' },
  userName: { fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.65)' },
  logoutBtn: { background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' },
  main: { flex: 1, padding: '32px', maxWidth: 1000, margin: '0 auto', width: '100%' },
  mainFull: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
};
