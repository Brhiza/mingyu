import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth/AuthContext';
import { PageTopbar } from '@/components/PageTopbar';

export function RegisterPage() {
  const { t } = useI18n();
  const { register, error, unavailable } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const ok = await register(email.trim(), password, nickname.trim());
    setSubmitting(false);
    if (ok) navigate('/');
  }

  return (
    <>
      <PageTopbar title={t('auth.registerTitle')} onBack={() => navigate('/')} />
      <div className="auth-page">
        <form className="auth-card glass-panel" onSubmit={onSubmit}>
          <h2>{t('auth.registerTitle')}</h2>
          {unavailable && <p className="auth-notice">{t('auth.serviceUnavailable')}</p>}
          {error && <p className="auth-error">{t('auth.registerFailed')}</p>}
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
            <span>{t('auth.nickname')}</span>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              autoComplete="nickname"
            />
          </label>
          <label className="auth-field">
            <span>{t('auth.password')}</span>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" className="auth-submit" disabled={submitting}>
            {submitting ? t('common.loading') : t('auth.registerSubmit')}
          </button>
          <p className="auth-alt">
            {t('auth.hasAccount')}{' '}
            <Link to="/login">{t('auth.goLogin')}</Link>
          </p>
        </form>
      </div>
    </>
  );
}
