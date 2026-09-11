import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StarfieldBackground } from './components/StarfieldBackground';
import { GlobalControlCluster } from './components/GlobalControlCluster';
import { TrustBanner } from './components/TrustEngine/TrustBanner';
import { useI18n } from '@/i18n';
import { initAnalyticsFromRuntime, trackPageView } from '@/lib/analytics';

const InputPage = lazy(async () => {
  const module = await import('./pages/InputPage');
  return { default: module.InputPage };
});

const RecordsPage = lazy(async () => {
  const module = await import('./pages/RecordsPage');
  return { default: module.RecordsPage };
});

const ResultPage = lazy(async () => {
  const module = await import('./pages/ResultPage');
  return { default: module.ResultPage };
});

const TutorialPage = lazy(async () => {
  const module = await import('./pages/TutorialPage');
  return { default: module.TutorialPage };
});

const PrivacyPage = lazy(async () => {
  const module = await import('./pages/PrivacyPage');
  return { default: module.PrivacyPage };
});

const LoginPage = lazy(async () => {
  const module = await import('./pages/LoginPage');
  return { default: module.LoginPage };
});

const RegisterPage = lazy(async () => {
  const module = await import('./pages/RegisterPage');
  return { default: module.RegisterPage };
});

const LexiconPage = lazy(async () => {
  const module = await import('./pages/LexiconPage');
  return { default: module.LexiconPage };
});

function RouteFallback() {
  return (
    <div className="route-loading" aria-hidden="true">
      <div className="route-loading-skeleton">
        <span className="skeleton-block route-loading-skeleton-title" />
        <span className="skeleton-block route-loading-skeleton-line" />
        <span className="skeleton-block route-loading-skeleton-line route-loading-skeleton-line-short" />
        <div className="route-loading-skeleton-grid">
          <span className="skeleton-block route-loading-skeleton-card" />
          <span className="skeleton-block route-loading-skeleton-card" />
          <span className="skeleton-block route-loading-skeleton-card" />
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { t } = useI18n();
  const location = useLocation();

  useEffect(() => {
    initAnalyticsFromRuntime();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname);
  }, [location.pathname]);

  return (
    <>
      <StarfieldBackground />
      <GlobalControlCluster />
      {/* P1-2 Trust Engine: global mount — T1 tutorial / T6 result (no-op on other routes). */}
      <TrustBanner />
      <Suspense fallback={<RouteFallback />}>
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<InputPage />} />
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/result" element={<ResultPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/lexicon" element={<LexiconPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ErrorBoundary>
        <footer
          className="global-disclaimer"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 50,
            padding: '6px 12px',
            fontSize: 11,
            lineHeight: 1.4,
            textAlign: 'center',
            color: '#d8cfe0',
            background: 'rgba(19, 16, 25, 0.92)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {t('disclaimer')}
        </footer>
      </Suspense>
    </>
  );
}
