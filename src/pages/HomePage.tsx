import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  INSTANT_CHART_DEFINITIONS,
  type InstantChartType,
  type InstantTimeStandard,
} from 'mingyu-core/instant';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import { useBirthPlace } from '@/hooks/useBirthPlace';
import { buildChartFeaturePathForCase, buildDivinationRecordPath } from '@/lib/case-navigation';
import { HISTORY_RECORDS_EVENT, loadDivinationHistory } from '@/lib/history-records';
import { defaultInputState, type QueryInputState } from '@/lib/query-state';
import {
  buildFrontendInstantObserver,
  buildInstantResultPath,
  instantChartNeedsObserver,
} from '@/lib/instant-chart';
import {
  WORKSPACE_PREFERENCES_EVENT,
  buildWorkspaceFeaturePath,
  getWorkspaceFeature,
  isChartWorkspaceId,
  isDivinationWorkspaceId,
  readWorkspacePreferences,
  type WorkspaceFeatureId,
} from '@/lib/workspace';
import { BirthPlaceModal } from './InputPage.BirthPlaceModal';

type HomeMode = 'chart' | 'divination' | 'instant';

const homeModes: Array<{ id: HomeMode; label: string; mark: string }> = [
  { id: 'chart', label: '排盘', mark: '盘' },
  { id: 'divination', label: '占问', mark: '问' },
  { id: 'instant', label: '即时盘', mark: '时' },
];

function formatRecentDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date);
}

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cases, activeCase } = useActivePersonalCase();
  const [preferences, setPreferences] = useState(readWorkspacePreferences);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [isMoreDivinationOpen, setIsMoreDivinationOpen] = useState(false);
  const [instantTimeStandard, setInstantTimeStandard] = useState<InstantTimeStandard>('beijing');
  const [instantPlaceForm, setInstantPlaceForm] = useState<QueryInputState>(defaultInputState);
  const [pendingInstantType, setPendingInstantType] = useState<InstantChartType | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const instantBirthPlace = useBirthPlace({ form: instantPlaceForm, setForm: setInstantPlaceForm });
  const requestedMode = searchParams.get('section');
  const defaultMode: HomeMode = isDivinationWorkspaceId(preferences.defaultFeature)
    ? 'divination'
    : 'chart';
  const activeMode: HomeMode =
    requestedMode === 'chart' || requestedMode === 'divination' || requestedMode === 'instant'
      ? requestedMode
      : defaultMode;
  const orderedFeatures = useMemo(
    () => preferences.navigationOrder.map(getWorkspaceFeature),
    [preferences.navigationOrder],
  );
  const chartFeatures = orderedFeatures.filter((feature) => isChartWorkspaceId(feature.id));
  const divinationFeatures = orderedFeatures.filter((feature) =>
    isDivinationWorkspaceId(feature.id),
  );
  const visibleDivinationFeatures = isMoreDivinationOpen
    ? divinationFeatures
    : divinationFeatures.slice(0, 6);
  const recentHistories = useMemo(() => {
    void historyRevision;
    return loadDivinationHistory().slice(0, 3);
  }, [historyRevision]);

  useEffect(() => {
    const syncPreferences = () => setPreferences(readWorkspacePreferences());
    const syncHistory = () => setHistoryRevision((current) => current + 1);
    window.addEventListener('storage', syncPreferences);
    window.addEventListener(WORKSPACE_PREFERENCES_EVENT, syncPreferences);
    window.addEventListener(HISTORY_RECORDS_EVENT, syncHistory);
    return () => {
      window.removeEventListener('storage', syncPreferences);
      window.removeEventListener(WORKSPACE_PREFERENCES_EVENT, syncPreferences);
      window.removeEventListener(HISTORY_RECORDS_EVENT, syncHistory);
    };
  }, []);

  useEffect(() => {
    if (activeMode !== 'instant') return undefined;
    setCurrentTime(new Date());
    const timer = window.setInterval(() => setCurrentTime(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, [activeMode]);

  useEffect(() => {
    if (!pendingInstantType || instantBirthPlace.isBirthPlaceModalOpen) return;
    const observer = buildFrontendInstantObserver(instantPlaceForm);
    if (!observer) return;
    const type = pendingInstantType;
    setPendingInstantType(null);
    navigate(
      buildInstantResultPath({
        type,
        timeStandard: instantTimeStandard,
        observer,
      }),
    );
  }, [
    instantBirthPlace.isBirthPlaceModalOpen,
    instantPlaceForm,
    instantTimeStandard,
    navigate,
    pendingInstantType,
  ]);

  function selectMode(mode: HomeMode) {
    const next = new URLSearchParams(searchParams);
    next.set('section', mode);
    setSearchParams(next, { replace: true });
  }

  function openFeature(featureId: WorkspaceFeatureId) {
    navigate(
      isChartWorkspaceId(featureId) && activeCase
        ? buildChartFeaturePathForCase(activeCase, featureId)
        : buildWorkspaceFeaturePath(featureId),
      { state: { workspaceNew: true } },
    );
  }

  function openInstantChart(type: InstantChartType) {
    const observer = buildFrontendInstantObserver(instantPlaceForm);
    if (instantChartNeedsObserver(type, instantTimeStandard) && !observer) {
      setPendingInstantType(type);
      instantBirthPlace.openBirthPlaceModal('self');
      return;
    }
    navigate(
      buildInstantResultPath({
        type,
        timeStandard: instantTimeStandard,
        observer,
      }),
    );
  }

  const modeHeading =
    activeMode === 'chart'
      ? '选择命盘'
      : activeMode === 'divination'
        ? '选择占问方式'
        : '使用当前时间起盘';
  const modeDescription =
    activeMode === 'chart'
      ? activeCase
        ? `当前使用：${activeCase.name}`
        : '未指定档案，进入后填写资料'
      : activeMode === 'divination'
        ? '常用方式优先显示，其他方式可展开'
        : '按设备当前日期和时辰生成盘面';

  return (
    <div className="workspace-home-page">
      <div className="workspace-home-stage">
        <header className="workspace-home-heading">
          <span className="workspace-home-seal" aria-hidden="true">
            命
          </span>
          <div>
            <h1>{modeHeading}</h1>
            <p>{modeDescription}</p>
          </div>
        </header>

        <div className="workspace-home-mode-switch" role="tablist" aria-label="首页模式">
          {homeModes.map((mode) => (
            <button
              type="button"
              role="tab"
              key={mode.id}
              className={activeMode === mode.id ? 'is-active' : ''}
              aria-selected={activeMode === mode.id}
              onClick={() => selectMode(mode.id)}
            >
              <span aria-hidden="true">{mode.mark}</span>
              {mode.label}
            </button>
          ))}
        </div>

        {activeMode === 'chart' ? (
          <div className="workspace-home-mode-panel" role="tabpanel">
            <button
              type="button"
              className="workspace-home-case"
              onClick={() => navigate(cases.length ? '/cases' : '/cases?new=1')}
            >
              <span className="workspace-home-case-mark" aria-hidden="true">
                {activeCase?.name.slice(0, 1) || '临'}
              </span>
              <span className="workspace-home-case-copy">
                <small>当前档案</small>
                <strong>{activeCase?.name || '未指定'}</strong>
                <span>{activeCase?.birthText || '每次从空白资料开始'}</span>
              </span>
              <span className="workspace-home-case-action">{activeCase ? '切换' : '选择'}</span>
            </button>
            <div className="workspace-home-tool-grid is-chart">
              {chartFeatures.map((feature) => (
                <button
                  type="button"
                  key={feature.id}
                  className={feature.id === preferences.defaultFeature ? 'is-preferred' : ''}
                  onClick={() => openFeature(feature.id)}
                >
                  <span className="workspace-home-tool-mark" aria-hidden="true">
                    {feature.mark}
                  </span>
                  <span>
                    <strong>{feature.label}</strong>
                    <small>{feature.description}</small>
                  </span>
                  {feature.id === preferences.defaultFeature ? <em>首选</em> : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activeMode === 'divination' ? (
          <div className="workspace-home-mode-panel" role="tabpanel">
            <div className="workspace-home-tool-grid is-divination">
              {visibleDivinationFeatures.map((feature) => (
                <button
                  type="button"
                  key={feature.id}
                  className={feature.id === preferences.defaultFeature ? 'is-preferred' : ''}
                  onClick={() => openFeature(feature.id)}
                >
                  <span className="workspace-home-tool-mark" aria-hidden="true">
                    {feature.mark}
                  </span>
                  <span>
                    <strong>{feature.label}</strong>
                    <small>{feature.description}</small>
                  </span>
                  {feature.id === preferences.defaultFeature ? <em>首选</em> : null}
                </button>
              ))}
            </div>
            {divinationFeatures.length > 6 ? (
              <button
                type="button"
                className="workspace-home-more"
                onClick={() => setIsMoreDivinationOpen((current) => !current)}
              >
                {isMoreDivinationOpen
                  ? '收起其他占问'
                  : `更多占问（${divinationFeatures.length - 6}）`}
              </button>
            ) : null}
            {recentHistories.length ? (
              <section className="workspace-home-history">
                <header>
                  <h2>最近占问</h2>
                  <button type="button" onClick={() => navigate('/records?tab=divination')}>
                    全部
                  </button>
                </header>
                <div>
                  {recentHistories.map((record) => {
                    const feature = getWorkspaceFeature(record.requestedMethod);
                    return (
                      <button
                        type="button"
                        key={record.id}
                        onClick={() => navigate(buildDivinationRecordPath(record))}
                      >
                        <span className="workspace-home-history-mark" aria-hidden="true">
                          {feature.mark}
                        </span>
                        <span>
                          <strong>{record.question || feature.label}</strong>
                          <small>
                            {feature.label} · {record.caseName || '未指定'} ·{' '}
                            {formatRecentDate(record.updatedAt)}
                          </small>
                        </span>
                        <span className="workspace-home-arrow" aria-hidden="true">
                          ›
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {activeMode === 'instant' ? (
          <div className="workspace-home-mode-panel workspace-instant-panel" role="tabpanel">
            <div className="workspace-instant-time">
              <time dateTime={currentTime.toISOString()}>
                {currentTime.toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false,
                })}
              </time>
              <span>
                {currentTime.toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}
              </span>
            </div>
            <div className="workspace-instant-standard" role="group" aria-label="时间口径">
              <span>时间口径</span>
              <button
                type="button"
                className={instantTimeStandard === 'beijing' ? 'is-active' : ''}
                aria-pressed={instantTimeStandard === 'beijing'}
                onClick={() => setInstantTimeStandard('beijing')}
              >
                北京时间
              </button>
              <button
                type="button"
                className={instantTimeStandard === 'true-solar' ? 'is-active' : ''}
                aria-pressed={instantTimeStandard === 'true-solar'}
                onClick={() => setInstantTimeStandard('true-solar')}
              >
                真太阳时
              </button>
            </div>
            {instantTimeStandard === 'true-solar' ? (
              <button
                type="button"
                className="workspace-instant-place"
                onClick={() => instantBirthPlace.openBirthPlaceModal('self')}
              >
                <span>观测地点</span>
                <strong>{instantPlaceForm.birthPlace || '选择地点'}</strong>
                <span aria-hidden="true">›</span>
              </button>
            ) : null}
            <div className="workspace-instant-grid">
              {INSTANT_CHART_DEFINITIONS.map((item) => (
                <button type="button" key={item.type} onClick={() => openInstantChart(item.type)}>
                  <span className="workspace-instant-mark" aria-hidden="true">
                    {item.mark}
                  </span>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="workspace-home-arrow" aria-hidden="true">
                    ›
                  </span>
                </button>
              ))}
            </div>
            <p className="workspace-instant-note">
              即时盘只记录当前时刻，不加入案例；星盘与七政四余仍需观测地点。
            </p>
          </div>
        ) : null}
      </div>
      {instantBirthPlace.isBirthPlaceModalOpen ? (
        <BirthPlaceModal birthPlace={instantBirthPlace} purpose="observer" />
      ) : null}
    </div>
  );
}
