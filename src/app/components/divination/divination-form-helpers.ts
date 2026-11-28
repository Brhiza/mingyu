import type { DivinationFormMethod } from '../../../v2-ui/chart-tabs';
import type { CoinThrow } from './ManualCastStudio';
import {
  LENORMAND_SPREAD_LIST,
  TAROT_SPREAD_LIST,
  getDefaultQuestionForMethod,
  toBeijingIso,
  type AlmanacParticipantDraft,
  type DrawnCardItem,
} from './divination-shared';

export const LIVE_CHART_METHODS = new Set<DivinationFormMethod>([
  'qimen',
  'liuren',
  'taiyi',
  'huangji-jingshi',
  'wuyun-liuqi',
]);

export const RITUAL_SELF_SUBMIT_METHODS = new Set<DivinationFormMethod>([
  'ssgw',
  'liuyao',
  'meihua',
  'xiaoliuren',
  'qimen',
  'liuren',
  'jinkoujue',
  'taiyi',
  'huangji-jingshi',
  'wuyun-liuqi',
  'zhuge',
  'tarot',
  'lenormand',
]);

export function toBeijingPartsFromDate(date: Date) {
  const b = new Date(date.getTime() + 8 * 3_600_000);
  const year = b.getUTCFullYear();
  const month = b.getUTCMonth() + 1;
  const day = b.getUTCDate();
  const hour = b.getUTCHours();
  const minute = b.getUTCMinutes();
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    year,
    month,
    day,
    hour,
    minute,
    dateStr: `${year}-${p(month)}-${p(day)}`,
    timeStr: `${p(hour)}:${p(minute)}`,
  };
}

export interface DivinationFormStateSnapshot {
  method: DivinationFormMethod;
  nowYear: number;
  timeMode: 'current' | 'custom';
  customDate: string;
  customTime: string;
  liveNowDate: Date;
  useTrueSolar: boolean;
  placeLongitude: number;
  liuyaoCastMode: 'coins' | 'manual' | 'yarrow' | 'time';
  liuyaoCoinThrows: CoinThrow[];
  liuyaoManualYaos: Array<6 | 7 | 8 | 9>;
  liuyaoYarrowYaos: Array<6 | 7 | 8 | 9>;
  meihuaCastMode: 'time' | 'number' | 'character' | 'sound' | 'direction';
  meihuaNumber: string;
  meihuaCharText: string;
  meihuaSoundCount: string;
  meihuaDirection: string;
  meihuaObjectType: string;
  qimenMethod: 'zhuanpan' | 'feipan';
  qimenScope: 'hour' | 'day' | 'month' | 'year';
  liurenGuiRenTable: 'jia-wu-geng-chou-wei' | 'jia-yang-wu-geng-niu';
  jinkoujueMode: 'time' | 'branch' | 'number' | 'random';
  jinkoujueBranch: string;
  jinkoujueNumber: string;
  taiyiScope: 'year' | 'month' | 'day' | 'hour';
  taiyiYear: string;
  xiaoliurenRule: 'common' | 'duoneng';
  xiaoliurenMode: 'time' | 'numbers';
  xiaoliurenNumbers: [string, string, string];
  huangjiMode: 'year' | 'datetime' | 'six-day';
  huangjiYear: string;
  wuyunYear: string;
  tarotDeckScope: 'all' | 'major';
  tarotSpreadId: string;
  tarotDrawMode: 'interactive' | 'random' | 'manual';
  tarotReversalMode: 'realistic' | 'balanced' | 'upright-only';
  tarotDrawnCards: DrawnCardItem[];
  lenormandSpreadId: string;
  lenormandDrawMode: 'interactive' | 'random' | 'manual';
  lenormandDrawnCards: DrawnCardItem[];
  zhugeCastMode: 'text' | 'numbers' | 'coins';
  zhugeChars: [string, string, string];
  zhugeNumbers: [string, string, string];
  kongmingCoins: Array<'●' | '○'>;
  ssgwMode: 'interactive' | 'manual' | 'random';
  ssgwNumber: string;
  ssgwConfirmed: boolean;
  almanacTopic: string;
  almanacCustomKeyword: string;
  almanacStartDate: string;
  almanacEndDate: string;
  almanacWeekendPref: 'any' | 'prefer' | 'avoid';
  almanacTimePrefs: Array<'work-hours' | 'morning' | 'afternoon'>;
  almanacParticipants: AlmanacParticipantDraft[];
  fengshuiOrientationKind: 'mountain' | 'degree';
  fengshuiSitMountain: string;
  fengshuiDegree: number;
  fengshuiConstructionYear: number;
  fengshuiFlowYear: number;
  fengshuiMode: '下卦' | '替卦';
  fengshuiPersonYear: string;
  fengshuiPersonGender: 'male' | 'female';
}

