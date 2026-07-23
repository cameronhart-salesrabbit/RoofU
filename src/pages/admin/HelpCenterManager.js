import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAdminAuth } from '../../context/AdminAuthContext';
import RichTextEditor from '../../components/RichTextEditor';

const emptyForm = { title: '', category: '', content: '', is_published: true };

export default function HelpCenterManager() {
  const { isSuperAdmin } = useAdminAuth();
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchArticles();
  }, [isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchArticles() {
    setLoading(true);
    const { data } = await supabase.from('help_articles').select('*').order('category').order('order');
    setArticles(data || []);
    setLoading(false);
  }

  const categorySuggestions = [...new Set(articles.map(a => a.category).filter(Boolean))];

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm, category: categorySuggestions[0] || 'General' });
    setShowForm(true);
  }

  function openEdit(article) {
    setEditing(article);
    setForm({ title: article.title, category: article.category, content: article.content || '', is_published: article.is_published });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = editing
      ? await supabase.from('help_articles').update({ ...form, updated_at: new Date() }).eq('id', editing.id)
      : await supabase.from('help_articles').insert({ ...form, order: articles.length });
    setSaving(false);
    if (error) {
      console.error('saveHelpArticle failed', error);
      alert(`Couldn't save article: ${error.message}`);
      return;
    }
    setShowForm(false);
    fetchArticles();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this help article?')) return;
    await supabase.from('help_articles').delete().eq('id', id);
    fetchArticles();
  }

  async function togglePublish(article) {
    const { error } = await supabase.from('help_articles').update({ is_published: !article.is_published }).eq('id', article.id);
    if (error) {
      console.error('toggleHelpArticlePublish failed', error);
      alert(`Couldn't update: ${error.message}`);
      return;
    }
    fetchArticles();
  }

  if (!isSuperAdmin) return <Navigate to="/admin/analytics/dashboard" replace />;
  if (loading) return <p style={{ color: 'var(--gray-400)' }}>Loading…</p>;

  const filtered = articles.filter(a =>
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    a.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>Help Center</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Search articles…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <button className="btn btn-primary" onClick={openNew}>+ New Article</button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: -12, marginBottom: 20 }}>
        This content is global — visible to every client, not just one. Only super_admins can edit it.
      </p>

      {showForm && (
        <div style={styles.overlay}>
          <div className="card" style={{ ...styles.modal, maxWidth: 640 }}>
            <h2 style={styles.modalTitle}>{editing ? 'Edit Article' : 'New Article'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. How to reset your password" />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <input
                  required
                  list="help-category-suggestions"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Getting Started"
                />
                <datalist id="help-category-suggestions">
                  {categorySuggestions.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div className="form-group">
                <label>Content</label>
                <RichTextEditor
                  value={form.content}
                  onChange={val => setForm(f => ({ ...f, content: val }))}
                  clientId="global"
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} />
                  Published (visible to everyone)
                </label>
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Article'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {articles.length === 0 ? (
        <div className="card empty-state"><p>No help articles yet. Create your first one to get started.</p></div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state"><p>No articles match "{search}".</p></div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Title', 'Category', 'Status', ''].map(h => <th key={h} style={styles.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr key={a.id} style={styles.tr}>
                  <td style={styles.td}>{a.title}</td>
                  <td style={styles.td}><span className="badge badge-gray">{a.category}</span></td>
                  <td style={styles.td}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 10px', fontSize: 12, ...(a.is_published ? { background: '#F4F6F1', color: '#404A34', border: '1px solid #9AB485' } : {}) }}
                      onClick={() => togglePublish(a)}
                    >
                      <i className={`fa-solid fa-${a.is_published ? 'eye' : 'eye-slash'}`} />
                      {a.is_published ? 'Published' : 'Draft'}
                    </button>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(a)}>Edit</button>
                      <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(a.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const styles = {
  searchInput: { padding: '8px 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: 13, outline: 'none', width: 220 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal: { width: '100%', maxWidth: 540, padding: 28, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textAlign: 'left', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' },
  tr: { borderBottom: '1px solid var(--gray-100)' },
  td: { padding: '12px 16px', fontSize: 14 },
};
