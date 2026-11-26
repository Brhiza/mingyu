/**
 * 面向站内 Agent、MCP Router 与 CLI 的宽松工具入参自动归一化层（G1）。
 *
 * 设计原则：
 * 1. 不改动底层 `calculate()` 的严格 Zod 校验契约，仅在 Agent / 工具适配层做无损纠偏；
 * 2. 专门化解在线大模型调用 39 种术数工具时最高频的 6 类参数格式失误：
 *    - 性别中文/简写（男/女/乾造/坤造/M/F -> male/female）
 *    - 自然日期时间字符串（"1992-05-12 10:30" / "1992年5月12日10点半" -> 标准 birth 对象）
 *    - 东方命盘（clock 对象）与星占命盘（扁平 hour/minute + 经纬度）的双向格式互转
 *    - 缺省 timezone / second / latitude / longitude / question 自动补齐
 *    - 七政四余传了 gender 但未传 flow 时自动剥离多余 gender（避免触发 refine 拒绝）
 *    - `bazi-synastry` / `ziwei-synastry` / `astrolabe-synastry` 自动兼容双人入参简写
 *    - 顶层误放 `includeClassics` 时自动移入 `prompt.includeClassics`
 */
import type { Method } from './schema';
import { NON_CLASSICS_METHODS } from './method-registry';

export interface NormalizeToolInputOptions {
  defaultLongitude?: number;
  defaultLatitude?: number;
  defaultTimezone?: number;
}

const FLAT_ASTRO_BIRTH_METHODS: ReadonlySet<Method> = new Set<Method>([
  'astrolabe',
  'astrolabe-range',
  'qizheng',
  'qizheng-range',
]);

const CLOCK_BIRTH_METHODS: ReadonlySet<Method> = new Set<Method>([
  'bazi',
  'ziwei',
  'bazi-ziwei',
  'qimen-lifetime',
  'minglu',
  'fortune',
]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeGenderValue(value: unknown): 'male' | 'female' | unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().toLowerCase();
  if (['male', 'm', 'man', 'boy', '男', '男性', '乾', '乾造'].includes(trimmed)) return 'male';
  if (['female', 'f', 'woman', 'girl', '女', '女性', '坤', '坤造'].includes(trimmed)) return 'female';
  return value;
}

export function normalizeRelationshipValue(value: unknown): string | unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim().toLowerCase();
  if (['marriage', 'love', 'couple', 'partner', '婚恋', '合婚', '感情', '恋爱', '夫妻', '伴侣'].includes(trimmed)) {
    return 'marriage';
  }
  if (['career', 'business', 'work', 'partnership', '合伙', '商业', '职场', '创业', '合作', '共事'].includes(trimmed)) {
    return 'career';
  }
  if (['friendship', 'friend', '朋友', '友情', '闺蜜', '交友'].includes(trimmed)) return 'friendship';
  if (['parents', 'parent', '父母', '长辈'].includes(trimmed)) return 'parents';
  if (['children', 'child', '亲子', '子女', '孩子'].includes(trimmed)) return 'children';
  if (['siblings', 'sibling', '兄弟姐妹', '手足', '同胞'].includes(trimmed)) return 'siblings';
  return value;
}

interface ParsedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
  second?: number;
  timezone?: number;
  calendar?: 'solar' | 'lunar';
}

function parseLooseDateTimeString(raw: string): ParsedDateTimeParts | null {
  const s = raw.trim();
  if (!s) return null;
  const isLunar = /农历|阴历|lunar/i.test(s);
  // ISO or YYYY-MM-DD[ T]HH:MM(:SS)?(Z|+08:00)?
  const iso =
    /(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})日?(?:[\sT,，]+(\d{1,2})[:点时](\d{1,2})(?:[:分](\d{1,2}))?)?(?:(Z)|([+-]\d{2}):?(\d{2}))?/i.exec(
      s,
    );
  if (!iso) return null;
  const year = Number(iso[1]);
  const month = Number(iso[2]);
  const day = Number(iso[3]);
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const hour = iso[4] !== undefined ? Number(iso[4]) : undefined;
  const minute = iso[5] !== undefined ? Number(iso[5]) : /半/.test(s) ? 30 : hour !== undefined ? 0 : undefined;
  const second = iso[6] !== undefined ? Number(iso[6]) : hour !== undefined ? 0 : undefined;
  let timezone: number | undefined;
  if (iso[7] === 'Z') {
    timezone = 0;
  } else if (iso[8]) {
    const sign = iso[8].startsWith('-') ? -1 : 1;
    timezone = sign * (Math.abs(Number(iso[8])) + Number(iso[9] ?? 0) / 60);
  }
  return {
    year,
    month,
    day,
    ...(hour !== undefined && hour >= 0 && hour <= 23 ? { hour } : {}),
    ...(minute !== undefined && minute >= 0 && minute <= 59 ? { minute } : {}),
    ...(second !== undefined && second >= 0 && second <= 59 ? { second } : {}),
    ...(timezone !== undefined ? { timezone } : {}),
    ...(isLunar ? { calendar: 'lunar' as const } : {}),
  };
}

