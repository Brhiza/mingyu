import { useEffect, useMemo, useRef, useState } from 'react';
import { buildZiweiChartInput, calculateFullZiweiChart } from '@/lib/full-chart-engine';
import { getDefaultHoroscopeContext } from '@core/ziwei/iztro';
import type { AnalysisPayloadV1 } from '@/types/analysis';
import type { ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { QueryInputState } from '@/lib/query-state';
import { createDisplayWorker } from '../utils/createDisplayWorker';
import { createPayloadWorker } from '../utils/createPayloadWorker';
import type { ZiweiPayloadByScopeState, ZiweiRuntimeState } from '../ResultPage.types';

async function runZiweiMainThread(
  input: ChartInput,
  horoscopeReference: ReturnType<typeof getDefaultHoroscopeContext>,
  onSuccess: (runtime: NonNullable<ZiweiRuntimeState>) => void,
  onError: (message: string) => void,
): Promise<void> {
  try {
    // skipAnalysis=true：不在主线程计算证据池和格局检测，仅生成展示所需的基础数据
    const runtime = await calculateFullZiweiChart(input, true, horoscopeReference);
    onSuccess(runtime);
  } catch (error) {
    onError(error instanceof Error ? error.message : '紫微排盘失败。');
  }
}

export interface ZiweiCalculations {
  ziweiRuntime: ZiweiRuntimeState;
  partnerZiweiRuntime: ZiweiRuntimeState;
  ziweiPayloadByScope: ZiweiPayloadByScopeState;
  partnerZiweiPayloadByScope: ZiweiPayloadByScopeState;
  promptZiweiPayload: AnalysisPayloadV1 | null;
  promptPartnerZiweiPayload: AnalysisPayloadV1 | null;
  ziweiError: string;
  primaryZiweiInput: ChartInput | null;
  partnerZiweiInput: ChartInput | null;
  activeZiweiPayloadByScope: ZiweiPayloadByScopeState;
  activePartnerZiweiPayloadByScope: ZiweiPayloadByScopeState;
  currentZiweiPayload: AnalysisPayloadV1 | null;
  partnerZiweiPayload: AnalysisPayloadV1 | null;
}

export function useZiweiCalculations(
  inputState: QueryInputState,
  promptState: {
    tab: string;
    promptSource: string;
    ziweiScope: string;
    ziweiScopeDate: string;
  },
  _isZiweiTabMounted: boolean,
  isPromptTabMounted: boolean,
): ZiweiCalculations {
  const [ziweiRuntime, setZiweiRuntime] = useState<ZiweiRuntimeState>(null);
  const [partnerZiweiRuntime, setPartnerZiweiRuntime] = useState<ZiweiRuntimeState>(null);
  const [ziweiPayloadByScope, setZiweiPayloadByScope] = useState<ZiweiPayloadByScopeState>(null);
  const [partnerZiweiPayloadByScope, setPartnerZiweiPayloadByScope] =
    useState<ZiweiPayloadByScopeState>(null);
  const [promptZiweiPayload, setPromptZiweiPayload] = useState<AnalysisPayloadV1 | null>(null);
  const [promptPartnerZiweiPayload, setPromptPartnerZiweiPayload] =
    useState<AnalysisPayloadV1 | null>(null);
  const [ziweiError, setZiweiError] = useState('');
  const primaryRuntimeKeyRef = useRef('');
  const partnerRuntimeKeyRef = useRef('');
  const primaryPayloadKeyRef = useRef('');
  const partnerPayloadKeyRef = useRef('');

  const primaryZiweiInput = useMemo(() => {
    try {
      return buildZiweiChartInput(inputState);
    } catch {
      return null;
    }
  }, [inputState]);

  const partnerZiweiInput = useMemo(() => {
    if (inputState.analysisMode !== 'compatibility') {
      return null;
    }

    try {
      return buildZiweiChartInput({
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
      });
    } catch {
      return null;
    }
  }, [inputState]);

  const shouldLoadZiweiPromptPayload =
    isPromptTabMounted &&
    (promptState.promptSource === 'ziwei' || promptState.promptSource === 'bazi-ziwei');
  const shouldWarmZiweiRuntime = Boolean(primaryZiweiInput);
  const shouldWarmPartnerZiweiRuntime =
    inputState.analysisMode === 'compatibility' && Boolean(partnerZiweiInput);
  const primaryZiweiInputKey = useMemo(
    () => (primaryZiweiInput ? JSON.stringify(primaryZiweiInput) : ''),
    [primaryZiweiInput],
  );
  const partnerZiweiInputKey = useMemo(
    () => (partnerZiweiInput ? JSON.stringify(partnerZiweiInput) : ''),
    [partnerZiweiInput],
  );
  const defaultHoroscopeReference = useMemo(() => getDefaultHoroscopeContext(), []);
  const horoscopeReference = useMemo(
    () => ({
      dateStr:
        promptState.ziweiScope === 'full' && promptState.ziweiScopeDate
          ? promptState.ziweiScopeDate
          : defaultHoroscopeReference.dateStr,
      hourIndex: defaultHoroscopeReference.hourIndex,
    }),
    [defaultHoroscopeReference, promptState.ziweiScope, promptState.ziweiScopeDate],
  );
  const horoscopeReferenceKey = `${horoscopeReference.dateStr}:${horoscopeReference.hourIndex}`;
  const primaryRuntimeKey = `${primaryZiweiInputKey}:${horoscopeReferenceKey}`;
  const partnerRuntimeKey = `${partnerZiweiInputKey}:${horoscopeReferenceKey}`;

  useEffect(() => {
    if (!primaryZiweiInput) {
      setZiweiPayloadByScope(null);
      primaryPayloadKeyRef.current = '';
      return;
    }

    if (!shouldLoadZiweiPromptPayload) {
      return;
    }

    if (primaryPayloadKeyRef.current === primaryRuntimeKey && ziweiPayloadByScope) {
      return;
    }

    return createPayloadWorker(
      primaryZiweiInput,
      horoscopeReference,
      `${Date.now()}-primary`,
      (payloadByScope) => {
        setZiweiPayloadByScope(payloadByScope);
        primaryPayloadKeyRef.current = primaryRuntimeKey;
        setZiweiError('');
      },
      (message) => {
        setZiweiPayloadByScope((current) => current);
        setZiweiError(message);
      },
      '紫微排盘失败。',
    );
  }, [
    horoscopeReference,
    primaryRuntimeKey,
    primaryZiweiInput,
    shouldLoadZiweiPromptPayload,
    ziweiPayloadByScope,
  ]);

  useEffect(() => {
    if (!partnerZiweiInput) {
      setPartnerZiweiPayloadByScope(null);
      partnerPayloadKeyRef.current = '';
      return;
    }

    if (!shouldLoadZiweiPromptPayload) {
      return;
    }

    if (partnerPayloadKeyRef.current === partnerRuntimeKey && partnerZiweiPayloadByScope) {
      return;
    }

    return createPayloadWorker(
      partnerZiweiInput,
      horoscopeReference,
      `${Date.now()}-partner`,
      (payloadByScope) => {
        setPartnerZiweiPayloadByScope(payloadByScope);
        partnerPayloadKeyRef.current = partnerRuntimeKey;
        setZiweiError('');
      },
      (message) => {
        setPartnerZiweiPayloadByScope((current) => current);
        setZiweiError(message);
      },
      '第二人紫微排盘失败。',
    );
  }, [
    partnerZiweiInput,
    horoscopeReference,
    partnerRuntimeKey,
    partnerZiweiPayloadByScope,
    shouldLoadZiweiPromptPayload,
  ]);

  useEffect(() => {
    if (!shouldWarmZiweiRuntime || !primaryZiweiInput) {
      setZiweiRuntime(null);
      primaryRuntimeKeyRef.current = '';
      return;
    }

    if (primaryRuntimeKeyRef.current === primaryRuntimeKey && ziweiRuntime) {
      return;
    }

    let cancelled = false;
    let cleanupBackgroundWorker: (() => void) | undefined;

    void runZiweiMainThread(
      primaryZiweiInput,
      horoscopeReference,
      (runtime) => {
        if (!cancelled) {
          setZiweiRuntime(runtime);
          setZiweiPayloadByScope(runtime.payloadByScope);
          primaryRuntimeKeyRef.current = primaryRuntimeKey;
          primaryPayloadKeyRef.current = primaryRuntimeKey;
          setZiweiError('');

          // 异步后台 worker 计算完整版（含证据池和格局检测），不阻塞主线程
          cleanupBackgroundWorker = createPayloadWorker(
            primaryZiweiInput,
            horoscopeReference,
            `${Date.now()}-bg-primary`,
            (fullPayloadByScope) => {
              if (!cancelled) {
                setZiweiPayloadByScope(fullPayloadByScope);
              }
            },
            () => {
              /* 主线程已有轻量版，后台失败不影响展示 */
            },
            '紫微排盘增强计算失败。',
          );
        }
      },
      (message) => {
        if (!cancelled) {
          setZiweiRuntime((current) => current);
          setZiweiError(message);
        }
      },
    );
    return () => {
      cancelled = true;
      cleanupBackgroundWorker?.();
    };
  }, [
    horoscopeReference,
    primaryRuntimeKey,
    primaryZiweiInput,
    shouldWarmZiweiRuntime,
    ziweiRuntime,
  ]);

  useEffect(() => {
    if (!shouldWarmPartnerZiweiRuntime || !partnerZiweiInput) {
      setPartnerZiweiRuntime(null);
      partnerRuntimeKeyRef.current = '';
      return;
    }

    if (partnerRuntimeKeyRef.current === partnerRuntimeKey && partnerZiweiRuntime) {
      return;
    }

    let cancelled = false;
    let cleanupBackgroundWorker: (() => void) | undefined;

    void runZiweiMainThread(
      partnerZiweiInput,
      horoscopeReference,
      (runtime) => {
        if (!cancelled) {
          setPartnerZiweiRuntime(runtime);
          setPartnerZiweiPayloadByScope(runtime.payloadByScope);
          partnerRuntimeKeyRef.current = partnerRuntimeKey;
          partnerPayloadKeyRef.current = partnerRuntimeKey;
          setZiweiError('');

          cleanupBackgroundWorker = createPayloadWorker(
            partnerZiweiInput,
            horoscopeReference,
            `${Date.now()}-bg-partner`,
            (fullPayloadByScope) => {
              if (!cancelled) {
                setPartnerZiweiPayloadByScope(fullPayloadByScope);
              }
            },
            () => {
              /* 主线程已有轻量版，后台失败不影响展示 */
            },
            '第二人紫微排盘增强计算失败。',
          );
        }
      },
      (message) => {
        if (!cancelled) {
          setPartnerZiweiRuntime((current) => current);
          setZiweiError(message);
        }
      },
    );
    return () => {
      cancelled = true;
      cleanupBackgroundWorker?.();
    };
  }, [
    horoscopeReference,
    partnerRuntimeKey,
    partnerZiweiInput,
    partnerZiweiRuntime,
    shouldWarmPartnerZiweiRuntime,
  ]);

  const ziweiPromptScopeType =
    promptState.ziweiScope === 'full' ? 'origin' : (promptState.ziweiScope as ScopeType);
  const shouldUseCustomZiweiPromptPayload =
    promptState.tab === 'prompt' &&
    (promptState.promptSource === 'ziwei' || promptState.promptSource === 'bazi-ziwei') &&
    promptState.ziweiScope !== 'full' &&
    Boolean(promptState.ziweiScopeDate);

  useEffect(() => {
    if (!shouldUseCustomZiweiPromptPayload || !primaryZiweiInput || !promptState.ziweiScopeDate) {
      setPromptZiweiPayload(null);
      return;
    }

    const { hourIndex } = getDefaultHoroscopeContext();
    const requestId = `prompt-primary-${ziweiPromptScopeType}-${promptState.ziweiScopeDate}-${Date.now()}`;

    return createDisplayWorker(
      {
        id: requestId,
        input: primaryZiweiInput,
        dateStr: promptState.ziweiScopeDate,
        hourIndex,
        scope: ziweiPromptScopeType,
      },
      (payload) => setPromptZiweiPayload(payload),
      () => setPromptZiweiPayload(null),
    );
  }, [
    primaryZiweiInput,
    promptState.promptSource,
    promptState.tab,
    promptState.ziweiScopeDate,
    shouldUseCustomZiweiPromptPayload,
    ziweiPromptScopeType,
  ]);

  useEffect(() => {
    if (
      !shouldUseCustomZiweiPromptPayload ||
      inputState.analysisMode !== 'compatibility' ||
      !partnerZiweiInput ||
      !promptState.ziweiScopeDate
    ) {
      setPromptPartnerZiweiPayload(null);
      return;
    }

    const { hourIndex } = getDefaultHoroscopeContext();
    const requestId = `prompt-partner-${ziweiPromptScopeType}-${promptState.ziweiScopeDate}-${Date.now()}`;

    return createDisplayWorker(
      {
        id: requestId,
        input: partnerZiweiInput,
        dateStr: promptState.ziweiScopeDate,
        hourIndex,
        scope: ziweiPromptScopeType,
      },
      (payload) => setPromptPartnerZiweiPayload(payload),
      () => setPromptPartnerZiweiPayload(null),
    );
  }, [
    inputState.analysisMode,
    partnerZiweiInput,
    promptState.promptSource,
    promptState.tab,
    promptState.ziweiScopeDate,
    shouldUseCustomZiweiPromptPayload,
    ziweiPromptScopeType,
  ]);

  const activeZiweiPayloadByScope = ziweiRuntime?.payloadByScope ?? ziweiPayloadByScope;
  const activePartnerZiweiPayloadByScope =
    partnerZiweiRuntime?.payloadByScope ?? partnerZiweiPayloadByScope;

  const defaultZiweiPayload = useMemo(() => {
    if (!activeZiweiPayloadByScope) return null;
    return activeZiweiPayloadByScope[ziweiPromptScopeType];
  }, [activeZiweiPayloadByScope, ziweiPromptScopeType]);

  const defaultPartnerZiweiPayload = useMemo(() => {
    if (!activePartnerZiweiPayloadByScope) return null;
    return activePartnerZiweiPayloadByScope[ziweiPromptScopeType];
  }, [activePartnerZiweiPayloadByScope, ziweiPromptScopeType]);

  const currentZiweiPayload = promptZiweiPayload ?? defaultZiweiPayload;
  const partnerZiweiPayload = promptPartnerZiweiPayload ?? defaultPartnerZiweiPayload;

  return {
    ziweiRuntime,
    partnerZiweiRuntime,
    ziweiPayloadByScope,
    partnerZiweiPayloadByScope,
    promptZiweiPayload,
    promptPartnerZiweiPayload,
    ziweiError,
    primaryZiweiInput,
    partnerZiweiInput,
    activeZiweiPayloadByScope,
    activePartnerZiweiPayloadByScope,
    currentZiweiPayload,
    partnerZiweiPayload,
  };
}
