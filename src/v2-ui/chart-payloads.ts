import { LunarDay } from 'tyme4ts';
import { mountains } from '../systems/compass';
import type { SynastryRelationship } from '../systems/focus-presets';
import { inferFortuneScope } from '../router-model/fortune-scope';
import { toV2BirthPayload } from './case-birth';
import type { PersonalCase } from './cases-store';
import {
  COMPATIBILITY_CHART_TABS,
  DIVINATION_FORM_METHODS,
  PERSONAL_CHART_TABS,
  isCompatibilityChartMethod,
  isDivinationFormMethod,
  isPersonalChartMethod,
  type CompatibilityChartTabId,
  type DivinationFormMethod,
  type PersonalChartTabId,
} from './chart-tabs';

export {
  COMPATIBILITY_CHART_TABS,
  DIVINATION_FORM_METHODS,
  PERSONAL_CHART_TABS,
  isCompatibilityChartMethod,
  isDivinationFormMethod,
  isPersonalChartMethod,
  type CompatibilityChartTabId,
  type DivinationFormMethod,
  type PersonalChartTabId,
};

function wholeSecondIsoNow(): string {
  return new Date(Math.floor(Date.now() / 1000) * 1000).toISOString().replace('.000Z', 'Z');
}

function toIsoBeijingRangeEndpoint(value: string): string {
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(trimmed);
  return match ? `${match[1]}T${match[2]}+08:00` : trimmed;
}

/**
 * 根据当前 PersonalCase 与目标盘面 Tab 构建 V2 calculate() 输入参数。
 */
