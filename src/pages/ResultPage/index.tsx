import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  buildCombinedZiweiCompatibilityPrompt,
  buildCombinedZiweiPrompt,
} from '@/lib/full-chart-engine/ziwei';
import {
  buildResultSearch,
  buildInputStateSearch,
  hasCompletePreciseBirthData,
  parseInputState,
  parsePromptState,
  type QueryPromptState,
  type ResultTabKey,
} from '@/lib/query-state';
import { buildAstrolabeFullScopeContexts, buildAstrolabeScopeContext } from '@/lib/astrolabe-scope';
import { shouldShowPromptShareButton } from '@/lib/prompt-page-rules';
import { QuestionInspirationModal } from '@/components/QuestionInspirationModal';
import { useViewportSize } from '@/hooks/useViewportWidth';
import { getBaziDefaultQuestion } from '@/lib/prompt-default-questions';
import { ASTROLABE_SHORTCUT_ACTIONS } from '@/lib/astrolabe-prompts';
import { formatBaziForPrompt } from 'mingyu-core/bazi';
import { buildDivinationPrompt } from '@/lib/divination/engine';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { generateQizheng, type QizhengResult } from 'mingyu-core/qizheng';
import type { ResidentialFengshuiResult } from 'mingyu-core/residential-fengshui';
import type { AstrolabeData } from '@/types/divination';
import type {
  BaziFortuneSelectionModule,
  InspirationCategory,
  PromptEngineModule,
} from './ResultPage.types';
import { PROMPT_DRAFT_STORAGE_PREFIX } from './ResultPage.constants';
import {
  buildBaziZiweiEnhancedPrompt,
  buildAstrolabeFullScopePromptText,
  buildEnhancedZiweiPromptPack,
  buildBaziFortuneSelectionValue,
  buildCombinedPromptText,
  formatZiweiPromptScopeSummary,
  formatBaziFullFortuneText,
  formatZiweiFullScopeText,
  getBaziShortcutActions,
  getZiweiShortcutActions,
  mapBaziFortuneToZiweiScope,
  resolveCompatType,
  resolveZiweiTopicByBaziShortcutMode,
} from './ResultPage.helpers';
import { singlePromptShortcutSections } from './ResultPage.constants';
import {
  BaziFortuneLoadingModal,
  InlineSkeleton,
  PromptPreSkeleton,
  ZiweiBoardSkeleton,
} from './components/skeletons';
import { AstrolabeBoard } from './components/AstrolabeBoard';
import { QizhengBoard } from './components/QizhengBoard';
import { usePromptCopyShare } from '@/hooks/usePromptCopyShare';
import { BaziChartBoard } from './components/BaziChartBoard';
import { ZiweiBoard } from './components/ZiweiBoard';
import { ZiweiScopeModal } from './components/ZiweiScopeModal';
import { AstrolabeScopeModal } from './components/AstrolabeScopeModal';
import { PromptShortcutPanel } from './components/PromptShortcutPanel';
import { useQuestionInspiration } from './hooks/useQuestionInspiration';
import { useBaziCalculations } from './hooks/useBaziCalculations';
import { useZiweiCalculations } from './hooks/useZiweiCalculations';
import { FRONTEND_DEFAULT_TIME_ZONE_ID } from '@/lib/time-policy';
import { usePromptShortcuts } from './hooks/usePromptShortcuts';
import { AiChatPanel } from '@/components/AiChatPanel';
import {
  ResultAssistantFab,
  ResultAssistantHeader,
  WorkspaceButton,
} from '@/components/workspace/WorkspaceUI';
import { useAiSettings } from '@/hooks/useAiSettings';
import { buildAiRequestConfig } from '@/lib/ai/settings';
import { buildMetaphysicsPrompt } from '@/lib/metaphysics-prompt';
import {
  calculateResidentialChart,
  type ResidentialMeasurement,
} from '@/lib/residential-fengshui-chart';
import { BIRTH_TIME_OPTIONS } from '@/lib/birth-time';
import { buildRecentBaziFortuneSelection } from '@/components/BaziFortuneTools/helpers';
import type { BaziFortuneSelectionValue } from 'mingyu-core/bazi';
import { PromptPreview } from '@/components/PromptPreview';
import {
  CHART_RECORD_PARAM,
  normalizeChartInputForSource,
  preserveChartRecordId,
} from '@/lib/case-navigation';

type FortuneScopePreset = 'default' | 'recent' | 'all' | 'manual';

function FortuneScopePresetSelect(props: {
  value: FortuneScopePreset;
  onChange: (value: FortuneScopePreset) => void;
  className?: string;
  disabled?: boolean;
}) {
  const displayValue = props.value === 'manual' ? 'manual-current' : props.value;

  return (
    <select
      className={props.className}
      value={displayValue}
      onChange={(event) => {
        if (event.target.value !== 'manual-current') {
          props.onChange(event.target.value as FortuneScopePreset);
        }
      }}
      disabled={props.disabled}
      aria-label="年限选择"
    >
      <option value="default">默认</option>
      <option value="recent">近期</option>
      <option value="all">全部</option>
      <option value="manual">手动</option>
      <option value="manual-current" hidden>
        手动
      </option>
    </select>
  );
}

function formatLocalDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function isSameBaziFortuneSelection(
  first: BaziFortuneSelectionValue,
  second: BaziFortuneSelectionValue,
) {
  return (
    first.scope === second.scope &&
    first.cycleIndex === second.cycleIndex &&
    first.year === second.year &&
    first.month === second.month &&
    first.day === second.day
  );
}

const LazyBaziFortuneModal = lazy(async () => {
  const module = await import('@/components/BaziFortuneTools/BaziFortuneModal');
  return { default: module.BaziFortuneModal };
});

const LazyMetaphysicsPanel = lazy(async () => {
  const module = await import('@/components/MetaphysicsPanel');
  return { default: module.MetaphysicsPanel };
});

type ResultPageProps = {
  assistantOnly?: boolean;
};

