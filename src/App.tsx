import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

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

const BirthTimeReversePage = lazy(async () => {
  const module = await import('./pages/BirthTimeReversePage');
  return { default: module.BirthTimeReversePage };
});

export default function App() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <Routes>
        <Route path="/" element={<InputPage />} />
        <Route path="/birth-time-reverse" element={<BirthTimeReversePage />} />
        <Route path="/tutorial" element={<TutorialPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
