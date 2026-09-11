import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth/AuthContext';
import { PageTopbar } from '@/components/PageTopbar';

export function LoginPage() {
  const { t } = useI18n();
  const { login, error, unavailable } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const ok = await login(email.trim(), password);
    setSubmitting(false);
    if (ok) navigate('/');
  }

  return (
    <>
      <PageTopbar title={t('auth.loginTitle')} onBack={() => navigate('/')} />
      <div className="auth-page">
        <form className="auth-card glass-panel" onSubmit={onSubmit}>
          <h2>{t('auth.loginTitle')}</h2>
          {unavailable && <p className="auth-notice">{t('auth.serviceUnavailable')}</p>}
          {error && <p className="auth-error">{t('auth.loginFailed')}</p>}
          <label className="auth-field">
            <span>{t('auth.email')}</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="auth-field">
            <span>{t('auth.password')}</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? t('common.loading') : t('auth.loginSubmit')}
          </button>
          <p className="auth-alt">
            {t('auth.noAccount')}{' '}
            <Link to="/register">{t('auth.goRegister')}</Link>
          </p>
        </form>
      </div>
    </>
  );
}
