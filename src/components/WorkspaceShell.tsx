import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AiSettingsModal } from '@/components/AiSettingsModal';
import { WorkspaceSettingsModal } from '@/components/WorkspaceSettingsModal';
import { useAiSettings } from '@/hooks/useAiSettings';
import {
  HISTORY_RECORDS_EVENT,
  loadCompatibilityHistory,
  loadPersonalHistory,
} from '@/lib/history-records';
import {
  buildResultSearch,
  buildInputStateSearch,
  defaultPromptState,
  hasCompletePreciseBirthData,
  parseInputState,
  parsePromptState,
  type PromptSourceKey,
  type ResultTabKey,
} from '@/lib/query-state';
import {
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
    return { title: '案例库', description: '集中管理排盘、合盘与占问记录。' };
  }
  if (pathname === '/tutorial') {
    return { title: '使用说明', description: '查看从录入到排盘解读的完整流程。' };
  }
  if (!activeFeature) {
    return { title: '命语', description: '选择一个工具开始。' };
  }
  const feature = getWorkspaceFeature(activeFeature);
  const isResult = pathname === '/result' || pathname.endsWith('/result');
  return {
    title: isResult ? `${feature.label}结果` : feature.label,
    description: isResult
      ? '先查看完整盘面，再按需要生成提示词或使用 AI 解读。'
      : feature.description,
  };
}

function buildRecentPersonalPath(record: ReturnType<typeof loadPersonalHistory>[number]) {
  const source: PromptSourceKey = resolvePersonalWorkspaceSource(
    record.input.chartType,
    record.workspaceSource,
  );
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
  if (
    (source === 'astrolabe' || source === 'qizheng') &&
    !hasCompletePreciseBirthData(record.input)
  ) {
    return `/chart/${source}?${buildInputStateSearch(record.input)}`;
  }
  return `/result?${buildResultSearch(record.input, {
    ...defaultPromptState,
    tab,
    promptSource: source,
  })}`;
}

export function WorkspaceShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [preferences, setPreferences] = useState(readWorkspacePreferences);
  const [aiSettings, setAiSettings] = useAiSettings();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [settingsModal, setSettingsModal] = useState<'workspace' | 'ai' | null>(null);
  const [, setHistoryRevision] = useState(0);
  const activeFeature = resolveActiveFeature(location.pathname, location.search);
  const pageCopy = resolvePageCopy(location.pathname, activeFeature);
  const pageKind =
    location.pathname === '/records'
      ? '管理'
      : location.pathname === '/tutorial'
        ? '帮助'
        : activeFeature && isDivinationWorkspaceId(activeFeature)
          ? '占问'
          : '排盘';
  const orderedFeatures = useMemo(
    () => preferences.navigationOrder.map(getWorkspaceFeature),
    [preferences.navigationOrder],
  );
  const quickCases = (() => {
    const personal = loadPersonalHistory().map((record) => ({
      id: `personal-${record.id}`,
      label: record.name,
      meta: record.birthText,
      path: buildRecentPersonalPath(record),
      pinned: Boolean(record.pinned),
      updatedAt: record.updatedAt,
    }));
    const compatibility = loadCompatibilityHistory().map((record) => ({
      id: `compatibility-${record.id}`,
      label: record.name,
      meta: '双人合盘',
      path: `/result?${buildResultSearch(record.input, {
        ...defaultPromptState,
        tab: 'bazi',
        promptSource: 'bazi',
        baziShortcutMode: '合婚',
        baziPresetId: 'ai-compat-marriage',
      })}`,
      pinned: Boolean(record.pinned),
      updatedAt: record.updatedAt,
    }));
    return [...personal, ...compatibility]
      .sort(
        (left, right) =>
          Number(right.pinned) - Number(left.pinned) ||
          right.updatedAt.localeCompare(left.updatedAt),
      )
      .slice(0, 5);
  })();

  useEffect(() => {
    setIsDrawerOpen(false);
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

  const newPath = activeFeature
    ? buildWorkspaceFeaturePath(activeFeature)
    : buildWorkspaceFeaturePath(preferences.defaultFeature);
  const startNew = (path: string) => navigate(path, { state: { workspaceNew: true } });
  const openWorkspaceSettings = () => {
    setIsDrawerOpen(false);
    setSettingsModal('workspace');
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
            <small>排盘与占问工具</small>
          </span>
        </button>
        <button
          type="button"
          className="workspace-drawer-close"
          onClick={() => setIsDrawerOpen(false)}
          aria-label="关闭工具栏"
        >
          ×
        </button>
      </div>

      <div className="workspace-primary-actions">
        <button type="button" onClick={() => startNew(newPath)}>
          <span aria-hidden="true">＋</span>
          新建
        </button>
        <button
          type="button"
          className={location.pathname === '/records' ? 'is-active' : ''}
          onClick={() => navigate('/records')}
        >
          <span aria-hidden="true">案</span>
          案例库
        </button>
      </div>

      <div className="workspace-nav-label">全部工具</div>
      <nav className="workspace-nav-list" aria-label="排盘与占问工具">
        {orderedFeatures.map((feature) => (
          <button
            type="button"
            key={feature.id}
            className={activeFeature === feature.id ? 'is-active' : ''}
            onClick={() => startNew(buildWorkspaceFeaturePath(feature.id))}
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
              {activeFeature === feature.id ? <small>{feature.description}</small> : null}
            </span>
          </button>
        ))}
      </nav>

      {quickCases.length ? (
        <section className="workspace-recent-cases">
          <div className="workspace-nav-label">常用与最近</div>
          {quickCases.map((record) => (
            <button type="button" key={record.id} onClick={() => navigate(record.path)}>
              <span>
                {record.pinned ? '★ ' : ''}
                {record.label}
              </span>
              <small>{record.meta}</small>
            </button>
          ))}
        </section>
      ) : null}

      <div className="workspace-sidebar-footer">
        <button type="button" onClick={() => navigate('/tutorial')}>
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
          aria-label="打开工具栏"
        >
          <span />
          <span />
          <span />
        </button>
        <div>
          <strong>{pageCopy.title}</strong>
          <small>{activeFeature ? getWorkspaceFeature(activeFeature).shortLabel : '命语'}</small>
        </div>
        <button type="button" className="workspace-mobile-new" onClick={() => startNew(newPath)}>
          新建
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
        <header className="workspace-context-header">
          <div>
            <span className="workspace-eyebrow">{pageKind}</span>
            <h1>{pageCopy.title}</h1>
            <p>{pageCopy.description}</p>
          </div>
          <div className="workspace-context-actions">
            <button type="button" onClick={() => navigate('/records')}>
              案例库
            </button>
            <button type="button" className="is-primary" onClick={() => startNew(newPath)}>
              新建
            </button>
          </div>
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
