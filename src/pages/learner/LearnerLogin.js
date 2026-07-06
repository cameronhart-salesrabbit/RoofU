import React, { useState } from 'react';
import { supabase } from '../../supabase/client';

export default function LearnerLogin({ onLogin }) {
  const [tab, setTab] = useState('signin'); // 'signin' | 'signup' | 'reset'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  function set(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.value }));
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    });
    if (err) {
      setError(err.message === 'Invalid login credentials' ? 'Incorrect email or password.' : err.message);
      setLoading(false);
      return;
    }
    // LearnerLayout handles the session change — nothing to do here
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { name: form.name } },
    });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setMessage('Check your email for a confirmation link, then come back to sign in.');
    setLoading(false);
  }

  async function handleReset(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error: err } = await supabase.auth.resetPasswordForEmail(form.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (err) { setError(err.message); setLoading(false); return; }
    setMessage('Password reset email sent. Check your inbox.');
    setLoading(false);
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.logo}>Roof<span style={styles.logoU}>U</span></div>

        {tab !== 'reset' && (
          <div style={styles.tabs}>
            <button style={{ ...styles.tab, ...(tab === 'signin' ? styles.tabActive : {}) }} onClick={() => { setTab('signin'); setError(''); setMessage(''); }}>Sign In</button>
            <button style={{ ...styles.tab, ...(tab === 'signup' ? styles.tabActive : {}) }} onClick={() => { setTab('signup'); setError(''); setMessage(''); }}>Create Account</button>
          </div>
        )}

        {message ? (
          <div style={styles.successBox}>
            <i className="fa-solid fa-circle-check" style={{ color: '#059669', marginRight: 8 }} />
            {message}
          </div>
        ) : tab === 'signin' ? (
          <form onSubmit={handleSignIn}>
            <div className="form-group">
              <label>Email</label>
              <input required type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" autoFocus />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input required type="password" value={form.password} onChange={set('password')} placeholder="••••••••" />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
            <button type="button" style={styles.forgotLink} onClick={() => { setTab('reset'); setError(''); setMessage(''); }}>
              Forgot your password?
            </button>
          </form>
        ) : tab === 'signup' ? (
          <form onSubmit={handleSignUp}>
            <p style={styles.hint}>Your admin needs to enroll you in programs after you create your account.</p>
            <div className="form-group">
              <label>Full Name</label>
              <input required value={form.name} onChange={set('name')} placeholder="Jane Smith" autoFocus />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input required type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input required type="password" value={form.password} onChange={set('password')} placeholder="At least 6 characters" minLength={6} />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset}>
            <p style={styles.hint}>Enter your email and we'll send a reset link.</p>
            <div className="form-group">
              <label>Email</label>
              <input required type="email" value={form.email} onChange={set('email')} placeholder="jane@company.com" autoFocus />
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" className="btn btn-primary" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link →'}
            </button>
            <button type="button" style={styles.forgotLink} onClick={() => { setTab('signin'); setError(''); setMessage(''); }}>
              ← Back to sign in
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
  logo: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: 'var(--gray-900)', marginBottom: 24, letterSpacing: 0 },
  logoU: { color: 'var(--red)' },
  tabs: { display: 'flex', borderBottom: '1px solid var(--gray-200)', marginBottom: 24, gap: 0 },
  tab: { flex: 1, padding: '8px 0', background: 'none', border: 'none', borderBottom: '2px solid transparent', fontSize: 14, fontWeight: 600, color: 'var(--gray-400)', cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s' },
  tabActive: { color: 'var(--red)', borderBottomColor: 'var(--red)' },
  hint: { fontSize: 13, color: 'var(--gray-500)', lineHeight: 1.5, marginBottom: 18 },
  error: { color: '#D92D20', fontSize: 13, marginBottom: 12 },
  submitBtn: { width: '100%', justifyContent: 'center', padding: '10px', marginBottom: 12 },
  forgotLink: { background: 'none', border: 'none', color: 'var(--gray-400)', fontSize: 13, cursor: 'pointer', padding: 0, display: 'block', width: '100%', textAlign: 'center' },
  successBox: { background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 8, padding: '14px 16px', fontSize: 14, color: '#166534', lineHeight: 1.5 },
};
