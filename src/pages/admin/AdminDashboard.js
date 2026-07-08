import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';

const PRODUCTS = ['SalesRabbit', 'SalesRabbit+', 'RoofLink', 'Roofle', 'Roofing General'];
const PRODUCT_COLORS = {
  'SalesRabbit': '#F46100',
  'SalesRabbit+': '#688393',
  'RoofLink': '#688393',
  'Roofle': '#6A7A56',
  'Roofing General': '#9AB485',
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ programs: 0, courses: 0, users: 0, lessons: 0, quizzes: 0 });
  const [coursesByProduct, setCoursesByProduct] = useState([]);
  const [recentCourses, setRecentCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      const [
        { count: programs },
        { count: courses },
        { count: users },
        { count: lessons },
        { count: quizzes },
        { data: allCourses },
        { data: recent },
      ] = await Promise.all([
        supabase.from('programs').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('lessons').select('*', { count: 'exact', head: true }),
        supabase.from('quizzes').select('*', { count: 'exact', head: true }),
        supabase.from('courses').select('product'),
        supabase.from('courses').select('id, title, product, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      setStats({ programs: programs || 0, courses: courses || 0, users: users || 0, lessons: lessons || 0, quizzes: quizzes || 0 });

      // Tally courses per product
      const tally = {};
      (allCourses || []).forEach(c => { tally[c.product] = (tally[c.product] || 0) + 1; });
      setCoursesByProduct(PRODUCTS.map(p => ({ product: p, count: tally[p] || 0 })).filter(p => p.count > 0));
      setRecentCourses(recent || []);
      setLoading(false);
    }
    fetchStats();
  }, []);

  const statCards = [
    { label: 'Programs', value: stats.programs, path: '/admin/programs' },
    { label: 'Courses', value: stats.courses, path: '/admin/courses' },
    { label: 'Lessons', value: stats.lessons, path: '/admin/courses' },
    { label: 'Quizzes', value: stats.quizzes, path: '/admin/courses' },
    { label: 'Users', value: stats.users, path: '/admin/users' },
  ];

  return (
    <div className="page-fade">
      {/* Stat cards */}
      <div style={styles.statsGrid}>
        {statCards.map(({ label, value, path }) => (
          <div key={label} className="card" style={styles.statCard} onClick={() => navigate(path)}>
            <div style={styles.statBody}>
              <span style={styles.statValue}>{loading ? '—' : value}</span>
              <span style={styles.statLabel}>{label}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={styles.twoCol} className="two-col-grid">
        {/* Courses by product */}
        <div className="card" style={styles.panel}>
          <div style={styles.panelHeader}>
            <i className="fa-solid fa-chart-bar" style={styles.panelHeaderIcon} />
            <h2 style={styles.panelTitle}>Courses by Product</h2>
          </div>
          <div style={styles.panelBody}>
            {coursesByProduct.length === 0 ? (
              <p style={styles.emptyText}>No courses yet.</p>
            ) : (
              <div style={styles.barList}>
                {coursesByProduct.map(({ product, count }) => {
                  const max = Math.max(...coursesByProduct.map(p => p.count));
                  const pct = Math.round((count / max) * 100);
                  return (
                    <div key={product} style={styles.barRow}>
                      <span style={styles.barLabel}>{product}</span>
                      <div style={styles.barTrack}>
                        <div style={{ ...styles.barFill, width: `${pct}%`, background: PRODUCT_COLORS[product] || 'var(--red)' }} />
                      </div>
                      <span style={styles.barCount}>{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recently added courses */}
        <div className="card" style={styles.panel}>
          <div style={styles.panelHeader}>
            <i className="fa-solid fa-clock-rotate-left" style={styles.panelHeaderIcon} />
            <h2 style={styles.panelTitle}>Recently Added</h2>
          </div>
          <div style={styles.panelBody}>
            {recentCourses.length === 0 ? (
              <p style={styles.emptyText}>No courses yet.</p>
            ) : (
              <div style={styles.recentList}>
                {recentCourses.map(c => (
                  <div key={c.id} style={styles.recentRow} onClick={() => navigate(`/admin/courses/${c.id}`)}>
                    <div style={{ ...styles.recentDot, background: PRODUCT_COLORS[c.product] || 'var(--gray-300)' }} />
                    <div style={styles.recentInfo}>
                      <span style={styles.recentTitle}>{c.title}</span>
                      <span style={styles.recentMeta}>{c.product}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ marginTop: 24 }}>
        <h2 style={styles.panelTitle}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
          <button className="btn btn-primary" onClick={() => navigate('/admin/programs')}>+ New Program</button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/courses')}>+ New Course</button>
          <button className="btn btn-secondary" onClick={() => navigate('/admin/users')}>+ New User</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14, marginBottom: 24 },
  statCard: { display: 'flex', overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.15s' },
  statBody: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 2 },
  statValue: { fontSize: 32, fontWeight: 400, fontFamily: 'var(--font-mono)', color: 'var(--red)', lineHeight: 1 },
  statLabel: { fontSize: 11, color: 'var(--gray-500)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  panel: { padding: 0, overflow: 'hidden' },
  panelHeader: { background: 'var(--pitch)', padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 8 },
  panelHeaderIcon: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  panelTitle: { fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: '1.2px', textTransform: 'uppercase', margin: 0 },
  panelBody: { padding: '16px 18px' },
  emptyText: { fontSize: 13, color: 'var(--gray-400)' },
  barList: { display: 'flex', flexDirection: 'column', gap: 12 },
  barRow: { display: 'flex', alignItems: 'center', gap: 10 },
  barLabel: { fontSize: 12, color: 'var(--gray-600)', width: 110, flexShrink: 0, fontWeight: 500 },
  barTrack: { flex: 1, height: 8, background: 'var(--gray-100)', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, transition: 'width 0.4s ease' },
  barCount: { fontSize: 12, fontWeight: 700, color: 'var(--gray-600)', width: 20, textAlign: 'right' },
  recentList: { display: 'flex', flexDirection: 'column', gap: 4 },
  recentRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer' },
  recentDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  recentInfo: { display: 'flex', flexDirection: 'column' },
  recentTitle: { fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' },
  recentMeta: { fontSize: 11, color: 'var(--gray-400)' },
};
