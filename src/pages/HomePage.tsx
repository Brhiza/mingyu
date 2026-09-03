import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  INSTANT_CHART_DEFINITIONS,
  type InstantChartType,
  type InstantTimeStandard,
} from 'mingyu-core/instant';
import { DropdownSelect, type DropdownSelectOption } from '@/components/DropdownSelect';
import {
  QuestionInspirationModal,
  type QuestionInspirationSection,
} from '@/components/QuestionInspirationModal';
import {
  SupplementaryInfoModal,
  type SupplementaryInfoModalField,
} from '@/components/SupplementaryInfoModal';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import { useBirthPlace } from '@/hooks/useBirthPlace';
import { buildChartFeaturePathForCase, buildDivinationRecordPath } from '@/lib/case-navigation';
import { addInstantHistory, sortPersonalCasesForQuickSwitch } from '@/lib/history-records';
import { defaultInputState, type QueryInputState } from '@/lib/query-state';
import {
  buildFrontendInstantObserver,
  buildInstantResultPath,
  instantChartNeedsObserver,
  isInstantChartType,
} from '@/lib/instant-chart';
import { buildWorkspaceLaunchState } from '@/lib/workspace-launch';
import {
  commonQuestionInspirations,
  inspirationCategories,
} from '@/pages/ResultPage/ResultPage.constants';
import {
  HOME_MODE_DEFINITIONS,
  WORKSPACE_PREFERENCES_EVENT,
  buildWorkspaceFeaturePath,
  getWorkspaceFeature,
  isHomeChartWorkspaceId,
  isDivinationWorkspaceId,
  readWorkspacePreferences,
  saveWorkspacePreferences,
  type ChartWorkspaceId,
  type DivinationWorkspaceId,
  type HomeModeId,
} from '@/lib/workspace';
import { BirthPlaceModal } from './InputPage.BirthPlaceModal';

const modeCopy: Record<HomeModeId, { heading: string; placeholder: string }> = {
  chart: {
    heading: '排盘并开始解读',
    placeholder: '输入想了解的问题，选择排盘方式后继续',
  },
  divination: {
    heading: '今天想问什么？',
    placeholder: '写下具体问题，选择占问方式后即可开始',
  },
  instant: {
    heading: '以此刻起盘',
    placeholder: '输入想结合当前时刻了解的问题，选择即时盘后开始',
  },
};

const instantTimeOptions: DropdownSelectOption<InstantTimeStandard>[] = [
  { value: 'beijing', label: '北京时间', triggerLabel: '北京' },
  { value: 'true-solar', label: '真太阳时', triggerLabel: '真太阳' },
];

const TEMPORARY_CASE_VALUE = '__temporary_case__';
const DONATION_URL = 'https://lk.sydf.cc/';
const isDonationBoxEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DONATION_BOX === 'true';

