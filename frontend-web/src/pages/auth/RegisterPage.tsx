import React, { useState } from 'react';
import { authApi } from '../../api/client';

interface Props {
  onNavigate: (page: string, state?: Record<string, string>) => void;
  mode?: 'register' | 'login';
}

export default function RegisterPage({ onNavigate, mode = 'register' }: Props) {
  const [mobileNumber, setMobileNumber] = useState(() => localStorage.getItem('savedMobile') ?? '');
  const [password, setPassword] = useState(() => localStorage.getItem('savedPassword') ?? '');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('savedMobile'));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLogin = mode === 'login';

  function validate() {
    const cleaned = mobileNumber.replace(/\D/g, '');
    if (cleaned.length < 10) return 'Enter a valid 10-digit mobile number';
    if (!password) return 'Password is required';
    if (!isLogin && password.length < 6) return 'Password must be at least 6 characters';
    if (!isLogin && password !== confirmPassword) return 'Passwords do not match';
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Read directly from form to handle browser autofill
    const form = e.target as HTMLFormElement;
    const mobileVal = (form.querySelector('#mobile') as HTMLInputElement)?.value || mobileNumber;
    const passwordVal = (form.querySelector('#password') as HTMLInputElement)?.value || password;
    
    if (mobileVal !== mobileNumber) setMobileNumber(mobileVal);
    if (passwordVal !== password) setPassword(passwordVal);

    const cleanMobile = mobileVal.replace(/\D/g, '');
    if (cleanMobile.length < 10) { setError('Enter a valid 10-digit mobile number'); return; }
    if (!passwordVal) { setError('Password is required'); return; }
    if (!isLogin && passwordVal.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (!isLogin && passwordVal !== confirmPassword) { setError('Passwords do not match'); return; }

    setLoading(true);
    setError('');

    try {
      const res = isLogin
        ? await authApi.login(mobileVal.trim(), passwordVal)
        : await authApi.register(mobileVal.trim(), passwordVal);

      const { accessToken, refreshToken, farmerId } = res.data?.data ?? res.data;
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('farmerId', farmerId);
      localStorage.setItem('userMobile', mobileVal.trim());
      if (rememberMe) {
        localStorage.setItem('savedMobile', mobileVal.trim());
        localStorage.setItem('savedPassword', passwordVal);
      } else {
        localStorage.removeItem('savedMobile');
        localStorage.removeItem('savedPassword');
      }
      onNavigate('dashboard');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: { message?: string } | string; message?: string } } };
      const errBody = e.response?.data?.error;
      const msg = typeof errBody === 'object' ? errBody?.message
        : typeof errBody === 'string' ? errBody
        : e.response?.data?.message ?? (isLogin ? 'Invalid credentials.' : 'Registration failed.');
      setError(msg ?? 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">🌿</div>
          <h2>AgriMedha</h2>
          <p>{isLogin ? 'Login to your account' : 'Create your free account'}</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="mobile">Mobile Number</label>
            <input
              id="mobile"
              type="tel"
              value={mobileNumber}
              onChange={e => { setMobileNumber(e.target.value); setError(''); }}
              placeholder="Enter 10-digit mobile number"
              maxLength={13}
              required
              autoFocus
              autoComplete="tel"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder={isLogin ? 'Enter your password' : 'Min 6 characters'}
                required
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                style={{ paddingRight: '3rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem' }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                placeholder="Re-enter your password"
                required
              />
            </div>
          )}

          {isLogin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '0.5rem', fontSize: '0.85rem' }}>
              <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
              <label htmlFor="rememberMe" style={{ color: '#555', cursor: 'pointer' }}>Remember me</label>
            </div>
          )}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '⏳ Please wait...' : isLogin ? 'Login →' : 'Register →'}
          </button>
        </form>

        <div className="divider">— or —</div>
        <div className="text-center">
          {isLogin ? (
            <>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Don't have an account? </span>
              <button className="link-btn" onClick={() => onNavigate('register')}>Register Free</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Already registered? </span>
              <button className="link-btn" onClick={() => onNavigate('login')}>Login</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
