import * as React from 'react';
import { Bot, ChevronLeft, HelpCircle, Settings } from 'lucide-react';
import { calculate, type Method } from '../core';
import { methodLabels } from '../schema';
import {
  SYNASTRY_RELATIONSHIP_OPTIONS,
  type SynastryRelationship,
} from '../systems/focus-presets';
import type { FortuneScope } from '../systems/fortune/types';
import { createBirthPlaceModal } from '../v2-ui/birth-place-modal';
import {
  deleteCompatibilityRecord,
  deleteDivinationRecord,
  deletePersonalCase,
  getActiveCaseId,
  getActiveOrTemporaryCase,
  getPersonalCaseById,
  loadCompatibilityRecords,
  loadDivinationRecords,
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
  PersonFormWorkspaceController,
  PersonRole,
} from '../v2-ui/person-form';
import { type TimeReverseKnownInfo } from '../v2-ui/time-reverse';
import {
  PERSONAL_CHART_TABS,
  buildCompatibilityChartPayload,
  isCompatibilityChartMethod,
  isDivinationFormMethod,
  isPersonalChartMethod,
  type CompatibilityChartTabId,
  type DivinationFormMethod,
  type PersonalChartTabId,
} from '../v2-ui/chart-payloads';
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
import { Button, Card, Input, PageHeader, SegmentedTabs, SubPillBar } from '../components/ui';
import { cn } from '../lib/utils';
import { CasesDrawer, type CaseFillTarget } from './components/CasesDrawer';
import { DomSlot } from './components/DomSlot';
import { HomeHistoryCard, HistoryPage } from './components/HistoryPanel';
import { HomePage } from './components/HomePage';
import type { LocalAgentApplyPayload } from './components/LocalAgentBar';
import { PortalModalsHost } from './components/PortalModalsHost';