export function buildPersonalChartPayload(
  person: PersonalCase,
  tabId: PersonalChartTabId | 'bazhai',
  questionText?: string,
  options?: {
    bazhaiSitMountain?: string;
    flowYear?: number | null;
  },
): Record<string, unknown> {
  const question = questionText?.trim() || '请综合分析此命盘的核心结构、优势短板与阶段运势。';
  const hasKnownTime = person.timeIndex !== 'unknown';
  const refIso = wholeSecondIsoNow();
  const flowYear =
    typeof options?.flowYear === 'number' && Number.isInteger(options.flowYear)
      ? options.flowYear
      : null;
  const flowRefIso = flowYear ? `${flowYear}-06-15T12:00:00+08:00` : refIso;
  const sitMountain =
    options?.bazhaiSitMountain && mountains.includes(options.bazhaiSitMountain)
      ? options.bazhaiSitMountain
      : '子';

  switch (tabId) {
    case 'bazi': {
      if (person.reverseSource) {
        return {
          question,
          birthRange: {
            start: toIsoBeijingRangeEndpoint(person.reverseSource.intervalStart),
            end: toIsoBeijingRangeEndpoint(person.reverseSource.intervalEnd),
            timezone: 8,
            pillars: person.reverseSource.pillars,
          },
          gender: person.gender,
        };
      }
      const birth = toV2BirthPayload(person, {
        method: 'bazi',
        forcePreciseBirthPlace: hasKnownTime,
      });
      return {
        question,
        birth,
        gender: person.gender,
        ...(birth.clock.kind === 'exact'
          ? {
              referenceTime: flowRefIso,
              ...(flowYear ? { timelineYear: flowYear } : {}),
            }
          : {}),
      };
    }
    case 'ziwei': {
      const birth = toV2BirthPayload(person, {
        method: 'ziwei',
        forcePreciseBirthPlace: hasKnownTime,
      });
      return {
        question,
        birth,
        gender: person.gender,
        referenceTime: flowRefIso,
      };
    }
    case 'bazi-ziwei': {
      const birth = toV2BirthPayload(person, {
        method: 'bazi-ziwei',
        forcePreciseBirthPlace: hasKnownTime,
      });
      return {
        question,
        birth,
        gender: person.gender,
        ...(birth.clock.kind === 'exact' ? { referenceTime: flowRefIso } : {}),
      };
    }
    case 'qimen-lifetime': {
      const birth = toV2BirthPayload(person, { method: 'qimen-lifetime' });
      return {
        question,
        birth,
        gender: person.gender,
        stagePolicy: { model: 'decadalGanzhi' },
      };
    }
    case 'astrolabe': {
      const birth = toV2BirthPayload(person, { method: 'astrolabe' });
      return {
        question,
        birth,
        ...(flowYear ? { flow: { reference: { kind: 'year', year: flowYear } } } : {}),
      };
    }
    case 'qizheng': {
      const birth = toV2BirthPayload(person, { method: 'qizheng' });
      return {
        question,
        birth,
        ...(flowYear
          ? {
              gender: person.gender,
              flow: { kind: 'year', year: flowYear },
            }
          : {}),
      };
    }
    case 'bazhai': {
      const rawYear = Math.trunc(Number(person.year) || 1990);
      const rawMonth = Math.min(12, Math.max(1, Math.trunc(Number(person.month) || 1)));
      const rawDay = Math.min(31, Math.max(1, Math.trunc(Number(person.day) || 1)));
      let year = rawYear;
      let month = rawMonth;
      let day = rawDay;
      const isLunar = (person.calendar ?? person.dateType) === 'lunar';
      if (isLunar) {
        try {
          const solar = LunarDay.fromYmd(
            rawYear,
            person.isLeapMonth ? -rawMonth : rawMonth,
            rawDay,
          ).getSolarDay();
          year = solar.getYear();
          month = solar.getMonth();
          day = solar.getDay();
        } catch {
          // 转换失败时回退原始年月日
        }
      }
      return {
        question,
        person: {
          kind: 'birth',
          year,
          month,
          day,
          gender: person.gender,
          timezone: 8,
        },
        house: {
          kind: 'mountain',
          sitMountain,
        },
      };
    }
    case 'minglu': {
      const birth = toV2BirthPayload(person, {
        method: 'minglu',
        forcePreciseBirthPlace: hasKnownTime,
      });
      return {
        question,
        birth,
        gender: person.gender,
        ...(birth.clock.kind === 'exact' ? { referenceTime: refIso } : {}),
        location: {
          latitude: person.latitude ?? 39.9042,
          longitude: person.longitude ?? 116.4074,
          ...(person.birthPlace ? { locationName: person.birthPlace } : {}),
        },
      };
    }
  }
}

export type SyncYearsPreset = 'none' | 'next3' | 'next5' | 'around5' | 'next10';

export function resolveSyncYearsRange(
  preset: SyncYearsPreset,
  baseYear: number,
): { startYear: number; endYear: number } | null {
  if (preset === 'none') return null;
  const clampYear = (y: number) => Math.min(2100, Math.max(1900, Math.trunc(y)));
  let startYear = baseYear;
  let endYear = baseYear;
  if (preset === 'next3') {
    endYear = baseYear + 2;
  } else if (preset === 'next5') {
    endYear = baseYear + 4;
  } else if (preset === 'around5') {
    startYear = baseYear - 2;
    endYear = baseYear + 2;
  } else if (preset === 'next10') {
    endYear = baseYear + 9;
  }
  startYear = clampYear(startYear);
  endYear = clampYear(endYear);
  if (endYear < startYear) endYear = startYear;
  if (endYear - startYear > 9) endYear = startYear + 9;
  return { startYear, endYear };
}

