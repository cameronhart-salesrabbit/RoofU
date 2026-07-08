import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';

const PRODUCTS = ['SalesRabbit', 'SalesRabbit+', 'RoofLink', 'Roofle', 'Roofing General'];

export default function CourseList() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', product: PRODUCTS[0] });
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCourses(); }, []);

  async function fetchCourses() {
    setLoading(true);
    const { data } = await supabase
      .from('courses')
      .select('*, sections(id, lessons(id))')
      .order('created_at', { ascending: false });
    setCourses(data || []);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ title: '', description: '', product: PRODUCTS[0] });
    setShowForm(true);
  }

  function openEdit(course) {
    setEditing(course);
    setForm({ title: course.title, description: course.description || '', product: course.product });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('courses').update({ ...form, updated_at: new Date() }).eq('id', editing.id);
      setSaving(false);
      if (error) { console.error('updateCourse failed', error); alert(`Couldn't save course: ${error.message}`); return; }
      setShowForm(false);
      fetchCourses();
    } else {
      const { data, error } = await supabase.from('courses').insert(form).select().single();
      setSaving(false);
      if (error || !data) { console.error('createCourse failed', error); alert(`Couldn't create course: ${error?.message || 'unknown error'}`); return; }
      setShowForm(false);
      navigate(`/admin/courses/${data.id}`);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this course and all its sections and lessons?')) return;
    await supabase.from('courses').delete().eq('id', id);
    fetchCourses();
  }

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.product || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>Courses</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Search courses…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <button className="btn btn-primary" onClick={openNew}>+ New Course</button>
        </div>
      </div>

      {showForm && (
        <div style={styles.overlay}>
          <div className="card" style={styles.modal}>
            <h2 style={styles.modalTitle}>{editing ? 'Edit Course' : 'New Course'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Course Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. SalesRabbit Core" />
              </div>
              <div className="form-group">
                <label>Product</label>
                <select value={form.product} onChange={e => setForm(f => ({ ...f, product: e.target.value }))}>
                  {PRODUCTS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Course'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--gray-400)' }}>Loading…</p> : (
        courses.length === 0 ? (
          <div className="card empty-state"><p>No courses yet. Create your first course to get started.</p></div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state"><p>No courses match "{search}".</p></div>
        ) : (
          <div style={styles.list}>
            {filtered.map(course => {
              const sectionCount = (course.sections || []).length;
              const lessonCount = (course.sections || []).reduce((sum, s) => sum + (s.lessons || []).length, 0);
              return (
                <div key={course.id} className="card" style={styles.row} onClick={() => navigate(`/admin/courses/${course.id}`)}>
                  <div style={styles.rowInfo}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={styles.rowTitle}>{course.title}</h3>
                      {!course.is_published && <span className="badge" style={{ fontSize: 11, background: '#FEF7F2', color: 'var(--red)' }}>Draft</span>}
                    </div>
                    {course.description && <p style={styles.rowDesc}>{course.description}</p>}
                    <span style={styles.rowMeta}>{sectionCount} section{sectionCount !== 1 ? 's' : ''} · {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="badge badge-gray">{course.product}</span>
                  <div style={styles.rowActions} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary" onClick={() => openEdit(course)}>Edit</button>
                    <button className="btn btn-danger" onClick={() => handleDelete(course.id)}>Delete</button>
                  </div>
                  <span style={styles.arrow}>→</span>
                </div>
              );
            })}
          </div>
        )
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
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', gap: 16, cursor: 'pointer' },
  rowInfo: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: 600, marginBottom: 2 },
  rowDesc: { fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 },
  rowMeta: { fontSize: 12, color: 'var(--gray-400)' },
  rowActions: { display: 'flex', gap: 8, flexShrink: 0 },
  arrow: { fontSize: 18, color: 'var(--gray-400)', flexShrink: 0 },
};