export function ResultPage({ assistantOnly = false }: ResultPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAssistantPage = assistantOnly || location.pathname === '/result/assistant';
  const [metaphysicsQuestionDraft, setMetaphysicsQuestionDraft] = useState('');
  const [residentialResult, setResidentialResult] = useState<ResidentialFengshuiResult | null>(
    null,
  );
  const [residentialMeasurement, setResidentialMeasurement] =
    useState<ResidentialMeasurement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const promptState = useMemo(() => parsePromptState(searchParams), [searchParams]);
  const inputState = useMemo(
    () => normalizeChartInputForSource(parseInputState(searchParams), promptState.promptSource),
    [promptState.promptSource, searchParams],
  );
  const inputSearch = useMemo(() => buildInputStateSearch(inputState), [inputState]);
  const activeChartFeature =
    inputState.analysisMode === 'compatibility' ? 'compatibility' : promptState.promptSource;
  const isCombinedResult =
    inputState.analysisMode === 'compatibility' || promptState.promptSource === 'bazi-ziwei';
  const resultTabs = useMemo<ResultTabKey[]>(() => {
    if (isCombinedResult) {
      return ['bazi', 'ziwei', 'prompt'];
    }
    const chartTab: ResultTabKey =
      promptState.promptSource === 'ziwei'
        ? 'ziwei'
        : promptState.promptSource === 'astrolabe'
          ? 'astrolabe'
          : promptState.promptSource === 'qizheng'
            ? 'qizheng'
            : promptState.promptSource === 'bazhai'
              ? 'bazhai'
              : 'bazi';
    return [chartTab, 'prompt'];
  }, [isCombinedResult, promptState.promptSource]);
  const chartTabs = useMemo(
    () => resultTabs.filter((tab): tab is Exclude<ResultTabKey, 'prompt'> => tab !== 'prompt'),
    [resultTabs],
  );
  const defaultChartTab = chartTabs[0] ?? 'bazi';
  const activeChartTab = chartTabs.some((tab) => tab === promptState.tab)
    ? promptState.tab
    : defaultChartTab;
  const hasPreciseBirthData = hasCompletePreciseBirthData(inputState);
  const hasResidentialBirthData = useMemo(() => {
    const year = Number(inputState.year);
    const month = Number(inputState.month);
    const day = Number(inputState.day);
    return (
      inputState.analysisMode === 'single' &&
      Number.isInteger(year) &&
      year >= 1900 &&
      year <= 2100 &&
      Number.isInteger(month) &&
      month >= 1 &&
      month <= 12 &&
      Number.isInteger(day) &&
      day >= 1 &&
      day <= 31
    );
  }, [inputState.analysisMode, inputState.day, inputState.month, inputState.year]);
  const canUseResidentialFengshui =
    hasResidentialBirthData || Boolean(promptState.bazhaiFacingDegree.trim());
  const hasAstrolabeChart = hasPreciseBirthData;
  const isAstrolabePromptSource = promptState.promptSource === 'astrolabe';
  const isQizhengPromptSource = promptState.promptSource === 'qizheng';
  const isBazhaiPromptSource = promptState.promptSource === 'bazhai';
  const hasAdjustablePromptScope =
    ((promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei') &&
      inputState.analysisMode === 'single') ||
    promptState.promptSource === 'ziwei' ||
    promptState.promptSource === 'astrolabe';
  const viewportSize = useViewportSize({ width: 0, height: 0 });
  const isCompactResultLayout = viewportSize.width > 0 && viewportSize.width < 980;
  const showEmbeddedAssistant = !isAssistantPage && !isCompactResultLayout;
  const showAssistantPane = isAssistantPage || showEmbeddedAssistant;

  const baziDraftStorageKey = useMemo(
    () => `${PROMPT_DRAFT_STORAGE_PREFIX}:bazi:${inputSearch}`,
    [inputSearch],
  );
  const ziweiDraftStorageKey = useMemo(
    () => `${PROMPT_DRAFT_STORAGE_PREFIX}:ziwei:${inputSearch}`,
    [inputSearch],
  );
  const astrolabeDraftStorageKey = useMemo(
    () => `${PROMPT_DRAFT_STORAGE_PREFIX}:astrolabe:${inputSearch}`,
    [inputSearch],
  );
  const shouldLoadBaziPromptModules =
    showAssistantPane &&
    (promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei');
  const [isBaziFortuneModalOpen, setIsBaziFortuneModalOpen] = useState(false);
  const [isZiweiScopeModalOpen, setIsZiweiScopeModalOpen] = useState(false);
  const [isAstrolabeScopeModalOpen, setIsAstrolabeScopeModalOpen] = useState(false);
  const inspiration = useQuestionInspiration();
  const [aiSettings] = useAiSettings();
  const isAiEnabled = aiSettings.enabled;
  const aiRequestConfig = useMemo(() => buildAiRequestConfig(aiSettings), [aiSettings]);
  const isMobileAi = isAiEnabled && isAssistantPage && isCompactResultLayout;
  const [isAiShortcutPopoverOpen, setIsAiShortcutPopoverOpen] = useState(false);
  const [isAiMobileSettingsOpen, setIsAiMobileSettingsOpen] = useState(true);
  const [promptEngine, setPromptEngine] = useState<PromptEngineModule | null>(null);
  const [baziFortuneSelectionModule, setBaziFortuneSelectionModule] =
    useState<BaziFortuneSelectionModule | null>(null);
  const [mountedTabs, setMountedTabs] = useState<Record<ResultTabKey, boolean>>(() => ({
    bazi: promptState.tab === 'bazi',
    ziwei: promptState.tab === 'ziwei',
    astrolabe: promptState.tab === 'astrolabe',
    qizheng: promptState.tab === 'qizheng',
    bazhai: canUseResidentialFengshui && promptState.tab === 'bazhai',
    prompt: showAssistantPane,
  }));
  const { baziResult, partnerBaziResult, baziError } = useBaziCalculations(inputState);
  const sharedBirthData = useMemo(() => {
    if (!hasPreciseBirthData || !baziResult) return null;
    const selectedBirthTime =
      inputState.birthHour !== ''
        ? {
            hour: Number(inputState.birthHour),
            minute: inputState.birthMinute === '' ? 0 : Number(inputState.birthMinute),
          }
        : inputState.timeIndex !== ''
          ? BIRTH_TIME_OPTIONS[Number(inputState.timeIndex)]
          : undefined;
    return {
      ...(inputState.dateType === 'solar'
        ? {
            year: Number(inputState.year),
            month: Number(inputState.month),
            day: Number(inputState.day),
          }
        : baziResult.solarDate),
      hour: selectedBirthTime?.hour ?? 12,
      minute: selectedBirthTime?.minute ?? 0,
      latitude: inputState.birthLatitude ? Number(inputState.birthLatitude) : undefined,
      longitude: inputState.birthLongitude ? Number(inputState.birthLongitude) : undefined,
      timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
      useTrueSolarTime: inputState.useTrueSolarTime,
    };
  }, [baziResult, hasPreciseBirthData, inputState]);
  const residentialBirthData = useMemo(() => {
    if (!hasResidentialBirthData) return null;
    if (inputState.dateType === 'solar') {
      return {
        year: Number(inputState.year),
        month: Number(inputState.month),
        day: Number(inputState.day),
        gender: inputState.gender,
      };
    }
    if (!baziResult) return null;
    return {
      ...baziResult.solarDate,
      gender: inputState.gender,
    };
  }, [baziResult, hasResidentialBirthData, inputState]);
  const {
    ziweiRuntime,
    partnerZiweiRuntime,
    ziweiError,
    primaryZiweiInput,
    partnerZiweiInput,
    activeZiweiPayloadByScope,
    currentZiweiPayload,
    partnerZiweiPayload,
  } = useZiweiCalculations(inputState, promptState, mountedTabs.ziwei, mountedTabs.prompt);
  const updatePromptState = useCallback(
    (next: Partial<QueryPromptState>) => {
      const merged = {
        ...promptState,
        ...next,
      };

      setSearchParams(preserveChartRecordId(buildResultSearch(inputState, merged), searchParams), {
        replace: true,
      });
    },
    [inputState, promptState, searchParams, setSearchParams],
  );

  useEffect(() => {
    if (isAssistantPage) {
      if (promptState.tab !== 'prompt') updatePromptState({ tab: 'prompt' });
      return;
    }
    if (chartTabs.some((tab) => tab === promptState.tab)) return;
    updatePromptState({ tab: defaultChartTab });
  }, [chartTabs, defaultChartTab, isAssistantPage, promptState.tab, updatePromptState]);
  const {
    activeBaziShortcutMode,
    activeZiweiShortcutMode,
    activeAstrolabeShortcutMode,
    baziQuestionDraft,
    ziweiQuestionDraft,
    astrolabeQuestionDraft,
    setBaziQuestionDraft,
    setZiweiQuestionDraft,
    setAstrolabeQuestionDraft,
    effectiveBaziQuickQuestion,
    effectiveZiweiQuickQuestion,
    effectiveAstrolabeQuickQuestion,
    applyBaziShortcutMode,
    applyZiweiShortcutMode,
    applyAstrolabeShortcutMode,
    applyInspiredQuestion,
  } = usePromptShortcuts(
    inputState,
    promptState,
    baziDraftStorageKey,
    ziweiDraftStorageKey,
    astrolabeDraftStorageKey,
    ASTROLABE_SHORTCUT_ACTIONS,
    updatePromptState,
    inspiration.close,
  );

  useEffect(() => {
    setMountedTabs((current) => {
      if (current[promptState.tab]) {
        return current;
      }

      return {
        ...current,
        [promptState.tab]: true,
      };
    });
  }, [promptState.tab]);

  useEffect(() => {
    if (!showAssistantPane) return;
    setMountedTabs((current) =>
      current.prompt
        ? current
        : {
            ...current,
            prompt: true,
          },
    );
  }, [showAssistantPane]);

  useEffect(() => {
    if (inputState.analysisMode === 'single' || promptState.promptSource !== 'bazi-ziwei') {
      return;
    }

    updatePromptState({
      promptSource: 'bazi',
    });
  }, [inputState.analysisMode, promptState.promptSource, updatePromptState]);

  useEffect(() => {
    const hasUnavailablePromptSource =
      ((promptState.promptSource === 'astrolabe' || promptState.promptSource === 'qizheng') &&
        !hasAstrolabeChart) ||
      (promptState.promptSource === 'bazhai' && !canUseResidentialFengshui);
    const hasUnavailableTab =
      ((promptState.tab === 'astrolabe' || promptState.tab === 'qizheng') && !hasAstrolabeChart) ||
      (promptState.tab === 'bazhai' && !canUseResidentialFengshui);

    if (hasUnavailablePromptSource || hasUnavailableTab) {
      updatePromptState({
        ...(hasUnavailablePromptSource ? { promptSource: 'bazi' as const } : {}),
        ...(hasUnavailableTab ? { tab: 'bazi' as const } : {}),
      });
    }
  }, [
    canUseResidentialFengshui,
    hasAstrolabeChart,
    hasPreciseBirthData,
    promptState.promptSource,
    promptState.tab,
    updatePromptState,
  ]);

  useEffect(() => {
    if (!canUseResidentialFengshui) {
      setResidentialResult(null);
      setResidentialMeasurement(null);
      return;
    }
    if (residentialResult) return;
    try {
      const houseYear = promptState.residentialHouseYear
        ? Number(promptState.residentialHouseYear)
        : undefined;
      const next = calculateResidentialChart({
        ...(residentialBirthData
          ? {
              year: residentialBirthData.year,
              month: residentialBirthData.month,
              day: residentialBirthData.day,
              gender: residentialBirthData.gender,
            }
          : {}),
        ...(houseYear != null && Number.isFinite(houseYear) ? { houseYear } : {}),
        ...(promptState.bazhaiFacingDegree
          ? { doorToInteriorDegree: Number(promptState.bazhaiFacingDegree) }
          : {}),
      });
      setResidentialResult(next.result);
      setResidentialMeasurement(next.measurement);
    } catch {
      // URL 中的旧值或人工修改值无法生成时，住宅风水页仍允许用户重新测量。
    }
  }, [
    canUseResidentialFengshui,
    promptState.bazhaiFacingDegree,
    promptState.residentialHouseYear,
    residentialBirthData,
    residentialResult,
  ]);

  const handleBazhaiResultChange = useCallback(
    (nextResult: ResidentialFengshuiResult, nextMeasurement: ResidentialMeasurement | null) => {
      setResidentialResult(nextResult);
      setResidentialMeasurement(nextMeasurement);
    },
    [],
  );
  const handleBazhaiDirectionDegreeChange = useCallback(
    (value: string) => {
      if (value !== promptState.bazhaiFacingDegree) {
        updatePromptState({ bazhaiFacingDegree: value });
      }
    },
    [promptState.bazhaiFacingDegree, updatePromptState],
  );
  const handleResidentialHouseYearChange = useCallback(
    (value: string) => {
      if (value !== promptState.residentialHouseYear) {
        updatePromptState({ residentialHouseYear: value });
      }
    },
    [promptState.residentialHouseYear, updatePromptState],
  );

  useEffect(() => {
    if (
      (shouldLoadBaziPromptModules ? promptEngine : true) &&
      (shouldLoadBaziPromptModules || isBaziFortuneModalOpen ? baziFortuneSelectionModule : true)
    ) {
      return;
    }

    let cancelled = false;

    async function loadPromptModules() {
      const loaders: Array<Promise<void>> = [];

      if (shouldLoadBaziPromptModules && !promptEngine) {
        loaders.push(
          import('@/lib/prompt-engine').then((module) => {
            if (!cancelled) {
              setPromptEngine(module);
            }
          }),
        );
      }

      if ((shouldLoadBaziPromptModules || isBaziFortuneModalOpen) && !baziFortuneSelectionModule) {
        loaders.push(
          import('mingyu-core/bazi').then((module) => {
            if (!cancelled) {
              setBaziFortuneSelectionModule(module);
            }
          }),
        );
      }

      await Promise.all(loaders);
    }

    void loadPromptModules();

    return () => {
      cancelled = true;
    };
  }, [
    baziFortuneSelectionModule,
    isBaziFortuneModalOpen,
    promptEngine,
    shouldLoadBaziPromptModules,
  ]);

  const selectedBaziPreset = useMemo(() => {
    if (!promptEngine) {
      return null;
    }

    const promptList =
      inputState.analysisMode === 'compatibility'
        ? promptEngine.BAZI_AI_PROMPTS.combined
        : promptEngine.BAZI_AI_PROMPTS.single;

    return promptList.find((item) => item.id === promptState.baziPresetId) ?? promptList[0] ?? null;
  }, [inputState.analysisMode, promptEngine, promptState.baziPresetId]);

  const baziFortuneSelection = useMemo(
    () => buildBaziFortuneSelectionValue(promptState),
    [promptState],
  );
  const normalizedBaziFortuneSelection = useMemo(() => {
    if (!baziResult || !baziFortuneSelectionModule) {
      return { scope: 'natal' as const };
    }

    try {
      return baziFortuneSelectionModule.normalizeFortuneSelection(baziResult, baziFortuneSelection);
    } catch {
      return { scope: 'natal' as const };
    }
  }, [baziFortuneSelection, baziFortuneSelectionModule, baziResult]);
  const baziFortuneContext = useMemo(() => {
    if (!baziResult || !baziFortuneSelectionModule) {
      return null;
    }

    return baziFortuneSelectionModule.buildFortuneSelectionContext(
      baziResult,
      normalizedBaziFortuneSelection,
    );
  }, [baziFortuneSelectionModule, baziResult, normalizedBaziFortuneSelection]);
  const currentScopeDate = useMemo(() => new Date(), []);
  const currentDateStr = useMemo(() => formatLocalDate(currentScopeDate), [currentScopeDate]);
  const recentBaziFortuneSelection = useMemo(
    () => (baziResult ? buildRecentBaziFortuneSelection(baziResult, currentScopeDate) : null),
    [baziResult, currentScopeDate],
  );
  const baziFortunePreset: FortuneScopePreset =
    normalizedBaziFortuneSelection.scope === 'natal'
      ? 'default'
      : normalizedBaziFortuneSelection.scope === 'full'
        ? 'all'
        : recentBaziFortuneSelection &&
            isSameBaziFortuneSelection(normalizedBaziFortuneSelection, recentBaziFortuneSelection)
          ? 'recent'
          : 'manual';
  const ziweiScopePreset: FortuneScopePreset =
    promptState.ziweiScope === 'origin'
      ? 'default'
      : promptState.ziweiScope === 'full'
        ? 'all'
        : promptState.ziweiScope === 'monthly' && promptState.ziweiScopeDate === currentDateStr
          ? 'recent'
          : 'manual';
  const astrolabeScopePreset: FortuneScopePreset =
    promptState.astrolabeScope === 'natal'
      ? 'default'
      : promptState.astrolabeScope === 'full'
        ? 'all'
        : promptState.astrolabeScope === 'monthly' &&
            promptState.astrolabeScopeDate === currentDateStr
          ? 'recent'
          : 'manual';

  const applyBaziFortuneSelection = useCallback(
    (next: BaziFortuneSelectionValue) => {
      const isGeneralScope = next.scope === 'natal' || next.scope === 'full';
      const nextPromptState: Partial<QueryPromptState> = {
        baziFortuneScope: next.scope,
        baziFortuneCycleIndex: isGeneralScope ? '' : String(next.cycleIndex ?? ''),
        baziFortuneYear: isGeneralScope ? '' : String(next.year ?? ''),
        baziFortuneMonth:
          next.scope === 'month' || next.scope === 'day' ? String(next.month ?? '') : '',
        baziFortuneDay: next.scope === 'day' ? String(next.day ?? '') : '',
      };

      if (promptState.promptSource === 'bazi-ziwei') {
        const mappedZiweiScope = mapBaziFortuneToZiweiScope(next);
        nextPromptState.ziweiScope = mappedZiweiScope.scope;
        nextPromptState.ziweiScopeDate = mappedZiweiScope.dateStr;
      }

      updatePromptState(nextPromptState);
    },
    [promptState.promptSource, updatePromptState],
  );

  function handleBaziFortunePresetChange(value: FortuneScopePreset) {
    if (value === 'manual') {
      setIsBaziFortuneModalOpen(true);
      return;
    }
    if (value === 'recent' && recentBaziFortuneSelection) {
      applyBaziFortuneSelection(recentBaziFortuneSelection);
      return;
    }
    applyBaziFortuneSelection({ scope: value === 'all' ? 'full' : 'natal' });
  }

  function handleZiweiScopePresetChange(value: FortuneScopePreset) {
    if (value === 'manual') {
      setIsZiweiScopeModalOpen(true);
      return;
    }
    updatePromptState({
      ziweiScope: value === 'all' ? 'full' : value === 'recent' ? 'monthly' : 'origin',
      ziweiScopeDate: value === 'recent' ? currentDateStr : '',
    });
  }

  function handleAstrolabeScopePresetChange(value: FortuneScopePreset) {
    if (value === 'manual') {
      setIsAstrolabeScopeModalOpen(true);
      return;
    }
    updatePromptState({
      astrolabeScope: value === 'all' ? 'full' : value === 'recent' ? 'monthly' : 'natal',
      astrolabeScopeDate: value === 'recent' || value === 'all' ? currentDateStr : '',
    });
  }

  const deferredBaziQuickQuestion = useDeferredValue(effectiveBaziQuickQuestion);
  const deferredZiweiQuickQuestion = useDeferredValue(effectiveZiweiQuickQuestion);
  const deferredAstrolabeQuestion = useDeferredValue(effectiveAstrolabeQuickQuestion);
  const shouldCalculateAstrolabe =
    hasAstrolabeChart &&
    (mountedTabs.astrolabe ||
      (mountedTabs.prompt && isAstrolabePromptSource) ||
      isAstrolabeScopeModalOpen);

  const astrolabeCalculation = useMemo<{
    data: AstrolabeData | null;
    error: string;
  }>(() => {
    if (!shouldCalculateAstrolabe) {
      return { data: null, error: '' };
    }

    try {
      if (!inputState.birthHour || !inputState.birthMinute) {
        throw new Error('星盘需要精准出生时间，请返回输入页补全。');
      }
      if (!inputState.birthPlace || !inputState.birthLongitude || !inputState.birthLatitude) {
        throw new Error('星盘需要出生地，请返回输入页选择出生地。');
      }

      return {
        data: generateAstrolabe({
          name: inputState.name || '本人',
          gender: inputState.gender === 'female' ? '女' : '男',
          year: inputState.year,
          month: inputState.month,
          day: inputState.day,
          hour: inputState.birthHour,
          minute: inputState.birthMinute,
          latitude: inputState.birthLatitude,
          longitude: inputState.birthLongitude,
          timeZoneId: FRONTEND_DEFAULT_TIME_ZONE_ID,
          locationName: inputState.birthPlace,
          useTrueSolarTime: inputState.useTrueSolarTime,
        }),
        error: '',
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : '星盘生成失败。',
      };
    }
  }, [
    inputState.birthHour,
    inputState.birthLatitude,
    inputState.birthLongitude,
    inputState.birthMinute,
    inputState.birthPlace,
    inputState.day,
    inputState.gender,
    inputState.month,
    inputState.name,
    inputState.useTrueSolarTime,
    inputState.year,
    shouldCalculateAstrolabe,
  ]);
  const shouldCalculateQizheng =
    hasAstrolabeChart && (mountedTabs.qizheng || (mountedTabs.prompt && isQizhengPromptSource));
  const qizhengCalculation = useMemo<{ data: QizhengResult | null; error: string }>(() => {
    if (!shouldCalculateQizheng || !sharedBirthData) return { data: null, error: '' };
    try {
      return {
        data: generateQizheng(sharedBirthData),
        error: '',
      };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : '七政四余排盘生成失败。',
      };
    }
  }, [sharedBirthData, shouldCalculateQizheng]);
  const astrolabeScopeContext = useMemo(
    () =>
      buildAstrolabeScopeContext(
        astrolabeCalculation.data,
        promptState.astrolabeScope,
        promptState.astrolabeScopeDate,
      ),
    [astrolabeCalculation.data, promptState.astrolabeScope, promptState.astrolabeScopeDate],
  );
  const astrolabeFullScopeContext = useMemo(() => {
    if (!astrolabeCalculation.data || promptState.astrolabeScope !== 'full') {
      return null;
    }

    return buildAstrolabeFullScopePromptText(
      buildAstrolabeFullScopeContexts(astrolabeCalculation.data, promptState.astrolabeScopeDate),
    );
  }, [astrolabeCalculation.data, promptState.astrolabeScope, promptState.astrolabeScopeDate]);

  const activeBaziQuestionScopeLabel = useMemo(() => {
    if (activeBaziShortcutMode === '自定义' || activeBaziShortcutMode === '问题灵感') {
      return '通用';
    }
    return activeBaziShortcutMode === '综合' ? '通用' : activeBaziShortcutMode;
  }, [activeBaziShortcutMode]);

  function computeBaziPromptText(question: string, finalQuestion: string): string {
    if (!showAssistantPane) return '';
    if (inputState.analysisMode === 'compatibility') {
      if (!promptEngine || !baziResult || !partnerBaziResult) return '';
      const compatibilityPrompt = promptEngine.getCompatibilityPrompt(
        question,
        baziResult,
        partnerBaziResult,
        resolveCompatType(promptState.baziPresetId),
        { isCustomQuestion: activeBaziShortcutMode === '自定义' },
      );
      return buildCombinedPromptText(compatibilityPrompt.system, compatibilityPrompt.user);
    }
    if (!promptEngine || !baziResult || !baziFortuneSelectionModule || !selectedBaziPreset) {
      return '';
    }
    const { system, user } = promptEngine.buildPromptFromConfig(
      finalQuestion,
      selectedBaziPreset,
      baziResult,
      baziFortuneContext,
      activeBaziQuestionScopeLabel,
      {
        isCustomQuestion: activeBaziShortcutMode === '自定义',
        fortuneScope: promptState.baziFortuneScope,
      },
    );
    return buildCombinedPromptText(system, user);
  }

  const defaultBaziQuestion = useMemo(
    () =>
      getBaziDefaultQuestion(undefined, {
        isCustomQuestion: activeBaziShortcutMode === '自定义',
      }),
    [activeBaziShortcutMode],
  );
  function computeZiweiPromptText(question: string): string {
    if (!showAssistantPane) return '';
    if (inputState.analysisMode === 'compatibility') {
      if (!currentZiweiPayload || !partnerZiweiPayload || !ziweiRuntime || !partnerZiweiRuntime) {
        return '';
      }
      return buildCombinedZiweiCompatibilityPrompt({
        primaryPayload: currentZiweiPayload,
        partnerPayload: partnerZiweiPayload,
        primaryAstrolabe: ziweiRuntime.astrolabe,
        partnerAstrolabe: partnerZiweiRuntime.astrolabe,
        primaryTrueSolarEvidence: ziweiRuntime.trueSolarEvidence,
        partnerTrueSolarEvidence: partnerZiweiRuntime.trueSolarEvidence,
        topic: promptState.ziweiTopic,
        question,
        isCustomQuestion: activeZiweiShortcutMode === '自定义',
      });
    }
    if (!currentZiweiPayload) return '';
    const basePrompt = buildCombinedZiweiPrompt(
      currentZiweiPayload,
      promptState.ziweiTopic,
      question,
      {
        isCustomQuestion: activeZiweiShortcutMode === '自定义',
        trueSolarEvidence: ziweiRuntime?.trueSolarEvidence,
      },
    );
    if (promptState.ziweiScope !== 'full' || !activeZiweiPayloadByScope) {
      return basePrompt;
    }

    const fullScopeText = formatZiweiFullScopeText(activeZiweiPayloadByScope);
    return fullScopeText
      ? basePrompt.replace('【问题】', `【完整运限资料】\n${fullScopeText}\n\n【问题】`)
      : basePrompt;
  }

  const ziweiScopeSummaryText =
    promptState.ziweiScope === 'full'
      ? '本命盘与完整运限资料'
      : promptState.ziweiScope === 'origin'
        ? '本命盘与大运概览'
        : formatZiweiPromptScopeSummary(
            promptState.ziweiScope,
            promptState.ziweiScopeDate,
            promptState.ziweiScopeDate ? currentZiweiPayload?.active_scope.label : undefined,
          );

  const enhancedZiweiPromptPack = useMemo(() => {
    if (!showAssistantPane || promptState.promptSource !== 'bazi-ziwei' || !currentZiweiPayload) {
      return '';
    }

    const ziweiTopic = resolveZiweiTopicByBaziShortcutMode(activeBaziShortcutMode);
    return buildEnhancedZiweiPromptPack(currentZiweiPayload, ziweiTopic);
  }, [activeBaziShortcutMode, currentZiweiPayload, promptState.promptSource, showAssistantPane]);

  const enhancedBaziPromptPack = useMemo(() => {
    if (!showAssistantPane || promptState.promptSource !== 'bazi-ziwei' || !baziResult) {
      return '';
    }

    const baseText = formatBaziForPrompt(baziResult, null, 'general');
    const fullFortuneText =
      promptState.baziFortuneScope === 'full' ? formatBaziFullFortuneText(baziResult) : '';

    return [baseText, fullFortuneText ? `【命限资料】\n${fullFortuneText}` : '']
      .filter(Boolean)
      .join('\n\n');
  }, [baziResult, promptState.baziFortuneScope, promptState.promptSource, showAssistantPane]);

  function computeEnhancedPromptText(question: string, finalQuestion: string): string {
    if (!showAssistantPane || inputState.analysisMode !== 'single') return '';
    if (!baziResult || !enhancedZiweiPromptPack || !enhancedBaziPromptPack) return '';

    return buildBaziZiweiEnhancedPrompt({
      baziResult,
      baziText: enhancedBaziPromptPack,
      ziweiText:
        promptState.ziweiScope === 'full' && activeZiweiPayloadByScope
          ? [
              enhancedZiweiPromptPack,
              `【完整运限资料】\n${formatZiweiFullScopeText(activeZiweiPayloadByScope)}`,
            ]
              .filter(Boolean)
              .join('\n\n')
          : enhancedZiweiPromptPack,
      question: finalQuestion || question,
      questionScopeLabel: activeBaziQuestionScopeLabel,
      baziFortuneSummary:
        promptState.baziFortuneScope === 'full'
          ? '八字分析对象：本命盘与完整大运流年'
          : baziFortuneContext
            ? `八字分析对象：${baziFortuneContext.displayText}`
            : '',
      ziweiScopeSummary:
        promptState.ziweiScope === 'origin' ? '' : `紫微分析范围：${ziweiScopeSummaryText}`,
      isCustomQuestion: activeBaziShortcutMode === '自定义',
    });
  }

  const finalBaziQuestion = useMemo(() => {
    const question = effectiveBaziQuickQuestion.trim();
    if (baziFortuneContext) {
      return `请结合${baziFortuneContext.displayLabel}重点回答：${question || defaultBaziQuestion}`;
    }
    return question;
  }, [baziFortuneContext, defaultBaziQuestion, effectiveBaziQuickQuestion]);
  const deferredFinalBaziQuestion = useMemo(() => {
    const question = deferredBaziQuickQuestion.trim();
    if (baziFortuneContext) {
      return `请结合${baziFortuneContext.displayLabel}重点回答：${question || defaultBaziQuestion}`;
    }
    return question;
  }, [baziFortuneContext, defaultBaziQuestion, deferredBaziQuickQuestion]);

  const latestBaziPromptText = useMemo(
    () =>
      promptState.promptSource === 'bazi'
        ? computeBaziPromptText(effectiveBaziQuickQuestion, finalBaziQuestion)
        : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      baziFortuneContext,
      baziFortuneSelectionModule,
      baziResult,
      activeBaziShortcutMode,
      effectiveBaziQuickQuestion,
      finalBaziQuestion,
      inputState.analysisMode,
      inputState.name,
      inputState.partnerName,
      partnerBaziResult,
      promptEngine,
      promptState.baziPresetId,
      promptState.baziFortuneScope,
      promptState.promptSource,
      showAssistantPane,
      selectedBaziPreset,
    ],
  );
  const previewBaziPromptText = useMemo(
    () => {
      if (promptState.promptSource !== 'bazi') {
        return '';
      }

      if (
        deferredBaziQuickQuestion === effectiveBaziQuickQuestion &&
        deferredFinalBaziQuestion === finalBaziQuestion
      ) {
        return latestBaziPromptText;
      }

      return computeBaziPromptText(deferredBaziQuickQuestion, deferredFinalBaziQuestion);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      baziFortuneContext,
      baziFortuneSelectionModule,
      baziResult,
      activeBaziShortcutMode,
      deferredBaziQuickQuestion,
      deferredFinalBaziQuestion,
      effectiveBaziQuickQuestion,
      finalBaziQuestion,
      inputState.analysisMode,
      inputState.name,
      inputState.partnerName,
      latestBaziPromptText,
      partnerBaziResult,
      promptEngine,
      promptState.baziPresetId,
      promptState.baziFortuneScope,
      promptState.promptSource,
      showAssistantPane,
      selectedBaziPreset,
    ],
  );

  const latestZiweiPromptText = useMemo(
    () =>
      promptState.promptSource === 'ziwei'
        ? computeZiweiPromptText(effectiveZiweiQuickQuestion)
        : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeZiweiPayloadByScope,
      currentZiweiPayload,
      activeZiweiShortcutMode,
      effectiveZiweiQuickQuestion,
      inputState.analysisMode,
      partnerZiweiPayload,
      partnerZiweiRuntime,
      promptState.promptSource,
      showAssistantPane,
      promptState.ziweiScope,
      promptState.ziweiTopic,
      ziweiRuntime,
    ],
  );
  const previewZiweiPromptText = useMemo(
    () => {
      if (promptState.promptSource !== 'ziwei') {
        return '';
      }

      if (deferredZiweiQuickQuestion === effectiveZiweiQuickQuestion) {
        return latestZiweiPromptText;
      }

      return computeZiweiPromptText(deferredZiweiQuickQuestion);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeZiweiPayloadByScope,
      currentZiweiPayload,
      activeZiweiShortcutMode,
      deferredZiweiQuickQuestion,
      effectiveZiweiQuickQuestion,
      inputState.analysisMode,
      latestZiweiPromptText,
      partnerZiweiPayload,
      partnerZiweiRuntime,
      promptState.promptSource,
      showAssistantPane,
      promptState.ziweiScope,
      promptState.ziweiTopic,
      ziweiRuntime,
    ],
  );

  const latestAstrolabePromptText = useMemo(() => {
    if (
      promptState.promptSource !== 'astrolabe' ||
      !showAssistantPane ||
      !astrolabeCalculation.data
    ) {
      return '';
    }

    return buildDivinationPrompt(
      'astrolabe',
      effectiveAstrolabeQuickQuestion.trim(),
      astrolabeCalculation.data,
      undefined,
      {
        isCustomQuestion: activeAstrolabeShortcutMode === '自定义',
        astrolabeTopic: promptState.astrolabeTopic,
        astrolabeScopeText: astrolabeFullScopeContext ?? astrolabeScopeContext.promptText,
      },
    );
  }, [
    activeAstrolabeShortcutMode,
    astrolabeFullScopeContext,
    astrolabeScopeContext.promptText,
    astrolabeCalculation.data,
    effectiveAstrolabeQuickQuestion,
    promptState.astrolabeTopic,
    promptState.promptSource,
    showAssistantPane,
  ]);
  const previewAstrolabePromptText = useMemo(() => {
    if (promptState.promptSource !== 'astrolabe') {
      return '';
    }

    if (deferredAstrolabeQuestion === effectiveAstrolabeQuickQuestion) {
      return latestAstrolabePromptText;
    }

    if (!showAssistantPane || !astrolabeCalculation.data) {
      return '';
    }

    return buildDivinationPrompt(
      'astrolabe',
      deferredAstrolabeQuestion.trim(),
      astrolabeCalculation.data,
      undefined,
      {
        isCustomQuestion: activeAstrolabeShortcutMode === '自定义',
        astrolabeTopic: promptState.astrolabeTopic,
        astrolabeScopeText: astrolabeFullScopeContext ?? astrolabeScopeContext.promptText,
      },
    );
  }, [
    activeAstrolabeShortcutMode,
    astrolabeFullScopeContext,
    astrolabeScopeContext.promptText,
    astrolabeCalculation.data,
    deferredAstrolabeQuestion,
    effectiveAstrolabeQuickQuestion,
    latestAstrolabePromptText,
    promptState.astrolabeTopic,
    promptState.promptSource,
    showAssistantPane,
  ]);
  const qizhengPromptText = useMemo(() => {
    if (!showAssistantPane || promptState.promptSource !== 'qizheng' || !qizhengCalculation.data) {
      return '';
    }
    return buildMetaphysicsPrompt(qizhengCalculation.data.prompt, metaphysicsQuestionDraft, {
      method: 'qizheng',
    });
  }, [
    metaphysicsQuestionDraft,
    promptState.promptSource,
    showAssistantPane,
    qizhengCalculation.data,
  ]);
  const bazhaiPromptText = useMemo(() => {
    if (
      !canUseResidentialFengshui ||
      !showAssistantPane ||
      promptState.promptSource !== 'bazhai' ||
      !residentialResult
    ) {
      return '';
    }
    return buildMetaphysicsPrompt(residentialResult.prompt, metaphysicsQuestionDraft, {
      method: 'residential',
      measurement: residentialMeasurement?.promptText,
    });
  }, [
    canUseResidentialFengshui,
    metaphysicsQuestionDraft,
    promptState.promptSource,
    showAssistantPane,
    residentialMeasurement,
    residentialResult,
  ]);
  const latestEnhancedPromptText = useMemo(
    () =>
      promptState.promptSource === 'bazi-ziwei'
        ? computeEnhancedPromptText(effectiveBaziQuickQuestion, finalBaziQuestion)
        : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeBaziQuestionScopeLabel,
      activeBaziShortcutMode,
      activeZiweiPayloadByScope,
      baziFortuneContext,
      baziResult,
      enhancedBaziPromptPack,
      effectiveBaziQuickQuestion,
      enhancedZiweiPromptPack,
      finalBaziQuestion,
      inputState.analysisMode,
      promptState.baziFortuneScope,
      promptState.promptSource,
      showAssistantPane,
      promptState.ziweiScope,
      ziweiScopeSummaryText,
    ],
  );
  const previewEnhancedPromptText = useMemo(
    () => {
      if (promptState.promptSource !== 'bazi-ziwei') {
        return '';
      }

      if (
        deferredBaziQuickQuestion === effectiveBaziQuickQuestion &&
        deferredFinalBaziQuestion === finalBaziQuestion
      ) {
        return latestEnhancedPromptText;
      }

      return computeEnhancedPromptText(deferredBaziQuickQuestion, deferredFinalBaziQuestion);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeBaziQuestionScopeLabel,
      activeBaziShortcutMode,
      activeZiweiPayloadByScope,
      baziFortuneContext,
      baziResult,
      deferredBaziQuickQuestion,
      deferredFinalBaziQuestion,
      effectiveBaziQuickQuestion,
      enhancedBaziPromptPack,
      enhancedZiweiPromptPack,
      finalBaziQuestion,
      inputState.analysisMode,
      latestEnhancedPromptText,
      promptState.baziFortuneScope,
      promptState.promptSource,
      showAssistantPane,
      promptState.ziweiScope,
      ziweiScopeSummaryText,
    ],
  );

  const basePreviewActivePromptText =
    promptState.promptSource === 'qizheng'
      ? qizhengPromptText
      : promptState.promptSource === 'bazhai'
        ? bazhaiPromptText
        : promptState.promptSource === 'astrolabe'
          ? previewAstrolabePromptText
          : promptState.promptSource === 'bazi-ziwei'
            ? previewEnhancedPromptText
            : promptState.promptSource === 'bazi'
              ? previewBaziPromptText
              : previewZiweiPromptText;
  const previewActivePromptText = basePreviewActivePromptText;

  const aiContextPrompt = useMemo(() => {
    if (!showAssistantPane) return '';

    return previewActivePromptText;
  }, [previewActivePromptText, showAssistantPane]);

  const [inspirationText, setInspirationText] = useState('');
  const baseLatestActivePromptText =
    promptState.promptSource === 'qizheng'
      ? qizhengPromptText
      : promptState.promptSource === 'bazhai'
        ? bazhaiPromptText
        : promptState.promptSource === 'astrolabe'
          ? latestAstrolabePromptText
          : promptState.promptSource === 'bazi-ziwei'
            ? latestEnhancedPromptText
            : promptState.promptSource === 'bazi'
              ? latestBaziPromptText
              : latestZiweiPromptText;
  const latestActivePromptText = baseLatestActivePromptText;
  const { copyState, shareState, handleCopy, handleShare } =
    usePromptCopyShare(latestActivePromptText);
  const showShareButton = shouldShowPromptShareButton({
    viewportWidth: viewportSize.width,
    viewportHeight: viewportSize.height,
    hasNavigatorShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  });

  function switchTab(tab: ResultTabKey) {
    updatePromptState({ tab });
  }

  function buildResultPath(pathname: '/result' | '/result/assistant', tab: ResultTabKey) {
    const search = preserveChartRecordId(
      buildResultSearch(inputState, {
        ...promptState,
        tab,
      }),
      searchParams,
    );
    return `${pathname}?${search}`;
  }

  function openAssistantPage() {
    const path = buildResultPath('/result/assistant', 'prompt');
    navigate(`${path}${path.includes('?') ? '&' : '?'}rt=${activeChartTab}`);
  }

  function returnToChart() {
    const returnTab = searchParams.get('rt');
    const targetTab = chartTabs.find((tab) => tab === returnTab) ?? defaultChartTab;
    navigate(buildResultPath('/result', targetTab));
  }

  function handleInspirationSelect(question: string) {
    applyInspiredQuestion(question);
    setInspirationText(question);
  }

  function handleAiShortcutClick(label: string) {
    const source = promptState.promptSource;
    if (source === 'bazi' || source === 'bazi-ziwei') {
      applyBaziShortcutMode(label);
    } else if (source === 'ziwei') {
      applyZiweiShortcutMode(label);
    } else if (source === 'astrolabe') {
      applyAstrolabeShortcutMode(label);
    }
    setIsAiShortcutPopoverOpen(false);
  }

  const aiMobileShortcutActions =
    promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei'
      ? getBaziShortcutActions(inputState.analysisMode)
      : promptState.promptSource === 'ziwei'
        ? getZiweiShortcutActions(inputState.analysisMode)
        : promptState.promptSource === 'astrolabe'
          ? ASTROLABE_SHORTCUT_ACTIONS
          : [];
  const aiMobileActiveShortcutMode =
    promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei'
      ? activeBaziShortcutMode
      : promptState.promptSource === 'ziwei'
        ? activeZiweiShortcutMode
        : activeAstrolabeShortcutMode;
  const metaphysicsPromptQuestionField =
    isQizhengPromptSource || isBazhaiPromptSource ? (
      <label className="workspace-ui-field metaphysics-prompt-question-field">
        <span>希望重点解读的问题（可选）</span>
        <textarea
          className="workspace-ui-control"
          rows={4}
          value={metaphysicsQuestionDraft}
          onChange={(event) => setMetaphysicsQuestionDraft(event.target.value)}
          placeholder={
            isBazhaiPromptSource
              ? '例如：卧室、书房和大门分别怎样安排更合适？'
              : '例如：请重点分析事业方向、关系模式和近期应注意的风险。'
          }
        />
      </label>
    ) : null;

  return (
    <div className="page-shell workspace-result-page-shell">
      {isAssistantPage ? (
        <ResultAssistantHeader
          aiEnabled={isAiEnabled}
          subtitle={inputState.name || '当前排盘'}
          onBack={returnToChart}
        />
      ) : null}

      {!isAssistantPage ? (
        <div className="workspace-result-navigation">
          <div className="workspace-ui-tabs" aria-label="结果内容">
            {chartTabs.map((tab) => {
              const label = isCombinedResult ? (tab === 'bazi' ? '八字' : '紫微') : '盘面';
              return (
                <button
                  type="button"
                  key={tab}
                  className={`workspace-ui-tab ${activeChartTab === tab ? 'is-active' : ''}`}
                  onClick={() => switchTab(tab)}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="workspace-result-toolbar">
            <WorkspaceButton
              size="small"
              onClick={() => {
                const params = new URLSearchParams(buildInputStateSearch(inputState));
                const recordId = searchParams.get(CHART_RECORD_PARAM);
                if (recordId) params.set(CHART_RECORD_PARAM, recordId);
                navigate(`/chart/${activeChartFeature}?${params.toString()}`);
              }}
            >
              修改资料
            </WorkspaceButton>
          </div>
        </div>
      ) : null}

      <div
        className={`result-tab-stage${showEmbeddedAssistant ? ' workspace-result-split' : ''}${
          isAssistantPage ? ' workspace-result-assistant-stage' : ''
        }`}
      >
        <div
          className={`result-tab-pane workspace-result-chart-pane ${
            !isAssistantPage && activeChartTab === 'bazi' ? 'is-active' : 'is-inactive'
          }`}
          aria-hidden={isAssistantPage || activeChartTab !== 'bazi'}
        >
          {mountedTabs.bazi ? (
            <div className="single-panel-shell">
              <section className="panel result-panel result-panel-bazi">
                {baziError ? <p className="error-text">{baziError}</p> : null}
                {inputState.analysisMode === 'compatibility' ? (
                  <div className="result-dual-layout">
                    {baziResult ? (
                      <BaziChartBoard
                        title="第一人八字"
                        name={inputState.name || '第一人'}
                        result={baziResult}
                      />
                    ) : null}
                    {partnerBaziResult ? (
                      <BaziChartBoard
                        title="第二人八字"
                        name={inputState.partnerName || '第二人'}
                        result={partnerBaziResult}
                      />
                    ) : null}
                  </div>
                ) : baziResult ? (
                  <BaziChartBoard
                    title="八字总览"
                    name={inputState.name || '当前命盘'}
                    result={baziResult}
                  />
                ) : null}
              </section>
            </div>
          ) : null}
        </div>

        <div
          className={`result-tab-pane workspace-result-chart-pane ${
            !isAssistantPage && activeChartTab === 'qizheng' ? 'is-active' : 'is-inactive'
          }`}
          aria-hidden={isAssistantPage || activeChartTab !== 'qizheng'}
        >
          {hasAstrolabeChart && mountedTabs.qizheng ? (
            qizhengCalculation.error ? (
              <p className="error-text">{qizhengCalculation.error}</p>
            ) : qizhengCalculation.data ? (
              <QizhengBoard
                title="七政四余本命盘"
                name={inputState.name || '本人'}
                data={qizhengCalculation.data}
              />
            ) : (
              <InlineSkeleton />
            )
          ) : null}
        </div>

        <div
          className={`result-tab-pane workspace-result-chart-pane ${
            !isAssistantPage && activeChartTab === 'ziwei' ? 'is-active' : 'is-inactive'
          }`}
          aria-hidden={isAssistantPage || activeChartTab !== 'ziwei'}
        >
          {mountedTabs.ziwei ? (
            <div className="single-panel-shell">
              <section className="panel result-panel result-panel-ziwei">
                {ziweiError ? <p className="error-text">{ziweiError}</p> : null}
                {inputState.analysisMode === 'compatibility' && !ziweiError ? (
                  <div className="result-dual-layout">
                    {ziweiRuntime && primaryZiweiInput && currentZiweiPayload ? (
                      <ZiweiBoard
                        title="第一人紫微"
                        name={inputState.name || '第一人'}
                        payload={currentZiweiPayload}
                        chartInput={primaryZiweiInput}
                        runtime={ziweiRuntime}
                      />
                    ) : (
                      <ZiweiBoardSkeleton title="第一人紫微" name={inputState.name || '第一人'} />
                    )}
                    {partnerZiweiRuntime && partnerZiweiInput && partnerZiweiPayload ? (
                      <ZiweiBoard
                        title="第二人紫微"
                        name={inputState.partnerName || '第二人'}
                        payload={partnerZiweiPayload}
                        chartInput={partnerZiweiInput}
                        runtime={partnerZiweiRuntime}
                      />
                    ) : (
                      <ZiweiBoardSkeleton
                        title="第二人紫微"
                        name={inputState.partnerName || '第二人'}
                      />
                    )}
                  </div>
                ) : null}
                {inputState.analysisMode !== 'compatibility' && !ziweiError ? (
                  ziweiRuntime && primaryZiweiInput && currentZiweiPayload ? (
                    <ZiweiBoard
                      title="紫微总览"
                      name={inputState.name || '当前命盘'}
                      payload={currentZiweiPayload}
                      chartInput={primaryZiweiInput}
                      runtime={ziweiRuntime}
                    />
                  ) : (
                    <ZiweiBoardSkeleton title="紫微总览" name={inputState.name || '当前命盘'} />
                  )
                ) : null}
              </section>
            </div>
          ) : null}
        </div>

        <div
          className={`result-tab-pane workspace-result-chart-pane ${
            !isAssistantPage && activeChartTab === 'astrolabe' ? 'is-active' : 'is-inactive'
          }`}
          aria-hidden={isAssistantPage || activeChartTab !== 'astrolabe'}
        >
          {mountedTabs.astrolabe ? (
            <div className="single-panel-shell">
              <section className="panel result-panel result-panel-astrolabe">
                {astrolabeCalculation.error ? (
                  <p className="error-text">{astrolabeCalculation.error}</p>
                ) : null}
                {astrolabeCalculation.data ? (
                  <AstrolabeBoard
                    title="星盘总览"
                    name={astrolabeCalculation.data.birth.name || inputState.name || '当前命盘'}
                    data={astrolabeCalculation.data}
                  />
                ) : null}
              </section>
            </div>
          ) : null}
        </div>

        <div
          className={`result-tab-pane workspace-result-chart-pane ${
            !isAssistantPage && activeChartTab === 'bazhai' ? 'is-active' : 'is-inactive'
          }`}
          aria-hidden={isAssistantPage || activeChartTab !== 'bazhai'}
        >
          {inputState.analysisMode === 'single' && mountedTabs.bazhai ? (
            <Suspense fallback={<InlineSkeleton />}>
              <LazyMetaphysicsPanel
                method="residential"
                birthData={residentialBirthData}
                embedded
                initialFacingDegree={promptState.bazhaiFacingDegree}
                initialHouseYear={promptState.residentialHouseYear}
                onDirectionDegreeChange={handleBazhaiDirectionDegreeChange}
                onHouseYearChange={handleResidentialHouseYearChange}
                onResultChange={handleBazhaiResultChange}
              />
            </Suspense>
          ) : null}
        </div>

        <div
          className={`result-tab-pane workspace-result-assistant-pane ${
            isAiEnabled ? 'is-ai-mode' : 'is-prompt-mode'
          } ${showAssistantPane ? 'is-active' : 'is-inactive'}`}
          aria-hidden={!showAssistantPane}
        >
          {mountedTabs.prompt ? (
            isAiEnabled ? (
              isMobileAi ? (
                /* ── AI 移动端：全屏聊天，顶部紧凑设置栏 + 快捷按钮收进弹层 ── */
                <div className="ai-mobile-chat">
                  <div className="ai-mobile-setting-shell">
                    <div className="ai-mobile-setting-top">
                      {hasAdjustablePromptScope ? (
                        <button
                          type="button"
                          className="ai-mobile-settings-toggle"
                          onClick={() => setIsAiMobileSettingsOpen((value) => !value)}
                        >
                          {isAiMobileSettingsOpen ? '收起范围' : '调整范围'}
                        </button>
                      ) : null}

                      {aiMobileShortcutActions.length > 0 ? (
                        <button
                          type="button"
                          className={`ai-mobile-shortcut-btn ${isAiShortcutPopoverOpen ? 'is-active' : ''}`}
                          onClick={() => setIsAiShortcutPopoverOpen((value) => !value)}
                          title="快捷问题"
                        >
                          ✨ 快捷
                        </button>
                      ) : null}

                      {isAiShortcutPopoverOpen && aiMobileShortcutActions.length > 0 ? (
                        <div className="ai-mobile-shortcut-popover">
                          <div className="ai-mobile-shortcut-popover-inner">
                            <PromptShortcutPanel
                              actions={aiMobileShortcutActions}
                              activeMode={aiMobileActiveShortcutMode}
                              onApplyMode={handleAiShortcutClick}
                              showCustomAndInspiration={false}
                              showCustomAction={false}
                              showInspirationAction={false}
                              customDraft=""
                              onCustomDraftChange={() => {}}
                              customPlaceholder=""
                              onOpenInspiration={() => {}}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {hasAdjustablePromptScope && isAiMobileSettingsOpen ? (
                      <div className="ai-mobile-setting-bar">
                        {(promptState.promptSource === 'bazi' ||
                          promptState.promptSource === 'bazi-ziwei') &&
                        inputState.analysisMode === 'single' ? (
                          <FortuneScopePresetSelect
                            className="ai-mobile-source-select"
                            value={baziFortunePreset}
                            onChange={handleBaziFortunePresetChange}
                          />
                        ) : null}

                        {promptState.promptSource === 'ziwei' ? (
                          <FortuneScopePresetSelect
                            className="ai-mobile-source-select"
                            value={ziweiScopePreset}
                            onChange={handleZiweiScopePresetChange}
                            disabled={!primaryZiweiInput || !activeZiweiPayloadByScope}
                          />
                        ) : null}

                        {promptState.promptSource === 'astrolabe' ? (
                          <FortuneScopePresetSelect
                            className="ai-mobile-source-select"
                            value={astrolabeScopePreset}
                            onChange={handleAstrolabeScopePresetChange}
                            disabled={!astrolabeCalculation.data}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {isAstrolabePromptSource && astrolabeCalculation.error ? (
                    <div className="ai-mobile-hint ai-mobile-hint-error">
                      {astrolabeCalculation.error}
                    </div>
                  ) : null}

                  <AiChatPanel
                    contextPrompt={aiContextPrompt}
                    resetKey={`${promptState.promptSource}-${promptState.baziFortuneScope}-${promptState.ziweiScope}`}
                    onOpenInspiration={inspiration.open}
                    externalInput={inspirationText}
                    onExternalInputConsumed={() => setInspirationText('')}
                    aiConfig={aiRequestConfig}
                  />
                </div>
              ) : (
                /* ── AI 桌面端：左栏设置+快捷，右栏对话 ── */
                <div className="workspace-ai-layout">
                  <section className="workspace-ui-surface">
                    <div className="workspace-ui-panel-head">
                      <div>
                        <h2 className="prompt-settings-title">解析设置</h2>
                        <p>调整分析年限或选择常用问题，在右侧输入问题即可开始 AI 解析。</p>
                      </div>
                    </div>
                    <div className="field-list">
                      {metaphysicsPromptQuestionField}
                      {hasAdjustablePromptScope ? (
                        <div className="prompt-compact-grid">
                          {(promptState.promptSource === 'bazi' ||
                            promptState.promptSource === 'bazi-ziwei') &&
                          inputState.analysisMode === 'single' ? (
                            <div className="workspace-ui-field">
                              <span>年限选择</span>
                              <FortuneScopePresetSelect
                                value={baziFortunePreset}
                                onChange={handleBaziFortunePresetChange}
                              />
                            </div>
                          ) : null}

                          {promptState.promptSource === 'ziwei' ? (
                            <div className="workspace-ui-field">
                              <span>年限选择</span>
                              <FortuneScopePresetSelect
                                value={ziweiScopePreset}
                                onChange={handleZiweiScopePresetChange}
                                disabled={!primaryZiweiInput || !activeZiweiPayloadByScope}
                              />
                            </div>
                          ) : null}

                          {promptState.promptSource === 'astrolabe' ? (
                            <div className="workspace-ui-field">
                              <span>年限选择</span>
                              <FortuneScopePresetSelect
                                value={astrolabeScopePreset}
                                onChange={handleAstrolabeScopePresetChange}
                                disabled={!astrolabeCalculation.data}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {promptState.promptSource === 'bazi' ||
                      promptState.promptSource === 'bazi-ziwei' ? (
                        <PromptShortcutPanel
                          actions={getBaziShortcutActions(inputState.analysisMode)}
                          activeMode={activeBaziShortcutMode}
                          onApplyMode={handleAiShortcutClick}
                          showCustomAndInspiration={false}
                          showCustomAction={false}
                          showInspirationAction={false}
                          customDraft=""
                          onCustomDraftChange={() => {}}
                          customPlaceholder=""
                          onOpenInspiration={() => {}}
                          sections={
                            inputState.analysisMode === 'single'
                              ? singlePromptShortcutSections
                              : undefined
                          }
                        />
                      ) : null}

                      {promptState.promptSource === 'ziwei' ? (
                        <PromptShortcutPanel
                          actions={getZiweiShortcutActions(inputState.analysisMode)}
                          activeMode={activeZiweiShortcutMode}
                          onApplyMode={handleAiShortcutClick}
                          showCustomAndInspiration={false}
                          showCustomAction={false}
                          showInspirationAction={false}
                          customDraft=""
                          onCustomDraftChange={() => {}}
                          customPlaceholder=""
                          onOpenInspiration={() => {}}
                          sections={
                            inputState.analysisMode === 'single'
                              ? singlePromptShortcutSections
                              : undefined
                          }
                        />
                      ) : null}

                      {promptState.promptSource === 'astrolabe' ? (
                        <PromptShortcutPanel
                          actions={ASTROLABE_SHORTCUT_ACTIONS}
                          activeMode={activeAstrolabeShortcutMode}
                          onApplyMode={handleAiShortcutClick}
                          showCustomAndInspiration={false}
                          showCustomAction={false}
                          showInspirationAction={false}
                          customDraft=""
                          onCustomDraftChange={() => {}}
                          customPlaceholder=""
                          onOpenInspiration={() => {}}
                        />
                      ) : null}

                      {isAstrolabePromptSource && astrolabeCalculation.error ? (
                        <p className="error-text">{astrolabeCalculation.error}</p>
                      ) : null}
                    </div>
                  </section>

                  <AiChatPanel
                    contextPrompt={aiContextPrompt}
                    resetKey={`${promptState.promptSource}-${promptState.baziFortuneScope}-${promptState.ziweiScope}`}
                    onOpenInspiration={inspiration.open}
                    externalInput={inspirationText}
                    onExternalInputConsumed={() => setInspirationText('')}
                    aiConfig={aiRequestConfig}
                  />
                </div>
              )
            ) : (
              /* ── 非 AI 模式：先调整提示词，再复制最终内容 ── */
              <div className="workspace-prompt-layout">
                <details className="workspace-ui-surface workspace-prompt-settings">
                  <summary className="workspace-prompt-settings-summary">
                    <span>调整解读范围（可选）</span>
                    <small>调整年限或问题</small>
                  </summary>

                  <div className="workspace-prompt-settings-content field-list">
                    {metaphysicsPromptQuestionField}
                    <>
                      {hasAdjustablePromptScope ? (
                        <div className="prompt-compact-grid">
                          {(promptState.promptSource === 'bazi' ||
                            promptState.promptSource === 'bazi-ziwei') &&
                          inputState.analysisMode === 'single' ? (
                            <div className="workspace-ui-field">
                              <span>年限选择</span>
                              <FortuneScopePresetSelect
                                value={baziFortunePreset}
                                onChange={handleBaziFortunePresetChange}
                              />
                            </div>
                          ) : null}

                          {promptState.promptSource === 'ziwei' ? (
                            <div className="workspace-ui-field">
                              <span>年限选择</span>
                              <FortuneScopePresetSelect
                                value={ziweiScopePreset}
                                onChange={handleZiweiScopePresetChange}
                                disabled={!primaryZiweiInput || !activeZiweiPayloadByScope}
                              />
                            </div>
                          ) : null}

                          {promptState.promptSource === 'astrolabe' ? (
                            <div className="workspace-ui-field">
                              <span>年限选择</span>
                              <FortuneScopePresetSelect
                                value={astrolabeScopePreset}
                                onChange={handleAstrolabeScopePresetChange}
                                disabled={!astrolabeCalculation.data}
                              />
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {promptState.promptSource === 'bazi' ||
                      promptState.promptSource === 'bazi-ziwei' ? (
                        <PromptShortcutPanel
                          actions={getBaziShortcutActions(inputState.analysisMode)}
                          activeMode={activeBaziShortcutMode}
                          onApplyMode={applyBaziShortcutMode}
                          showCustomAndInspiration={inputState.analysisMode === 'single'}
                          showCustomAction
                          showInspirationAction={inputState.analysisMode === 'single'}
                          customDraft={baziQuestionDraft}
                          onCustomDraftChange={setBaziQuestionDraft}
                          customPlaceholder={
                            inputState.analysisMode === 'compatibility'
                              ? '例如：我们适合继续合作，还是更适合保持边界？'
                              : '例如：我近期适合换工作还是稳住？'
                          }
                          onOpenInspiration={inspiration.open}
                          sections={
                            inputState.analysisMode === 'single'
                              ? singlePromptShortcutSections
                              : undefined
                          }
                        />
                      ) : null}

                      {promptState.promptSource === 'ziwei' ? (
                        <PromptShortcutPanel
                          actions={getZiweiShortcutActions(inputState.analysisMode)}
                          activeMode={activeZiweiShortcutMode}
                          onApplyMode={applyZiweiShortcutMode}
                          showCustomAndInspiration={inputState.analysisMode === 'single'}
                          showCustomAction
                          showInspirationAction={inputState.analysisMode === 'single'}
                          customDraft={ziweiQuestionDraft}
                          onCustomDraftChange={setZiweiQuestionDraft}
                          customPlaceholder={
                            inputState.analysisMode === 'compatibility'
                              ? '例如：请直接分析我们这段关系更适合推进，还是先放慢节奏。'
                              : '例如：请重点分析我这段时间该主动还是先稳住。'
                          }
                          onOpenInspiration={inspiration.open}
                          sections={
                            inputState.analysisMode === 'single'
                              ? singlePromptShortcutSections
                              : undefined
                          }
                        />
                      ) : null}

                      {promptState.promptSource === 'astrolabe' ? (
                        <PromptShortcutPanel
                          actions={ASTROLABE_SHORTCUT_ACTIONS}
                          activeMode={activeAstrolabeShortcutMode}
                          onApplyMode={applyAstrolabeShortcutMode}
                          showCustomAndInspiration
                          quickGridClassName="astrolabe-quick-grid"
                          customDraft={astrolabeQuestionDraft}
                          onCustomDraftChange={setAstrolabeQuestionDraft}
                          customPlaceholder="例如：请重点分析我的事业天赋和长期发展方向。"
                          onOpenInspiration={inspiration.open}
                        />
                      ) : null}
                    </>
                  </div>
                </details>

                {isAstrolabePromptSource && astrolabeCalculation.error ? (
                  <p className="error-text">{astrolabeCalculation.error}</p>
                ) : null}

                <section className="workspace-ui-surface workspace-prompt-output">
                  <div className="workspace-ui-panel-head">
                    <h2>提示词</h2>
                    <div className="action-row compact-actions">
                      <WorkspaceButton size="small" onClick={handleCopy}>
                        {copyState}
                      </WorkspaceButton>
                      {showShareButton ? (
                        <WorkspaceButton variant="primary" size="small" onClick={handleShare}>
                          {shareState}
                        </WorkspaceButton>
                      ) : null}
                    </div>
                  </div>
                  <PromptPreview
                    promptText={previewActivePromptText}
                    fallback={<PromptPreSkeleton />}
                  />
                </section>
              </div>
            )
          ) : null}
        </div>
      </div>

      {!isAssistantPage ? (
        <ResultAssistantFab aiEnabled={isAiEnabled} onOpen={openAssistantPage} />
      ) : null}

      {isBaziFortuneModalOpen && baziResult && inputState.analysisMode === 'single' ? (
        <Suspense fallback={<BaziFortuneLoadingModal />}>
          <LazyBaziFortuneModal
            result={baziResult}
            selection={normalizedBaziFortuneSelection}
            onClose={() => setIsBaziFortuneModalOpen(false)}
            onApply={applyBaziFortuneSelection}
          />
        </Suspense>
      ) : null}

      {isZiweiScopeModalOpen && primaryZiweiInput && activeZiweiPayloadByScope && ziweiRuntime ? (
        <ZiweiScopeModal
          chartInput={primaryZiweiInput}
          payloadByScope={activeZiweiPayloadByScope}
          decadalTimeline={ziweiRuntime.decadalTimeline}
          selectedScope={promptState.ziweiScope}
          selectedDateStr={promptState.ziweiScopeDate}
          onClose={() => setIsZiweiScopeModalOpen(false)}
          onApply={(scope, dateStr) =>
            updatePromptState({
              ziweiScope: scope,
              ziweiScopeDate: scope === 'origin' ? '' : dateStr,
            })
          }
        />
      ) : null}

      {isAstrolabeScopeModalOpen && astrolabeCalculation.data ? (
        <AstrolabeScopeModal
          birthYear={inputState.year}
          selectedScope={promptState.astrolabeScope}
          selectedDateStr={promptState.astrolabeScopeDate}
          onClose={() => setIsAstrolabeScopeModalOpen(false)}
          onApply={(scope, dateStr) =>
            updatePromptState({
              astrolabeScope: scope,
              astrolabeScopeDate: scope === 'natal' ? '' : dateStr,
            })
          }
        />
      ) : null}

      {inspiration.isOpen && inputState.analysisMode === 'single' ? (
        <QuestionInspirationModal
          filters={inspiration.inspirationFilters}
          activeFilter={inspiration.activeCategory}
          onFilterChange={(value) => inspiration.setActiveCategory(value as InspirationCategory)}
          searchValue={inspiration.search}
          onSearchChange={inspiration.setSearch}
          sections={inspiration.filteredSections}
          emptyText="没有找到匹配的问题，请换个搜索词或主题。"
          onSelect={handleInspirationSelect}
          onClose={inspiration.close}
        />
      ) : null}
    </div>
  );
}
