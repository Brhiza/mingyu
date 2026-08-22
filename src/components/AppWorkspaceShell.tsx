import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AiSettingsModal } from '@/components/AiSettingsModal';
import { useAiSettings } from '@/hooks/useAiSettings';
import { useAppPreferences } from '@/hooks/useAppPreferences';
import {
  buildCompatibilityCaseResultPath,
  buildPersonalCaseResultPath,
} from '@/lib/case-navigation';
import { hasCompletePreciseBirthData, parsePromptState } from '@/lib/query-state';
import {
  buildWorkspaceEntryPath,
  buildWorkspaceHomePath,
  getWorkspaceNavigationItem,
  isWorkspaceEntryId,
  type WorkspaceEntryId,
} from '@/lib/workspace-navigation';
import {
  getDivinationHistoryById,
  HISTORY_RECORDS_CHANGED_EVENT,
  loadCompatibilityHistory,
  loadDivinationHistory,
  loadPersonalHistory,
  markCompatibilityHistoryUsed,
  markPersonalHistoryUsed,
  type CompatibilityHistoryRecord,
  type PersonalHistoryRecord,
} from '@/lib/history-records';

type AppWorkspaceShellProps = {
  children: ReactNode;
};

type SidebarDestination = {
  key: string;
  label: string;
  mark: string;
  to: string;
  matches: (pathname: string, params: URLSearchParams) => boolean;
  badge?: number;
};

type SidebarCase =
  | { kind: 'personal'; record: PersonalHistoryRecord }
  | { kind: 'compatibility'; record: CompatibilityHistoryRecord };

function getEntryMode(params: URLSearchParams, fallback = 'single') {
  return params.get('mode') || fallback;
}

function formatCaseDate(record: SidebarCase) {
  if (record.kind === 'personal') {
    return record.record.birthText;
  }
  return `${record.record.input.year}-${record.record.input.month}-${record.record.input.day}`;
}

function resolveActiveWorkspaceEntry(
  pathname: string,
  params: URLSearchParams,
  defaultDivinationEntry: string,
): WorkspaceEntryId | null {
  const resolveDivinationEntry = (value: unknown): WorkspaceEntryId | null => {
    if (!isWorkspaceEntryId(value)) return null;
    return getWorkspaceNavigationItem(value).kind === 'divination' ? value : null;
  };
  const fallbackDivinationEntry = resolveDivinationEntry(defaultDivinationEntry) || 'random';
  if (pathname === '/divination' || pathname === '/divination/result') {
    const record = params.get('record')
      ? getDivinationHistoryById(params.get('record')!)
      : undefined;
    const method = record?.draft.method || params.get('method') || fallbackDivinationEntry;
    return resolveDivinationEntry(method) || fallbackDivinationEntry;
  }

  if (pathname === '/result') {
    if (params.get('a') === 'compatibility') return 'compatibility';
    const promptState = parsePromptState(params);
    const source = promptState.tab === 'prompt' ? promptState.promptSource : promptState.tab;
    return isWorkspaceEntryId(source) ? source : 'bazi';
  }

  if (pathname !== '/') return null;
  const mode = getEntryMode(params);
  if (mode === 'compatibility') return 'compatibility';
  if (mode === 'almanac') return 'almanac';
  if (mode === 'divination') {
    const method = params.get('method') || fallbackDivinationEntry;
    return resolveDivinationEntry(method) || fallbackDivinationEntry;
  }
  const source = params.get('source') || 'bazi';
  return isWorkspaceEntryId(source) ? source : 'bazi';
}

