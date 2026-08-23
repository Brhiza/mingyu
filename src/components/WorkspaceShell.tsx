import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ActiveCaseSelect } from '@/components/ActiveCaseSelect';
import { AiSettingsModal } from '@/components/AiSettingsModal';
import { WorkspaceSettingsModal } from '@/components/WorkspaceSettingsModal';
import { useActivePersonalCase } from '@/hooks/useActivePersonalCase';
import { useAiSettings } from '@/hooks/useAiSettings';
import {
  HISTORY_RECORDS_EVENT,
  loadDivinationHistory,
  type PersonalHistoryRecord,
} from '@/lib/history-records';
import { buildChartFeaturePathForCase, buildDivinationRecordPath } from '@/lib/case-navigation';
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
  return pathname === '/result' ? resolveResultFeature(search) : null;
}

function resolvePageTitle(pathname: string, activeFeature: WorkspaceFeatureId | null) {
  if (pathname === '/cases') return '案例';
  if (pathname === '/records') return '历史记录';
  if (pathname === '/tutorial') return '使用说明';
  if (!activeFeature) return '命语';
  const feature = getWorkspaceFeature(activeFeature);
  return pathname === '/result' || pathname.endsWith('/result')
    ? `${feature.label}结果`
    : feature.label;
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
  const { activeCase } = useActivePersonalCase();
  const activeFeature = resolveActiveFeature(location.pathname, location.search);
  const activeDivinationRecordId = new URLSearchParams(location.search).get('record');
  const pageTitle = resolvePageTitle(location.pathname, activeFeature);
  const orderedFeatures = useMemo(
    () => preferences.navigationOrder.map(getWorkspaceFeature),
    [preferences.navigationOrder],
  );
  const histories = useMemo(() => {
    void historyRevision;
    return loadDivinationHistory();
  }, [historyRevision]);
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

  function navigateForSelectedCase(record: PersonalHistoryRecord | null) {
    if (activeFeature && isChartWorkspaceId(activeFeature)) {
      navigate(
        record
          ? buildChartFeaturePathForCase(record, activeFeature)
          : buildWorkspaceFeaturePath(activeFeature),
      );
    }
    setIsDrawerOpen(false);
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

      <ActiveCaseSelect
        className="workspace-global-case-select"
        label="案例"
        onSelect={navigateForSelectedCase}
        onManage={() => {
          navigate('/cases');
          setIsDrawerOpen(false);
        }}
      />

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
                        navigate(
                          isChartWorkspaceId(feature.id) && activeCase
                            ? buildChartFeaturePathForCase(activeCase, feature.id)
                            : buildWorkspaceFeaturePath(feature.id),
                          { state: { workspaceNew: true } },
                        );
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
        <strong>{pageTitle}</strong>
        <button
          type="button"
          className="workspace-mobile-case"
          onClick={() => {
            setIsDrawerOpen(true);
          }}
        >
          {activeCase?.name ?? '不指定'}
        </button>
      </header>

      {isDrawerOpen ? (
        <div className="workspace-drawer-backdrop" onClick={() => setIsDrawerOpen(false)}>
          <aside className="workspace-mobile-drawer" onClick={(event) => event.stopPropagation()}>
            {navigation}
          </aside>
        </div>
      ) : null}

      <main className="workspace-main">
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
