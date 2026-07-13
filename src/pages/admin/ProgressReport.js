import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase/client';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function ProgressReport() {
  const { effectiveClientId } = useAdminAuth();
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [progress, setProgress] = useState([]);
  const [quizResults, setQuizResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!effectiveClientId) return;
    async function load() {
      const [{ data: u }, { data: c }, { data: p }, { data: qr }] = await Promise.all([
        supabase.from('users').select('*').eq('client_id', effectiveClientId).order('name'),
        supabase.from('courses').select('*, sections(*, lessons(*))').eq('client_id', effectiveClientId),
        supabase.from('progress').select('*').eq('client_id', effectiveClientId),
        supabase.from('quiz_results').select('*, quizzes(title, pass_threshold)').eq('client_id', effectiveClientId).order('completed_at', { ascending: false }),
      ]);
      setUsers(u || []);
      setCourses(c || []);
      setProgress(p || []);
      setQuizResults(qr || []);
      setLoading(false);
    }
    load();
  }, [effectiveClientId]);

  function getTotalLessons(course) {
    return (course.sections || []).reduce((sum, s) => sum + (s.lessons || []).length, 0);
  }

  function getCompletedLessons(userId, courseId) {
    const p = progress.find(p => p.user_id === userId && p.course_id === courseId);
    return (p?.completed_lesson_ids || []).length;
  }

  function getUserQuizStats(userId) {
    const results = quizResults.filter(r => r.user_id === userId);
    if (!results.length) return null;
    const passed = results.filter(r => r.passed).length;
    const avg = Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length);
    return { taken: results.length, passed, avg };
  }

  if (loading) return <p style={{ color: 'var(--gray-400)' }}>Loading…</p>;

  return (
    <div className="page-fade">
      <div style={styles.layout}>
        {/* User list */}
        <div style={styles.userList}>
          <p style={styles.listLabel}>Learners ({users.filter(u => u.role === 'learner').length})</p>
          {users.filter(u => u.role === 'learner').map(user => {
            const qs = getUserQuizStats(user.id);
            const totalCompleted = progress.filter(p => p.user_id === user.id).reduce((sum, p) => sum + (p.completed_lesson_ids || []).length, 0);
            return (
              <div
                key={user.id}
                style={{ ...styles.userRow, ...(selectedUser?.id === user.id ? styles.userRowActive : {}) }}
                onClick={() => setSelectedUser(user)}
              >
                <div style={styles.userAvatar}>{user.name[0].toUpperCase()}</div>
                <div style={styles.userInfo}>
                  <span style={styles.userName}>{user.name}</span>
                  <span style={styles.userMeta}>{totalCompleted} lessons completed</span>
                </div>
                {qs && <span className="badge badge-green" style={{ fontSize: 11 }}>{qs.avg}% avg</span>}
              </div>
            );
          })}
          {users.filter(u => u.role === 'learner').length === 0 && (
            <p style={{ fontSize: 13, color: 'var(--gray-400)', padding: 12 }}>No learners yet.</p>
          )}
        </div>

        {/* Detail panel */}
        <div style={styles.detail}>
          {!selectedUser ? (
            <div className="card empty-state"><p>Select a learner to view their progress.</p></div>
          ) : (
            <>
              <div style={styles.detailHeader}>
                <div style={styles.detailAvatar}>{selectedUser.name[0].toUpperCase()}</div>
                <div>
                  <h2 style={styles.detailName}>{selectedUser.name}</h2>
                  <p style={styles.detailEmail}>{selectedUser.email}</p>
                </div>
              </div>

              {(() => {
                const qs = getUserQuizStats(selectedUser.id);
                return qs ? (
                  <div style={styles.quizSummary}>
                    <div style={styles.qStat}><span style={styles.qVal}>{qs.taken}</span><span style={styles.qLabel}>Quizzes taken</span></div>
                    <div style={styles.qStat}><span style={styles.qVal}>{qs.passed}</span><span style={styles.qLabel}>Passed</span></div>
                    <div style={styles.qStat}><span style={styles.qVal}>{qs.avg}%</span><span style={styles.qLabel}>Avg. score</span></div>
                  </div>
                ) : null;
              })()}

              {/* Per-quiz results */}
              {(() => {
                const userResults = quizResults.filter(r => r.user_id === selectedUser.id);
                if (userResults.length === 0) return null;
                return (
                  <>
                    <h3 style={styles.sectionTitle}>Quiz Results</h3>
                    <div className="card" style={{ marginBottom: 20, overflow: 'hidden' }}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            {['Quiz', 'Score', 'Result', 'Date'].map(h => <th key={h} style={styles.th}>{h}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {userResults.map((r, i) => (
                            <tr key={i} style={styles.tr}>
                              <td style={styles.td}>{r.quizzes?.title || '—'}</td>
                              <td style={{ ...styles.td, fontFamily: 'var(--font-mono)' }}>{r.score}%</td>
                              <td style={styles.td}>
                                <span className={`badge ${r.passed ? 'badge-green' : 'badge-red'}`}>{r.passed ? 'Passed' : 'Failed'}</span>
                              </td>
                              <td style={{ ...styles.td, fontSize: 11, color: 'var(--gray-400)' }}>
                                {r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}

              <h3 style={styles.sectionTitle}>Course Progress</h3>
              {courses.length === 0 ? <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>No courses yet.</p> : (
                courses.map(course => {
                  const total = getTotalLessons(course);
                  const completed = getCompletedLessons(selectedUser.id, course.id);
                  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
                  return (
                    <div key={course.id} className="card" style={styles.courseRow}>
                      <div style={styles.courseInfo}>
                        <span style={styles.courseTitle}>{course.title}</span>
                        <span className="badge badge-gray" style={{ fontSize: 11 }}>{course.product}</span>
                      </div>
                      <div style={styles.progressArea}>
                        <div style={styles.progressLabel}>
                          <span style={{ fontSize: 12, color: 'var(--gray-600)', fontWeight: 600 }}>{pct}%</span>
                          <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>{completed}/{total} lessons</span>
                        </div>
                        <div style={{ background: 'var(--gray-200)', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? '#059669' : 'var(--red)', borderRadius: 999, transition: 'width 0.4s' }} />
                        </div>
                      </div>
                      {pct === 100 && <span className="badge badge-green">✓ Done</span>}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  layout: { display: 'flex', gap: 20, alignItems: 'flex-start' },
  userList: { width: 260, minWidth: 260, background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', overflow: 'hidden' },
  listLabel: { fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', padding: '10px 14px 6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  userRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderTop: '1px solid var(--gray-100)', transition: 'background 0.1s' },
  userRowActive: { background: 'var(--red-light)' },
  userAvatar: { width: 32, height: 32, borderRadius: '50%', background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 },
  userInfo: { flex: 1, display: 'flex', flexDirection: 'column' },
  userName: { fontSize: 13, fontWeight: 600 },
  userMeta: { fontSize: 11, color: 'var(--gray-400)' },
  detail: { flex: 1 },
  detailHeader: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 },
  detailAvatar: { width: 48, height: 48, borderRadius: '50%', background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700 },
  detailName: { fontSize: 18, fontWeight: 700, marginBottom: 2 },
  detailEmail: { fontSize: 13, color: 'var(--gray-400)' },
  quizSummary: { display: 'flex', gap: 0, background: 'var(--gray-50)', borderRadius: 10, padding: '16px', marginBottom: 20 },
  qStat: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  qVal: { fontSize: 24, fontWeight: 800, color: 'var(--gray-900)' },
  qLabel: { fontSize: 11, color: 'var(--gray-400)', fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textAlign: 'left', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' },
  tr: { borderBottom: '1px solid var(--gray-100)' },
  td: { padding: '10px 16px', fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--gray-600)', marginBottom: 10 },
  courseRow: { padding: '14px 16px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 16 },
  courseInfo: { display: 'flex', flexDirection: 'column', gap: 4, width: 200 },
  courseTitle: { fontSize: 13, fontWeight: 600 },
  progressArea: { flex: 1, display: 'flex', flexDirection: 'column', gap: 4 },
  progressLabel: { display: 'flex', justifyContent: 'space-between' },
};
