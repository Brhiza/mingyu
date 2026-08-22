import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AiSettingsModal } from '@/components/AiSettingsModal';
import { WorkspaceSettingsModal } from '@/components/WorkspaceSettingsModal';
import { useAiSettings } from '@/hooks/useAiSettings';
import {
  HISTORY_RECORDS_EVENT,
  loadCompatibilityHistory,
  loadDivinationHistory,
  loadPersonalHistory,
} from '@/lib/history-records';
import {
  buildResultSearch,
  defaultPromptState,
  hasCompletePreciseBirthData,
  parseInputState,
  parsePromptState,
  type PromptSourceKey,
  type ResultTabKey,
} from '@/lib/query-state';
import {
  WORKSPACE_FEATURE_GROUPS,
  WORKSPACE_PREFERENCES_EVENT,
  buildWorkspaceFeaturePath,
  getWorkspaceFeature,
  isChartWorkspaceId,
  isDivinationWorkspaceId,
  readWorkspacePreferences,
  resolvePersonalWorkspaceSource,
  saveWorkspacePreferences,
  type WorkspaceFeatureId,
} from '@/lib/workspace';

type SidebarView = 'tools' | 'cases';
type CaseFilter = 'all' | 'chart' | 'divination';

type SidebarCase = {
  id: string;
  title: string;
  meta: string;
  searchText: string;
  path: string;
  category: Exclude<CaseFilter, 'all'>;
  pinned: boolean;
  updatedAt: string;
};

function resolveResultFeature(search: string): WorkspaceFeatureId {
  const params = new URLSearchParams(search);
  const input = parseInputState(params);
  const prompt = parsePromptState(params);
  if (input.analysisMode === 'compatibility') {
    return 'compatibility';
  }
  return prompt.promptSource;
}

function resolveActiveFeature(pathname: string, search: string): WorkspaceFeatureId | null {
  const chartMatch = /^\/chart\/([^/]+)$/.exec(pathname);
  if (chartMatch && isChartWorkspaceId(chartMatch[1])) {
    return chartMatch[1];
  }

  const divinationMatch = /^\/divination\/([^/]+)/.exec(pathname);
  if (divinationMatch && isDivinationWorkspaceId(divinationMatch[1])) {
    return divinationMatch[1];
  }

  return pathname === '/result' ? resolveResultFeature(search) : null;
}

function resolvePageCopy(pathname: string, activeFeature: WorkspaceFeatureId | null) {
  if (pathname === '/records') {
    return { title: '管理案例', description: '整理、置顶或删除保存在当前浏览器中的记录。' };
  }
  if (pathname === '/tutorial') {
    return { title: '使用说明', description: '了解录入、排盘与解读的使用方式。' };
  }
  if (!activeFeature) {
    return { title: '命语', description: '选择一个工具开始。' };
  }
  const feature = getWorkspaceFeature(activeFeature);
  const isResult = pathname === '/result' || pathname.endsWith('/result');
  return {
    title: isResult ? `${feature.label}结果` : feature.label,
    description: isResult ? '完整盘面与解读分开查看。' : feature.description,
  };
}

function resolvePersonalCaseSource(record: ReturnType<typeof loadPersonalHistory>[number]) {
  const source: PromptSourceKey = resolvePersonalWorkspaceSource(
    record.input.chartType,
    record.workspaceSource,
  );
  if (
    (source === 'astrolabe' || source === 'qizheng') &&
    !hasCompletePreciseBirthData(record.input)
  ) {
    return 'bazi' as const;
  }
  return source;
}