export function buildDivinationPayload(s: DivinationFormStateSnapshot): Record<string, unknown> {
  const question = getDefaultQuestionForMethod(s.method);
  const divinationTimeIso =
    s.timeMode === 'custom'
      ? toBeijingIso(s.customDate, s.customTime)
      : s.liveNowDate.toISOString();
  const solarArgs = s.useTrueSolar
    ? { timeStandard: 'true-solar', longitude: s.placeLongitude }
    : { timeStandard: 'beijing' };

  switch (s.method) {
    case 'liuyao': {
      const liuyaoObj: Record<string, unknown> = { ...solarArgs };
      let dt: string | undefined;
      if (s.liuyaoCastMode === 'time') {
        liuyaoObj.method = 'time';
        dt = divinationTimeIso;
      } else if (s.liuyaoCastMode === 'coins') {
        liuyaoObj.method = 'coins';
        if (s.liuyaoCoinThrows.length === 6) {
          liuyaoObj.coinThrows = s.liuyaoCoinThrows.map((item) => ({
            coins: [...item.coins],
            total: item.total,
          }));
        }
      } else if (s.liuyaoCastMode === 'manual') {
        liuyaoObj.method = 'manual';
        liuyaoObj.yaos = [...s.liuyaoManualYaos];
      } else if (s.liuyaoYarrowYaos.length === 6) {
        liuyaoObj.method = 'manual';
        liuyaoObj.yaos = [...s.liuyaoYarrowYaos];
      } else {
        liuyaoObj.method = 'yarrow';
      }
      return {
        question,
        ...(dt ? { divinationTime: dt } : {}),
        liuyao: liuyaoObj,
      };
    }

    case 'meihua': {
      const meihuaObj: Record<string, unknown> = { ...solarArgs };
      if (s.meihuaCastMode === 'time') {
        meihuaObj.method = 'time';
      } else if (s.meihuaCastMode === 'number') {
        meihuaObj.method = 'number';
        meihuaObj.number = Math.max(1, Number.parseInt(s.meihuaNumber, 10) || 1);
      } else if (s.meihuaCastMode === 'character') {
        meihuaObj.method = 'character';
        meihuaObj.characterText = s.meihuaCharText.trim();
      } else if (s.meihuaCastMode === 'sound') {
        meihuaObj.method = 'sound';
        meihuaObj.soundCount = Math.max(1, Number.parseInt(s.meihuaSoundCount, 10) || 3);
      } else if (s.meihuaCastMode === 'direction') {
        meihuaObj.method = 'direction';
        meihuaObj.direction = s.meihuaDirection;
        meihuaObj.objectType = s.meihuaObjectType;
      }
      return {
        question,
        divinationTime: divinationTimeIso,
        meihua: meihuaObj,
      };
    }

    case 'qimen': {
      const scopeToPrompt: Record<string, string> = {
        hour: 'hourly',
        day: 'daily',
        month: 'monthly',
        year: 'yearly',
      };
      return {
        question,
        divinationTime: divinationTimeIso,
        qimen: {
          method: s.qimenMethod,
          scope: s.qimenScope,
          ...solarArgs,
        },
        prompt: { scope: scopeToPrompt[s.qimenScope] },
      };
    }

    case 'liuren': {
      return {
        question,
        divinationTime: divinationTimeIso,
        liuren: {
          ...solarArgs,
          guiRenTable: s.liurenGuiRenTable,
        },
      };
    }

    case 'jinkoujue': {
      const jkj: Record<string, unknown> = {
        method: s.jinkoujueMode,
        ...solarArgs,
      };
      if (s.jinkoujueMode === 'branch') jkj.branch = s.jinkoujueBranch;
      if (s.jinkoujueMode === 'number') {
        jkj.number = Math.max(1, Number.parseInt(s.jinkoujueNumber, 10) || 7);
      }
      return {
        question,
        divinationTime: divinationTimeIso,
        jinkoujue: jkj,
      };
    }

    case 'taiyi': {
      const scopeMap: Record<string, string> = {
        year: 'yearly',
        month: 'monthly',
        day: 'daily',
        hour: 'hourly',
      };
      if (s.taiyiScope === 'year') {
        return {
          question,
          taiyi: {
            scope: 'year',
            year: Math.min(2200, Math.max(1900, Number.parseInt(s.taiyiYear, 10) || s.nowYear)),
          },
          prompt: { scope: 'yearly' },
        };
      }
      return {
        question,
        taiyi: {
          scope: s.taiyiScope,
          date: divinationTimeIso,
          ...solarArgs,
        },
        prompt: { scope: scopeMap[s.taiyiScope] },
      };
    }

    case 'xiaoliuren': {
      if (s.xiaoliurenMode === 'numbers') {
        const nums = s.xiaoliurenNumbers.map((raw) => Math.max(1, Number.parseInt(raw, 10) || 1)) as [
          number,
          number,
          number,
        ];
        return {
          question,
          xiaoliuren: { rule: s.xiaoliurenRule, numbers: nums, ...solarArgs },
        };
      }
      return {
        question,
        divinationTime: divinationTimeIso,
        xiaoliuren: { rule: s.xiaoliurenRule, ...solarArgs },
      };
    }

    case 'huangji-jingshi': {
      if (s.huangjiMode === 'year') {
        const y = Number.parseInt(s.huangjiYear, 10) || s.nowYear;
        return {
          question,
          huangji: { mode: 'year', year: y === 0 ? 1 : y },
        };
      }
      if (s.huangjiMode === 'six-day') {
        return {
          question,
          huangji: {
            mode: 'six-day',
            dateTime: divinationTimeIso,
            calendarModel: 'six-day-seven-part',
            timezone: 8,
          },
        };
      }
      return {
        question,
        huangji: {
          mode: 'datetime',
          date: divinationTimeIso,
          ...solarArgs,
        },
      };
    }

    case 'wuyun-liuqi': {
      return {
        question,
        wuyun: {
          year: Math.min(9999, Math.max(1, Number.parseInt(s.wuyunYear, 10) || s.nowYear)),
        },
      };
    }

    case 'tarot': {
      const spreadInfo =
        TAROT_SPREAD_LIST.find((sp) => sp.id === s.tarotSpreadId) ?? TAROT_SPREAD_LIST[1]!;
      const tarotObj: Record<string, unknown> = {
        spread: spreadInfo.id,
        ...(s.tarotDeckScope === 'major' ? { deckScope: 'major' } : {}),
      };
      if (s.tarotDrawMode !== 'random' && s.tarotDrawnCards.length === spreadInfo.cardCount) {
        tarotObj.manualCards = s.tarotDrawnCards.map((c) => ({
          id: c.id,
          reversed: Boolean(c.reversed),
        }));
        tarotObj.selectionMode = s.tarotDrawMode;
      } else if (s.tarotDrawMode === 'random') {
        tarotObj.reversalMode = s.tarotReversalMode;
      }
      return { question, tarot: tarotObj };
    }

    case 'lenormand': {
      const spreadInfo =
        LENORMAND_SPREAD_LIST.find((sp) => sp.id === s.lenormandSpreadId) ??
        LENORMAND_SPREAD_LIST[1]!;
      const lenObj: Record<string, unknown> = { spread: spreadInfo.id };
      if (
        s.lenormandDrawMode !== 'random' &&
        s.lenormandDrawnCards.length === spreadInfo.cardCount
      ) {
        lenObj.manualCardIds = s.lenormandDrawnCards.map((c) => c.id);
        lenObj.selectionMode = s.lenormandDrawMode;
      }
      return { question, lenormand: lenObj };
    }

    case 'zhuge': {
      if (s.zhugeCastMode === 'coins') {
        return {
          question,
          zhuge: { method: 'coins', pattern: s.kongmingCoins.join('') },
        };
      }
      if (s.zhugeCastMode === 'numbers') {
        const numbers = s.zhugeNumbers.map((raw) => {
          const num = Number.parseInt(raw, 10);
          return Number.isNaN(num) ? 0 : Math.abs(num);
        }) as [number, number, number];
        return {
          question,
          zhuge: { method: 'numbers', numbers },
        };
      }
      const text = s.zhugeChars.map((c) => c.trim() || '定').join('');
      return {
        question,
        zhuge: { method: 'text', text: [...text].slice(0, 3).join('').padEnd(3, '乾') },
      };
    }

    case 'ssgw': {
      if (s.ssgwMode === 'manual') {
        const num = Math.min(92, Math.max(1, Number.parseInt(s.ssgwNumber, 10) || 36));
        return {
          question,
          ssgw: { method: 'manual', number: num },
        };
      }
      if (s.ssgwMode === 'interactive' && s.ssgwNumber) {
        const num = Math.min(92, Math.max(1, Number.parseInt(s.ssgwNumber, 10) || 36));
        return {
          question,
          ssgw: { method: 'manual', number: num },
        };
      }
      return {
        question,
        ssgw: { method: 'random' },
      };
    }

    case 'random-divination': {
      return { question };
    }

    case 'almanac': {
      const validParticipants = s.almanacParticipants
        .filter((p) => p.year && p.month && p.day)
        .map((p, idx) => ({
          name: p.name.trim() || `参与人${idx + 1}`,
          birth: {
            year: Math.min(2100, Math.max(1900, Number.parseInt(p.year, 10) || 1990)),
            month: Math.min(12, Math.max(1, Number.parseInt(p.month, 10) || 1)),
            day: Math.min(31, Math.max(1, Number.parseInt(p.day, 10) || 1)),
            calendar: p.calendar,
            clock:
              p.shichenIndex === ''
                ? { kind: 'unknown' as const }
                : { kind: 'shichen' as const, index: Number.parseInt(p.shichenIndex, 10) || 0 },
            timezone: 8,
          },
        }));
      return {
        question,
        topic: s.almanacTopic,
        ...(s.almanacTopic === 'custom'
          ? { customKeyword: s.almanacCustomKeyword.trim() || '祈福' }
          : {}),
        startDate: s.almanacStartDate,
        endDate: s.almanacEndDate >= s.almanacStartDate ? s.almanacEndDate : s.almanacStartDate,
        weekendPreference: s.almanacWeekendPref,
        ...(s.almanacTimePrefs.length ? { timePreferences: [...s.almanacTimePrefs] } : {}),
        ...(validParticipants.length ? { participants: validParticipants } : {}),
      };
    }

    case 'bazhai': {
      const yearNum = Math.min(
        2100,
        Math.max(1900, Number.parseInt(s.fengshuiPersonYear, 10) || 1990),
      );
      const house =
        s.fengshuiOrientationKind === 'mountain'
          ? { kind: 'mountain' as const, sitMountain: s.fengshuiSitMountain }
          : {
              kind: 'measurement' as const,
              reading: 'sit' as const,
              degree: s.fengshuiDegree,
              northReference: 'true' as const,
              uncertaintyDegrees: 1,
            };
      return {
        question,
        person: { kind: 'birth', year: yearNum, gender: s.fengshuiPersonGender },
        house,
      };
    }

    case 'xuankong': {
      const orientation =
        s.fengshuiOrientationKind === 'mountain'
          ? { kind: 'mountain' as const, sitMountain: s.fengshuiSitMountain }
          : {
              kind: 'degree' as const,
              reading: 'sit' as const,
              degree: s.fengshuiDegree,
              northReference: 'true' as const,
              uncertaintyDegrees: 1,
            };
      return {
        question,
        construction: { year: s.fengshuiConstructionYear },
        orientation,
        mode: s.fengshuiMode,
        ...(s.fengshuiMode === '替卦' ? { confirmJianXiang: true } : {}),
        flow: { kind: 'year', year: s.fengshuiFlowYear },
      };
    }

    case 'residential': {
      const yearNum = Math.min(
        2100,
        Math.max(1900, Number.parseInt(s.fengshuiPersonYear, 10) || 1990),
      );
      const orientation =
        s.fengshuiOrientationKind === 'mountain'
          ? { kind: 'mountain' as const, sitMountain: s.fengshuiSitMountain }
          : {
              kind: 'degree' as const,
              reading: 'sit' as const,
              degree: s.fengshuiDegree,
              northReference: 'true' as const,
              uncertaintyDegrees: 1,
            };
      return {
        question,
        person: { kind: 'birth', year: yearNum, gender: s.fengshuiPersonGender },
        orientation,
        construction: { year: s.fengshuiConstructionYear },
        mode: s.fengshuiMode,
        ...(s.fengshuiMode === '替卦' ? { confirmJianXiang: true } : {}),
        flow: { kind: 'year', year: s.fengshuiFlowYear },
      };
    }
  }
}

