import {
  Suspense,
  lazy,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  buildCombinedZiweiCompatibilityPrompt,
  buildCombinedZiweiPrompt,
} from '@/lib/full-chart-engine';
import {
  buildResultSearch,
  buildInputSearch,
  parseInputState,
  parsePromptState,
  type PromptSourceKey,
  type QueryPromptState,
  type ResultTabKey,
} from '@/lib/query-state';
import { buildAstrolabeScopeContext } from '@/lib/astrolabe-scope';
import { shouldShowPromptShareButton } from '@/lib/prompt-page-rules';
import { PageTopbar } from '@/components/PageTopbar';
import { QuestionInspirationModal } from '@/components/QuestionInspirationModal';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { buildUnknownTimeBaziPrompt } from '@/lib/birth-time-reverse';
import { getBaziDefaultQuestion } from '@/lib/prompt-default-questions';
import { ASTROLABE_SHORTCUT_ACTIONS } from '@/lib/astrolabe-prompts';
import { formatBaziForPrompt } from '@/utils/bazi/baziAnalysisFormatter';
import { buildDivinationPrompt } from '@/lib/divination/engine';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { AstrolabeData } from '@/types/divination';
import type {
  BaziFortuneSelectionModule,
  InspirationCategory,
  PromptEngineModule,
  QuestionInspirationIntent,
} from './ResultPage.types';
import { PROMPT_DRAFT_STORAGE_PREFIX } from './ResultPage.constants';
import {
  buildBaziZiweiEnhancedPrompt,
  buildEnhancedZiweiPromptPack,
  buildBaziFortuneSelectionValue,
  buildCombinedPromptText,
  buildCompatibilityPromptWithUnknownTime,
  formatZiweiPromptScopeSummary,
  getBaziShortcutActions,
  getZiweiShortcutActions,
  mapBaziFortuneToZiweiScope,
  resolveBaziQuestionSceneByShortcutMode,
  resolveCompatType,
  resolveZiweiTopicByBaziQuestionScene,
} from './ResultPage.helpers';
import { singlePromptShortcutSections } from './ResultPage.constants';
import {
  BaziFortuneLoadingModal,
  InlineSkeleton,
  PromptPreSkeleton,
  ZiweiBoardSkeleton,
} from './components/skeletons';
import { AstrolabeBoard } from './components/AstrolabeBoard';
import { usePromptCopyShare } from '@/hooks/usePromptCopyShare';
import { BaziChartBoard } from './components/BaziChartBoard';
import { ThreePillarsBoard } from './components/ThreePillarsBoard';
import { ZiweiBoard } from './components/ZiweiBoard';
import { ZiweiScopeModal } from './components/ZiweiScopeModal';
import { AstrolabeScopeModal } from './components/AstrolabeScopeModal';
import { PromptShortcutPanel } from './components/PromptShortcutPanel';
import { useQuestionInspiration } from './hooks/useQuestionInspiration';
import { useBaziCalculations } from './hooks/useBaziCalculations';
import { useZiweiCalculations } from './hooks/useZiweiCalculations';
import { usePromptShortcuts } from './hooks/usePromptShortcuts';
import { AiChatPanel } from '@/components/AiChatPanel';
import { useAiSettings } from '@/hooks/useAiSettings';
import { buildAiRequestConfig } from '@/lib/ai/settings';

const LazyBaziFortuneModal = lazy(async () => {
  const module = await import('@/components/BaziFortuneTools/BaziFortuneModal');
  return { default: module.BaziFortuneModal };
});