export function HomePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { cases, activeCase, activeCaseId, selectCase } = useActivePersonalCase();
  const [preferences, setPreferences] = useState(readWorkspacePreferences);
  const [questionDraft, setQuestionDraft] = useState('');
  const [supplementaryInfoDraft, setSupplementaryInfoDraft] = useState('');
  const [temporaryGender, setTemporaryGender] = useState<'' | '男' | '女'>('');
  const [temporaryBirthYear, setTemporaryBirthYear] = useState('');
  const [isSupplementaryInfoModalOpen, setIsSupplementaryInfoModalOpen] = useState(false);
  const [isQuestionInspirationOpen, setIsQuestionInspirationOpen] = useState(false);
  const [inspirationCategory, setInspirationCategory] = useState('近期');
  const [inspirationSearch, setInspirationSearch] = useState('');
  const [selectedChartFeature, setSelectedChartFeature] = useState<ChartWorkspaceId>(
    preferences.defaultChartFeature,
  );
  const [selectedDivinationFeature, setSelectedDivinationFeature] = useState<DivinationWorkspaceId>(
    preferences.defaultDivinationFeature,
  );
  const [selectedInstantType, setSelectedInstantType] = useState<InstantChartType>(
    preferences.defaultInstantType,
  );
  const [instantTimeStandard, setInstantTimeStandard] = useState<InstantTimeStandard>('beijing');
  const [instantPlaceForm, setInstantPlaceForm] = useState<QueryInputState>(defaultInputState);
  const [pendingInstantLaunch, setPendingInstantLaunch] = useState<{
    type: InstantChartType;
    question: string;
    supplementaryInfo: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const instantBirthPlace = useBirthPlace({ form: instantPlaceForm, setForm: setInstantPlaceForm });
  const requestedMode = searchParams.get('section');
  const defaultMode = preferences.homeModeOrder[0] ?? 'divination';
  const activeMode: HomeModeId =
    requestedMode === 'chart' || requestedMode === 'divination' || requestedMode === 'instant'
      ? requestedMode
      : defaultMode;
  const homeModes = useMemo(
    () =>
      preferences.homeModeOrder.flatMap((id) => {
        const mode = HOME_MODE_DEFINITIONS.find((item) => item.id === id);
        return mode ? [mode] : [];
      }),
    [preferences.homeModeOrder],
  );
  const orderedFeatures = useMemo(
    () => preferences.navigationOrder.map(getWorkspaceFeature),
    [preferences.navigationOrder],
  );
  const chartFeatures = useMemo(
    () => orderedFeatures.filter((feature) => isHomeChartWorkspaceId(feature.id)),
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
  const caseOptions = useMemo<DropdownSelectOption<string>[]>(
    () => [
      {
        value: TEMPORARY_CASE_VALUE,
        label: '不指定案例',
        triggerLabel: '临时档案',
      },
      ...sortPersonalCasesForQuickSwitch(cases).map((record) => ({
        value: record.id,
        label: `${record.name} · ${record.birthText}`,
        triggerLabel: record.name,
      })),
    ],
    [cases],
  );
  const effectiveGender = activeCase
    ? activeCase.input.gender === 'male'
      ? '男'
      : '女'
    : temporaryGender;
  const effectiveBirthYear = activeCase ? activeCase.input.year : temporaryBirthYear;
  const hasSupplementaryInfo = Boolean(
    supplementaryInfoDraft.trim() ||
    (activeCaseId === null && (temporaryGender || temporaryBirthYear)),
  );
  const homeSupplementaryFields = useMemo<readonly SupplementaryInfoModalField[]>(() => {
    if (activeCaseId !== null) {
      return [
        {
          key: 'supplementaryInfo',
          label: '背景与细节',
          placeholder: '补充已知情况、现实限制或期待结果（可选）',
          rows: 5,
        },
      ];
    }
    return [
      {
        key: 'gender',
        label: '求测人性别（可选）',
        type: 'select',
        options: [
          { value: '', label: '不填（未指定）' },
          { value: '男', label: '男' },
          { value: '女', label: '女' },
        ],
      },
      {
        key: 'birthYear',
        label: '出生年份（可选）',
        type: 'text',
        placeholder: '例如 1998',
        inputMode: 'numeric',
        maxLength: 4,
      },
      {
        key: 'supplementaryInfo',
        label: '背景与细节',
        placeholder: '补充已知情况、现实限制或期待结果（可选）',
        rows: 4,
        fullWidth: true,
      },
    ];
  }, [activeCaseId]);
  const inspirationSections = useMemo<QuestionInspirationSection[]>(() => {
    const keyword = inspirationSearch.trim();
    return inspirationCategories
      .filter((category) => category !== '全部')
      .filter((category) => inspirationCategory === '全部' || category === inspirationCategory)
      .map((category) => ({
        id: category,
        heading: category,
        items: commonQuestionInspirations
          .filter(
            (item) => item.category === category && (!keyword || item.question.includes(keyword)),
          )
          .map((item, index) => ({
            id: `${category}-${index}`,
            question: item.question,
          })),
      }))
      .filter((section) => section.items.length > 0);
  }, [inspirationCategory, inspirationSearch]);
  useEffect(() => {
    const syncPreferences = () => setPreferences(readWorkspacePreferences());
    window.addEventListener('storage', syncPreferences);
    window.addEventListener(WORKSPACE_PREFERENCES_EVENT, syncPreferences);
    return () => {
      window.removeEventListener('storage', syncPreferences);
      window.removeEventListener(WORKSPACE_PREFERENCES_EVENT, syncPreferences);
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
    const resultPath = buildInstantResultPath({
      type: launch.type,
      timeStandard: instantTimeStandard,
      observer,
    });
    const record = addInstantHistory({
      question: launch.question,
      supplementaryInfo: launch.supplementaryInfo,
      instantType: launch.type,
      timeStandard: instantTimeStandard,
      path: resultPath,
    });
    if (!record) return;
    navigate(buildDivinationRecordPath(record), {
      state: buildWorkspaceLaunchState(launch.question, {
        supplementaryInfo: launch.supplementaryInfo,
      }),
    });
  }, [
    instantBirthPlace.isBirthPlaceModalOpen,
    instantPlaceForm,
    instantTimeStandard,
    navigate,
    pendingInstantLaunch,
  ]);

  function selectMode(mode: HomeModeId) {
    const next = new URLSearchParams(searchParams);
    next.set('section', mode);
    setSearchParams(next, { replace: true });
  }

  function selectAlgorithm(value: string) {
    if (activeMode === 'chart' && isHomeChartWorkspaceId(value)) {
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

  function favoriteAlgorithm(value: string) {
    const nextPreferences =
      activeMode === 'chart' && isHomeChartWorkspaceId(value)
        ? { ...preferences, defaultChartFeature: value }
        : activeMode === 'divination' && isDivinationWorkspaceId(value)
          ? { ...preferences, defaultDivinationFeature: value }
          : activeMode === 'instant' && isInstantChartType(value)
            ? { ...preferences, defaultInstantType: value }
            : null;
    if (!nextPreferences) return;
    setPreferences(saveWorkspacePreferences(nextPreferences));
  }

  function openInstantChart(type: InstantChartType, question: string, supplementaryInfo: string) {
    const observer = buildFrontendInstantObserver(instantPlaceForm);
    if (instantChartNeedsObserver(type, instantTimeStandard) && !observer) {
      setPendingInstantLaunch({ type, question, supplementaryInfo });
      instantBirthPlace.openBirthPlaceModal('self');
      return;
    }
    const resultPath = buildInstantResultPath({
      type,
      timeStandard: instantTimeStandard,
      observer,
    });
    const record = addInstantHistory({
      question,
      supplementaryInfo,
      instantType: type,
      timeStandard: instantTimeStandard,
      path: resultPath,
    });
    if (!record) return;
    navigate(buildDivinationRecordPath(record), {
      state: buildWorkspaceLaunchState(question, { supplementaryInfo }),
    });
  }

  function launchSelected() {
    const question = questionDraft.trim();
    const supplementaryInfo = supplementaryInfoDraft.trim();
    if (!question) return;
    if (activeMode === 'chart') {
      navigate(
        activeCase
          ? buildChartFeaturePathForCase(activeCase, selectedChartFeature)
          : buildWorkspaceFeaturePath(selectedChartFeature),
        {
          state: buildWorkspaceLaunchState(question, {
            supplementaryInfo,
            gender: effectiveGender,
            birthYear: effectiveBirthYear,
          }),
        },
      );
      return;
    }
    if (activeMode === 'divination') {
      navigate(buildWorkspaceFeaturePath(selectedDivinationFeature), {
        state: buildWorkspaceLaunchState(question, {
          autoSubmit: Boolean(question) && selectedDivinationFeature !== 'almanac',
          supplementaryInfo,
          gender: effectiveGender,
          birthYear: effectiveBirthYear,
        }),
      });
      return;
    }
    openInstantChart(selectedInstantType, question, supplementaryInfo);
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
  const favoriteAlgorithmValue =
    activeMode === 'chart'
      ? preferences.defaultChartFeature
      : activeMode === 'divination'
        ? preferences.defaultDivinationFeature
        : preferences.defaultInstantType;
  const favoriteAlgorithmLabel =
    activeMode === 'chart'
      ? '排盘默认算法'
      : activeMode === 'divination'
        ? '占问默认算法'
        : '即时盘默认算法';
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
          <div className="workspace-home-brand">
            <span className="workspace-home-seal" aria-hidden="true">
              命
            </span>
          </div>
          <div className="workspace-home-copy">
            <h1>{modeCopy[activeMode].heading}</h1>
            <p>输入问题，选择算法，一步开始</p>
          </div>
          {isDonationBoxEnabled ? (
            <a
              className="workspace-home-donation"
              href={DONATION_URL}
              target="_blank"
              rel="noreferrer"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20.4 10.6 19.2C5.7 14.9 2.5 12 2.5 8.4A4.9 4.9 0 0 1 7.5 3.5c1.8 0 3.5.9 4.5 2.3a5.6 5.6 0 0 1 4.5-2.3 4.9 4.9 0 0 1 5 4.9c0 3.6-3.2 6.5-8.1 10.8L12 20.4Z" />
              </svg>
              <span>功德箱</span>
            </a>
          ) : null}
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
              required
              rows={4}
              onChange={(event) => setQuestionDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <div className="workspace-home-question-tools" aria-label="问题辅助工具">
              <button type="button" onClick={() => setIsQuestionInspirationOpen(true)}>
                问题灵感
              </button>
              <button
                type="button"
                className={hasSupplementaryInfo ? 'is-active' : ''}
                aria-haspopup="dialog"
                aria-expanded={isSupplementaryInfoModalOpen}
                onClick={() => setIsSupplementaryInfoModalOpen(true)}
              >
                补充信息{hasSupplementaryInfo ? ' · 已填写' : ''}
              </button>
            </div>
            <div className="workspace-home-composer-footer">
              <div className="workspace-home-algorithm">
                <DropdownSelect<string>
                  value={selectedAlgorithm}
                  options={algorithmOptions}
                  onChange={selectAlgorithm}
                  ariaLabel="选择算法"
                  prefix="算法"
                  variant="field"
                  favoriteValue={favoriteAlgorithmValue}
                  favoriteLabel={favoriteAlgorithmLabel}
                  onFavoriteChange={favoriteAlgorithm}
                />
              </div>
              {activeMode !== 'instant' ? (
                <div className="workspace-home-case-select">
                  <DropdownSelect<string>
                    value={activeCaseId ?? TEMPORARY_CASE_VALUE}
                    options={caseOptions}
                    onChange={(value) => selectCase(value === TEMPORARY_CASE_VALUE ? null : value)}
                    ariaLabel="切换案例"
                    prefix="案例"
                    variant="field"
                  />
                </div>
              ) : (
                <div className="workspace-home-time-context">
                  <time
                    dateTime={currentTime.toISOString()}
                    title={currentTime.toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'short',
                    })}
                  >
                    {currentTime.toLocaleTimeString('zh-CN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })}
                  </time>
                  <DropdownSelect<InstantTimeStandard>
                    value={instantTimeStandard}
                    options={instantTimeOptions}
                    onChange={setInstantTimeStandard}
                    ariaLabel="选择时间口径"
                  />
                  {instantTimeStandard === 'true-solar' ? (
                    <button
                      type="button"
                      className="workspace-home-place"
                      title={instantPlaceForm.birthPlace || '选择观测地点'}
                      onClick={() => instantBirthPlace.openBirthPlaceModal('self')}
                    >
                      地点
                    </button>
                  ) : null}
                </div>
              )}
              <span className="workspace-home-keyboard-hint" aria-hidden="true">
                Enter 发送 · Shift + Enter 换行
              </span>
              <button
                type="submit"
                className="workspace-home-launch"
                aria-label={launchLabel}
                disabled={!questionDraft.trim()}
              >
                <span className="workspace-home-launch-icon" aria-hidden="true">
                  ↑
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
      {instantBirthPlace.isBirthPlaceModalOpen ? (
        <BirthPlaceModal birthPlace={instantBirthPlace} purpose="observer" />
      ) : null}
      {isQuestionInspirationOpen ? (
        <QuestionInspirationModal
          filters={inspirationCategories.map((category) => ({
            label: category,
            value: category,
          }))}
          activeFilter={inspirationCategory}
          onFilterChange={setInspirationCategory}
          searchValue={inspirationSearch}
          onSearchChange={setInspirationSearch}
          sections={inspirationSections}
          emptyText="没有找到匹配的问题"
          selectedQuestion={questionDraft.trim()}
          onSelect={(question) => {
            setQuestionDraft(question);
            setIsQuestionInspirationOpen(false);
          }}
          onClose={() => setIsQuestionInspirationOpen(false)}
        />
      ) : null}
      {isSupplementaryInfoModalOpen ? (
        <SupplementaryInfoModal
          fields={homeSupplementaryFields}
          values={{
            supplementaryInfo: supplementaryInfoDraft,
            gender: temporaryGender,
            birthYear: temporaryBirthYear,
          }}
          description={
            activeCaseId !== null
              ? '当前已指定案例，可补充与问题直接相关的背景与细节。'
              : '临时档案不指定案例。可填写求测人性别、出生年份或背景细节，未填写的项目不会进入解读。'
          }
          onSave={(values) => {
            setSupplementaryInfoDraft(values.supplementaryInfo ?? '');
            if (activeCaseId === null) {
              setTemporaryGender((values.gender as '' | '男' | '女') || '');
              setTemporaryBirthYear(values.birthYear?.replace(/[^\d]/g, '').slice(0, 4) ?? '');
            }
          }}
          onClose={() => setIsSupplementaryInfoModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
