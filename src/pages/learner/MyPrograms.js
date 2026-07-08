import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useProgress } from '../../context/ProgressContext';

export default function MyPrograms() {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [continueInfo, setContinueInfo] = useState(null);
  const { fetchProgress } = useProgress();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const search = searchParams.get('q') || '';

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('programs')
        .select('*, program_courses(course_id, order, courses(id, title, product, is_published, sections(*, lessons(*))))')
        .order('created_at', { ascending: false });

      const progs = data || [];
      setPrograms(progs);
      setLoading(false);

      // Pre-fetch progress for all courses across all programs
      const allCourseIds = progs.flatMap(p => (p.program_courses || []).map(pc => pc.course_id));
      const uniqueCourseIds = [...new Set(allCourseIds)];
      const progressResults = await Promise.all(uniqueCourseIds.map(id => fetchProgress(id)));

      // Find the most recently visited, not-yet-finished lesson to offer as "Continue Learning"
      const courseMeta = {};
      progs.forEach(p => (p.program_courses || []).forEach(pc => {
        const c = pc.courses;
        if (!c || c.is_published === false) return;
        const total = (c.sections || []).reduce((sum, sec) => sum + (sec.lessons || []).length, 0);
        courseMeta[c.id] = { title: c.title, total };
      }));

      let best = null;
      uniqueCourseIds.forEach((courseId, i) => {
        const p = progressResults[i];
        const meta = courseMeta[courseId];
        if (!p || !p.last_lesson_id || !meta) return;
        const doneCount = (p.completed_lesson_ids || []).length;
        if (meta.total > 0 && doneCount >= meta.total) return;
        if (!best || new Date(p.last_updated) > new Date(best.progress.last_updated)) {
          best = { courseId, progress: p, meta };
        }
      });

      if (best) {
        const { data: lessonData } = await supabase.from('lessons').select('title').eq('id', best.progress.last_lesson_id).single();
        setContinueInfo({
          courseId: best.courseId,
          courseTitle: best.meta.title,
          lessonId: best.progress.last_lesson_id,
          lessonTitle: lessonData?.title || 'Lesson',
        });
      }
    }
    load();
  }, [fetchProgress]);

  if (loading) return <LoadingSkeleton />;

  const filtered = programs.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-fade">
      <div style={styles.pageTop}>
        <div>
          <div style={styles.eyebrow}>My Programs</div>
          <h1 style={styles.heading}>Welcome back, {JSON.parse(localStorage.getItem('roofu_user') || '{}').name || 'Learner'}</h1>
        </div>
        {search && <div style={{ fontSize: 13, color: 'var(--gray-500)', alignSelf: 'flex-end' }}>Results for "<strong>{search}</strong>"</div>}
      </div>
      {!search && continueInfo && (
        <div className="card" style={styles.continueCard} onClick={() => navigate(`/lessons/${continueInfo.lessonId}`)}>
          <div style={styles.continueIcon}><i className="fa-solid fa-play" /></div>
          <div style={{ flex: 1 }}>
            <div style={styles.continueEyebrow}>Continue Learning</div>
            <div style={styles.continueTitle}>{continueInfo.lessonTitle}</div>
            <div style={styles.continueSub}>{continueInfo.courseTitle}</div>
          </div>
          <button style={styles.ctaBtn} onClick={() => navigate(`/lessons/${continueInfo.lessonId}`)}>
            <i className="fa-solid fa-arrow-right" />
            Resume
          </button>
        </div>
      )}
      {filtered.length === 0 && search ? (
        <div className="card empty-state"><p>No programs match "{search}".</p></div>
      ) : filtered.length === 0 ? (
        <div className="card" style={{ padding: '48px 32px', textAlign: 'center' }}>
          <i className="fa-solid fa-graduation-cap" style={{ fontSize: 36, color: 'var(--gray-300)', marginBottom: 16, display: 'block' }} />
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-700)', marginBottom: 8 }}>You're not enrolled in any programs yet.</h2>
          <p style={{ fontSize: 14, color: 'var(--gray-400)', maxWidth: 340, margin: '0 auto' }}>Your administrator will enroll you in a learning program. Check back soon.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map(prog => {
            const courses = (prog.program_courses || [])
              .sort((a, b) => a.order - b.order)
              .map(pc => pc.courses)
              .filter(c => c && c.is_published !== false);

            const totalCourses = courses.length;
            const firstProduct = courses[0]?.product;

            return (
              <div
                key={prog.id}
                className="card"
                style={styles.card}
                onClick={() => navigate(`/programs/${prog.id}`)}
              >
                <div style={styles.cardBody}>
                  {firstProduct && (
                    <div style={styles.productTag}>
                      <i className="fa-solid fa-circle" style={{ fontSize: 7 }} />
                      {firstProduct}
                    </div>
                  )}
                  <h2 style={styles.cardTitle}>{prog.title}</h2>
                  <p style={styles.cardMeta}>{totalCourses} course{totalCourses !== 1 ? 's' : ''}</p>
                  {prog.description && <p style={styles.cardDesc}>{prog.description}</p>}

                  {totalCourses > 0 && (
                    <div style={styles.courseList}>
                      {courses.slice(0, 3).map(c => (
                        <div key={c.id} style={styles.courseChip}>
                          <i className="fa-solid fa-circle" style={{ fontSize: 6, color: 'var(--gray-400)' }} />
                          <span style={styles.courseChipLabel}>{c.title}</span>
                        </div>
                      ))}
                      {totalCourses > 3 && (
                        <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>+{totalCourses - 3} more</span>
                      )}
                    </div>
                  )}

                  <div style={styles.cardFooter}>
                    <button style={styles.ctaBtn}>
                      <i className="fa-solid fa-arrow-right" />
                      View Program
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div>
      <div className="page-header"><h1>My Programs</h1></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{ overflow: 'hidden' }}>
            <div style={{ height: 6, background: 'var(--gray-200)' }} />
            <div style={{ padding: 20 }}>
              <div className="skeleton" style={skeletonBar(160, 20, 0)} />
              <div className="skeleton" style={skeletonBar(240, 14, 12)} />
              <div className="skeleton" style={skeletonBar(200, 14, 6)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function skeletonBar(width, height, mt) {
  return { width, height, marginTop: mt };
}

const styles = {
  pageTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 28, flexWrap: 'wrap' },
  eyebrow: { fontSize: 11, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase', color: 'var(--gray-500)', marginBottom: 4 },
  heading: { fontSize: 22, fontWeight: 700, color: 'var(--gray-900)', letterSpacing: '0.2px' },
  search: { padding: '8px 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: 13, outline: 'none', width: 220, alignSelf: 'flex-end' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  card: { cursor: 'pointer', overflow: 'hidden', transition: 'box-shadow 0.15s', display: 'flex', flexDirection: 'column' },
  cardBody: { padding: '18px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column' },
  productTag: { display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--red-light)', border: '1px solid #FBB68F', borderRadius: 999, padding: '3px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 10 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: 'var(--gray-900)', lineHeight: 1.3, marginBottom: 2 },
  cardMeta: { fontSize: 12, color: 'var(--gray-500)', marginBottom: 10 },
  cardDesc: { fontSize: 13, color: 'var(--gray-500)', marginBottom: 12, lineHeight: 1.5 },
  courseList: { display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14, paddingTop: 10, borderTop: '1px solid var(--gray-200)' },
  courseChip: { display: 'flex', alignItems: 'center', gap: 7 },
  courseChipLabel: { fontSize: 12, color: 'var(--gray-600)' },
  cardFooter: { marginTop: 'auto', paddingTop: 12 },
  ctaBtn: { display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--red)', color: 'var(--white)', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  continueCard: { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', marginBottom: 24, cursor: 'pointer', border: '1px solid var(--gray-200)' },
  continueIcon: { width: 40, height: 40, borderRadius: '50%', background: 'var(--red-light)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 },
  continueEyebrow: { fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 2 },
  continueTitle: { fontSize: 15, fontWeight: 700, color: 'var(--gray-900)' },
  continueSub: { fontSize: 12, color: 'var(--gray-500)', marginTop: 1 },
};
