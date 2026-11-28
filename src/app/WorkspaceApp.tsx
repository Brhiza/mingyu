import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Dices,
  Heart,
  Home,
  Settings,
  User,
} from 'lucide-react';
import { methodLabels, type Method } from '../method-meta';
import { APP_NAME, APP_SEAL_CHAR, MERIT_BOX_URL } from '../brand-config';
import {
  getAssetOrigin,
  getSkinLogoUrl,
  hydrateCachedRemoteSkins,
  loadAssetManifest,
  packageIdForSkinTheme,
  warmAssetPackageInBackground,
} from '../remote-assets';

import { runCalculateInBackground } from '../workers/calc-runner';
import type { SynastryRelationship } from '../systems/focus-presets';
import type { FortuneScope } from '../systems/fortune/types';
import { createBirthPlaceModal } from '../v2-ui/birth-place-modal';
import {
  deleteCompatibilityRecord,
  deleteDivinationRecord,
  deletePersonalCase,
  getActiveCaseId,
  getActiveOrTemporaryCase,
  getPersonalCaseById,
  loadTemporaryCase,
  saveDivinationRecord,
  saveTemporaryCase,
  setActiveCaseId,
  sortPersonalCases,
  togglePersonalCasePin,
  upsertCompatibilityRecord,
  upsertPersonalCase,
  type CompatibilityRecord,
  type DivinationRecord,
  type PersonalCase,
} from '../v2-ui/cases-store';
import type {
  PersonFormWorkspaceHandle,
  PersonRole,
} from './components/person/person-form-helpers';
import { type TimeReverseKnownInfo } from '../v2-ui/time-reverse';
import {
  PERSONAL_CHART_TABS,
  isCompatibilityChartMethod,
  isDivinationFormMethod,
  isPersonalChartMethod,
  type CompatibilityChartTabId,
  type DivinationFormMethod,
  type PersonalChartTabId,
} from '../v2-ui/chart-tabs';
import type { ResultPageController } from '../v2-ui/result-page';
import {
  applyGlobalRulesToPayload,
  loadGlobalRules,
  saveGlobalRules,
  type GlobalRulesSettings,
} from '../web-settings';
import {
  createEmptyAgentSession,
  type AgentChatSession,
  type AgentToolTrace,
} from '../web-agent-storage';
import { isChatAgentActive, isWebAiEnabled } from '../web-ai';
import { recordLocalRouterMethodChoice } from '../router-model/local-preferences';
import type { MethodId as RouterMethodId } from '../router-model/features';
import { useAgentChat } from './hooks/useAgentChat';
import { useCasesStore } from './hooks/useCasesStore';
import { useHomeFortunePreview } from './hooks/useHomeFortunePreview';
import { cn } from '../lib/utils';
import type { CaseFillTarget } from './components/CasesDrawer';
import { GlobalCaseSwitcher } from './components/GlobalCaseSwitcher';
import { HomeFortuneBar, HomePage } from './components/HomePage';
import type { LocalAgentApplyPayload } from './components/AgentChatPanel';
import { PortalModalsHost } from './components/PortalModalsHost';
import { ChunkErrorBoundary, WorkspaceSkeleton } from './components/WorkspaceSkeleton';
import { Toaster } from '../components/ui';
import {
  preloadChartExecution,
  preloadDomainAssets,
  schedulePostMountIdlePrefetch,
} from './preload-scheduler';
import type { ActiveResultMeta } from './workspace-result-restore';

const ChartInputView = React.lazy(() => import('./views/ChartInputView'));
const DivinationInputView = React.lazy(() => import('./views/DivinationInputView'));
const UtilitiesView = React.lazy(() => import('./views/UtilitiesView'));

const CasesDrawer = React.lazy(() =>
  import('./components/CasesDrawer').then((m) => ({ default: m.CasesDrawer })),
);
const CasesPage = React.lazy(() =>
  import('./components/CasesDrawer').then((m) => ({ default: m.CasesPage })),
);
const HistoryPage = React.lazy(() =>
  import('./components/HistoryPanel').then((m) => ({ default: m.HistoryPage })),
);

const CaseEditorModal = React.lazy(() =>
  import('./components/CaseEditorModal').then((m) => ({ default: m.CaseEditorModal })),
);
const ChatPage = React.lazy(() =>
  import('./components/ChatPage').then((m) => ({ default: m.ChatPage })),
);
const ConnectPage = React.lazy(() =>
  import('./components/ConnectPage').then((m) => ({ default: m.ConnectPage })),
);
const FortunePage = React.lazy(() =>
  import('./components/FortunePage').then((m) => ({ default: m.FortunePage })),
);
const SettingsModal = React.lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal })),
);
const TimeReversePage = React.lazy(() =>
  import('./components/TimeReversePage').then((m) => ({ default: m.TimeReversePage })),
);
const ToolsHubPage = React.lazy(() =>
  import('./components/ToolsHubPage').then((m) => ({ default: m.ToolsHubPage })),
);
const MePage = React.lazy(() =>
  import('./components/MePage').then((m) => ({ default: m.MePage })),
);
import {
  applyWorkspaceTheme,
  initSavedDisplayThemeMode,
  readWorkspacePreferences,
  saveWorkspacePreferences,
  type AlmanacSubTabId,
  type DivinationCenterMethod,
  type NameCharSubTabId,
  type TopDomainId,
  type UtilityMainTabId,
  type UtilityToolId,
  type WorkspacePreferences,
  type WorkspaceRouteId,
} from './workspace-catalog';
import {
  buildWorkspaceUrl,
  isStandaloneHomeMethod,
  parseWorkspaceLocation,
  resolveWorkspaceDocumentTitle,
  saveResultSnapshot,
  UTILITY_SINGLE_PAGE_TITLES,
  type ParsedWorkspaceLocation,
  type ResultMode,
  type WorkspaceResultRef,
} from './workspace-router';

export interface WorkspaceAppBridge {
  setAiPrompt: (prompt: {
    text: string;
    followUps?: Array<{ label: string; question: string; reason?: string }>;
  }) => void;
  clearReading: () => void;
}

export interface WorkspaceAppProps {
  bridge: WorkspaceAppBridge;
  sharedAiPane: HTMLElement | null;
}

