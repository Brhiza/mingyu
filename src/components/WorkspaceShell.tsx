import { useEffect, useMemo, useRef, useState, type UIEvent as ReactUIEvent } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AiSettingsModal } from '@/components/AiSettingsModal';
import { WorkspaceSettingsModal } from '@/components/WorkspaceSettingsModal';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import { useAiSettings } from '@/hooks/useAiSettings';
import {
  HISTORY_RECORDS_EVENT,
  loadDivinationHistory,
  selectPersonalCasesForQuickSwitch,
  type PersonalHistoryRecord,
} from '@/lib/history-records';
import {
  buildChartFeaturePathForCase,
  buildDivinationRecordPath,
  CHART_RECORD_PARAM,
} from '@/lib/case-navigation';
import { parseInputState, parsePromptState } from '@/lib/query-state';
import {
  WORKSPACE_FEATURE_GROUPS,
  WORKSPACE_PREFERENCES_EVENT,
  buildWorkspaceFeaturePath,
  getWorkspaceFeature,
  isChartWorkspaceId,
  isDivinationWorkspaceId,
  readWorkspacePreferences,
  saveWorkspacePreferences,
  type WorkspaceFeatureId,
} from '@/lib/workspace';
import { isInstantChartType } from '@/lib/instant-chart';

type SidebarView = 'tools' | 'history';

function resolveResultFeature(search: string): WorkspaceFeatureId {
  const params = new URLSearchParams(search);
  const input = parseInputState(params);
  const prompt = parsePromptState(params);
  return input.analysisMode === 'compatibility' ? 'compatibility' : prompt.promptSource;
}

function resolveActiveFeature(pathname: string, search: string): WorkspaceFeatureId | null {
  const chartMatch = /^\/chart\/([^/]+)$/.exec(pathname);
  if (chartMatch && isChartWorkspaceId(chartMatch[1])) return chartMatch[1];
  const divinationMatch = /^\/divination\/([^/]+)/.exec(pathname);
  if (divinationMatch && isDivinationWorkspaceId(divinationMatch[1])) return divinationMatch[1];
  return pathname === '/result' || pathname === '/result/assistant'
    ? resolveResultFeature(search)
    : null;
}

function resolvePageTitle(pathname: string, activeFeature: WorkspaceFeatureId | null) {
  if (pathname === '/cases') return '案例';
  if (pathname === '/records') return '历史记录';
  if (pathname === '/tutorial') return '使用说明';
  if (!activeFeature) return '命语';
  const feature = getWorkspaceFeature(activeFeature);
  if (pathname === '/result/assistant') return `${feature.shortLabel}解读`;
  if (pathname.endsWith('/result/assistant')) return `${feature.shortLabel}解读`;
  return pathname === '/result' || pathname.endsWith('/result')
    ? `${feature.label}结果`
    : feature.label;
}

function buildResultPagePath(search: string) {
  const params = new URLSearchParams(search);
  const input = parseInputState(params);
  const prompt = parsePromptState(params);
  const returnTab = params.get('rt');
  const chartTab =
    returnTab && ['bazi', 'ziwei', 'astrolabe', 'qizheng', 'bazhai'].includes(returnTab)
      ? returnTab
      : input.analysisMode === 'compatibility' || prompt.promptSource === 'bazi-ziwei'
        ? 'bazi'
        : prompt.promptSource;
  params.delete('tab');
  params.delete('rt');
  params.set('t', chartTab);
  return `/result?${params.toString()}`;
}

function formatCaseDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(date);
}

