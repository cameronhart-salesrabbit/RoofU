import React, { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useProgress } from '../../context/ProgressContext';

export default function LearnerDashboard() {
  const { user } = useOutletContext();
  const navigate = useNavigate();
  const { fetchProgress, isLessonComplete, getCourseProgress } = useProgress();
  const [programs, setPrograms] = useState([]);
  const [quizStats, setQuizStats] = useState({ taken: 0, passed: 0, avg: 0 });
  const [totalLessonsCompleted, setTotalLessonsCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: progs }, { data: progress }, { data: qr }] = await Promise.all([
        supabase.from('programs')
          .select('*, program_courses(order, courses(id, title, product, sections(*, lessons(*))))')
          .order('created_at', { ascending: false }),
        supabase.from('progress').select('*').eq('user_id', user.id),
        supabase.from('quiz_results').select('*').eq('user_id', user.id),
      ]);

      const progList = (progs || []).map(p => {
        const courses = (p.program_courses || [])
          .sort((a, b) => a.order - b.order)
          .map(pc => pc.courses)
          .filter(c => c && c.is_published !== false);
        return { ...p, courses };
      });
      setPrograms(progList);

      // Pre-fetch progress for all courses
      const allCourseIds = progList.flatMap(p => p.courses.map(c => c.id));
      await Promise.all([...new Set(allCourseIds)].map(id => fetchProgress(id)));

      // Total lessons completed
      const completed = (progress || []).reduce((sum, p) => sum + (p.completed_lesson_ids || []).length, 0);
      setTotalLessonsCompleted(completed);

      // Quiz stats
      const results = qr || [];
      if (results.length > 0) {
        setQuizStats({
          taken: results.length,
          passed: results.filter(r => r.passed).length,
          avg: Math.round(results.reduce((s, r) => s + r.score, 0) / results.length),
        });
      }

      setLoading(false);
    }
    load();
  }, [user.id, fetchProgress]);

  if (loading) return <p style={{ color: 'var(--gray-400)', padding: 32 }}>Loading…</p>;

  const totalCourses = programs.reduce((sum, p) => sum + p.courses.length, 0);
  const allCoursesFlat = programs.flatMap(p => p.courses);
  const completedCourses = allCoursesFlat.filter(c => {
    const total = (c.sections || []).reduce((s, sec) => s + (sec.lessons || []).length, 0);
    return total > 0 && getCourseProgress(c.id, total) === 100;
  }).length;

  return (
    <div className="page-fade">
      <div style={styles.pageTop}>
        <div>
          <div style={styles.eyebrow}>Progress</div>
          <h1 style={styles.heading}>Your Dashboard</h1>
        </div>
      </div>

      {/* Stats row */}
      <div style={styles.statsRow}>
        {[
          { label: 'Lessons Completed', value: totalLessonsCompleted, icon: 'fa-circle-check' },
          { label: 'Courses Completed', value: completedCourses, icon: 'fa-book-open', sub: `of ${totalCourses}` },
          { label: 'Quizzes Taken', value: quizStats.taken, icon: 'fa-clipboard-question' },
          { label: 'Quiz Avg. Score', value: quizStats.taken > 0 ? `${quizStats.avg}%` : '—', icon: 'fa-chart-simple', mono: true },
        ].map(stat => (
          <div key={stat.label} className="card" style={styles.statCard}>
            <div style={styles.statIcon}><i className={`fa-solid ${stat.icon}`} style={{ fontSize: 14, color: 'var(--red)' }} /></div>
            <div style={{ ...styles.statVal, fontFamily: stat.mono ? 'var(--font-mono)' : undefined }}>{stat.value}</div>
            <div style={styles.statLabel}>{stat.label}{stat.sub ? <span style={styles.statSub}> {stat.sub}</span> : null}</div>
          </div>
        ))}
      </div>

      {/* Programs */}
      {programs.length === 0 ? (
        <div className="card empty-state"><p>You haven't been enrolled in any programs yet.</p></div>
      ) : (
        programs.map(prog => {
          if (prog.courses.length === 0) return null;
          return (
            <div key={prog.id} style={{ marginBottom: 28 }}>
              <div style={styles.progHeader}>
                <h2 style={styles.progTitle}>{prog.title}</h2>
                <span style={styles.progMeta}>{prog.courses.length} course{prog.courses.length !== 1 ? 's' : ''}</span>
              </div>
              <div style={styles.courseGrid}>
                {prog.courses.map(course => {
                  const allLessons = (course.sections || []).flatMap(s => s.lessons || []);
                  const total = allLessons.length;
                  const pct = getCourseProgress(course.id, total);
                  const completedCount = allLessons.filter(l => isLessonComplete(course.id, l.id)).length;
                  const firstIncomplete = allLessons.find(l => !isLessonComplete(course.id, l.id));
                  return (
                    <div key={course.id} className="card" style={styles.courseCard}>
                      <div style={styles.courseCardTop}>
                        <div style={styles.productTag}><i className="fa-solid fa-circle" style={{ fontSize: 6 }} /> {course.product}</div>
                        <div style={styles.courseTitle}>{course.title}</div>
                        <div style={styles.courseMeta}>{completedCount}/{total} lessons</div>
                      </div>
                      <div style={styles.progBarWrap}>
                        <div style={styles.progBarRow}>
                          <span style={styles.progBarLabel}>Progress</span>
                          <span style={styles.progBarPct}>{pct}%</span>
                        </div>
                        <div style={styles.barTrack}>
                          <div style={{ ...styles.barFill, width: `${pct}%` }} />
                        </div>
                      </div>
                      <button
                        style={{ ...styles.ctaBtn, ...(pct === 100 ? styles.ctaBtnDone : {}) }}
                        onClick={() => firstIncomplete ? navigate(`/lessons/${firstIncomplete.id}`) : navigate(`/courses/${course.id}`)}
                      >
                        <i className={`fa-solid fa-${pct === 0 ? 'play' : pct === 100 ? 'rotate-left' : 'arrow-right'}`} />
                        {pct === 0 ? 'Start' : pct === 100 ? 'Review' : 'Continue'}
                      </button>
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

const styles = {
  pageTop: { marginBottom: 24 },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 4 },
  heading: { fontSize: 22, fontWeight: 700, color: 'var(--gray-900)' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 32 },
  statCard: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 },
  statIcon: { marginBottom: 4 },
  statVal: { fontSize: 28, fontWeight: 700, color: 'var(--red)', lineHeight: 1 },
  statLabel: { fontSize: 12, color: 'var(--gray-500)', fontWeight: 500 },
  statSub: { color: 'var(--gray-400)', fontSize: 11 },
  progHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  progTitle: { fontSize: 16, fontWeight: 700, color: 'var(--gray-900)' },
  progMeta: { fontSize: 12, color: 'var(--gray-400)' },
  courseGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 },
  courseCard: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 },
  courseCardTop: {},
  productTag: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--red-light)', border: '1px solid #FBB68F', borderRadius: 999, padding: '2px 9px', fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 6 },
  courseTitle: { fontSize: 14, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 2 },
  courseMeta: { fontSize: 12, color: 'var(--gray-500)' },
  progBarWrap: {},
  progBarRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 5 },
  progBarLabel: { fontSize: 11, color: 'var(--gray-500)' },
  progBarPct: { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-900)' },
  barTrack: { height: 5, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' },
  barFill: { height: 5, background: 'var(--red)', borderRadius: 999, transition: 'width 0.4s ease' },
  ctaBtn: { width: '100%', background: 'var(--red)', border: 'none', borderRadius: 8, height: 34, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'var(--font)' },
  ctaBtnDone: { background: 'var(--gray-200)', color: 'var(--gray-600)' },
};
