import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAdminAuth } from '../../context/AdminAuthContext';

function slugify(str) {
  return str.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// Clones a client's full content tree (programs -> courses -> program_courses
// -> sections -> lessons -> quizzes -> quiz_questions) into a brand new
// client, remapping every foreign key including the polymorphic
// quizzes.attached_to_id and the reverse course/section/lesson quiz_id
// pointers. Mirrors migrations/002 and 003, just done from the app instead
// of hand-run SQL. Batches inserts per table (one round trip per table,
// not per row) and relies on Postgres preserving row order for a single
// multi-row INSERT ... RETURNING to build old-id -> new-id maps.
async function cloneClient(sourceClientId, name, slug) {
  const { data: newClient, error: clientErr } = await supabase.from('clients').insert({ name, slug }).select().single();
  if (clientErr || !newClient) throw new Error(clientErr?.message || 'Failed to create client');
  const newClientId = newClient.id;

  const { data: programs } = await supabase.from('programs').select('*').eq('client_id', sourceClientId);
  const programIdMap = {};
  if (programs?.length) {
    const payload = programs.map(p => ({ title: p.title, description: p.description, client_id: newClientId }));
    const { data: inserted, error } = await supabase.from('programs').insert(payload).select();
    if (error) throw new Error(`Cloning programs: ${error.message}`);
    programs.forEach((p, i) => { programIdMap[p.id] = inserted[i].id; });
  }

  const { data: courses } = await supabase.from('courses').select('*').eq('client_id', sourceClientId);
  const courseIdMap = {};
  if (courses?.length) {
    const payload = courses.map(c => ({ title: c.title, description: c.description, product: c.product, is_published: c.is_published, client_id: newClientId }));
    const { data: inserted, error } = await supabase.from('courses').insert(payload).select();
    if (error) throw new Error(`Cloning courses: ${error.message}`);
    courses.forEach((c, i) => { courseIdMap[c.id] = inserted[i].id; });
  }

  const { data: programCourses } = await supabase.from('program_courses').select('*').eq('client_id', sourceClientId);
  if (programCourses?.length) {
    const payload = programCourses.map(pc => ({ program_id: programIdMap[pc.program_id], course_id: courseIdMap[pc.course_id], order: pc.order }));
    const { error } = await supabase.from('program_courses').insert(payload);
    if (error) throw new Error(`Cloning program-course links: ${error.message}`);
  }

  const { data: sections } = await supabase.from('sections').select('*').eq('client_id', sourceClientId);
  const sectionIdMap = {};
  if (sections?.length) {
    const payload = sections.map(s => ({ title: s.title, course_id: courseIdMap[s.course_id], order: s.order }));
    const { data: inserted, error } = await supabase.from('sections').insert(payload).select();
    if (error) throw new Error(`Cloning sections: ${error.message}`);
    sections.forEach((s, i) => { sectionIdMap[s.id] = inserted[i].id; });
  }

  const { data: lessons } = await supabase.from('lessons').select('*').eq('client_id', sourceClientId);
  const lessonIdMap = {};
  if (lessons?.length) {
    const payload = lessons.map(l => ({
      title: l.title, section_id: sectionIdMap[l.section_id], video_type: l.video_type, video_url: l.video_url,
      written_content: l.written_content, duration_minutes: l.duration_minutes,
      attachment_url: l.attachment_url, attachment_name: l.attachment_name, order: l.order,
    }));
    const { data: inserted, error } = await supabase.from('lessons').insert(payload).select();
    if (error) throw new Error(`Cloning lessons: ${error.message}`);
    lessons.forEach((l, i) => { lessonIdMap[l.id] = inserted[i].id; });
  }

  const { data: quizzes } = await supabase.from('quizzes').select('*').eq('client_id', sourceClientId);
  const quizIdMap = {};
  if (quizzes?.length) {
    const remapAttached = q => {
      if (q.attached_to_type === 'course') return courseIdMap[q.attached_to_id];
      if (q.attached_to_type === 'section') return sectionIdMap[q.attached_to_id];
      if (q.attached_to_type === 'lesson') return lessonIdMap[q.attached_to_id];
      return null;
    };
    const payload = quizzes.map(q => ({
      title: q.title, attached_to_id: remapAttached(q), attached_to_type: q.attached_to_type,
      pass_threshold: q.pass_threshold, max_retakes: q.max_retakes, show_correct_answers: q.show_correct_answers,
      client_id: newClientId,
    }));
    const { data: inserted, error } = await supabase.from('quizzes').insert(payload).select();
    if (error) throw new Error(`Cloning quizzes: ${error.message}`);
    quizzes.forEach((q, i) => { quizIdMap[q.id] = inserted[i].id; });
  }

  const { data: quizQuestions } = await supabase.from('quiz_questions').select('*').eq('client_id', sourceClientId);
  if (quizQuestions?.length) {
    const payload = quizQuestions.map(qq => ({
      quiz_id: quizIdMap[qq.quiz_id], question_text: qq.question_text, options: qq.options,
      correct_option_index: qq.correct_option_index, order: qq.order,
    }));
    const { error } = await supabase.from('quiz_questions').insert(payload);
    if (error) throw new Error(`Cloning quiz questions: ${error.message}`);
  }

  // Patch the reverse quiz_id pointers now that quizzes have their new ids
  for (const c of courses || []) {
    if (c.quiz_id && quizIdMap[c.quiz_id]) await supabase.from('courses').update({ quiz_id: quizIdMap[c.quiz_id] }).eq('id', courseIdMap[c.id]);
  }
  for (const s of sections || []) {
    if (s.quiz_id && quizIdMap[s.quiz_id]) await supabase.from('sections').update({ quiz_id: quizIdMap[s.quiz_id] }).eq('id', sectionIdMap[s.id]);
  }
  for (const l of lessons || []) {
    if (l.quiz_id && quizIdMap[l.quiz_id]) await supabase.from('lessons').update({ quiz_id: quizIdMap[l.quiz_id] }).eq('id', lessonIdMap[l.id]);
  }

  return {
    client: newClient,
    counts: {
      programs: programs?.length || 0,
      courses: courses?.length || 0,
      sections: sections?.length || 0,
      lessons: lessons?.length || 0,
      quizzes: quizzes?.length || 0,
    },
  };
}

export default function ClientsList() {
  const { isSuperAdmin, selectedClientId, setSelectedClientId } = useAdminAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);
  const [showClone, setShowClone] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [cloneSlug, setCloneSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [cloning, setCloning] = useState(false);

  useEffect(() => {
    if (!isSuperAdmin) return;
    load();
  }, [isSuperAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    const [{ data: cl }, { data: courses }, { data: users }] = await Promise.all([
      supabase.from('clients').select('*').order('name'),
      supabase.from('courses').select('client_id'),
      supabase.from('users').select('client_id'),
    ]);
    const courseCounts = {};
    (courses || []).forEach(c => { courseCounts[c.client_id] = (courseCounts[c.client_id] || 0) + 1; });
    const userCounts = {};
    (users || []).forEach(u => { userCounts[u.client_id] = (userCounts[u.client_id] || 0) + 1; });
    setClients((cl || []).map(c => ({ ...c, courseCount: courseCounts[c.id] || 0, userCount: userCounts[c.id] || 0 })));
    setLoading(false);
  }

  function openEdit(client) {
    setEditing(client);
    setEditName(client.name);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from('clients').update({ name: editName }).eq('id', editing.id);
    setSaving(false);
    if (error) {
      console.error('renameClient failed', error);
      alert(`Couldn't rename client: ${error.message}`);
      return;
    }
    setEditing(null);
    load();
  }

  function openClone() {
    setCloneSourceId(clients.find(c => c.is_template)?.id || clients[0]?.id || '');
    setCloneName('');
    setCloneSlug('');
    setSlugTouched(false);
    setShowClone(true);
  }

  async function handleClone(e) {
    e.preventDefault();
    if (!cloneSourceId) return;
    setCloning(true);
    try {
      const result = await cloneClient(cloneSourceId, cloneName, cloneSlug);
      setCloning(false);
      setShowClone(false);
      await load();
      alert(`"${result.client.name}" created: ${result.counts.programs} programs, ${result.counts.courses} courses, ${result.counts.sections} sections, ${result.counts.lessons} lessons, ${result.counts.quizzes} quizzes.`);
    } catch (err) {
      setCloning(false);
      console.error('cloneClient failed', err);
      alert(`Couldn't finish cloning: ${err.message}\n\nSome content may have been partially created — let Claude know so it can check.`);
    }
  }

  // Read-only visibility across all clients for the super-admin, plus the
  // ability to switch which one is currently being managed and to clone an
  // existing client's content into a brand new one.
  if (!isSuperAdmin) return <Navigate to="/admin/analytics/dashboard" replace />;
  if (loading) return <p style={{ color: 'var(--gray-400)' }}>Loading…</p>;

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>Clients</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Search clients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <button className="btn btn-primary" onClick={openClone}>+ Clone Client</button>
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="card empty-state"><p>No clients match "{search}".</p></div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'Slug', 'Courses', 'Users', '', '', ''].map((h, i) => <th key={i} style={styles.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => {
                const isManaged = c.id === selectedClientId;
                return (
                  <tr
                    key={c.id}
                    style={{ ...styles.tr, ...(isManaged ? styles.trActive : {}), cursor: 'pointer' }}
                    onClick={() => setSelectedClientId(c.id)}
                  >
                    <td style={styles.td}>{c.name}</td>
                    <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', color: 'var(--gray-500)' }}>{c.slug}</td>
                    <td style={styles.td}>{c.courseCount}</td>
                    <td style={styles.td}>{c.userCount}</td>
                    <td style={styles.td}>{c.is_template && <span className="badge badge-gray">Template</span>}</td>
                    <td style={styles.td}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: 12 }}
                        onClick={e => { e.stopPropagation(); openEdit(c); }}
                      >
                        Edit
                      </button>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      {isManaged ? (
                        <span className="badge badge-green"><i className="fa-solid fa-check" style={{ marginRight: 4 }} />Managing</span>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: 12 }}
                          onClick={e => { e.stopPropagation(); setSelectedClientId(c.id); }}
                        >
                          Switch to
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div style={styles.overlay}>
          <div className="card" style={styles.modal}>
            <h2 style={styles.modalTitle}>Rename Client</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Client Name *</label>
                <input required autoFocus value={editName} onChange={e => setEditName(e.target.value)} placeholder="e.g. Acme Roofing" />
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showClone && (
        <div style={styles.overlay}>
          <div className="card" style={styles.modal}>
            <h2 style={styles.modalTitle}>Clone Client</h2>
            <form onSubmit={handleClone}>
              <div className="form-group">
                <label>Clone From *</label>
                <select required value={cloneSourceId} onChange={e => setCloneSourceId(e.target.value)} disabled={cloning}>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}{c.is_template ? ' (Template)' : ''}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>New Client Name *</label>
                <input
                  required
                  autoFocus
                  disabled={cloning}
                  value={cloneName}
                  onChange={e => {
                    setCloneName(e.target.value);
                    if (!slugTouched) setCloneSlug(slugify(e.target.value));
                  }}
                  placeholder="e.g. Acme Roofing"
                />
              </div>
              <div className="form-group">
                <label>Slug *</label>
                <input
                  required
                  disabled={cloning}
                  value={cloneSlug}
                  onChange={e => { setCloneSlug(e.target.value); setSlugTouched(true); }}
                  placeholder="e.g. acme-roofing"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: -8, marginBottom: 16 }}>
                Copies all programs, courses, sections, lessons, and quizzes from the source client. This may take a moment for larger clients.
              </p>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowClone(false)} disabled={cloning}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={cloning}>{cloning ? 'Cloning…' : 'Clone'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  searchInput: { padding: '8px 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: 13, outline: 'none', width: 220 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal: { width: '100%', maxWidth: 420, padding: 28 },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textAlign: 'left', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' },
  tr: { borderBottom: '1px solid var(--gray-100)' },
  trActive: { background: 'var(--red-light)' },
  td: { padding: '12px 16px', fontSize: 14 },
};