export function WorkspaceShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [preferences, setPreferences] = useState(readWorkspacePreferences);
  const [aiSettings, setAiSettings] = useAiSettings();
  const [sidebarView, setSidebarView] = useState<SidebarView>(() => {
    if (new URLSearchParams(location.search).get('tab') === 'divination') return 'history';
    return 'tools';
  });
  const [historySearch, setHistorySearch] = useState('');
  const [isMoreDivinationOpen, setIsMoreDivinationOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [settingsModal, setSettingsModal] = useState<'workspace' | 'ai' | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const { cases, activeCase, activeCaseId, selectCase } = useActivePersonalCase();
  const activeCaseTabRef = useRef<HTMLButtonElement>(null);
  const syncedChartRecordIdRef = useRef<string | null>(null);
  const scrollHideTimersRef = useRef(new Map<HTMLElement, number>());
  const activeFeature = resolveActiveFeature(location.pathname, location.search);
  const routeSearchParams = new URLSearchParams(location.search);
  const activeDivinationRecordId = routeSearchParams.get('record');
  const chartRecordId = routeSearchParams.get(CHART_RECORD_PARAM);
  const isHomeRoute = location.pathname === '/' || location.pathname === '/home';
  const isResultRoute =
    location.pathname === '/result' || /^\/divination\/[^/]+\/result$/.test(location.pathname);
  const isResultAssistant =
    location.pathname === '/result/assistant' ||
    /^\/divination\/[^/]+\/result\/assistant$/.test(location.pathname);
  const assistantReturnPath =
    location.pathname === '/result/assistant'
      ? buildResultPagePath(location.search)
      : `${location.pathname.replace(/\/assistant$/, '')}${location.search}`;
  const instantResultType = routeSearchParams.get('instant');
  const isInstantResult = location.pathname === '/result' && isInstantChartType(instantResultType);
  const pageTitle =
    isInstantResult && activeFeature
      ? `${getWorkspaceFeature(activeFeature).shortLabel}即时盘`
      : resolvePageTitle(location.pathname, activeFeature);
  const orderedFeatures = useMemo(
    () => preferences.navigationOrder.map(getWorkspaceFeature),
    [preferences.navigationOrder],
  );
  const histories = useMemo(() => {
    void historyRevision;
    return loadDivinationHistory();
  }, [historyRevision]);
  const quickSwitchCases = useMemo(
    () => selectPersonalCasesForQuickSwitch(cases, activeCaseId),
    [activeCaseId, cases],
  );
  const visibleHistories = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();
    return histories.filter((record) => {
      const feature = getWorkspaceFeature(record.requestedMethod);
      return `${record.question} ${feature.label} ${record.caseName ?? ''}`
        .toLowerCase()
        .includes(keyword);
    });
  }, [histories, historySearch]);

  useEffect(() => {
    setIsDrawerOpen(false);
    if (location.pathname === '/cases') {
      setSidebarView('tools');
    }
    if (location.pathname === '/records') {
      setSidebarView(
        new URLSearchParams(location.search).get('tab') === 'divination' ? 'history' : 'tools',
      );
    }
  }, [location.pathname, location.search]);

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
    const syncHistory = () => setHistoryRevision((current) => current + 1);
    window.addEventListener(HISTORY_RECORDS_EVENT, syncHistory);
    return () => window.removeEventListener(HISTORY_RECORDS_EVENT, syncHistory);
  }, []);

  useEffect(
    () => () => {
      scrollHideTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      scrollHideTimersRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    activeCaseTabRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeCaseId]);

  useEffect(() => {
    if (!chartRecordId) {
      syncedChartRecordIdRef.current = null;
      return;
    }
    if (syncedChartRecordIdRef.current === chartRecordId) return;
    if (chartRecordId !== activeCaseId && cases.some((record) => record.id === chartRecordId)) {
      syncedChartRecordIdRef.current = chartRecordId;
      selectCase(chartRecordId);
      return;
    }
    if (chartRecordId === activeCaseId) syncedChartRecordIdRef.current = chartRecordId;
  }, [activeCaseId, cases, chartRecordId, selectCase]);

  function activateCase(record: PersonalHistoryRecord | null) {
    selectCase(record?.id ?? null);
    if (activeFeature && isChartWorkspaceId(activeFeature)) {
      navigate(
        record
          ? buildChartFeaturePathForCase(record, activeFeature)
          : buildWorkspaceFeaturePath(activeFeature),
      );
    }
    setIsDrawerOpen(false);
  }

  function createCase() {
    selectCase(null);
    navigate('/cases?new=1');
    setIsDrawerOpen(false);
  }

  function handleWorkspaceScroll(event: ReactUIEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    target.classList.add('is-workspace-scrolling');
    const currentTimer = scrollHideTimersRef.current.get(target);
    if (currentTimer !== undefined) window.clearTimeout(currentTimer);
    const nextTimer = window.setTimeout(() => {
      target.classList.remove('is-workspace-scrolling');
      scrollHideTimersRef.current.delete(target);
    }, 700);
    scrollHideTimersRef.current.set(target, nextTimer);
  }

  const navigation = (
    <>
      <div className="workspace-brand-row">
        <button type="button" className="workspace-brand" onClick={() => navigate('/')}>
          <span className="workspace-brand-seal" aria-hidden="true">
            命
          </span>
          <span>
            <strong>命语</strong>
          </span>
        </button>
        <button
          type="button"
          className="workspace-drawer-close"
          onClick={() => setIsDrawerOpen(false)}
          aria-label="关闭侧栏"
        >
          ×
        </button>
      </div>

      <div className="workspace-sidebar-switch" role="tablist" aria-label="侧栏内容">
        <button
          type="button"
          role="tab"
          aria-selected={sidebarView === 'tools'}
          className={sidebarView === 'tools' ? 'is-active' : ''}
          onClick={() => setSidebarView('tools')}
        >
          工具
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={sidebarView === 'history'}
          className={sidebarView === 'history' ? 'is-active' : ''}
          onClick={() => setSidebarView('history')}
        >
          历史
        </button>
      </div>

      {sidebarView === 'tools' ? (
        <nav className="workspace-tool-sections" aria-label="排盘与占问工具">
          <div className="workspace-nav-list workspace-home-nav-list">
            <button
              type="button"
              className={isHomeRoute ? 'is-active' : ''}
              onClick={() => navigate('/')}
              aria-current={isHomeRoute ? 'page' : undefined}
            >
              <span className="workspace-nav-mark" aria-hidden="true">
                首
              </span>
              <span className="workspace-nav-copy">
                <strong>首页</strong>
              </span>
            </button>
          </div>
          {WORKSPACE_FEATURE_GROUPS.map((group) => {
            const features = orderedFeatures.filter((feature) => feature.group === group.id);
            const visibleFeatures =
              group.id === 'divination' && !isMoreDivinationOpen ? features.slice(0, 5) : features;
            return (
              <section className="workspace-tool-section" key={group.id}>
                <div className="workspace-nav-label">{group.label}</div>
                <div className="workspace-nav-list">
                  {visibleFeatures.map((feature) => (
                    <button
                      type="button"
                      key={feature.id}
                      className={activeFeature === feature.id ? 'is-active' : ''}
                      onClick={() => {
                        setSidebarView('tools');
                        const targetPath =
                          isChartWorkspaceId(feature.id) && activeCase
                            ? buildChartFeaturePathForCase(activeCase, feature.id)
                            : buildWorkspaceFeaturePath(feature.id);
                        if (targetPath !== `${location.pathname}${location.search}`) {
                          navigate(targetPath, { state: { workspaceNew: true } });
                        }
                      }}
                      aria-current={activeFeature === feature.id ? 'page' : undefined}
                    >
                      <span
                        className={`workspace-nav-mark workspace-nav-mark-${feature.group}`}
                        aria-hidden="true"
                      >
                        {feature.mark}
                      </span>
                      <span className="workspace-nav-copy">
                        <strong>{feature.label}</strong>
                      </span>
                    </button>
                  ))}
                  {group.id === 'divination' && features.length > 5 ? (
                    <button
                      type="button"
                      className="workspace-more-tools"
                      onClick={() => setIsMoreDivinationOpen((value) => !value)}
                    >
                      <span className="workspace-more-tools-mark" aria-hidden="true">
                        {isMoreDivinationOpen ? '−' : '＋'}
                      </span>
                      <span>
                        {isMoreDivinationOpen
                          ? '收起其他占问'
                          : `更多占问（${features.length - 5}）`}
                      </span>
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </nav>
      ) : (
        <section className="workspace-case-browser" aria-label="占问历史">
          <div className="workspace-case-tools">
            <input
              type="search"
              value={historySearch}
              placeholder="搜索历史"
              aria-label="搜索占问历史"
              onChange={(event) => setHistorySearch(event.target.value)}
            />
          </div>
          <div className="workspace-case-list">
            {visibleHistories.length ? (
              visibleHistories.map((record) => {
                const feature = getWorkspaceFeature(record.requestedMethod);
                return (
                  <button
                    type="button"
                    key={record.id}
                    className={activeDivinationRecordId === record.id ? 'is-active' : ''}
                    onClick={() => navigate(buildDivinationRecordPath(record))}
                    aria-current={activeDivinationRecordId === record.id ? 'page' : undefined}
                  >
                    <span className="workspace-case-mark" aria-hidden="true">
                      问
                    </span>
                    <span>
                      <strong>{record.question || feature.label}</strong>
                      <small>
                        {feature.label} · {record.caseName ?? '未指定'} ·{' '}
                        {formatCaseDate(record.updatedAt)}
                      </small>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="workspace-case-empty">
                <strong>{histories.length ? '没有匹配的历史' : '还没有占问历史'}</strong>
                <small>{histories.length ? '换个关键词试试' : '完成占问后会自动记录'}</small>
              </div>
            )}
          </div>
          <button
            type="button"
            className={`workspace-manage-cases${location.pathname === '/records' ? ' is-active' : ''}`}
            onClick={() => navigate('/records?tab=divination')}
          >
            管理历史
          </button>
        </section>
      )}

      <div className="workspace-sidebar-footer">
        <button
          type="button"
          className={location.pathname === '/tutorial' ? 'is-active' : ''}
          onClick={() => navigate('/tutorial')}
        >
          使用说明
        </button>
        <button
          type="button"
          onClick={() => {
            setIsDrawerOpen(false);
            setSettingsModal('workspace');
          }}
        >
          设置
        </button>
      </div>
    </>
  );

  return (
    <div className="workspace-shell" onScrollCapture={handleWorkspaceScroll}>
      <aside className="workspace-sidebar">{navigation}</aside>
      <header className="workspace-mobile-header">
        {isResultAssistant ? (
          <button
            type="button"
            className="workspace-mobile-back"
            onClick={() => navigate(assistantReturnPath)}
            aria-label="返回盘面"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="workspace-mobile-menu"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="打开侧栏"
          >
            <span />
            <span />
            <span />
          </button>
        )}
        <strong>{pageTitle}</strong>
        {location.pathname === '/cases' ? (
          <button
            type="button"
            className="workspace-mobile-header-action"
            onClick={() => navigate('/cases?new=1')}
          >
            新建
          </button>
        ) : (
          <span className="workspace-mobile-header-spacer" aria-hidden="true" />
        )}
      </header>

      {isDrawerOpen ? (
        <div className="workspace-drawer-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <aside className="workspace-mobile-drawer" onClick={(event) => event.stopPropagation()}>
            {navigation}
          </aside>
        </div>
      ) : null}

      <main
        className={`workspace-main${isHomeRoute ? ' is-home' : ''}${
          isResultRoute ? ' is-result' : ''
        }${isResultAssistant ? ' is-result-assistant' : ''}`}
      >
        {!isHomeRoute &&
        !isInstantResult &&
        !isResultAssistant &&
        location.pathname !== '/cases' ? (
          <nav className="workspace-case-tabbar" aria-label="案例档案">
            <div className="workspace-case-tabs" role="tablist" aria-label="快速切换案例">
              <button
                ref={activeCaseId === null ? activeCaseTabRef : undefined}
                type="button"
                role="tab"
                className={`workspace-case-tab workspace-case-tab-temporary${
                  activeCaseId === null ? ' is-active' : ''
                }`}
                aria-selected={activeCaseId === null}
                onClick={() => activateCase(null)}
              >
                <span className="workspace-case-tab-icon" aria-hidden="true">
                  临
                </span>
                <span className="workspace-case-tab-copy">
                  <strong>临时档案</strong>
                  <small>不指定案例</small>
                </span>
              </button>
              {quickSwitchCases.map((record) => {
                const isActive = activeCaseId === record.id;
                return (
                  <button
                    ref={isActive ? activeCaseTabRef : undefined}
                    type="button"
                    role="tab"
                    key={record.id}
                    className={`workspace-case-tab${isActive ? ' is-active' : ''}`}
                    aria-selected={isActive}
                    aria-label={`${record.name}，${record.birthText}${record.pinned ? '，已置顶' : ''}`}
                    title={`${record.name} · ${record.birthText}`}
                    onClick={() => activateCase(record)}
                  >
                    <span className="workspace-case-tab-icon" aria-hidden="true">
                      档
                    </span>
                    <span className="workspace-case-tab-copy">
                      <strong>{record.name}</strong>
                      <small>{record.birthText}</small>
                    </span>
                    {record.pinned ? (
                      <span className="workspace-case-tab-pin" aria-hidden="true">
                        ★
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            <div className="workspace-case-tab-actions">
              <button
                type="button"
                className="workspace-case-tab-new"
                onClick={createCase}
                aria-label="新建案例"
                title="新建案例"
              >
                ＋
              </button>
              <button
                type="button"
                className="workspace-case-tab-manage"
                onClick={() => navigate('/cases')}
                aria-label="全部案例"
                title="全部案例"
              >
                <span aria-hidden="true">▤</span>
                <span className="workspace-case-tab-manage-text">全部案例</span>
              </button>
            </div>
          </nav>
        ) : null}
        <div className="workspace-page">
          <Outlet />
        </div>
      </main>

      {settingsModal === 'workspace' ? (
        <WorkspaceSettingsModal
          preferences={preferences}
          onApply={(next) => setPreferences(saveWorkspacePreferences(next))}
          onOpenAiSettings={() => setSettingsModal('ai')}
          onClose={() => setSettingsModal(null)}
        />
      ) : null}
      {settingsModal === 'ai' ? (
        <AiSettingsModal
          settings={aiSettings}
          onApply={setAiSettings}
          onClose={() => setSettingsModal(null)}
        />
      ) : null}
    </div>
  );
}
