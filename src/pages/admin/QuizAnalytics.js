import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase/client';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function QuizAnalytics() {
  const { effectiveClientId } = useAdminAuth();
  const [quizzes, setQuizzes] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [sections, setSections] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveClientId) return;
    async function load() {
      const [{ data: qz }, { data: qr }, { data: l }, { data: s }, { data: c }] = await Promise.all([
        supabase.from('quizzes').select('*').eq('client_id', effectiveClientId).order('title'),
        supabase.from('quiz_results').select('*, users(name, email)').eq('client_id', effectiveClientId).order('completed_at', { ascending: false }),
        supabase.from('lessons').select('id, title').eq('client_id', effectiveClientId),
        supabase.from('sections').select('id, title').eq('client_id', effectiveClientId),
        supabase.from('courses').select('id, title').eq('client_id', effectiveClientId),
      ]);
      setQuizzes(qz || []);
      setQuizResults(qr || []);
      setLessons(l || []);
      setSections(s || []);
      setCourses(c || []);
      setLoading(false);
    }
    load();
  }, [effectiveClientId]);

  function getAttachedTitle(quiz) {
    const list = quiz.attached_to_type === 'lesson' ? lessons : quiz.attached_to_type === 'section' ? sections : courses;
    return list.find(x => x.id === quiz.attached_to_id)?.title || 'Unknown';
  }

  function getQuizStats(quizId) {
    const results = quizResults.filter(r => r.quiz_id === quizId);
    const attempts = results.length;
    const passedCount = results.filter(r => r.passed).length;
    const uniqueLearners = new Set(results.map(r => r.user_id)).size;
    const avg = attempts ? Math.round(results.reduce((sum, r) => sum + r.score, 0) / attempts) : 0;
    const passRate = attempts ? Math.round((passedCount / attempts) * 100) : 0;
    return { attempts, passedCount, uniqueLearners, avg, passRate };
  }

  if (loading) return <p style={{ color: 'var(--gray-400)' }}>Loading…</p>;

  const sortedQuizzes = [...quizzes].sort((a, b) => getQuizStats(b.id).attempts - getQuizStats(a.id).attempts);
  const totalAttempts = quizResults.length;
  const totalPassed = quizResults.filter(r => r.passed).length;
  const overallPassRate = totalAttempts ? Math.round((totalPassed / totalAttempts) * 100) : 0;
  const overallAvg = totalAttempts ? Math.round(quizResults.reduce((sum, r) => sum + r.score, 0) / totalAttempts) : 0;

  return (
    <div className="page-fade">
      <div style={styles.summaryRow}>
        {[
          { label: 'Quizzes', value: quizzes.length },
          { label: 'Total Attempts', value: totalAttempts },
          { label: 'Overall Pass Rate', value: totalAttempts ? `${overallPassRate}%` : '—' },
          { label: 'Overall Avg. Score', value: totalAttempts ? `${overallAvg}%` : '—' },
        ].map(s => (
          <div key={s.label} className="card" style={styles.summaryCard}>
            <div style={styles.summaryVal}>{s.value}</div>
            <div style={styles.summaryLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={styles.layout}>
        {/* Quiz list */}
        <div style={styles.quizList}>
          <p style={styles.listLabel}>Quizzes ({quizzes.length})</p>
          {sortedQuizzes.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-400)', padding: 12 }}>No quizzes yet.</p>}
          {sortedQuizzes.map(quiz => {
            const stats = getQuizStats(quiz.id);
            const isSelected = selectedQuiz?.id === quiz.id;
            return (
              <div
                key={quiz.id}
                style={{ ...styles.quizRow, ...(isSelected ? styles.quizRowActive : {}) }}
                onClick={() => setSelectedQuiz(isSelected ? null : quiz)}
              >
                <div style={styles.quizInfo}>
                  <span style={styles.quizName}>{quiz.title}</span>
                  <span style={styles.quizMeta}>{stats.attempts} attempt{stats.attempts !== 1 ? 's' : ''}</span>
                </div>
                {stats.attempts > 0 ? (
                  <span className={`badge ${stats.passRate >= 80 ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11 }}>{stats.passRate}%</span>
                ) : (
                  <span className="badge badge-gray" style={{ fontSize: 11 }}>No data</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div style={styles.detail}>
          {!selectedQuiz ? (
            <div className="card empty-state"><p>Select a quiz to see attempt details.</p></div>
          ) : (() => {
            const stats = getQuizStats(selectedQuiz.id);
            const results = quizResults.filter(r => r.quiz_id === selectedQuiz.id);
            return (
              <>
                <div style={styles.detailHeader}>
                  <div style={styles.detailType}>Attached to {selectedQuiz.attached_to_type}: {getAttachedTitle(selectedQuiz)}</div>
                  <h2 style={styles.detailTitle}>{selectedQuiz.title}</h2>
                  <p style={styles.detailMeta}>
                    Pass threshold: {selectedQuiz.pass_threshold}%
                    {selectedQuiz.max_retakes != null && ` · Max retakes: ${selectedQuiz.max_retakes}`}
                    {selectedQuiz.show_correct_answers && ' · Shows correct answers'}
                  </p>
                </div>

                <div style={styles.statsRow}>
                  {[
                    { label: 'Attempts', value: stats.attempts, color: 'var(--gray-900)', bg: 'var(--gray-100)' },
                    { label: 'Unique Learners', value: stats.uniqueLearners, color: 'var(--gray-900)', bg: 'var(--gray-100)' },
                    { label: 'Pass Rate', value: stats.attempts ? `${stats.passRate}%` : '—', color: '#059669', bg: '#F4F6F1' },
                    { label: 'Avg. Score', value: stats.attempts ? `${stats.avg}%` : '—', color: 'var(--red)', bg: 'var(--red-light)' },
                  ].map(s => (
                    <div key={s.label} style={{ ...styles.statCard, background: s.bg }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {results.length === 0 ? (
                  <div className="card empty-state" style={{ marginTop: 16 }}><p>No attempts yet.</p></div>
                ) : (
                  <div className="card" style={{ overflow: 'hidden', marginTop: 16 }}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          {['Learner', 'Score', 'Result', 'Date'].map(h => <th key={h} style={styles.th}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {results.map(r => (
                          <tr key={r.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={styles.avatar}>{(r.users?.name || '?')[0].toUpperCase()}</div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.users?.name || 'Unknown'}</div>
                                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{r.users?.email || ''}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ ...styles.td, fontFamily: 'var(--font-mono)' }}>{r.score}%</td>
                            <td style={styles.td}>
                              <span className={`badge ${r.passed ? 'badge-green' : 'badge-red'}`}>{r.passed ? 'Passed' : 'Failed'}</span>
                            </td>
                            <td style={{ ...styles.td, fontSize: 11, color: 'var(--gray-400)' }}>
                              {r.completed_at ? new Date(r.completed_at).toLocaleString() : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

const styles = {
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 },
  summaryCard: { padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 4 },
  summaryVal: { fontSize: 28, fontWeight: 700, color: 'var(--red)', lineHeight: 1, fontFamily: 'var(--font-mono)' },
  summaryLabel: { fontSize: 12, color: 'var(--gray-500)', fontWeight: 500 },
  layout: { display: 'flex', gap: 20, alignItems: 'flex-start' },
  quizList: { width: 280, minWidth: 280, background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', overflow: 'hidden' },
  listLabel: { fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', padding: '10px 14px 6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  quizRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', cursor: 'pointer', borderTop: '1px solid var(--gray-100)', transition: 'background 0.1s' },
  quizRowActive: { background: 'var(--red-light)' },
  quizInfo: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  quizName: { fontSize: 13, fontWeight: 600, color: 'var(--gray-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  quizMeta: { fontSize: 11, color: 'var(--gray-400)' },
  detail: { flex: 1 },
  detailHeader: { marginBottom: 16 },
  detailType: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--red)', marginBottom: 4 },
  detailTitle: { fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 2 },
  detailMeta: { fontSize: 13, color: 'var(--gray-400)' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 },
  statCard: { borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textAlign: 'left', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' },
  tr: { borderBottom: '1px solid var(--gray-100)' },
  td: { padding: '12px 16px', fontSize: 14 },
  avatar: { width: 30, height: 30, borderRadius: '50%', background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
};