function parseClockString(raw: string): { hour: number; minute: number; second: number } | null {
  const m = /^(\d{1,2})[:点时](\d{1,2})(?:[:分](\d{1,2}))?/.exec(raw.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] !== undefined ? Number(m[3]) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  return { hour, minute, second };
}

function toFiniteInt(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) return Number.parseInt(v.trim(), 10);
  return undefined;
}

function toFiniteNum(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+(?:\.\d+)?$/.test(v.trim())) return Number(v.trim());
  return undefined;
}

function normalizeClockBirthObject(
  raw: unknown,
  opts: NormalizeToolInputOptions,
): Record<string, unknown> | unknown {
  if (typeof raw === 'string') {
    const parsed = parseLooseDateTimeString(raw);
    if (!parsed) return raw;
    return {
      ...(parsed.calendar ? { calendar: parsed.calendar } : {}),
      year: parsed.year,
      month: parsed.month,
      day: parsed.day,
      timezone: parsed.timezone ?? opts.defaultTimezone ?? 8,
      clock:
        parsed.hour !== undefined
          ? {
              kind: 'exact',
              hour: parsed.hour,
              minute: parsed.minute ?? 0,
              second: parsed.second ?? 0,
            }
          : { kind: 'unknown' },
    };
  }
  if (!isPlainRecord(raw)) return raw;

  const out: Record<string, unknown> = { ...raw };
  for (const key of ['year', 'month', 'day'] as const) {
    const n = toFiniteInt(out[key]);
    if (n !== undefined) out[key] = n;
  }

  // Handle clock specified as string or incomplete object or flat hour/minute
  const flatHour = toFiniteInt(out.hour);
  const flatMinute = toFiniteInt(out.minute);
  const flatSecond = toFiniteInt(out.second);

  if (out.clock === undefined) {
    if (flatHour !== undefined) {
      out.clock = {
        kind: 'exact',
        hour: flatHour,
        minute: flatMinute ?? 0,
        second: flatSecond ?? 0,
      };
    }
  } else if (typeof out.clock === 'string') {
    if (/unknown|未知/i.test(out.clock)) {
      out.clock = { kind: 'unknown' };
    } else {
      const parsedClock = parseClockString(out.clock);
      if (parsedClock) {
        out.clock = { kind: 'exact', ...parsedClock };
      }
    }
  } else if (isPlainRecord(out.clock)) {
    const c: Record<string, unknown> = { ...out.clock };
    if (c.kind === undefined) {
      if (toFiniteInt(c.hour) !== undefined) c.kind = 'exact';
      else if (toFiniteInt(c.index) !== undefined) c.kind = 'shichen';
      else c.kind = 'unknown';
    }
    if (c.kind === 'exact') {
      const h = toFiniteInt(c.hour);
      const m = toFiniteInt(c.minute);
      const s = toFiniteInt(c.second);
      if (h !== undefined) c.hour = h;
      c.minute = m ?? 0;
      c.second = s ?? 0;
    }
    out.clock = c;
  }

  delete out.hour;
  delete out.minute;
  delete out.second;

  // Strip astro-only fields if not allowed by baziBirth strict schema
  delete out.latitude;
  delete out.locationName;

  if (out.timezone === undefined && out.timeZoneId === undefined) {
    out.timezone = opts.defaultTimezone ?? 8;
  } else if (out.timezone !== undefined) {
    const tz = toFiniteNum(out.timezone);
    if (tz !== undefined) out.timezone = tz;
  }
  if (out.longitude !== undefined) {
    const lon = toFiniteNum(out.longitude);
    if (lon !== undefined) out.longitude = lon;
  }
  if (out.calendar === '公历' || out.calendar === '阳历') out.calendar = 'solar';
  if (out.calendar === '农历' || out.calendar === '阴历') out.calendar = 'lunar';
  return out;
}

