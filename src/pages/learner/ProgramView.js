import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../supabase/client';

export default function ProgramView() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data: prog } = await supabase.from('programs').select('*').eq('id', programId).single();
      const { data: pc } = await supabase
        .from('program_courses')
        .select('order, courses(*)')
        .eq('program_id', programId)
        .order('order');
      setProgram(prog);
      setCourses((pc || []).map(r => r.courses).filter(c => c && c.is_published !== false));
      setLoading(false);
    }
    fetch();
  }, [programId]);

  if (loading) return <p style={{ color: 'var(--gray-400)' }}>Loading…</p>;
  if (!program) return <p>Program not found.</p>;

  return (
    <div>
      <div style={styles.breadcrumbs}>
        <Link to="/" style={styles.crumb}>My Programs</Link>
        <span style={styles.sep}>›</span>
        <span style={styles.crumbCurrent}>{program.title}</span>
      </div>
      <div className="page-header" style={{ marginTop: 4 }}>
        <h1>{program.title}</h1>
      </div>
      {program.description && <p style={styles.desc}>{program.description}</p>}

      <h2 style={styles.sectionTitle}>Courses in this Program</h2>
      {courses.length === 0 ? (
        <div className="card empty-state"><p>No courses in this program yet.</p></div>
      ) : (
        <div style={styles.list}>
          {courses.map((course, i) => (
            <div
              key={course.id}
              className="card"
              style={styles.courseRow}
              onClick={() => navigate(`/courses/${course.id}`)}
            >
              <div style={styles.courseNum}>{i + 1}</div>
              <div style={styles.courseInfo}>
                <h3 style={styles.courseTitle}>{course.title}</h3>
                {course.description && <p style={styles.courseDesc}>{course.description}</p>}
              </div>
              <span className="badge badge-red">{course.product}</span>
              <span style={styles.arrow}>→</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  breadcrumbs: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16, fontSize: 13 },
  crumb: { color: 'var(--gray-500)', fontWeight: 500, textDecoration: 'none' },
  sep: { color: 'var(--gray-300)' },
  crumbCurrent: { color: 'var(--gray-700)', fontWeight: 500 },
  desc: { fontSize: 15, color: 'var(--gray-600)', marginBottom: 24, lineHeight: 1.6 },
  sectionTitle: { fontSize: 16, fontWeight: 700, marginBottom: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  courseRow: { display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s' },
  courseNum: { width: 32, height: 32, borderRadius: '50%', background: 'var(--red-light)', color: 'var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0 },
  courseInfo: { flex: 1 },
  courseTitle: { fontSize: 15, fontWeight: 600 },
  courseDesc: { fontSize: 13, color: 'var(--gray-500)', marginTop: 2 },
  arrow: { fontSize: 18, color: 'var(--gray-400)' },
};
