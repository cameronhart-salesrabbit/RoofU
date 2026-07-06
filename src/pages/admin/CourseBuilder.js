import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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

const PRODUCTS = ['SalesRabbit', 'SalesRabbit+', 'RoofLink', 'Roofle', 'Roofing General'];

export default function CourseBuilder() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({ title: '', description: '', product: PRODUCTS[0] });
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [sectionForm, setSectionForm] = useState({ title: '' });
  const [expandedSection, setExpandedSection] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchCourses(); }, []);
  useEffect(() => {
    if (courseId && courses.length > 0) {
      const c = courses.find(c => c.id === courseId);
      if (c) selectCourse(c);
    }
  }, [courseId, courses]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchCourses() {
    setLoading(true);
    const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
    setCourses(data || []);
    setLoading(false);
  }

  async function selectCourse(course) {
    setSelected(course);
    navigate(`/admin/courses/${course.id}`, { replace: true });
    const { data } = await supabase
      .from('sections')
      .select('*, lessons(*)')
      .eq('course_id', course.id)
      .order('order');
    setSections(data || []);
  }

  async function saveCourse(e) {
    e.preventDefault();
    setSaving(true);
    if (editingCourse) {
      await supabase.from('courses').update({ ...courseForm, updated_at: new Date() }).eq('id', editingCourse.id);
    } else {
      const { data } = await supabase.from('courses').insert(courseForm).select().single();
      if (data) selectCourse(data);
    }
    setSaving(false);
    setShowCourseForm(false);
    fetchCourses();
  }

  async function deleteCourse(id) {
    if (!window.confirm('Delete this course and all its sections and lessons?')) return;
    await supabase.from('courses').delete().eq('id', id);
    setSelected(null);
    navigate('/admin/courses', { replace: true });
    fetchCourses();
  }

  async function togglePublish() {
    const newVal = !selected.is_published;
    await supabase.from('courses').update({ is_published: newVal }).eq('id', selected.id);
    setSelected(s => ({ ...s, is_published: newVal }));
    setCourses(cs => cs.map(c => c.id === selected.id ? { ...c, is_published: newVal } : c));
  }

  async function duplicateCourse(course) {
    if (!window.confirm(`Duplicate "${course.title}"? A draft copy will be created.`)) return;
    const { data: newCourse } = await supabase.from('courses').insert({
      title: `${course.title} (Copy)`, description: course.description, product: course.product, is_published: false,
    }).select().single();
    if (!newCourse) return;
    const { data: secs } = await supabase.from('sections').select('*, lessons(*)').eq('course_id', course.id).order('order');
    for (const sec of secs || []) {
      const { data: newSec } = await supabase.from('sections').insert({ title: sec.title, course_id: newCourse.id, order: sec.order }).select().single();
      if (!newSec) continue;
      const sortedLessons = (sec.lessons || []).sort((a, b) => a.order - b.order);
      for (const lesson of sortedLessons) {
        await supabase.from('lessons').insert({
          title: lesson.title, section_id: newSec.id, order: lesson.order,
          video_type: lesson.video_type, video_url: lesson.video_url,
          written_content: lesson.written_content, duration_minutes: lesson.duration_minutes,
          attachment_url: lesson.attachment_url, attachment_name: lesson.attachment_name,
        });
      }
    }
    await fetchCourses();
    selectCourse(newCourse);
  }

  async function saveSection(e) {
    e.preventDefault();
    setSaving(true);
    if (editingSection) {
      await supabase.from('sections').update({ title: sectionForm.title }).eq('id', editingSection.id);
    } else {
      await supabase.from('sections').insert({ title: sectionForm.title, course_id: selected.id, order: sections.length });
    }
    setSaving(false);
    setShowSectionForm(false);
    selectCourse(selected);
  }

  async function deleteSection(id) {
    if (!window.confirm('Delete this section and all its lessons?')) return;
    await supabase.from('sections').delete().eq('id', id);
    selectCourse(selected);
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

  return (
    <div style={styles.layout}>
      {/* Course list panel */}
      <div style={styles.listPanel}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={styles.panelTitle}>Courses</h2>
          <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 13 }} onClick={() => { setEditingCourse(null); setCourseForm({ title: '', description: '', product: PRODUCTS[0] }); setShowCourseForm(true); }}>+ New</button>
        </div>
        {loading ? <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>Loading…</p> : (
          courses.length === 0 ? <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>No courses yet.</p> : (
            courses.map(c => (
              <div
                key={c.id}
                style={{ ...styles.courseItem, ...(selected?.id === c.id ? styles.courseItemActive : {}) }}
                onClick={() => selectCourse(c)}
              >
                <span style={styles.courseItemTitle}>{c.title}</span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <span className="badge badge-gray" style={{ fontSize: 11 }}>{c.product}</span>
                  {!c.is_published && <span className="badge" style={{ fontSize: 11, background: '#FEF7F2', color: 'var(--red)' }}>Draft</span>}
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Course detail panel */}
      <div style={styles.detailPanel}>
        {!selected ? (
          <div className="empty-state">
            <p>Select a course or create a new one to get started.</p>
          </div>
        ) : (
          <>
            <div className="page-header">
              <div>
                <h1 style={{ fontSize: 20 }}>{selected.title}</h1>
                <span className="badge badge-red" style={{ marginTop: 4 }}>{selected.product}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-secondary"
                  style={selected.is_published ? { background: '#F4F6F1', color: '#404A34', border: '1px solid #9AB485' } : {}}
                  onClick={togglePublish}
                >
                  <i className={`fa-solid fa-${selected.is_published ? 'eye' : 'eye-slash'}`} />
                  {selected.is_published ? 'Published' : 'Draft'}
                </button>
                <button className="btn btn-secondary" onClick={() => duplicateCourse(selected)}><i className="fa-solid fa-copy" /> Duplicate</button>
                <button className="btn btn-secondary" onClick={() => window.open(`/courses/${selected.id}`, '_blank')}><i className="fa-solid fa-eye" /> Preview</button>
                <button className="btn btn-secondary" onClick={() => { setEditingCourse(selected); setCourseForm({ title: selected.title, description: selected.description || '', product: selected.product }); setShowCourseForm(true); }}>Edit</button>
                <button className="btn btn-danger" onClick={() => deleteCourse(selected.id)}>Delete</button>
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
                      onRefresh={() => selectCourse(selected)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            )}
          </>
        )}
      </div>

      {/* Course form modal */}
      {showCourseForm && (
        <div style={styles.overlay}>
          <div className="card" style={styles.modal}>
            <h2 style={styles.modalTitle}>{editingCourse ? 'Edit Course' : 'New Course'}</h2>
            <form onSubmit={saveCourse}>
              <div className="form-group">
                <label>Course Title *</label>
                <input required value={courseForm.title} onChange={e => setCourseForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. SalesRabbit Core" />
              </div>
              <div className="form-group">
                <label>Product</label>
                <select value={courseForm.product} onChange={e => setCourseForm(f => ({ ...f, product: e.target.value }))}>
                  {PRODUCTS.map(p => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea rows={3} value={courseForm.description} onChange={e => setCourseForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
              </div>
              <div style={styles.modalFooter}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCourseForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Course'}</button>
              </div>
            </form>
          </div>
        </div>
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

function SectionCard({ section, expanded, onToggle, onEdit, onDelete, onRefresh }) {
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
    if (editingLesson) {
      await supabase.from('lessons').update({ ...payload, updated_at: new Date() }).eq('id', editingLesson.id);
    } else {
      await supabase.from('lessons').insert({ ...payload, section_id: section.id, order: lessons.length });
    }
    setSaving(false);
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
    await supabase.from('lessons').insert({
      title: `${lesson.title} (Copy)`, section_id: section.id, order: lessons.length,
      video_type: lesson.video_type, video_url: lesson.video_url,
      written_content: lesson.written_content, duration_minutes: lesson.duration_minutes,
      attachment_url: lesson.attachment_url, attachment_name: lesson.attachment_name,
    });
    const { data } = await supabase.from('lessons').select('*').eq('section_id', section.id).order('order');
    setLessons(data || []);
  }

  async function handlePdfUpload(e) {
    const file = e.target.files[0];
    if (!file || file.type !== 'application/pdf') return;
    setUploadingPdf(true);
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabase.storage.from('lesson-attachments').upload(path, file);
    if (!error) {
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
  layout: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  listPanel: { width: 240, minWidth: 240, background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', padding: 16, position: 'sticky', top: 0 },
  detailPanel: { flex: 1 },
  panelTitle: { fontSize: 15, fontWeight: 700, color: 'var(--gray-700)' },
  courseItem: { padding: '10px 12px', borderRadius: 6, cursor: 'pointer', marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 4, border: '1px solid transparent' },
  courseItemActive: { background: 'var(--red-light)', border: '1px solid var(--red)', },
  courseItemTitle: { fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' },
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
