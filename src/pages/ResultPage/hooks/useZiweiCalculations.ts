import { useWorkerRequest } from '@/hooks/useWorkerRequest';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildZiweiChartInput } from '@/lib/full-chart-engine/ziwei';
import { getDefaultHoroscopeContext } from 'mingyu-core/ziwei';
import type { AnalysisPayloadV1, ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { ReadingResource } from '@/lib/ai/reading-workflow';
import type { QueryInputState } from '@/lib/query-state';
import type { ZiweiPayloadByScopeState, ZiweiRuntimeState } from '../ResultPage.types';
import {
  getCachedZiweiDisplayPayload,
  getCachedZiweiPayload,
  getCachedZiweiRuntime,
  getZiweiDisplayKey,
  getZiweiInputKey,
  getZiweiReadingResourceKey,
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
): ZiweiCalculations {
  const primaryZiweiInput = useMemo(() => {
    try {
      return stabilizeZiweiChartInput(buildZiweiChartInput(inputState));
    } catch {
      return null;
    }
  }, [inputState]);

  const partnerZiweiInput = useMemo(() => {
    if (inputState.analysisMode !== 'compatibility') return null;

    try {
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
          birthLongitude: inputState.partnerBirthLongitude,
        }),
      );
    } catch {
      return null;
    }
  }, [inputState]);

  const primaryZiweiInputKey = primaryZiweiInput ? getZiweiInputKey(primaryZiweiInput) : '';
  const partnerZiweiInputKey = partnerZiweiInput ? getZiweiInputKey(partnerZiweiInput) : '';
  const initialPrimaryRuntime = primaryZiweiInputKey
    ? getCachedZiweiRuntime(primaryZiweiInputKey)
    : null;
  const initialPartnerRuntime = partnerZiweiInputKey
    ? getCachedZiweiRuntime(partnerZiweiInputKey)
    : null;
  const initialPrimaryPayload = primaryZiweiInputKey
    ? getCachedZiweiPayload(primaryZiweiInputKey)
    : null;
  const initialPartnerPayload = partnerZiweiInputKey
    ? getCachedZiweiPayload(partnerZiweiInputKey)
    : null;

  const [ziweiRuntime, setZiweiRuntime] = useState<ZiweiRuntimeState>(initialPrimaryRuntime);
  const [partnerZiweiRuntime, setPartnerZiweiRuntime] =
    useState<ZiweiRuntimeState>(initialPartnerRuntime);
  const [ziweiPayloadByScope, setZiweiPayloadByScope] =
    useState<ZiweiPayloadByScopeState>(initialPrimaryPayload);
  const [partnerZiweiPayloadByScope, setPartnerZiweiPayloadByScope] =
    useState<ZiweiPayloadByScopeState>(initialPartnerPayload);
  const [primaryRuntimeInputKey, setPrimaryRuntimeInputKey] = useState(
    initialPrimaryRuntime ? primaryZiweiInputKey : '',
  );
  const [partnerRuntimeInputKey, setPartnerRuntimeInputKey] = useState(
    initialPartnerRuntime ? partnerZiweiInputKey : '',
  );
  const [primaryPayloadInputKey, setPrimaryPayloadInputKey] = useState(
    initialPrimaryPayload ? primaryZiweiInputKey : '',
  );
  const [partnerPayloadInputKey, setPartnerPayloadInputKey] = useState(
    initialPartnerPayload ? partnerZiweiInputKey : '',
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

  const shouldLoadZiweiPromptPayload =
    isPromptTabMounted &&
    (promptState.promptSource === 'ziwei' || promptState.promptSource === 'bazi-ziwei');
  const shouldWarmZiweiRuntime =
    Boolean(primaryZiweiInput) && (isZiweiTabMounted || shouldLoadZiweiPromptPayload);
  const shouldWarmPartnerZiweiRuntime =
    inputState.analysisMode === 'compatibility' &&
    Boolean(partnerZiweiInput) &&
    (isZiweiTabMounted || shouldLoadZiweiPromptPayload);

  useEffect(() => {
    if (!primaryZiweiInput || !primaryZiweiInputKey) {
      setZiweiPayloadByScope(null);
      setPrimaryPayloadInputKey('');
      return;
    }

    const cached = getCachedZiweiPayload(primaryZiweiInputKey);
    if (cached) {
      setZiweiPayloadByScope(cached);
      setPrimaryPayloadInputKey(primaryZiweiInputKey);
      setZiweiError('');
      return;
    }
    if (!shouldLoadZiweiPromptPayload) return;

    let active = true;
    void loadZiweiPayload(primaryZiweiInput, primaryZiweiInputKey)
      .then((payloadByScope) => {
        if (!active) return;
        setZiweiPayloadByScope(payloadByScope);
        setPrimaryPayloadInputKey(primaryZiweiInputKey);
        setZiweiError('');
      })
      .catch((error: unknown) => {
        if (active) {
          setZiweiError(error instanceof Error ? error.message : '紫微排盘失败。');
        }
      });
    return () => {
      active = false;
    };
  }, [primaryZiweiInput, primaryZiweiInputKey, shouldLoadZiweiPromptPayload]);

  useEffect(() => {
    if (!partnerZiweiInput || !partnerZiweiInputKey) {
      setPartnerZiweiPayloadByScope(null);
      setPartnerPayloadInputKey('');
      return;
    }

    const cached = getCachedZiweiPayload(partnerZiweiInputKey);
    if (cached) {
      setPartnerZiweiPayloadByScope(cached);
      setPartnerPayloadInputKey(partnerZiweiInputKey);
      setZiweiError('');
      return;
    }
    if (!shouldLoadZiweiPromptPayload) return;

    let active = true;
    void loadZiweiPayload(partnerZiweiInput, partnerZiweiInputKey, '第二人紫微排盘失败。')
      .then((payloadByScope) => {
        if (!active) return;
        setPartnerZiweiPayloadByScope(payloadByScope);
        setPartnerPayloadInputKey(partnerZiweiInputKey);
        setZiweiError('');
      })
      .catch((error: unknown) => {
        if (active) {
          setZiweiError(error instanceof Error ? error.message : '第二人紫微排盘失败。');
        }
      });
    return () => {
      active = false;
    };
  }, [partnerZiweiInput, partnerZiweiInputKey, shouldLoadZiweiPromptPayload]);

  useEffect(() => {
    if (!primaryZiweiInput || !primaryZiweiInputKey) {
      setZiweiRuntime(null);
      setPrimaryRuntimeInputKey('');
      return;
    }

    const cached = getCachedZiweiRuntime(primaryZiweiInputKey);
    if (cached) {
      setZiweiRuntime(cached);
      setPrimaryRuntimeInputKey(primaryZiweiInputKey);
      setZiweiError('');
    } else if (shouldWarmZiweiRuntime) {
      let active = true;
      void loadZiweiRuntime(primaryZiweiInput, primaryZiweiInputKey)
        .then((runtime) => {
          if (!active) return;
          setZiweiRuntime(runtime);
          setPrimaryRuntimeInputKey(primaryZiweiInputKey);
          setZiweiError('');
        })
        .catch((error: unknown) => {
          if (active) {
            setZiweiError(error instanceof Error ? error.message : '紫微排盘失败。');
          }
        });

      if (!shouldLoadZiweiPromptPayload && !getCachedZiweiPayload(primaryZiweiInputKey)) {
        void loadZiweiPayload(primaryZiweiInput, primaryZiweiInputKey).catch(() => {
          // 完整提示词数据在后台预热，失败不影响轻量盘面展示。
        });
      }
      return () => {
        active = false;
      };
    }

    if (
      shouldWarmZiweiRuntime &&
      !shouldLoadZiweiPromptPayload &&
      !getCachedZiweiPayload(primaryZiweiInputKey)
    ) {
      void loadZiweiPayload(primaryZiweiInput, primaryZiweiInputKey).catch(() => {
        // 完整提示词数据在后台预热，失败不影响已经缓存的盘面展示。
      });
    }
  }, [
    primaryZiweiInput,
    primaryZiweiInputKey,
    shouldLoadZiweiPromptPayload,
    shouldWarmZiweiRuntime,
  ]);

  useEffect(() => {
    if (!partnerZiweiInput || !partnerZiweiInputKey) {
      setPartnerZiweiRuntime(null);
      setPartnerRuntimeInputKey('');
      return;
    }

    const cached = getCachedZiweiRuntime(partnerZiweiInputKey);
    if (cached) {
      setPartnerZiweiRuntime(cached);
      setPartnerRuntimeInputKey(partnerZiweiInputKey);
      setZiweiError('');
    } else if (shouldWarmPartnerZiweiRuntime) {
      let active = true;
      void loadZiweiRuntime(partnerZiweiInput, partnerZiweiInputKey)
        .then((runtime) => {
          if (!active) return;
          setPartnerZiweiRuntime(runtime);
          setPartnerRuntimeInputKey(partnerZiweiInputKey);
          setZiweiError('');
        })
        .catch((error: unknown) => {
          if (active) {
            setZiweiError(error instanceof Error ? error.message : '第二人紫微排盘失败。');
          }
        });

      if (!shouldLoadZiweiPromptPayload && !getCachedZiweiPayload(partnerZiweiInputKey)) {
        void loadZiweiPayload(
          partnerZiweiInput,
          partnerZiweiInputKey,
          '第二人紫微排盘失败。',
        ).catch(() => {
          // 完整提示词数据在后台预热，失败不影响轻量盘面展示。
        });
      }
      return () => {
        active = false;
      };
    }

    if (
      shouldWarmPartnerZiweiRuntime &&
      !shouldLoadZiweiPromptPayload &&
      !getCachedZiweiPayload(partnerZiweiInputKey)
    ) {
      void loadZiweiPayload(partnerZiweiInput, partnerZiweiInputKey, '第二人紫微排盘失败。').catch(
        () => {
          // 完整提示词数据在后台预热，失败不影响已经缓存的盘面展示。
        },
      );
    }
  }, [
    partnerZiweiInput,
    partnerZiweiInputKey,
    shouldLoadZiweiPromptPayload,
    shouldWarmPartnerZiweiRuntime,
  ]);

  const ziweiPromptScopeType =
    promptState.ziweiScope === 'full' ? 'origin' : (promptState.ziweiScope as ScopeType);
  const shouldUseCustomZiweiPromptPayload =
    promptState.tab === 'prompt' &&
    (promptState.promptSource === 'ziwei' || promptState.promptSource === 'bazi-ziwei') &&
    promptState.ziweiScope !== 'full' &&
    Boolean(promptState.ziweiScopeDate);
  const promptHourIndex = useMemo(() => getDefaultHoroscopeContext().hourIndex, []);
  const readingResourceRequest = useMemo(() => {
    if (
      isInstantResult ||
      !isPromptTabMounted ||
      promptState.ziweiScope !== 'full' ||
      (promptState.promptSource !== 'ziwei' && promptState.promptSource !== 'bazi-ziwei') ||
      (promptState.promptSource === 'bazi-ziwei' && inputState.analysisMode !== 'single') ||
      !primaryZiweiInput ||
      !primaryZiweiInputKey
    ) {
      return null;
    }

    const dateStr = promptState.ziweiScopeDate || getDefaultHoroscopeContext().dateStr;
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
    const dateStr = promptState.ziweiScopeDate || getDefaultHoroscopeContext().dateStr;
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
    primaryRuntimeInputKey === primaryZiweiInputKey ? ziweiRuntime : initialPrimaryRuntime;
  const currentPartnerZiweiRuntime =
    partnerRuntimeInputKey === partnerZiweiInputKey ? partnerZiweiRuntime : initialPartnerRuntime;
  const currentZiweiPayloadByScope =
    primaryPayloadInputKey === primaryZiweiInputKey ? ziweiPayloadByScope : initialPrimaryPayload;
  const currentPartnerZiweiPayloadByScope =
    partnerPayloadInputKey === partnerZiweiInputKey
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
  };
}