export function WorkspaceApp({ bridge, sharedAiPane }: WorkspaceAppProps) {
  const [preferences, setPreferences] = React.useState<WorkspacePreferences>(() => {
    initSavedDisplayThemeMode();
    hydrateCachedRemoteSkins();
    const prefs = readWorkspacePreferences();
    applyWorkspaceTheme(prefs.theme);
    return prefs;
  });
  const [activeThemeId, setActiveThemeId] = React.useState<WorkspacePreferences['theme']>(
    preferences.theme,
  );
  const [failedLogoUrl, setFailedLogoUrl] = React.useState<string | null>(null);
  const [loadedLogoUrl, setLoadedLogoUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (getAssetOrigin()) {
      void loadAssetManifest().catch(() => {});
    }
  }, []);

  React.useEffect(() => {
    setActiveThemeId(preferences.theme);
    const pkgId = packageIdForSkinTheme(preferences.theme);
    if (pkgId) {
      void warmAssetPackageInBackground(pkgId);
    }
  }, [preferences.theme]);

  React.useEffect(() => {
    const onThemeChanged = (event: Event) => {
      const detail = (event as CustomEvent<WorkspacePreferences['theme']>).detail;
      if (detail) {
        setActiveThemeId(detail);
      }
    };
    window.addEventListener('mingyu:theme-changed', onThemeChanged);
    return () => window.removeEventListener('mingyu:theme-changed', onThemeChanged);
  }, []);

  const skinLogoUrl = getSkinLogoUrl(activeThemeId);
  const showSkinLogo = Boolean(skinLogoUrl && skinLogoUrl !== failedLogoUrl);
  const logoLoaded = Boolean(skinLogoUrl && loadedLogoUrl === skinLogoUrl);
  const renderBrandSeal = (variant: 'nav' | 'hero' = 'nav') => {
    const imgNode = showSkinLogo && skinLogoUrl ? (
      <img
        src={skinLogoUrl}
        alt=""
        className={cn(
          'absolute inset-0 h-full w-full rounded-[inherit] object-cover transition-opacity duration-200',
          logoLoaded ? 'opacity-100' : 'opacity-0',
        )}
        onLoad={() => setLoadedLogoUrl(skinLogoUrl)}
        onError={() => setFailedLogoUrl(skinLogoUrl)}
      />
    ) : null;

    if (variant === 'hero') {
      return (
        <span
          className={cn(
            'relative inline-flex size-16 min-[680px]:size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-[20px] shadow-[0_8px_22px_var(--accent-soft-strong)]',
            logoLoaded
              ? 'bg-transparent text-transparent'
              : 'bg-[var(--accent-strong)] text-[26px] font-extrabold text-[var(--accent-contrast)]',
          )}
          aria-hidden="true"
        >
          <span>{APP_SEAL_CHAR}</span>
          {imgNode}
        </span>
      );
    }
    return (
      <span
        className={cn(
          'workspace-brand-seal relative overflow-hidden',
          logoLoaded && 'is-skin-logo p-0 text-transparent',
        )}
        aria-hidden="true"
      >
        <span>{APP_SEAL_CHAR}</span>
        {imgNode}
      </span>
    );
  };

  const initialLocation = React.useMemo<ParsedWorkspaceLocation>(() => {
    if (typeof window === 'undefined') {
      return parseWorkspaceLocation('/', '', {
        defaultChartFeature: preferences.defaultChartFeature,
        defaultDivinationFeature: preferences.defaultDivinationFeature,
      });
    }
    return parseWorkspaceLocation(window.location.pathname, window.location.search, {
      defaultChartFeature: preferences.defaultChartFeature,
      defaultDivinationFeature: preferences.defaultDivinationFeature,
    });
    // 仅在首次挂载时解析初始地址栏路径
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initialRules = React.useMemo(() => loadGlobalRules(), []);
  const sharedPlaceModal = React.useMemo(() => createBirthPlaceModal(), []);

  // Navigation & domain state
  const [activeRoute, setActiveRoute] = React.useState<WorkspaceRouteId>(initialLocation.route);
  const [activeDomainHint, setActiveDomainHint] = React.useState<TopDomainId>(
    initialLocation.domainHint,
  );
  const [activeFeatureId, setActiveFeatureId] = React.useState<string>(initialLocation.featureId);
  const [activeMethod, setActiveMethod] = React.useState<Method>(initialLocation.method);
  const [preferredPersonalChartTab, setPreferredPersonalChartTab] =
    React.useState<PersonalChartTabId>(
      initialLocation.personalChartTab ?? preferences.defaultChartFeature,
    );
  const [compatibilityMethod, setCompatibilityMethod] =
    React.useState<CompatibilityChartTabId>(
      initialLocation.compatibilityMethod ?? 'bazi-synastry',
    );
  const [compatRelationship, setCompatRelationship] =
    React.useState<SynastryRelationship>('marriage');
  const [currentDivinationMethod, setCurrentDivinationMethod] =
    React.useState<DivinationCenterMethod>(
      initialLocation.divinationMethod ?? preferences.defaultDivinationFeature,
    );
  const [currentUtilityMainTab, setCurrentUtilityMainTab] =
    React.useState<UtilityMainTabId>(initialLocation.utilityMainTab ?? 'almanac');
  const [currentAlmanacSubTab, setCurrentAlmanacSubTab] =
    React.useState<AlmanacSubTabId>(initialLocation.almanacSubTab ?? 'almanac');
  const [currentNameCharSubTab, setCurrentNameCharSubTab] =
    React.useState<NameCharSubTabId>(initialLocation.nameCharSubTab ?? 'chinese-name');
  const [fortuneScope, setFortuneScope] = React.useState<FortuneScope>(
    initialLocation.fortuneScope ?? 'daily',
  );

  // Home state
  const [homeInstantTimeStandard, setHomeInstantTimeStandard] = React.useState<
    'beijing' | 'true-solar'
  >(initialRules.time.defaultTimeStandard);
  const [homeInstantPlace, setHomeInstantPlace] = React.useState(() => ({
    displayName: initialRules.time.defaultPlaceDisplayName,
    longitude: initialRules.time.defaultPlaceLongitude,
    latitude: initialRules.time.defaultPlaceLatitude,
  }));

  // Store revision for cases / history sync
  const {
    storeRevision,
    setStoreRevision,
    personalCases,
    divinationRecords,
    compatibilityRecords,
  } = useCasesStore();

  // Drawers & Modals state
  const [drawerTab, setDrawerTab] = React.useState<'cases' | null>(null);
  const [drawerFillTarget, setDrawerFillTarget] = React.useState<CaseFillTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [caseEditorState, setCaseEditorState] = React.useState<{
    open: boolean;
    editingCase: PersonalCase | null;
  }>({ open: false, editingCase: null });

  // Form states
  const [chartError, setChartError] = React.useState<string | null>(null);
  const [personFormReady, setPersonFormReady] = React.useState(false);
  const [partnerSeed, setPartnerSeed] = React.useState<Partial<PersonalCase> | undefined>(undefined);
  const [timeReverseContext, setTimeReverseContext] = React.useState<{
    person: PersonalCase;
    role: PersonRole;
  } | null>(null);
  const [rangeScanContext, setRangeScanContext] = React.useState<{
    person: PersonalCase;
    method: 'astrolabe-range' | 'qizheng-range';
  } | null>(null);

  // Web AI 对话模式 & Agent 聊天状态
  const [chatModeActive, setChatModeActive] = React.useState<boolean>(() => isChatAgentActive());
  const [mobileResultAssistantOpen, setMobileResultAssistantOpen] = React.useState(false);
  React.useEffect(() => {
    const syncChatMode = () => setChatModeActive(isChatAgentActive());
    window.addEventListener('mingyu:web-ai-changed', syncChatMode);
    window.addEventListener('storage', syncChatMode);
    return () => {
      window.removeEventListener('mingyu:web-ai-changed', syncChatMode);
      window.removeEventListener('storage', syncChatMode);
    };
  }, []);

  const {
    agentSessions,
    setAgentSessions,
    activeAgentSessionId,
    setActiveAgentSessionId,
    activeAgentSession,
    agentRunning,
    agentStatusText,
    agentSessionsRef,
    agentRunningRef,
    handleAgentSelectAttachedCase,
    handleAgentNewChat,
    handleAgentSelectSession,
    handleAgentDeleteSession,
    handleAgentStop,
    handleAgentSendMessage,
  } = useAgentChat({
    initialChatSessionId: initialLocation.chatSessionId,
    activeRoute,
    activeDomainHint,
    personalCases,
  });
  const [homeVisitRevision, setHomeVisitRevision] = React.useState(0);

  // Refs for DOM-mounted domain engines
  const resultStageRef = React.useRef<HTMLDivElement>(null);
  const resultControllerRef = React.useRef<ResultPageController | null>(null);
  const [resultControllerReady, setResultControllerReady] = React.useState(false);
  const personWorkspaceRef = React.useRef<PersonFormWorkspaceHandle | null>(null);
  const divinationLatestPayloadRef = React.useRef<Record<string, unknown>>({});
  const [almanacPreset, setAlmanacPreset] = React.useState<{
    topic: 'move' | 'renovation';
    participants?: Array<{
      id: string;
      name: string;
      gender: '' | '男' | '女';
      year: string;
      month: string;
      day: string;
      shichenIndex: string;
      calendar: 'solar' | 'lunar';
    }>;
    nonce: number;
  } | null>(null);

  const isCompatibilityMode =
    activeFeatureId === 'compatibility' || isCompatibilityChartMethod(activeMethod);
  const isRangeMode =
    activeFeatureId === 'range' ||
    activeMethod === 'astrolabe-range' ||
    activeMethod === 'qizheng-range';

  const resolveActiveTopDomain = React.useCallback((): TopDomainId => {
    if (activeRoute === 'home') return 'home';
    if (activeRoute === 'fortune') return 'fortune';
    if (activeRoute === 'chat') return activeDomainHint === 'history' ? 'history' : 'home';
    if (activeRoute === 'history') return 'history';
    if (activeRoute === 'cases') return 'cases';
    if (activeRoute === 'me') return 'me';
    if (activeRoute === 'connect') return 'connect';
    if (activeRoute === 'tools' || activeRoute === 'utilities') return 'tools';
    if (activeRoute === 'chart-input' || activeRoute === 'time-reverse') return 'personal-chart';
    if (activeRoute === 'divination-input') {
      return isStandaloneHomeMethod(activeMethod) ? 'home' : 'divination';
    }
    if (activeRoute === 'result') {
      if (isCompatibilityMode || isCompatibilityChartMethod(activeMethod)) return 'personal-chart';
      if (activeDomainHint === 'utilities' || activeDomainHint === 'tools') return 'tools';
      if (isPersonalChartMethod(activeMethod) && activeDomainHint === 'personal-chart') {
        return 'personal-chart';
      }
      return isStandaloneHomeMethod(activeMethod) ? 'home' : 'divination';
    }
    return activeDomainHint;
  }, [activeRoute, activeDomainHint, activeMethod, isCompatibilityMode]);

  const activeDomain = resolveActiveTopDomain();
  const hasActiveHomeChat =
    activeRoute === 'home' &&
    chatModeActive &&
    Boolean(activeAgentSession && activeAgentSession.messages.length > 0);

  const resolveMobileTitle = (): string => {
    if (activeRoute === 'chat') {
      return 'AI 对话';
    }
    if (activeRoute === 'result' && mobileResultAssistantOpen) {
      return isWebAiEnabled() ? 'AI 解读' : '专属提示词';
    }
    if (activeDomain === 'home') {
      if (
        (activeRoute === 'divination-input' || activeRoute === 'result') &&
        isStandaloneHomeMethod(activeMethod)
      ) {
        return methodLabels[activeMethod] ?? '专项数术';
      }
      return APP_NAME;
    }
    if (activeDomain === 'chat') return 'AI 对话';
    if (activeDomain === 'fortune') return '黄历运势';
    if (activeDomain === 'history') return '历史记录';
    if (activeDomain === 'cases') return '个人档案';
    if (activeRoute === 'me') return '我的';
    if (activeRoute === 'tools') return '工具箱';
    if (activeDomain === 'personal-chart') {
      if (activeRoute === 'time-reverse') return '时辰逆推';
      if (activeRoute === 'result') {
        if (isCompatibilityMode || isCompatibilityChartMethod(activeMethod)) {
          return '双人合盘';
        }
        return (
          PERSONAL_CHART_TABS.find((t) => t.id === activeMethod)?.label ??
          methodLabels[activeMethod] ??
          '命盘排盘'
        );
      }
      if (isRangeMode) return '出生范围扫描';
      return isCompatibilityMode ? '双人合盘' : '命盘排盘';
    }
    if (activeRoute === 'utilities' || activeDomain === 'utilities') {
      return UTILITY_SINGLE_PAGE_TITLES[currentUtilityMainTab];
    }
    if (activeDomain === 'connect') return '接入 AI';
    if (activeRoute === 'result') {
      return methodLabels[activeMethod] ?? '占卜排盘';
    }
    return '占卜起卦';
  };

  const activeResultMetaRef = React.useRef<ActiveResultMeta>({
    mode: initialLocation.resultRef?.mode ?? 'personal',
    caseId: initialLocation.resultRef?.caseId,
    recordId: initialLocation.resultRef?.recordId,
    featureId: initialLocation.featureId,
    domainHint: initialLocation.domainHint,
  });

  const lastResultContextRef = React.useRef<{
    person?: PersonalCase;
    partner?: PersonalCase;
    question?: string;
  }>({});

  const routeStateRef = React.useRef({
    activeMethod,
    activeFeatureId,
    activeDomainHint,
    fortuneScope,
    currentUtilityMainTab,
    currentAlmanacSubTab,
    currentNameCharSubTab,
    activeAgentSessionId,
  });
  routeStateRef.current = {
    activeMethod,
    activeFeatureId,
    activeDomainHint,
    fortuneScope,
    currentUtilityMainTab,
    currentAlmanacSubTab,
    currentNameCharSubTab,
    activeAgentSessionId,
  };

  const navigateToRoute = React.useCallback(
    (
      route: WorkspaceRouteId,
      params?: {
        featureId?: string;
        method?: Method;
        domain?: TopDomainId;
        fortuneScope?: FortuneScope;
        utilityMainTab?: UtilityMainTabId;
        almanacSubTab?: AlmanacSubTabId;
        nameCharSubTab?: NameCharSubTabId;
        chatSessionId?: string;
        resultRef?: WorkspaceResultRef;
        historyMode?: 'push' | 'replace' | 'none';
      },
    ) => {
      if (route === 'result') {
        const targetMode =
          params?.resultRef?.mode ??
          (params?.domain === 'divination' || params?.domain === 'utilities' ? 'divination' : 'personal');
        resultControllerRef.current?.prepareForTransition(targetMode, params?.method);
      } else {
        resultControllerRef.current?.prepareForTransition();
      }
      setActiveRoute(route);
      if (route !== 'result') {
        setMobileResultAssistantOpen(false);
        resultControllerRef.current?.setMobileAssistantOpen(false);
      }
      if (route === 'home') {
        setDrawerTab(null);
        setDrawerFillTarget(null);
        setHomeVisitRevision((n) => n + 1);
        setStoreRevision((n) => n + 1);
        if (!agentRunningRef.current) {
          const existingEmpty = agentSessionsRef.current.find((s) => s.messages.length === 0);
          if (existingEmpty) {
            setActiveAgentSessionId(existingEmpty.id);
          } else {
            const fresh = createEmptyAgentSession(getActiveCaseId());
            setAgentSessions((prev) => [fresh, ...prev]);
            setActiveAgentSessionId(fresh.id);
          }
        }
      }
      if (params?.featureId) setActiveFeatureId(params.featureId);
      if (params?.method) setActiveMethod(params.method);
      if (params?.fortuneScope) setFortuneScope(params.fortuneScope);
      if (params?.utilityMainTab) setCurrentUtilityMainTab(params.utilityMainTab);
      if (params?.almanacSubTab) setCurrentAlmanacSubTab(params.almanacSubTab);
      if (params?.nameCharSubTab) setCurrentNameCharSubTab(params.nameCharSubTab);

      let resolvedDomainHint: TopDomainId;
      if (params?.domain) {
        resolvedDomainHint = params.domain;
      } else if (route === 'home') {
        resolvedDomainHint = 'home';
      } else if (route === 'fortune') {
        resolvedDomainHint = 'fortune';
      } else if (route === 'chat') {
        resolvedDomainHint = 'chat';
      } else if (route === 'connect') {
        resolvedDomainHint = 'connect';
      } else if (route === 'utilities') {
        resolvedDomainHint = 'utilities';
      } else if (route === 'chart-input' || route === 'time-reverse') {
        resolvedDomainHint = 'personal-chart';
      } else if (route === 'divination-input') {
        resolvedDomainHint = 'divination';
      } else {
        resolvedDomainHint = routeStateRef.current.activeDomainHint;
      }
      setActiveDomainHint(resolvedDomainHint);

      const resolvedMethod = params?.method ?? routeStateRef.current.activeMethod;
      const resolvedFeatureId = params?.featureId ?? routeStateRef.current.activeFeatureId;
      const resolvedFortuneScope = params?.fortuneScope ?? routeStateRef.current.fortuneScope;
      const resolvedUtilityMainTab =
        params?.utilityMainTab ?? routeStateRef.current.currentUtilityMainTab;
      const resolvedAlmanacSubTab =
        params?.almanacSubTab ?? routeStateRef.current.currentAlmanacSubTab;
      const resolvedNameCharSubTab =
        params?.nameCharSubTab ?? routeStateRef.current.currentNameCharSubTab;
      const resolvedChatSessionId =
        params?.chatSessionId ?? routeStateRef.current.activeAgentSessionId;

      if (route === 'result') {
        const inferredMode: ResultMode =
          params?.resultRef?.mode ??
          (isCompatibilityChartMethod(resolvedMethod)
            ? 'compatibility'
            : isPersonalChartMethod(resolvedMethod) &&
                resolvedDomainHint !== 'utilities' &&
                resolvedFeatureId !== 'instant'
              ? 'personal'
              : 'divination');
        activeResultMetaRef.current = {
          mode: inferredMode,
          caseId: params?.resultRef?.caseId,
          recordId: params?.resultRef?.recordId,
          featureId: resolvedFeatureId,
          domainHint: resolvedDomainHint,
        };
      }

      if (typeof window !== 'undefined' && params?.historyMode !== 'none') {
        const targetUrl = buildWorkspaceUrl({
          route,
          domainHint: resolvedDomainHint,
          featureId: resolvedFeatureId,
          method: resolvedMethod,
          fortuneScope: resolvedFortuneScope,
          utilityMainTab: resolvedUtilityMainTab,
          almanacSubTab: resolvedAlmanacSubTab,
          nameCharSubTab: resolvedNameCharSubTab,
          chatSessionId: resolvedChatSessionId,
          resultRef:
            route === 'result'
              ? {
                  mode: activeResultMetaRef.current.mode,
                  caseId: activeResultMetaRef.current.caseId,
                  recordId: activeResultMetaRef.current.recordId,
                }
              : undefined,
        });
        const currentUrl = window.location.pathname + window.location.search;
        if (currentUrl !== targetUrl) {
          if (params?.historyMode === 'replace') {
            window.history.replaceState(null, '', targetUrl);
          } else {
            window.history.pushState(null, '', targetUrl);
          }
        }
      }

      setChartError(null);
    },
    [],
  );

  const navigateToUtilities = React.useCallback(
    (
      target:
        | UtilityMainTabId
        | UtilityToolId
        | 'calendar'
        | 'bazhai'
        | 'xuankong',
    ) => {
      if (
        target === 'chinese-name' ||
        target === 'chinese-naming' ||
        target === 'character-query' ||
        target === 'zhouyi' ||
        target === 'terms'
      ) {
        setCurrentUtilityMainTab('name-char');
        setCurrentNameCharSubTab(target);
        navigateToRoute('utilities', {
          featureId: target,
          method: (target === 'terms' ? 'character-query' : target) as Method,
          domain: 'utilities',
          utilityMainTab: 'name-char',
          nameCharSubTab: target,
        });
        return;
      }
      if (target === 'name-char') {
        setCurrentUtilityMainTab('name-char');
        navigateToRoute('utilities', {
          featureId: currentNameCharSubTab,
          method: currentNameCharSubTab === 'terms' ? 'character-query' : currentNameCharSubTab,
          domain: 'utilities',
          utilityMainTab: 'name-char',
          nameCharSubTab: currentNameCharSubTab,
        });
        return;
      }
      if (target === 'calendar') {
        setCurrentUtilityMainTab('almanac');
        setCurrentAlmanacSubTab('calendar');
        navigateToRoute('utilities', {
          featureId: 'calendar',
          method: 'calendar',
          domain: 'utilities',
          utilityMainTab: 'almanac',
          almanacSubTab: 'calendar',
        });
        return;
      }
      if (target === 'number-energy') {
        setCurrentUtilityMainTab('number-energy');
        navigateToRoute('utilities', {
          featureId: 'number-energy',
          method: 'number-energy',
          domain: 'utilities',
          utilityMainTab: 'number-energy',
        });
        return;
      }
      if (target === 'almanac') {
        setCurrentUtilityMainTab('almanac');
        setCurrentAlmanacSubTab('almanac');
        navigateToRoute('utilities', {
          featureId: 'almanac',
          method: 'almanac',
          domain: 'utilities',
          utilityMainTab: 'almanac',
          almanacSubTab: 'almanac',
        });
        return;
      }
      setCurrentUtilityMainTab('residential');
      navigateToRoute('utilities', {
        featureId: 'residential',
        method: 'residential',
        domain: 'utilities',
        utilityMainTab: 'residential',
      });
    },
    [currentNameCharSubTab, navigateToRoute],
  );

  const ensureAiPaneDockedForResult = React.useCallback(() => {
    if (!sharedAiPane || !resultStageRef.current) return;
    const mount = resultStageRef.current.querySelector('.ai-shared-mount');
    if (mount && !mount.contains(sharedAiPane)) {
      mount.appendChild(sharedAiPane);
    }
  }, [sharedAiPane]);

  React.useEffect(
    () =>
      schedulePostMountIdlePrefetch({
        defaultChart: preferences.defaultChartFeature,
        defaultDivination: preferences.defaultDivinationFeature,
      }),
    [preferences.defaultChartFeature, preferences.defaultDivinationFeature],
  );

  const lastAiMethodRef = React.useRef<Method | null>(null);

  const resultControllerPromiseRef = React.useRef<Promise<ResultPageController | null> | null>(null);

  const ensureResultController = React.useCallback(async (): Promise<ResultPageController | null> => {
    if (resultControllerRef.current) return resultControllerRef.current;
    const resultHost = resultStageRef.current;
    if (!resultHost) return null;
    if (!resultControllerPromiseRef.current) {
      resultControllerPromiseRef.current = import('../v2-ui/result-page')
        .then(({ createResultPageController }) => {
          if (!resultControllerRef.current && resultStageRef.current) {
            resultControllerRef.current = createResultPageController({
              container: resultStageRef.current,
              sharedAiPane,
              onBackToForm: (m) => callbacksRef.current.onBackToForm(m),
              onOpenSwitchPerson: () => callbacksRef.current.onOpenSwitchPerson(),
              onActiveMethodChange: (m) => callbacksRef.current.onActiveMethodChange(m),
              onActiveResultChange: (m, p, r) => callbacksRef.current.onActiveResultChange(m, p, r),
              onMobileAssistantToggle: (open) => callbacksRef.current.onMobileAssistantToggle(open),
            });
          }
          return resultControllerRef.current;
        })
        .finally(() => {
          if (resultControllerRef.current) {
            setResultControllerReady(true);
          }
          resultControllerPromiseRef.current = null;
        });
    }
    return resultControllerPromiseRef.current;
  }, [sharedAiPane]);

  const openResult = React.useCallback(
    async (ctx: Parameters<ResultPageController['openWithContext']>[0]) => {
      preloadChartExecution(ctx.activeMethod);
      const ctrl = await ensureResultController();
      if (!ctrl) return;
      lastAiMethodRef.current = ctx.activeMethod;
      lastResultContextRef.current = {
        person: ctx.person,
        partner: ctx.partner,
        question: ctx.question,
      };
      const resolvedCaseId =
        ctx.person && !ctx.person.isTemporary && ctx.person.id && ctx.person.id !== 'temporary'
          ? ctx.person.id
          : activeResultMetaRef.current.caseId;
      activeResultMetaRef.current = {
        ...activeResultMetaRef.current,
        mode: ctx.mode,
        ...(resolvedCaseId ? { caseId: resolvedCaseId } : {}),
      };
      bridge.clearReading();
      await ctrl.openWithContext(ctx);
      ensureAiPaneDockedForResult();
    },
    [bridge, ensureAiPaneDockedForResult, ensureResultController],
  );

  const restoreResultFromLocation = React.useCallback(
    async (parsed: ParsedWorkspaceLocation) => {
      const { restoreResultFromLocationAction } = await import('./workspace-result-restore');
      await restoreResultFromLocationAction(
        {
          activeResultMetaRef,
          setCompatibilityMethod,
          setPreferredPersonalChartTab,
          openResult,
          navigateToRoute,
        },
        parsed,
      );
    },
    [navigateToRoute, openResult],
  );

  // Fresh handler ref for imperative resultController callbacks
  const callbacksRef = React.useRef<{
    onBackToForm: (method: Method) => void;
    onOpenSwitchPerson: () => void;
    onActiveMethodChange: (method: Method) => void;
    onActiveResultChange: (
      method: Method,
      payload: Record<string, unknown>,
      res: {
        summary?: unknown;
        prompt?: { text: string };
        data?: unknown;
        followUps?: Array<{ label: string; question: string; reason?: string }>;
      },
    ) => void;
    onMobileAssistantToggle: (open: boolean) => void;
  }>({
    onBackToForm: () => {},
    onOpenSwitchPerson: () => {},
    onActiveMethodChange: () => {},
    onActiveResultChange: () => {},
    onMobileAssistantToggle: () => {},
  });

  callbacksRef.current = {
    onBackToForm: (method: Method) => {
      if (method === 'astrolabe-range' || method === 'qizheng-range') {
        navigateToRoute('chart-input', {
          featureId: 'range',
          method,
          domain: 'personal-chart',
        });
      } else if (method === 'calendar' || method === 'zhouyi') {
        navigateToUtilities(method);
      } else if (isCompatibilityChartMethod(method)) {
        setCompatibilityMethod(method);
        navigateToRoute('chart-input', {
          featureId: 'compatibility',
          method,
          domain: 'personal-chart',
        });
      } else if (isPersonalChartMethod(method) && activeDomainHint !== 'utilities') {
        setPreferredPersonalChartTab(method);
        navigateToRoute('chart-input', {
          featureId: method,
          method,
          domain: 'personal-chart',
        });
      } else if (
        method === 'almanac' ||
        method === 'residential' ||
        method === 'xuankong' ||
        method === 'number-energy' ||
        (method === 'bazhai' && activeDomainHint === 'utilities')
      ) {
        const mergedTab: UtilityMainTabId =
          method === 'almanac'
            ? 'almanac'
            : method === 'number-energy'
              ? 'number-energy'
              : 'residential';
        navigateToUtilities(mergedTab);
      } else {
        const divId = (
          isDivinationFormMethod(method) ? method : 'liuyao'
        ) as DivinationCenterMethod;
        setCurrentDivinationMethod(divId);
        navigateToRoute('divination-input', {
          featureId: divId,
          method: divId as Method,
          domain: isStandaloneHomeMethod(divId) ? 'home' : 'divination',
        });
      }
    },
    onOpenSwitchPerson: () => {
      navigateToRoute('cases', { domain: 'cases' });
    },
    onActiveMethodChange: (method) => {
      setActiveMethod(method);
    },
    onActiveResultChange: (method, payload, res) => {
      setActiveMethod(method);
      recordLocalRouterMethodChoice(method as RouterMethodId);
      if (lastAiMethodRef.current !== null && lastAiMethodRef.current !== method) {
        bridge.clearReading();
      }
      lastAiMethodRef.current = method;
      if (res.prompt?.text) {
        bridge.setAiPrompt({
          text: res.prompt.text,
          ...(Array.isArray(res.followUps) ? { followUps: res.followUps } : {}),
        });
      }
      if (isPersonalChartMethod(method) && activeDomainHint === 'personal-chart') {
        setPreferredPersonalChartTab(method);
      } else if (isCompatibilityChartMethod(method)) {
        setCompatibilityMethod(method);
      }

      const meta = activeResultMetaRef.current;
      const nextUrl = buildWorkspaceUrl({
        route: 'result',
        method,
        domainHint: meta.domainHint,
        featureId: meta.featureId,
        resultRef: {
          mode: meta.mode,
          caseId: meta.caseId,
          recordId: meta.recordId,
        },
      });
      if (
        typeof window !== 'undefined' &&
        activeRoute === 'result' &&
        window.location.pathname.startsWith('/result') &&
        window.location.pathname + window.location.search !== nextUrl
      ) {
        window.history.replaceState(null, '', nextUrl);
      }
      saveResultSnapshot({
        url: nextUrl,
        mode: meta.mode,
        activeMethod: method,
        featureId: meta.featureId,
        domainHint: meta.domainHint,
        ...(meta.caseId ? { caseId: meta.caseId } : {}),
        ...(meta.recordId ? { recordId: meta.recordId } : {}),
        ...(lastResultContextRef.current.person ? { person: lastResultContextRef.current.person } : {}),
        ...(lastResultContextRef.current.partner ? { partner: lastResultContextRef.current.partner } : {}),
        ...(lastResultContextRef.current.question ? { question: lastResultContextRef.current.question } : {}),
        initialPayload: payload,
        initialResult: res,
      });
    },
    onMobileAssistantToggle: (open) => setMobileResultAssistantOpen(open),
  };

  const didInitialRouteSyncRef = React.useRef(false);

  // Sync initial canonical URL & restore initial /result route lazily if needed
  React.useEffect(() => {
    if (!didInitialRouteSyncRef.current) {
      didInitialRouteSyncRef.current = true;
      if (typeof window !== 'undefined') {
        const currentUrl = window.location.pathname + window.location.search;
        if (currentUrl !== initialLocation.canonicalPath) {
          window.history.replaceState(null, '', initialLocation.canonicalPath);
        }
      }
      if (initialLocation.route === 'result') {
        void restoreResultFromLocation(initialLocation);
      }
    }
  }, [initialLocation, restoreResultFromLocation]);

  // 同步浏览器标题
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = resolveWorkspaceDocumentTitle({
      route: activeRoute,
      activeDomain,
      activeFeatureId,
      activeMethod,
      fortuneScope,
      currentUtilityMainTab,
      currentNameCharSubTab,
    });
  }, [
    activeRoute,
    activeDomain,
    activeFeatureId,
    activeMethod,
    fortuneScope,
    currentUtilityMainTab,
    currentNameCharSubTab,
  ]);

  // 监听浏览器前进 / 后退
  React.useEffect(() => {
    const handlePopState = () => {
      const parsed = parseWorkspaceLocation(window.location.pathname, window.location.search, {
        defaultChartFeature: preferences.defaultChartFeature,
        defaultDivinationFeature: preferences.defaultDivinationFeature,
      });
      if (parsed.fortuneScope) setFortuneScope(parsed.fortuneScope);
      if (parsed.divinationMethod) setCurrentDivinationMethod(parsed.divinationMethod);
      if (parsed.personalChartTab) setPreferredPersonalChartTab(parsed.personalChartTab);
      if (parsed.compatibilityMethod) setCompatibilityMethod(parsed.compatibilityMethod);
      if (parsed.utilityMainTab) setCurrentUtilityMainTab(parsed.utilityMainTab);
      if (parsed.almanacSubTab) setCurrentAlmanacSubTab(parsed.almanacSubTab);
      if (parsed.nameCharSubTab) setCurrentNameCharSubTab(parsed.nameCharSubTab);
      if (parsed.chatSessionId && agentSessionsRef.current.some((s) => s.id === parsed.chatSessionId)) {
        setActiveAgentSessionId(parsed.chatSessionId);
      }

      navigateToRoute(parsed.route, {
        featureId: parsed.featureId,
        method: parsed.method,
        domain: parsed.domainHint,
        fortuneScope: parsed.fortuneScope,
        utilityMainTab: parsed.utilityMainTab,
        almanacSubTab: parsed.almanacSubTab,
        nameCharSubTab: parsed.nameCharSubTab,
        chatSessionId: parsed.chatSessionId,
        resultRef: parsed.resultRef,
        historyMode: 'none',
      });

      if (parsed.route === 'result') {
        void restoreResultFromLocation(parsed);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    navigateToRoute,
    preferences.defaultChartFeature,
    preferences.defaultDivinationFeature,
    restoreResultFromLocation,
  ]);

  // Keep shared AI assistant pane docked inside result view
  React.useEffect(() => {
    if (activeRoute === 'result') {
      ensureAiPaneDockedForResult();
    }
  }, [activeRoute, ensureAiPaneDockedForResult]);

  // Global custom event listeners for cross-surface navigation & drawer picker
  React.useEffect(() => {
    const handleNavConnect = () => {
      navigateToRoute('connect', { domain: 'connect' });
    };
    const handleOpenCasePicker = (ev: Event) => {
      const custom = ev as CustomEvent<CaseFillTarget | undefined>;
      setDrawerFillTarget(custom.detail ?? null);
      setDrawerTab('cases');
    };
    window.addEventListener('mingyu:navigate-connect', handleNavConnect);
    window.addEventListener('mingyu:open-case-picker', handleOpenCasePicker);
    return () => {
      window.removeEventListener('mingyu:navigate-connect', handleNavConnect);
      window.removeEventListener('mingyu:open-case-picker', handleOpenCasePicker);
    };
  }, [navigateToRoute]);

  const selectDivinationMethod = (id: DivinationCenterMethod) => {
    const normalizedId = (
      (id as string) === 'kongming'
        ? 'zhuge'
        : (id as string) === 'tarot-major'
          ? 'tarot'
          : id
    ) as DivinationCenterMethod;
    setCurrentDivinationMethod(normalizedId);
    const targetMethod: Method = normalizedId as Method;
    navigateToRoute('divination-input', {
      featureId: normalizedId,
      method: targetMethod,
      domain: isStandaloneHomeMethod(normalizedId) ? 'home' : 'divination',
    });
  };

  const openHomeTileWorkbench = (itemId: string) => {
    if (itemId === 'fortune') {
      navigateToRoute('fortune', {
        featureId: 'fortune',
        method: 'fortune',
        domain: 'fortune',
      });
      return;
    }
    if (itemId === 'compatibility') {
      navigateToRoute('chart-input', {
        featureId: 'compatibility',
        method: compatibilityMethod,
        domain: 'personal-chart',
      });
      return;
    }
    if (itemId === 'birth-range') {
      navigateToRoute('chart-input', {
        featureId: 'range',
        method: 'astrolabe-range',
        domain: 'personal-chart',
      });
      return;
    }
    if (isPersonalChartMethod(itemId)) {
      setPreferredPersonalChartTab(itemId);
      navigateToRoute('chart-input', {
        featureId: itemId,
        method: itemId,
        domain: 'personal-chart',
      });
      return;
    }
    if (
      itemId === 'almanac' ||
      itemId === 'calendar' ||
      itemId === 'bazhai' ||
      itemId === 'xuankong' ||
      itemId === 'residential' ||
      itemId === 'name-char' ||
      itemId === 'character-query' ||
      itemId === 'chinese-name' ||
      itemId === 'chinese-naming' ||
      itemId === 'zhouyi' ||
      itemId === 'terms' ||
      itemId === 'number-energy'
    ) {
      navigateToUtilities(itemId);
      return;
    }
    selectDivinationMethod(itemId as DivinationCenterMethod);
  };

  const quickExecuteHomeTile = async (
    itemId: string,
    customQuestion?: string,
    castNumbers?: number[],
  ) => {
    const { quickExecuteHomeTileAction } = await import('./workspace-home-actions');
    await quickExecuteHomeTileAction(
      {
        personalCases,
        homeInstantTimeStandard,
        homeInstantPlace,
        openHomeTileWorkbench,
        setPreferredPersonalChartTab,
        setCurrentDivinationMethod,
        navigateToRoute,
        openResult,
      },
      itemId,
      customQuestion,
      castNumbers,
    );
  };

  const launchInstantFromHome = async (
    customQuestion?: string,
    overrideChoice?: 'bazi' | 'ziwei' | 'astrolabe' | 'qimen' | 'liuren' | 'qizheng',
  ) => {
    const { launchInstantFromHomeAction } = await import('./workspace-home-actions');
    await launchInstantFromHomeAction(
      {
        homeInstantTimeStandard,
        homeInstantPlace,
        navigateToRoute,
        openResult,
      },
      customQuestion,
      overrideChoice,
    );
  };

  const handleOneClickInstantCast = (itemId: string) => {
    void quickExecuteHomeTile(itemId);
  };

  const openCustomShortcutTarget = (id: string) => {
    if (id === 'tools') {
      navigateToRoute('tools', { domain: 'tools' });
      return;
    }
    if (id === 'cases') {
      navigateToRoute('cases', { domain: 'cases' });
      return;
    }
    if (id === 'history') {
      navigateToRoute('history', { domain: 'history' });
      return;
    }
    if (id === 'connect') {
      navigateToRoute('connect', { domain: 'connect' });
      return;
    }
    openHomeTileWorkbench(id);
  };

  const pendingChartQuestionRef = React.useRef<string>('');

  const handleApplyLocalAgentRecommendation = async (payload: LocalAgentApplyPayload) => {
    const { applyLocalAgentRecommendationAction } = await import('./workspace-agent-actions');
    await applyLocalAgentRecommendationAction(
      {
        seededPerson,
        partnerSeed,
        compatRelationship,
        pendingChartQuestionRef,
        setPartnerSeed,
        setCompatRelationship,
        setCompatibilityMethod,
        setPreferredPersonalChartTab,
        openHomeTileWorkbench,
        executeDivination,
        quickExecuteHomeTile,
        navigateToRoute,
        openResult,
      },
      payload,
    );
  };

  const openChartForCase = (record: PersonalCase) => {
    const selected = setActiveCaseId(record.id);
    setStoreRevision((n) => n + 1);
    const targetTab: PersonalChartTabId =
      record.workspaceSource && isPersonalChartMethod(record.workspaceSource)
        ? record.workspaceSource
        : preferredPersonalChartTab;
    setPreferredPersonalChartTab(targetTab);
    navigateToRoute('result', {
      featureId: targetTab,
      method: targetTab,
      domain: 'personal-chart',
      resultRef: {
        mode: 'personal',
        caseId: selected.id,
      },
    });
    void openResult({
      mode: 'personal',
      activeMethod: targetTab,
      person: selected,
    });
  };

  const executeDivination = async (method: Method, rawPayload: Record<string, unknown>) => {
    const payload = applyGlobalRulesToPayload(method, rawPayload, method !== 'random-divination') as Record<
      string,
      unknown
    >;
    const res = (await runCalculateInBackground(method, payload, {
      promptGuidance: loadGlobalRules().prompt,
    })) as {
      summary?: unknown;
      prompt?: { text: string };
      data?: unknown;
    };
    const q = typeof payload.question === 'string' ? payload.question : '';
    const savedDiv = saveDivinationRecord({
      type: 'divination',
      method,
      question: q,
      caseId: null,
      inputJson: JSON.stringify(payload),
      result: res,
    });
    navigateToRoute('result', {
      featureId: method,
      method,
      domain: activeDomain === 'utilities' ? 'utilities' : 'divination',
      resultRef: {
        mode: 'divination',
        recordId: savedDiv.id,
      },
    });
    await openResult({
      mode: 'divination',
      activeMethod: method,
      question: q,
      initialPayload: payload,
      initialResult: res,
    });
  };

  const handleChartSubmit = async () => {
    const ws = personWorkspaceRef.current;
    if (!ws) return;
    const validation = ws.validate();
    if (!validation.ok) {
      setChartError(validation.message);
      return;
    }
    setChartError(null);
    const persisted = ws.persistIfRequested();
    const initialQuestion = pendingChartQuestionRef.current.trim();
    pendingChartQuestionRef.current = '';

    if (isCompatibilityMode && persisted.partner) {
      const { buildCompatibilityChartPayload } = await import('../v2-ui/chart-payloads');
      const payload = buildCompatibilityChartPayload(
        persisted.self,
        persisted.partner,
        compatibilityMethod,
        initialQuestion,
        { relationship: compatRelationship },
      );
      const savedCompat = upsertCompatibilityRecord(persisted.self, persisted.partner, {
        method: compatibilityMethod,
        question: initialQuestion,
        inputJson: JSON.stringify(payload),
      });
      navigateToRoute('result', {
        featureId: 'compatibility',
        method: compatibilityMethod,
        domain: 'personal-chart',
        resultRef: {
          mode: 'compatibility',
          recordId: savedCompat.id,
        },
      });
      await openResult({
        mode: 'compatibility',
        activeMethod: compatibilityMethod,
        person: persisted.self,
        partner: persisted.partner,
        compatibilityRelationship: compatRelationship,
        ...(initialQuestion ? { question: initialQuestion } : {}),
      });
      return;
    }

    const tab: PersonalChartTabId = preferredPersonalChartTab;
    navigateToRoute('result', {
      featureId: tab,
      method: tab,
      domain: 'personal-chart',
      resultRef: {
        mode: 'personal',
        ...(!persisted.self.isTemporary && persisted.self.id && persisted.self.id !== 'temporary'
          ? { caseId: persisted.self.id }
          : {}),
      },
    });
    await openResult({
      mode: 'personal',
      activeMethod: tab,
      person: persisted.self,
      ...(initialQuestion ? { question: initialQuestion } : {}),
    });
  };

  const restoreHistoryRecord = async (rec: DivinationRecord) => {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rec.inputJson) as Record<string, unknown>;
    } catch {}
    const method = (rec.method as Method) || 'liuyao';
    const resolvedMode: ResultMode =
      isPersonalChartMethod(method) && activeDomainHint === 'personal-chart'
        ? 'personal'
        : 'divination';
    navigateToRoute('result', {
      featureId: rec.type === 'instant' ? 'instant' : method,
      method,
      domain: 'divination',
      resultRef: {
        mode: resolvedMode,
        recordId: rec.id,
      },
    });
    await openResult({
      mode: resolvedMode,
      activeMethod: method,
      question: rec.question,
      initialPayload: payload,
      initialResult: rec.result as { summary?: unknown; prompt?: { text: string }; data?: unknown },
    });
  };

  const handleSelectHistoryDivination = (rec: DivinationRecord) => {
    void restoreHistoryRecord(rec);
  };

  const handleSelectHistoryCompatibility = (rec: CompatibilityRecord) => {
    const tab: CompatibilityChartTabId = isCompatibilityChartMethod(rec.method)
      ? rec.method
      : 'bazi-synastry';
    setCompatibilityMethod(tab);
    navigateToRoute('result', {
      featureId: 'compatibility',
      method: tab,
      domain: 'personal-chart',
      resultRef: {
        mode: 'compatibility',
        recordId: rec.id,
      },
    });
    void openResult({
      mode: 'compatibility',
      activeMethod: tab,
      person: rec.person1,
      partner: rec.person2,
      question: rec.question,
    });
  };

  const handleDeleteHistoryRecord = (
    kind: 'divination' | 'instant' | 'compatibility' | 'chat',
    id: string,
  ) => {
    if (kind === 'chat') {
      handleAgentDeleteSession(id);
      return;
    }
    if (kind === 'compatibility') {
      deleteCompatibilityRecord(id);
    } else {
      deleteDivinationRecord(id);
    }
    setStoreRevision((n) => n + 1);
  };

  const handleSelectHistoryChat = (session: AgentChatSession) => {
    setActiveAgentSessionId(session.id);
    navigateToRoute('chat', {
      domain: activeRoute === 'history' ? 'history' : 'home',
      chatSessionId: session.id,
    });
  };

  // Home derived selection
  const sortedCases = React.useMemo(() => sortPersonalCases(personalCases, 'recent'), [personalCases]);
  const activeStoreCaseId = React.useMemo(() => {
    void storeRevision;
    return getActiveCaseId();
  }, [storeRevision]);
  const selectedHomeCase =
    (activeStoreCaseId && sortedCases.find((c) => c.id === activeStoreCaseId)) || null;
  const homeFortunePreview = useHomeFortunePreview(selectedHomeCase);

  const handleGlobalSelectCase = React.useCallback(
    (nextId: string | null) => {
      const picked = nextId ? getPersonalCaseById(nextId) : null;
      setActiveCaseId(nextId);
      setStoreRevision((n) => n + 1);
      handleAgentSelectAttachedCase(nextId);
      if (personWorkspaceRef.current?.selfCard) {
        personWorkspaceRef.current.selfCard.setPerson(picked ?? loadTemporaryCase());
      }
      if (activeRoute === 'result' && isPersonalChartMethod(activeMethod) && picked) {
        void resultControllerRef.current?.refreshForActiveCase(picked);
      }
    },
    [activeMethod, activeRoute, handleAgentSelectAttachedCase, setStoreRevision],
  );

  // Divination derived module
  const activeDivMethod: DivinationFormMethod = isDivinationFormMethod(activeMethod)
    ? activeMethod
    : 'liuyao';
  const activeDivId: DivinationCenterMethod =
    currentDivinationMethod === 'number-energy' || activeMethod === 'number-energy'
      ? 'number-energy'
      : currentDivinationMethod === 'shiyue-oracle' ||
          String(activeMethod) === 'shiyue-oracle'
        ? 'shiyue-oracle'
        : activeDivMethod;

  const seededPerson = React.useMemo(() => {
    void activeRoute;
    const activePerson = getActiveOrTemporaryCase();
    const rules = loadGlobalRules();
    if (activePerson.isTemporary && !activePerson.birthPlace && rules.time.defaultBirthUseTrueSolar) {
      return {
        ...activePerson,
        useTrueSolarTime: true,
        birthPlace: rules.time.defaultPlaceDisplayName,
        longitude: rules.time.defaultPlaceLongitude,
        latitude: rules.time.defaultPlaceLatitude,
      };
    }
    return activePerson;
  }, [activeRoute, storeRevision]);

  const handleOpenVisualResultFromAgent = async (trace: AgentToolTrace) => {
    const { openVisualResultFromAgentAction } = await import('./workspace-agent-actions');
    await openVisualResultFromAgentAction({ navigateToRoute, openResult }, trace);
  };

  const topbarDomainTabs: ReadonlyArray<{ id: TopDomainId; label: string; onClick: () => void }> = [
    {
      id: 'home',
      label: '首页',
      onClick: () => navigateToRoute('home', { domain: 'home' }),
    },
    {
      id: 'fortune',
      label: '运势',
      onClick: () =>
        navigateToRoute('fortune', {
          featureId: 'fortune',
          method: 'fortune',
          domain: 'fortune',
        }),
    },
    {
      id: 'personal-chart',
      label: '命盘排盘',
      onClick: () =>
        navigateToRoute('chart-input', {
          featureId: preferredPersonalChartTab,
          method: preferredPersonalChartTab,
          domain: 'personal-chart',
        }),
    },
    {
      id: 'divination',
      label: '占卜起卦',
      onClick: () => {
        const baseMethod: DivinationCenterMethod = isStandaloneHomeMethod(currentDivinationMethod)
          ? 'liuyao'
          : currentDivinationMethod;
        if (baseMethod !== currentDivinationMethod) setCurrentDivinationMethod(baseMethod);
        const targetMethod: Method = baseMethod as Method;
        navigateToRoute('divination-input', {
          featureId: targetMethod,
          method: targetMethod,
          domain: 'divination',
        });
      },
    },
    {
      id: 'tools',
      label: '工具箱',
      onClick: () => navigateToRoute('tools', { domain: 'tools' }),
    },
  ];

  const showMobileBottomBar =
    activeRoute === 'home' ||
    activeRoute === 'chart-input' ||
    activeRoute === 'divination-input' ||
    activeRoute === 'me';

  const showMobileBack =
    activeRoute === 'result' ||
    activeRoute === 'fortune' ||
    activeRoute === 'cases' ||
    activeRoute === 'history' ||
    activeRoute === 'tools' ||
    activeRoute === 'time-reverse' ||
    activeRoute === 'utilities' ||
    activeRoute === 'connect' ||
    activeRoute === 'chat' ||
    (activeRoute === 'divination-input' && isStandaloneHomeMethod(activeMethod));

  const handleMobileBack = () => {
    if (activeRoute === 'time-reverse') {
      navigateToRoute('chart-input', {
        featureId: isCompatibilityMode ? 'compatibility' : preferredPersonalChartTab,
        method: isCompatibilityMode ? compatibilityMethod : preferredPersonalChartTab,
        domain: 'personal-chart',
      });
      return;
    }
    if (activeRoute === 'result') {
      if (mobileResultAssistantOpen && resultControllerRef.current?.isMobileAssistantOpen()) {
        resultControllerRef.current.setMobileAssistantOpen(false);
        return;
      }
      callbacksRef.current.onBackToForm(activeMethod);
      return;
    }
    if (activeRoute === 'utilities') {
      navigateToRoute('tools', { domain: activeDomainHint === 'me' ? 'me' : 'tools' });
      return;
    }
    const isNarrowMobile = typeof window !== 'undefined' && window.innerWidth < 680;
    if (
      isNarrowMobile &&
      (activeRoute === 'cases' ||
        activeRoute === 'history' ||
        activeRoute === 'connect' ||
        (activeRoute === 'tools' && activeDomainHint === 'me'))
    ) {
      navigateToRoute('me', { domain: 'me' });
      return;
    }
    navigateToRoute('home', { domain: 'home' });
  };

  const handleApplyShichenFromReverse = (
    shichenIndex: number,
    known: TimeReverseKnownInfo,
    openResultDirectly: boolean,
  ) => {
    const role = timeReverseContext?.role ?? 'self';
    const basePerson = timeReverseContext?.person ?? seededPerson;
    const nextPatch: Partial<PersonalCase> = {
      ...basePerson,
      ...(known.gender ? { gender: known.gender } : {}),
      calendar: known.calendar,
      dateType: known.calendar,
      isLeapMonth: known.calendar === 'lunar' ? known.isLeapMonth : false,
      ...(known.year.trim() ? { year: known.year.trim() } : {}),
      ...(known.month.trim() ? { month: known.month.trim() } : {}),
      ...(known.day.trim() ? { day: known.day.trim() } : {}),
      ...(known.birthPlace.trim() ? { birthPlace: known.birthPlace.trim() } : {}),
      ...(known.longitude !== undefined ? { longitude: known.longitude } : {}),
      ...(known.latitude !== undefined ? { latitude: known.latitude } : {}),
      ...(known.timezone !== undefined ? { timezone: known.timezone } : {}),
      ...(known.timeZoneId ? { timeZoneId: known.timeZoneId } : {}),
      useTrueSolarTime: false,
      timeIndex: shichenIndex,
      birthHour: '',
      birthMinute: '',
      birthSecond: '',
      reverseSource: null,
    };

    if (role === 'partner') {
      setPartnerSeed(nextPatch);
      navigateToRoute('chart-input', {
        featureId: 'compatibility',
        method: compatibilityMethod,
        domain: 'personal-chart',
      });
      return;
    }

    const savedOrUpdated =
      !basePerson.isTemporary && basePerson.id && basePerson.id !== 'temporary'
        ? upsertPersonalCase(nextPatch, basePerson.id)
        : saveTemporaryCase(nextPatch);
    setStoreRevision((n) => n + 1);

    if (openResultDirectly && !isCompatibilityMode) {
      const tab = preferredPersonalChartTab;
      navigateToRoute('result', {
        featureId: tab,
        method: tab,
        domain: 'personal-chart',
        resultRef: {
          mode: 'personal',
          ...(!savedOrUpdated.isTemporary &&
          savedOrUpdated.id &&
          savedOrUpdated.id !== 'temporary'
            ? { caseId: savedOrUpdated.id }
            : {}),
        },
      });
      void openResult({
        mode: 'personal',
        activeMethod: tab,
        person: savedOrUpdated,
      });
      return;
    }

    navigateToRoute('chart-input', {
      featureId: isCompatibilityMode ? 'compatibility' : preferredPersonalChartTab,
      method: isCompatibilityMode ? compatibilityMethod : preferredPersonalChartTab,
      domain: 'personal-chart',
    });
  };

  return (
    <div
      className={cn(
        'workspace-shell has-topbar-layout',
        activeRoute === 'result' && 'is-result-view',
        (activeRoute === 'chat' || hasActiveHomeChat) && 'is-chat-view',
        !showMobileBottomBar && 'is-mobile-bottombar-hidden',
      )}
    >
      {/* 1. 桌面端顶栏 */}
      <header className="workspace-topbar" aria-label="桌面端主导航顶栏">
        <div className="workspace-topbar-inner">
          <button
            type="button"
            className="workspace-brand workspace-topbar-brand"
            onClick={() => navigateToRoute('home', { domain: 'home' })}
          >
            {renderBrandSeal()}
            <span className="workspace-topbar-brand-copy">
              <strong>{APP_NAME}</strong>
            </span>
          </button>

          <nav className="workspace-topbar-nav" aria-label="核心功能领域">
            {topbarDomainTabs.map((tab) => {
              const isActive = activeDomain === tab.id;
              const warmTab = () =>
                preloadDomainAssets(tab.id, {
                  defaultChart: preferredPersonalChartTab,
                  defaultDivination: isStandaloneHomeMethod(currentDivinationMethod)
                    ? 'liuyao'
                    : (currentDivinationMethod as DivinationFormMethod),
                });
              return (
                <button
                  key={tab.id}
                  type="button"
                  onPointerEnter={warmTab}
                  onPointerDown={warmTab}
                  onFocus={warmTab}
                  onClick={tab.onClick}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn('workspace-topbar-tab', isActive && 'is-active')}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="workspace-topbar-actions">
            <GlobalCaseSwitcher
              variant="desktop"
              cases={sortedCases}
              activeCaseId={activeStoreCaseId}
              onSelectCase={handleGlobalSelectCase}
              onOpenManage={() => navigateToRoute('cases', { domain: 'cases' })}
              onNewCase={() => setCaseEditorState({ open: true, editingCase: null })}
            />
            {MERIT_BOX_URL ? (
              <a
                href={MERIT_BOX_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="workspace-topbar-action-btn inline-flex items-center gap-1.5 text-[var(--accent-strong)] no-underline"
              >
                <Heart className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden="true" />
                <span>功德箱</span>
              </a>
            ) : null}
            <button
              type="button"
              aria-label="历史记录"
              title="历史记录"
              aria-current={activeDomain === 'history' ? 'page' : undefined}
              className={cn(
                'workspace-topbar-action-btn inline-flex items-center gap-1.5',
                activeDomain === 'history' && 'is-active',
              )}
              onPointerEnter={() => preloadDomainAssets('history')}
              onPointerDown={() => preloadDomainAssets('history')}
              onFocus={() => preloadDomainAssets('history')}
              onClick={() => navigateToRoute('history', { domain: 'history' })}
            >
              <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden min-[920px]:inline">历史</span>
            </button>
            <button
              type="button"
              aria-label="设置"
              title="设置"
              className="workspace-topbar-action-btn inline-flex items-center gap-1.5"
              onPointerEnter={() => preloadDomainAssets('settings')}
              onPointerDown={() => preloadDomainAssets('settings')}
              onFocus={() => preloadDomainAssets('settings')}
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden min-[920px]:inline">设置</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. 移动端顶栏 */}
      <header className="workspace-mobile-header">
        <div className="workspace-mobile-header-left">
          {showMobileBack ? (
            <button
              type="button"
              className="workspace-mobile-back"
              aria-label={activeRoute === 'result' ? '返回修改' : '返回首页'}
              onClick={handleMobileBack}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          ) : (
            <button
              type="button"
              className="workspace-mobile-brand-btn"
              aria-label="返回首页"
              onClick={() => navigateToRoute('home', { domain: 'home' })}
            >
              {renderBrandSeal()}
            </button>
          )}
          <strong className="workspace-mobile-header-title">{resolveMobileTitle()}</strong>
        </div>

        <div className="workspace-mobile-header-right">
          {MERIT_BOX_URL ? (
            <a
              href={MERIT_BOX_URL}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="mobile-header-merit-box"
              className="inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[color-mix(in_srgb,var(--accent)_30%,var(--border-soft))] bg-[var(--accent-soft)] px-2.5 text-[11.5px] font-bold text-[var(--accent-strong)] no-underline"
            >
              <Heart className="h-3 w-3 shrink-0 fill-current" aria-hidden="true" />
              <span>功德箱</span>
            </a>
          ) : null}
          <GlobalCaseSwitcher
            variant="mobile"
            cases={sortedCases}
            activeCaseId={activeStoreCaseId}
            onSelectCase={handleGlobalSelectCase}
            onOpenManage={() => navigateToRoute('cases', { domain: 'cases' })}
            onNewCase={() => setCaseEditorState({ open: true, editingCase: null })}
          />
        </div>
      </header>

      {/* 3. 主画布与固定右侧卡片（右侧卡片停靠在留白区，不挤压主画布位置） */}
      <div className="workspace-body-split">
        <main
          className={cn(
            'workspace-main',
            activeRoute === 'home' && 'is-home',
            activeRoute === 'result' && 'is-result',
          )}
        >
          {activeRoute === 'home' && !hasActiveHomeChat ? (
            <HomeFortuneBar
              variant="mobile"
              homeFortune={homeFortunePreview}
              activeCase={selectedHomeCase}
              onPreload={() => preloadDomainAssets('fortune')}
              onClick={() => openCustomShortcutTarget('fortune')}
            />
          ) : null}
          <div className="workspace-page">
            <ChunkErrorBoundary
              resetKey={`${activeRoute}:${activeFeatureId}:${currentUtilityMainTab}:${currentNameCharSubTab}`}
            >
              <React.Suspense fallback={<WorkspaceSkeleton variant="page" />}>
                {activeRoute !== 'result' ? (
                  <div
                    key={`route:${activeRoute}`}
                    className={cn(
                      activeRoute === 'home' ? 'ws-fade-in' : 'ws-view-enter',
                      'w-full min-w-0',
                    )}
                  >
                    {/* 首页 */}
                    {activeRoute === 'home' ? (
              <HomePage
                caseCount={personalCases.length}
                activeCase={selectedHomeCase}
                homeFortune={homeFortunePreview}
                homeVisitRevision={homeVisitRevision}
                agentChat={
                  activeAgentSession
                    ? {
                        session: activeAgentSession,
                        cases: personalCases,
                        isRunning: agentRunning,
                        statusText: agentStatusText,
                        onlineAiActive: chatModeActive,
                        brandSeal: renderBrandSeal('hero'),
                        onSendMessage: handleAgentSendMessage,
                        onStop: handleAgentStop,
                        onNewChat: handleAgentNewChat,
                        onSelectAttachedCase: (caseId) => {
                          handleGlobalSelectCase(caseId);
                        },
                        onOpenConnect: () => navigateToRoute('connect', { domain: 'connect' }),
                        onOpenVisualResult: (trace) => {
                          void handleOpenVisualResultFromAgent(trace);
                        },
                        onApplyLocalAgentRecommendation: handleApplyLocalAgentRecommendation,
                      }
                    : undefined
                }
                onOpenChartInput={(mode) => {
                  if (mode === 'compat') {
                    navigateToRoute('chart-input', {
                      featureId: 'compatibility',
                      method: compatibilityMethod,
                      domain: 'personal-chart',
                    });
                  } else {
                    navigateToRoute('chart-input', {
                      featureId: preferredPersonalChartTab,
                      method: preferredPersonalChartTab,
                      domain: 'personal-chart',
                    });
                  }
                }}
                onOpenCasesDrawer={() => navigateToRoute('cases', { domain: 'cases' })}
                onOpenCustomShortcutTarget={openCustomShortcutTarget}
              />
            ) : null}

          {/* 命盘排盘（合并单人排盘与双人合盘） */}
          {activeRoute === 'chart-input' ? (
            <ChartInputView
              isCompatibilityMode={isCompatibilityMode}
              isRangeMode={isRangeMode}
              activeMethod={activeMethod}
              preferredPersonalChartTab={preferredPersonalChartTab}
              compatibilityMethod={compatibilityMethod}
              compatRelationship={compatRelationship}
              seededPerson={seededPerson}
              personalCases={sortedCases}
              partnerSeed={partnerSeed}
              rangeScanContext={rangeScanContext}
              sharedPlaceModal={sharedPlaceModal}
              personWorkspaceRef={personWorkspaceRef}
              personFormReady={personFormReady}
              chartError={chartError}
              onOpenCaseChart={openChartForCase}
              onSelectSingleMode={() =>
                navigateToRoute('chart-input', {
                  featureId: preferredPersonalChartTab,
                  method: preferredPersonalChartTab,
                  domain: 'personal-chart',
                })
              }
              onSelectCompatMode={() =>
                navigateToRoute('chart-input', {
                  featureId: 'compatibility',
                  method: compatibilityMethod,
                  domain: 'personal-chart',
                })
              }
              onOpenSettings={() => setSettingsOpen(true)}
              onBackFromRange={() =>
                navigateToRoute('chart-input', {
                  featureId: preferredPersonalChartTab,
                  method: preferredPersonalChartTab,
                  domain: 'personal-chart',
                })
              }
              onRangeScanComplete={(rangeMethod, payload, res) => {
                navigateToRoute('result', {
                  featureId: 'range',
                  method: rangeMethod,
                  domain: 'personal-chart',
                });
                void openResult({
                  mode: 'divination',
                  activeMethod: rangeMethod,
                  question: typeof payload.question === 'string' ? payload.question : undefined,
                  initialPayload: payload,
                  initialResult: res as {
                    summary?: unknown;
                    prompt?: { text: string };
                    data?: unknown;
                  },
                });
              }}
              onRequestCasePicker={(role, applyCase) => {
                if (!isCompatibilityMode) {
                  navigateToRoute('cases', { domain: 'cases' });
                  return;
                }
                setDrawerFillTarget({ role, applyCase });
                setDrawerTab('cases');
              }}
              onOpenTimeReverse={(person, role) => {
                if (role === 'self' && person.isTemporary) {
                  saveTemporaryCase(person);
                } else if (role === 'partner') {
                  setPartnerSeed(person);
                }
                setTimeReverseContext({ person, role });
                navigateToRoute('time-reverse', { domain: 'personal-chart' });
              }}
              onOpenRangeScan={(person, role) => {
                if (role === 'self' && person.isTemporary) {
                  saveTemporaryCase(person);
                }
                const targetRangeMethod =
                  preferredPersonalChartTab === 'qizheng' ? 'qizheng-range' : 'astrolabe-range';
                setRangeScanContext({ person, method: targetRangeMethod });
                navigateToRoute('chart-input', {
                  featureId: 'range',
                  method: targetRangeMethod,
                  domain: 'personal-chart',
                });
              }}
              onPartnerSeedChange={setPartnerSeed}
              onPersonFormReady={() => setPersonFormReady(true)}
              onCompatRelationshipChange={setCompatRelationship}
              onSubmit={() => void handleChartSubmit()}
            />
          ) : null}

          {/* 时辰逆推页 */}
          {activeRoute === 'time-reverse' ? (
            <TimeReversePage
              initialPerson={timeReverseContext?.person ?? seededPerson}
              role={timeReverseContext?.role ?? 'self'}
              birthPlaceModal={sharedPlaceModal}
              onBackToChartInput={() =>
                navigateToRoute('chart-input', {
                  featureId: isCompatibilityMode ? 'compatibility' : preferredPersonalChartTab,
                  method: isCompatibilityMode ? compatibilityMethod : preferredPersonalChartTab,
                  domain: 'personal-chart',
                })
              }
              onApplyShichen={handleApplyShichenFromReverse}
            />
          ) : null}

          {/* 占卜起卦 / 专项数术 */}
          {activeRoute === 'divination-input' ? (
            <DivinationInputView
              activeDivId={activeDivId}
              activeDivMethod={activeDivMethod}
              divinationLatestPayloadRef={divinationLatestPayloadRef}
              onNavigateHome={() => navigateToRoute('home', { domain: 'home' })}
              onSelectMethod={selectDivinationMethod}
              onExecuteDivination={(m, submitted) => {
                void executeDivination(m, submitted);
              }}
            />
          ) : null}

          {/* 择吉字理（合并择吉风水与字理词典） */}
          {activeRoute === 'utilities' ? (
            <UtilitiesView
              currentUtilityMainTab={currentUtilityMainTab}
              currentAlmanacSubTab={currentAlmanacSubTab}
              currentNameCharSubTab={currentNameCharSubTab}
              personalCases={personalCases}
              almanacPreset={almanacPreset}
              divinationLatestPayloadRef={divinationLatestPayloadRef}
              onNavigateHome={() => navigateToRoute('home', { domain: 'home' })}
              onNavigateToUtilities={navigateToUtilities}
              onOpenAlmanacPreset={(topic, participants) => {
                setAlmanacPreset({
                  topic,
                  participants,
                  nonce: Date.now(),
                });
                navigateToUtilities('almanac');
              }}
              onExecuteDivination={executeDivination}
              onOpenZhouyiResult={(payload, res) => {
                navigateToRoute('result', {
                  featureId: 'zhouyi',
                  method: 'zhouyi',
                  domain: 'utilities',
                });
                void openResult({
                  mode: 'divination',
                  activeMethod: 'zhouyi',
                  question: typeof payload.question === 'string' ? payload.question : undefined,
                  initialPayload: payload,
                  initialResult: res,
                });
              }}
            />
          ) : null}

          {/* AI 会话详情页（从历史记录打开） */}
          {activeRoute === 'chat' && activeAgentSession ? (
            <ChatPage
              sessions={agentSessions}
              activeSession={activeAgentSession}
              cases={personalCases}
              isRunning={agentRunning}
              statusText={agentStatusText}
              brandSeal={renderBrandSeal('hero')}
              onSelectSession={handleAgentSelectSession}
              onDeleteSession={handleAgentDeleteSession}
              onNewChat={handleAgentNewChat}
              onSendMessage={handleAgentSendMessage}
              onStop={handleAgentStop}
              onSelectAttachedCase={handleAgentSelectAttachedCase}
              onOpenConnect={() => navigateToRoute('connect', { domain: 'connect' })}
              onOpenVisualResult={(trace) => {
                void handleOpenVisualResultFromAgent(trace);
              }}
              onBack={() =>
                navigateToRoute(
                  activeDomainHint === 'history' ? 'history' : 'home',
                  { domain: activeDomainHint === 'history' ? 'history' : 'home' },
                )
              }
            />
          ) : null}

          {/* 历史记录独立页 */}
          {activeRoute === 'history' ? (
            <HistoryPage
              divinationRecords={divinationRecords}
              compatibilityRecords={compatibilityRecords}
              agentSessions={agentSessions}
              onSelectDivination={handleSelectHistoryDivination}
              onSelectCompatibility={handleSelectHistoryCompatibility}
              onSelectChatSession={handleSelectHistoryChat}
              onDeleteRecord={handleDeleteHistoryRecord}
            />
          ) : null}

          {/* 个人档案独立页 */}
          {activeRoute === 'cases' ? (
            <CasesPage
              cases={personalCases}
              activeCaseId={activeStoreCaseId}
              onSelectActiveCase={handleGlobalSelectCase}
              onNewCase={() => setCaseEditorState({ open: true, editingCase: null })}
              onEditCase={(record) => setCaseEditorState({ open: true, editingCase: record })}
              onOpenChart={openChartForCase}
              onTogglePin={(id) => {
                togglePersonalCasePin(id);
                setStoreRevision((n) => n + 1);
              }}
              onDeleteCase={(record) => {
                deletePersonalCase(record.id);
                setStoreRevision((n) => n + 1);
              }}
            />
          ) : null}

          {/* 运势模块（日运 · 月运 · 年运） */}
          {activeRoute === 'fortune' ? (
            <FortunePage
              cases={personalCases}
              initialCaseId={activeStoreCaseId}
              scope={fortuneScope}
              onScopeChange={(nextScope) => {
                setFortuneScope(nextScope);
                navigateToRoute('fortune', {
                  featureId: 'fortune',
                  method: 'fortune',
                  domain: 'fortune',
                  fortuneScope: nextScope,
                  historyMode: 'replace',
                });
              }}
              onSelectCase={handleGlobalSelectCase}
              onNewCase={() => setCaseEditorState({ open: true, editingCase: null })}
              onEditCase={(record) => setCaseEditorState({ open: true, editingCase: record })}
              onOpenConnect={() => navigateToRoute('connect', { domain: 'connect' })}
              onBackHome={() => navigateToRoute('home', { domain: 'home' })}
            />
          ) : null}

          {/* 工具箱聚合页 */}
          {activeRoute === 'tools' ? (
            <ToolsHubPage
              homeInstantTimeStandard={homeInstantTimeStandard}
              homeInstantPlace={homeInstantPlace}
              birthPlaceModal={sharedPlaceModal}
              onToggleTimeStandard={() =>
                setHomeInstantTimeStandard((s) => (s === 'beijing' ? 'true-solar' : 'beijing'))
              }
              onUpdateInstantPlace={setHomeInstantPlace}
              onOneClickInstantCast={handleOneClickInstantCast}
              onOpenShortcut={openCustomShortcutTarget}
            />
          ) : null}

          {/* 移动端个人中心（我的） */}
          {activeRoute === 'me' ? (
            <MePage
              activeCase={selectedHomeCase}
              caseCount={personalCases.length}
              historyCount={
                divinationRecords.length + compatibilityRecords.length + agentSessions.length
              }
              aiActive={chatModeActive}
              meritBoxUrl={MERIT_BOX_URL || undefined}
              onOpenCases={() => navigateToRoute('cases', { domain: 'cases' })}
              onNewCase={() => setCaseEditorState({ open: true, editingCase: null })}
              onOpenCaseChart={openChartForCase}
              onOpenHistory={() => navigateToRoute('history', { domain: 'history' })}
              onOpenTools={() => navigateToRoute('tools', { domain: 'me' })}
              onOpenFortune={() =>
                navigateToRoute('fortune', {
                  featureId: 'fortune',
                  method: 'fortune',
                  domain: 'fortune',
                })
              }
              onOpenConnect={() => navigateToRoute('connect', { domain: 'connect' })}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          ) : null}

          {/* AI 连接 */}
          {activeRoute === 'connect' ? (
            <ConnectPage
              onNavigateHome={() => navigateToRoute('home', { domain: 'home' })}
            />
          ) : null}
                  </div>
                ) : null}

          {/* 全宽结果页 */}
          {activeRoute === 'result' && !resultControllerReady ? (
            <WorkspaceSkeleton variant="page" />
          ) : null}
          <div
            ref={resultStageRef}
            hidden={activeRoute !== 'result' || !resultControllerReady}
            className={cn(
              'workspace-result-stage-host w-full min-w-0',
              activeRoute === 'result' && resultControllerReady && 'ws-view-enter',
            )}
          />
            </React.Suspense>
            </ChunkErrorBoundary>
        </div>
        </main>

        {/* 5. 表单内「从档案调取」临时抽屉选择器（仅在请求填表时按需加载） */}
        {drawerTab === 'cases' ? (
          <React.Suspense fallback={null}>
            <CasesDrawer
              open={drawerTab === 'cases'}
              onOpenChange={(next) => {
                if (!next) {
                  setDrawerTab(null);
                  setDrawerFillTarget(null);
                }
              }}
              cases={personalCases}
              fillTarget={drawerFillTarget}
              onNewCase={() => setCaseEditorState({ open: true, editingCase: null })}
              onEditCase={(record) => setCaseEditorState({ open: true, editingCase: record })}
              onFillCase={(record) => {
                if (drawerFillTarget) {
                  drawerFillTarget.applyCase(record, false);
                } else if (personWorkspaceRef.current) {
                  setActiveCaseId(record.id);
                  personWorkspaceRef.current.selfCard?.setPerson(record);
                }
                setDrawerTab(null);
                setDrawerFillTarget(null);
              }}
              onOpenChart={(record) => {
                setDrawerTab(null);
                openChartForCase(record);
              }}
              onTogglePin={(id) => {
                togglePersonalCasePin(id);
                setStoreRevision((n) => n + 1);
              }}
              onDeleteCase={(record) => {
                deletePersonalCase(record.id);
                setStoreRevision((n) => n + 1);
              }}
            />
          </React.Suspense>
        ) : null}

      </div>

      {/* 4. 移动端底部主导航栏（4 个核心一级 Tab：首页 · 命盘 · 占卜 · 我的，二级与结果页自动隐藏） */}
      {showMobileBottomBar ? (
        <nav
          className="workspace-mobile-bottombar"
          aria-label="移动端底部主导航"
        >
          {(
            [
              {
                id: 'home',
                Icon: Home,
                label: '首页',
                active: activeDomain === 'home',
                onClick: () => navigateToRoute('home', { domain: 'home' }),
              },
              {
                id: 'personal-chart',
                Icon: Compass,
                label: '命盘',
                active: activeDomain === 'personal-chart',
                onClick: () =>
                  navigateToRoute('chart-input', {
                    featureId: preferredPersonalChartTab,
                    method: preferredPersonalChartTab,
                    domain: 'personal-chart',
                  }),
              },
              {
                id: 'divination',
                Icon: Dices,
                label: '占卜',
                active: activeDomain === 'divination',
                onClick: () => {
                  const baseMethod: DivinationCenterMethod = isStandaloneHomeMethod(
                    currentDivinationMethod,
                  )
                    ? 'liuyao'
                    : currentDivinationMethod;
                  if (baseMethod !== currentDivinationMethod) setCurrentDivinationMethod(baseMethod);
                  const targetMethod: Method = baseMethod as Method;
                  navigateToRoute('divination-input', {
                    featureId: targetMethod,
                    method: targetMethod,
                    domain: 'divination',
                  });
                },
              },
              {
                id: 'me',
                Icon: User,
                label: '我的',
                active: activeDomain === 'me',
                onClick: () => navigateToRoute('me', { domain: 'me' }),
              },
            ] as const
          ).map(({ id, Icon, label, active, onClick }) => {
            const warmBottomTab = () =>
              preloadDomainAssets(id, {
                defaultChart: preferredPersonalChartTab,
                defaultDivination: isStandaloneHomeMethod(currentDivinationMethod)
                  ? 'liuyao'
                  : (currentDivinationMethod as DivinationFormMethod),
              });
            return (
              <button
                key={id}
                type="button"
                aria-current={active ? 'page' : undefined}
                className={cn('workspace-mobile-bottom-tab', active && 'is-active')}
                onPointerEnter={warmBottomTab}
                onPointerDown={warmBottomTab}
                onClick={onClick}
              >
                <span className="workspace-mobile-bottom-mark" aria-hidden="true">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                </span>
                <span className="workspace-mobile-bottom-label">{label}</span>
              </button>
            );
          })}
        </nav>
      ) : null}

      {/* 7. 个人档案新建 / 编辑弹窗（按需懒加载） */}
      <React.Suspense fallback={null}>
        {caseEditorState.open ? (
          <CaseEditorModal
            open={caseEditorState.open}
            editingCase={caseEditorState.editingCase}
            birthPlaceModal={sharedPlaceModal}
            onClose={() => setCaseEditorState({ open: false, editingCase: null })}
            onSaved={(saved) => {
              setStoreRevision((n) => n + 1);
              if (activeRoute === 'chart-input' && personWorkspaceRef.current) {
                personWorkspaceRef.current.selfCard?.setPerson(saved);
              } else if (activeRoute === 'result') {
                void resultControllerRef.current?.refreshForActiveCase(saved);
              }
            }}
          />
        ) : null}
      </React.Suspense>

      {/* 8. 工作台与术数设置弹窗（按需懒加载） */}
      <React.Suspense fallback={null}>
        {settingsOpen ? (
          <SettingsModal
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            preferences={preferences}
            birthPlaceModal={sharedPlaceModal}
            onSaveAll={(nextPrefs, nextRules) => {
              const savedPrefs = saveWorkspacePreferences(nextPrefs);
              saveGlobalRules(nextRules);
              setPreferences(savedPrefs);
              setPreferredPersonalChartTab(savedPrefs.defaultChartFeature);
              setCurrentDivinationMethod(savedPrefs.defaultDivinationFeature);
              setHomeInstantTimeStandard(nextRules.time.defaultTimeStandard);
              setHomeInstantPlace({
                displayName: nextRules.time.defaultPlaceDisplayName,
                longitude: nextRules.time.defaultPlaceLongitude,
                latitude: nextRules.time.defaultPlaceLatitude,
              });
            }}
            onOpenAiConnect={() => navigateToRoute('connect', { domain: 'connect' })}
          />
        ) : null}
      </React.Suspense>

      {/* 9. 共享 Radix 弹窗宿主（按需懒加载：出生地点 / 问题灵感 / 术语词典） */}
      <PortalModalsHost />
      <Toaster />
    </div>
  );
}
