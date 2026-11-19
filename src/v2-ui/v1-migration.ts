import { methodLabels } from '../schema';

export const V1_STORAGE_KEYS = {
  personalHistory: 'prompt_studio_personal_history_v1',
  compatibilityHistory: 'prompt_studio_compatibility_history_v1',
  divinationHistory: 'prompt_studio_divination_history_v1',
  activeCaseId: 'mingyu_active_personal_case_v1',
  aiSettings: 'mingyu:ai-settings:v1',
} as const;

export const V2_MIGRATION_FLAG_KEY = 'mingyu.v2.migratedFromV1';

const V1_METHOD_ALIASES: Record<string, string> = {
  ba_zhai: 'bazhai',
  xuan_kong: 'xuankong',
  qi_zheng: 'qizheng',
  residential_fengshui: 'residential',
  kongming: 'zhuge',
  'tarot-major': 'tarot',
  huangji: 'huangji-jingshi',
  wuyun: 'wuyun-liuqi',
};

function normalizeMethodId(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return V1_METHOD_ALIASES[trimmed] ?? trimmed;
}

function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // 忽略隐私模式或配额不足
  }
}

function parseArray(raw: string | null): unknown[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractPartnerDraft(inputObj: Record<string, unknown>): Record<string, unknown> {
  return {
    id: `partner_${Date.now().toString(36)}`,
    name: typeof inputObj.partnerName === 'string' ? inputObj.partnerName : '命主二',
    gender: inputObj.partnerGender === 'female' ? 'female' : 'male',
    calendar: inputObj.partnerDateType === 'lunar' ? 'lunar' : 'solar',
    dateType: inputObj.partnerDateType === 'lunar' ? 'lunar' : 'solar',
    isLeapMonth: Boolean(inputObj.partnerIsLeapMonth),
    year: inputObj.partnerYear ?? '1990',
    month: inputObj.partnerMonth ?? '1',
    day: inputObj.partnerDay ?? '1',
    timeIndex: inputObj.partnerTimeIndex ?? '',
    useTrueSolarTime: Boolean(inputObj.partnerUseTrueSolarTime),
    birthHour: inputObj.partnerBirthHour ?? '',
    birthMinute: inputObj.partnerBirthMinute ?? '',
    birthSecond: inputObj.partnerBirthSecond ?? '',
    birthPlace: typeof inputObj.partnerBirthPlace === 'string' ? inputObj.partnerBirthPlace : '',
    longitude: inputObj.partnerBirthLongitude,
    latitude: inputObj.partnerBirthLatitude,
  };
}

function extractPrimaryDraft(inputObj: Record<string, unknown>, nameFallback: string): Record<string, unknown> {
  return {
    id: `primary_${Date.now().toString(36)}`,
    name: typeof inputObj.name === 'string' && inputObj.name.trim() ? inputObj.name : nameFallback,
    gender: inputObj.gender === 'female' ? 'female' : 'male',
    calendar: inputObj.dateType === 'lunar' ? 'lunar' : 'solar',
    dateType: inputObj.dateType === 'lunar' ? 'lunar' : 'solar',
    isLeapMonth: Boolean(inputObj.isLeapMonth),
    year: inputObj.year ?? '1990',
    month: inputObj.month ?? '1',
    day: inputObj.day ?? '1',
    timeIndex: inputObj.timeIndex ?? '',
    useTrueSolarTime: Boolean(inputObj.useTrueSolarTime),
    birthHour: inputObj.birthHour ?? '',
    birthMinute: inputObj.birthMinute ?? '',
    birthSecond: inputObj.birthSecond ?? '',
    birthPlace: typeof inputObj.birthPlace === 'string' ? inputObj.birthPlace : '',
    longitude: inputObj.birthLongitude,
    latitude: inputObj.birthLatitude,
  };
}

export interface MigrationReport {
  personalCasesImported: number;
  compatibilityImported: number;
  divinationImported: number;
  aiSettingsImported: boolean;
}

/**
 * 将 V1 浏览器本地档案、合盘记录、占卜记录与自定义 AI 接口设置无损迁移至 V2 存储键；
 * 全程只读 V1 数据、不删除原记录，并支持幂等重复调用。
 */
export function migrateV1StorageData(
  storage: Storage | undefined = typeof localStorage !== 'undefined' ? localStorage : undefined,
  normalizeCaseFn?: (raw: unknown) => Record<string, unknown> | null,
): MigrationReport {
  const report: MigrationReport = {
    personalCasesImported: 0,
    compatibilityImported: 0,
    divinationImported: 0,
    aiSettingsImported: false,
  };
  if (!storage) return report;
  if (safeGet(storage, V2_MIGRATION_FLAG_KEY) === '1') return report;

  // 1. 个人档案（prompt_studio_personal_history_v1 -> mingyu.v2.personal.cases）
  const v1Cases = parseArray(safeGet(storage, V1_STORAGE_KEYS.personalHistory));
  if (v1Cases.length > 0) {
    const existingV2 = parseArray(safeGet(storage, 'mingyu.v2.personal.cases'));
    const existingIds = new Set(
      existingV2
        .map((item) => (item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined))
        .filter((id): id is string => typeof id === 'string'),
    );
    const merged = [...existingV2];
    for (const raw of v1Cases) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id.trim() : '';
      if (!id || existingIds.has(id)) continue;
      const normalized = normalizeCaseFn ? normalizeCaseFn(raw) : raw;
      if (normalized) {
        merged.push(normalized);
        existingIds.add(id);
        report.personalCasesImported++;
      }
    }
    if (report.personalCasesImported > 0) {
      safeSet(storage, 'mingyu.v2.personal.cases', JSON.stringify(merged.slice(0, 200)));
    }
  }

  // 2. 当前选中档案 ID
  const v1Active = safeGet(storage, V1_STORAGE_KEYS.activeCaseId)?.trim();
  if (v1Active && !safeGet(storage, 'mingyu.v2.activeCaseId')) {
    safeSet(storage, 'mingyu.v2.activeCaseId', v1Active);
  }

  // 3. 双人合盘历史
  const v1Compat = parseArray(safeGet(storage, V1_STORAGE_KEYS.compatibilityHistory));
  if (v1Compat.length > 0) {
    const existingV2 = parseArray(safeGet(storage, 'mingyu.v2.compatibility.records'));
    const existingIds = new Set(
      existingV2
        .map((item) => (item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined))
        .filter((id): id is string => typeof id === 'string'),
    );
    const merged = [...existingV2];
    for (const raw of v1Compat) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id.trim() : '';
      const inputObj = obj.input && typeof obj.input === 'object' ? (obj.input as Record<string, unknown>) : null;
      if (!id || !inputObj || existingIds.has(id)) continue;
      const p1Raw = extractPrimaryDraft(inputObj, typeof obj.primaryName === 'string' ? obj.primaryName : '命主一');
      const p2Raw = extractPartnerDraft(inputObj);
      const person1 = normalizeCaseFn ? normalizeCaseFn(p1Raw) : p1Raw;
      const person2 = normalizeCaseFn ? normalizeCaseFn(p2Raw) : p2Raw;
      if (!person1 || !person2) continue;
      const chartType = normalizeMethodId(inputObj.chartType);
      const method =
        chartType === 'ziwei'
          ? 'ziwei-synastry'
          : chartType === 'astrolabe'
            ? 'astrolabe-synastry'
            : 'bazi-synastry';
      const now = typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString();
      merged.push({
        id,
        type: 'compatibility',
        name: typeof obj.name === 'string' ? obj.name : `${person1.name} 和 ${person2.name}`,
        primaryName: typeof obj.primaryName === 'string' ? obj.primaryName : String(person1.name ?? '命主一'),
        partnerName: typeof obj.partnerName === 'string' ? obj.partnerName : String(person2.name ?? '命主二'),
        person1,
        person2,
        method,
        pinned: Boolean(obj.pinned),
        createdAt: now,
        updatedAt: now,
      });
      existingIds.add(id);
      report.compatibilityImported++;
    }
    if (report.compatibilityImported > 0) {
      safeSet(storage, 'mingyu.v2.compatibility.records', JSON.stringify(merged.slice(0, 100)));
    }
  }

  // 4. 占卜 / 即时盘历史
  const v1Divs = parseArray(safeGet(storage, V1_STORAGE_KEYS.divinationHistory));
  if (v1Divs.length > 0) {
    const existingV2 = parseArray(safeGet(storage, 'mingyu.v2.history.records'));
    const existingIds = new Set(
      existingV2
        .map((item) => (item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined))
        .filter((id): id is string => typeof id === 'string'),
    );
    const merged = [...existingV2];
    for (const raw of v1Divs) {
      if (!raw || typeof raw !== 'object') continue;
      const obj = raw as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id.trim() : '';
      if (!id || existingIds.has(id)) continue;
      const type = obj.type === 'instant' ? 'instant' : 'divination';
      const rawMethod =
        type === 'instant'
          ? 'instant'
          : normalizeMethodId(obj.method) ?? normalizeMethodId(obj.requestedMethod);
      if (!rawMethod) continue;
      const methodLabel = (methodLabels as Record<string, string>)[rawMethod] ?? rawMethod;
      const updatedAt = typeof obj.updatedAt === 'string' ? obj.updatedAt : new Date().toISOString();
      const inputJson =
        typeof obj.inputJson === 'string'
          ? obj.inputJson
          : obj.draft && typeof obj.draft === 'object'
            ? JSON.stringify(obj.draft)
            : '{}';
      merged.push({
        id,
        type,
        method: rawMethod,
        methodLabel,
        ...(typeof obj.requestedMethod === 'string' ? { requestedMethod: normalizeMethodId(obj.requestedMethod) } : {}),
        question: typeof obj.question === 'string' && obj.question.trim() ? obj.question.trim() : '综合排盘分析',
        ...(typeof obj.supplementaryInfo === 'string' ? { supplementaryInfo: obj.supplementaryInfo } : {}),
        ...(typeof obj.caseId === 'string' ? { caseId: obj.caseId } : {}),
        ...(typeof obj.caseName === 'string' ? { caseName: obj.caseName } : {}),
        ...(typeof obj.instantType === 'string' ? { instantType: obj.instantType } : {}),
        ...(obj.timeStandard === 'true-solar' || obj.timeStandard === 'beijing' ? { timeStandard: obj.timeStandard } : {}),
        inputJson,
        pinned: false,
        createdAt: updatedAt,
        updatedAt,
      });
      existingIds.add(id);
      report.divinationImported++;
    }
    if (report.divinationImported > 0) {
      safeSet(storage, 'mingyu.v2.history.records', JSON.stringify(merged.slice(0, 50)));
    }
  }

  // 5. AI 接口自定义设置（仅当 V2 尚未配置时迁移）
  const rawAi = safeGet(storage, V1_STORAGE_KEYS.aiSettings);
  if (rawAi) {
    try {
      const parsed = JSON.parse(rawAi) as {
        enabled?: unknown;
        mode?: unknown;
        baseUrl?: unknown;
        apiKey?: unknown;
        model?: unknown;
      };
      const hasV2Ai = Boolean(safeGet(storage, 'mingyu.v2.ai.baseUrl') || safeGet(storage, 'mingyu.v2.ai.model'));
      if (
        !hasV2Ai &&
        parsed &&
        typeof parsed === 'object' &&
        parsed.mode !== 'builtin' &&
        typeof parsed.baseUrl === 'string' &&
        parsed.baseUrl.trim() &&
        typeof parsed.model === 'string' &&
        parsed.model.trim()
      ) {
        safeSet(storage, 'mingyu.v2.ai.baseUrl', parsed.baseUrl.trim());
        safeSet(storage, 'mingyu.v2.ai.model', parsed.model.trim());
        if (typeof parsed.apiKey === 'string' && parsed.apiKey.trim()) {
          safeSet(storage, 'mingyu.v2.ai.apiKey', parsed.apiKey.trim());
        }
        if (parsed.enabled === true) {
          safeSet(storage, 'mingyu.v2.ai.webEnabled', 'true');
        }
        report.aiSettingsImported = true;
      }
    } catch {
      // ignore invalid JSON
    }
  }

  safeSet(storage, V2_MIGRATION_FLAG_KEY, '1');
  return report;
}
