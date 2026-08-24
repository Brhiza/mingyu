import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  INSTANT_CHART_DEFINITIONS,
  type InstantChartType,
  type InstantTimeStandard,
} from 'mingyu-core/instant';
import { DropdownSelect, type DropdownSelectOption } from '@/components/DropdownSelect';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import { useBirthPlace } from '@/hooks/useBirthPlace';
import { buildChartFeaturePathForCase, buildDivinationRecordPath } from '@/lib/case-navigation';
import { HISTORY_RECORDS_EVENT, loadDivinationHistory } from '@/lib/history-records';
import { defaultInputState, type QueryInputState } from '@/lib/query-state';
import {
  buildFrontendInstantObserver,
  buildInstantResultPath,
  instantChartNeedsObserver,
  isInstantChartType,
} from '@/lib/instant-chart';
import { buildWorkspaceLaunchState } from '@/lib/workspace-launch';
import {
  WORKSPACE_PREFERENCES_EVENT,
  buildWorkspaceFeaturePath,
  getWorkspaceFeature,
  isChartWorkspaceId,
  isDivinationWorkspaceId,
  readWorkspacePreferences,
  type ChartWorkspaceId,
  type DivinationWorkspaceId,
} from '@/lib/workspace';
import { BirthPlaceModal } from './InputPage.BirthPlaceModal';

type HomeMode = 'chart' | 'divination' | 'instant';

const homeModes: Array<{ id: HomeMode; label: string; mark: string }> = [
  { id: 'chart', label: '排盘', mark: '盘' },
  { id: 'divination', label: '占问', mark: '问' },
  { id: 'instant', label: '即时盘', mark: '时' },
];

