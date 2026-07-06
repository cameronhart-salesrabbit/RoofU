import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase/client';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase sets the session from the URL hash after redirect
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) { setError(err.message); setLoading(false); return; }
    navigate('/');
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logo}>Roof<span style={styles.logoU}>U</span></div>
        <h2 style={styles.title}>Set a new password</h2>
        {!ready ? (
          <p style={{ fontSize: 14, color: 'var(--gray-400)' }}>Verifying your reset link…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>New Password</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" minLength={6} autoFocus />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input required type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Same password again" minLength={6} />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Saving…' : 'Update Password →'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-50)', padding: 16 },
  card: { background: 'var(--white)', border: '1px solid var(--gray-200)', borderRadius: 14, padding: 40, width: '100%', maxWidth: 420, boxShadow: 'var(--shadow-lg)' },
  logo: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: 'var(--gray-900)', marginBottom: 24 },
  logoU: { color: 'var(--red)' },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 20 },
  error: { color: '#D92D20', fontSize: 13, marginBottom: 12 },
  submitBtn: { width: '100%', justifyContent: 'center', padding: '10px' },
};
