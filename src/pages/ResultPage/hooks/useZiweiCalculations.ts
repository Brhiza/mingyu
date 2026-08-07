import { useEffect, useMemo, useRef, useState } from 'react';
import { buildZiweiChartInput, calculateFullZiweiChart } from '@/lib/full-chart-engine';
import { getDefaultHoroscopeContext } from 'mingyu-core/ziwei';
import type { AnalysisPayloadV1 } from '@/types/analysis';
import type { ScopeType } from '@/types/analysis';
import type { ChartInput } from '@/types/chart';
import type { QueryInputState } from '@/lib/query-state';
import { createSecureId } from '@/lib/secure-id';
import { createDisplayWorker } from '../utils/createDisplayWorker';
import { createPayloadWorker } from '../utils/createPayloadWorker';
import type { ZiweiPayloadByScopeState, ZiweiRuntimeState } from '../ResultPage.types';

async function runZiweiMainThread(
  input: ChartInput,
  onSuccess: (runtime: NonNullable<ZiweiRuntimeState>) => void,
  onError: (message: string) => void,
): Promise<void> {
  try {
    // skipAnalysis=true：不在主线程计算证据池和格局检测，仅生成展示所需的基础数据
    const runtime = await calculateFullZiweiChart(input, true);
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
  isZiweiTabMounted: boolean,
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
  const [primaryRuntimeInputKey, setPrimaryRuntimeInputKey] = useState('');
  const [partnerRuntimeInputKey, setPartnerRuntimeInputKey] = useState('');
  const [primaryPayloadInputKey, setPrimaryPayloadInputKey] = useState('');
  const [partnerPayloadInputKey, setPartnerPayloadInputKey] = useState('');
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
  const shouldWarmZiweiRuntime =
    Boolean(primaryZiweiInput) && (isZiweiTabMounted || shouldLoadZiweiPromptPayload);
  const shouldWarmPartnerZiweiRuntime =
    inputState.analysisMode === 'compatibility' &&
    Boolean(partnerZiweiInput) &&
    (isZiweiTabMounted || shouldLoadZiweiPromptPayload);
  const primaryZiweiInputKey = useMemo(
    () => (primaryZiweiInput ? JSON.stringify(primaryZiweiInput) : ''),
    [primaryZiweiInput],
  );
  const partnerZiweiInputKey = useMemo(
    () => (partnerZiweiInput ? JSON.stringify(partnerZiweiInput) : ''),
    [partnerZiweiInput],
  );

  useEffect(() => {
    if (!primaryZiweiInput) {
      setZiweiPayloadByScope(null);
      setPrimaryPayloadInputKey('');
      primaryPayloadKeyRef.current = '';
      return;
    }

    if (!shouldLoadZiweiPromptPayload) {
      setZiweiPayloadByScope(null);
      setPrimaryPayloadInputKey('');
      primaryPayloadKeyRef.current = '';
      return;
    }

    if (primaryPayloadKeyRef.current !== primaryZiweiInputKey) {
      setZiweiPayloadByScope(null);
      setPrimaryPayloadInputKey('');
      primaryPayloadKeyRef.current = '';
    }

    if (primaryPayloadKeyRef.current === primaryZiweiInputKey && ziweiPayloadByScope) {
      return;
    }

    return createPayloadWorker(
      primaryZiweiInput,
      `${createSecureId()}-primary`,
      (payloadByScope) => {
        setZiweiPayloadByScope(payloadByScope);
        setPrimaryPayloadInputKey(primaryZiweiInputKey);
        primaryPayloadKeyRef.current = primaryZiweiInputKey;
        setZiweiError('');
      },
      (message) => {
        setZiweiPayloadByScope((current) => current);
        setZiweiError(message);
      },
      '紫微排盘失败。',
    );
    // payload 状态只用于展示最新结果；成功回调通过 key ref 标记当前请求，避免状态变更时重启同一个 Worker。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [primaryZiweiInput, primaryZiweiInputKey, shouldLoadZiweiPromptPayload]);

  useEffect(() => {
    if (!partnerZiweiInput) {
      setPartnerZiweiPayloadByScope(null);
      setPartnerPayloadInputKey('');
      partnerPayloadKeyRef.current = '';
      return;
    }

    if (!shouldLoadZiweiPromptPayload) {
      setPartnerZiweiPayloadByScope(null);
      setPartnerPayloadInputKey('');
      partnerPayloadKeyRef.current = '';
      return;
    }

    if (partnerPayloadKeyRef.current !== partnerZiweiInputKey) {
      setPartnerZiweiPayloadByScope(null);
      setPartnerPayloadInputKey('');
      partnerPayloadKeyRef.current = '';
    }

    if (partnerPayloadKeyRef.current === partnerZiweiInputKey && partnerZiweiPayloadByScope) {
      return;
    }

    return createPayloadWorker(
      partnerZiweiInput,
      `${createSecureId()}-partner`,
      (payloadByScope) => {
        setPartnerZiweiPayloadByScope(payloadByScope);
        setPartnerPayloadInputKey(partnerZiweiInputKey);
        partnerPayloadKeyRef.current = partnerZiweiInputKey;
        setZiweiError('');
      },
      (message) => {
        setPartnerZiweiPayloadByScope((current) => current);
        setZiweiError(message);
      },
      '第二人紫微排盘失败。',
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerZiweiInput, partnerZiweiInputKey, shouldLoadZiweiPromptPayload]);

  useEffect(() => {
    if (!shouldWarmZiweiRuntime || !primaryZiweiInput) {
      setZiweiRuntime(null);
      setPrimaryRuntimeInputKey('');
      primaryRuntimeKeyRef.current = '';
      return;
    }

    if (primaryRuntimeKeyRef.current === primaryZiweiInputKey && ziweiRuntime) {
      return;
    }

    let cancelled = false;
    let cleanupBackgroundWorker: (() => void) | undefined;

    void runZiweiMainThread(
      primaryZiweiInput,
      (runtime) => {
        if (!cancelled) {
          setZiweiRuntime(runtime);
          setPrimaryRuntimeInputKey(primaryZiweiInputKey);
          primaryRuntimeKeyRef.current = primaryZiweiInputKey;
          setZiweiError('');

          // 提示词页已经有一个完整 payload worker，避免同一命盘重复计算。
          if (!shouldLoadZiweiPromptPayload) {
            cleanupBackgroundWorker = createPayloadWorker(
              primaryZiweiInput,
              `${createSecureId()}-bg-primary`,
              (fullPayloadByScope) => {
                if (!cancelled) {
                  setZiweiPayloadByScope(fullPayloadByScope);
                  setPrimaryPayloadInputKey(primaryZiweiInputKey);
                  primaryPayloadKeyRef.current = primaryZiweiInputKey;
                }
              },
              () => {
                /* 主线程已有轻量版，后台失败不影响展示 */
              },
              '紫微排盘增强计算失败。',
            );
          }
        }
      },
      (message) => {
        if (!cancelled) {
          setZiweiRuntime((current) => current);
          setPrimaryRuntimeInputKey('');
          setZiweiError(message);
        }
      },
    );
    return () => {
      cancelled = true;
      cleanupBackgroundWorker?.();
    };
  }, [
    primaryZiweiInput,
    primaryZiweiInputKey,
    shouldLoadZiweiPromptPayload,
    shouldWarmZiweiRuntime,
    ziweiRuntime,
  ]);

  useEffect(() => {
    if (!shouldWarmPartnerZiweiRuntime || !partnerZiweiInput) {
      setPartnerZiweiRuntime(null);
      setPartnerRuntimeInputKey('');
      partnerRuntimeKeyRef.current = '';
      return;
    }

    if (partnerRuntimeKeyRef.current === partnerZiweiInputKey && partnerZiweiRuntime) {
      return;
    }

    let cancelled = false;
    let cleanupBackgroundWorker: (() => void) | undefined;

    void runZiweiMainThread(
      partnerZiweiInput,
      (runtime) => {
        if (!cancelled) {
          setPartnerZiweiRuntime(runtime);
          setPartnerRuntimeInputKey(partnerZiweiInputKey);
          partnerRuntimeKeyRef.current = partnerZiweiInputKey;
          setZiweiError('');

          if (!shouldLoadZiweiPromptPayload) {
            cleanupBackgroundWorker = createPayloadWorker(
              partnerZiweiInput,
              `${createSecureId()}-bg-partner`,
              (fullPayloadByScope) => {
                if (!cancelled) {
                  setPartnerZiweiPayloadByScope(fullPayloadByScope);
                  setPartnerPayloadInputKey(partnerZiweiInputKey);
                  partnerPayloadKeyRef.current = partnerZiweiInputKey;
                }
              },
              () => {
                /* 主线程已有轻量版，后台失败不影响展示 */
              },
              '第二人紫微排盘增强计算失败。',
            );
          }
        }
      },
      (message) => {
        if (!cancelled) {
          setPartnerZiweiRuntime((current) => current);
          setPartnerRuntimeInputKey('');
          setZiweiError(message);
        }
      },
    );
    return () => {
      cancelled = true;
      cleanupBackgroundWorker?.();
    };
  }, [
    partnerZiweiInput,
    partnerZiweiInputKey,
    partnerZiweiRuntime,
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

  useEffect(() => {
    if (!shouldUseCustomZiweiPromptPayload || !primaryZiweiInput || !promptState.ziweiScopeDate) {
      setPromptZiweiPayload(null);
      return;
    }

    const { hourIndex } = getDefaultHoroscopeContext();
    const requestId = `prompt-primary-${ziweiPromptScopeType}-${promptState.ziweiScopeDate}-${createSecureId()}`;

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
    const requestId = `prompt-partner-${ziweiPromptScopeType}-${promptState.ziweiScopeDate}-${createSecureId()}`;

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

  const currentZiweiRuntime = primaryRuntimeInputKey === primaryZiweiInputKey ? ziweiRuntime : null;
  const currentPartnerZiweiRuntime =
    partnerRuntimeInputKey === partnerZiweiInputKey ? partnerZiweiRuntime : null;
  const currentZiweiPayloadByScope =
    primaryPayloadInputKey === primaryZiweiInputKey ? ziweiPayloadByScope : null;
  const currentPartnerZiweiPayloadByScope =
    partnerPayloadInputKey === partnerZiweiInputKey ? partnerZiweiPayloadByScope : null;
  const activeZiweiPayloadByScope =
    currentZiweiPayloadByScope ?? currentZiweiRuntime?.payloadByScope ?? null;
  const activePartnerZiweiPayloadByScope =
    currentPartnerZiweiPayloadByScope ?? currentPartnerZiweiRuntime?.payloadByScope ?? null;

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
    ziweiRuntime: currentZiweiRuntime,
    partnerZiweiRuntime: currentPartnerZiweiRuntime,
    ziweiPayloadByScope: currentZiweiPayloadByScope,
    partnerZiweiPayloadByScope: currentPartnerZiweiPayloadByScope,
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
