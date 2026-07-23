import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';

export default function HelpCenter() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('help_articles').select('*').order('category').order('order');
      setArticles(data || []);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p style={{ color: 'var(--gray-400)', padding: 32 }}>Loading…</p>;

  const filtered = articles.filter(a => a.title.toLowerCase().includes(search.toLowerCase()));
  const categories = [...new Set(filtered.map(a => a.category))];

  return (
    <div className="page-fade">
      <div style={styles.pageTop}>
        <div>
          <div style={styles.eyebrow}>Help Center</div>
          <h1 style={styles.heading}>How can we help?</h1>
        </div>
        <input
          type="search"
          placeholder="Search help articles…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {articles.length === 0 ? (
        <div className="card empty-state"><p>No help articles yet.</p></div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state"><p>No articles match "{search}".</p></div>
      ) : (
        categories.map(category => (
          <div key={category} style={{ marginBottom: 28 }}>
            <h2 style={styles.categoryTitle}>{category}</h2>
            <div style={styles.list}>
              {filtered.filter(a => a.category === category).map(a => (
                <div key={a.id} className="card" style={styles.row} onClick={() => navigate(`/help/${a.id}`)}>
                  <div style={styles.rowIcon}><i className="fa-solid fa-circle-question" /></div>
                  <span style={styles.rowTitle}>{a.title}</span>
                  <span style={styles.arrow}>→</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const styles = {
  pageTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 4 },
  heading: { fontSize: 22, fontWeight: 700, color: 'var(--gray-900)' },
  searchInput: { padding: '8px 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: 13, outline: 'none', width: 240, alignSelf: 'flex-end' },
  categoryTitle: { fontSize: 15, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 10 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', transition: 'box-shadow 0.15s' },
  rowIcon: { width: 32, height: 32, borderRadius: '50%', background: 'var(--red-light)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 },
  rowTitle: { fontSize: 14, fontWeight: 600, color: 'var(--gray-900)', flex: 1 },
  arrow: { fontSize: 18, color: 'var(--gray-400)' },
};
