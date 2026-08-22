import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { WorkspaceShell } from './components/WorkspaceShell';
import {
  loadCompatibilityHistory,
  loadDivinationHistory,
  loadPersonalHistory,
} from './lib/history-records';
import {
  buildInputStateSearch,
  buildResultSearch,
  defaultPromptState,
  hasCompletePreciseBirthData,
} from './lib/query-state';
import {
  buildWorkspaceFeaturePath,
  isDivinationWorkspaceId,
  readWorkspacePreferences,
  type ChartWorkspaceId,
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

function getChartResultState(feature: ChartWorkspaceId) {
  if (feature === 'compatibility') {
    return {
      ...defaultPromptState,
      tab: 'bazi' as const,
      promptSource: 'bazi' as const,
      baziShortcutMode: '合婚',
      baziPresetId: 'ai-compat-marriage',
    };
  }
  if (feature === 'ziwei') {
    return { ...defaultPromptState, tab: 'ziwei' as const, promptSource: 'ziwei' as const };
  }
  if (feature === 'astrolabe') {
    return {
      ...defaultPromptState,
      tab: 'astrolabe' as const,
      promptSource: 'astrolabe' as const,
    };
  }
  if (feature === 'qizheng') {
    return { ...defaultPromptState, tab: 'qizheng' as const, promptSource: 'qizheng' as const };
  }
  if (feature === 'bazhai') {
    return { ...defaultPromptState, tab: 'bazhai' as const, promptSource: 'bazhai' as const };
  }
  if (feature === 'bazi-ziwei') {
    return {
      ...defaultPromptState,
      tab: 'bazi' as const,
      promptSource: 'bazi-ziwei' as const,
    };
  }
  return { ...defaultPromptState, tab: 'bazi' as const, promptSource: 'bazi' as const };
}

function buildRecentFeaturePath(feature: WorkspaceFeatureId) {
  if (isDivinationWorkspaceId(feature)) {
    const record = loadDivinationHistory().find(
      (item) => item.requestedMethod === feature || item.method === feature,
    );
    return record
      ? `/divination/${feature}/result?record=${encodeURIComponent(record.id)}`
      : buildWorkspaceFeaturePath(feature);
  }

  if (feature === 'compatibility') {
    const records = loadCompatibilityHistory();
    const record = records.find((item) => item.pinned) ?? records[0];
    return record
      ? `/result?${buildResultSearch(record.input, getChartResultState(feature))}`
      : buildWorkspaceFeaturePath(feature);
  }

  const expectedChartType =
    feature === 'ziwei'
      ? 'ziwei'
      : feature === 'astrolabe' || feature === 'qizheng'
        ? 'astrolabe'
        : 'bazi';
  const records = loadPersonalHistory();
  const matchingRecords = records.filter((item) => item.input.chartType === expectedChartType);
  const record =
    matchingRecords.find((item) => item.pinned) ??
    matchingRecords[0] ??
    records.find((item) => item.pinned) ??
    records[0];
  if (
    record &&
    (feature === 'astrolabe' || feature === 'qizheng') &&
    !hasCompletePreciseBirthData(record.input)
  ) {
    return `/chart/${feature}?${buildInputStateSearch(record.input)}`;
  }
  return record
    ? `/result?${buildResultSearch(record.input, getChartResultState(feature))}`
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
        return (
          <Navigate
            to={`/divination/${record.requestedMethod}/result?record=${encodeURIComponent(record.id)}`}
            replace
          />
        );
      }
    }
    return <Navigate to="/divination/random" replace />;
  }
  if (legacyMode === 'single') {
    return <Navigate to="/chart/bazi" replace />;
  }

  const preferences = readWorkspacePreferences();
  const path =
    preferences.startBehavior === 'recent'
      ? buildRecentFeaturePath(preferences.defaultFeature)
      : buildWorkspaceFeaturePath(preferences.defaultFeature);
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
