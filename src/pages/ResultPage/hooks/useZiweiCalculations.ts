import { useWorkerRequest } from '@/hooks/useWorkerRequest';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildZiweiChartInput } from '@/lib/full-chart-engine/ziwei';
import { birthProfileToZiweiChartInput } from 'mingyu-core/profile';
import { getDefaultHoroscopeContext, type ZiweiRuntimeOptions } from 'mingyu-core/ziwei';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { ReadingResource } from '@/lib/ai/reading-workflow';
import type { QueryInputState } from '@/lib/query-state';
import type { BaziRangePage } from '@/lib/full-chart-engine/bazi-range';
import type { ZiweiPayloadByScopeState, ZiweiRuntimeState } from '../ResultPage.types';
import {
  getCachedZiweiDisplayPayload,
  getCachedZiweiPayload,
  getCachedZiweiRuntime,
  getZiweiDisplayKey,
  getZiweiInputKey,
  getZiweiPayloadKey,
  getZiweiReadingResourceKey,
  getZiweiRuntimeKey,
  loadZiweiDisplayPayload,
  loadZiweiPromptScopePayloads,
  loadZiweiReadingResource,
  loadZiweiPayload,
  loadZiweiRuntime,
  stabilizeZiweiChartInput,
} from '../utils/ziweiCalculationCache';

export interface ZiweiCalculations {
  ziweiRuntime: ZiweiRuntimeState;
  partnerZiweiRuntime: ZiweiRuntimeState;
  ziweiPayloadByScope: ZiweiPayloadByScopeState;
  partnerZiweiPayloadByScope: ZiweiPayloadByScopeState;
  promptZiweiPayload: AnalysisPayloadV1 | null;
  promptPartnerZiweiPayload: AnalysisPayloadV1 | null;
  ziweiError: string;
  ziweiFortuneText: string;
  primaryZiweiInput: ChartInput | null;
  partnerZiweiInput: ChartInput | null;
  activeZiweiPayloadByScope: ZiweiPayloadByScopeState;
  activePartnerZiweiPayloadByScope: ZiweiPayloadByScopeState;
  currentZiweiPayload: AnalysisPayloadV1 | null;
  promptZiweiScopePayloads: Partial<Record<ScopeType, AnalysisPayloadV1>> | null;
  partnerZiweiPayload: AnalysisPayloadV1 | null;
  ziweiReadingResources: ReadingResource[];
  ziweiReadingResourcesReady: boolean;
  ziweiReadingResourceError: string;
  reloadZiweiReadingResources: () => void;
  ziweiLoading: boolean;
  cancelZiwei: () => void;
  retryZiwei: () => void;
  ziweiPaused: boolean;
}

export interface ZiweiRangeSelection {
  requested: boolean;
  page: BaziRangePage | null;
  paused?: boolean;
}

