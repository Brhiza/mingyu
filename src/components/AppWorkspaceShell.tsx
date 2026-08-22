import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HISTORY_RECORDS_CHANGED_EVENT,
  loadCompatibilityHistory,
  loadDivinationHistory,
  loadPersonalHistory,
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

type RecentCase =
  | { kind: 'personal'; record: PersonalHistoryRecord }
  | { kind: 'compatibility'; record: CompatibilityHistoryRecord };

function getEntryMode(params: URLSearchParams) {
  return params.get('mode') || 'single';
}

function formatCaseDate(record: RecentCase) {
  if (record.kind === 'personal') {
    return record.record.birthText;
  }
  return `${record.record.input.year}-${record.record.input.month}-${record.record.input.day}`;
}

export function AppWorkspaceShell({ children }: AppWorkspaceShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [, setHistoryVersion] = useState(0);
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const personalCases = loadPersonalHistory();
  const compatibilityCases = loadCompatibilityHistory();
  const divinationRecords = loadDivinationHistory();
  const recentCases: RecentCase[] = [
    ...personalCases.map((record) => ({ kind: 'personal' as const, record })),
    ...compatibilityCases.map((record) => ({ kind: 'compatibility' as const, record })),
  ]
    .sort(
      (left, right) =>
        new Date(right.record.updatedAt).getTime() - new Date(left.record.updatedAt).getTime(),
    )
    .slice(0, 5);

  const caseCount = personalCases.length + compatibilityCases.length;
  const destinations: SidebarDestination[] = [
    {
      key: 'single',
      label: '个人排盘',
      mark: '命',
      to: '/?mode=single',
      matches: (pathname, search) =>
        (pathname === '/' && getEntryMode(search) === 'single') ||
        (pathname === '/result' && search.get('a') !== 'compatibility'),
    },
    {
      key: 'compatibility',
      label: '合盘',
      mark: '合',
      to: '/?mode=compatibility',
      matches: (pathname, search) =>
        (pathname === '/' && getEntryMode(search) === 'compatibility') ||
        (pathname === '/result' && search.get('a') === 'compatibility'),
    },
    {
      key: 'divination',
      label: '占卜',
      mark: '卜',
      to: '/?mode=divination',
      matches: (pathname, search) => pathname === '/' && getEntryMode(search) === 'divination',
    },
    {
      key: 'almanac',
      label: '择日',
      mark: '日',
      to: '/?mode=almanac',
      matches: (pathname, search) => pathname === '/' && getEntryMode(search) === 'almanac',
    },
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

  function openRecentCase(item: RecentCase) {
    const mode = item.kind === 'personal' ? 'single' : 'compatibility';
    go(`/?mode=${mode}&case=${encodeURIComponent(item.record.id)}`);
  }

  function createCase() {
    go(`/?mode=single&draft=${Date.now()}`);
  }

  return (
    <div className={`app-workspace-shell${mobileSidebarOpen ? ' is-sidebar-open' : ''}`}>
      <aside
        id="app-workspace-sidebar"
        className={`app-workspace-sidebar${mobileSidebarOpen ? ' is-open' : ''}`}
        aria-label="主导航"
      >
        <div className="app-sidebar-brand-row">
          <button className="app-sidebar-brand" type="button" onClick={() => go('/?mode=single')}>
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

        <nav className="app-sidebar-nav" aria-label="主要功能">
          {destinations.slice(0, 4).map((item) => {
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
              </button>
            );
          })}
        </nav>

        <div className="app-sidebar-divider" />

        <nav className="app-sidebar-nav app-sidebar-nav-library" aria-label="案例与记录">
          {destinations.slice(4).map((item) => {
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

        <section className="app-sidebar-cases" aria-labelledby="recent-cases-title">
          <div className="app-sidebar-section-head">
            <strong id="recent-cases-title">最近案例</strong>
            <button type="button" onClick={createCase}>
              新建
            </button>
          </div>
          {recentCases.length ? (
            <div className="app-sidebar-case-list">
              {recentCases.map((item) => (
                <button
                  key={`${item.kind}-${item.record.id}`}
                  type="button"
                  onClick={() => openRecentCase(item)}
                >
                  <span className="app-sidebar-case-avatar" aria-hidden="true">
                    {item.record.name.slice(0, 1)}
                  </span>
                  <span className="app-sidebar-case-copy">
                    <strong>{item.record.name}</strong>
                    <small>
                      {item.kind === 'compatibility' ? '合盘' : '个人'} · {formatCaseDate(item)}
                    </small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <button className="app-sidebar-case-empty" type="button" onClick={createCase}>
              新建第一份案例
            </button>
          )}
        </section>

        <button className="app-sidebar-tutorial" type="button" onClick={() => go('/tutorial')}>
          <span className="app-sidebar-nav-mark" aria-hidden="true">
            教
          </span>
          <span>使用教程</span>
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
          <button type="button" className="app-mobile-brand" onClick={() => go('/?mode=single')}>
            <span className="app-mobile-brand-mark" aria-hidden="true">
              命
            </span>
            <strong>命语</strong>
          </button>
          <button type="button" className="app-mobile-case-entry" onClick={() => go('/records')}>
            案例{caseCount ? ` ${caseCount}` : ''}
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
