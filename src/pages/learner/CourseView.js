import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useProgress } from '../../context/ProgressContext';

export default function CourseView() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const { fetchProgress, isLessonComplete, getCourseProgress } = useProgress();

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('courses').select('*').eq('id', courseId).single();
      const { data: secs } = await supabase
        .from('sections')
        .select('*, lessons(*)')
        .eq('course_id', courseId)
        .order('order');
      setCourse(c);
      setSections((secs || []).map(s => ({ ...s, lessons: (s.lessons || []).sort((a, b) => a.order - b.order) })));
      await fetchProgress(courseId);
      setLoading(false);
    }
    load();
  }, [courseId, fetchProgress]);

  if (loading) return <LoadingSkeleton />;
  if (!course) return <p>Course not found.</p>;

  const totalLessons = sections.reduce((sum, s) => sum + (s.lessons || []).length, 0);
  const pct = getCourseProgress(courseId, totalLessons);
  const allLessonsFlat = sections.flatMap(s => s.lessons || []);
  const firstIncomplete = allLessonsFlat.find(l => !isLessonComplete(courseId, l.id));
  const resumeLesson = firstIncomplete || allLessonsFlat[0];
  const totalMinutes = allLessonsFlat.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);

  return (
    <div className="page-fade">
      {/* Breadcrumb */}
      <div style={styles.breadcrumbs}>
        <Link to="/" style={styles.crumb}>My Programs</Link>
        <span style={styles.sep}>›</span>
        <span style={styles.crumbCurrent}>{course.title}</span>
      </div>

      <div style={styles.courseHeader}>
        <div>
          <h1 style={styles.title}>{course.title}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <span className="badge badge-red">{course.product}</span>
            {totalMinutes > 0 && <span style={styles.timeEstimate}><i className="fa-solid fa-clock" style={{ fontSize: 11 }} /> {totalMinutes}m total</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {resumeLesson && (
            <button className="btn btn-primary" onClick={() => navigate(`/lessons/${resumeLesson.id}`)}>
              <i className="fa-solid fa-play" />
              {pct === 0 ? 'Start Course' : pct === 100 ? 'Review Course' : 'Continue'}
            </button>
          )}
          {totalLessons > 0 && (
            <div style={styles.progressBox}>
              <div style={styles.progressLabel}>
                <span>{pct}% complete</span>
                <span style={{ color: 'var(--gray-400)' }}>{sections.reduce((sum, s) => sum + (s.lessons || []).filter(l => isLessonComplete(courseId, l.id)).length, 0)}/{totalLessons} lessons</span>
              </div>
              <ProgressBar pct={pct} />
            </div>
          )}
        </div>
      </div>

      {course.description && <p style={styles.desc}>{course.description}</p>}

      {sections.length === 0 ? (
        <div className="card empty-state"><p>No content in this course yet.</p></div>
      ) : (
        sections.map(sec => {
          const secLessons = sec.lessons || [];
          const secCompleted = secLessons.filter(l => isLessonComplete(courseId, l.id)).length;
          return (
            <div key={sec.id} style={{ marginBottom: 28 }}>
              <div style={styles.sectionHeader}>
                <h2 style={styles.sectionTitle}>{sec.title}</h2>
                <span style={styles.sectionMeta}>{secCompleted}/{secLessons.length} done</span>
              </div>
              <div style={styles.lessonList}>
                {secLessons.map((lesson) => {
                  const done = isLessonComplete(courseId, lesson.id);
                  return (
                    <div
                      key={lesson.id}
                      className="card"
                      style={{ ...styles.lessonRow, ...(done ? styles.lessonRowDone : {}) }}
                      onClick={() => navigate(`/lessons/${lesson.id}`)}
                    >
                      <div style={{ ...styles.lessonIcon, background: done ? '#d1fae5' : 'var(--red-light)' }}>
                        {done ? <span style={{ color: '#059669', fontSize: 16 }}>✓</span> : <span style={{ color: 'var(--red)' }}>▶</span>}
                      </div>
                      <div style={styles.lessonInfo}>
                        <span style={styles.lessonTitle}>{lesson.title}</span>
                        <span style={styles.lessonMeta}>
                        {lesson.video_type === 'youtube' ? 'YouTube' : 'Video'}
                        {lesson.duration_minutes ? <span style={{ marginLeft: 8 }}><i className="fa-solid fa-clock" style={{ fontSize: 10 }} /> {lesson.duration_minutes}m</span> : null}
                        {lesson.attachment_url ? <span style={{ marginLeft: 8 }}><i className="fa-solid fa-paperclip" style={{ fontSize: 10 }} /> PDF</span> : null}
                      </span>
                      </div>
                      {done && <span className="badge badge-green">Done</span>}
                      <span style={styles.arrow}>→</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export function ProgressBar({ pct, height = 8 }) {
  return (
    <div style={{ background: 'var(--gray-200)', borderRadius: 999, height, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: 'var(--red)', borderRadius: 999, transition: 'width 0.4s ease' }} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div style={{ height: 20, width: 200, background: 'var(--gray-100)', borderRadius: 4, marginBottom: 20 }} />
      <div style={{ height: 32, width: 300, background: 'var(--gray-100)', borderRadius: 4, marginBottom: 24 }} />
      {[1, 2].map(i => (
        <div key={i} style={{ marginBottom: 24 }}>
          <div style={{ height: 18, width: 180, background: 'var(--gray-100)', borderRadius: 4, marginBottom: 12 }} />
          {[1, 2, 3].map(j => (
            <div key={j} className="card" style={{ padding: '14px 18px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--gray-100)' }} />
              <div style={{ height: 14, width: 200, background: 'var(--gray-100)', borderRadius: 4 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

const styles = {
  breadcrumbs: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13 },
  crumb: { color: 'var(--gray-500)', fontWeight: 500, textDecoration: 'none' },
  sep: { color: 'var(--gray-300)' },
  crumbCurrent: { color: 'var(--gray-700)', fontWeight: 500 },
  courseHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 16, flexWrap: 'wrap' },
  title: { fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' },
  progressBox: { minWidth: 220, flex: '0 0 220px' },
  timeEstimate: { fontSize: 12, color: 'var(--gray-500)', display: 'inline-flex', alignItems: 'center', gap: 4 },
  progressLabel: { display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 6 },
  desc: { fontSize: 15, color: 'var(--gray-600)', marginBottom: 24, lineHeight: 1.6 },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 4 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: 'var(--gray-700)' },
  sectionMeta: { fontSize: 12, color: 'var(--gray-400)' },
  lessonList: { display: 'flex', flexDirection: 'column', gap: 8 },
  lessonRow: { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', cursor: 'pointer', transition: 'box-shadow 0.15s' },
  lessonRowDone: { background: '#f0fdf4' },
  lessonIcon: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 },
  lessonInfo: { flex: 1 },
  lessonTitle: { fontSize: 14, fontWeight: 600, display: 'block' },
  lessonMeta: { fontSize: 12, color: 'var(--gray-400)' },
  arrow: { fontSize: 18, color: 'var(--gray-400)' },
};