const modeCopy: Record<HomeMode, { heading: string; placeholder: string }> = {
  chart: {
    heading: '排盘并开始解读',
    placeholder: '输入想了解的问题，也可以留空直接查看完整盘面',
  },
  divination: {
    heading: '今天想问什么？',
    placeholder: '写下具体问题，选择占问方式后即可开始',
  },
  instant: {
    heading: '以此刻起盘',
    placeholder: '输入想结合当前时刻了解的问题，也可以留空起盘',
  },
};

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
  const [questionDraft, setQuestionDraft] = useState('');
  const [selectedChartFeature, setSelectedChartFeature] = useState<ChartWorkspaceId>(() =>
    isChartWorkspaceId(preferences.defaultFeature) ? preferences.defaultFeature : 'bazi',
  );
  const [selectedDivinationFeature, setSelectedDivinationFeature] = useState<DivinationWorkspaceId>(
    () =>
      isDivinationWorkspaceId(preferences.defaultFeature) ? preferences.defaultFeature : 'random',
  );
  const [selectedInstantType, setSelectedInstantType] = useState<InstantChartType>('bazi');
  const [instantTimeStandard, setInstantTimeStandard] = useState<InstantTimeStandard>('beijing');
  const [instantPlaceForm, setInstantPlaceForm] = useState<QueryInputState>(defaultInputState);
  const [pendingInstantLaunch, setPendingInstantLaunch] = useState<{
    type: InstantChartType;
    question: string;
  } | null>(null);
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
  const chartFeatures = useMemo(
    () => orderedFeatures.filter((feature) => isChartWorkspaceId(feature.id)),
    [orderedFeatures],
  );
  const divinationFeatures = useMemo(
    () => orderedFeatures.filter((feature) => isDivinationWorkspaceId(feature.id)),
    [orderedFeatures],
  );
  const chartOptions = useMemo<DropdownSelectOption<string>[]>(
    () => chartFeatures.map((feature) => ({ value: feature.id, label: feature.label })),
    [chartFeatures],
  );
  const divinationOptions = useMemo<DropdownSelectOption<string>[]>(
    () => divinationFeatures.map((feature) => ({ value: feature.id, label: feature.label })),
    [divinationFeatures],
  );
  const instantOptions = useMemo<DropdownSelectOption<string>[]>(
    () =>
      INSTANT_CHART_DEFINITIONS.map((definition) => ({
        value: definition.type,
        label: definition.label,
      })),
    [],
  );
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
    if (!pendingInstantLaunch || instantBirthPlace.isBirthPlaceModalOpen) return;
    const observer = buildFrontendInstantObserver(instantPlaceForm);
    if (!observer) return;
    const launch = pendingInstantLaunch;
    setPendingInstantLaunch(null);
    navigate(
      buildInstantResultPath({
        type: launch.type,
        timeStandard: instantTimeStandard,
        observer,
      }),
      { state: buildWorkspaceLaunchState(launch.question) },
    );
  }, [
    instantBirthPlace.isBirthPlaceModalOpen,
    instantPlaceForm,
    instantTimeStandard,
    navigate,
    pendingInstantLaunch,
  ]);

  function selectMode(mode: HomeMode) {
    const next = new URLSearchParams(searchParams);
    next.set('section', mode);
    setSearchParams(next, { replace: true });
  }

  function selectAlgorithm(value: string) {
    if (activeMode === 'chart' && isChartWorkspaceId(value)) {
      setSelectedChartFeature(value);
      return;
    }
    if (activeMode === 'divination' && isDivinationWorkspaceId(value)) {
      setSelectedDivinationFeature(value);
      return;
    }
    if (activeMode === 'instant' && isInstantChartType(value)) {
      setSelectedInstantType(value);
    }
  }

  function openInstantChart(type: InstantChartType, question: string) {
    const observer = buildFrontendInstantObserver(instantPlaceForm);
    if (instantChartNeedsObserver(type, instantTimeStandard) && !observer) {
      setPendingInstantLaunch({ type, question });
      instantBirthPlace.openBirthPlaceModal('self');
      return;
    }
    navigate(
      buildInstantResultPath({
        type,
        timeStandard: instantTimeStandard,
        observer,
      }),
      { state: buildWorkspaceLaunchState(question) },
    );
  }

  function launchSelected() {
    const question = questionDraft.trim();
    if (activeMode === 'chart') {
      navigate(
        activeCase
          ? buildChartFeaturePathForCase(activeCase, selectedChartFeature)
          : buildWorkspaceFeaturePath(selectedChartFeature),
        { state: buildWorkspaceLaunchState(question) },
      );
      return;
    }
    if (activeMode === 'divination') {
      navigate(buildWorkspaceFeaturePath(selectedDivinationFeature), {
        state: buildWorkspaceLaunchState(question, {
          autoSubmit: Boolean(question) && selectedDivinationFeature !== 'almanac',
        }),
      });
      return;
    }
    openInstantChart(selectedInstantType, question);
  }

  const selectedAlgorithm =
    activeMode === 'chart'
      ? selectedChartFeature
      : activeMode === 'divination'
        ? selectedDivinationFeature
        : selectedInstantType;
  const algorithmOptions =
    activeMode === 'chart'
      ? chartOptions
      : activeMode === 'divination'
        ? divinationOptions
        : instantOptions;
  const launchLabel =
    activeMode === 'chart'
      ? activeCase
        ? '查看盘面'
        : '填写资料'
      : activeMode === 'divination'
        ? questionDraft.trim() && selectedDivinationFeature !== 'almanac'
          ? '开始占问'
          : '继续设置'
        : '即时起盘';

  return (
    <div className="workspace-home-page">
      <div className="workspace-home-stage">
        <header className="workspace-home-heading">
          <span className="workspace-home-seal" aria-hidden="true">
            命
          </span>
          <div>
            <h1>{modeCopy[activeMode].heading}</h1>
            <p>输入问题，选择算法，一步开始</p>
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

        <div className="workspace-home-mode-panel" role="tabpanel">
          {activeMode !== 'instant' ? (
            <button
              type="button"
              className="workspace-home-context"
              onClick={() => navigate(cases.length ? '/cases' : '/cases?new=1')}
            >
              <span className="workspace-home-context-mark" aria-hidden="true">
                {activeCase?.name.slice(0, 1) || '临'}
              </span>
              <span className="workspace-home-context-copy">
                <small>当前档案</small>
                <strong>{activeCase?.name || '临时档案'}</strong>
                <span>{activeCase?.birthText || '不关联案例'}</span>
              </span>
              <span className="workspace-home-context-action">切换</span>
            </button>
          ) : (
            <div className="workspace-home-instant-context">
              <div>
                <time dateTime={currentTime.toISOString()}>
                  {currentTime.toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </time>
                <span>
                  {currentTime.toLocaleDateString('zh-CN', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
              </div>
              <div className="workspace-instant-standard" role="group" aria-label="时间口径">
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
            </div>
          )}

          <form
            className="workspace-home-composer"
            onSubmit={(event) => {
              event.preventDefault();
              launchSelected();
            }}
          >
            <textarea
              className="workspace-home-question"
              value={questionDraft}
              placeholder={modeCopy[activeMode].placeholder}
              aria-label="输入问题"
              rows={4}
              onChange={(event) => setQuestionDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  launchSelected();
                }
              }}
            />
            <div className="workspace-home-composer-footer">
              <div className="workspace-home-algorithm">
                <DropdownSelect<string>
                  value={selectedAlgorithm}
                  options={algorithmOptions}
                  onChange={selectAlgorithm}
                  ariaLabel="选择算法"
                  prefix="算法"
                  variant="field"
                />
              </div>
              <button type="submit" className="workspace-home-launch" aria-label={launchLabel}>
                <span className="workspace-home-launch-icon" aria-hidden="true">
                  ↑
                </span>
              </button>
            </div>
          </form>

          {activeMode === 'divination' && recentHistories.length ? (
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
      </div>
      {instantBirthPlace.isBirthPlaceModalOpen ? (
        <BirthPlaceModal birthPlace={instantBirthPlace} purpose="observer" />
      ) : null}
    </div>
  );
}