export function validateDivinationFormInput(s: DivinationFormStateSnapshot): string | null {
  if (s.method === 'liuyao') {
    if (s.liuyaoCastMode === 'coins' && s.liuyaoCoinThrows.length < 6) {
      return '请先摇满六爻，或点击「一键连摇」完成起卦。';
    }
    if (s.liuyaoCastMode === 'yarrow' && s.liuyaoYarrowYaos.length < 6) {
      return '请先演满六爻，或点击「连演六爻」完成起卦。';
    }
  }
  if (s.method === 'meihua') {
    if (s.meihuaCastMode === 'number' && !s.meihuaNumber.trim()) {
      return '请先输入起卦数字。';
    }
    if (s.meihuaCastMode === 'character' && !s.meihuaCharText.trim()) {
      return '请先输入要测算的汉字。';
    }
    if (s.meihuaCastMode === 'sound' && !s.meihuaSoundCount.trim()) {
      return '请先输入声响次数。';
    }
  }
  if (s.method === 'jinkoujue' && s.jinkoujueMode === 'number' && !s.jinkoujueNumber.trim()) {
    return '请先输入起课数字。';
  }
  if (s.method === 'xiaoliuren' && s.xiaoliurenMode === 'numbers') {
    const valid = s.xiaoliurenNumbers.every((raw) => {
      const n = Number.parseInt(raw, 10);
      return Number.isInteger(n) && n >= 1;
    });
    if (!valid) {
      return '请先填齐三个正整数后再起课。';
    }
  }
  if (s.method === 'zhuge') {
    if (s.zhugeCastMode === 'text' && !s.zhugeChars.every((c) => Boolean(c.trim()))) {
      return '请先填齐三个汉字后再点击起卦。';
    }
    if (s.zhugeCastMode === 'numbers' && !s.zhugeNumbers.every((n) => Boolean(n.trim()))) {
      return '请先填齐三个起卦数字后再点击起卦。';
    }
  }
  if (s.method === 'tarot' && s.tarotDrawMode === 'interactive') {
    const spreadInfo =
      TAROT_SPREAD_LIST.find((sp) => sp.id === s.tarotSpreadId) ?? TAROT_SPREAD_LIST[1]!;
    if (s.tarotDrawnCards.length < spreadInfo.cardCount) {
      return `请先抽取全部 ${spreadInfo.cardCount} 张牌后，再点击「开始占卜」。`;
    }
  }
  if (s.method === 'lenormand' && s.lenormandDrawMode === 'interactive') {
    const spreadInfo =
      LENORMAND_SPREAD_LIST.find((sp) => sp.id === s.lenormandSpreadId) ??
      LENORMAND_SPREAD_LIST[1]!;
    if (s.lenormandDrawnCards.length < spreadInfo.cardCount) {
      return `请先抽取全部 ${spreadInfo.cardCount} 张牌后，再点击「开始占卜」。`;
    }
  }
  if (s.method === 'ssgw' && s.ssgwMode === 'interactive' && !s.ssgwConfirmed) {
    return '请先摇动签筒并掷得圣杯确认，再点击「开始占卜」。';
  }
  if (s.method === 'ssgw' && s.ssgwMode === 'manual') {
    const n = Number.parseInt(s.ssgwNumber, 10);
    if (!Number.isInteger(n) || n < 1 || n > 92) {
      return '请输入 1 到 92 之间的签号。';
    }
  }
  return null;
}
