import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useAuth } from '@/lib/auth/AuthContext';
import { LanguageSwitcher } from './LanguageSwitcher';

export function GlobalControlCluster() {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="global-controls">
      <LanguageSwitcher />
      {user ? (
        <div className="auth-cluster">
          <button type="button" className="auth-trigger" onClick={() => setMenuOpen((v) => !v)}>
            {user.nickname}
          </button>
          {menuOpen && (
            <div className="auth-menu glass-panel">
              <p className="auth-menu-name">
                {t('auth.welcome')}
                {user.nickname}
              </p>
              <Link to="/lexicon" className="auth-menu-item" onClick={() => setMenuOpen(false)}>
                {t('nav.lexicon')}
              </Link>
              <button
                type="button"
                className="auth-menu-item"
                onClick={async () => {
                  await logout();
                  setMenuOpen(false);
                  navigate('/');
                }}
              >
                {t('nav.logout')}
              </button>
            </div>
          )}
        </div>
      ) : (
        <Link to="/login" className="auth-login-link">
          {t('nav.login')}
        </Link>
      )}
    </div>
  );
}
