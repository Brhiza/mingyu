import * as React from 'react';
import '../../../styles/divination-studio.css';
import type { DivinationFormMethod } from '../../../v2-ui/chart-tabs';
import { applyGlobalRulesToPayload, loadGlobalRules, saveGlobalRules } from '../../../web-settings';
import { runCalculateInBackground } from '../../../workers/calc-runner';
import { AlmanacForm } from './AlmanacForm';
import {
  rollShengbeiResult,
  rollThreeCoins,
  rollYarrowSingleLine,
  useInteractiveLiuyaoParts,
  type CoinThrow,
  type LiuyaoLivePreview,
  type ShengbeiKind,
} from './ManualCastStudio';
import { RitualTimeControl } from './RitualStageShell';
import { DivinationMethodRenderer } from './DivinationMethodRenderer';
import {
  LIVE_CHART_METHODS,
  RITUAL_SELF_SUBMIT_METHODS,
  buildDivinationPayload,
  toBeijingPartsFromDate,
  validateDivinationFormInput,
  type DivinationFormStateSnapshot,
} from './divination-form-helpers';
import {
  UnifiedTimeBlock,
  addDaysToDateStr,
  type AlmanacParticipantDraft,
  type DrawnCardItem,
} from './divination-shared';

export interface AlmanacPreset {
  topic: 'move' | 'renovation';
  participants?: AlmanacParticipantDraft[];
  nonce: number;
}

export interface DivinationFormPanelProps {
  method: DivinationFormMethod;
  initialPayload?: Record<string, unknown>;
  almanacPreset?: AlmanacPreset | null;
  tarotMajorOnly?: boolean;
  onChange?: (payload: Record<string, unknown>) => void;
  onSubmit?: (payload: Record<string, unknown>) => void;
  showSubmitButton?: boolean;
}

