import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../supabase/client';

export default function HelpArticle() {
  const { articleId } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase.from('help_articles').select('*').eq('id', articleId).single();
      setArticle(data || null);
      setLoading(false);
    }
    load();
  }, [articleId]);

  if (loading) return <p style={{ color: 'var(--gray-400)', padding: 32 }}>Loading…</p>;
  if (!article) return <p style={{ padding: 32 }}>Article not found.</p>;

  return (
    <div className="page-fade" style={{ maxWidth: 760 }}>
      <div style={styles.breadcrumbs}>
        <Link to="/help" style={styles.crumb}>Help Center</Link>
        <span style={styles.sep}>›</span>
        <span style={styles.crumbCurrent}>{article.title}</span>
      </div>
      <span className="badge badge-gray" style={{ marginBottom: 10 }}>{article.category}</span>
      <h1 style={styles.title}>{article.title}</h1>
      {article.content && (
        <div className="rich-content" style={styles.prose} dangerouslySetInnerHTML={{ __html: article.content }} />
      )}
    </div>
  );
}

const styles = {
  breadcrumbs: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13 },
  crumb: { color: 'var(--gray-500)', fontWeight: 500, textDecoration: 'none' },
  sep: { color: 'var(--gray-300)' },
  crumbCurrent: { color: 'var(--gray-700)', fontWeight: 500 },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 20, display: 'block' },
  prose: { fontSize: 15, lineHeight: 1.7, color: 'var(--gray-700)' },
};