function normalizeFlatAstroBirthObject(
  raw: unknown,
  opts: NormalizeToolInputOptions,
  allowLocationName: boolean,
): Record<string, unknown> | unknown {
  const defaultLat = opts.defaultLatitude ?? 39.9042;
  const defaultLon = opts.defaultLongitude ?? 116.4074;

  if (typeof raw === 'string') {
    const parsed = parseLooseDateTimeString(raw);
    if (!parsed) return raw;
    return {
      year: parsed.year,
      month: parsed.month,
      day: parsed.day,
      hour: parsed.hour ?? 12,
      minute: parsed.minute ?? 0,
      second: parsed.second ?? 0,
      latitude: defaultLat,
      longitude: defaultLon,
      timezone: parsed.timezone ?? opts.defaultTimezone ?? 8,
    };
  }
  if (!isPlainRecord(raw)) return raw;

  const out: Record<string, unknown> = { ...raw };
  for (const key of ['year', 'month', 'day', 'hour', 'minute', 'second'] as const) {
    const n = toFiniteInt(out[key]);
    if (n !== undefined) out[key] = n;
  }

  if (isPlainRecord(out.clock)) {
    const c = out.clock;
    if (out.hour === undefined && toFiniteInt(c.hour) !== undefined) out.hour = toFiniteInt(c.hour);
    if (out.minute === undefined && toFiniteInt(c.minute) !== undefined) out.minute = toFiniteInt(c.minute);
    if (out.second === undefined && toFiniteInt(c.second) !== undefined) out.second = toFiniteInt(c.second);
  }
  delete out.clock;
  delete out.calendar;
  delete out.leapMonth;
  if (!allowLocationName) delete out.locationName;

  if (out.hour === undefined) out.hour = 12;
  if (out.minute === undefined) out.minute = 0;
  if (out.second === undefined) out.second = 0;

  if (out.latitude === undefined) out.latitude = defaultLat;
  else {
    const lat = toFiniteNum(out.latitude);
    if (lat !== undefined) out.latitude = lat;
  }
  if (out.longitude === undefined) out.longitude = defaultLon;
  else {
    const lon = toFiniteNum(out.longitude);
    if (lon !== undefined) out.longitude = lon;
  }
  if (out.timezone === undefined && out.timeZoneId === undefined) {
    out.timezone = opts.defaultTimezone ?? 8;
  } else if (out.timezone !== undefined) {
    const tz = toFiniteNum(out.timezone);
    if (tz !== undefined) out.timezone = tz;
  }
  return out;
}

function normalizeWholeSecondIsoIfNeeded(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  // "2026-06-15 12:00:00" -> "2026-06-15T12:00:00+08:00"
  const localMatch = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (localMatch) {
    return `${localMatch[1]}T${localMatch[2]}:${localMatch[3] ?? '00'}+08:00`;
  }
  // Strip milliseconds ".123Z" -> "Z"
  return trimmed.replace(/\.\d{1,6}(Z|[+-]\d{2}:?\d{2})$/, '$1');
}

/**
 * 宽松参数归一化主入口：把大模型常见简写或轻微错位参数自动修正为标准 V2 Schema。
 * 返回新对象，不修改入参原对象。
 */