function buildPersonalCasePath(record: ReturnType<typeof loadPersonalHistory>[number]) {
  const source = resolvePersonalCaseSource(record);
  const tab: ResultTabKey =
    source === 'qizheng'
      ? 'qizheng'
      : source === 'bazhai'
        ? 'bazhai'
        : source === 'ziwei'
          ? 'ziwei'
          : source === 'astrolabe'
            ? 'astrolabe'
            : 'bazi';
  return `/result?${buildResultSearch(record.input, {
    ...defaultPromptState,
    tab,
    promptSource: source,
  })}`;
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
  const [sidebarView, setSidebarView] = useState<SidebarView>(() =>
    location.pathname === '/records' ? 'cases' : 'tools',
  );
  const [caseFilter, setCaseFilter] = useState<CaseFilter>('all');
  const [caseSearch, setCaseSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [settingsModal, setSettingsModal] = useState<'workspace' | 'ai' | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const activeFeature = resolveActiveFeature(location.pathname, location.search);
  const pageCopy = resolvePageCopy(location.pathname, activeFeature);
  const pageKind =
    location.pathname === '/records'
      ? '案例'
      : location.pathname === '/tutorial'
        ? '帮助'
        : activeFeature && isDivinationWorkspaceId(activeFeature)
          ? '占问'
          : '排盘';
  const orderedFeatures = useMemo(
    () => preferences.navigationOrder.map(getWorkspaceFeature),
    [preferences.navigationOrder],
  );
  const cases = useMemo<SidebarCase[]>(() => {
    void historyRevision;
    const personal = loadPersonalHistory().map((record) => {
      const feature = getWorkspaceFeature(resolvePersonalCaseSource(record));
      return {
        id: `personal-${record.id}`,
        title: record.name,
        meta: `${feature.label} · ${record.birthText}`,
        searchText: `${record.name} ${feature.label} ${record.birthText}`,
        path: buildPersonalCasePath(record),
        category: 'chart' as const,
        pinned: Boolean(record.pinned),
        updatedAt: record.updatedAt,
      };
    });
    const compatibility = loadCompatibilityHistory().map((record) => ({
      id: `compatibility-${record.id}`,
      title: record.name,
      meta: '双人合盘',
      searchText: `${record.name} 双人合盘 ${record.primaryName} ${record.partnerName}`,
      path: `/result?${buildResultSearch(record.input, {
        ...defaultPromptState,
        tab: 'bazi',
        promptSource: 'bazi',
        baziShortcutMode: '合婚',
        baziPresetId: 'ai-compat-marriage',
      })}`,
      category: 'chart' as const,
      pinned: Boolean(record.pinned),
      updatedAt: record.updatedAt,
    }));
    const divination = loadDivinationHistory().map((record) => {
      const feature = getWorkspaceFeature(record.requestedMethod);
      return {
        id: `divination-${record.id}`,
        title: record.question || feature.label,
        meta: `${feature.label} · ${formatCaseDate(record.updatedAt)}`,
        searchText: `${record.question} ${feature.label}`,
        path: `/divination/${record.requestedMethod}/result?record=${encodeURIComponent(record.id)}`,
        category: 'divination' as const,
        pinned: false,
        updatedAt: record.updatedAt,
      };
    });

    return [...personal, ...compatibility, ...divination].sort((left, right) => {
      if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  }, [historyRevision]);
  const visibleCases = useMemo(() => {
    const keyword = caseSearch.trim().toLowerCase();
    return cases.filter(
      (record) =>
        (caseFilter === 'all' || record.category === caseFilter) &&
        (!keyword || record.searchText.toLowerCase().includes(keyword)),
    );
  }, [caseFilter, caseSearch, cases]);

  useEffect(() => {
    setIsDrawerOpen(false);
    if (location.pathname === '/records') {
      setSidebarView('cases');
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    function syncPreferences() {
      setPreferences(readWorkspacePreferences());
    }
    window.addEventListener('storage', syncPreferences);
    window.addEventListener(WORKSPACE_PREFERENCES_EVENT, syncPreferences);
    return () => {
      window.removeEventListener('storage', syncPreferences);
      window.removeEventListener(WORKSPACE_PREFERENCES_EVENT, syncPreferences);
    };
  }, []);

  useEffect(() => {
    function syncHistory() {
      setHistoryRevision((current) => current + 1);
    }
    window.addEventListener(HISTORY_RECORDS_EVENT, syncHistory);
    return () => window.removeEventListener(HISTORY_RECORDS_EVENT, syncHistory);
  }, []);

  const startNew = (path: string) => navigate(path, { state: { workspaceNew: true } });
  const openWorkspaceSettings = () => {
    setIsDrawerOpen(false);
    setSettingsModal('workspace');
  };
  const openCase = (path: string) => {
    setSidebarView('cases');
    navigate(path);
  };

  const navigation = (
    <>
      <div className="workspace-brand-row">
        <button type="button" className="workspace-brand" onClick={() => navigate('/')}>
          <span className="workspace-brand-seal" aria-hidden="true">
            命
          </span>
          <span>
            <strong>命语</strong>
            <small>排盘与占问</small>
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
          aria-selected={sidebarView === 'cases'}
          className={sidebarView === 'cases' ? 'is-active' : ''}
          onClick={() => setSidebarView('cases')}
        >
          案例
          {cases.length ? <span>{cases.length}</span> : null}
        </button>
      </div>

      {sidebarView === 'tools' ? (
        <nav className="workspace-tool-sections" aria-label="排盘与占问工具">
          {WORKSPACE_FEATURE_GROUPS.map((group) => {
            const features = orderedFeatures.filter((feature) => feature.group === group.id);
            return (
              <section className="workspace-tool-section" key={group.id}>
                <div className="workspace-nav-label">{group.label}</div>
                <div className="workspace-nav-list">
                  {features.map((feature) => (
                    <button
                      type="button"
                      key={feature.id}
                      className={activeFeature === feature.id ? 'is-active' : ''}
                      onClick={() => {
                        setSidebarView('tools');
                        startNew(buildWorkspaceFeaturePath(feature.id));
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
                        <small>{feature.description}</small>
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </nav>
      ) : (
        <section className="workspace-case-browser" aria-label="案例">
          <div className="workspace-case-tools">
            <input
              type="search"
              value={caseSearch}
              placeholder="搜索姓名或问题"
              aria-label="搜索案例"
              onChange={(event) => setCaseSearch(event.target.value)}
            />
            <div className="workspace-case-filters">
              {[
                { value: 'all' as const, label: '全部' },
                { value: 'chart' as const, label: '排盘' },
                { value: 'divination' as const, label: '占问' },
              ].map((filter) => (
                <button
                  type="button"
                  key={filter.value}
                  className={caseFilter === filter.value ? 'is-active' : ''}
                  onClick={() => setCaseFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="workspace-case-list">
            {visibleCases.length ? (
              visibleCases.map((record) => {
                const isActive = `${location.pathname}${location.search}` === record.path;
                return (
                  <button
                    type="button"
                    key={record.id}
                    className={isActive ? 'is-active' : ''}
                    onClick={() => openCase(record.path)}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span className="workspace-case-mark" aria-hidden="true">
                      {record.category === 'divination' ? '问' : record.pinned ? '★' : '案'}
                    </span>
                    <span>
                      <strong>{record.title}</strong>
                      <small>{record.meta}</small>
                    </span>
                  </button>
                );
              })
            ) : (
              <div className="workspace-case-empty">
                <strong>{cases.length ? '没有匹配的案例' : '还没有案例'}</strong>
                <small>{cases.length ? '换个关键词试试' : '从“工具”中完成一次排盘或占问'}</small>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`workspace-manage-cases${location.pathname === '/records' ? ' is-active' : ''}`}
            onClick={() => navigate('/records')}
          >
            管理案例
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
        <button type="button" onClick={openWorkspaceSettings}>
          设置
        </button>
      </div>
    </>
  );

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">{navigation}</aside>

      <header className="workspace-mobile-header">
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
        <strong>{pageCopy.title}</strong>
        <span className="workspace-mobile-kind">{pageKind}</span>
      </header>

      {isDrawerOpen ? (
        <div className="workspace-drawer-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <aside className="workspace-mobile-drawer" onClick={(event) => event.stopPropagation()}>
            {navigation}
          </aside>
        </div>
      ) : null}

      <main className="workspace-main">
        <header className="workspace-context-header">
          <div>
            <span className="workspace-eyebrow">{pageKind}</span>
            <h1>{pageCopy.title}</h1>
          </div>
          <p>{pageCopy.description}</p>
        </header>
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