export function inferCompatibilityFlowFromQuestion(
  question: string,
  baseYear = new Date().getFullYear(),
): { flowYear: number | null; syncYears: { startYear: number; endYear: number } | null } {
  const scope = inferFortuneScope(question, baseYear);
  const clampYear = (y: number) => Math.min(2100, Math.max(1900, Math.trunc(y)));
  const normalizeSpan = (years: number[]): { startYear: number; endYear: number } | null => {
    const sorted = [...new Set(years.map(clampYear))].sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const startYear = sorted[0]!;
    const endYear = Math.min(sorted[sorted.length - 1]!, startYear + 9);
    return { startYear, endYear };
  };

  if (scope.explicitYears.length === 1) {
    return { flowYear: clampYear(scope.explicitYears[0]!), syncYears: null };
  }
  if (scope.explicitYears.length >= 2) {
    const span = normalizeSpan(scope.explicitYears);
    return { flowYear: span?.startYear ?? null, syncYears: span };
  }
  if ((scope.focus === 'medium-term' || scope.focus === 'lifetime') && scope.years.length >= 2) {
    const span = normalizeSpan(scope.years);
    return { flowYear: null, syncYears: span };
  }
  return { flowYear: null, syncYears: null };
}

export function buildCompatibilityChartPayload(
  person1: PersonalCase,
  person2: PersonalCase,
  tabId: CompatibilityChartTabId,
  questionText?: string,
  options?: {
    relationship?: SynastryRelationship;
    flowYear?: number | null;
    syncYears?: { startYear: number; endYear: number } | null;
  },
): Record<string, unknown> {
  const question = questionText?.trim() || '请合参双方命盘的契合度、相处模式与磨合建议。';
  const relationship = options?.relationship ?? 'marriage';
  const p1Known = person1.timeIndex !== 'unknown';
  const p2Known = person2.timeIndex !== 'unknown';
  const p1Exact = p1Known && !person1.reverseSource;
  const p2Exact = p2Known && !person2.reverseSource;
  const inferred = inferCompatibilityFlowFromQuestion(question);
  const flowYear = options?.flowYear ?? inferred.flowYear;
  const flowRefIso = flowYear ? `${flowYear}-06-15T12:00:00+08:00` : wholeSecondIsoNow();
  const syncYears = options?.syncYears ?? inferred.syncYears;

  if (tabId === 'astrolabe-synastry') {
    return {
      question,
      person1: toV2BirthPayload(person1, { method: 'astrolabe-synastry' }),
      person2: toV2BirthPayload(person2, { method: 'astrolabe-synastry' }),
      ...(flowYear ? { referenceTime: flowRefIso } : {}),
      ...(syncYears ? { syncYears } : {}),
    };
  }

  if (tabId === 'ziwei-synastry') {
    const canSync = p1Exact && p2Exact;
    return {
      question,
      person1: {
        name: person1.name || '命主一',
        gender: person1.gender,
        birth: toV2BirthPayload(person1, {
          method: 'ziwei-synastry',
          forcePreciseBirthPlace: p1Known,
        }),
      },
      person2: {
        name: person2.name || '命主二',
        gender: person2.gender,
        birth: toV2BirthPayload(person2, {
          method: 'ziwei-synastry',
          forcePreciseBirthPlace: p2Known,
        }),
      },
      relationship,
      referenceTime: flowRefIso,
      ...(canSync && syncYears ? { syncYears } : {}),
    };
  }

  const b1 = toV2BirthPayload(person1, {
    method: 'bazi-synastry',
    forcePreciseBirthPlace: p1Known,
  });
  const b2 = toV2BirthPayload(person2, {
    method: 'bazi-synastry',
    forcePreciseBirthPlace: p2Known,
  });
  const canBaziFortune =
    p1Exact &&
    p2Exact &&
    b1.clock.kind === 'exact' &&
    b2.clock.kind === 'exact' &&
    Boolean(person1.gender) &&
    Boolean(person2.gender);
  return {
    question,
    person1: {
      ...b1,
      name: person1.name || '命主一',
      gender: person1.gender,
    },
    person2: {
      ...b2,
      name: person2.name || '命主二',
      gender: person2.gender,
    },
    relationship,
    ...(canBaziFortune
      ? {
          referenceTime: flowRefIso,
          ...(syncYears ? { syncYears } : {}),
        }
      : {}),
  };
}