export function normalizeAgentToolInput(
  method: Method,
  rawInput: unknown,
  options: NormalizeToolInputOptions = {},
): Record<string, unknown> {
  if (!isPlainRecord(rawInput)) return {};
  const next: Record<string, unknown> = { ...rawInput };

  // 1. 通用顶层字段：question / gender / relationship / referenceTime
  if (typeof next.question !== 'string' || !next.question.trim()) {
    next.question = '请结合盘面核心结构与当前重点给出清晰分析与建议。';
  }
  if ('gender' in next) {
    next.gender = normalizeGenderValue(next.gender);
  }
  if ('relationship' in next) {
    next.relationship = normalizeRelationshipValue(next.relationship);
  }
  if ('referenceTime' in next) {
    next.referenceTime = normalizeWholeSecondIsoIfNeeded(next.referenceTime);
  }
  if ('currentTime' in next) {
    next.currentTime = normalizeWholeSecondIsoIfNeeded(next.currentTime);
  }

  // 2. 顶层误放 includeClassics 时自动归位到 prompt.includeClassics
  if ('includeClassics' in next && typeof next.includeClassics === 'boolean') {
    const flag = next.includeClassics;
    delete next.includeClassics;
    if (!NON_CLASSICS_METHODS.has(method)) {
      const existingPrompt = isPlainRecord(next.prompt) ? { ...next.prompt } : {};
      if (existingPrompt.includeClassics === undefined) {
        existingPrompt.includeClassics = flag;
      }
      next.prompt = existingPrompt;
    }
  }

  // 3. 单人东方命盘 birth 归一化
  if (CLOCK_BIRTH_METHODS.has(method) && 'birth' in next) {
    next.birth = normalizeClockBirthObject(next.birth, options);
  }

  // 4. 单人星占/七政命盘 birth 归一化
  if (FLAT_ASTRO_BIRTH_METHODS.has(method) && 'birth' in next) {
    const allowLocationName = method === 'astrolabe' || method === 'astrolabe-range';
    next.birth = normalizeFlatAstroBirthObject(next.birth, options, allowLocationName);
    if ((method === 'qizheng' || method === 'qizheng-range') && next.gender && !next.flow) {
      // 七政 schema 规定：未传 flow 时不允许单独传 gender
      delete next.gender;
    }
  }

  // 5. 双人合盘归一化
  if (method === 'bazi-synastry') {
    for (const key of ['person1', 'person2'] as const) {
      const person = next[key];
      if (isPlainRecord(person)) {
        // 兼容模型把 person1 写成 { name, gender, birth: {...} | "YYYY-MM-DD HH:MM" }（紫微风格）而非扁平结构
        const rawBirthSource =
          isPlainRecord(person.birth) || typeof person.birth === 'string'
            ? person.birth
            : person;
        const normalizedBirth = normalizeClockBirthObject(rawBirthSource, options);
        if (isPlainRecord(normalizedBirth)) {
          delete normalizedBirth.birth;
          if (person.name !== undefined) normalizedBirth.name = person.name;
          if (person.gender !== undefined) normalizedBirth.gender = normalizeGenderValue(person.gender);
          next[key] = normalizedBirth;
        }
      } else if (typeof person === 'string') {
        next[key] = normalizeClockBirthObject(person, options);
      }
    }
  }

  if (method === 'ziwei-synastry') {
    for (const key of ['person1', 'person2'] as const) {
      const person = next[key];
      if (isPlainRecord(person)) {
        const copy: Record<string, unknown> = { ...person };
        if ('gender' in copy) copy.gender = normalizeGenderValue(copy.gender);
        if ('birth' in copy) {
          copy.birth = normalizeClockBirthObject(copy.birth, options);
        } else if ('year' in copy && 'month' in copy && 'day' in copy) {
          // 模型把紫微合盘写成了八字扁平风格，自动收进 birth
          const { name, gender, ...restBirth } = copy;
          next[key] = {
            ...(name !== undefined ? { name } : {}),
            ...(gender !== undefined ? { gender: normalizeGenderValue(gender) } : {}),
            birth: normalizeClockBirthObject(restBirth, options),
          };
          continue;
        }
        next[key] = copy;
      }
    }
  }

  if (method === 'astrolabe-synastry') {
    for (const key of ['person1', 'person2'] as const) {
      const person = next[key];
      if (isPlainRecord(person) && (isPlainRecord(person.birth) || typeof person.birth === 'string')) {
        const normalized = normalizeFlatAstroBirthObject(person.birth, options, true);
        if (isPlainRecord(normalized)) {
          if (person.name !== undefined) normalized.name = person.name;
          if (person.gender !== undefined) normalized.gender = normalizeGenderValue(person.gender);
          next[key] = normalized;
        }
      } else if (person !== undefined) {
        const normalized = normalizeFlatAstroBirthObject(person, options, true);
        if (isPlainRecord(normalized) && 'gender' in normalized) {
          normalized.gender = normalizeGenderValue(normalized.gender);
        }
        next[key] = normalized;
      }
    }
  }

  // 6. 奇门/大六壬/六爻常见时点简写归一化
  if ((method === 'qimen' || method === 'liuren' || method === 'jinkoujue') && 'at' in next) {
    next.at = normalizeWholeSecondIsoIfNeeded(next.at);
  }

  return next;
}
