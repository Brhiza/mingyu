import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WorkspaceShell } from './components/WorkspaceShell';
import { loadDivinationHistory, loadPersonalHistory } from './lib/history-records';
import { readActiveCaseId } from './lib/active-case';
import { buildChartFeaturePathForCase, buildDivinationRecordPath } from './lib/case-navigation';
import {
  buildWorkspaceFeaturePath,
  isChartWorkspaceId,
  readWorkspacePreferences,
  type WorkspaceFeatureId,
} from './lib/workspace';

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

const DivinationPage = lazy(async () => {
  const module = await import('./pages/DivinationPage');
  return { default: module.DivinationPage };
});

const DivinationResultPage = lazy(async () => {
  const module = await import('./pages/DivinationPage');
  return { default: module.DivinationResultPage };
});

function buildDefaultFeaturePath(feature: WorkspaceFeatureId) {
  if (!isChartWorkspaceId(feature)) return buildWorkspaceFeaturePath(feature);
  const activeCaseId = readActiveCaseId();
  const activeCase = activeCaseId
    ? loadPersonalHistory().find((record) => record.id === activeCaseId)
    : null;
  return activeCase
    ? buildChartFeaturePathForCase(activeCase, feature)
    : buildWorkspaceFeaturePath(feature);
}

function DefaultEntryRoute() {
  const [searchParams] = useSearchParams();
  const legacyMode = searchParams.get('mode');
  const legacyRecord = searchParams.get('record');

  if (legacyMode === 'compatibility') {
    return <Navigate to="/chart/compatibility" replace />;
  }
  if (legacyMode === 'almanac') {
    return <Navigate to="/divination/almanac" replace />;
  }
  if (legacyMode === 'divination') {
    if (legacyRecord) {
      const record = loadDivinationHistory().find((item) => item.id === legacyRecord);
      if (record) {
        return <Navigate to={buildDivinationRecordPath(record)} replace />;
      }
    }
    return <Navigate to="/divination/random" replace />;
  }
  if (legacyMode === 'single') {
    return <Navigate to={buildDefaultFeaturePath('bazi')} replace />;
  }

  const preferences = readWorkspacePreferences();
  const path = buildDefaultFeaturePath(preferences.defaultFeature);
  return <Navigate to={path} replace />;
}

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
      <ErrorBoundary>
        <Routes>
          <Route element={<WorkspaceShell />}>
            <Route path="/" element={<DefaultEntryRoute />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/chart/:tool" element={<InputPage />} />
            <Route path="/divination/:method" element={<DivinationPage />} />
            <Route path="/divination/:method/result" element={<DivinationResultPage />} />
            <Route path="/tutorial" element={<TutorialPage />} />
            <Route path="/records" element={<RecordsPage />} />
            <Route path="/result" element={<ResultPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ErrorBoundary>
    </Suspense>
  );
}