export function DivinationFormPanel({
  method,
  initialPayload = {},
  almanacPreset = null,
  tarotMajorOnly = false,
  onChange,
  onSubmit,
  showSubmitButton = false,
}: DivinationFormPanelProps) {
  const [liveNowDate, setLiveNowDate] = React.useState<Date>(() => new Date());
  const nowParts = React.useMemo(() => toBeijingPartsFromDate(liveNowDate), [liveNowDate]);
  const globalPrefs = React.useMemo(() => loadGlobalRules(), []);

  // 时间与真太阳时状态
  const [timeMode, setTimeMode] = React.useState<'current' | 'custom'>(
    globalPrefs.time.defaultDivinationTimeMode,
  );
  const [customDate, setCustomDate] = React.useState(nowParts.dateStr);
  const [customTime, setCustomTime] = React.useState(nowParts.timeStr);
  const [useTrueSolar, setUseTrueSolar] = React.useState(
    globalPrefs.time.defaultTimeStandard === 'true-solar',
  );
  const [placeDisplayName, setPlaceDisplayName] = React.useState(
    globalPrefs.time.defaultPlaceDisplayName || '北京市 东城区',
  );
  const [placeLongitude, setPlaceLongitude] = React.useState(
    globalPrefs.time.defaultPlaceLongitude || 116.416,
  );

  // 六爻状态
  const [liuyaoCastMode, setLiuyaoCastMode] = React.useState<'coins' | 'manual' | 'yarrow' | 'time'>(
    globalPrefs.casting.liuyaoDefaultMethod,
  );
  const [liuyaoCoinThrows, setLiuyaoCoinThrows] = React.useState<CoinThrow[]>([]);
  const [liuyaoShaking, setLiuyaoShaking] = React.useState(false);
  const [liuyaoHoldingShell, setLiuyaoHoldingShell] = React.useState(false);
  const [liuyaoCascading, setLiuyaoCascading] = React.useState(false);
  const [liuyaoPreview, setLiuyaoPreview] = React.useState<LiuyaoLivePreview | null>(null);
  const [liuyaoManualYaos, setLiuyaoManualYaos] = React.useState<Array<6 | 7 | 8 | 9>>([
    7, 8, 7, 8, 7, 8,
  ]);
  const [liuyaoYarrowYaos, setLiuyaoYarrowYaos] = React.useState<Array<6 | 7 | 8 | 9>>([]);

  // 梅花状态
  const [meihuaCastMode, setMeihuaCastMode] = React.useState<
    'time' | 'number' | 'character' | 'sound' | 'direction'
  >(globalPrefs.casting.meihuaDefaultMethod);
  const [meihuaNumber, setMeihuaNumber] = React.useState('');
  const [meihuaCharText, setMeihuaCharText] = React.useState('');
  const [meihuaSoundCount, setMeihuaSoundCount] = React.useState('');
  const [meihuaDirection, setMeihuaDirection] = React.useState('south');
  const [meihuaObjectType, setMeihuaObjectType] = React.useState('fire');

  // 时课类核心状态
  const [qimenMethod] = React.useState<'zhuanpan' | 'feipan'>(
    globalPrefs.casting.qimenDefaultMethod,
  );
  const [qimenScope, setQimenScope] = React.useState<'hour' | 'day' | 'month' | 'year'>('hour');
  const [liurenGuiRenTable] = React.useState<'jia-wu-geng-chou-wei' | 'jia-yang-wu-geng-niu'>(
    globalPrefs.liuren.guiRenTable,
  );
  const [jinkoujueMode, setJinkoujueMode] = React.useState<'time' | 'branch' | 'number' | 'random'>(
    globalPrefs.casting.jinkoujueDefaultMethod,
  );
  const [jinkoujueBranch, setJinkoujueBranch] = React.useState('午');
  const [jinkoujueNumber, setJinkoujueNumber] = React.useState('');
  const [taiyiScope, setTaiyiScope] = React.useState<'year' | 'month' | 'day' | 'hour'>('year');
  const [taiyiYear, setTaiyiYear] = React.useState(String(nowParts.year));
  const [xiaoliurenRule] = React.useState<'common' | 'duoneng'>(
    globalPrefs.casting.xiaoliurenDefaultRule,
  );
  const [xiaoliurenMode, setXiaoliurenMode] = React.useState<'time' | 'numbers'>('time');
  const [xiaoliurenNumbers, setXiaoliurenNumbers] = React.useState<[string, string, string]>([
    '',
    '',
    '',
  ]);
  const [huangjiMode, setHuangjiMode] = React.useState<'year' | 'datetime' | 'six-day'>('year');
  const [huangjiYear, setHuangjiYear] = React.useState(String(nowParts.year));
  const [wuyunYear, setWuyunYear] = React.useState(String(nowParts.year));

  // 牌卡与灵签类状态
  const [tarotDeckScope, setTarotDeckScope] = React.useState<'all' | 'major'>(() =>
    tarotMajorOnly || (initialPayload.tarot as { deckScope?: string } | undefined)?.deckScope === 'major'
      ? 'major'
      : 'all',
  );
  const [tarotSpreadId, setTarotSpreadId] = React.useState('three');
  const [tarotDrawMode, setTarotDrawMode] = React.useState<'interactive' | 'random' | 'manual'>(
    globalPrefs.casting.tarotDefaultDrawMode,
  );
  const [tarotReversalMode, setTarotReversalMode] = React.useState<
    'realistic' | 'balanced' | 'upright-only'
  >(() => {
    const initialMode = (initialPayload.tarot as { reversalMode?: string } | undefined)
      ?.reversalMode;
    if (
      initialMode === 'realistic' ||
      initialMode === 'balanced' ||
      initialMode === 'upright-only'
    ) {
      return initialMode;
    }
    return globalPrefs.casting.tarotReversalMode;
  });
  const [tarotDrawnCards, setTarotDrawnCards] = React.useState<DrawnCardItem[]>([]);
  const [lenormandSpreadId, setLenormandSpreadId] = React.useState('three');
  const [lenormandDrawMode, setLenormandDrawMode] = React.useState<
    'interactive' | 'random' | 'manual'
  >(globalPrefs.casting.lenormandDefaultDrawMode);
  const [lenormandDrawnCards, setLenormandDrawnCards] = React.useState<DrawnCardItem[]>([]);

  const [zhugeCastMode, setZhugeCastMode] = React.useState<'text' | 'numbers' | 'coins'>(
    globalPrefs.casting.kongmingDefaultMode === 'random' ? 'coins' : 'text',
  );
  const [zhugeChars, setZhugeChars] = React.useState<[string, string, string]>(['', '', '']);
  const [zhugeCharRawInputs, setZhugeCharRawInputs] = React.useState<[string, string, string]>([
    '',
    '',
    '',
  ]);
  const [zhugeNumbers, setZhugeNumbers] = React.useState<[string, string, string]>(['', '', '']);
  const [kongmingCoins, setKongmingCoins] = React.useState<Array<'●' | '○'>>(() =>
    Array.from({ length: 5 }, () => (Math.random() < 0.5 ? '●' : '○')),
  );

  const [ssgwMode, setSsgwMode] = React.useState<'interactive' | 'manual' | 'random'>(
    globalPrefs.casting.ssgwDefaultMode,
  );
  const [ssgwNumber, setSsgwNumber] = React.useState('');
  const [ssgwConfirmed, setSsgwConfirmed] = React.useState(false);
  const [ssgwBeiMessage, setSsgwBeiMessage] = React.useState('');
  const [ssgwBeiPair, setSsgwBeiPair] = React.useState<
    readonly ['yang' | 'yin', 'yang' | 'yin'] | undefined
  >(undefined);
  const [ssgwBeiHistory, setSsgwBeiHistory] = React.useState<
    Array<{ short: string; ok: boolean; kind: ShengbeiKind }>
  >([]);
  const [ssgwShaking, setSsgwShaking] = React.useState(false);
  const [ssgwThrowing, setSsgwThrowing] = React.useState(false);

  // 黄历择日状态
  const [almanacTopic, setAlmanacTopic] = React.useState('move');
  const [almanacCustomKeyword, setAlmanacCustomKeyword] = React.useState('');
  const [almanacStartDate, setAlmanacStartDate] = React.useState(nowParts.dateStr);
  const [almanacEndDate, setAlmanacEndDate] = React.useState(() =>
    addDaysToDateStr(nowParts.dateStr, 6),
  );
  const [almanacWeekendPref, setAlmanacWeekendPref] = React.useState<'any' | 'prefer' | 'avoid'>(
    'any',
  );
  const [almanacTimePrefs, setAlmanacTimePrefs] = React.useState<
    Array<'work-hours' | 'morning' | 'afternoon'>
  >([]);
  const [almanacParticipants, setAlmanacParticipants] = React.useState<AlmanacParticipantDraft[]>(
    [],
  );
  const appliedPresetNonceRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (method !== 'almanac' || !almanacPreset || almanacPreset.nonce === appliedPresetNonceRef.current) {
      return;
    }
    appliedPresetNonceRef.current = almanacPreset.nonce;
    setAlmanacTopic(almanacPreset.topic);
    if (almanacPreset.participants && almanacPreset.participants.length > 0) {
      setAlmanacParticipants(almanacPreset.participants);
    }
  }, [almanacPreset, method]);

  // 八宅 / 玄空 / 住宅风水状态
  const [fengshuiOrientationKind, setFengshuiOrientationKind] = React.useState<
    'mountain' | 'degree'
  >('mountain');
  const [fengshuiSitMountain, setFengshuiSitMountain] = React.useState('子');
  const [fengshuiDegree, setFengshuiDegree] = React.useState(0);
  const [fengshuiConstructionYear, setFengshuiConstructionYear] = React.useState(2024);
  const [fengshuiFlowYear, setFengshuiFlowYear] = React.useState(nowParts.year);
  const [fengshuiMode, setFengshuiMode] = React.useState<'下卦' | '替卦'>('下卦');
  const [fengshuiPersonYear, setFengshuiPersonYear] = React.useState('1990');
  const [fengshuiPersonGender, setFengshuiPersonGender] = React.useState<'male' | 'female'>(
    'female',
  );

  const [formError, setFormError] = React.useState<string | null>(null);
  const ritualTimerRef = React.useRef<number | null>(null);
  const cascadeTimerRef = React.useRef<number | null>(null);
  const holdStartAtRef = React.useRef(0);

  const clearRitualTimer = React.useCallback(() => {
    if (ritualTimerRef.current !== null) {
      window.clearTimeout(ritualTimerRef.current);
      ritualTimerRef.current = null;
    }
    if (cascadeTimerRef.current !== null) {
      window.clearInterval(cascadeTimerRef.current);
      cascadeTimerRef.current = null;
    }
    setLiuyaoHoldingShell(false);
    setLiuyaoCascading(false);
  }, []);

  React.useEffect(() => clearRitualTimer, [clearRitualTimer]);

  const handleChangeUseTrueSolar = React.useCallback((checked: boolean) => {
    setUseTrueSolar(checked);
    const cur = loadGlobalRules();
    saveGlobalRules({
      ...cur,
      time: { ...cur.time, defaultTimeStandard: checked ? 'true-solar' : 'beijing' },
    });
  }, []);

  const handleChangePlace = React.useCallback(
    (name: string, lng: number, lat?: number) => {
      setPlaceDisplayName(name);
      setPlaceLongitude(lng);
      const cur = loadGlobalRules();
      saveGlobalRules({
        ...cur,
        time: {
          ...cur.time,
          defaultPlaceDisplayName: name,
          defaultPlaceLongitude: lng,
          ...(typeof lat === 'number' ? { defaultPlaceLatitude: lat } : {}),
        },
      });
    },
    [],
  );

  const stateSnapshot = React.useMemo<DivinationFormStateSnapshot>(
    () => ({
      method,
      nowYear: nowParts.year,
      timeMode,
      customDate,
      customTime,
      liveNowDate,
      useTrueSolar,
      placeLongitude,
      liuyaoCastMode,
      liuyaoCoinThrows,
      liuyaoManualYaos,
      liuyaoYarrowYaos,
      meihuaCastMode,
      meihuaNumber,
      meihuaCharText,
      meihuaSoundCount,
      meihuaDirection,
      meihuaObjectType,
      qimenMethod,
      qimenScope,
      liurenGuiRenTable,
      jinkoujueMode,
      jinkoujueBranch,
      jinkoujueNumber,
      taiyiScope,
      taiyiYear,
      xiaoliurenRule,
      xiaoliurenMode,
      xiaoliurenNumbers,
      huangjiMode,
      huangjiYear,
      wuyunYear,
      tarotDeckScope,
      tarotSpreadId,
      tarotDrawMode,
      tarotReversalMode,
      tarotDrawnCards,
      lenormandSpreadId,
      lenormandDrawMode,
      lenormandDrawnCards,
      zhugeCastMode,
      zhugeChars,
      zhugeNumbers,
      kongmingCoins,
      ssgwMode,
      ssgwNumber,
      ssgwConfirmed,
      almanacTopic,
      almanacCustomKeyword,
      almanacStartDate,
      almanacEndDate,
      almanacWeekendPref,
      almanacTimePrefs,
      almanacParticipants,
      fengshuiOrientationKind,
      fengshuiSitMountain,
      fengshuiDegree,
      fengshuiConstructionYear,
      fengshuiFlowYear,
      fengshuiMode,
      fengshuiPersonYear,
      fengshuiPersonGender,
    }),
    [
      almanacCustomKeyword,
      almanacEndDate,
      almanacParticipants,
      almanacStartDate,
      almanacTimePrefs,
      almanacTopic,
      almanacWeekendPref,
      customDate,
      customTime,
      fengshuiConstructionYear,
      fengshuiDegree,
      fengshuiFlowYear,
      fengshuiMode,
      fengshuiOrientationKind,
      fengshuiPersonGender,
      fengshuiPersonYear,
      fengshuiSitMountain,
      huangjiMode,
      huangjiYear,
      jinkoujueBranch,
      jinkoujueMode,
      jinkoujueNumber,
      kongmingCoins,
      lenormandDrawMode,
      lenormandDrawnCards,
      lenormandSpreadId,
      liveNowDate,
      liurenGuiRenTable,
      liuyaoCastMode,
      liuyaoCoinThrows,
      liuyaoManualYaos,
      liuyaoYarrowYaos,
      meihuaCastMode,
      meihuaCharText,
      meihuaDirection,
      meihuaNumber,
      meihuaObjectType,
      meihuaSoundCount,
      method,
      nowParts.year,
      placeLongitude,
      qimenMethod,
      qimenScope,
      ssgwConfirmed,
      ssgwMode,
      ssgwNumber,
      taiyiScope,
      taiyiYear,
      tarotDeckScope,
      tarotDrawMode,
      tarotDrawnCards,
      tarotReversalMode,
      tarotSpreadId,
      timeMode,
      useTrueSolar,
      wuyunYear,
      xiaoliurenMode,
      xiaoliurenNumbers,
      xiaoliurenRule,
      zhugeCastMode,
      zhugeChars,
      zhugeNumbers,
    ],
  );

  const buildPayload = React.useCallback(
    () => buildDivinationPayload(stateSnapshot),
    [stateSnapshot],
  );

  React.useEffect(() => {
    onChange?.(buildPayload());
  }, [buildPayload, onChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errMsg = validateDivinationFormInput(stateSnapshot);
    if (errMsg) {
      setFormError(errMsg);
      return;
    }
    setFormError(null);
    onSubmit?.(buildPayload());
  };

  const settleCoinThrow = React.useCallback(
    (delayMs: number) => {
      if (ritualTimerRef.current !== null) {
        window.clearTimeout(ritualTimerRef.current);
        ritualTimerRef.current = null;
      }
      ritualTimerRef.current = window.setTimeout(() => {
        ritualTimerRef.current = null;
        setLiuyaoHoldingShell(false);
        setLiuyaoShaking(false);
        setLiuyaoCoinThrows((prev) => {
          if (prev.length >= 6) return prev;
          return [...prev, rollThreeCoins()];
        });
      }, delayMs);
    },
    [],
  );

  // 六爻满 6 爻时实时算出本卦 / 变卦 / 宫位供「成卦印鉴」展示
  React.useEffect(() => {
    if (method !== 'liuyao' || liuyaoCastMode === 'time') {
      setLiuyaoPreview(null);
      return;
    }
    const yaos =
      liuyaoCastMode === 'coins'
        ? liuyaoCoinThrows.map((t) => t.total)
        : liuyaoCastMode === 'manual'
          ? liuyaoManualYaos
          : liuyaoYarrowYaos;

    if (yaos.length < 6) {
      setLiuyaoPreview(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const parsed = buildDivinationPayload(stateSnapshot);
        const res = (await runCalculateInBackground(
          'liuyao',
          applyGlobalRulesToPayload('liuyao', parsed, false),
          { promptGuidance: loadGlobalRules().prompt },
        )) as {
          data?: {
            originalName?: string;
            changedName?: string;
            palace?: { name?: string; wuxing?: string };
            palaceStage?: string;
          };
        } | null;
        if (cancelled || !res?.data?.originalName) return;
        const p = res.data.palace;
        const palaceStr = p?.name
          ? `${p.name}宫${p.wuxing ?? ''}${res.data.palaceStage ? ` · ${res.data.palaceStage}` : ''}`
          : undefined;
        setLiuyaoPreview({
          originalName: res.data.originalName,
          changedName: res.data.changedName,
          palaceText: palaceStr,
        });
      } catch {
        if (!cancelled) setLiuyaoPreview(null);
      }
    }, 60);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    liuyaoCastMode,
    liuyaoCoinThrows,
    liuyaoManualYaos,
    liuyaoYarrowYaos,
    method,
    stateSnapshot,
  ]);

  const liuyaoParts = useInteractiveLiuyaoParts({
    mode: liuyaoCastMode === 'time' ? 'coins' : liuyaoCastMode,
    coinThrows: liuyaoCoinThrows,
    manualYaos: liuyaoManualYaos,
    yarrowYaos: liuyaoYarrowYaos,
    isShaking: liuyaoShaking,
    isHoldingShell: liuyaoHoldingShell,
    isCascading: liuyaoCascading,
    showSubmitButton: Boolean(showSubmitButton && onSubmit),
    liuyaoPreview,
    onRequestShakeCoin: () => {
      if (liuyaoShaking || liuyaoHoldingShell || liuyaoCascading || liuyaoCoinThrows.length >= 6) {
        return;
      }
      clearRitualTimer();
      setFormError(null);
      setLiuyaoShaking(true);
      settleCoinThrow(290);
    },
    onHoldShakeStart: () => {
      if (liuyaoShaking || liuyaoHoldingShell || liuyaoCascading || liuyaoCoinThrows.length >= 6) {
        return;
      }
      clearRitualTimer();
      setFormError(null);
      holdStartAtRef.current = Date.now();
      setLiuyaoHoldingShell(true);
      setLiuyaoShaking(true);
    },
    onHoldShakeRelease: () => {
      if (!liuyaoHoldingShell && !liuyaoShaking) return;
      const elapsed = Date.now() - holdStartAtRef.current;
      const remain = elapsed >= 220 ? 0 : Math.max(80, 260 - elapsed);
      settleCoinThrow(remain);
    },
    onRequestCascadeCast: () => {
      if (liuyaoShaking || liuyaoHoldingShell || liuyaoCascading) return;
      clearRitualTimer();
      setFormError(null);
      if (liuyaoCastMode === 'coins') {
        const remaining = 6 - liuyaoCoinThrows.length;
        if (remaining <= 0) return;
        setLiuyaoCascading(true);
        const batch = Array.from({ length: remaining }, () => rollThreeCoins());
        let cursor = 0;
        const first = batch[cursor++];
        if (first) {
          setLiuyaoCoinThrows((prev) => (prev.length < 6 ? [...prev, first] : prev));
        }
        if (cursor >= batch.length) {
          setLiuyaoCascading(false);
          return;
        }
        cascadeTimerRef.current = window.setInterval(() => {
          const item = batch[cursor++];
          if (item) {
            setLiuyaoCoinThrows((prev) => (prev.length < 6 ? [...prev, item] : prev));
          }
          if (cursor >= batch.length) {
            if (cascadeTimerRef.current !== null) {
              window.clearInterval(cascadeTimerRef.current);
              cascadeTimerRef.current = null;
            }
            setLiuyaoCascading(false);
          }
        }, 105);
        return;
      }
      if (liuyaoCastMode === 'yarrow') {
        const remaining = 6 - liuyaoYarrowYaos.length;
        if (remaining <= 0) return;
        setLiuyaoCascading(true);
        const batch = Array.from({ length: remaining }, () => rollYarrowSingleLine());
        let cursor = 0;
        const first = batch[cursor++];
        if (first) {
          setLiuyaoYarrowYaos((prev) => (prev.length < 6 ? [...prev, first] : prev));
        }
        if (cursor >= batch.length) {
          setLiuyaoCascading(false);
          return;
        }
        cascadeTimerRef.current = window.setInterval(() => {
          const item = batch[cursor++];
          if (item) {
            setLiuyaoYarrowYaos((prev) => (prev.length < 6 ? [...prev, item] : prev));
          }
          if (cursor >= batch.length) {
            if (cascadeTimerRef.current !== null) {
              window.clearInterval(cascadeTimerRef.current);
              cascadeTimerRef.current = null;
            }
            setLiuyaoCascading(false);
          }
        }, 105);
      }
    },
    onUpdateCoins: (next) => {
      setLiuyaoShaking(false);
      setFormError(null);
      setLiuyaoCoinThrows(next);
      clearRitualTimer();
    },
    onUpdateManual: (next) => {
      setFormError(null);
      setLiuyaoManualYaos(next);
    },
    onUpdateYarrow: (next) => {
      setFormError(null);
      setLiuyaoYarrowYaos(next);
      clearRitualTimer();
    },
  });

  const renderUnifiedTime = (fieldLabel = '起卦时间', actionLabel = '起卦', wrapped = true) => {
    const timeProps = {
      fieldLabel,
      actionLabel,
      timeMode,
      customDate,
      customTime,
      nowDateStr: nowParts.dateStr,
      nowTimeStr: nowParts.timeStr,
      useTrueSolar,
      placeDisplayName,
      placeLongitude,
      onChangeTimeMode: setTimeMode,
      onChangeCustomDate: setCustomDate,
      onChangeCustomTime: setCustomTime,
      onChangeUseTrueSolar: handleChangeUseTrueSolar,
      onChangePlace: handleChangePlace,
      onRefreshCurrent: () => setLiveNowDate(new Date()),
    };
    return wrapped ? <RitualTimeControl {...timeProps} /> : <UnifiedTimeBlock {...timeProps} />;
  };

  const renderInlineYearStepper = (
    value: string,
    minYear: number,
    maxYear: number,
    onChangeYear: (next: string) => void,
  ) => {
    const parsed = Number.parseInt(value, 10);
    const curYear = Number.isFinite(parsed) ? parsed : nowParts.year;
    return (
      <div className="live-chart-year-inline">
        <button
          type="button"
          className="ritual-mini-btn"
          onClick={() => onChangeYear(String(Math.max(minYear, curYear - 1)))}
        >
          -1
        </button>
        <input
          type="text"
          inputMode="numeric"
          aria-label="起局年份"
          className="workspace-ui-control live-chart-year-input"
          value={value}
          placeholder={String(nowParts.year)}
          onChange={(e) => onChangeYear(e.target.value.replace(/[^\d-]/g, '').slice(0, 5))}
        />
        <button
          type="button"
          className="ritual-mini-btn"
          onClick={() => onChangeYear(String(Math.min(maxYear, curYear + 1)))}
        >
          +1
        </button>
        <button
          type="button"
          className="ritual-mini-btn"
          onClick={() => onChangeYear(String(nowParts.year))}
        >
          {`今年(${nowParts.year})`}
        </button>
      </div>
    );
  };

  const renderSubmitActions = () => {
    if (!showSubmitButton || !onSubmit || RITUAL_SELF_SUBMIT_METHODS.has(method)) return null;
    const submitLabel =
      method === 'almanac'
        ? '开始择日'
        : method === 'residential' || method === 'bazhai' || method === 'xuankong'
          ? '测算阳宅风水'
          : '开始占卜';
    return (
      <div className="workspace-ui-form-actions is-sticky-mobile">
        <button
          type="submit"
          className="workspace-ui-button is-primary is-large is-block"
        >
          {submitLabel}
        </button>
      </div>
    );
  };

  const renderMethodContent = () => (
    <DivinationMethodRenderer
      method={method}
      showSubmit={Boolean(showSubmitButton && onSubmit)}
      buildPayload={buildPayload}
      clearRitualTimer={clearRitualTimer}
      setFormError={setFormError}
      renderUnifiedTime={renderUnifiedTime}
      renderInlineYearStepper={renderInlineYearStepper}
      liuyaoCastMode={liuyaoCastMode}
      onChangeLiuyaoCastMode={setLiuyaoCastMode}
      onStopLiuyaoShaking={() => setLiuyaoShaking(false)}
      liuyaoParts={liuyaoParts}
      meihuaCastMode={meihuaCastMode}
      meihuaNumber={meihuaNumber}
      meihuaCharText={meihuaCharText}
      meihuaSoundCount={meihuaSoundCount}
      meihuaDirection={meihuaDirection}
      meihuaObjectType={meihuaObjectType}
      onChangeMeihuaCastMode={setMeihuaCastMode}
      onChangeMeihuaNumber={setMeihuaNumber}
      onChangeMeihuaCharText={setMeihuaCharText}
      onChangeMeihuaSoundCount={setMeihuaSoundCount}
      onChangeMeihuaDirection={setMeihuaDirection}
      onChangeMeihuaObjectType={setMeihuaObjectType}
      xiaoliurenMode={xiaoliurenMode}
      xiaoliurenNumbers={xiaoliurenNumbers}
      onChangeXiaoliurenMode={setXiaoliurenMode}
      onChangeXiaoliurenNumbers={setXiaoliurenNumbers}
      jinkoujueMode={jinkoujueMode}
      jinkoujueBranch={jinkoujueBranch}
      jinkoujueNumber={jinkoujueNumber}
      onChangeJinkoujueMode={setJinkoujueMode}
      onChangeJinkoujueBranch={setJinkoujueBranch}
      onChangeJinkoujueNumber={setJinkoujueNumber}
      qimenScope={qimenScope}
      onChangeQimenScope={setQimenScope}
      taiyiScope={taiyiScope}
      taiyiYear={taiyiYear}
      onChangeTaiyiScope={setTaiyiScope}
      onChangeTaiyiYear={setTaiyiYear}
      huangjiMode={huangjiMode}
      huangjiYear={huangjiYear}
      onChangeHuangjiMode={setHuangjiMode}
      onChangeHuangjiYear={setHuangjiYear}
      wuyunYear={wuyunYear}
      onChangeWuyunYear={setWuyunYear}
      tarotSpreadId={tarotSpreadId}
      tarotDeckScope={tarotDeckScope}
      tarotDrawMode={tarotDrawMode}
      tarotReversalMode={tarotReversalMode}
      tarotDrawnCards={tarotDrawnCards}
      onChangeTarotSpreadId={setTarotSpreadId}
      onChangeTarotDeckScope={setTarotDeckScope}
      onChangeTarotDrawMode={setTarotDrawMode}
      onChangeTarotReversalMode={setTarotReversalMode}
      onChangeTarotDrawnCards={setTarotDrawnCards}
      lenormandSpreadId={lenormandSpreadId}
      lenormandDrawMode={lenormandDrawMode}
      lenormandDrawnCards={lenormandDrawnCards}
      onChangeLenormandSpreadId={setLenormandSpreadId}
      onChangeLenormandDrawMode={setLenormandDrawMode}
      onChangeLenormandDrawnCards={setLenormandDrawnCards}
      zhugeCastMode={zhugeCastMode}
      kongmingCoins={kongmingCoins}
      zhugeCharRawInputs={zhugeCharRawInputs}
      zhugeNumbers={zhugeNumbers}
      onChangeZhugeCastMode={setZhugeCastMode}
      onChangeKongmingCoins={setKongmingCoins}
      onChangeZhugeCharAt={(i, raw) => {
        setFormError(null);
        const nextRaw = [...zhugeCharRawInputs] as [string, string, string];
        nextRaw[i] = raw;
        setZhugeCharRawInputs(nextRaw);

        const hanChar = [...raw.trim()].find((ch) => /\p{Script=Han}/u.test(ch));
        if (hanChar) {
          const nextChars = [...zhugeChars] as [string, string, string];
          nextChars[i] = hanChar;
          setZhugeChars(nextChars);
        } else if (!raw.trim()) {
          const nextChars = [...zhugeChars] as [string, string, string];
          nextChars[i] = '';
          setZhugeChars(nextChars);
        }
      }}
      onBlurZhugeCharAt={(i) => {
        const nextRaw = [...zhugeCharRawInputs] as [string, string, string];
        nextRaw[i] = zhugeChars[i] ?? '';
        setZhugeCharRawInputs(nextRaw);
      }}
      onChangeZhugeNumbers={setZhugeNumbers}
      ssgwMode={ssgwMode}
      ssgwNumber={ssgwNumber}
      ssgwConfirmed={ssgwConfirmed}
      ssgwBeiMessage={ssgwBeiMessage}
      ssgwBeiPair={ssgwBeiPair}
      ssgwBeiHistory={ssgwBeiHistory}
      ssgwShaking={ssgwShaking}
      ssgwThrowing={ssgwThrowing}
      onChangeSsgwMode={(next) => {
        setSsgwShaking(false);
        setSsgwThrowing(false);
        setFormError(null);
        setSsgwMode(next);
      }}
      onChangeSsgwNumber={setSsgwNumber}
      onRequestSsgwShake={() => {
        if (ssgwShaking || ssgwThrowing) return;
        clearRitualTimer();
        setFormError(null);
        setSsgwShaking(true);
        setSsgwConfirmed(false);
        setSsgwBeiPair(undefined);
        setSsgwBeiMessage('');
        setSsgwBeiHistory([]);
      }}
      onCompleteSsgwShake={() => {
        clearRitualTimer();
        setSsgwShaking(false);
        setSsgwNumber(String(Math.floor(Math.random() * 92) + 1));
        setSsgwBeiPair(undefined);
        setSsgwBeiMessage('');
      }}
      onRequestSsgwThrow={() => {
        const latestBei = ssgwBeiHistory[ssgwBeiHistory.length - 1];
        if (!ssgwNumber || ssgwShaking || ssgwThrowing || ssgwConfirmed || latestBei?.kind === 'yin') {
          return;
        }
        clearRitualTimer();
        setFormError(null);
        setSsgwThrowing(true);
        ritualTimerRef.current = window.setTimeout(() => {
          ritualTimerRef.current = null;
          setSsgwThrowing(false);
          const result = rollShengbeiResult();
          setSsgwBeiPair(result.pair);
          setSsgwBeiHistory((prev) => [
            ...prev,
            { short: result.short, ok: result.ok, kind: result.kind },
          ]);
          setSsgwConfirmed(result.ok);
          setSsgwBeiMessage(
            result.ok
              ? `${result.label} · 圣杯已定`
              : `${result.label} · ${result.desc}`,
          );
        }, 420);
      }}
    />
  );

  const isLiveChart = LIVE_CHART_METHODS.has(method);
  const isStudioSurface = RITUAL_SELF_SUBMIT_METHODS.has(method) && !isLiveChart;

  return (
    <div
      className={`workspace-focused-page workspace-divination-page${
        method === 'almanac'
          ? ' is-almanac'
          : method === 'ssgw'
            ? ' is-ssgw-page'
            : isLiveChart
              ? ' is-wide is-live-chart-page'
              : ''
      }`}
    >
      <div className="divination-workspace-shell is-input-only divination-panel-shell">
        <form className="workspace-ui-surface is-plain divination-form-panel" onSubmit={handleSubmit}>
          {method === 'almanac' ? (
            <>
              <section className="workspace-ui-form-surface divination-form-card">
                <AlmanacForm
                  topic={almanacTopic}
                  customKeyword={almanacCustomKeyword}
                  startDate={almanacStartDate}
                  endDate={almanacEndDate}
                  nowDateStr={nowParts.dateStr}
                  weekendPref={almanacWeekendPref}
                  timePrefs={almanacTimePrefs}
                  participants={almanacParticipants}
                  onChangeTopic={setAlmanacTopic}
                  onChangeCustomKeyword={setAlmanacCustomKeyword}
                  onChangeStartDate={setAlmanacStartDate}
                  onChangeEndDate={setAlmanacEndDate}
                  onChangeWeekendPref={setAlmanacWeekendPref}
                  onChangeTimePrefs={setAlmanacTimePrefs}
                  onChangeParticipants={setAlmanacParticipants}
                />
              </section>
              {formError ? <div className="workspace-ui-form-error">{formError}</div> : null}
              {renderSubmitActions()}
            </>
          ) : isLiveChart ? (
            <section className="workspace-ui-form-surface divination-form-card is-live-chart-card is-live-chart-surface">
              {renderMethodContent()}
              {formError ? <div className="workspace-ui-form-error">{formError}</div> : null}
            </section>
          ) : (
            <section
              className={`workspace-ui-form-surface divination-form-card${
                isStudioSurface ? ' is-studio-surface' : ''
              }`}
            >
              <div className="person-info-form workspace-ui-form-body divination-flow-workbench">
                {renderMethodContent()}
                {formError ? <div className="workspace-ui-form-error">{formError}</div> : null}
                {renderSubmitActions()}
              </div>
            </section>
          )}
        </form>
      </div>
    </div>
  );
}

export default DivinationFormPanel;
