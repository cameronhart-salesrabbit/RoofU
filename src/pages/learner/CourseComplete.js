import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useProgress } from '../../context/ProgressContext';

export default function CourseComplete() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { learnerId } = useProgress();
  const [course, setCourse] = useState(null);
  const [nextCourse, setNextCourse] = useState(null);
  const [quizStats, setQuizStats] = useState({ taken: 0, passed: 0, avgScore: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: c } = await supabase.from('courses').select('*').eq('id', courseId).single();
      setCourse(c);
      setNextCourse(null);

      if (learnerId) {
        const { data: results } = await supabase
          .from('quiz_results')
          .select('score, passed, quiz_id')
          .eq('user_id', learnerId);

        if (results && results.length > 0) {
          const passed = results.filter(r => r.passed).length;
          const avg = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
          setQuizStats({ taken: results.length, passed, avgScore: avg });
        }

        // Find the next course after this one in any program the learner is
        // enrolled in, using that program's course order (see ProgramManager's
        // drag-and-drop course reordering).
        const { data: enrollments } = await supabase.from('user_program_enrollments').select('program_id').eq('user_id', learnerId);
        const programIds = (enrollments || []).map(e => e.program_id);
        if (programIds.length > 0) {
          const { data: pc } = await supabase.from('program_courses').select('program_id, course_id, order').in('program_id', programIds).order('order');
          const byProgram = {};
          (pc || []).forEach(row => { (byProgram[row.program_id] ||= []).push(row); });
          for (const rows of Object.values(byProgram)) {
            const idx = rows.findIndex(r => r.course_id === courseId);
            if (idx >= 0 && idx < rows.length - 1) {
              const { data: nc } = await supabase.from('courses').select('id, title').eq('id', rows[idx + 1].course_id).single();
              if (nc) { setNextCourse(nc); break; }
            }
          }
        }
      }

      setLoading(false);
    }
    load();
  }, [courseId, learnerId]);

  if (loading) return null;

  return (
    <div style={styles.wrapper} className="page-fade">
      <div style={styles.card}>
        <div style={styles.trophy}>🏆</div>
        <h1 style={styles.title}>Course Complete!</h1>
        <p style={styles.courseName}>{course?.title}</p>
        <p style={styles.message}>You've completed all lessons in this course. Great work!</p>

        {quizStats.taken > 0 && (
          <div style={styles.stats}>
            <div style={styles.stat}>
              <span style={styles.statValue}>{quizStats.taken}</span>
              <span style={styles.statLabel}>Quizzes Taken</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.stat}>
              <span style={styles.statValue}>{quizStats.passed}</span>
              <span style={styles.statLabel}>Quizzes Passed</span>
            </div>
            <div style={styles.statDivider} />
            <div style={styles.stat}>
              <span style={styles.statValue}>{quizStats.avgScore}%</span>
              <span style={styles.statLabel}>Avg. Score</span>
            </div>
          </div>
        )}

        <div style={styles.actions}>
          {nextCourse ? (
            <>
              <button className="btn btn-primary" onClick={() => navigate(`/courses/${nextCourse.id}`)}>
                Continue to {nextCourse.title} <i className="fa-solid fa-arrow-right" />
              </button>
              <button className="btn btn-secondary" onClick={() => navigate('/')}>Back to My Programs</button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => navigate('/')}>Back to My Programs</button>
          )}
          <button className="btn btn-secondary" onClick={() => navigate(`/courses/${courseId}`)}>Review Course</button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 16, padding: '48px 40px', maxWidth: 480, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-lg)' },
  trophy: { fontSize: 64, marginBottom: 16, display: 'block' },
  title: { fontSize: 28, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 8 },
  courseName: { fontSize: 16, fontWeight: 600, color: 'var(--red)', marginBottom: 12 },
  message: { fontSize: 15, color: 'var(--gray-500)', lineHeight: 1.6, marginBottom: 28 },
  stats: { display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)', borderRadius: 12, padding: '20px', marginBottom: 28, gap: 0 },
  stat: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  statValue: { fontSize: 28, fontWeight: 800, color: 'var(--gray-900)' },
  statLabel: { fontSize: 12, color: 'var(--gray-400)', fontWeight: 500 },
  statDivider: { width: 1, height: 40, background: 'var(--gray-200)' },
  actions: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
};
