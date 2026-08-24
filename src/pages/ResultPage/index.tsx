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
import { QuestionInspirationModal } from '@/components/QuestionInspirationModal';
import { useViewportSize } from '@/hooks/useViewportWidth';
import { getBaziDefaultQuestion } from '@/lib/prompt-default-questions';
import { ASTROLABE_SHORTCUT_ACTIONS } from '@/lib/astrolabe-prompts';
import { formatBaziForPrompt } from 'mingyu-core/bazi';
import { buildDivinationPrompt } from '@/lib/divination/engine';
import { createBoundedMemoryCache } from '@/lib/bounded-memory-cache';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { generateQizheng, type QizhengResult } from 'mingyu-core/qizheng';
import type { ResidentialFengshuiResult } from 'mingyu-core/residential-fengshui';
import type { AstrolabeData } from '@/types/divination';
import type { BaziFortuneSelectionModule, PromptEngineModule } from './ResultPage.types';
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
import { buildCurrentBaziFortuneSelection } from '@/components/BaziFortuneTools/helpers';
import type { BaziFortuneSelectionValue } from 'mingyu-core/bazi';
import { PromptWorkbenchPanel } from '@/components/PromptPreview';
import { DropdownSelect, type DropdownSelectOption } from '@/components/DropdownSelect';
import { normalizeChartInputForSource, preserveChartRecordId } from '@/lib/case-navigation';
import { isInstantChartType, readInstantTimeStandard } from '@/lib/instant-chart';
import {
  buildInstantAstrolabePrompt,
  buildInstantBaziPrompt,
  buildInstantBaziZiweiPrompt,
  buildInstantQizhengPrompt,
  buildInstantZiweiPrompt,
} from '@/lib/instant-prompt';

type FortuneScopePreset = 'default' | 'dayun' | 'year' | 'month' | 'day' | 'all' | 'manual';
type FortuneScopePresetKind = 'bazi' | 'ziwei' | 'astrolabe';

