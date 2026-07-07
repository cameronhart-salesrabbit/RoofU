import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(email, password);
    if (result.success) {
      navigate('/admin');
    } else {
      setError(result.message);
    }
    setLoading(false);
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logo}>
          <span style={styles.logoText}>Roof<span style={styles.logoU}>U</span></span>
          <span style={styles.adminBadge}>Admin</span>
        </div>
        <h2 style={styles.title}>Sign in to Admin</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoFocus
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              required
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In →'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)' },
  card: { background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 12, padding: 40, width: '100%', maxWidth: 400, boxShadow: 'var(--shadow-lg)' },
  logo: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 },
  logoText: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: 'var(--gray-900)' },
  logoU: { color: 'var(--red)' },
  adminBadge: { background: 'var(--red-light)', color: 'var(--red)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, letterSpacing: '0.5px' },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 20 },
  error: { color: '#D92D20', fontSize: 13, marginBottom: 12 },
};
