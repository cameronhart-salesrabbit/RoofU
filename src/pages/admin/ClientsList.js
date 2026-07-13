import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function ClientsList() {
  const { isSuperAdmin } = useAdminAuth();
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;
    async function load() {
      const [{ data: cl }, { data: courses }, { data: users }] = await Promise.all([
        supabase.from('clients').select('*').order('name'),
        supabase.from('courses').select('client_id'),
        supabase.from('users').select('client_id'),
      ]);
      const courseCounts = {};
      (courses || []).forEach(c => { courseCounts[c.client_id] = (courseCounts[c.client_id] || 0) + 1; });
      const userCounts = {};
      (users || []).forEach(u => { userCounts[u.client_id] = (userCounts[u.client_id] || 0) + 1; });
      setClients((cl || []).map(c => ({ ...c, courseCount: courseCounts[c.id] || 0, userCount: userCounts[c.id] || 0 })));
      setLoading(false);
    }
    load();
  }, [isSuperAdmin]);

  // Not built as a self-serve provisioning UI - new clients are still created
  // manually (see migrations/002_template_client_clone.sql). This is
  // read-only visibility across all clients for the super-admin.
  if (!isSuperAdmin) return <Navigate to="/admin/analytics/dashboard" replace />;
  if (loading) return <p style={{ color: 'var(--gray-400)' }}>Loading…</p>;

  return (
    <div>
      <div className="page-header">
        <h1>Clients</h1>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Name', 'Slug', 'Courses', 'Users', ''].map(h => <th key={h} style={styles.th}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id} style={styles.tr}>
                <td style={styles.td}>{c.name}</td>
                <td style={{ ...styles.td, fontFamily: 'var(--font-mono)', color: 'var(--gray-500)' }}>{c.slug}</td>
                <td style={styles.td}>{c.courseCount}</td>
                <td style={styles.td}>{c.userCount}</td>
                <td style={styles.td}>{c.is_template && <span className="badge badge-gray">Template</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '10px 16px', fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', textAlign: 'left', borderBottom: '1px solid var(--gray-200)', background: 'var(--gray-50)' },
  tr: { borderBottom: '1px solid var(--gray-100)' },
  td: { padding: '12px 16px', fontSize: 14 },
};