function FortuneScopePresetSelect(props: {
  value: FortuneScopePreset;
  onChange: (value: FortuneScopePreset) => void;
  kind: FortuneScopePresetKind;
  currentAvailable?: boolean;
  disabled?: boolean;
}) {
  const currentAvailable = props.currentAvailable ?? true;
  const options: DropdownSelectOption<FortuneScopePreset>[] = [
    { value: 'default', label: '本命（默认）', triggerLabel: '本命' },
    ...(props.kind === 'bazi'
      ? [
          { value: 'dayun', label: '当前大运', disabled: !currentAvailable },
          { value: 'year', label: '当前流年', disabled: !currentAvailable },
          { value: 'month', label: '当前流月', disabled: !currentAvailable },
          { value: 'day', label: '当前流日', disabled: !currentAvailable },
        ]
      : props.kind === 'ziwei'
        ? [
            { value: 'dayun', label: '当前大限' },
            { value: 'year', label: '当前流年' },
            { value: 'month', label: '当前流月' },
            { value: 'day', label: '当前流日' },
          ]
        : [
            { value: 'year', label: '当前流年' },
            { value: 'month', label: '当前流月' },
            { value: 'day', label: '当前流日' },
          ]),
    {
      value: 'all',
      label: props.kind === 'bazi' ? '全部大运' : props.kind === 'ziwei' ? '完整运限' : '完整行运',
    },
    { value: 'manual', label: '自选年限' },
  ];

  return (
    <DropdownSelect
      value={props.value}
      options={options}
      onChange={props.onChange}
      disabled={props.disabled}
      ariaLabel="解读范围"
      prefix="范围"
      variant="field"
    />
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
  if (first.scope !== second.scope) return false;
  if (first.scope === 'natal' || first.scope === 'full') return true;
  if (first.cycleIndex !== second.cycleIndex) return false;
  if (first.scope === 'dayun') return true;
  if (first.year !== second.year) return false;
  if (first.scope === 'year') return true;
  if (first.month !== second.month) return false;
  if (first.scope === 'month') return true;
  return first.day === second.day;
}

const LazyBaziFortuneModal = lazy(async () => {
  const module = await import('@/components/BaziFortuneTools/BaziFortuneModal');
  return { default: module.BaziFortuneModal };
});

const LazyMetaphysicsPanel = lazy(async () => {
  const module = await import('@/components/MetaphysicsPanel');
  return { default: module.MetaphysicsPanel };
});

const astrolabeResultCache = createBoundedMemoryCache<AstrolabeData>(8);
const qizhengResultCache = createBoundedMemoryCache<QizhengResult>(8);

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
  const instantChartType = searchParams.get('instant');
  const isInstantResult = isInstantChartType(instantChartType);
  const instantTimeStandard = readInstantTimeStandard(searchParams.get('its'));
  const instantTimeBasisLabel = instantTimeStandard === 'true-solar' ? '真太阳时' : '北京时间';
  const promptState = useMemo(() => parsePromptState(searchParams), [searchParams]);
  const inputState = useMemo(
    () => normalizeChartInputForSource(parseInputState(searchParams), promptState.promptSource),
    [promptState.promptSource, searchParams],
  );
  const inputSearch = useMemo(() => buildInputStateSearch(inputState), [inputState]);
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
    !isInstantResult &&
    (((promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei') &&
      inputState.analysisMode === 'single') ||
      promptState.promptSource === 'ziwei' ||
      promptState.promptSource === 'astrolabe');
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
    !isInstantResult &&
    (promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei');
  const [isBaziFortuneModalOpen, setIsBaziFortuneModalOpen] = useState(false);
  const [isZiweiScopeModalOpen, setIsZiweiScopeModalOpen] = useState(false);
  const [isAstrolabeScopeModalOpen, setIsAstrolabeScopeModalOpen] = useState(false);
  const inspiration = useQuestionInspiration();
  const [aiSettings] = useAiSettings();
  const isAiEnabled = aiSettings.enabled;
  const aiRequestConfig = useMemo(() => buildAiRequestConfig(aiSettings), [aiSettings]);
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
  const currentBaziFortuneSelection = useMemo(
    () => (baziResult ? buildCurrentBaziFortuneSelection(baziResult, currentScopeDate) : null),
    [baziResult, currentScopeDate],
  );
  const baziFortunePreset: FortuneScopePreset =
    normalizedBaziFortuneSelection.scope === 'natal'
      ? 'default'
      : normalizedBaziFortuneSelection.scope === 'full'
        ? 'all'
        : currentBaziFortuneSelection &&
            isSameBaziFortuneSelection(normalizedBaziFortuneSelection, {
              ...currentBaziFortuneSelection,
              scope: normalizedBaziFortuneSelection.scope,
            })
          ? normalizedBaziFortuneSelection.scope
          : 'manual';
  const ziweiScopePreset: FortuneScopePreset =
    promptState.ziweiScope === 'origin'
      ? 'default'
      : promptState.ziweiScope === 'full'
        ? 'all'
        : promptState.ziweiScopeDate === currentDateStr
          ? promptState.ziweiScope === 'decadal'
            ? 'dayun'
            : promptState.ziweiScope === 'yearly'
              ? 'year'
              : promptState.ziweiScope === 'monthly'
                ? 'month'
                : promptState.ziweiScope === 'daily'
                  ? 'day'
                  : 'manual'
          : 'manual';
  const currentAstrolabeScopeDate =
    promptState.astrolabeScope === 'yearly'
      ? currentDateStr.slice(0, 4)
      : promptState.astrolabeScope === 'monthly'
        ? currentDateStr.slice(0, 7)
        : currentDateStr;
  const astrolabeScopePreset: FortuneScopePreset =
    promptState.astrolabeScope === 'natal'
      ? 'default'
      : promptState.astrolabeScope === 'full'
        ? 'all'
        : promptState.astrolabeScopeDate === currentAstrolabeScopeDate
          ? promptState.astrolabeScope === 'yearly'
            ? 'year'
            : promptState.astrolabeScope === 'monthly'
              ? 'month'
              : promptState.astrolabeScope === 'daily'
                ? 'day'
                : 'manual'
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
    if (
      (value === 'dayun' || value === 'year' || value === 'month' || value === 'day') &&
      currentBaziFortuneSelection
    ) {
      applyBaziFortuneSelection({ ...currentBaziFortuneSelection, scope: value });
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
      ziweiScope:
        value === 'all'
          ? 'full'
          : value === 'dayun'
            ? 'decadal'
            : value === 'year'
              ? 'yearly'
              : value === 'month'
                ? 'monthly'
                : value === 'day'
                  ? 'daily'
                  : 'origin',
      ziweiScopeDate:
        value === 'dayun' || value === 'year' || value === 'month' || value === 'day'
          ? currentDateStr
          : '',
    });
  }

  function handleAstrolabeScopePresetChange(value: FortuneScopePreset) {
    if (value === 'manual') {
      setIsAstrolabeScopeModalOpen(true);
      return;
    }
    const astrolabeScope =
      value === 'all'
        ? 'full'
        : value === 'year'
          ? 'yearly'
          : value === 'month'
            ? 'monthly'
            : value === 'day'
              ? 'daily'
              : 'natal';
    updatePromptState({
      astrolabeScope,
      astrolabeScopeDate:
        astrolabeScope === 'yearly'
          ? currentDateStr.slice(0, 4)
          : astrolabeScope === 'monthly'
            ? currentDateStr.slice(0, 7)
            : astrolabeScope === 'daily' || astrolabeScope === 'full'
              ? currentDateStr
              : '',
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

      const astrolabeInput: Parameters<typeof generateAstrolabe>[0] = {
        name: inputState.name || '本人',
        gender: isInstantResult ? '' : inputState.gender === 'female' ? '女' : '男',
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
      };
      const cacheKey = JSON.stringify(astrolabeInput);
      let data = astrolabeResultCache.get(cacheKey);
      if (!data) {
        data = generateAstrolabe(astrolabeInput);
        astrolabeResultCache.set(cacheKey, data);
      }

      return {
        data,
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
    isInstantResult,
    shouldCalculateAstrolabe,
  ]);
  const shouldCalculateQizheng =
    hasAstrolabeChart && (mountedTabs.qizheng || (mountedTabs.prompt && isQizhengPromptSource));
  const qizhengCalculation = useMemo<{ data: QizhengResult | null; error: string }>(() => {
    if (!shouldCalculateQizheng || !sharedBirthData) return { data: null, error: '' };
    try {
      const cacheKey = JSON.stringify(sharedBirthData);
      let data = qizhengResultCache.get(cacheKey);
      if (!data) {
        data = generateQizheng(sharedBirthData);
        qizhengResultCache.set(cacheKey, data);
      }
      return {
        data,
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
    if (isInstantResult) {
      return baziResult
        ? buildInstantBaziPrompt(baziResult, finalQuestion || question, instantTimeBasisLabel)
        : '';
    }
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
    if (isInstantResult) {
      return currentZiweiPayload
        ? buildInstantZiweiPrompt(currentZiweiPayload, question, instantTimeBasisLabel)
        : '';
    }
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
    if (
      isInstantResult ||
      !showAssistantPane ||
      promptState.promptSource !== 'bazi-ziwei' ||
      !currentZiweiPayload
    ) {
      return '';
    }

    const ziweiTopic = resolveZiweiTopicByBaziShortcutMode(activeBaziShortcutMode);
    return buildEnhancedZiweiPromptPack(currentZiweiPayload, ziweiTopic);
  }, [
    activeBaziShortcutMode,
    currentZiweiPayload,
    isInstantResult,
    promptState.promptSource,
    showAssistantPane,
  ]);

  const enhancedBaziPromptPack = useMemo(() => {
    if (
      isInstantResult ||
      !showAssistantPane ||
      promptState.promptSource !== 'bazi-ziwei' ||
      !baziResult
    ) {
      return '';
    }

    const baseText = formatBaziForPrompt(baziResult, null, 'general');
    const fullFortuneText =
      promptState.baziFortuneScope === 'full' ? formatBaziFullFortuneText(baziResult) : '';

    return [baseText, fullFortuneText ? `【命限资料】\n${fullFortuneText}` : '']
      .filter(Boolean)
      .join('\n\n');
  }, [
    baziResult,
    isInstantResult,
    promptState.baziFortuneScope,
    promptState.promptSource,
    showAssistantPane,
  ]);

  function computeEnhancedPromptText(question: string, finalQuestion: string): string {
    if (!showAssistantPane || inputState.analysisMode !== 'single') return '';
    if (isInstantResult) {
      return baziResult && currentZiweiPayload
        ? buildInstantBaziZiweiPrompt(
            baziResult,
            currentZiweiPayload,
            finalQuestion || question,
            instantTimeBasisLabel,
          )
        : '';
    }
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

    if (isInstantResult) {
      return buildInstantAstrolabePrompt(
        astrolabeCalculation.data,
        effectiveAstrolabeQuickQuestion,
        instantTimeBasisLabel,
      );
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
    instantTimeBasisLabel,
    isInstantResult,
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

    if (isInstantResult) {
      return buildInstantAstrolabePrompt(
        astrolabeCalculation.data,
        deferredAstrolabeQuestion,
        instantTimeBasisLabel,
      );
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
    instantTimeBasisLabel,
    isInstantResult,
    promptState.astrolabeTopic,
    promptState.promptSource,
    showAssistantPane,
  ]);
  const qizhengPromptText = useMemo(() => {
    if (!showAssistantPane || promptState.promptSource !== 'qizheng' || !qizhengCalculation.data) {
      return '';
    }
    return isInstantResult
      ? buildInstantQizhengPrompt(
          qizhengCalculation.data,
          metaphysicsQuestionDraft,
          instantTimeBasisLabel,
        )
      : buildMetaphysicsPrompt(qizhengCalculation.data.prompt, metaphysicsQuestionDraft, {
          method: 'qizheng',
        });
  }, [
    instantTimeBasisLabel,
    isInstantResult,
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

  function applyActiveShortcutMode(label: string) {
    const source = promptState.promptSource;
    if (source === 'bazi' || source === 'bazi-ziwei') {
      applyBaziShortcutMode(label);
    } else if (source === 'ziwei') {
      applyZiweiShortcutMode(label);
    } else if (source === 'astrolabe') {
      applyAstrolabeShortcutMode(label);
    }
  }

  const promptShortcutActions = useMemo(
    () =>
      promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei'
        ? getBaziShortcutActions(inputState.analysisMode)
        : promptState.promptSource === 'ziwei'
          ? getZiweiShortcutActions(inputState.analysisMode)
          : promptState.promptSource === 'astrolabe'
            ? ASTROLABE_SHORTCUT_ACTIONS
            : [],
    [inputState.analysisMode, promptState.promptSource],
  );
  const activePromptShortcutMode =
    promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei'
      ? activeBaziShortcutMode
      : promptState.promptSource === 'ziwei'
        ? activeZiweiShortcutMode
        : promptState.promptSource === 'astrolabe'
          ? activeAstrolabeShortcutMode
          : metaphysicsQuestionDraft.trim()
            ? '自定义'
            : '未指定';
  const activePromptQuestionDraft =
    promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei'
      ? baziQuestionDraft
      : promptState.promptSource === 'ziwei'
        ? ziweiQuestionDraft
        : promptState.promptSource === 'astrolabe'
          ? astrolabeQuestionDraft
          : metaphysicsQuestionDraft;
  const activePromptQuestionPlaceholder = isBazhaiPromptSource
    ? '例如：卧室、书房和大门分别怎样安排更合适？'
    : isQizhengPromptSource
      ? '例如：请重点分析事业方向、关系模式和近期应注意的风险。'
      : inputState.analysisMode === 'compatibility'
        ? '输入这段关系或合作最想了解的问题'
        : '输入你真正想问的问题';
  const natalPromptSections = useMemo(() => {
    const keyword = inspiration.deferredSearch.trim().toLocaleLowerCase();
    const actionMap = new Map(promptShortcutActions.map((item) => [item.label, item]));
    const groupedLabels = new Set<string>();
    const sourceSections =
      inputState.analysisMode === 'single'
        ? singlePromptShortcutSections
        : [
            {
              key: 'compatibility',
              title: '关系主题',
              description: '选择合盘重点',
              labels: promptShortcutActions.map((item) => item.label),
            },
          ];
    const sections = sourceSections
      .map((section) => {
        const items = section.labels
          .filter((label) => actionMap.has(label))
          .filter((label) =>
            keyword
              ? `${section.title}${section.description}${label}`
                  .toLocaleLowerCase()
                  .includes(keyword)
              : true,
          )
          .map((label) => {
            groupedLabels.add(label);
            return {
              id: `natal-${section.key}-${label}`,
              question: label,
            };
          });
        return {
          id: `natal-${section.key}`,
          heading: section.title,
          items,
        };
      })
      .filter((section) => section.items.length > 0);
    const ungroupedItems = promptShortcutActions
      .filter((item) => !groupedLabels.has(item.label))
      .filter((item) => (keyword ? item.label.toLocaleLowerCase().includes(keyword) : true))
      .map((item) => ({
        id: `natal-other-${item.label}`,
        question: item.label,
      }));

    return ungroupedItems.length > 0
      ? [...sections, { id: 'natal-other', heading: '其他主题', items: ungroupedItems }]
      : sections;
  }, [inputState.analysisMode, inspiration.deferredSearch, promptShortcutActions]);
  const questionPickerSections =
    inspiration.activeMode === 'matter' ? inspiration.filteredMatterSections : natalPromptSections;

  function handlePromptQuestionDraftChange(value: string) {
    const source = promptState.promptSource;
    if (source === 'bazi' || source === 'bazi-ziwei') {
      if (activeBaziShortcutMode !== '自定义' && activeBaziShortcutMode !== '问题灵感') {
        applyBaziShortcutMode('自定义');
      }
      setBaziQuestionDraft(value);
    } else if (source === 'ziwei') {
      if (activeZiweiShortcutMode !== '自定义' && activeZiweiShortcutMode !== '问题灵感') {
        applyZiweiShortcutMode('自定义');
      }
      setZiweiQuestionDraft(value);
    } else if (source === 'astrolabe') {
      if (activeAstrolabeShortcutMode !== '自定义' && activeAstrolabeShortcutMode !== '问题灵感') {
        applyAstrolabeShortcutMode('自定义');
      }
      setAstrolabeQuestionDraft(value);
    } else {
      setMetaphysicsQuestionDraft(value);
    }
  }

  function handleQuestionPickerSelect(value: string) {
    if (inspiration.activeMode === 'matter') {
      if (isAiEnabled) {
        inspiration.close();
        setInspirationText(value);
        return;
      }
      handleInspirationSelect(value);
      return;
    }

    applyActiveShortcutMode(value);
    inspiration.close();
  }
  const promptScopeField = hasAdjustablePromptScope ? (
    <div className="workspace-prompt-scope" title="本命包含完整本命资料；其他范围会追加相应岁运">
      {(promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei') &&
      inputState.analysisMode === 'single' ? (
        <FortuneScopePresetSelect
          value={baziFortunePreset}
          onChange={handleBaziFortunePresetChange}
          kind="bazi"
          currentAvailable={Boolean(currentBaziFortuneSelection)}
        />
      ) : null}

      {promptState.promptSource === 'ziwei' ? (
        <FortuneScopePresetSelect
          value={ziweiScopePreset}
          onChange={handleZiweiScopePresetChange}
          kind="ziwei"
          disabled={!primaryZiweiInput || !activeZiweiPayloadByScope}
        />
      ) : null}

      {promptState.promptSource === 'astrolabe' ? (
        <FortuneScopePresetSelect
          value={astrolabeScopePreset}
          onChange={handleAstrolabeScopePresetChange}
          kind="astrolabe"
          disabled={!astrolabeCalculation.data}
        />
      ) : null}
    </div>
  ) : null;
  const aiComposerTools = (
    <>
      <div
        className={`workspace-ai-composer-toolbar${hasAdjustablePromptScope ? '' : ' is-single'}`}
      >
        <WorkspaceButton
          className="workspace-question-picker-trigger"
          onClick={() => inspiration.open('matter')}
        >
          <span>问题灵感</span>
        </WorkspaceButton>
        {promptScopeField}
      </div>

      {isAstrolabePromptSource && astrolabeCalculation.error ? (
        <p className="error-text">{astrolabeCalculation.error}</p>
      ) : null}
    </>
  );

  return (
    <div
      className={`page-shell workspace-result-page-shell${
        isAssistantPage && isAiEnabled ? ' is-mobile-ai-immersive' : ''
      }`}
    >
      {isAssistantPage ? (
        <ResultAssistantHeader
          aiEnabled={isAiEnabled}
          subtitle={inputState.name || '当前排盘'}
          onBack={returnToChart}
        />
      ) : null}

      {!isAssistantPage && chartTabs.length > 1 ? (
        <div className="workspace-result-navigation">
          <div className="workspace-ui-tabs" aria-label="结果内容">
            {chartTabs.map((tab) => {
              const label = tab === 'bazi' ? '八字' : '紫微';
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
                        isInstant={isInstantResult}
                        timeBasisLabel={instantTimeBasisLabel}
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
                    title={isInstantResult ? '八字即时盘' : '八字总览'}
                    name={isInstantResult ? '当前时刻' : inputState.name || '当前命盘'}
                    result={baziResult}
                    isInstant={isInstantResult}
                    timeBasisLabel={instantTimeBasisLabel}
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
                title={isInstantResult ? '七政四余即时盘' : '七政四余本命盘'}
                name={isInstantResult ? '当前时刻' : inputState.name || '本人'}
                data={qizhengCalculation.data}
                isInstant={isInstantResult}
                timeBasisLabel={instantTimeBasisLabel}
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
                      title={isInstantResult ? '紫微即时盘' : '紫微总览'}
                      name={isInstantResult ? '当前时刻' : inputState.name || '当前命盘'}
                      payload={currentZiweiPayload}
                      chartInput={primaryZiweiInput}
                      runtime={ziweiRuntime}
                      isInstant={isInstantResult}
                      timeBasisLabel={instantTimeBasisLabel}
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
                    title={isInstantResult ? '星盘即时盘' : '星盘总览'}
                    name={
                      isInstantResult
                        ? '当前时刻'
                        : astrolabeCalculation.data.birth.name || inputState.name || '当前命盘'
                    }
                    data={astrolabeCalculation.data}
                    isInstant={isInstantResult}
                    timeBasisLabel={instantTimeBasisLabel}
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
              /* ── AI 模式：上方纯解答，工具和大输入框固定在底部 ── */
              <div className="workspace-ai-layout is-answer-workbench">
                <AiChatPanel
                  contextPrompt={aiContextPrompt}
                  resetKey={`${promptState.promptSource}-${promptState.baziFortuneScope}-${promptState.ziweiScope}`}
                  externalInput={inspirationText}
                  onExternalInputConsumed={() => setInspirationText('')}
                  aiConfig={aiRequestConfig}
                  workspaceMode
                  composerTools={aiComposerTools}
                  inputResetKey={`${inputSearch}:${promptState.promptSource}`}
                />
              </div>
            ) : (
              /* ── 非 AI 模式：提示词在上，选择与输入固定在底部 ── */
              <div className="workspace-prompt-layout is-workbench">
                <PromptWorkbenchPanel
                  promptText={previewActivePromptText}
                  fallback={<PromptPreSkeleton />}
                  copyState={copyState}
                  shareState={shareState}
                  onCopy={handleCopy}
                  onShare={handleShare}
                >
                  <div
                    className={`workspace-prompt-composer-toolbar${
                      hasAdjustablePromptScope ? '' : ' is-single'
                    }`}
                  >
                    <WorkspaceButton
                      className="workspace-question-picker-trigger"
                      onClick={() => inspiration.open('matter')}
                    >
                      <span>选择问题</span>
                      <small>{activePromptShortcutMode}</small>
                    </WorkspaceButton>
                    {promptScopeField}
                  </div>

                  <label className="workspace-ui-field workspace-prompt-question-input">
                    <span>输入问题</span>
                    <textarea
                      className="workspace-ui-control"
                      rows={4}
                      value={activePromptQuestionDraft}
                      onChange={(event) => handlePromptQuestionDraftChange(event.target.value)}
                      placeholder={activePromptQuestionPlaceholder}
                    />
                  </label>

                  {isAstrolabePromptSource && astrolabeCalculation.error ? (
                    <p className="error-text">{astrolabeCalculation.error}</p>
                  ) : null}
                </PromptWorkbenchPanel>
              </div>
            )
          ) : null}
        </div>
      </div>

      {!isAssistantPage ? (
        <ResultAssistantFab aiEnabled={isAiEnabled} onOpen={openAssistantPage} />
      ) : null}

      {!isInstantResult &&
      isBaziFortuneModalOpen &&
      baziResult &&
      inputState.analysisMode === 'single' ? (
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

      {inspiration.isOpen ? (
        <QuestionInspirationModal
          title="选择问题"
          filters={inspiration.modeFilters}
          activeFilter={inspiration.activeMode}
          onFilterChange={(value) =>
            inspiration.setActiveMode(value === 'natal' ? 'natal' : 'matter')
          }
          searchValue={inspiration.search}
          onSearchChange={inspiration.setSearch}
          searchPlaceholder={
            inspiration.activeMode === 'matter' ? '搜索想问的事情' : '搜索命书主题'
          }
          sections={questionPickerSections}
          emptyText={
            inspiration.activeMode === 'natal' && promptShortcutActions.length === 0
              ? '当前排盘暂无命书模板，可直接输入问题。'
              : '没有找到匹配的问题，请换个搜索词。'
          }
          onSelect={handleQuestionPickerSelect}
          onClose={inspiration.close}
          filterVariant="segmented"
          selectedQuestion={
            inspiration.activeMode === 'matter'
              ? activePromptQuestionDraft
              : activePromptShortcutMode
          }
        />
      ) : null}
    </div>
  );
}
