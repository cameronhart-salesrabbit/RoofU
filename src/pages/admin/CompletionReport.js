import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase/client';

export default function CompletionReport() {
  const [courses, setCourses] = useState([]);
  const [users, setUsers] = useState([]);
  const [progress, setProgress] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: c }, { data: u }, { data: p }] = await Promise.all([
        supabase.from('courses').select('*, sections(*, lessons(*))').order('title'),
        supabase.from('users').select('*').eq('role', 'learner').order('name'),
        supabase.from('progress').select('*'),
      ]);
      setCourses(c || []);
      setUsers(u || []);
      setProgress(p || []);
      setLoading(false);
    }
    load();
  }, []);

  function getTotalLessons(course) {
    return (course.sections || []).reduce((sum, s) => sum + (s.lessons || []).length, 0);
  }

  function getCompletedCount(userId, courseId) {
    const p = progress.find(x => x.user_id === userId && x.course_id === courseId);
    return (p?.completed_lesson_ids || []).length;
  }

  function getCourseStats(course) {
    const total = getTotalLessons(course);
    if (total === 0 || users.length === 0) return { rate: 0, completed: 0, inProgress: 0, notStarted: 0 };
    let completed = 0, inProgress = 0, notStarted = 0;
    users.forEach(u => {
      const done = getCompletedCount(u.id, course.id);
      if (done >= total) completed++;
      else if (done > 0) inProgress++;
      else notStarted++;
    });
    return { rate: Math.round((completed / users.length) * 100), completed, inProgress, notStarted };
  }

  if (loading) return <p style={{ color: 'var(--gray-400)' }}>Loading…</p>;

  return (
    <div className="page-fade">
      <div className="page-header">
        <h1>Completion Overview</h1>
      </div>

      <div style={styles.layout}>
        {/* Course list */}
        <div style={styles.courseList}>
          <p style={styles.listLabel}>Courses ({courses.length})</p>
          {courses.length === 0 && <p style={{ fontSize: 13, color: 'var(--gray-400)', padding: 12 }}>No courses yet.</p>}
          {courses.map(course => {
            const stats = getCourseStats(course);
            const isSelected = selectedCourse?.id === course.id;
            return (
              <div
                key={course.id}
                style={{ ...styles.courseRow, ...(isSelected ? styles.courseRowActive : {}) }}
                onClick={() => setSelectedCourse(isSelected ? null : course)}
              >
                <div style={styles.courseInfo}>
                  <span style={styles.courseName}>{course.title}</span>
                  <span style={styles.courseProd}>{course.product}</span>
                </div>
                <div style={styles.rateChip}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: stats.rate === 100 ? '#059669' : 'var(--gray-900)' }}>{stats.rate}%</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div style={styles.detail}>
          {!selectedCourse ? (
            <div className="card empty-state"><p>Select a course to see learner completion status.</p></div>
          ) : (() => {
            const total = getTotalLessons(selectedCourse);
            const stats = getCourseStats(selectedCourse);
            return (
              <>
                <div style={styles.detailHeader}>
                  <div>
                    <div style={styles.detailProd}>{selectedCourse.product}</div>
                    <h2 style={styles.detailTitle}>{selectedCourse.title}</h2>
                    <p style={styles.detailMeta}>{total} lesson{total !== 1 ? 's' : ''}</p>
                  </div>
                </div>

                <div style={styles.statsRow}>
                  {[
                    { label: 'Completed', value: stats.completed, color: '#059669', bg: '#F4F6F1' },
                    { label: 'In Progress', value: stats.inProgress, color: 'var(--red)', bg: 'var(--red-light)' },
                    { label: 'Not Started', value: stats.notStarted, color: 'var(--gray-500)', bg: 'var(--gray-100)' },
                  ].map(s => (
                    <div key={s.label} style={{ ...styles.statCard, background: s.bg }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.6px' }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                <div style={styles.completionBar}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Overall completion rate</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700 }}>{stats.rate}%</span>
                  </div>
                  <div style={{ height: 8, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: 8, width: `${stats.rate}%`, background: stats.rate === 100 ? '#059669' : 'var(--red)', borderRadius: 999, transition: 'width 0.4s' }} />
                  </div>
                </div>

                <div className="card" style={{ overflow: 'hidden', marginTop: 16 }}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Learner', 'Progress', 'Status'].map(h => <th key={h} style={styles.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => {
                        const done = getCompletedCount(u.id, selectedCourse.id);
                        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                        const status = done >= total && total > 0 ? 'completed' : done > 0 ? 'in-progress' : 'not-started';
                        return (
                          <tr key={u.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={styles.avatar}>{u.name[0].toUpperCase()}</div>
                                <div>
                                  <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name}</div>
                                  <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>{u.email}</div>
                                </div>
                              </div>
                            </td>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 140 }}>
                                <div style={{ flex: 1, height: 6, background: 'var(--gray-200)', borderRadius: 999, overflow: 'hidden' }}>
                                  <div style={{ height: 6, width: `${pct}%`, background: status === 'completed' ? '#059669' : 'var(--red)', borderRadius: 999 }} />
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--gray-600)', minWidth: 36 }}>{done}/{total}</span>
                              </div>
                            </td>
                            <td style={styles.td}>
                              <span className={`badge ${status === 'completed' ? 'badge-green' : status === 'in-progress' ? 'badge-red' : 'badge-gray'}`}>
                                {status === 'completed' ? 'Completed' : status === 'in-progress' ? 'In Progress' : 'Not Started'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

const styles = {
  layout: { display: 'flex', gap: 20, alignItems: 'flex-start' },
  courseList: { width: 280, minWidth: 280, background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', overflow: 'hidden' },
  listLabel: { fontSize: 11, fontWeight: 700, color: 'var(--gray-400)', padding: '10px 14px 6px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  courseRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', cursor: 'pointer', borderTop: '1px solid var(--gray-100)', transition: 'background 0.1s' },
  courseRowActive: { background: 'var(--red-light)' },
  courseInfo: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minWidth: 0 },
  courseName: { fontSize: 13, fontWeight: 600, color: 'var(--gray-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  courseProd: { fontSize: 11, color: 'var(--gray-400)' },
  rateChip: { flexShrink: 0 },
  detail: { flex: 1 },
  detailHeader: { marginBottom: 16 },
  detailProd: { fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--red)', marginBottom: 4 },
  detailTitle: { fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 2 },
  detailMeta: { fontSize: 13, color: 'var(--gray-400)' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 },
  statCard: { borderRadius: 10, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  completionBar: { background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 10, padding: '14px 18px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textAlign: 'left', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' },
  tr: { borderBottom: '1px solid var(--gray-100)' },
  td: { padding: '12px 16px', fontSize: 14 },
  avatar: { width: 30, height: 30, borderRadius: '50%', background: 'var(--red)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 },
};