export function ResultPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const inputSearch = useMemo(() => buildInputSearch(searchParams), [searchParams]);
  const inputState = useMemo(
    () => parseInputState(new URLSearchParams(inputSearch)),
    [inputSearch],
  );
  const promptState = useMemo(() => parsePromptState(searchParams), [searchParams]);
  const hasAstrolabeChart =
    inputState.analysisMode === 'single' &&
    inputState.useTrueSolarTime &&
    Boolean(inputState.birthHour) &&
    Boolean(inputState.birthMinute) &&
    Boolean(inputState.birthPlace) &&
    Boolean(inputState.birthLongitude) &&
    Boolean(inputState.birthLatitude);
  const isAstrolabePromptSource = promptState.promptSource === 'astrolabe';
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
    promptState.tab === 'prompt' &&
    (promptState.promptSource === 'bazi' || promptState.promptSource === 'bazi-ziwei');
  const [isBaziFortuneModalOpen, setIsBaziFortuneModalOpen] = useState(false);
  const [isZiweiScopeModalOpen, setIsZiweiScopeModalOpen] = useState(false);
  const [isAstrolabeScopeModalOpen, setIsAstrolabeScopeModalOpen] = useState(false);
  const inspiration = useQuestionInspiration();
  const viewportWidth = useViewportWidth(0);
  const [aiSettings] = useAiSettings();
  const isAiEnabled = aiSettings.enabled;
  const aiRequestConfig = useMemo(() => buildAiRequestConfig(aiSettings), [aiSettings]);
  const isMobileAi = isAiEnabled && viewportWidth > 0 && viewportWidth < 768;
  const [isAiShortcutPopoverOpen, setIsAiShortcutPopoverOpen] = useState(false);
  const [isAiMobileSettingsOpen, setIsAiMobileSettingsOpen] = useState(true);
  const [promptEngine, setPromptEngine] = useState<PromptEngineModule | null>(null);
  const [baziFortuneSelectionModule, setBaziFortuneSelectionModule] =
    useState<BaziFortuneSelectionModule | null>(null);
  const [mountedTabs, setMountedTabs] = useState<Record<ResultTabKey, boolean>>(() => ({
    bazi: promptState.tab === 'bazi',
    ziwei: promptState.tab === 'ziwei',
    astrolabe: promptState.tab === 'astrolabe',
    prompt: promptState.tab === 'prompt',
  }));
  const {
    baziResult,
    partnerBaziResult,
    baziError,
    primaryThreePillarsState,
    partnerThreePillarsState,
    primaryHasUnknownTime,
    partnerHasUnknownTime,
    hasUnknownBirthTime,
  } = useBaziCalculations(inputState);
  const {
    ziweiRuntime,
    partnerZiweiRuntime,
    ziweiError,
    primaryZiweiInput,
    partnerZiweiInput,
    activeZiweiPayloadByScope,
    currentZiweiPayload,
    partnerZiweiPayload,
  } = useZiweiCalculations(
    inputState,
    promptState,
    mountedTabs.ziwei,
    mountedTabs.prompt,
    primaryHasUnknownTime,
    partnerHasUnknownTime,
  );
  const updatePromptState = useCallback(
    (next: Partial<QueryPromptState>) => {
      const merged = {
        ...promptState,
        ...next,
      };

      setSearchParams(buildResultSearch(inputState, merged), { replace: true });
    },
    [inputState, promptState, setSearchParams],
  );
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
    if (
      !hasUnknownBirthTime ||
      (promptState.promptSource !== 'ziwei' && promptState.promptSource !== 'bazi-ziwei')
    ) {
      return;
    }

    updatePromptState({
      promptSource: 'bazi',
    });
  }, [hasUnknownBirthTime, promptState.promptSource, updatePromptState]);

  useEffect(() => {
    if (inputState.analysisMode === 'single' || promptState.promptSource !== 'bazi-ziwei') {
      return;
    }

    updatePromptState({
      promptSource: 'bazi',
    });
  }, [inputState.analysisMode, promptState.promptSource, updatePromptState]);

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
          import('@/utils/bazi/fortuneSelection').then((module) => {
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

    return baziFortuneSelectionModule.normalizeFortuneSelection(baziResult, baziFortuneSelection);
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

  const deferredBaziQuickQuestion = useDeferredValue(effectiveBaziQuickQuestion);
  const deferredZiweiQuickQuestion = useDeferredValue(effectiveZiweiQuickQuestion);
  const deferredAstrolabeQuestion = useDeferredValue(effectiveAstrolabeQuickQuestion);
  const shouldCalculateAstrolabe =
    hasAstrolabeChart &&
    (mountedTabs.astrolabe ||
      (promptState.tab === 'prompt' && isAstrolabePromptSource) ||
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
          timezone: '8',
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
  const astrolabeScopeContext = useMemo(
    () =>
      buildAstrolabeScopeContext(
        astrolabeCalculation.data,
        promptState.astrolabeScope,
        promptState.astrolabeScopeDate,
      ),
    [astrolabeCalculation.data, promptState.astrolabeScope, promptState.astrolabeScopeDate],
  );

  const activeBaziQuestionScene = useMemo(() => {
    if (activeBaziShortcutMode === '自定义') {
      return undefined;
    }
    if (activeBaziShortcutMode === '问题灵感') {
      return promptState.baziQuestionScene;
    }
    return resolveBaziQuestionSceneByShortcutMode(activeBaziShortcutMode);
  }, [activeBaziShortcutMode, promptState.baziQuestionScene]);

  function computeBaziPromptText(question: string, finalQuestion: string): string {
    if (promptState.tab !== 'prompt') return '';
    if (inputState.analysisMode === 'compatibility') {
      if (primaryHasUnknownTime || partnerHasUnknownTime) {
        const firstText = primaryHasUnknownTime
          ? primaryThreePillarsState.profile?.promptText || ''
          : baziResult
            ? formatBaziForPrompt(baziResult, null, 'compatibility')
            : '';
        const secondText = partnerHasUnknownTime
          ? partnerThreePillarsState.profile?.promptText || ''
          : partnerBaziResult
            ? formatBaziForPrompt(partnerBaziResult, null, 'compatibility')
            : '';

        if (!firstText || !secondText) return '';

        return buildCompatibilityPromptWithUnknownTime({
          firstName: inputState.name || '第一人',
          firstText,
          secondName: inputState.partnerName || '第二人',
          secondText,
          question,
          isCustomQuestion: activeBaziShortcutMode === '自定义',
        });
      }

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
    if (primaryHasUnknownTime) {
      if (!primaryThreePillarsState.profile) return '';
      const isCustomQuestion = activeBaziShortcutMode === '自定义';
      return buildUnknownTimeBaziPrompt(
        primaryThreePillarsState.profile,
        question,
        activeBaziQuestionScene,
        { isCustomQuestion },
      );
    }
    if (!promptEngine || !baziResult || !baziFortuneSelectionModule || !selectedBaziPreset) {
      return '';
    }
    const { system, user } = promptEngine.buildPromptFromConfig(
      finalQuestion,
      selectedBaziPreset,
      baziResult,
      baziFortuneContext,
      activeBaziQuestionScene,
      { isCustomQuestion: activeBaziShortcutMode === '自定义' },
    );
    return buildCombinedPromptText(system, user);
  }

  const defaultBaziQuestion = useMemo(
    () =>
      getBaziDefaultQuestion(activeBaziQuestionScene, {
        isCustomQuestion: activeBaziShortcutMode === '自定义',
      }),
    [activeBaziQuestionScene, activeBaziShortcutMode],
  );
  function computeZiweiPromptText(question: string): string {
    if (promptState.tab !== 'prompt') return '';
    if (inputState.analysisMode === 'compatibility') {
      if (!currentZiweiPayload || !partnerZiweiPayload) return '';
      return buildCombinedZiweiCompatibilityPrompt({
        primaryPayload: currentZiweiPayload,
        partnerPayload: partnerZiweiPayload,
        topic: promptState.ziweiTopic,
        question,
        isCustomQuestion: activeZiweiShortcutMode === '自定义',
      });
    }
    if (!currentZiweiPayload) return '';
    return buildCombinedZiweiPrompt(currentZiweiPayload, promptState.ziweiTopic, question, {
      isCustomQuestion: activeZiweiShortcutMode === '自定义',
    });
  }

  const ziweiScopeSummaryText =
    promptState.ziweiScope === 'origin'
      ? '仅使用本命信息'
      : formatZiweiPromptScopeSummary(
          promptState.ziweiScope,
          promptState.ziweiScopeDate,
          promptState.ziweiScopeDate ? currentZiweiPayload?.active_scope.label : undefined,
        );

  const enhancedZiweiPromptPack = useMemo(() => {
    if (
      promptState.tab !== 'prompt' ||
      promptState.promptSource !== 'bazi-ziwei' ||
      !currentZiweiPayload
    ) {
      return '';
    }

    const ziweiTopic = resolveZiweiTopicByBaziQuestionScene(activeBaziQuestionScene);
    return buildEnhancedZiweiPromptPack(currentZiweiPayload, ziweiTopic);
  }, [activeBaziQuestionScene, currentZiweiPayload, promptState.promptSource, promptState.tab]);

  const enhancedBaziPromptPack = useMemo(() => {
    if (
      promptState.tab !== 'prompt' ||
      promptState.promptSource !== 'bazi-ziwei' ||
      primaryHasUnknownTime ||
      !baziResult
    ) {
      return '';
    }

    return formatBaziForPrompt(baziResult, null, 'general');
  }, [baziResult, primaryHasUnknownTime, promptState.promptSource, promptState.tab]);

  function computeEnhancedPromptText(question: string, finalQuestion: string): string {
    if (promptState.tab !== 'prompt' || inputState.analysisMode !== 'single') return '';
    if (primaryHasUnknownTime || !baziResult || !enhancedZiweiPromptPack || !enhancedBaziPromptPack)
      return '';

    return buildBaziZiweiEnhancedPrompt({
      baziResult,
      baziText: enhancedBaziPromptPack,
      ziweiText: enhancedZiweiPromptPack,
      question: finalQuestion || question,
      questionScene: activeBaziQuestionScene,
      baziFortuneSummary: baziFortuneContext
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
      partnerHasUnknownTime,
      partnerThreePillarsState.profile,
      primaryHasUnknownTime,
      primaryThreePillarsState.profile,
      promptEngine,
      promptState.baziPresetId,
      promptState.baziQuestionScene,
      promptState.promptSource,
      promptState.tab,
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
      partnerHasUnknownTime,
      partnerThreePillarsState.profile,
      primaryHasUnknownTime,
      primaryThreePillarsState.profile,
      promptEngine,
      promptState.baziPresetId,
      promptState.baziQuestionScene,
      promptState.promptSource,
      promptState.tab,
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
      currentZiweiPayload,
      activeZiweiShortcutMode,
      effectiveZiweiQuickQuestion,
      inputState.analysisMode,
      partnerZiweiPayload,
      promptState.promptSource,
      promptState.tab,
      promptState.ziweiTopic,
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
      currentZiweiPayload,
      activeZiweiShortcutMode,
      deferredZiweiQuickQuestion,
      effectiveZiweiQuickQuestion,
      inputState.analysisMode,
      latestZiweiPromptText,
      partnerZiweiPayload,
      promptState.promptSource,
      promptState.tab,
      promptState.ziweiTopic,
    ],
  );

  const latestAstrolabePromptText = useMemo(() => {
    if (
      promptState.promptSource !== 'astrolabe' ||
      promptState.tab !== 'prompt' ||
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
        astrolabeScopeText: astrolabeScopeContext.promptText,
      },
    );
  }, [
    activeAstrolabeShortcutMode,
    astrolabeScopeContext.promptText,
    astrolabeCalculation.data,
    effectiveAstrolabeQuickQuestion,
    promptState.astrolabeTopic,
    promptState.promptSource,
    promptState.tab,
  ]);
  const previewAstrolabePromptText = useMemo(() => {
    if (promptState.promptSource !== 'astrolabe') {
      return '';
    }

    if (deferredAstrolabeQuestion === effectiveAstrolabeQuickQuestion) {
      return latestAstrolabePromptText;
    }

    if (promptState.tab !== 'prompt' || !astrolabeCalculation.data) {
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
        astrolabeScopeText: astrolabeScopeContext.promptText,
      },
    );
  }, [
    activeAstrolabeShortcutMode,
    astrolabeScopeContext.promptText,
    astrolabeCalculation.data,
    deferredAstrolabeQuestion,
    effectiveAstrolabeQuickQuestion,
    latestAstrolabePromptText,
    promptState.astrolabeTopic,
    promptState.promptSource,
    promptState.tab,
  ]);
  const latestEnhancedPromptText = useMemo(
    () =>
      promptState.promptSource === 'bazi-ziwei'
        ? computeEnhancedPromptText(effectiveBaziQuickQuestion, finalBaziQuestion)
        : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      activeBaziQuestionScene,
      activeBaziShortcutMode,
      baziFortuneContext,
      baziResult,
      enhancedBaziPromptPack,
      effectiveBaziQuickQuestion,
      enhancedZiweiPromptPack,
      finalBaziQuestion,
      inputState.analysisMode,
      primaryHasUnknownTime,
      promptState.promptSource,
      promptState.tab,
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
      activeBaziQuestionScene,
      activeBaziShortcutMode,
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
      primaryHasUnknownTime,
      promptState.promptSource,
      promptState.tab,
      promptState.ziweiScope,
      ziweiScopeSummaryText,
    ],
  );

  const previewActivePromptText =
    promptState.promptSource === 'astrolabe'
      ? previewAstrolabePromptText
      : promptState.promptSource === 'bazi-ziwei'
        ? previewEnhancedPromptText
        : promptState.promptSource === 'bazi'
          ? previewBaziPromptText
          : previewZiweiPromptText;

  // AI 对话页使用的上下文提示词（不含用户自定义问题，仅排盘数据 + 设置摘要）
  const aiContextPrompt = useMemo(() => {
    if (promptState.tab !== 'prompt') return '';

    // 以现有完整提示词为基础，去掉末尾的用户问题部分
    // 实际发送时由 AiChatPanel 拼接用户输入
    return previewActivePromptText;
  }, [previewActivePromptText, promptState.tab]);

  // 灵感选取的问题文本，传递给 AiChatPanel 填入输入框
  const [inspirationText, setInspirationText] = useState('');
  // 快捷按钮直接发送指令
  const [directSend, setDirectSend] = useState<{ text: string; id: string } | undefined>();
  const isBaziFortuneSummaryLoading = shouldLoadBaziPromptModules && !baziFortuneSelectionModule;
  const baziFortuneSummaryText = baziFortuneContext?.displayText ?? '仅使用本命信息';
  const astrolabeScopeSummaryText = astrolabeScopeContext.displayText;

  const latestActivePromptText =
    promptState.promptSource === 'astrolabe'
      ? latestAstrolabePromptText
      : promptState.promptSource === 'bazi-ziwei'
        ? latestEnhancedPromptText
        : promptState.promptSource === 'bazi'
          ? latestBaziPromptText
          : latestZiweiPromptText;
  const { copyState, shareState, handleCopy, handleShare } =
    usePromptCopyShare(latestActivePromptText);
  const showShareButton = shouldShowPromptShareButton({
    viewportWidth,
    hasNavigatorShare: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  });

  function switchTab(tab: ResultTabKey) {
    updatePromptState({ tab });
  }

  function handleInspirationSelect(question: string, category?: string, intent?: string) {
    applyInspiredQuestion(question, category, intent as QuestionInspirationIntent | undefined);
    setInspirationText(question);
  }

  // AI 模式：快捷问题点击 → 直接发送
  const directSendCounterRef = useRef(0);
  function handleAiShortcutClick(label: string) {
    const source = promptState.promptSource;
    let question = '';
    if (source === 'bazi' || source === 'bazi-ziwei') {
      applyBaziShortcutMode(label);
      const actions = getBaziShortcutActions(inputState.analysisMode);
      question = actions.find((a) => a.label === label)?.question ?? '';
    } else if (source === 'ziwei') {
      applyZiweiShortcutMode(label);
      const actions = getZiweiShortcutActions(inputState.analysisMode);
      question = actions.find((a) => a.label === label)?.question ?? '';
    } else if (source === 'astrolabe') {
      applyAstrolabeShortcutMode(label);
      question = ASTROLABE_SHORTCUT_ACTIONS.find((a) => a.label === label)?.question ?? '';
    }
    if (question) {
      directSendCounterRef.current++;
      setDirectSend({ text: question, id: `s-${directSendCounterRef.current}` });
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

  return (
    <div className="page-shell">
      <PageTopbar
        title="排盘结果"
        wide
        onBack={() =>
          navigate(
            `/?mode=${inputState.analysisMode === 'compatibility' ? 'compatibility' : 'single'}`,
          )
        }
      />

      <div className="tab-strip">
        <button
          type="button"
          className={`tab-chip ${promptState.tab === 'bazi' ? 'is-active' : ''}`}
          onClick={() => switchTab('bazi')}
        >
          八字
        </button>
        <button
          type="button"
          className={`tab-chip ${promptState.tab === 'ziwei' ? 'is-active' : ''}`}
          onClick={() => switchTab('ziwei')}
        >
          紫微
        </button>
        {hasAstrolabeChart ? (
          <button
            type="button"
            className={`tab-chip ${promptState.tab === 'astrolabe' ? 'is-active' : ''}`}
            onClick={() => switchTab('astrolabe')}
          >
            星盘
          </button>
        ) : null}
        <button
          type="button"
          className={`tab-chip ${promptState.tab === 'prompt' ? 'is-active' : ''}`}
          onClick={() => switchTab('prompt')}
        >
          {isAiEnabled ? 'AI 解析' : '提示词'}
        </button>
      </div>

      <div className="result-tab-stage">
        <div
          className={`result-tab-pane ${promptState.tab === 'bazi' ? 'is-active' : 'is-inactive'}`}
          aria-hidden={promptState.tab !== 'bazi'}
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
                    ) : primaryThreePillarsState.profile ? (
                      <ThreePillarsBoard
                        title="第一人三柱"
                        name={inputState.name || '第一人'}
                        profile={primaryThreePillarsState.profile}
                      />
                    ) : null}
                    {partnerBaziResult ? (
                      <BaziChartBoard
                        title="第二人八字"
                        name={inputState.partnerName || '第二人'}
                        result={partnerBaziResult}
                      />
                    ) : partnerThreePillarsState.profile ? (
                      <ThreePillarsBoard
                        title="第二人三柱"
                        name={inputState.partnerName || '第二人'}
                        profile={partnerThreePillarsState.profile}
                      />
                    ) : null}
                  </div>
                ) : baziResult ? (
                  <BaziChartBoard
                    title="八字总览"
                    name={inputState.name || '当前命盘'}
                    result={baziResult}
                  />
                ) : primaryThreePillarsState.profile ? (
                  <ThreePillarsBoard
                    title="三柱总览"
                    name={inputState.name || '当前命盘'}
                    profile={primaryThreePillarsState.profile}
                  />
                ) : null}
              </section>
            </div>
          ) : null}
        </div>

        <div
          className={`result-tab-pane ${promptState.tab === 'ziwei' ? 'is-active' : 'is-inactive'}`}
          aria-hidden={promptState.tab !== 'ziwei'}
        >
          {mountedTabs.ziwei ? (
            <div className="single-panel-shell">
              <section className="panel result-panel result-panel-ziwei">
                {ziweiError ? <p className="error-text">{ziweiError}</p> : null}
                {hasUnknownBirthTime ? (
                  <div className="prompt-send-tip">
                    当前存在未知时辰。紫微排盘必须先确定出生时辰，请先使用“反推时辰”确认后再看紫微结果。
                  </div>
                ) : null}
                {inputState.analysisMode === 'compatibility' &&
                currentZiweiPayload &&
                partnerZiweiPayload ? (
                  <div className="result-dual-layout">
                    {ziweiRuntime && primaryZiweiInput ? (
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
                    {partnerZiweiRuntime && partnerZiweiInput ? (
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
                {inputState.analysisMode !== 'compatibility' && currentZiweiPayload ? (
                  ziweiRuntime && primaryZiweiInput ? (
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
          className={`result-tab-pane ${promptState.tab === 'astrolabe' ? 'is-active' : 'is-inactive'}`}
          aria-hidden={promptState.tab !== 'astrolabe'}
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
          className={`result-tab-pane ${promptState.tab === 'prompt' ? 'is-active' : 'is-inactive'}`}
          aria-hidden={promptState.tab !== 'prompt'}
        >
          {mountedTabs.prompt ? (
            isAiEnabled ? (
              isMobileAi ? (
                /* ── AI 移动端：全屏聊天，顶部紧凑设置栏 + 快捷按钮收进弹层 ── */
                <div className="ai-mobile-chat">
                  <div className="ai-mobile-setting-shell">
                    <div className="ai-mobile-setting-top">
                      <button
                        type="button"
                        className="ai-mobile-settings-toggle"
                        onClick={() => setIsAiMobileSettingsOpen((value) => !value)}
                      >
                        {isAiMobileSettingsOpen ? '收起设置' : '展开设置'}
                      </button>

                      <button
                        type="button"
                        className={`ai-mobile-shortcut-btn ${isAiShortcutPopoverOpen ? 'is-active' : ''}`}
                        onClick={() => setIsAiShortcutPopoverOpen((value) => !value)}
                        title="快捷问题"
                      >
                        ✨ 快捷
                      </button>

                      {isAiShortcutPopoverOpen ? (
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

                    {isAiMobileSettingsOpen ? (
                      <div className="ai-mobile-setting-bar">
                        <select
                          className="ai-mobile-source-select"
                          value={promptState.promptSource}
                          onChange={(event) =>
                            updatePromptState({
                              promptSource: event.target.value as PromptSourceKey,
                            })
                          }
                        >
                          <option value="bazi">八字</option>
                          <option value="ziwei" disabled={hasUnknownBirthTime}>
                            {hasUnknownBirthTime ? '紫微(未知时辰)' : '紫微'}
                          </option>
                          {inputState.analysisMode === 'single' ? (
                            <option value="bazi-ziwei" disabled={hasUnknownBirthTime}>
                              八字+紫微
                            </option>
                          ) : null}
                          {hasAstrolabeChart ? <option value="astrolabe">星盘</option> : null}
                        </select>

                        {(promptState.promptSource === 'bazi' ||
                          promptState.promptSource === 'bazi-ziwei') &&
                        inputState.analysisMode === 'single' &&
                        !primaryHasUnknownTime ? (
                          <button
                            type="button"
                            className="ai-mobile-scope-btn"
                            onClick={() => setIsBaziFortuneModalOpen(true)}
                          >
                            {isBaziFortuneSummaryLoading ? '年限…' : baziFortuneSummaryText}
                          </button>
                        ) : null}

                        {promptState.promptSource === 'ziwei' ? (
                          <button
                            type="button"
                            className="ai-mobile-scope-btn"
                            onClick={() => setIsZiweiScopeModalOpen(true)}
                            disabled={!primaryZiweiInput || !activeZiweiPayloadByScope}
                          >
                            {!primaryZiweiInput || !activeZiweiPayloadByScope
                              ? '年限…'
                              : ziweiScopeSummaryText}
                          </button>
                        ) : null}

                        {promptState.promptSource === 'astrolabe' ? (
                          <button
                            type="button"
                            className="ai-mobile-scope-btn"
                            onClick={() => setIsAstrolabeScopeModalOpen(true)}
                            disabled={!astrolabeCalculation.data}
                          >
                            {!astrolabeCalculation.data ? '年限…' : astrolabeScopeSummaryText}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  {hasUnknownBirthTime &&
                  (promptState.promptSource === 'bazi' ||
                    promptState.promptSource === 'bazi-ziwei') ? (
                    <div className="ai-mobile-hint">未知时辰，已自动三柱保守解析。</div>
                  ) : null}
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
                    directSend={directSend}
                    aiConfig={aiRequestConfig}
                  />
                </div>
              ) : (
                /* ── AI 桌面端：左栏设置+快捷，右栏对话 ── */
                <div className="workspace-grid-ai">
                  <section className="panel">
                    <div className="panel-head">
                      <div>
                        <h2 className="prompt-settings-title">解析设置</h2>
                        <p>选择排盘来源和分析年限，在右侧输入问题即可开始 AI 解析。</p>
                      </div>
                    </div>
                    <div className="field-list">
                      <div className="prompt-compact-grid">
                        <label className="field-card">
                          <div className="field-header">
                            <span className="prompt-source-title">解析来源</span>
                          </div>
                          <select
                            value={promptState.promptSource}
                            onChange={(event) =>
                              updatePromptState({
                                promptSource: event.target.value as PromptSourceKey,
                              })
                            }
                          >
                            <option value="bazi">基于八字</option>
                            <option value="ziwei" disabled={hasUnknownBirthTime}>
                              {hasUnknownBirthTime ? '基于紫微（未知时辰不可用）' : '基于紫微'}
                            </option>
                            {inputState.analysisMode === 'single' ? (
                              <option value="bazi-ziwei" disabled={hasUnknownBirthTime}>
                                {hasUnknownBirthTime
                                  ? '基于八字+紫微（未知时辰不可用）'
                                  : '基于八字+紫微'}
                              </option>
                            ) : null}
                            {hasAstrolabeChart ? <option value="astrolabe">基于星盘</option> : null}
                          </select>
                        </label>

                        {(promptState.promptSource === 'bazi' ||
                          promptState.promptSource === 'bazi-ziwei') &&
                        inputState.analysisMode === 'single' &&
                        !primaryHasUnknownTime ? (
                          <div className="field-card">
                            <div className="field-header">
                              <span>年限选择</span>
                            </div>
                            <button
                              type="button"
                              className="place-trigger"
                              onClick={() => setIsBaziFortuneModalOpen(true)}
                            >
                              {isBaziFortuneSummaryLoading ? (
                                <InlineSkeleton className="inline-skeleton inline-skeleton-medium" />
                              ) : (
                                <span>{baziFortuneSummaryText}</span>
                              )}
                            </button>
                          </div>
                        ) : null}

                        {promptState.promptSource === 'ziwei' ? (
                          <div className="field-card">
                            <div className="field-header">
                              <span>年限选择</span>
                            </div>
                            <button
                              type="button"
                              className="place-trigger"
                              onClick={() => setIsZiweiScopeModalOpen(true)}
                              disabled={!primaryZiweiInput || !activeZiweiPayloadByScope}
                            >
                              {!primaryZiweiInput || !activeZiweiPayloadByScope ? (
                                <InlineSkeleton className="inline-skeleton inline-skeleton-medium" />
                              ) : (
                                <span>{ziweiScopeSummaryText}</span>
                              )}
                            </button>
                          </div>
                        ) : null}

                        {promptState.promptSource === 'astrolabe' ? (
                          <div className="field-card">
                            <div className="field-header">
                              <span>年限选择</span>
                            </div>
                            <button
                              type="button"
                              className="place-trigger"
                              onClick={() => setIsAstrolabeScopeModalOpen(true)}
                              disabled={!astrolabeCalculation.data}
                            >
                              {!astrolabeCalculation.data ? (
                                <InlineSkeleton className="inline-skeleton inline-skeleton-medium" />
                              ) : (
                                <span>{astrolabeScopeSummaryText}</span>
                              )}
                            </button>
                          </div>
                        ) : null}
                      </div>

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

                      {hasUnknownBirthTime &&
                      (promptState.promptSource === 'bazi' ||
                        promptState.promptSource === 'bazi-ziwei') ? (
                        <div className="prompt-send-tip">
                          当前存在未知时辰，已自动改为三柱保守解析，不会假定时柱。
                        </div>
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
                    directSend={directSend}
                    aiConfig={aiRequestConfig}
                  />
                </div>
              )
            ) : (
              /* ── 非 AI 模式：原始布局，左侧设置+提示词快捷面板，右侧提示词正文 ── */
              <div className="workspace-grid">
                <section className="panel">
                  <div className="panel-head">
                    <div>
                      <h2 className="prompt-settings-title">提示词设置</h2>
                      <p>
                        {hasAstrolabeChart
                          ? '选择星盘解读重点，生成可复制给 AI 的提示词。'
                          : '选择基于八字、紫微或八字+紫微的已选分析对象，再用快捷按钮生成问题。'}
                      </p>
                    </div>
                  </div>

                  <div className="field-list">
                    <>
                      <div className="prompt-compact-grid">
                        <label className="field-card">
                          <div className="field-header">
                            <span className="prompt-source-title">提示词来源</span>
                          </div>
                          <select
                            value={promptState.promptSource}
                            onChange={(event) =>
                              updatePromptState({
                                promptSource: event.target.value as PromptSourceKey,
                              })
                            }
                          >
                            <option value="bazi">基于八字</option>
                            <option value="ziwei" disabled={hasUnknownBirthTime}>
                              {hasUnknownBirthTime ? '基于紫微（未知时辰不可用）' : '基于紫微'}
                            </option>
                            {inputState.analysisMode === 'single' ? (
                              <option value="bazi-ziwei" disabled={hasUnknownBirthTime}>
                                {hasUnknownBirthTime
                                  ? '基于八字+紫微（未知时辰不可用）'
                                  : '基于八字+紫微'}
                              </option>
                            ) : null}
                            {hasAstrolabeChart ? <option value="astrolabe">基于星盘</option> : null}
                          </select>
                        </label>

                        {(promptState.promptSource === 'bazi' ||
                          promptState.promptSource === 'bazi-ziwei') &&
                        inputState.analysisMode === 'single' &&
                        !primaryHasUnknownTime ? (
                          <div className="field-card">
                            <div className="field-header">
                              <span>年限选择</span>
                            </div>
                            <button
                              type="button"
                              className="place-trigger"
                              onClick={() => setIsBaziFortuneModalOpen(true)}
                            >
                              {isBaziFortuneSummaryLoading ? (
                                <InlineSkeleton className="inline-skeleton inline-skeleton-medium" />
                              ) : (
                                <span>{baziFortuneSummaryText}</span>
                              )}
                            </button>
                          </div>
                        ) : null}

                        {promptState.promptSource === 'ziwei' ? (
                          <div className="field-card">
                            <div className="field-header">
                              <span>年限选择</span>
                            </div>
                            <button
                              type="button"
                              className="place-trigger"
                              onClick={() => setIsZiweiScopeModalOpen(true)}
                              disabled={!primaryZiweiInput || !activeZiweiPayloadByScope}
                            >
                              {!primaryZiweiInput || !activeZiweiPayloadByScope ? (
                                <InlineSkeleton className="inline-skeleton inline-skeleton-medium" />
                              ) : (
                                <span>{ziweiScopeSummaryText}</span>
                              )}
                            </button>
                          </div>
                        ) : null}

                        {promptState.promptSource === 'astrolabe' ? (
                          <div className="field-card">
                            <div className="field-header">
                              <span>年限选择</span>
                            </div>
                            <button
                              type="button"
                              className="place-trigger"
                              onClick={() => setIsAstrolabeScopeModalOpen(true)}
                              disabled={!astrolabeCalculation.data}
                            >
                              {!astrolabeCalculation.data ? (
                                <InlineSkeleton className="inline-skeleton inline-skeleton-medium" />
                              ) : (
                                <span>{astrolabeScopeSummaryText}</span>
                              )}
                            </button>
                          </div>
                        ) : null}
                      </div>

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
                </section>

                {hasUnknownBirthTime &&
                (promptState.promptSource === 'bazi' ||
                  promptState.promptSource === 'bazi-ziwei') ? (
                  <div className="prompt-send-tip">
                    当前存在未知时辰，已自动改为三柱保守提示词，不会假定时柱。
                  </div>
                ) : null}
                {isAstrolabePromptSource && astrolabeCalculation.error ? (
                  <p className="error-text">{astrolabeCalculation.error}</p>
                ) : null}

                <section className="panel panel-output">
                  <div className="panel-head">
                    <div>
                      <h2>提示词正文</h2>
                      <p>系统要求和问题正文已合并，复制这一整段提示词即可。</p>
                    </div>
                    <div className="action-row compact-actions">
                      <button
                        className="copy-button secondary-button"
                        type="button"
                        onClick={handleCopy}
                      >
                        {copyState}
                      </button>
                      {showShareButton ? (
                        <button className="copy-button" type="button" onClick={handleShare}>
                          {shareState}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="prompt-send-tip">
                    点击复制后，发送到你常用的在线 AI 软件继续提问。
                  </div>
                  {previewActivePromptText ? (
                    <pre className="result-pre">{previewActivePromptText}</pre>
                  ) : (
                    <PromptPreSkeleton />
                  )}
                </section>
              </div>
            )
          ) : null}
        </div>
      </div>

      {isBaziFortuneModalOpen && baziResult && inputState.analysisMode === 'single' ? (
        <Suspense fallback={<BaziFortuneLoadingModal />}>
          <LazyBaziFortuneModal
            result={baziResult}
            selection={baziFortuneSelection}
            onClose={() => setIsBaziFortuneModalOpen(false)}
            onApply={(next) => {
              const nextPromptState: Partial<QueryPromptState> = {
                baziFortuneScope: next.scope,
                baziFortuneCycleIndex: next.scope === 'natal' ? '' : String(next.cycleIndex ?? ''),
                baziFortuneYear: next.scope === 'natal' ? '' : String(next.year ?? ''),
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
            }}
          />
        </Suspense>
      ) : null}

      {isZiweiScopeModalOpen && primaryZiweiInput && activeZiweiPayloadByScope ? (
        <ZiweiScopeModal
          chartInput={primaryZiweiInput}
          payloadByScope={activeZiweiPayloadByScope}
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
          emptyText="没有找到匹配的问题，请换个关键词或分类。"
          onSelect={handleInspirationSelect}
          onClose={inspiration.close}
        />
      ) : null}
    </div>
  );
}