export function useZiweiCalculations(
  inputState: QueryInputState,
  promptState: {
    tab: string;
    promptSource: string;
    ziweiScope: string;
    ziweiScopeDate: string;
  },
  isZiweiTabMounted: boolean,
  isPromptTabMounted: boolean,
  isInstantResult = false,
  rangeSelection: ZiweiRangeSelection = { requested: false, page: null },
): ZiweiCalculations {
  const rangeRequested = rangeSelection.requested;
  const rangePage = rangeRequested ? rangeSelection.page : null;
  const rangePaused = rangeRequested && rangeSelection.paused === true;
  const fixedHoroscopeContext = useMemo(() => getDefaultHoroscopeContext(), []);
  const ziweiRuntimeOptions = useMemo<ZiweiRuntimeOptions>(
    () => ({ horoscopeContext: fixedHoroscopeContext }),
    [fixedHoroscopeContext],
  );

  const primaryZiweiInput = useMemo(() => {
    try {
      if (rangeRequested) {
        return rangePage
          ? stabilizeZiweiChartInput(birthProfileToZiweiChartInput(rangePage.primary.profile))
          : null;
      }
      return stabilizeZiweiChartInput(buildZiweiChartInput(inputState));
    } catch {
      return null;
    }
  }, [inputState, rangePage, rangeRequested]);

  const partnerZiweiInput = useMemo(() => {
    if (inputState.analysisMode !== 'compatibility') return null;

    try {
      if (rangeRequested) {
        return rangePage?.partner
          ? stabilizeZiweiChartInput(birthProfileToZiweiChartInput(rangePage.partner.profile))
          : null;
      }
      return stabilizeZiweiChartInput(
        buildZiweiChartInput({
          name: inputState.partnerName,
          gender: inputState.partnerGender,
          dateType: inputState.partnerDateType,
          year: inputState.partnerYear,
          month: inputState.partnerMonth,
          day: inputState.partnerDay,
          timeIndex: inputState.partnerTimeIndex,
          isLeapMonth: inputState.partnerIsLeapMonth,
          useTrueSolarTime: inputState.partnerUseTrueSolarTime,
          birthHour: inputState.partnerBirthHour,
          birthMinute: inputState.partnerBirthMinute,
          birthSecond: inputState.partnerBirthSecond,
          birthLongitude: inputState.partnerBirthLongitude,
        }),
      );
    } catch {
      return null;
    }
  }, [inputState, rangePage, rangeRequested]);

  const primaryZiweiInputKey = primaryZiweiInput ? getZiweiInputKey(primaryZiweiInput) : '';
  const partnerZiweiInputKey = partnerZiweiInput ? getZiweiInputKey(partnerZiweiInput) : '';
  const primaryPayloadKey = primaryZiweiInputKey
    ? getZiweiPayloadKey(primaryZiweiInputKey, ziweiRuntimeOptions)
    : '';
  const partnerPayloadKey = partnerZiweiInputKey
    ? getZiweiPayloadKey(partnerZiweiInputKey, ziweiRuntimeOptions)
    : '';
  const primaryRuntimeKey = primaryZiweiInputKey
    ? getZiweiRuntimeKey(primaryZiweiInputKey, ziweiRuntimeOptions)
    : '';
  const partnerRuntimeKey = partnerZiweiInputKey
    ? getZiweiRuntimeKey(partnerZiweiInputKey, ziweiRuntimeOptions)
    : '';
  const initialPrimaryRuntime = primaryRuntimeKey ? getCachedZiweiRuntime(primaryRuntimeKey) : null;
  const initialPartnerRuntime = partnerRuntimeKey ? getCachedZiweiRuntime(partnerRuntimeKey) : null;
  const initialPrimaryPayload = primaryPayloadKey ? getCachedZiweiPayload(primaryPayloadKey) : null;
  const initialPartnerPayload = partnerPayloadKey ? getCachedZiweiPayload(partnerPayloadKey) : null;

  const [ziweiRuntime, setZiweiRuntime] = useState<ZiweiRuntimeState>(initialPrimaryRuntime);
  const [partnerZiweiRuntime, setPartnerZiweiRuntime] =
    useState<ZiweiRuntimeState>(initialPartnerRuntime);
  const [ziweiPayloadByScope, setZiweiPayloadByScope] =
    useState<ZiweiPayloadByScopeState>(initialPrimaryPayload);
  const [partnerZiweiPayloadByScope, setPartnerZiweiPayloadByScope] =
    useState<ZiweiPayloadByScopeState>(initialPartnerPayload);
  const [primaryRuntimeInputKey, setPrimaryRuntimeInputKey] = useState(
    initialPrimaryRuntime ? primaryRuntimeKey : '',
  );
  const [partnerRuntimeInputKey, setPartnerRuntimeInputKey] = useState(
    initialPartnerRuntime ? partnerRuntimeKey : '',
  );
  const [primaryPayloadInputKey, setPrimaryPayloadInputKey] = useState(
    initialPrimaryPayload ? primaryPayloadKey : '',
  );
  const [partnerPayloadInputKey, setPartnerPayloadInputKey] = useState(
    initialPartnerPayload ? partnerPayloadKey : '',
  );
  const [promptZiweiPayload, setPromptZiweiPayload] = useState<AnalysisPayloadV1 | null>(null);
  const [promptPartnerZiweiPayload, setPromptPartnerZiweiPayload] =
    useState<AnalysisPayloadV1 | null>(null);
  const [promptScopePayloads, setPromptScopePayloads] = useState<Partial<
    Record<ScopeType, AnalysisPayloadV1>
  > | null>(null);
  const [promptZiweiPayloadKey, setPromptZiweiPayloadKey] = useState('');
  const [promptPartnerZiweiPayloadKey, setPromptPartnerZiweiPayloadKey] = useState('');
  const [ziweiError, setZiweiError] = useState('');
  const [ziweiPaused, setZiweiPaused] = useState(false);
  const [ziweiRetryRevision, setZiweiRetryRevision] = useState(0);
  const ziweiPayloadControllersRef = useRef<Set<AbortController>>(new Set());
  const ziweiRequestGenerationRef = useRef(0);
  const cancelZiwei = useCallback(() => {
    ziweiRequestGenerationRef.current += 1;
    if (rangeRequested) setZiweiPaused(true);
    for (const controller of ziweiPayloadControllersRef.current) {
      controller.abort();
    }
    ziweiPayloadControllersRef.current.clear();
  }, [rangeRequested]);
  const retryZiwei = useCallback(() => {
    ziweiRequestGenerationRef.current += 1;
    setZiweiPaused(false);
    setZiweiRetryRevision((value) => value + 1);
    setZiweiRuntime(null);
    setPartnerZiweiRuntime(null);
    setZiweiPayloadByScope(null);
    setPartnerZiweiPayloadByScope(null);
    setPrimaryRuntimeInputKey('');
    setPartnerRuntimeInputKey('');
    setPrimaryPayloadInputKey('');
    setPartnerPayloadInputKey('');
    setZiweiError('');
    for (const controller of ziweiPayloadControllersRef.current) {
      controller.abort();
    }
    ziweiPayloadControllersRef.current.clear();
  }, []);

  useEffect(() => {
    setZiweiPaused(false);
  }, [primaryZiweiInputKey, partnerZiweiInputKey]);

  const shouldLoadZiweiPromptPayload =
    !rangePaused &&
    !ziweiPaused &&
    isPromptTabMounted &&
    (promptState.promptSource === 'ziwei' || promptState.promptSource === 'bazi-ziwei');
  const shouldWarmZiweiRuntime =
    !rangePaused &&
    !ziweiPaused &&
    Boolean(primaryZiweiInput) &&
    (isZiweiTabMounted || shouldLoadZiweiPromptPayload || (rangeRequested && Boolean(rangePage)));
  const shouldWarmPartnerZiweiRuntime =
    !rangePaused &&
    !ziweiPaused &&
    inputState.analysisMode === 'compatibility' &&
    Boolean(partnerZiweiInput) &&
    (isZiweiTabMounted || shouldLoadZiweiPromptPayload || (rangeRequested && Boolean(rangePage)));

  useEffect(() => {
    if (!primaryZiweiInput || !primaryZiweiInputKey) {
      setZiweiPayloadByScope(null);
      setPrimaryPayloadInputKey('');
      setZiweiError('');
      return;
    }

    const cached = getCachedZiweiPayload(primaryPayloadKey);
    if (cached) {
      setZiweiPayloadByScope(cached);
      setPrimaryPayloadInputKey(primaryPayloadKey);
      setZiweiError('');
      return;
    }
    if (!shouldLoadZiweiPromptPayload) return;

    let active = true;
    const controller = new AbortController();
    ziweiPayloadControllersRef.current.add(controller);
    const releaseController = () => {
      ziweiPayloadControllersRef.current.delete(controller);
    };
    void loadZiweiPayload(
      primaryZiweiInput,
      primaryZiweiInputKey,
      ziweiRuntimeOptions,
      '紫微排盘失败。',
      controller.signal,
    )
      .then((payloadByScope) => {
        releaseController();
        if (!active) return;
        setZiweiPayloadByScope(payloadByScope);
        setPrimaryPayloadInputKey(primaryPayloadKey);
        setZiweiError('');
      })
      .catch((error: unknown) => {
        releaseController();
        if (active) {
          setZiweiError(error instanceof Error ? error.message : '紫微排盘失败。');
        }
      });
    return () => {
      active = false;
      releaseController();
      controller.abort();
    };
  }, [
    primaryPayloadKey,
    primaryZiweiInput,
    primaryZiweiInputKey,
    shouldLoadZiweiPromptPayload,
    ziweiRetryRevision,
    ziweiRuntimeOptions,
  ]);

  useEffect(() => {
    if (!partnerZiweiInput || !partnerZiweiInputKey) {
      setPartnerZiweiPayloadByScope(null);
      setPartnerPayloadInputKey('');
      setZiweiError('');
      return;
    }

    const cached = getCachedZiweiPayload(partnerPayloadKey);
    if (cached) {
      setPartnerZiweiPayloadByScope(cached);
      setPartnerPayloadInputKey(partnerPayloadKey);
      setZiweiError('');
      return;
    }
    if (!shouldLoadZiweiPromptPayload) return;

    let active = true;
    const controller = new AbortController();
    ziweiPayloadControllersRef.current.add(controller);
    const releaseController = () => {
      ziweiPayloadControllersRef.current.delete(controller);
    };
    void loadZiweiPayload(
      partnerZiweiInput,
      partnerZiweiInputKey,
      ziweiRuntimeOptions,
      '第二人紫微排盘失败。',
      controller.signal,
    )
      .then((payloadByScope) => {
        releaseController();
        if (!active) return;
        setPartnerZiweiPayloadByScope(payloadByScope);
        setPartnerPayloadInputKey(partnerPayloadKey);
        setZiweiError('');
      })
      .catch((error: unknown) => {
        releaseController();
        if (active) {
          setZiweiError(error instanceof Error ? error.message : '第二人紫微排盘失败。');
        }
      });
    return () => {
      active = false;
      releaseController();
      controller.abort();
    };
  }, [
    partnerPayloadKey,
    partnerZiweiInput,
    partnerZiweiInputKey,
    shouldLoadZiweiPromptPayload,
    ziweiRetryRevision,
    ziweiRuntimeOptions,
  ]);

  useEffect(() => {
    if (!primaryZiweiInput || !primaryZiweiInputKey || !primaryRuntimeKey) {
      setZiweiRuntime(null);
      setPrimaryRuntimeInputKey('');
      return;
    }

    const cached = getCachedZiweiRuntime(primaryRuntimeKey);
    if (cached) {
      setZiweiRuntime(cached);
      setPrimaryRuntimeInputKey(primaryRuntimeKey);
      setZiweiError('');
    } else if (shouldWarmZiweiRuntime) {
      let active = true;
      const generation = ziweiRequestGenerationRef.current;
      const payloadController = new AbortController();
      ziweiPayloadControllersRef.current.add(payloadController);
      const releasePayloadController = () => {
        ziweiPayloadControllersRef.current.delete(payloadController);
      };
      void loadZiweiRuntime(primaryZiweiInput, primaryZiweiInputKey, ziweiRuntimeOptions)
        .then((runtime) => {
          if (!active || generation !== ziweiRequestGenerationRef.current) return;
          setZiweiRuntime(runtime);
          setPrimaryRuntimeInputKey(primaryRuntimeKey);
          setZiweiError('');
        })
        .catch((error: unknown) => {
          if (active && generation === ziweiRequestGenerationRef.current) {
            setZiweiError(error instanceof Error ? error.message : '紫微排盘失败。');
          }
        });

      if (!shouldLoadZiweiPromptPayload && !getCachedZiweiPayload(primaryPayloadKey)) {
        void loadZiweiPayload(
          primaryZiweiInput,
          primaryZiweiInputKey,
          ziweiRuntimeOptions,
          '紫微排盘失败。',
          payloadController.signal,
        )
          .catch(() => {
            // 完整提示词数据在后台预热，失败不影响轻量盘面展示。
          })
          .finally(releasePayloadController);
      } else {
        releasePayloadController();
      }
      return () => {
        active = false;
        releasePayloadController();
        payloadController.abort();
      };
    }

    if (
      shouldWarmZiweiRuntime &&
      !shouldLoadZiweiPromptPayload &&
      !getCachedZiweiPayload(primaryPayloadKey)
    ) {
      const payloadController = new AbortController();
      ziweiPayloadControllersRef.current.add(payloadController);
      const releasePayloadController = () => {
        ziweiPayloadControllersRef.current.delete(payloadController);
      };
      void loadZiweiPayload(
        primaryZiweiInput,
        primaryZiweiInputKey,
        ziweiRuntimeOptions,
        '紫微排盘失败。',
        payloadController.signal,
      )
        .catch(() => {
          // 完整提示词数据在后台预热，失败不影响已经缓存的轻量盘面。
        })
        .finally(releasePayloadController);
      return () => {
        releasePayloadController();
        payloadController.abort();
      };
    }
  }, [
    primaryZiweiInput,
    primaryZiweiInputKey,
    primaryPayloadKey,
    primaryRuntimeKey,
    shouldLoadZiweiPromptPayload,
    shouldWarmZiweiRuntime,
    ziweiRetryRevision,
    ziweiRuntimeOptions,
  ]);

  useEffect(() => {
    if (!partnerZiweiInput || !partnerZiweiInputKey || !partnerRuntimeKey) {
      setPartnerZiweiRuntime(null);
      setPartnerRuntimeInputKey('');
      return;
    }

    const cached = getCachedZiweiRuntime(partnerRuntimeKey);
    if (cached) {
      setPartnerZiweiRuntime(cached);
      setPartnerRuntimeInputKey(partnerRuntimeKey);
      setZiweiError('');
    } else if (shouldWarmPartnerZiweiRuntime) {
      let active = true;
      const generation = ziweiRequestGenerationRef.current;
      const payloadController = new AbortController();
      ziweiPayloadControllersRef.current.add(payloadController);
      const releasePayloadController = () => {
        ziweiPayloadControllersRef.current.delete(payloadController);
      };
      void loadZiweiRuntime(partnerZiweiInput, partnerZiweiInputKey, ziweiRuntimeOptions)
        .then((runtime) => {
          if (!active || generation !== ziweiRequestGenerationRef.current) return;
          setPartnerZiweiRuntime(runtime);
          setPartnerRuntimeInputKey(partnerRuntimeKey);
          setZiweiError('');
        })
        .catch((error: unknown) => {
          if (active && generation === ziweiRequestGenerationRef.current) {
            setZiweiError(error instanceof Error ? error.message : '第二人紫微排盘失败。');
          }
        });

      if (!shouldLoadZiweiPromptPayload && !getCachedZiweiPayload(partnerPayloadKey)) {
        void loadZiweiPayload(
          partnerZiweiInput,
          partnerZiweiInputKey,
          ziweiRuntimeOptions,
          '第二人紫微排盘失败。',
          payloadController.signal,
        )
          .catch(() => {
            // 完整提示词数据在后台预热，失败不影响轻量盘面展示。
          })
          .finally(releasePayloadController);
      } else {
        releasePayloadController();
      }
      return () => {
        active = false;
        releasePayloadController();
        payloadController.abort();
      };
    }

    if (
      shouldWarmPartnerZiweiRuntime &&
      !shouldLoadZiweiPromptPayload &&
      !getCachedZiweiPayload(partnerPayloadKey)
    ) {
      const payloadController = new AbortController();
      ziweiPayloadControllersRef.current.add(payloadController);
      const releasePayloadController = () => {
        ziweiPayloadControllersRef.current.delete(payloadController);
      };
      void loadZiweiPayload(
        partnerZiweiInput,
        partnerZiweiInputKey,
        ziweiRuntimeOptions,
        '第二人紫微排盘失败。',
        payloadController.signal,
      )
        .catch(() => {
          // 完整提示词数据在后台预热，失败不影响已经缓存的盘面展示。
        })
        .finally(releasePayloadController);
      return () => {
        releasePayloadController();
        payloadController.abort();
      };
    }
  }, [
    partnerZiweiInput,
    partnerZiweiInputKey,
    partnerPayloadKey,
    partnerRuntimeKey,
    shouldLoadZiweiPromptPayload,
    shouldWarmPartnerZiweiRuntime,
    ziweiRetryRevision,
    ziweiRuntimeOptions,
  ]);

  const ziweiPromptScopeType =
    promptState.ziweiScope === 'full' ? 'origin' : (promptState.ziweiScope as ScopeType);
  const shouldUseCustomZiweiPromptPayload =
    promptState.tab === 'prompt' &&
    (promptState.promptSource === 'ziwei' || promptState.promptSource === 'bazi-ziwei') &&
    promptState.ziweiScope !== 'full' &&
    Boolean(promptState.ziweiScopeDate);
  const promptHourIndex = fixedHoroscopeContext.hourIndex;
  const readingResourceRequest = useMemo(() => {
    if (
      isInstantResult ||
      !isPromptTabMounted ||
      promptState.ziweiScope !== 'full' ||
      (promptState.promptSource !== 'ziwei' && promptState.promptSource !== 'bazi-ziwei') ||
      !primaryZiweiInput ||
      !primaryZiweiInputKey
    ) {
      return null;
    }

    const dateStr = promptState.ziweiScopeDate || fixedHoroscopeContext.dateStr;
    const items: Array<{
      role: 'primary' | 'partner';
      input: ChartInput;
      inputKey: string;
      subjectTitle: string;
    }> = [
      {
        role: 'primary' as const,
        input: primaryZiweiInput,
        inputKey: primaryZiweiInputKey,
        subjectTitle: primaryZiweiInput.name || '第一主体',
      },
    ];
    if (inputState.analysisMode === 'compatibility') {
      if (!partnerZiweiInput || !partnerZiweiInputKey) return null;
      items.push({
        role: 'partner' as const,
        input: partnerZiweiInput,
        inputKey: partnerZiweiInputKey,
        subjectTitle: partnerZiweiInput.name || '第二主体',
      });
    }
    return {
      dateStr,
      hourIndex: promptHourIndex,
      items,
      key: items
        .map(({ role, inputKey }) =>
          getZiweiReadingResourceKey(inputKey, dateStr, promptHourIndex, role),
        )
        .join('\u0000'),
    };
  }, [
    inputState.analysisMode,
    isInstantResult,
    isPromptTabMounted,
    partnerZiweiInput,
    partnerZiweiInputKey,
    primaryZiweiInput,
    primaryZiweiInputKey,
    fixedHoroscopeContext,
    promptHourIndex,
    promptState.promptSource,
    promptState.ziweiScope,
    promptState.ziweiScopeDate,
  ]);
  const [ziweiReadingResources, setZiweiReadingResources] = useState<ReadingResource[]>([]);
  const [ziweiReadingResourceKey, setZiweiReadingResourceKey] = useState('');
  const [ziweiReadingResourceError, setZiweiReadingResourceError] = useState('');
  const [ziweiReadingResourceRetry, setZiweiReadingResourceRetry] = useState(0);
  const readingResourceRequestKeyRef = useRef('');
  const reloadZiweiReadingResources = useCallback(() => {
    setZiweiReadingResourceRetry((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!readingResourceRequest) {
      readingResourceRequestKeyRef.current = '';
      setZiweiReadingResources([]);
      setZiweiReadingResourceKey('');
      setZiweiReadingResourceError('');
      return;
    }

    let active = true;
    const isSameRequest = readingResourceRequestKeyRef.current === readingResourceRequest.key;
    readingResourceRequestKeyRef.current = readingResourceRequest.key;
    if (!isSameRequest) {
      setZiweiReadingResources([]);
      setZiweiReadingResourceKey('');
    }
    setZiweiReadingResourceError('');
    void Promise.all(
      readingResourceRequest.items.map(async (item) => {
        try {
          return {
            resource: await loadZiweiReadingResource(
              item.input,
              item.inputKey,
              readingResourceRequest.dateStr,
              readingResourceRequest.hourIndex,
              item.role,
              item.subjectTitle,
            ),
          };
        } catch {
          return { resource: null };
        }
      }),
    ).then((results) => {
      if (!active) return;
      const resources = results
        .map(({ resource }) => resource)
        .filter((resource): resource is ReadingResource => Boolean(resource));
      setZiweiReadingResources(resources);
      const hasFailure = resources.length !== results.length;
      setZiweiReadingResourceKey(hasFailure ? '' : readingResourceRequest.key);
      setZiweiReadingResourceError(hasFailure ? '完整紫微资料生成失败，请重新生成资料。' : '');
    });

    return () => {
      active = false;
    };
  }, [readingResourceRequest, ziweiReadingResourceRetry]);

  const currentZiweiReadingResources =
    readingResourceRequest?.key === ziweiReadingResourceKey ? ziweiReadingResources : [];
  const ziweiReadingResourcesReady = Boolean(
    readingResourceRequest &&
    readingResourceRequest.key === ziweiReadingResourceKey &&
    currentZiweiReadingResources.length === readingResourceRequest.items.length,
  );

  const fortuneRequest = useMemo(() => {
    if (
      !shouldLoadZiweiPromptPayload ||
      inputState.analysisMode !== 'single' ||
      !primaryZiweiInput ||
      promptState.ziweiScope === 'origin'
    )
      return null;
    const dateStr = promptState.ziweiScopeDate || fixedHoroscopeContext.dateStr;
    const all = promptState.ziweiScope === 'full';
    const scope =
      promptState.ziweiScope === 'full'
        ? 'all'
        : promptState.ziweiScope === 'yearly'
          ? 'year'
          : promptState.ziweiScope === 'monthly'
            ? 'month'
            : promptState.ziweiScope === 'daily'
              ? 'day'
              : promptState.ziweiScope === 'hourly'
                ? 'hour'
                : 'current';
    return {
      input: primaryZiweiInput,
      dateStr,
      hourIndex: promptHourIndex,
      all,
      scope,
      key: JSON.stringify([primaryZiweiInputKey, dateStr, promptHourIndex, all, scope]),
    };
  }, [
    shouldLoadZiweiPromptPayload,
    inputState.analysisMode,
    primaryZiweiInput,
    primaryZiweiInputKey,
    fixedHoroscopeContext,
    promptState.ziweiScope,
    promptState.ziweiScopeDate,
    promptHourIndex,
  ]);
  const fortuneResult = useWorkerRequest<
    NonNullable<typeof fortuneRequest>,
    { key: string; text: string }
  >({
    factory: () =>
      new Worker(new URL('../../../workers/ziwei-fortune-prompt.worker.ts', import.meta.url), {
        type: 'module',
      }),
    request: fortuneRequest,
    timeoutMs: 120000,
  });
  const fortuneReady = !fortuneRequest || fortuneResult.data?.key === fortuneRequest.key;
  const ziweiFortuneText = fortuneRequest && fortuneReady ? fortuneResult.data?.text || '' : '';
  const primaryPromptDisplayKey =
    shouldUseCustomZiweiPromptPayload && primaryZiweiInputKey
      ? getZiweiDisplayKey(
          primaryZiweiInputKey,
          promptState.ziweiScopeDate,
          promptHourIndex,
          ziweiPromptScopeType,
        )
      : '';
  const partnerPromptDisplayKey =
    shouldUseCustomZiweiPromptPayload &&
    inputState.analysisMode === 'compatibility' &&
    partnerZiweiInputKey
      ? getZiweiDisplayKey(
          partnerZiweiInputKey,
          promptState.ziweiScopeDate,
          promptHourIndex,
          ziweiPromptScopeType,
        )
      : '';

  useEffect(() => {
    if (
      !primaryPromptDisplayKey ||
      !primaryZiweiInput ||
      !promptState.ziweiScopeDate ||
      !primaryZiweiInputKey
    ) {
      setPromptZiweiPayload(null);
      setPromptZiweiPayloadKey('');
      return;
    }

    let active = true;
    void loadZiweiPromptScopePayloads(
      primaryZiweiInput,
      primaryZiweiInputKey,
      promptState.ziweiScopeDate,
      promptHourIndex,
      ziweiPromptScopeType,
    )
      .then((payloads) => {
        if (!active) return;
        setPromptScopePayloads(payloads);
        setPromptZiweiPayload(payloads[ziweiPromptScopeType] ?? null);
        setZiweiError('');
        setPromptZiweiPayloadKey(primaryPromptDisplayKey);
      })
      .catch((error: unknown) => {
        if (active) {
          setZiweiError(error instanceof Error ? error.message : '紫微运限盘生成失败。');
          setPromptZiweiPayload(null);
          setPromptZiweiPayloadKey('');
        }
      });
    return () => {
      active = false;
    };
  }, [
    primaryPromptDisplayKey,
    primaryZiweiInput,
    primaryZiweiInputKey,
    promptHourIndex,
    promptState.ziweiScopeDate,
    ziweiPromptScopeType,
  ]);

  useEffect(() => {
    if (
      !partnerPromptDisplayKey ||
      !partnerZiweiInput ||
      !promptState.ziweiScopeDate ||
      !partnerZiweiInputKey
    ) {
      setPromptPartnerZiweiPayload(null);
      setPromptPartnerZiweiPayloadKey('');
      return;
    }

    const cached = getCachedZiweiDisplayPayload(partnerPromptDisplayKey);
    if (cached) {
      setPromptPartnerZiweiPayload(cached);
      setPromptPartnerZiweiPayloadKey(partnerPromptDisplayKey);
      return;
    }

    let active = true;
    void loadZiweiDisplayPayload(
      partnerZiweiInput,
      partnerZiweiInputKey,
      promptState.ziweiScopeDate,
      promptHourIndex,
      ziweiPromptScopeType,
    )
      .then((payload) => {
        if (!active) return;
        setPromptPartnerZiweiPayload(payload);
        setPromptPartnerZiweiPayloadKey(partnerPromptDisplayKey);
      })
      .catch(() => {
        if (active) {
          setPromptPartnerZiweiPayload(null);
          setPromptPartnerZiweiPayloadKey('');
        }
      });
    return () => {
      active = false;
    };
  }, [
    partnerPromptDisplayKey,
    partnerZiweiInput,
    partnerZiweiInputKey,
    promptHourIndex,
    promptState.ziweiScopeDate,
    ziweiPromptScopeType,
  ]);

  const currentZiweiRuntime =
    primaryRuntimeInputKey === primaryRuntimeKey ? ziweiRuntime : initialPrimaryRuntime;
  const currentPartnerZiweiRuntime =
    partnerRuntimeInputKey === partnerRuntimeKey ? partnerZiweiRuntime : initialPartnerRuntime;
  const currentZiweiPayloadByScope =
    primaryPayloadInputKey === primaryPayloadKey ? ziweiPayloadByScope : initialPrimaryPayload;
  const currentPartnerZiweiPayloadByScope =
    partnerPayloadInputKey === partnerPayloadKey
      ? partnerZiweiPayloadByScope
      : initialPartnerPayload;
  const activeZiweiPayloadByScope =
    currentZiweiPayloadByScope ?? currentZiweiRuntime?.payloadByScope ?? null;
  const activePartnerZiweiPayloadByScope =
    currentPartnerZiweiPayloadByScope ?? currentPartnerZiweiRuntime?.payloadByScope ?? null;

  const defaultZiweiPayload = activeZiweiPayloadByScope?.[ziweiPromptScopeType] ?? null;
  const defaultPartnerZiweiPayload =
    activePartnerZiweiPayloadByScope?.[ziweiPromptScopeType] ?? null;
  const activePromptZiweiPayload =
    promptZiweiPayloadKey === primaryPromptDisplayKey
      ? promptZiweiPayload
      : primaryPromptDisplayKey
        ? getCachedZiweiDisplayPayload(primaryPromptDisplayKey)
        : null;
  const activePromptPartnerZiweiPayload =
    promptPartnerZiweiPayloadKey === partnerPromptDisplayKey
      ? promptPartnerZiweiPayload
      : partnerPromptDisplayKey
        ? getCachedZiweiDisplayPayload(partnerPromptDisplayKey)
        : null;
  const currentZiweiPayload = shouldUseCustomZiweiPromptPayload
    ? promptZiweiPayloadKey === primaryPromptDisplayKey
      ? promptZiweiPayload
      : null
    : defaultZiweiPayload;
  const partnerZiweiPayload = shouldUseCustomZiweiPromptPayload
    ? activePromptPartnerZiweiPayload
    : defaultPartnerZiweiPayload;
  const ziweiLoading = Boolean(
    (primaryZiweiInput &&
      shouldWarmZiweiRuntime &&
      (primaryRuntimeInputKey !== primaryRuntimeKey ||
        (shouldLoadZiweiPromptPayload && primaryPayloadInputKey !== primaryPayloadKey))) ||
    (partnerZiweiInput &&
      shouldWarmPartnerZiweiRuntime &&
      (partnerRuntimeInputKey !== partnerRuntimeKey ||
        (shouldLoadZiweiPromptPayload && partnerPayloadInputKey !== partnerPayloadKey))),
  );

  return {
    ziweiRuntime: currentZiweiRuntime,
    partnerZiweiRuntime: currentPartnerZiweiRuntime,
    ziweiPayloadByScope: currentZiweiPayloadByScope,
    partnerZiweiPayloadByScope: currentPartnerZiweiPayloadByScope,
    promptZiweiPayload: activePromptZiweiPayload,
    promptPartnerZiweiPayload: activePromptPartnerZiweiPayload,
    ziweiError: fortuneResult.error || ziweiError,
    ziweiFortuneText,
    primaryZiweiInput,
    partnerZiweiInput,
    activeZiweiPayloadByScope,
    activePartnerZiweiPayloadByScope,
    currentZiweiPayload: fortuneReady ? currentZiweiPayload : null,
    promptZiweiScopePayloads: shouldUseCustomZiweiPromptPayload
      ? promptZiweiPayloadKey === primaryPromptDisplayKey
        ? promptScopePayloads
        : null
      : activeZiweiPayloadByScope,
    partnerZiweiPayload,
    ziweiReadingResources: currentZiweiReadingResources,
    ziweiReadingResourcesReady,
    ziweiReadingResourceError,
    reloadZiweiReadingResources,
    ziweiLoading,
    cancelZiwei,
    retryZiwei,
    ziweiPaused,
  };
}
