import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useProgress } from '../../context/ProgressContext';

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').trim();
  const navigate = useNavigate();
  const { learnerId } = useProgress();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!learnerId) return;
    async function load() {
      const { data: enrollments } = await supabase.from('user_program_enrollments').select('program_id').eq('user_id', learnerId);
      const enrolledIds = (enrollments || []).map(e => e.program_id);
      if (enrolledIds.length === 0) { setPrograms([]); setLoading(false); return; }

      const { data } = await supabase
        .from('programs')
        .select('*, program_courses(order, courses(id, title, description, product, is_published, sections(id, title, lessons(id, title, video_type, written_content))))')
        .in('id', enrolledIds)
        .order('created_at', { ascending: false });
      setPrograms(data || []);
      setLoading(false);
    }
    load();
  }, [learnerId]);

  if (loading) return <p style={{ color: 'var(--gray-400)', padding: 32 }}>Searching…</p>;

  const q = query.toLowerCase();
  const matches = (...fields) => q.length > 0 && fields.some(f => (f || '').toLowerCase().includes(q));

  const matchingPrograms = q ? programs.filter(p => matches(p.title, p.description)) : [];

  const matchingCourses = [];
  const matchingLessons = [];
  programs.forEach(prog => {
    (prog.program_courses || []).forEach(pc => {
      const course = pc.courses;
      if (!course || course.is_published === false) return;
      if (q && matches(course.title, course.description, course.product)) {
        matchingCourses.push({ ...course, programTitle: prog.title });
      }
      (course.sections || []).forEach(sec => {
        (sec.lessons || []).forEach(lesson => {
          if (q && matches(lesson.title, stripHtml(lesson.written_content))) {
            matchingLessons.push({ ...lesson, courseTitle: course.title, courseId: course.id, sectionTitle: sec.title });
          }
        });
      });
    });
  });

  const totalResults = matchingPrograms.length + matchingCourses.length + matchingLessons.length;

  return (
    <div className="page-fade">
      <div style={styles.pageTop}>
        <div>
          <div style={styles.eyebrow}>Search</div>
          <h1 style={styles.heading}>Results for "{query}"</h1>
        </div>
      </div>

      {!query ? (
        <div className="card empty-state"><p>Type something in the search bar to find programs, courses, and lessons.</p></div>
      ) : totalResults === 0 ? (
        <div className="card empty-state"><p>No matches for "{query}".</p></div>
      ) : (
        <>
          {matchingPrograms.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={styles.sectionTitle}>Programs ({matchingPrograms.length})</h2>
              <div style={styles.list}>
                {matchingPrograms.map(p => (
                  <div key={p.id} className="card" style={styles.row} onClick={() => navigate(`/programs/${p.id}`)}>
                    <span className="badge badge-red" style={{ flexShrink: 0 }}>Program</span>
                    <div style={styles.rowInfo}>
                      <span style={styles.rowTitle}>{p.title}</span>
                      {p.description && <span style={styles.rowMeta}>{p.description}</span>}
                    </div>
                    <span style={styles.arrow}>→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchingCourses.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={styles.sectionTitle}>Courses ({matchingCourses.length})</h2>
              <div style={styles.list}>
                {matchingCourses.map(c => (
                  <div key={c.id} className="card" style={styles.row} onClick={() => navigate(`/courses/${c.id}`)}>
                    <span className="badge badge-gray" style={{ flexShrink: 0 }}>Course</span>
                    <div style={styles.rowInfo}>
                      <span style={styles.rowTitle}>{c.title}</span>
                      <span style={styles.rowMeta}>{c.programTitle} · {c.product}</span>
                    </div>
                    <span style={styles.arrow}>→</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {matchingLessons.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h2 style={styles.sectionTitle}>Lessons ({matchingLessons.length})</h2>
              <div style={styles.list}>
                {matchingLessons.map(l => (
                  <div key={l.id} className="card" style={styles.row} onClick={() => navigate(`/lessons/${l.id}`)}>
                    <span className="badge badge-gray" style={{ flexShrink: 0 }}>Lesson</span>
                    <div style={styles.rowInfo}>
                      <span style={styles.rowTitle}>{l.title}</span>
                      <span style={styles.rowMeta}>{l.courseTitle} · {l.sectionTitle}</span>
                    </div>
                    <span style={styles.arrow}>→</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <Link to="/" style={styles.backLink}>← Back to My Programs</Link>
    </div>
  );
}

const styles = {
  pageTop: { marginBottom: 24 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 4 },
  heading: { fontSize: 22, fontWeight: 700, color: 'var(--gray-900)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 10 },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  row: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', transition: 'box-shadow 0.15s' },
  rowInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: 600, color: 'var(--gray-900)' },
  rowMeta: { fontSize: 12, color: 'var(--gray-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  arrow: { fontSize: 18, color: 'var(--gray-400)' },
  backLink: { display: 'inline-block', marginTop: 8, fontSize: 13, color: 'var(--gray-500)', textDecoration: 'none' },
};
