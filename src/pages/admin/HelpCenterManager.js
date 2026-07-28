import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAdminAuth } from '../../context/AdminAuthContext';
import RichTextEditor from '../../components/RichTextEditor';

const emptyForm = { title: '', category: '', content: '', is_published: true };

export default function HelpCenterManager() {
  const { isSuperAdmin } = useAdminAuth();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renamingId, setRenamingId] = useState(null);

  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchArticles();
    fetchCategories();
  }, [isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchArticles() {
    setLoading(true);
    const { data } = await supabase.from('help_articles').select('*').order('category').order('order');
    setArticles(data || []);
    setLoading(false);
  }

  async function fetchCategories() {
    const { data } = await supabase.from('help_categories').select('*').order('name');
    setCategories(data || []);
  }

  function openNew() {
    setEditing(null);
    setForm({ ...emptyForm, category: categories[0]?.name || '' });
    setShowForm(true);
  }

  function openEdit(article) {
    setEditing(article);
    setForm({ title: article.title, category: article.category, content: article.content || '', is_published: article.is_published });
    setShowForm(true);
  }

  async function handleSave(publish) {
    setSaving(true);
    const payload = { ...form, is_published: publish };
    const { error } = editing
      ? await supabase.from('help_articles').update({ ...payload, updated_at: new Date() }).eq('id', editing.id)
      : await supabase.from('help_articles').insert({ ...payload, order: articles.length });
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

  async function addCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      alert('That category already exists.');
      return;
    }
    const { error } = await supabase.from('help_categories').insert({ name });
    if (error) {
      console.error('addHelpCategory failed', error);
      alert(`Couldn't add category: ${error.message}`);
      return;
    }
    setNewCategoryName('');
    fetchCategories();
  }

  async function renameCategory(category, newName) {
    const trimmed = newName.trim();
    setRenamingId(null);
    if (!trimmed || trimmed === category.name) return;
    const { error } = await supabase.from('help_categories').update({ name: trimmed }).eq('id', category.id);
    if (error) {
      console.error('renameHelpCategory failed', error);
      alert(`Couldn't rename category: ${error.message}`);
      return;
    }
    // Keep existing articles grouped correctly under the renamed category.
    await supabase.from('help_articles').update({ category: trimmed }).eq('category', category.name);
    fetchCategories();
    fetchArticles();
  }

  async function deleteCategory(category) {
    if (!window.confirm(`Delete category "${category.name}"? Existing articles keep this category name, but it won't appear in the dropdown for new or edited articles.`)) return;
    const { error } = await supabase.from('help_categories').delete().eq('id', category.id);
    if (error) {
      console.error('deleteHelpCategory failed', error);
      alert(`Couldn't delete category: ${error.message}`);
      return;
    }
    fetchCategories();
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
          <button className="btn btn-secondary" onClick={() => setShowCategoryManager(true)}>Manage Categories</button>
          <button className="btn btn-primary" onClick={openNew}>+ New Article</button>
        </div>
      </div>
      <p style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: -12, marginBottom: 20 }}>
        This content is global — visible to every client, not just one. Only super_admins can edit it.
      </p>

      {showCategoryManager && (
        <div style={styles.overlay}>
          <div className="card" style={{ ...styles.modal, maxWidth: 440 }}>
            <h2 style={styles.modalTitle}>Manage Categories</h2>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCategory(); } }}
                placeholder="New category name"
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-primary" onClick={addCategory}>+ Add</button>
            </div>
            {categories.length === 0 ? (
              <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>No categories yet — until you add one, new articles use a free-text category field.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {categories.map(c => (
                  <div key={c.id} style={styles.categoryRow}>
                    {renamingId === c.id ? (
                      <input
                        autoFocus
                        defaultValue={c.name}
                        onBlur={e => renameCategory(c, e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setRenamingId(null); }}
                        style={{ flex: 1 }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: 14 }}>{c.name}</span>
                    )}
                    <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setRenamingId(c.id)}>Rename</button>
                    <button type="button" className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => deleteCategory(c)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
            <div style={styles.modalFooter}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowCategoryManager(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div style={styles.overlay}>
          <div className="card" style={{ ...styles.modal, maxWidth: 640 }}>
            <h2 style={styles.modalTitle}>{editing ? 'Edit Article' : 'New Article'}</h2>
            <form onSubmit={e => { e.preventDefault(); handleSave(e.nativeEvent.submitter?.value === 'publish'); }}>
              <div className="form-group">
                <label>Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. How to reset your password" />
              </div>
              <div className="form-group">
                <label>Category *</label>
                {categories.length > 0 ? (
                  <select
                    required
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    <option value="" disabled>Select a category…</option>
                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    {form.category && !categories.some(c => c.name === form.category) && (
                      <option value={form.category}>{form.category} (legacy)</option>
                    )}
                  </select>
                ) : (
                  <input
                    required
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Getting Started"
                  />
                )}
              </div>
              <div className="form-group">
                <label>Content</label>
                <RichTextEditor
                  value={form.content}
                  onChange={val => setForm(f => ({ ...f, content: val }))}
                  clientId="global"
                />
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button>
                <button type="submit" value="draft" className="btn btn-secondary" disabled={saving}>{saving ? 'Saving…' : 'Save as Draft'}</button>
                <button type="submit" value="publish" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Publish'}</button>
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
  categoryRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textAlign: 'left', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' },
  tr: { borderBottom: '1px solid var(--gray-100)' },
  td: { padding: '12px 16px', fontSize: 14 },
};