export function AppWorkspaceShell({ children }: AppWorkspaceShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [aiSettingsModalOpen, setAiSettingsModalOpen] = useState(false);
  const [aiSettings, setAiSettings] = useAiSettings();
  const [appPreferences] = useAppPreferences();
  const [, setHistoryVersion] = useState(0);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const personalCases = loadPersonalHistory();
  const compatibilityCases = loadCompatibilityHistory();
  const divinationRecords = loadDivinationHistory();
  const sidebarCases: SidebarCase[] = [
    ...personalCases.map((record) => ({ kind: 'personal' as const, record })),
    ...compatibilityCases.map((record) => ({ kind: 'compatibility' as const, record })),
  ].sort(
    (left, right) =>
      new Date(right.record.updatedAt).getTime() - new Date(left.record.updatedAt).getTime(),
  );

  const caseCount = personalCases.length + compatibilityCases.length;
  const activeEntryMode = getEntryMode(params);
  const activeWorkspaceEntry = resolveActiveWorkspaceEntry(
    location.pathname,
    params,
    appPreferences.defaultDivinationMethod,
  );
  const orderedNavigationItems = appPreferences.navigationOrder.map(getWorkspaceNavigationItem);
  const requestedCaseId = params.get('case') || params.get('caseId');
  const requestedCaseKind =
    location.pathname === '/result' && params.get('a') === 'compatibility'
      ? 'compatibility'
      : activeEntryMode === 'compatibility'
        ? 'compatibility'
        : 'personal';
  const isBlankCaseEntry =
    location.pathname === '/' &&
    (activeEntryMode === 'single' || activeEntryMode === 'compatibility');
  const currentCase = requestedCaseId
    ? sidebarCases.find(
        (item) => item.record.id === requestedCaseId && item.kind === requestedCaseKind,
      )
    : undefined;

  function buildNavigationEntry(id: WorkspaceEntryId) {
    const item = getWorkspaceNavigationItem(id);
    if (appPreferences.caseEntry === 'recent') {
      if (item.kind === 'compatibility') {
        const record = compatibilityCases[0];
        if (record) return buildCompatibilityCaseResultPath(record);
      }
      if (item.kind === 'personal') {
        const record = personalCases[0];
        if (record && item.promptSource) {
          if (
            (item.promptSource === 'astrolabe' || item.promptSource === 'qizheng') &&
            !hasCompletePreciseBirthData(record.input)
          ) {
            const nextParams = new URLSearchParams({
              mode: 'single',
              source: item.promptSource,
              case: record.id,
            });
            return `/?${nextParams.toString()}`;
          }
          return buildPersonalCaseResultPath(record, item.promptSource);
        }
      }
    }
    return buildWorkspaceEntryPath(id, location.key);
  }

  function buildHomeEntry() {
    return appPreferences.home === 'unspecified'
      ? buildWorkspaceHomePath('unspecified', location.key)
      : buildNavigationEntry(appPreferences.home);
  }

  const destinations: SidebarDestination[] = [
    {
      key: 'cases',
      label: '案例库',
      mark: '案',
      to: '/records?tab=personal',
      matches: (pathname, search) => pathname === '/records' && search.get('tab') !== 'divination',
      badge: caseCount,
    },
    {
      key: 'records',
      label: '占卜记录',
      mark: '录',
      to: '/records?tab=divination',
      matches: (pathname, search) => pathname === '/records' && search.get('tab') === 'divination',
      badge: divinationRecords.length,
    },
  ];

  useEffect(() => {
    function refreshHistory() {
      setHistoryVersion((current) => current + 1);
    }

    window.addEventListener(HISTORY_RECORDS_CHANGED_EVENT, refreshHistory);
    window.addEventListener('storage', refreshHistory);
    return () => {
      window.removeEventListener(HISTORY_RECORDS_CHANGED_EVENT, refreshHistory);
      window.removeEventListener('storage', refreshHistory);
    };
  }, []);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileSidebarOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false);
      }
    }

    window.addEventListener('keydown', closeFromKeyboard);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeFromKeyboard);
    };
  }, [mobileSidebarOpen]);

  function go(to: string) {
    navigate(to);
    setMobileSidebarOpen(false);
  }

  function openSidebarCase(item: SidebarCase) {
    if (item.kind === 'personal') {
      markPersonalHistoryUsed(item.record.id);
    } else {
      markCompatibilityHistoryUsed(item.record.id);
    }
    go(
      item.kind === 'personal'
        ? buildPersonalCaseResultPath(item.record)
        : buildCompatibilityCaseResultPath(item.record),
    );
  }

  function createCase() {
    if (activeWorkspaceEntry) {
      const item = getWorkspaceNavigationItem(activeWorkspaceEntry);
      if (item.kind === 'personal' || item.kind === 'compatibility') {
        go(buildWorkspaceEntryPath(item.id, location.key));
        return;
      }
    }
    go(buildWorkspaceEntryPath('bazi', location.key));
  }

  function goHome() {
    go(buildHomeEntry());
  }

  function editCurrentCase() {
    if (!currentCase) return;
    const mode = currentCase.kind === 'personal' ? 'single' : 'compatibility';
    const nextParams = new URLSearchParams({ mode, case: currentCase.record.id });
    if (currentCase.kind === 'personal' && activeWorkspaceEntry) {
      const item = getWorkspaceNavigationItem(activeWorkspaceEntry);
      if (item.kind === 'personal' && item.promptSource) {
        nextParams.set('source', item.promptSource);
      }
    }
    go(`/?${nextParams.toString()}`);
  }

  function switchCase(value: string) {
    const item = sidebarCases.find(
      (candidate) => `${candidate.kind}:${candidate.record.id}` === value,
    );
    if (item) {
      openSidebarCase(item);
    }
  }

  return (
    <div className={`app-workspace-shell${mobileSidebarOpen ? ' is-sidebar-open' : ''}`}>
      <aside
        id="app-workspace-sidebar"
        className={`app-workspace-sidebar${mobileSidebarOpen ? ' is-open' : ''}`}
        aria-label="主导航"
      >
        <div className="app-sidebar-brand-row">
          <button className="app-sidebar-brand" type="button" onClick={goHome}>
            <span className="app-sidebar-brand-mark" aria-hidden="true">
              命
            </span>
            <span>
              <strong>命语</strong>
              <small>排盘与提示词</small>
            </span>
          </button>
          <button
            className="app-sidebar-close"
            type="button"
            aria-label="关闭侧栏"
            onClick={() => setMobileSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <nav className="app-sidebar-nav app-sidebar-nav-features" aria-label="全部功能">
          {orderedNavigationItems.map((item) => {
            const active = activeWorkspaceEntry === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? 'is-active' : ''}
                aria-current={active ? 'page' : undefined}
                onClick={() => go(buildNavigationEntry(item.id))}
              >
                <span className="app-sidebar-nav-mark" aria-hidden="true">
                  {item.mark}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="app-sidebar-divider" />

        <nav className="app-sidebar-nav app-sidebar-nav-library" aria-label="案例与记录">
          {destinations.map((item) => {
            const active = item.matches(location.pathname, params);
            return (
              <button
                key={item.key}
                type="button"
                className={active ? 'is-active' : ''}
                aria-current={active ? 'page' : undefined}
                onClick={() => go(item.to)}
              >
                <span className="app-sidebar-nav-mark" aria-hidden="true">
                  {item.mark}
                </span>
                <span>{item.label}</span>
                {item.badge ? <b className="app-sidebar-count">{item.badge}</b> : null}
              </button>
            );
          })}
        </nav>

        <section className="app-sidebar-cases" aria-labelledby="current-case-title">
          <div className="app-sidebar-section-head">
            <strong id="current-case-title">当前案例</strong>
            <button type="button" onClick={() => go('/records?tab=personal')}>
              管理
            </button>
          </div>
          {currentCase ? (
            <div className="app-sidebar-current-case">
              <span className="app-sidebar-case-avatar" aria-hidden="true">
                {currentCase.record.name.slice(0, 1)}
              </span>
              <span className="app-sidebar-case-copy">
                <strong>{currentCase.record.name}</strong>
                <small>
                  {currentCase.kind === 'compatibility' ? '合盘' : '个人'} ·{' '}
                  {formatCaseDate(currentCase)}
                </small>
              </span>
            </div>
          ) : (
            <div className="app-sidebar-current-case is-draft">
              <span className="app-sidebar-case-avatar" aria-hidden="true">
                新
              </span>
              <span className="app-sidebar-case-copy">
                <strong>{isBlankCaseEntry ? '新案例' : '未选择案例'}</strong>
                <small>{isBlankCaseEntry ? '正在录入空白资料' : '可从下方快速打开'}</small>
              </span>
            </div>
          )}

          {sidebarCases.length > 1 ? (
            <label className="app-sidebar-case-switcher">
              <span>切换案例</span>
              <select
                value={currentCase ? `${currentCase.kind}:${currentCase.record.id}` : ''}
                onChange={(event) => switchCase(event.target.value)}
              >
                <option value="">请选择案例</option>
                {sidebarCases.map((item) => (
                  <option
                    value={`${item.kind}:${item.record.id}`}
                    key={`${item.kind}-${item.record.id}`}
                  >
                    {item.record.name} · {item.kind === 'compatibility' ? '合盘' : '个人'}
                  </option>
                ))}
              </select>
            </label>
          ) : sidebarCases.length === 1 && !currentCase ? (
            <button
              className="app-sidebar-open-only-case"
              type="button"
              onClick={() => openSidebarCase(sidebarCases[0])}
            >
              查看 {sidebarCases[0].record.name} 的排盘
            </button>
          ) : null}

          {currentCase ? (
            <button className="app-sidebar-edit-case" type="button" onClick={editCurrentCase}>
              编辑资料
            </button>
          ) : null}

          <button className="app-sidebar-new-case" type="button" onClick={createCase}>
            ＋ 新建案例
          </button>
        </section>

        <button className="app-sidebar-tutorial" type="button" onClick={() => go('/tutorial')}>
          <span className="app-sidebar-nav-mark" aria-hidden="true">
            教
          </span>
          <span>使用教程</span>
        </button>
        <button
          className="app-sidebar-tutorial"
          type="button"
          onClick={() => {
            setMobileSidebarOpen(false);
            setAiSettingsModalOpen(true);
          }}
        >
          <span className="app-sidebar-nav-mark" aria-hidden="true">
            设
          </span>
          <span>设置</span>
        </button>
      </aside>

      {mobileSidebarOpen ? (
        <button
          className="app-sidebar-scrim"
          type="button"
          aria-label="关闭侧栏"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <div className="app-workspace-main">
        <header className="app-mobile-header">
          <button
            type="button"
            className="app-mobile-menu"
            aria-label="打开侧栏"
            aria-controls="app-workspace-sidebar"
            aria-expanded={mobileSidebarOpen}
            onClick={() => setMobileSidebarOpen(true)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <button type="button" className="app-mobile-brand" onClick={goHome}>
            <span className="app-mobile-brand-mark" aria-hidden="true">
              命
            </span>
            <strong>命语</strong>
          </button>
          <button
            type="button"
            className="app-mobile-case-entry"
            onClick={() => setMobileSidebarOpen(true)}
          >
            案例{caseCount ? ` ${caseCount}` : ''}
          </button>
        </header>
        {children}
      </div>
      {aiSettingsModalOpen ? (
        <AiSettingsModal
          settings={aiSettings}
          onApply={setAiSettings}
          onClose={() => setAiSettingsModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
