import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase/client';

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { result.push(cur); cur = ''; }
    else cur += ch;
  }
  result.push(cur);
  return result.map(s => s.trim());
}

function parseCsv(text) {
  const lines = text.split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map(h => h.toLowerCase());
  const nameIdx = header.findIndex(h => h.includes('name'));
  const emailIdx = header.findIndex(h => h.includes('email'));
  const roleIdx = header.findIndex(h => h.includes('role'));
  return lines.slice(1).map(line => {
    const cols = parseCsvLine(line);
    const name = nameIdx >= 0 ? (cols[nameIdx] || '') : '';
    const email = emailIdx >= 0 ? (cols[emailIdx] || '') : '';
    const roleRaw = roleIdx >= 0 ? (cols[roleIdx] || '').toLowerCase() : '';
    return { name, email, role: roleRaw === 'admin' ? 'admin' : 'learner' };
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function UserManager() {
  const [users, setUsers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'learner', programIds: [] });
  const [saving, setSaving] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showBulkEnroll, setShowBulkEnroll] = useState(false);
  const [bulkProgramId, setBulkProgramId] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [detailUser, setDetailUser] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importProgramId, setImportProgramId] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [{ data: u }, { data: p }] = await Promise.all([
      supabase.from('users').select('*, user_program_enrollments(program_id, programs(id, title))').order('created_at', { ascending: false }),
      supabase.from('programs').select('id, title').order('title'),
    ]);
    setUsers(u || []);
    setPrograms(p || []);
    // Keep detailUser in sync if open
    if (detailUser) {
      const updated = (u || []).find(x => x.id === detailUser.id);
      if (updated) setDetailUser(updated);
    }
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ name: '', email: '', role: 'learner', programIds: [] });
    setShowForm(true);
  }

  function openEdit(user) {
    setEditing(user);
    const ids = (user.user_program_enrollments || []).map(e => e.program_id);
    setForm({ name: user.name, email: user.email, role: user.role, programIds: ids });
    setShowForm(true);
  }

  async function sendWelcomeEmail(name, email) {
    const serviceId = process.env.REACT_APP_EMAILJS_SERVICE_ID;
    const templateId = process.env.REACT_APP_EMAILJS_WELCOME_TEMPLATE_ID || process.env.REACT_APP_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;
    if (!serviceId || !templateId || !publicKey) return;
    try {
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_name: name,
            to_email: email,
            login_url: `${window.location.origin}/?signup=1`,
            message: `You've been added to RoofU. Create your account at the link below using this email address: ${email}`,
          },
        }),
      });
    } catch (err) { /* non-blocking */ }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    let userId = editing?.id;
    let isNew = false;
    if (editing) {
      await supabase.from('users').update({ name: form.name, email: form.email, role: form.role }).eq('id', editing.id);
    } else {
      const { data } = await supabase.from('users').insert({ name: form.name, email: form.email, role: form.role }).select().single();
      userId = data?.id;
      isNew = true;
    }
    if (userId) {
      await supabase.from('user_program_enrollments').delete().eq('user_id', userId);
      if (form.programIds.length > 0) {
        await supabase.from('user_program_enrollments').insert(
          form.programIds.map(pid => ({ user_id: userId, program_id: pid }))
        );
      }
    }
    if (isNew) await sendWelcomeEmail(form.name, form.email);
    setSaving(false);
    setShowForm(false);
    fetchAll();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this user?')) return;
    await supabase.from('user_program_enrollments').delete().eq('user_id', id);
    await supabase.from('users').delete().eq('id', id);
    fetchAll();
  }

  function toggleUserSelect(id) {
    setSelectedUserIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  }

  function toggleSelectAll() {
    setSelectedUserIds(selectedUserIds.length === users.length ? [] : users.map(u => u.id));
  }

  async function sendEnrollmentEmail(user, programTitle) {
    const serviceId = process.env.REACT_APP_EMAILJS_SERVICE_ID;
    const templateId = process.env.REACT_APP_EMAILJS_TEMPLATE_ID;
    const publicKey = process.env.REACT_APP_EMAILJS_PUBLIC_KEY;
    if (!serviceId || !templateId || !publicKey) return;
    try {
      await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: serviceId,
          template_id: templateId,
          user_id: publicKey,
          template_params: {
            to_name: user.name,
            to_email: user.email,
            program_title: programTitle,
            login_url: window.location.origin,
          },
        }),
      });
    } catch (err) {
      // Email failures are non-blocking
    }
  }

  async function handleBulkEnroll(e) {
    e.preventDefault();
    if (!bulkProgramId || selectedUserIds.length === 0) return;
    setBulkSaving(true);
    const rows = selectedUserIds.map(uid => ({ user_id: uid, program_id: bulkProgramId }));
    await supabase.from('user_program_enrollments').upsert(rows, { onConflict: 'user_id,program_id' });
    const program = programs.find(p => p.id === bulkProgramId);
    const enrolledUsers = users.filter(u => selectedUserIds.includes(u.id));
    await Promise.all(enrolledUsers.map(u => sendEnrollmentEmail(u, program?.title || 'a program')));
    setBulkSaving(false);
    setShowBulkEnroll(false);
    setSelectedUserIds([]);
    fetchAll();
  }

  async function removeEnrollment(userId, programId) {
    await supabase.from('user_program_enrollments').delete().eq('user_id', userId).eq('program_id', programId);
    fetchAll();
  }

  async function addEnrollment(userId, programId) {
    if (!programId) return;
    await supabase.from('user_program_enrollments').upsert({ user_id: userId, program_id: programId }, { onConflict: 'user_id,program_id' });
    fetchAll();
  }

  function openImport() {
    setImportRows([]);
    setImportProgramId('');
    setImportResult(null);
    setShowImport(true);
  }

  function closeImport() {
    setShowImport(false);
    setImportRows([]);
    setImportResult(null);
    setImportProgramId('');
  }

  function downloadImportTemplate() {
    const csv = 'name,email,role\nJane Smith,jane@example.com,learner\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'roofu-user-import-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCsvFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const rows = parseCsv(String(ev.target.result));
      const existingEmails = new Set(users.map(u => u.email.toLowerCase()));
      const seen = new Set();
      const validated = rows.map(r => {
        let status = 'ok';
        if (!r.name || !r.email) status = 'missing_fields';
        else if (!EMAIL_RE.test(r.email)) status = 'invalid_email';
        else if (existingEmails.has(r.email.toLowerCase())) status = 'duplicate';
        else if (seen.has(r.email.toLowerCase())) status = 'duplicate_in_file';
        if (status === 'ok') seen.add(r.email.toLowerCase());
        return { ...r, status };
      });
      setImportRows(validated);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    const toImport = importRows.filter(r => r.status === 'ok');
    if (toImport.length === 0) return;
    setImporting(true);
    let created = 0, failed = 0;
    const newUserIds = [];
    for (const row of toImport) {
      const { data, error } = await supabase.from('users').insert({ name: row.name, email: row.email, role: row.role }).select().single();
      if (error || !data) { failed++; console.error('CSV import failed for', row.email, error); continue; }
      created++;
      newUserIds.push(data.id);
      await sendWelcomeEmail(row.name, row.email);
    }
    if (importProgramId && newUserIds.length > 0) {
      await supabase.from('user_program_enrollments').insert(newUserIds.map(uid => ({ user_id: uid, program_id: importProgramId })));
    }
    setImporting(false);
    setImportResult({ created, failed, skipped: importRows.length - toImport.length });
    fetchAll();
  }

  function toggleProgram(id) {
    setForm(f => ({
      ...f,
      programIds: f.programIds.includes(id) ? f.programIds.filter(p => p !== id) : [...f.programIds, id],
    }));
  }

  return (
    <div>
      <div className="page-header">
        <h1>Users</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {selectedUserIds.length > 0 && (
            <button className="btn btn-secondary" onClick={() => setShowBulkEnroll(true)}>
              Enroll {selectedUserIds.length} User{selectedUserIds.length !== 1 ? 's' : ''} →
            </button>
          )}
          <button className="btn btn-secondary" onClick={openImport}><i className="fa-solid fa-file-csv" /> Import CSV</button>
          <button className="btn btn-primary" onClick={openNew}>+ Add User</button>
        </div>
      </div>

      {showImport && (
        <div style={styles.overlay}>
          <div className="card" style={{ ...styles.modal, maxWidth: 640 }}>
            <h2 style={styles.modalTitle}>Import Users from CSV</h2>

            {importResult ? (
              <>
                <div style={{ fontSize: 14, color: 'var(--gray-700)', marginBottom: 20, lineHeight: 1.6 }}>
                  <p><strong>{importResult.created}</strong> user{importResult.created !== 1 ? 's' : ''} created and welcome emails sent.</p>
                  {importResult.skipped > 0 && <p>{importResult.skipped} row{importResult.skipped !== 1 ? 's' : ''} skipped (duplicates or invalid).</p>}
                  {importResult.failed > 0 && <p style={{ color: '#D92D20' }}>{importResult.failed} row{importResult.failed !== 1 ? 's' : ''} failed to save.</p>}
                </div>
                <div style={styles.modalFooter}>
                  <button className="btn btn-primary" onClick={closeImport}>Done</button>
                </div>
              </>
            ) : importRows.length === 0 ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16, lineHeight: 1.6 }}>
                  Upload a CSV with columns <strong>name</strong>, <strong>email</strong>, and optionally <strong>role</strong> (defaults to learner).
                </p>
                <button type="button" className="btn btn-secondary" style={{ marginBottom: 16, fontSize: 13 }} onClick={downloadImportTemplate}>
                  <i className="fa-solid fa-download" /> Download Template
                </button>
                <div className="form-group">
                  <label>CSV File</label>
                  <input type="file" accept=".csv" onChange={handleCsvFile} />
                </div>
                <div style={styles.modalFooter}>
                  <button type="button" className="btn btn-secondary" onClick={closeImport}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ maxHeight: 320, overflowY: 'auto', border: '1px solid var(--gray-200)', borderRadius: 8, marginBottom: 16 }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>{['Name', 'Email', 'Role', 'Status'].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {importRows.map((r, i) => (
                        <tr key={i} style={styles.tr}>
                          <td style={styles.td}>{r.name || <em style={{ color: 'var(--gray-400)' }}>missing</em>}</td>
                          <td style={styles.td}>{r.email || <em style={{ color: 'var(--gray-400)' }}>missing</em>}</td>
                          <td style={styles.td}>{r.role}</td>
                          <td style={styles.td}>
                            {r.status === 'ok' && <span className="badge badge-green">Ready</span>}
                            {r.status === 'duplicate' && <span className="badge badge-gray">Already exists</span>}
                            {r.status === 'duplicate_in_file' && <span className="badge badge-gray">Duplicate in file</span>}
                            {r.status === 'missing_fields' && <span className="badge badge-red">Missing name/email</span>}
                            {r.status === 'invalid_email' && <span className="badge badge-red">Invalid email</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="form-group">
                  <label>Enroll all imported users into a program (optional)</label>
                  <select value={importProgramId} onChange={e => setImportProgramId(e.target.value)}>
                    <option value="">Don't enroll</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
                <div style={styles.modalFooter}>
                  <button type="button" className="btn btn-secondary" onClick={closeImport}>Cancel</button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={importing || importRows.filter(r => r.status === 'ok').length === 0}
                    onClick={handleImport}
                  >
                    {importing ? 'Importing…' : `Import ${importRows.filter(r => r.status === 'ok').length} User${importRows.filter(r => r.status === 'ok').length !== 1 ? 's' : ''}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showBulkEnroll && (
        <div style={styles.overlay}>
          <div className="card" style={styles.modal}>
            <h2 style={styles.modalTitle}>Bulk Enroll {selectedUserIds.length} Users</h2>
            <form onSubmit={handleBulkEnroll}>
              <div className="form-group">
                <label>Enroll into Program *</label>
                <select required value={bulkProgramId} onChange={e => setBulkProgramId(e.target.value)}>
                  <option value="">Select a program…</option>
                  {programs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBulkEnroll(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={bulkSaving}>{bulkSaving ? 'Enrolling…' : 'Enroll All'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForm && (
        <div style={styles.overlay}>
          <div className="card" style={styles.modal}>
            <h2 style={styles.modalTitle}>{editing ? 'Edit User' : 'Add User'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Full Name *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Jane Smith" />
              </div>
              <div className="form-group">
                <label>Email *</label>
                <input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="jane@company.com" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                  <option value="learner">Learner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Enroll in Programs</label>
                <div style={styles.checkList}>
                  {programs.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>No programs yet.</p>}
                  {programs.map(p => (
                    <label key={p.id} style={styles.checkItem}>
                      <input type="checkbox" checked={form.programIds.includes(p.id)} onChange={() => toggleProgram(p.id)} />
                      {p.title}
                    </label>
                  ))}
                </div>
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save User'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--gray-400)' }}>Loading…</p> : (
        users.length === 0 ? (
          <div className="card empty-state"><p>No users yet.</p></div>
        ) : (
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div className="card" style={{ flex: 1, overflow: 'hidden' }}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}><input type="checkbox" checked={selectedUserIds.length === users.length && users.length > 0} onChange={toggleSelectAll} /></th>
                    {['Name', 'Email', 'Role', 'Status', 'Enrolled In', ''].map(h => (
                      <th key={h} style={styles.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => {
                    const enrollments = (user.user_program_enrollments || []);
                    const isDetail = detailUser?.id === user.id;
                    return (
                      <tr key={user.id} style={{ ...styles.tr, background: isDetail ? 'var(--red-light)' : selectedUserIds.includes(user.id) ? '#FFF7F3' : undefined }}>
                        <td style={styles.td}><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => toggleUserSelect(user.id)} /></td>
                        <td style={styles.td}>
                          <button style={styles.nameBtn} onClick={() => setDetailUser(isDetail ? null : user)}>
                            <strong>{user.name}</strong>
                            <i className={`fa-solid fa-chevron-${isDetail ? 'up' : 'right'}`} style={{ fontSize: 10, color: 'var(--gray-400)' }} />
                          </button>
                        </td>
                        <td style={styles.td}>{user.email}</td>
                        <td style={styles.td}>
                          <span className={`badge ${user.role === 'admin' ? 'badge-red' : 'badge-gray'}`}>{user.role}</span>
                        </td>
                        <td style={styles.td}>
                          {user.auth_id
                            ? <span className="badge badge-green"><i className="fa-solid fa-circle-check" style={{ marginRight: 4 }} />Active</span>
                            : <span className="badge badge-gray"><i className="fa-solid fa-clock" style={{ marginRight: 4 }} />Pending</span>
                          }
                        </td>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {enrollments.length === 0
                              ? <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>None</span>
                              : enrollments.map(e => (
                                <span key={e.program_id} style={styles.enrollTag}>
                                  {e.programs?.title || '—'}
                                </span>
                              ))
                            }
                          </div>
                        </td>
                        <td style={{ ...styles.td, textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => openEdit(user)}>Edit</button>
                            <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => handleDelete(user.id)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {detailUser && <EnrollmentPanel user={detailUser} programs={programs} onRemove={removeEnrollment} onAdd={addEnrollment} onClose={() => setDetailUser(null)} />}
          </div>
        )
      )}
    </div>
  );
}

function EnrollmentPanel({ user, programs, onRemove, onAdd, onClose }) {
  const [addId, setAddId] = useState('');
  const [resetStatus, setResetStatus] = useState(''); // '' | 'sending' | 'sent' | 'error'
  const [copied, setCopied] = useState(false);

  async function sendResetEmail() {
    setResetStatus('sending');
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetStatus(error ? 'error' : 'sent');
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(`${window.location.origin}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  const enrolled = (user.user_program_enrollments || []);
  const enrolledIds = enrolled.map(e => e.program_id);
  const unenrolled = programs.filter(p => !enrolledIds.includes(p.id));

  return (
    <div className="card" style={{ width: 280, minWidth: 280, padding: 0, overflow: 'hidden', alignSelf: 'flex-start' }}>
      <div style={{ background: 'var(--pitch)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'rgba(255,255,255,0.7)' }}>
          <i className="fa-solid fa-user" style={{ marginRight: 6 }} /> {user.name}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>
      </div>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--gray-500)', marginBottom: 8 }}>Enrolled Programs</div>
        {enrolled.length === 0
          ? <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 12 }}>No enrollments.</p>
          : enrolled.map(e => (
            <div key={e.program_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--gray-100)' }}>
              <span style={{ fontSize: 13, color: 'var(--gray-800)' }}>{e.programs?.title || '—'}</span>
              <button
                onClick={() => onRemove(user.id, e.program_id)}
                style={{ background: 'none', border: 'none', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 13, padding: '2px 6px' }}
                title="Remove enrollment"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
          ))
        }
        {unenrolled.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--gray-500)', marginBottom: 8 }}>Add to Program</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select value={addId} onChange={e => setAddId(e.target.value)} style={{ flex: 1, padding: '6px 8px', fontSize: 13, border: '1px solid var(--gray-300)', borderRadius: 6 }}>
                <option value="">Select…</option>
                {unenrolled.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
              <button
                className="btn btn-primary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                onClick={() => { onAdd(user.id, addId); setAddId(''); }}
                disabled={!addId}
              >
                Add
              </button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--gray-100)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--gray-500)', marginBottom: 10 }}>Account Access</div>
          {user.auth_id ? (
            <>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>User has an active account. Send a password reset email if they're locked out.</p>
              {resetStatus === 'sent'
                ? <div style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}><i className="fa-solid fa-circle-check" style={{ marginRight: 6 }} />Reset email sent.</div>
                : resetStatus === 'error'
                  ? <div style={{ fontSize: 13, color: '#D92D20' }}>Failed to send. Try again.</div>
                  : <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }} onClick={sendResetEmail} disabled={resetStatus === 'sending'}>
                      <i className="fa-solid fa-key" />
                      {resetStatus === 'sending' ? 'Sending…' : 'Send Password Reset Email'}
                    </button>
              }
            </>
          ) : (
            <>
              <p style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>This user hasn't created their account yet. Share the app link so they can sign up with <strong>{user.email}</strong>.</p>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 13 }} onClick={copyInviteLink}>
                <i className="fa-solid fa-link" />
                {copied ? 'Copied!' : 'Copy App Link'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal: { width: '100%', maxWidth: 480, padding: 28, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  checkList: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto', padding: 4 },
  checkItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' },
  nameBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, padding: 0, fontFamily: 'inherit', fontSize: 'inherit' },
  enrollTag: { background: 'var(--gray-100)', border: '1px solid var(--gray-200)', borderRadius: 999, padding: '2px 8px', fontSize: 11, color: 'var(--gray-600)', fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textAlign: 'left', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' },
  tr: { borderBottom: '1px solid var(--gray-100)' },
  td: { padding: '12px 16px', fontSize: 14 },
};
