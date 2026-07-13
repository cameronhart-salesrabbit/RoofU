import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import RichTextEditor from '../../components/RichTextEditor';
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

export default function CourseBuilder() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState({ title: '' });
  const [expandedSection, setExpandedSection] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadCourse = useCallback(async () => {
    setLoading(true);
    const { data: c } = await supabase.from('courses').select('*').eq('id', courseId).single();
    setCourse(c || null);
    const { data: secs } = await supabase.from('sections').select('*, lessons(*)').eq('course_id', courseId).order('order');
    setSections(secs || []);
    setLoading(false);
  }, [courseId]);

  useEffect(() => { loadCourse(); }, [loadCourse]);

  async function togglePublish() {
    const newVal = !course.is_published;
    const { error } = await supabase.from('courses').update({ is_published: newVal }).eq('id', course.id);
    if (error) {
      console.error('togglePublish failed', error);
      alert(`Couldn't update publish status: ${error.message}`);
      return;
    }
    setCourse(c => ({ ...c, is_published: newVal }));
  }

  async function duplicateCourse() {
    if (!window.confirm(`Duplicate "${course.title}"? A draft copy will be created.`)) return;
    const { data: newCourse, error: courseErr } = await supabase.from('courses').insert({
      title: `${course.title} (Copy)`, description: course.description, product: course.product, is_published: false,
      client_id: course.client_id,
    }).select().single();
    if (courseErr || !newCourse) {
      console.error('duplicateCourse: course insert failed', courseErr);
      alert(`Couldn't duplicate course: ${courseErr?.message || 'unknown error'}`);
      return;
    }
    const { data: secs, error: secsErr } = await supabase.from('sections').select('*, lessons(*)').eq('course_id', course.id).order('order');
    if (secsErr) console.error('duplicateCourse: sections fetch failed', secsErr);
    const errors = [];
    for (const sec of secs || []) {
      const { data: newSec, error: newSecErr } = await supabase.from('sections').insert({ title: sec.title, course_id: newCourse.id, order: sec.order }).select().single();
      if (newSecErr || !newSec) { errors.push(`section "${sec.title}": ${newSecErr?.message || 'unknown error'}`); continue; }
      const sortedLessons = (sec.lessons || []).sort((a, b) => a.order - b.order);
      for (const lesson of sortedLessons) {
        const { error: lessonErr } = await supabase.from('lessons').insert({
          title: lesson.title, section_id: newSec.id, order: lesson.order,
          video_type: lesson.video_type, video_url: lesson.video_url,
          written_content: lesson.written_content, duration_minutes: lesson.duration_minutes,
          attachment_url: lesson.attachment_url, attachment_name: lesson.attachment_name,
        });
        if (lessonErr) errors.push(`lesson "${lesson.title}": ${lessonErr.message}`);
      }
    }
    if (errors.length) {
      console.error('duplicateCourse: partial failures', errors);
      alert(`Course was duplicated, but some content couldn't be copied:\n${errors.slice(0, 5).join('\n')}`);
    }
    navigate(`/admin/courses/${newCourse.id}`);
  }

  async function deleteCourse() {
    if (!window.confirm('Delete this course and all its sections and lessons?')) return;
    await supabase.from('courses').delete().eq('id', course.id);
    navigate('/admin/courses');
  }

  async function saveSection(e) {
    e.preventDefault();
    setSaving(true);
    if (editingSection) {
      await supabase.from('sections').update({ title: sectionForm.title }).eq('id', editingSection.id);
    } else {
      await supabase.from('sections').insert({ title: sectionForm.title, course_id: course.id, order: sections.length });
    }
    setSaving(false);
    setShowSectionForm(false);
    loadCourse();
  }

  async function deleteSection(id) {
    if (!window.confirm('Delete this section and all its lessons?')) return;
    await supabase.from('sections').delete().eq('id', id);
    loadCourse();
  }

  const sensors = useSensors(useSensor(PointerSensor));

  async function handleSectionDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex);
    setSections(reordered);
    await Promise.all(reordered.map((s, i) => supabase.from('sections').update({ order: i }).eq('id', s.id)));
  }

  if (loading) return <p style={{ color: 'var(--gray-400)' }}>Loading…</p>;

  if (!course) {
    return (
      <div>
        <Link to="/admin/courses" style={styles.backLink}><i className="fa-solid fa-arrow-left" /> Back to Courses</Link>
        <div className="card empty-state" style={{ marginTop: 16 }}><p>Course not found.</p></div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/admin/courses" style={styles.backLink}><i className="fa-solid fa-arrow-left" /> Back to Courses</Link>

      <div className="page-header">
        <div>
          <h1 style={{ fontSize: 20 }}>{course.title}</h1>
          <span className="badge badge-red" style={{ marginTop: 4 }}>{course.product}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            style={course.is_published ? { background: '#F4F6F1', color: '#404A34', border: '1px solid #9AB485' } : {}}
            onClick={togglePublish}
          >
            <i className={`fa-solid fa-${course.is_published ? 'eye' : 'eye-slash'}`} />
            {course.is_published ? 'Published' : 'Draft'}
          </button>
          <button className="btn btn-secondary" onClick={duplicateCourse}><i className="fa-solid fa-copy" /> Duplicate</button>
          <button className="btn btn-secondary" onClick={() => window.open(`/courses/${course.id}`, '_blank')}><i className="fa-solid fa-eye" /> Preview</button>
          <button className="btn btn-danger" onClick={deleteCourse}>Delete</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={styles.panelTitle}>Sections</h2>
        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => { setEditingSection(null); setSectionForm({ title: '' }); setShowSectionForm(true); }}>+ Add Section</button>
      </div>

      {sections.length === 0 ? (
        <div className="card empty-state"><p>No sections yet. Add a section to start building this course.</p></div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
          <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
            {sections.map(sec => (
              <SectionCard
                key={sec.id}
                section={sec}
                expanded={expandedSection === sec.id}
                onToggle={() => setExpandedSection(expandedSection === sec.id ? null : sec.id)}
                onEdit={() => { setEditingSection(sec); setSectionForm({ title: sec.title }); setShowSectionForm(true); }}
                onDelete={() => deleteSection(sec.id)}
                onRefresh={loadCourse}
                clientId={course.client_id}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}

      {/* Section form modal */}
      {showSectionForm && (
        <div style={styles.overlay}>
          <div className="card" style={styles.modal}>
            <h2 style={styles.modalTitle}>{editingSection ? 'Edit Section' : 'New Section'}</h2>
            <form onSubmit={saveSection}>
              <div className="form-group">
                <label>Section Title *</label>
                <input required autoFocus value={sectionForm.title} onChange={e => setSectionForm({ title: e.target.value })} placeholder="e.g. Getting Started" />
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSectionForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Section'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, expanded, onToggle, onEdit, onDelete, onRefresh, clientId }) {
  const [lessons, setLessons] = useState(section.lessons || []);
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [lessonForm, setLessonForm] = useState({ title: '', video_type: 'youtube', video_url: '', written_content: '', duration_minutes: '', attachment_url: '', attachment_name: '' });
  const [saving, setSaving] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const dragStyle = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const lessonSensors = useSensors(useSensor(PointerSensor));

  async function handleLessonDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lessons.findIndex(l => l.id === active.id);
    const newIndex = lessons.findIndex(l => l.id === over.id);
    const reordered = arrayMove(lessons, oldIndex, newIndex);
    setLessons(reordered);
    await Promise.all(reordered.map((l, i) => supabase.from('lessons').update({ order: i }).eq('id', l.id)));
  }

  async function saveLesson(e) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...lessonForm,
      duration_minutes: lessonForm.duration_minutes ? Number(lessonForm.duration_minutes) : null,
    };
    const { error } = editingLesson
      ? await supabase.from('lessons').update({ ...payload, updated_at: new Date() }).eq('id', editingLesson.id)
      : await supabase.from('lessons').insert({ ...payload, section_id: section.id, order: lessons.length });
    setSaving(false);
    if (error) {
      console.error('saveLesson failed', error);
      alert(`Couldn't save lesson: ${error.message}`);
      return;
    }
    setShowLessonForm(false);
    const { data } = await supabase.from('lessons').select('*').eq('section_id', section.id).order('order');
    setLessons(data || []);
  }

  async function deleteLesson(id) {
    if (!window.confirm('Delete this lesson?')) return;
    await supabase.from('lessons').delete().eq('id', id);
    setLessons(l => l.filter(x => x.id !== id));
  }

  async function duplicateLesson(lesson) {
    const { error } = await supabase.from('lessons').insert({
      title: `${lesson.title} (Copy)`, section_id: section.id, order: lessons.length,
      video_type: lesson.video_type, video_url: lesson.video_url,
      written_content: lesson.written_content, duration_minutes: lesson.duration_minutes,
      attachment_url: lesson.attachment_url, attachment_name: lesson.attachment_name,
    });
    if (error) {
      console.error('duplicateLesson failed', error);
      alert(`Couldn't duplicate lesson: ${error.message}`);
      return;
    }
    const { data } = await supabase.from('lessons').select('*').eq('section_id', section.id).order('order');
    setLessons(data || []);
  }

  async function handlePdfUpload(e) {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;
    setUploadingPdf(true);
    const path = `${clientId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('lesson-attachments').upload(path, file);
    if (error) {
      console.error('PDF upload failed', error);
      alert(`Couldn't upload PDF: ${error.message}`);
    } else {
      const { data: { publicUrl } } = supabase.storage.from('lesson-attachments').getPublicUrl(path);
      setLessonForm(f => ({ ...f, attachment_url: publicUrl, attachment_name: file.name }));
    }
    setUploadingPdf(false);
  }

  return (
    <div ref={setNodeRef} style={{ ...dragStyle, marginBottom: 12 }} className="card">
      <div style={sStyles.sectionHeader} onClick={onToggle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Drag handle */}
          <span
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
            style={sStyles.dragHandle}
            title="Drag to reorder"
          >⠿</span>
          <span style={{ fontSize: 18, color: 'var(--gray-400)', userSelect: 'none' }}>{expanded ? '▾' : '▸'}</span>
          <span style={sStyles.sectionTitle}>{section.title}</span>
          <span className="badge badge-gray">{lessons.length} lesson{lessons.length !== 1 ? 's' : ''}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
          <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onEdit}>Edit</button>
          <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onDelete}>Delete</button>
        </div>
      </div>

      {expanded && (
        <div style={sStyles.sectionBody}>
          <DndContext sensors={lessonSensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
            <SortableContext items={lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
              {lessons.map(lesson => (
                <SortableLesson
                  key={lesson.id}
                  lesson={lesson}
                  onEdit={() => { setEditingLesson(lesson); setLessonForm({ title: lesson.title, video_type: lesson.video_type, video_url: lesson.video_url || '', written_content: lesson.written_content || '', duration_minutes: lesson.duration_minutes || '', attachment_url: lesson.attachment_url || '', attachment_name: lesson.attachment_name || '' }); setShowLessonForm(true); }}
                  onDuplicate={() => duplicateLesson(lesson)}
                  onDelete={() => deleteLesson(lesson.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button className="btn btn-secondary" style={{ marginTop: 8, fontSize: 13 }} onClick={() => { setEditingLesson(null); setLessonForm({ title: '', video_type: 'youtube', video_url: '', written_content: '', duration_minutes: '', attachment_url: '', attachment_name: '' }); setShowLessonForm(true); }}>+ Add Lesson</button>
        </div>
      )}

      {showLessonForm && (
        <div style={styles.overlay}>
          <div className="card" style={{ ...styles.modal, maxWidth: 640 }}>
            <h2 style={styles.modalTitle}>{editingLesson ? 'Edit Lesson' : 'New Lesson'}</h2>
            <form onSubmit={saveLesson}>
              <div className="form-group">
                <label>Lesson Title *</label>
                <input required value={lessonForm.title} onChange={e => setLessonForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Introduction to SalesRabbit" />
              </div>
              <div className="form-group">
                <label>Video Type</label>
                <select value={lessonForm.video_type} onChange={e => setLessonForm(f => ({ ...f, video_type: e.target.value }))}>
                  <option value="youtube">YouTube Embed</option>
                  <option value="mp4">MP4 Upload URL</option>
                </select>
              </div>
              <div className="form-group">
                <label>{lessonForm.video_type === 'youtube' ? 'YouTube URL' : 'MP4 File URL'}</label>
                <input value={lessonForm.video_url} onChange={e => setLessonForm(f => ({ ...f, video_url: e.target.value }))} placeholder={lessonForm.video_type === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'https://...'} />
              </div>
              <div className="form-group">
                <label>Duration (minutes)</label>
                <input type="number" min={0} value={lessonForm.duration_minutes} onChange={e => setLessonForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="e.g. 5" style={{ width: 120 }} />
              </div>
              <div className="form-group">
                <label>Written Content</label>
                <RichTextEditor
                  value={lessonForm.written_content}
                  onChange={val => setLessonForm(f => ({ ...f, written_content: val }))}
                  clientId={clientId}
                />
              </div>
              <div className="form-group">
                <label>PDF Attachment</label>
                {lessonForm.attachment_name && (
                  <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <i className="fa-solid fa-paperclip" />
                    {lessonForm.attachment_name}
                    <button type="button" style={{ marginLeft: 4, fontSize: 12, color: 'var(--gray-400)', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => setLessonForm(f => ({ ...f, attachment_url: '', attachment_name: '' }))}>Remove</button>
                  </div>
                )}
                <input type="file" accept="application/pdf" onChange={handlePdfUpload} disabled={uploadingPdf} style={{ fontSize: 13 }} />
                {uploadingPdf && <p style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 4 }}>Uploading…</p>}
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowLessonForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Lesson'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  backLink: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-500)', textDecoration: 'none', marginBottom: 16 },
  panelTitle: { fontSize: 15, fontWeight: 700, color: 'var(--gray-700)' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 },
  modal: { width: '100%', maxWidth: 540, padding: 28, maxHeight: '90vh', overflowY: 'auto' },
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
};

function SortableLesson({ lesson, onEdit, onDuplicate, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, ...sStyles.lessonRow }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span {...attributes} {...listeners} style={sStyles.dragHandle} title="Drag to reorder">⠿</span>
        <span style={sStyles.lessonTitle}>{lesson.title}</span>
        <span className="badge badge-gray" style={{ fontSize: 11 }}>{lesson.video_type}</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => window.open(`/lessons/${lesson.id}`, '_blank')}><i className="fa-solid fa-eye" /></button>
        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onDuplicate}><i className="fa-solid fa-copy" /></button>
        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onEdit}>Edit</button>
        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 12 }} onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

const sStyles = {
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', cursor: 'pointer' },
  sectionTitle: { fontSize: 14, fontWeight: 600 },
  sectionBody: { borderTop: '1px solid var(--gray-100)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  lessonRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--gray-100)' },
  lessonTitle: { fontSize: 13, fontWeight: 500 },
  dragHandle: { cursor: 'grab', fontSize: 16, color: 'var(--gray-300)', padding: '0 2px', userSelect: 'none' },
};
