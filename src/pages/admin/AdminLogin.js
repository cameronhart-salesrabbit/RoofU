import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (login(password)) {
      navigate('/admin');
    } else {
      setError('Incorrect password. Please try again.');
    }
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
            <label>Admin Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              autoFocus
            />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px' }}>
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--gray-50)',
  },
  card: {
    background: 'var(--white)',
    border: '1px solid var(--gray-200)',
    borderRadius: '12px',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: 'var(--shadow-lg)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '24px',
  },
  logoText: {
    fontSize: '28px',
    fontWeight: '800',
    color: 'var(--gray-900)',
    letterSpacing: '-0.5px',
  },
  logoU: {
    color: 'var(--red)',
  },
  adminBadge: {
    background: 'var(--red-light)',
    color: 'var(--red)',
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 8px',
    borderRadius: '999px',
    letterSpacing: '0.5px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--gray-900)',
    marginBottom: '20px',
  },
  error: {
    color: 'var(--red)',
    fontSize: '13px',
    marginBottom: '12px',
  },
};
