import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase/client';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export default function ProgramManager() {
  const { effectiveClientId } = useAdminAuth();
  const [programs, setPrograms] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', courseIds: [] });
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');

  useEffect(() => { if (effectiveClientId) fetchAll(); }, [effectiveClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    const [{ data: progs }, { data: crs }] = await Promise.all([
      supabase.from('programs').select('*, program_courses(course_id, order)').eq('client_id', effectiveClientId).order('created_at', { ascending: false }),
      supabase.from('courses').select('id, title').eq('client_id', effectiveClientId).order('title'),
    ]);
    setPrograms(progs || []);
    setCourses(crs || []);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ title: '', description: '', courseIds: [] });
    setCourseSearch('');
    setShowForm(true);
  }

  function openEdit(prog) {
    setEditing(prog);
    const ids = (prog.program_courses || [])
      .sort((a, b) => a.order - b.order)
      .map(pc => pc.course_id);
    setForm({ title: prog.title, description: prog.description || '', courseIds: ids });
    setCourseSearch('');
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await supabase.from('programs').update({ title: form.title, description: form.description, updated_at: new Date() }).eq('id', editing.id);
      await supabase.from('program_courses').delete().eq('program_id', editing.id);
      if (form.courseIds.length > 0) {
        await supabase.from('program_courses').insert(
          form.courseIds.map((cid, i) => ({ program_id: editing.id, course_id: cid, order: i }))
        );
      }
    } else {
      const { data: newProg } = await supabase.from('programs').insert({ title: form.title, description: form.description, client_id: effectiveClientId }).select().single();
      if (newProg && form.courseIds.length > 0) {
        await supabase.from('program_courses').insert(
          form.courseIds.map((cid, i) => ({ program_id: newProg.id, course_id: cid, order: i }))
        );
      }
    }
    setSaving(false);
    setShowForm(false);
    fetchAll();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this program? This cannot be undone.')) return;
    await supabase.from('program_courses').delete().eq('program_id', id);
    await supabase.from('programs').delete().eq('id', id);
    fetchAll();
  }

  function addCourse(id) {
    setForm(f => ({ ...f, courseIds: [...f.courseIds, id] }));
  }

  function removeCourse(id) {
    setForm(f => ({ ...f, courseIds: f.courseIds.filter(c => c !== id) }));
  }

  const courseSensors = useSensors(useSensor(PointerSensor));

  function handleCourseDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setForm(f => {
      const oldIndex = f.courseIds.indexOf(active.id);
      const newIndex = f.courseIds.indexOf(over.id);
      return { ...f, courseIds: arrayMove(f.courseIds, oldIndex, newIndex) };
    });
  }

  const filteredPrograms = programs.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>Programs</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Search programs…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <button className="btn btn-primary" onClick={openNew}>+ New Program</button>
        </div>
      </div>

      {showForm && (
        <div style={styles.overlay}>
          <div className="card" style={styles.modal}>
            <h2 style={styles.modalTitle}>{editing ? 'Edit Program' : 'New Program'}</h2>
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label>Program Title *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Enterprise Onboarding" />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What will learners get from this program?" style={{ resize: 'vertical' }} />
              </div>
              <div className="form-group">
                <label>Courses in this Program {form.courseIds.length > 0 && <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>({form.courseIds.length} selected)</span>}</label>

                {form.courseIds.length > 0 && (() => {
                  const selectedCourses = form.courseIds.map(id => courses.find(c => c.id === id)).filter(Boolean);
                  return (
                    <>
                      <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 6 }}>Drag to reorder — this is the order learners will see.</p>
                      <DndContext sensors={courseSensors} collisionDetection={closestCenter} onDragEnd={handleCourseDragEnd}>
                        <SortableContext items={form.courseIds} strategy={verticalListSortingStrategy}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                            {selectedCourses.map(c => (
                              <SortableCourseRow key={c.id} id={c.id} title={c.title} onRemove={() => removeCourse(c.id)} />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    </>
                  );
                })()}

                {courses.length > 0 && (
                  <input
                    type="search"
                    placeholder="Search courses to add…"
                    value={courseSearch}
                    onChange={e => setCourseSearch(e.target.value)}
                    style={styles.courseSearchInput}
                  />
                )}
                <div style={styles.checkList}>
                  {courses.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>No courses yet — create some first.</p>
                  ) : (() => {
                    const availableCourses = courses.filter(c => !form.courseIds.includes(c.id) && c.title.toLowerCase().includes(courseSearch.toLowerCase()));
                    return availableCourses.length === 0 ? (
                      <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>{courseSearch ? `No courses match "${courseSearch}".` : 'All courses have been added.'}</p>
                    ) : availableCourses.map(c => (
                      <div key={c.id} style={styles.checkItem} onClick={() => addCourse(c.id)}>
                        <i className="fa-solid fa-plus" style={{ color: 'var(--gray-400)', fontSize: 12 }} />
                        {c.title}
                      </div>
                    ));
                  })()}
                </div>
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Program'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? <p style={{ color: 'var(--gray-400)' }}>Loading…</p> : (
        programs.length === 0 ? (
          <div className="card empty-state">
            <p>No programs yet. Create your first program to get started.</p>
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className="card empty-state">
            <p>No programs match "{search}".</p>
          </div>
        ) : (
          <div style={styles.list}>
            {filteredPrograms.map(prog => (
              <div key={prog.id} className="card" style={styles.row}>
                <div style={styles.rowInfo}>
                  <h3 style={styles.rowTitle}>{prog.title}</h3>
                  {prog.description && <p style={styles.rowDesc}>{prog.description}</p>}
                  <span style={styles.rowMeta}>{(prog.program_courses || []).length} course(s)</span>
                </div>
                <div style={styles.rowActions}>
                  <button className="btn btn-secondary" onClick={() => openEdit(prog)}>Edit</button>
                  <button className="btn btn-danger" onClick={() => handleDelete(prog.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function SortableCourseRow({ id, title, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={{ ...style, ...styles.selectedRow }}>
      <span {...attributes} {...listeners} style={styles.dragHandle} title="Drag to reorder">⠿</span>
      <span style={{ flex: 1, fontSize: 14 }}>{title}</span>
      <button type="button" className="btn btn-secondary" style={{ padding: '2px 10px', fontSize: 12 }} onClick={onRemove}>Remove</button>
    </div>
  );
}

const styles = {
  searchInput: { padding: '8px 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: 13, outline: 'none', width: 220 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal: { width: '100%', maxWidth: 560, padding: 28, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  courseSearchInput: { width: '100%', padding: '7px 10px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: 13, outline: 'none', marginBottom: 8, boxSizing: 'border-box' },
  checkList: { display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 200, overflowY: 'auto', padding: 4 },
  checkItem: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer' },
  selectedRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', background: '#fff' },
  dragHandle: { cursor: 'grab', fontSize: 16, color: 'var(--gray-300)', padding: '0 2px', userSelect: 'none' },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', gap: 16 },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: 600, marginBottom: 2 },
  rowDesc: { fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 },
  rowMeta: { fontSize: 12, color: 'var(--gray-400)' },
  rowActions: { display: 'flex', gap: 8, flexShrink: 0 },
};