const CaseEditorModal = React.lazy(() =>
  import('./components/CaseEditorModal').then((m) => ({ default: m.CaseEditorModal })),
);
const BirthRangeScanPanel = React.lazy(() =>
  import('./components/BirthRangeScanPanel').then((m) => ({ default: m.BirthRangeScanPanel })),
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
const TutorialModal = React.lazy(() =>
  import('./components/TutorialModal').then((m) => ({ default: m.TutorialModal })),
);
const ZhouyiLookupPanel = React.lazy(() =>
  import('./components/ZhouyiLookupPanel').then((m) => ({ default: m.ZhouyiLookupPanel })),
);
import {
  DIVINATION_FLAT_ITEMS,
  HOME_INSTANT_CAST_CATALOG,
  NAME_CHAR_SUB_TABS,
  UTILITY_MAIN_TABS,
  applyWorkspaceTheme,
  buildInstantPayload,
  initSavedDisplayThemeMode,
  readDrawerPinned,
  readHomeCustomization,
  readHomePinActionMode,
  readHomePinnedIds,
  readWorkspacePreferences,
  resetHomeCustomization,
  saveDrawerPinned,
  saveHomeCustomization,
  saveHomePinActionMode,
  saveHomePinnedIds,
  saveWorkspacePreferences,
  type DivinationCenterMethod,
  type HomeCustomizationState,
  type HomeModeId,
  type HomePinActionMode,
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
  loadResultSnapshot,
  parseWorkspaceLocation,
  resolveResultFallbackTarget,
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

const NUMBER_ENERGY_PLACEHOLDERS: Record<'phone' | 'plate' | 'general', string> = {
  phone: '请输入手机号码',
  plate: '请输入车牌号码',
  general: '请输入数字或编号序列',
};

export function WorkspaceApp({ bridge, sharedAiPane }: WorkspaceAppProps) {
  const [preferences, setPreferences] = React.useState<WorkspacePreferences>(() => {
    initSavedDisplayThemeMode();
    const prefs = readWorkspacePreferences();
    applyWorkspaceTheme(prefs.theme);
    return prefs;
  });

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
  const [currentNameCharSubTab, setCurrentNameCharSubTab] =
    React.useState<NameCharSubTabId>(initialLocation.nameCharSubTab ?? 'chinese-name');
  const [fortuneScope, setFortuneScope] = React.useState<FortuneScope>(
    initialLocation.fortuneScope ?? 'daily',
  );

  // Home state
  const [homePinActionMode, setHomePinActionMode] = React.useState<HomePinActionMode>(() =>
    readHomePinActionMode(),
  );
  const [homePinnedIds, setHomePinnedIds] = React.useState<string[]>(() => readHomePinnedIds());
  const [homeMode, setHomeMode] = React.useState<HomeModeId>('chart');
  const [homeDivinationFeature, setHomeDivinationFeature] =
    React.useState<DivinationCenterMethod>(preferences.defaultDivinationFeature);
  const [homeInstantChoice, setHomeInstantChoice] = React.useState<
    'bazi' | 'qimen' | 'liuren' | 'qizheng'
  >('bazi');
  const [homeInstantTimeStandard, setHomeInstantTimeStandard] = React.useState<
    'beijing' | 'true-solar'
  >(initialRules.time.defaultTimeStandard);
  const [homeInstantPlace, setHomeInstantPlace] = React.useState(() => ({
    displayName: initialRules.time.defaultPlaceDisplayName,
    longitude: initialRules.time.defaultPlaceLongitude,
    latitude: initialRules.time.defaultPlaceLatitude,
  }));
  const [homeSelectedCaseId, setHomeSelectedCaseId] = React.useState<string | null>(null);
  const [fortuneFocusCaseId, setFortuneFocusCaseId] = React.useState<string | null>(() => getActiveCaseId());
  const [homeCustomization, setHomeCustomization] = React.useState<HomeCustomizationState>(() =>
    readHomeCustomization(),
  );

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
  const [drawerPinned, setDrawerPinned] = React.useState<boolean>(() => readDrawerPinned());
  const [canDockDrawer, setCanDockDrawer] = React.useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  );
  React.useEffect(() => {
    const onResize = () => setCanDockDrawer(window.innerWidth >= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const dockActive = drawerTab !== null && canDockDrawer && drawerPinned;

  const [drawerFillTarget, setDrawerFillTarget] = React.useState<CaseFillTarget | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [tutorialOpen, setTutorialOpen] = React.useState(false);
  const [caseEditorState, setCaseEditorState] = React.useState<{
    open: boolean;
    editingCase: PersonalCase | null;
  }>({ open: false, editingCase: null });

  // Form states
  const [chartError, setChartError] = React.useState<string | null>(null);
  const [personFormReady, setPersonFormReady] = React.useState(false);
  const [numPurpose, setNumPurpose] = React.useState<'phone' | 'plate' | 'general'>('phone');
  const [numVal, setNumVal] = React.useState('');
  const [numError, setNumError] = React.useState<string | null>(null);
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
  const personWorkspaceRef = React.useRef<PersonFormWorkspaceController | null>(null);
  const divinationLatestPayloadRef = React.useRef<Record<string, unknown>>({});

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
    if (activeRoute === 'connect') return 'connect';
    if (activeRoute === 'utilities') return 'utilities';
    if (activeRoute === 'chart-input' || activeRoute === 'time-reverse') return 'personal-chart';
    if (activeRoute === 'divination-input') {
      return isStandaloneHomeMethod(activeMethod) ? 'home' : 'divination';
    }
    if (activeRoute === 'result') {
      if (isCompatibilityMode || isCompatibilityChartMethod(activeMethod)) return 'personal-chart';
      if (activeDomainHint === 'utilities') return 'utilities';
      if (isPersonalChartMethod(activeMethod) && activeDomainHint === 'personal-chart') {
        return 'personal-chart';
      }
      return isStandaloneHomeMethod(activeMethod) ? 'home' : 'divination';
    }
    return activeDomainHint;
  }, [activeRoute, activeDomainHint, activeMethod, isCompatibilityMode]);

  const activeDomain = resolveActiveTopDomain();
  const hasSideHistory =
    activeRoute === 'home' ||
    (activeRoute === 'divination-input' && !isStandaloneHomeMethod(activeMethod));

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
      return '命语';
    }
    if (activeDomain === 'chat') return 'AI 对话';
    if (activeDomain === 'fortune') return '流运运势';
    if (activeDomain === 'history') return '历史记录';
    if (activeDomain === 'personal-chart') {
      if (activeRoute === 'time-reverse') return '时辰逆推';
      if (activeRoute === 'result') {
        if (isCompatibilityMode || isCompatibilityChartMethod(activeMethod)) {
          return '双人合盘';
        }
        return activeMethod === 'minglu'
          ? '个人命录'
          : (PERSONAL_CHART_TABS.find((t) => t.id === activeMethod)?.label ??
            methodLabels[activeMethod] ??
            '命盘排盘');
      }
      if (isRangeMode) return '出生范围扫描';
      return isCompatibilityMode ? '双人合盘' : '命盘排盘';
    }
    if (activeDomain === 'utilities') return UTILITY_SINGLE_PAGE_TITLES[currentUtilityMainTab];
    if (activeDomain === 'connect') return '接入 AI';
    if (activeRoute === 'result') {
      return methodLabels[activeMethod] ?? '占卜排盘';
    }
    return '占卜起卦';
  };

  const activeResultMetaRef = React.useRef<{
    mode: ResultMode;
    caseId?: string;
    recordId?: string;
    featureId: string;
    domainHint: TopDomainId;
  }>({
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
    currentNameCharSubTab,
    activeAgentSessionId,
  });
  routeStateRef.current = {
    activeMethod,
    activeFeatureId,
    activeDomainHint,
    fortuneScope,
    currentUtilityMainTab,
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
        nameCharSubTab?: NameCharSubTabId;
        chatSessionId?: string;
        resultRef?: WorkspaceResultRef;
        historyMode?: 'push' | 'replace' | 'none';
      },
    ) => {
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
      setNumError(null);
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
        target === 'zhouyi'
      ) {
        setCurrentUtilityMainTab('name-char');
        setCurrentNameCharSubTab(target);
        navigateToRoute('utilities', {
          featureId: target,
          method: target,
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
          method: currentNameCharSubTab,
          domain: 'utilities',
          utilityMainTab: 'name-char',
          nameCharSubTab: currentNameCharSubTab,
        });
        return;
      }
      if (target === 'calendar') {
        setCurrentUtilityMainTab('calendar');
        navigateToRoute('utilities', {
          featureId: 'calendar',
          method: 'calendar',
          domain: 'utilities',
          utilityMainTab: 'calendar',
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
      const normalized: 'almanac' | 'residential' =
        target === 'almanac' ? 'almanac' : 'residential';
      setCurrentUtilityMainTab(normalized);
      navigateToRoute('utilities', {
        featureId: normalized,
        method: normalized,
        domain: 'utilities',
        utilityMainTab: normalized,
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
              onActiveResultChange: (m, p, r) => callbacksRef.current.onActiveResultChange(m, p, r),
              onMobileAssistantToggle: (open) => callbacksRef.current.onMobileAssistantToggle(open),
            });
          }
          return resultControllerRef.current;
        })
        .finally(() => {
          resultControllerPromiseRef.current = null;
        });
    }
    return resultControllerPromiseRef.current;
  }, [sharedAiPane]);

  const openResult = React.useCallback(
    async (ctx: Parameters<ResultPageController['openWithContext']>[0]) => {
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
      const snapshot = loadResultSnapshot();
      const refMode = parsed.resultRef?.mode;
      const refCaseId = parsed.resultRef?.caseId;
      const refRecordId = parsed.resultRef?.recordId;

      if (
        snapshot &&
        (snapshot.url === parsed.canonicalPath ||
          (snapshot.activeMethod === parsed.method &&
            (!refMode || snapshot.mode === refMode) &&
            (!refRecordId || snapshot.recordId === refRecordId) &&
            (!refCaseId || snapshot.caseId === refCaseId)))
      ) {
        activeResultMetaRef.current = {
          mode: snapshot.mode,
          caseId: snapshot.caseId,
          recordId: snapshot.recordId,
          featureId: snapshot.featureId || parsed.featureId,
          domainHint: snapshot.domainHint || parsed.domainHint,
        };
        await openResult({
          mode: snapshot.mode,
          activeMethod: snapshot.activeMethod,
          person: snapshot.person as PersonalCase | undefined,
          partner: snapshot.partner as PersonalCase | undefined,
          question: snapshot.question,
          initialPayload: snapshot.initialPayload,
          initialResult: snapshot.initialResult,
        });
        return;
      }

      if (refRecordId) {
        if (refMode === 'compatibility' || isCompatibilityChartMethod(parsed.method)) {
          const compatRec = loadCompatibilityRecords().find((r) => r.id === refRecordId);
          if (compatRec) {
            const tab: CompatibilityChartTabId = isCompatibilityChartMethod(parsed.method)
              ? parsed.method
              : isCompatibilityChartMethod(compatRec.method)
                ? compatRec.method
                : 'bazi-synastry';
            setCompatibilityMethod(tab);
            activeResultMetaRef.current = {
              mode: 'compatibility',
              recordId: compatRec.id,
              featureId: 'compatibility',
              domainHint: 'personal-chart',
            };
            await openResult({
              mode: 'compatibility',
              activeMethod: tab,
              person: compatRec.person1,
              partner: compatRec.person2,
              question: compatRec.question,
            });
            return;
          }
        } else {
          const divRec = loadDivinationRecords().find((r) => r.id === refRecordId);
          if (divRec) {
            let payload: Record<string, unknown> = {};
            try {
              payload = JSON.parse(divRec.inputJson) as Record<string, unknown>;
            } catch {}
            const method = parsed.method;
            const mode: ResultMode =
              isPersonalChartMethod(method) && parsed.domainHint === 'personal-chart'
                ? 'personal'
                : 'divination';
            activeResultMetaRef.current = {
              mode,
              recordId: divRec.id,
              featureId: parsed.featureId,
              domainHint: parsed.domainHint,
            };
            await openResult({
              mode,
              activeMethod: method,
              question: divRec.question,
              initialPayload: payload,
              initialResult: divRec.result as {
                summary?: unknown;
                prompt?: { text: string };
                data?: unknown;
              },
            });
            return;
          }
        }
      }

      if (refCaseId && isPersonalChartMethod(parsed.method)) {
        const foundCase = getPersonalCaseById(refCaseId);
        if (foundCase) {
          setActiveCaseId(foundCase.id);
          if (parsed.method !== 'minglu') {
            setPreferredPersonalChartTab(parsed.method);
          }
          activeResultMetaRef.current = {
            mode: 'personal',
            caseId: foundCase.id,
            featureId: parsed.method,
            domainHint: 'personal-chart',
          };
          await openResult({
            mode: 'personal',
            activeMethod: parsed.method,
            person: foundCase,
          });
          return;
        }
      }

      const fallback = resolveResultFallbackTarget({
        method: parsed.method,
        mode: parsed.resultRef?.mode,
        featureId: parsed.featureId,
        domainHint: parsed.domainHint,
      });
      navigateToRoute(fallback.route, {
        ...fallback,
        historyMode: 'replace',
      });
    },
    [navigateToRoute, openResult],
  );

  // Fresh handler ref for imperative resultController callbacks
  const callbacksRef = React.useRef<{
    onBackToForm: (method: Method) => void;
    onOpenSwitchPerson: () => void;
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
        const nextTab = method === 'minglu' ? preferredPersonalChartTab : method;
        if (method !== 'minglu') setPreferredPersonalChartTab(method);
        navigateToRoute('chart-input', {
          featureId: nextTab,
          method: nextTab,
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
      setDrawerFillTarget(null);
      setDrawerTab('cases');
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
      if (
        isPersonalChartMethod(method) &&
        method !== 'minglu' &&
        activeDomainHint === 'personal-chart'
      ) {
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

  const handleTogglePin = (id: string) => {
    setHomePinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      saveHomePinnedIds(next);
      return next;
    });
  };

  const handleHomePinActionChange = (next: HomePinActionMode) => {
    saveHomePinActionMode(next);
    setHomePinActionMode(next);
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
      const nextChart = itemId === 'minglu' ? preferredPersonalChartTab : itemId;
      if (itemId !== 'minglu') setPreferredPersonalChartTab(itemId);
      navigateToRoute('chart-input', {
        featureId: nextChart,
        method: nextChart,
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
      itemId === 'number-energy'
    ) {
      navigateToUtilities(itemId);
      return;
    }
    selectDivinationMethod(itemId as DivinationCenterMethod);
  };

  const pickRandomHomeCastId = (): string | null => {
    const candidates = homeCustomization.instantCastIds.filter(
      (id) =>
        id !== 'random-divination' && HOME_INSTANT_CAST_CATALOG.some((item) => item.id === id),
    );
    if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)]!;
  };

  const quickExecuteHomeTile = async (
    itemId: string,
    customQuestion?: string,
    castNumbers?: number[],
  ) => {
    const targetId = itemId === 'random-divination' ? pickRandomHomeCastId() : itemId;
    if (!targetId) return;

    const instantChartMap = {
      'instant-bazi': 'bazi',
      'instant-ziwei': 'ziwei',
      'instant-astrolabe': 'astrolabe',
      'instant-qizheng': 'qizheng',
    } as const;
    if (targetId in instantChartMap) {
      await launchInstantFromHome(
        customQuestion,
        instantChartMap[targetId as keyof typeof instantChartMap],
      );
      return;
    }

    const activeId = getActiveCaseId();
    const sorted = sortPersonalCases(personalCases, 'recent');
    const selectedHomeCase =
      (homeSelectedCaseId && sorted.find((c) => c.id === homeSelectedCaseId)) ||
      (activeId && sorted.find((c) => c.id === activeId)) ||
      sorted[0] ||
      null;

    if (isPersonalChartMethod(targetId)) {
      const person = selectedHomeCase ?? getActiveOrTemporaryCase();
      if (selectedHomeCase) setActiveCaseId(selectedHomeCase.id);
      if (targetId !== 'minglu') setPreferredPersonalChartTab(targetId);
      navigateToRoute('result', {
        featureId: targetId,
        method: targetId as Method,
        domain: 'personal-chart',
        resultRef: {
          mode: 'personal',
          ...(!person.isTemporary && person.id && person.id !== 'temporary'
            ? { caseId: person.id }
            : {}),
        },
      });
      await openResult({
        mode: 'personal',
        activeMethod: targetId as Method,
        person,
      });
      return;
    }

    const userQ = customQuestion?.trim() ?? '';
    const q = userQ || '未指定具体问题';
    let calcMethod: Method = 'liuren';
    let rawPayload: Record<string, unknown> = { question: q };

    if (targetId === 'liuren') {
      calcMethod = 'liuren';
      rawPayload = {
        question: q,
        liuren:
          homeInstantTimeStandard === 'true-solar'
            ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
            : { timeStandard: 'beijing' },
        prompt: { liurenTemplate: 'general' },
      };
    } else if (targetId === 'qimen') {
      calcMethod = 'qimen';
      rawPayload = {
        question: q,
        qimen: {
          method: '转盘',
          scope: 'hour',
          ...(homeInstantTimeStandard === 'true-solar'
            ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
            : { timeStandard: 'beijing' }),
        },
        prompt: { scope: 'hourly' },
      };
    } else if (targetId === 'tarot') {
      calcMethod = 'tarot';
      rawPayload = { question: q, tarot: { spread: 'three' } };
    } else if (targetId === 'lenormand') {
      calcMethod = 'lenormand';
      rawPayload = { question: q, lenormand: { spread: 'three' } };
    } else if (targetId === 'liuyao') {
      calcMethod = 'liuyao';
      rawPayload = { question: q, liuyao: { method: 'coins' }, prompt: { liuyaoTemplate: 'general' } };
    } else if (targetId === 'meihua') {
      calcMethod = 'meihua';
      const positiveNums = (castNumbers ?? []).filter((n) => Number.isInteger(n) && n > 0);
      if (positiveNums.length >= 2) {
        const combined = Number.parseInt(positiveNums.map(String).join(''), 10);
        rawPayload = {
          question: q,
          meihua: { method: 'number', number: Number.isFinite(combined) && combined > 0 ? combined : positiveNums[0] },
        };
      } else {
        rawPayload = { question: q, meihua: { method: 'time' } };
      }
    } else if (targetId === 'xiaoliuren') {
      calcMethod = 'xiaoliuren';
      const positiveNums = (castNumbers ?? []).filter((n) => Number.isInteger(n) && n > 0);
      rawPayload = {
        question: q,
        xiaoliuren: {
          rule: 'common',
          ...(positiveNums.length >= 3
            ? { numbers: [positiveNums[0]!, positiveNums[1]!, positiveNums[2]!] }
            : {}),
        },
      };
    } else if (targetId === 'jinkoujue') {
      calcMethod = 'jinkoujue';
      rawPayload = {
        question: q,
        jinkoujue: {
          method: 'time',
          ...(homeInstantTimeStandard === 'true-solar'
            ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
            : { timeStandard: 'beijing' }),
        },
      };
    } else if (targetId === 'ssgw') {
      calcMethod = 'ssgw';
      rawPayload = { question: q, ssgw: {} };
    } else if (targetId === 'zhuge') {
      calcMethod = 'zhuge';
      rawPayload = { question: q, zhuge: { method: 'coins' } };
    } else if (targetId === 'taiyi') {
      calcMethod = 'taiyi';
      rawPayload = {
        question: q,
        taiyi: {
          scope: 'hour',
          ...(homeInstantTimeStandard === 'true-solar'
            ? { timeStandard: 'true-solar', longitude: homeInstantPlace.longitude }
            : { timeStandard: 'beijing' }),
        },
      };
    } else {
      openHomeTileWorkbench(targetId);
      return;
    }

    const payload = applyGlobalRulesToPayload(calcMethod, rawPayload, true) as Record<
      string,
      unknown
    >;
    const res = (await calculate(calcMethod, payload)) as {
      summary?: unknown;
      prompt?: { text: string };
      data?: unknown;
    };
    const savedDiv = saveDivinationRecord({
      type: 'divination',
      method: calcMethod,
      question: userQ,
      caseId: null,
      inputJson: JSON.stringify(payload),
      result: res,
    });
    setCurrentDivinationMethod(calcMethod as DivinationCenterMethod);
    navigateToRoute('result', {
      featureId: calcMethod,
      method: calcMethod,
      domain: 'divination',
      resultRef: {
        mode: 'divination',
        recordId: savedDiv.id,
      },
    });
    await openResult({
      mode: 'divination',
      activeMethod: calcMethod,
      ...(userQ ? { question: userQ } : {}),
      initialPayload: payload,
      initialResult: res,
    });
  };

  const launchInstantFromHome = async (
    customQuestion?: string,
    overrideChoice?: 'bazi' | 'ziwei' | 'astrolabe' | 'qimen' | 'liuren' | 'qizheng',
  ) => {
    const choice = overrideChoice ?? homeInstantChoice;
    const userQ = customQuestion?.trim() ?? '';
    const q = userQ || '未指定具体问题';
    const { method, payload } = buildInstantPayload(
      choice,
      homeInstantTimeStandard,
      homeInstantPlace,
      q,
    );
    const res = (await calculate(method === 'qimen' || method === 'liuren' ? method : 'instant', payload)) as {
      summary?: unknown;
      prompt?: { text: string };
      data?: unknown;
    };
    const isDirectInstant = method === 'qimen' || method === 'liuren';
    const finalMethod: Method = isDirectInstant ? method : 'instant';
    const savedInstant = saveDivinationRecord({
      type: 'instant',
      method: finalMethod,
      question: userQ,
      ...(isDirectInstant
        ? {}
        : { instantType: choice as 'bazi' | 'ziwei' | 'astrolabe' | 'qizheng' }),
      timeStandard: homeInstantTimeStandard,
      inputJson: JSON.stringify(payload),
      result: res,
    });
    navigateToRoute('result', {
      featureId: finalMethod,
      method: finalMethod,
      domain: 'divination',
      resultRef: {
        mode: 'divination',
        recordId: savedInstant.id,
      },
    });
    await openResult({
      mode: 'divination',
      activeMethod: finalMethod,
      ...(userQ ? { question: userQ } : {}),
      initialPayload: payload,
      initialResult: res,
    });
  };

  const handleOneClickInstantCast = (itemId: string) => {
    void quickExecuteHomeTile(itemId);
  };

  const handleToggleHomeItem = (section: keyof HomeCustomizationState, id: string) => {
    setHomeCustomization((prev) => {
      const list = prev[section];
      const nextList = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
      const next = { ...prev, [section]: nextList };
      saveHomeCustomization(next);
      return next;
    });
  };

  const handleResetHomeCustomization = () => {
    setHomeCustomization(resetHomeCustomization());
  };

  const openCustomShortcutTarget = (id: string) => {
    if (id === 'cases') {
      setDrawerFillTarget(null);
      setDrawerTab('cases');
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
    const qText = payload.query.trim();
    pendingChartQuestionRef.current = qText;
    const toPersonalCasePatch = (
      profile: LocalAgentApplyPayload['profiles'][number],
      base: Partial<PersonalCase>,
      defaultName: string,
    ): PersonalCase => {
      const nowIso = new Date().toISOString();
      return {
        ...seededPerson,
        ...base,
        id: base.id || `temp-${Date.now()}`,
        isTemporary: true,
        name: profile.name || defaultName,
        gender: profile.gender ?? base.gender ?? 'male',
        calendar: profile.calendarType,
        dateType: profile.calendarType,
        isLeapMonth: Boolean(profile.isLeapMonth),
        year: String(profile.year),
        month: String(profile.month),
        day: String(profile.day),
        timeIndex: profile.timeIndex,
        birthHour: profile.hour !== undefined ? String(profile.hour) : '',
        birthMinute: profile.hour !== undefined ? String(profile.minute ?? 0) : '',
        birthSecond: profile.hour !== undefined ? String(profile.second ?? 0) : '',
        ...(profile.birthPlace
          ? {
              birthPlace: profile.birthPlace,
              latitude: profile.latitude ?? base.latitude,
              longitude: profile.longitude ?? base.longitude,
              ...(profile.timezone !== undefined ? { timezone: profile.timezone } : {}),
              ...(profile.timeZoneId ? { timeZoneId: profile.timeZoneId } : {}),
              useTrueSolarTime: true,
            }
          : {}),
        updatedAt: nowIso,
      };
    };

    let firstCase: PersonalCase | null = null;
    let secondCase: PersonalCase | null = null;
    const attachedCase = payload.attachedCaseId ? getPersonalCaseById(payload.attachedCaseId) : null;
    if (payload.profiles.length >= 2) {
      setActiveCaseId(null);
      firstCase = toPersonalCasePatch(payload.profiles[0]!, seededPerson, '命主一');
      saveTemporaryCase(firstCase);
      secondCase = toPersonalCasePatch(
        payload.profiles[1]!,
        partnerSeed ?? seededPerson,
        '命主二',
      );
      setPartnerSeed(secondCase);
    } else if (payload.profiles.length === 1) {
      if (attachedCase && isCompatibilityChartMethod(payload.method)) {
        firstCase = attachedCase;
        secondCase = toPersonalCasePatch(
          payload.profiles[0]!,
          partnerSeed ?? seededPerson,
          '命主二',
        );
        setPartnerSeed(secondCase);
      } else {
        setActiveCaseId(null);
        firstCase = toPersonalCasePatch(payload.profiles[0]!, seededPerson, '命主一');
        saveTemporaryCase(firstCase);
      }
    } else if (attachedCase) {
      firstCase = attachedCase;
    }
    const rel = payload.relationship ?? compatRelationship;
    if (payload.relationship) {
      setCompatRelationship(payload.relationship);
    }

    const method = payload.method;

    // 1. 双人合盘：已提取双方生辰 -> 直接出合盘结果与提示词；不足两人 -> 跳表单补齐
    if (isCompatibilityChartMethod(method) || payload.profiles.length >= 2) {
      const targetCompatMethod: CompatibilityChartTabId = isCompatibilityChartMethod(method)
        ? method
        : 'bazi-synastry';
      setCompatibilityMethod(targetCompatMethod);
      const needsExactTime = targetCompatMethod === 'astrolabe-synastry';
      const canDirectRun =
        Boolean(firstCase && secondCase) &&
        (!needsExactTime ||
          (firstCase!.timeIndex !== 'unknown' && secondCase!.timeIndex !== 'unknown'));

      if (canDirectRun && firstCase && secondCase) {
        pendingChartQuestionRef.current = '';
        const compatPayload = buildCompatibilityChartPayload(
          firstCase,
          secondCase,
          targetCompatMethod,
          qText,
          { relationship: rel },
        );
        const savedCompat = upsertCompatibilityRecord(firstCase, secondCase, {
          method: targetCompatMethod,
          question: qText,
          inputJson: JSON.stringify(compatPayload),
        });
        navigateToRoute('result', {
          featureId: 'compatibility',
          method: targetCompatMethod,
          domain: 'personal-chart',
          resultRef: {
            mode: 'compatibility',
            recordId: savedCompat.id,
          },
        });
        await openResult({
          mode: 'compatibility',
          activeMethod: targetCompatMethod,
          person: firstCase,
          partner: secondCase,
          compatibilityRelationship: rel,
          ...(qText ? { question: qText } : {}),
        });
        return;
      }

      navigateToRoute('chart-input', {
        featureId: 'compatibility',
        method: targetCompatMethod,
        domain: 'personal-chart',
      });
      return;
    }

    // 2. 单人命盘：已提取生辰且满足时辰要求 -> 直接出盘面结果与提示词；缺生辰 -> 跳表单补齐
    if (isPersonalChartMethod(method)) {
      setPreferredPersonalChartTab(method);
      const needsExactTime = method === 'astrolabe' || method === 'qizheng' || method === 'minglu';
      const canDirectRun =
        Boolean(firstCase) && (!needsExactTime || firstCase!.timeIndex !== 'unknown');

      if (canDirectRun && firstCase) {
        pendingChartQuestionRef.current = '';
        navigateToRoute('result', {
          featureId: method,
          method,
          domain: 'personal-chart',
          resultRef: { mode: 'personal' },
        });
        await openResult({
          mode: 'personal',
          activeMethod: method,
          person: firstCase,
          ...(qText ? { question: qText } : {}),
        });
        return;
      }

      navigateToRoute('chart-input', {
        featureId: method,
        method,
        domain: 'personal-chart',
      });
      return;
    }

    // 3. 数字能量：已提取手机号/车牌号 -> 直接出测算结果
    if (method === 'number-energy' && payload.structured.numberEnergy) {
      const val = payload.structured.numberEnergy;
      setNumVal(val);
      const purpose = /^1[3-9]\d{9}$/.test(val)
        ? 'phone'
        : /^[京津沪渝冀豫云辽黑湘皖鲁新苏浙赣鄂桂甘晋蒙陕吉闽贵粤青藏川宁琼]/.test(val)
          ? 'plate'
          : 'general';
      await executeDivination('number-energy', {
        value: val,
        purpose,
        question: qText || '请分析这组号码的八星磁场分布与数理吉凶。',
      });
      return;
    }

    // 4. 姓名评测：已提取目标姓名 -> 直接出评测结果
    if (method === 'chinese-name' && payload.structured.targetName) {
      await executeDivination('chinese-name', {
        fullName: payload.structured.targetName,
        question: qText || `请综合评测姓名「${payload.structured.targetName}」的音形义与数理吉凶。`,
      });
      return;
    }

    // 5. 即时占卜（六爻/梅花/奇门/六壬/小六壬/金口诀/塔罗/雷诺曼/灵签/诸葛/太乙/随机起卦）-> 直接本地起卦直出结果
    const directDivinationMethods = new Set<string>([
      'liuyao',
      'meihua',
      'qimen',
      'liuren',
      'jinkoujue',
      'xiaoliuren',
      'tarot',
      'lenormand',
      'ssgw',
      'zhuge',
      'taiyi',
      'random-divination',
    ]);
    if (directDivinationMethods.has(method)) {
      await quickExecuteHomeTile(method, qText, payload.structured.castNumbers);
      return;
    }

    // 6. 其他需要专用参数的工具（如玄空飞星/择吉/起名）-> 跳对应表单页并自动带入问题
    openHomeTileWorkbench(method);

    if (qText && typeof window !== 'undefined') {
      window.setTimeout(() => {
        const input = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
          '.workspace-divination-page textarea.workspace-ui-control, .workspace-divination-page input[placeholder*="问"], .workspace-divination-page textarea[placeholder*="问"]',
        );
        if (input && !input.value.trim()) {
          input.value = qText;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 60);
    }
  };

  const handleToggleDrawerDock = () => {
    setDrawerPinned((prev) => {
      const next = !prev;
      saveDrawerPinned(next);
      return next;
    });
  };

  const executeDivination = async (method: Method, rawPayload: Record<string, unknown>) => {
    const payload = applyGlobalRulesToPayload(method, rawPayload, method !== 'random-divination') as Record<
      string,
      unknown
    >;
    const res = (await calculate(method, payload)) as {
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

  const handleNumberEnergySubmit = async () => {
    if (!numVal.trim()) {
      setNumError('请先输入号码或数字序列后再开始推演。');
      return;
    }
    setNumError(null);
    const payload = {
      value: numVal.trim(),
      purpose: numPurpose,
      question: '请分析这组号码的八星磁场分布与数理吉凶。',
    };
    const res = (await calculate('number-energy', payload)) as {
      summary?: unknown;
      prompt?: { text: string };
      data?: unknown;
    };
    const savedNum = saveDivinationRecord({
      type: 'divination',
      method: 'number-energy',
      question: payload.question,
      caseId: null,
      inputJson: JSON.stringify(payload),
      result: res,
    });
    navigateToRoute('result', {
      featureId: 'number-energy',
      method: 'number-energy',
      domain: 'utilities',
      resultRef: {
        mode: 'divination',
        recordId: savedNum.id,
      },
    });
    await openResult({
      mode: 'divination',
      activeMethod: 'number-energy',
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
  const activeStoreCaseId = getActiveCaseId();
  const selectedHomeCase =
    (homeSelectedCaseId && sortedCases.find((c) => c.id === homeSelectedCaseId)) ||
    (activeStoreCaseId && sortedCases.find((c) => c.id === activeStoreCaseId)) ||
    sortedCases[0] ||
    null;

  // Divination derived module
  const activeDivMethod: DivinationFormMethod = isDivinationFormMethod(activeMethod)
    ? activeMethod
    : 'liuyao';
  const activeDivId: DivinationCenterMethod =
    currentDivinationMethod === 'number-energy' || activeMethod === 'number-energy'
      ? 'number-energy'
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
    const { restoreToolTraceResult } = await import('../web-agent');
    const restored = await restoreToolTraceResult(trace);
    if (!restored) return;
    const targetMethod = restored.method;
    const domain: TopDomainId = isPersonalChartMethod(targetMethod)
      ? 'personal-chart'
      : 'divination';
    navigateToRoute('result', {
      featureId: targetMethod,
      method: targetMethod,
      domain,
    });
    await openResult({
      mode: 'divination',
      activeMethod: targetMethod,
      question: trace.question,
      initialPayload: restored.payload,
      initialResult: restored.result,
    });
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
      id: 'connect',
      label: '接入 AI',
      onClick: () => navigateToRoute('connect', { domain: 'connect' }),
    },
  ];

  const showMobileBack =
    activeRoute === 'result' ||
    activeRoute === 'fortune' ||
    activeRoute === 'time-reverse' ||
    activeRoute === 'utilities' ||
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
    <div className="workspace-shell has-topbar-layout">
      {/* 1. 桌面端顶栏 */}
      <header className="workspace-topbar" aria-label="桌面端主导航顶栏">
        <div className="workspace-topbar-inner">
          <button
            type="button"
            className="workspace-brand workspace-topbar-brand"
            onClick={() => navigateToRoute('home', { domain: 'home' })}
          >
            <span className="workspace-brand-seal" aria-hidden="true">
              命
            </span>
            <span className="workspace-topbar-brand-copy">
              <strong>命语</strong>
            </span>
          </button>

          <nav className="workspace-topbar-nav" aria-label="核心功能领域">
            {topbarDomainTabs.map((tab) => {
              const isActive =
                activeDomain === tab.id || (tab.id === 'home' && activeDomain === 'utilities');
              return (
                <button
                  key={tab.id}
                  type="button"
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
            <button
              type="button"
              className="workspace-topbar-action-btn inline-flex items-center gap-1.5"
              onClick={() => setTutorialOpen(true)}
            >
              <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>使用指南</span>
            </button>
            <button
              type="button"
              className="workspace-topbar-action-btn inline-flex items-center gap-1.5"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" />
              <span>设置</span>
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
              <span className="workspace-brand-seal" aria-hidden="true">
                命
              </span>
            </button>
          )}
          <strong className="workspace-mobile-header-title">{resolveMobileTitle()}</strong>
        </div>

        <div className="workspace-mobile-header-right">
          <button
            type="button"
            aria-label="接入 AI"
            title="接入 AI"
            className={cn(
              'workspace-mobile-header-icon-btn inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 transition-colors cursor-pointer',
              activeDomain === 'connect'
                ? 'is-active bg-[var(--state-selected-surface)] text-[var(--state-selected-text)]'
                : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-strong)]',
            )}
            onClick={() => navigateToRoute('connect', { domain: 'connect' })}
          >
            <Bot className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="设置"
            title="设置"
            className={cn(
              'workspace-mobile-header-icon-btn inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 transition-colors cursor-pointer',
              settingsOpen
                ? 'is-active bg-[var(--state-selected-surface)] text-[var(--state-selected-text)]'
                : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-strong)]',
            )}
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* 3. 主画布与固定右侧卡片（右侧卡片停靠在留白区，不挤压主画布位置） */}
      <div className="workspace-body-split">
        <main
          className={cn(
            'workspace-main',
            activeRoute === 'home' && 'is-home',
            hasSideHistory && 'has-side-history',
            activeRoute === 'result' && 'is-result',
          )}
        >
          <div className="workspace-page">
            <React.Suspense
              fallback={
                <div className="workspace-ui-card p-6 text-sm text-[var(--text-muted)]">
                  正在加载页面模块…
                </div>
              }
            >
            {/* 首页 */}
            {activeRoute === 'home' ? (
              <HomePage
                homeInstantTimeStandard={homeInstantTimeStandard}
                homeInstantPlace={homeInstantPlace}
                homeCustomization={homeCustomization}
                caseCount={personalCases.length}
                cases={personalCases}
                attachedCaseId={activeAgentSession?.attachedCaseId ?? getActiveCaseId()}
                onSelectAttachedCase={(caseId) => {
                  handleAgentSelectAttachedCase(caseId);
                  setActiveCaseId(caseId);
                  setStoreRevision((v) => v + 1);
                }}
                birthPlaceModal={sharedPlaceModal}
                chatModeActive={chatModeActive}
                homeVisitRevision={homeVisitRevision}
                agentChat={
                  activeAgentSession
                    ? {
                        session: activeAgentSession,
                        cases: personalCases,
                        isRunning: agentRunning,
                        statusText: agentStatusText,
                        onSendMessage: handleAgentSendMessage,
                        onStop: handleAgentStop,
                        onNewChat: handleAgentNewChat,
                        onSelectAttachedCase: handleAgentSelectAttachedCase,
                        onOpenConnect: () => navigateToRoute('connect', { domain: 'connect' }),
                        onOpenVisualResult: (trace) => {
                          void handleOpenVisualResultFromAgent(trace);
                        },
                      }
                    : undefined
                }
                onToggleTimeStandard={() =>
                  setHomeInstantTimeStandard((s) => (s === 'beijing' ? 'true-solar' : 'beijing'))
                }
                onUpdateInstantPlace={setHomeInstantPlace}
                onOneClickInstantCast={handleOneClickInstantCast}
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
                onOpenCasesDrawer={() => {
                  setDrawerFillTarget(null);
                  setDrawerTab('cases');
                }}
                onOpenCustomShortcutTarget={openCustomShortcutTarget}
                onToggleHomeItem={handleToggleHomeItem}
                onResetHomeCustomization={handleResetHomeCustomization}
                onApplyLocalAgentRecommendation={handleApplyLocalAgentRecommendation}
              />
            ) : null}

          {/* 命盘排盘（合并单人排盘与双人合盘） */}
          {activeRoute === 'chart-input' ? (
            <div
              className={cn(
                'workspace-ui-screen workspace-input-page',
                isCompatibilityMode ? 'is-wide is-compatibility' : 'is-narrow',
              )}
            >
              <PageHeader
                title="命盘排盘"
                tabsAriaLabel="排盘模式切换"
                activeTab={isCompatibilityMode ? 'compat' : 'single'}
                tabs={[
                  { id: 'single', label: '单人排盘' },
                  { id: 'compat', label: '双人合盘' },
                ]}
                onTabChange={(nextMode) => {
                  if (nextMode === 'compat') {
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
                rightSlot={
                  <Button
                    variant="secondary"
                    size="sm"
                    className="ws-desktop-only-action"
                    onClick={() => setSettingsOpen(true)}
                  >
                    <Settings className="h-3.5 w-3.5" />
                    <span>排盘偏好</span>
                  </Button>
                }
              />

              {isRangeMode ? (
                <BirthRangeScanPanel
                  birthPlaceModal={sharedPlaceModal}
                  initialMethod={
                    activeMethod === 'qizheng-range'
                      ? 'qizheng-range'
                      : rangeScanContext?.method ??
                        (preferredPersonalChartTab === 'qizheng' ? 'qizheng-range' : 'astrolabe-range')
                  }
                  initialPerson={rangeScanContext?.person ?? seededPerson}
                  onBack={() =>
                    navigateToRoute('chart-input', {
                      featureId: preferredPersonalChartTab,
                      method: preferredPersonalChartTab,
                      domain: 'personal-chart',
                    })
                  }
                  onScanComplete={(rangeMethod, payload, res) => {
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
                />
              ) : (
                <>
                  <DomSlot
                    deps={[isCompatibilityMode, preferredPersonalChartTab]}
                    mount={(container) => {
                      let disposed = false;
                      let ws: PersonFormWorkspaceController | null = null;
                      setPersonFormReady(false);
                      void import('../v2-ui/person-form').then(({ createPersonFormWorkspace }) => {
                        if (disposed) return;
                        ws = createPersonFormWorkspace({
                          mode: isCompatibilityMode ? 'compatibility' : 'single',
                          method: isCompatibilityMode ? 'bazi-synastry' : preferredPersonalChartTab,
                          initialSelf: seededPerson,
                          ...(partnerSeed ? { initialPartner: partnerSeed } : {}),
                          defaultSaveToCase: true,
                          onRequestCasePicker: (role, applyCase) => {
                            setDrawerFillTarget(isCompatibilityMode ? { role, applyCase } : null);
                            setDrawerTab('cases');
                          },
                          onOpenTimeReverse: (person, role) => {
                            if (role === 'self' && person.isTemporary) {
                              saveTemporaryCase(person);
                            } else if (role === 'partner') {
                              setPartnerSeed(person);
                            }
                            setTimeReverseContext({ person, role });
                            navigateToRoute('time-reverse', { domain: 'personal-chart' });
                          },
                          onOpenRangeScan: (person, role) => {
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
                          },
                          onChange: (state) => {
                            if (state.self.isTemporary) {
                              saveTemporaryCase(state.self);
                            }
                            if (state.partner) {
                              setPartnerSeed(state.partner);
                            }
                          },
                        });
                        personWorkspaceRef.current = ws;
                        container.replaceChildren(ws.element);
                        setPersonFormReady(true);
                      });
                      return () => {
                        disposed = true;
                        setPersonFormReady(false);
                        if (ws) {
                          ws.destroy();
                          if (personWorkspaceRef.current === ws) {
                            personWorkspaceRef.current = null;
                          }
                        }
                      };
                    }}
                  />

                  <section className="workspace-ui-form-surface workspace-chart-actions-surface">
                    {isCompatibilityMode ? (
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-[var(--text-secondary)]">
                          合盘场景
                        </span>
                        <div className="workspace-prompt-focus-pills" role="group" aria-label="选择合盘关系场景">
                          {SYNASTRY_RELATIONSHIP_OPTIONS.map((opt) => {
                            const isActive = compatRelationship === opt.value;
                            return (
                              <button
                                key={opt.value}
                                type="button"
                                aria-pressed={isActive}
                                onClick={() => setCompatRelationship(opt.value)}
                                className={`workspace-prompt-focus-pill${isActive ? ' is-active' : ''}`}
                              >
                                {opt.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {chartError ? <div className="workspace-ui-form-error">{chartError}</div> : null}
                    <div className="workspace-ui-form-actions is-sticky-mobile">
                      {personFormReady ? (
                        <Button
                          variant="primary"
                          size="lg"
                          onClick={() => void handleChartSubmit()}
                        >
                          {isCompatibilityMode ? '开始合盘' : '开始排盘'}
                        </Button>
                      ) : (
                        <Button variant="primary" size="lg" disabled>
                          正在加载生辰表单…
                        </Button>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
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
            <div className="workspace-ui-screen workspace-focused-page workspace-divination-page is-narrow">
              {isStandaloneHomeMethod(activeDivId) ? (
                <PageHeader
                  title={methodLabels[activeDivMethod] ?? activeDivId}
                  rightSlot={
                    <Button
                      variant="secondary"
                      size="sm"
                      className="ws-desktop-only-action"
                      onClick={() => navigateToRoute('home', { domain: 'home' })}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>返回首页</span>
                    </Button>
                  }
                />
              ) : (
                <>
                  <PageHeader title="占卜起卦" />
                  <SubPillBar
                    ariaLabel="占卜术数选择"
                    value={activeDivId}
                    items={DIVINATION_FLAT_ITEMS}
                    onValueChange={(nextId) => selectDivinationMethod(nextId)}
                  />
                </>
              )}

              <DomSlot
                deps={[activeDivMethod]}
                mount={(container) => {
                  let cancelled = false;
                  divinationLatestPayloadRef.current = {};
                  container.textContent = '正在加载起卦表单…';
                  void import('../v2-ui/divination-forms').then(({ renderDivinationForm }) => {
                    if (cancelled) return;
                    container.replaceChildren();
                    renderDivinationForm({
                      container,
                      method: activeDivMethod,
                      showSubmitButton: true,
                      onChange: (next) => {
                        divinationLatestPayloadRef.current = next;
                      },
                      onSubmit: (submitted) => {
                        void executeDivination(
                          activeDivMethod,
                          submitted ?? divinationLatestPayloadRef.current,
                        );
                      },
                    });
                  });
                  return () => {
                    cancelled = true;
                    container.replaceChildren();
                  };
                }}
              />
            </div>
          ) : null}

          {/* 择吉字理（合并择吉风水与字理词典） */}
          {activeRoute === 'utilities' ? (
            <div
              className={cn(
                'workspace-ui-screen workspace-focused-page',
                currentUtilityMainTab === 'almanac' || currentUtilityMainTab === 'residential'
                  ? `workspace-divination-page is-wide is-timing-domain${
                      currentUtilityMainTab === 'almanac' ? ' is-almanac' : ''
                    }`
                  : currentUtilityMainTab === 'number-energy'
                    ? 'workspace-divination-page is-narrow'
                    : 'w-full min-w-0',
              )}
            >
              <PageHeader
                title={UTILITY_SINGLE_PAGE_TITLES[currentUtilityMainTab]}
                rightSlot={
                  <Button
                    variant="secondary"
                    size="sm"
                    className="ws-desktop-only-action"
                    onClick={() => navigateToRoute('home', { domain: 'home' })}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>返回首页</span>
                  </Button>
                }
              />

              <SubPillBar
                ariaLabel="实用工具模块"
                value={currentUtilityMainTab}
                items={UTILITY_MAIN_TABS}
                onValueChange={(next) => navigateToUtilities(next)}
              />

              {currentUtilityMainTab === 'name-char' ? (
                <>
                  <SubPillBar
                    ariaLabel="汉字经籍子模块"
                    value={currentNameCharSubTab}
                    items={NAME_CHAR_SUB_TABS}
                    onValueChange={(next) => navigateToUtilities(next)}
                  />
                  {currentNameCharSubTab === 'zhouyi' ? (
                    <ZhouyiLookupPanel
                      onOpenInResult={(payload, res) => {
                        navigateToRoute('result', {
                          featureId: 'zhouyi',
                          method: 'zhouyi',
                          domain: 'utilities',
                        });
                        void openResult({
                          mode: 'divination',
                          activeMethod: 'zhouyi',
                          question:
                            typeof payload.question === 'string' ? payload.question : undefined,
                          initialPayload: payload,
                          initialResult: res as {
                            summary?: unknown;
                            prompt?: { text: string };
                            data?: unknown;
                          },
                        });
                      }}
                    />
                  ) : (
                    <DomSlot
                      className="workspace-culture-page w-full min-w-0"
                      deps={[currentNameCharSubTab]}
                      mount={(container) => {
                        let cancelled = false;
                        container.textContent = '正在加载字理工具…';
                        void import('../v2-ui/culture-and-calendar').then(({ renderCultureToolsPage }) => {
                          if (cancelled) return;
                          container.replaceChildren();
                          renderCultureToolsPage({
                            container,
                            initialMethod: currentNameCharSubTab,
                            hideHeader: true,
                          });
                        });
                        return () => {
                          cancelled = true;
                          container.replaceChildren();
                        };
                      }}
                    />
                  )}
                </>
              ) : null}

              {currentUtilityMainTab === 'calendar' ? (
                <DomSlot
                  className="workspace-culture-page w-full min-w-0"
                  deps={['calendar']}
                  mount={(container) => {
                    let cancelled = false;
                    container.textContent = '正在加载万年历…';
                    void import('../v2-ui/culture-and-calendar').then(({ renderCalendarPage }) => {
                      if (cancelled) return;
                      container.replaceChildren();
                      renderCalendarPage({
                        container,
                        initialMethod: 'calendar',
                        hideHeader: true,
                      });
                    });
                    return () => {
                      cancelled = true;
                      container.replaceChildren();
                    };
                  }}
                />
              ) : null}

              {currentUtilityMainTab === 'number-energy' ? (
                <Card className="grid gap-3.5 p-4 sm:p-5">
                  <div className="grid gap-1.5">
                    <span className="text-xs font-bold text-[var(--text-strong)]">号码类型</span>
                    <SegmentedTabs
                      value={numPurpose}
                      onValueChange={(next) => {
                        setNumPurpose(next);
                        setNumError(null);
                      }}
                      options={[
                        { id: 'phone', label: '手机号码' },
                        { id: 'plate', label: '车牌号码' },
                        { id: 'general', label: '通用数字/编号' },
                      ]}
                    />
                  </div>
                  <label className="grid gap-1.5 text-xs font-bold text-[var(--text-strong)]">
                    <span>输入号码或数字序列</span>
                    <Input
                      type="text"
                      value={numVal}
                      placeholder={NUMBER_ENERGY_PLACEHOLDERS[numPurpose]}
                      onChange={(e) => {
                        setNumVal(e.target.value);
                        if (e.target.value.trim()) setNumError(null);
                      }}
                    />
                  </label>
                  {numError ? <div className="workspace-ui-form-error">{numError}</div> : null}
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full"
                    onClick={() => void handleNumberEnergySubmit()}
                  >
                    立即推演数字命理 →
                  </Button>
                </Card>
              ) : null}

              {currentUtilityMainTab === 'almanac' || currentUtilityMainTab === 'residential' ? (
                <DomSlot
                  deps={[currentUtilityMainTab]}
                  mount={(container) => {
                    let cancelled = false;
                    const target: DivinationFormMethod = currentUtilityMainTab;
                    divinationLatestPayloadRef.current = {};
                    container.textContent = '正在加载工具表单…';
                    void import('../v2-ui/divination-forms').then(({ renderDivinationForm }) => {
                      if (cancelled) return;
                      container.replaceChildren();
                      renderDivinationForm({
                        container,
                        method: target,
                        showSubmitButton: true,
                        onChange: (next) => {
                          divinationLatestPayloadRef.current = next;
                        },
                        onSubmit: (submitted) => {
                          void executeDivination(
                            target,
                            submitted ?? divinationLatestPayloadRef.current,
                          );
                        },
                      });
                    });
                    return () => {
                      cancelled = true;
                      container.replaceChildren();
                    };
                  }}
                />
              ) : null}
            </div>
          ) : null}

          {/* AI 会话详情页（从历史记录打开） */}
          {activeRoute === 'chat' && activeAgentSession ? (
            <ChatPage
              sessions={agentSessions}
              activeSession={activeAgentSession}
              cases={personalCases}
              isRunning={agentRunning}
              statusText={agentStatusText}
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

          {/* 运势模块（日运 · 月运 · 年运） */}
          {activeRoute === 'fortune' ? (
            <FortunePage
              cases={personalCases}
              initialCaseId={fortuneFocusCaseId}
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
              onNewCase={() => setCaseEditorState({ open: true, editingCase: null })}
              onEditCase={(record) => setCaseEditorState({ open: true, editingCase: record })}
              onOpenConnect={() => navigateToRoute('connect', { domain: 'connect' })}
              onBackHome={() => navigateToRoute('home', { domain: 'home' })}
            />
          ) : null}

          {/* AI 连接 */}
          {activeRoute === 'connect' ? (
            <ConnectPage
              onNavigateHome={() => navigateToRoute('home', { domain: 'home' })}
            />
          ) : null}

          {/* 全宽结果页 */}
          <div ref={resultStageRef} hidden={activeRoute !== 'result'} className="w-full min-w-0" />
            </React.Suspense>
        </div>
        </main>

        {/* 5. 个人档案面板（支持无模糊浮层或固定右侧卡片） */}
        <CasesDrawer
          open={drawerTab === 'cases'}
          canDock={canDockDrawer}
          isDocked={drawerPinned}
          onToggleDock={handleToggleDrawerDock}
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
              personWorkspaceRef.current.selfCard.setPerson(record);
            }
            if (activeRoute === 'fortune' || !dockActive) setDrawerTab(null);
            setDrawerFillTarget(null);
          }}
          onOpenChart={(record) => {
            const selected = setActiveCaseId(record.id);
            if (!dockActive) setDrawerTab(null);
            const targetTab: PersonalChartTabId =
              record.workspaceSource &&
              isPersonalChartMethod(record.workspaceSource) &&
              record.workspaceSource !== 'minglu'
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
          }}
          onTogglePin={(id) => {
            togglePersonalCasePin(id);
            setStoreRevision((n) => n + 1);
          }}
          onDeleteCase={(record) => {
            deletePersonalCase(record.id);
            if (homeSelectedCaseId === record.id) setHomeSelectedCaseId(null);
            setStoreRevision((n) => n + 1);
          }}
        />

        {/* 6. 首页与占卜页右侧固定全高历史记录卡片（桌面宽屏右侧停靠） */}
        {hasSideHistory ? (
          <HomeHistoryCard
            className="hidden min-[1280px]:flex fixed top-[calc(var(--topbar-height,60px)+20px)] right-4 z-[40] h-[calc(100dvh-var(--topbar-height,60px)-40px)] w-[236px] min-[1440px]:w-[252px] min-[1760px]:w-[288px] min-[1900px]:w-[320px]"
            divinationRecords={divinationRecords}
            compatibilityRecords={compatibilityRecords}
            agentSessions={agentSessions}
            onSelectDivination={handleSelectHistoryDivination}
            onSelectCompatibility={handleSelectHistoryCompatibility}
            onSelectChatSession={handleSelectHistoryChat}
            onDeleteRecord={handleDeleteHistoryRecord}
            onOpenFullPage={() => navigateToRoute('history', { domain: 'history' })}
          />
        ) : null}
      </div>

      {/* 4. 移动端底部主导航栏 */}
      <nav
        className="workspace-mobile-bottombar"
        aria-label="移动端底部主导航"
      >
        {(
          [
            {
              id: 'home',
              mark: '首',
              label: '首页',
              active: activeDomain === 'home',
              onClick: () => navigateToRoute('home', { domain: 'home' }),
            },
            {
              id: 'fortune',
              mark: '运',
              label: '运势',
              active: activeDomain === 'fortune',
              onClick: () =>
                navigateToRoute('fortune', {
                  featureId: 'fortune',
                  method: 'fortune',
                  domain: 'fortune',
                }),
            },
            {
              id: 'personal-chart',
              mark: '盘',
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
              mark: '卦',
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
              id: 'history',
              mark: '史',
              label: '历史记录',
              active: activeRoute === 'history',
              onClick: () => navigateToRoute('history', { domain: 'history' }),
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-current={tab.active ? 'page' : undefined}
            className={cn('workspace-mobile-bottom-tab', tab.active && 'is-active')}
            onClick={tab.onClick}
          >
            <span className="workspace-mobile-bottom-mark" aria-hidden="true">
              {tab.mark}
            </span>
            <span className="workspace-mobile-bottom-label">{tab.label}</span>
          </button>
        ))}
      </nav>

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
              setFortuneFocusCaseId(saved.id);
              if (activeRoute === 'chart-input' && personWorkspaceRef.current) {
                personWorkspaceRef.current.selfCard.setPerson(saved);
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
            homePinActionMode={homePinActionMode}
            birthPlaceModal={sharedPlaceModal}
            onHomePinActionModeChange={handleHomePinActionChange}
            onSaveAll={(nextPrefs, nextRules) => {
              const savedPrefs = saveWorkspacePreferences(nextPrefs);
              saveGlobalRules(nextRules);
              setPreferences(savedPrefs);
              setPreferredPersonalChartTab(savedPrefs.defaultChartFeature);
              setHomeDivinationFeature(savedPrefs.defaultDivinationFeature);
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

        {tutorialOpen ? (
          <TutorialModal
            open={tutorialOpen}
            onOpenChange={setTutorialOpen}
            onOpenConnect={() => {
              setTutorialOpen(false);
              navigateToRoute('connect', { domain: 'connect' });
            }}
          />
        ) : null}
      </React.Suspense>

      {/* 9. 共享 Radix 弹窗宿主（按需懒加载：出生地点 / 问题灵感 / 补充背景 / 术语词典） */}
      <PortalModalsHost />
    </div>
  );
}
