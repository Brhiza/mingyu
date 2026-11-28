import type { BaziZiweiCorroborationResult } from '../systems/bazi-ziwei-corroboration';
import type { MingluResonanceSummary } from '../systems/minglu-resonance';
import type { PersonalCase } from './cases-store';

export type HecanSystemId =
  | 'bazi'
  | 'ziwei'
  | 'astrolabe'
  | 'qizheng'
  | 'qimen-lifetime';

export interface HecanSystemMeta {
  id: HecanSystemId;
  label: string;
  shortLabel: string;
  needsKnownTime: boolean;
  supportsFlowYear: boolean;
}

export const HECAN_SYSTEMS: ReadonlyArray<HecanSystemMeta> = [
  {
    id: 'bazi',
    label: '八字',
    shortLabel: '八字',
    needsKnownTime: false,
    supportsFlowYear: true,
  },
  {
    id: 'ziwei',
    label: '紫微斗数',
    shortLabel: '紫微',
    needsKnownTime: false,
    supportsFlowYear: true,
  },
  {
    id: 'astrolabe',
    label: '西洋星盘',
    shortLabel: '星盘',
    needsKnownTime: true,
    supportsFlowYear: true,
  },
  {
    id: 'qizheng',
    label: '七政四余',
    shortLabel: '七政',
    needsKnownTime: true,
    supportsFlowYear: true,
  },
  {
    id: 'qimen-lifetime',
    label: '奇门终身局',
    shortLabel: '奇门终身',
    needsKnownTime: true,
    supportsFlowYear: false,
  },
];

export const DEFAULT_HECAN_SYSTEMS: readonly HecanSystemId[] = ['bazi', 'ziwei'];
export const ALL_HECAN_SYSTEMS: readonly HecanSystemId[] = HECAN_SYSTEMS.map((item) => item.id);

export const HECAN_SYSTEM_MAP = new Map<HecanSystemId, HecanSystemMeta>(
  HECAN_SYSTEMS.map((item) => [item.id, item]),
);
const HECAN_ORDER = new Map<HecanSystemId, number>(
  HECAN_SYSTEMS.map((item, idx) => [item.id, idx]),
);
const HECAN_STORAGE_KEY = 'mingyu.v2.hecanSystems';

export interface HecanComputedEntry {
  systemId: HecanSystemId;
  payload: Record<string, unknown>;
  result: {
    currentTime?: string;
    summary?: unknown;
    prompt?: { text: string };
    data?: unknown;
    promptOptions?: unknown;
  };
}

export interface HecanOmittedEntry {
  id: HecanSystemId;
  label: string;
  reason: string;
}

export interface MultiHecanData {
  kind: 'multi-hecan';
  selectedSystems: HecanSystemId[];
  computedSystems: HecanSystemId[];
  anchors: Partial<Record<HecanSystemId, string>>;
  omitted: HecanOmittedEntry[];
  corroboration?: BaziZiweiCorroborationResult;
  crossResonance?: MingluResonanceSummary;
  flowYear: number | null;
  charts: Partial<Record<HecanSystemId, unknown>>;
}

export interface MultiHecanResult {
  currentTime: string;
  summary: {
    title: string;
    tags: string[];
    lines: string[];
  };
  data: MultiHecanData;
  prompt: { text: string };
}

export function normalizeHecanSystems(ids: readonly string[]): HecanSystemId[] {
  const valid = new Set<HecanSystemId>();
  for (const raw of ids) {
    if (HECAN_SYSTEM_MAP.has(raw as HecanSystemId)) {
      valid.add(raw as HecanSystemId);
    }
  }
  if (valid.size === 0) return [...DEFAULT_HECAN_SYSTEMS];
  return [...valid].sort((a, b) => (HECAN_ORDER.get(a) ?? 0) - (HECAN_ORDER.get(b) ?? 0));
}

export function readSavedHecanSystems(): HecanSystemId[] {
  if (typeof window === 'undefined') return [...DEFAULT_HECAN_SYSTEMS];
  try {
    const raw = window.localStorage.getItem(HECAN_STORAGE_KEY);
    if (!raw) return [...DEFAULT_HECAN_SYSTEMS];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_HECAN_SYSTEMS];
    return normalizeHecanSystems(parsed.filter((x): x is string => typeof x === 'string'));
  } catch {
    return [...DEFAULT_HECAN_SYSTEMS];
  }
}

export function saveHecanSystems(systems: readonly HecanSystemId[]): HecanSystemId[] {
  const normalized = normalizeHecanSystems(systems);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(HECAN_STORAGE_KEY, JSON.stringify(normalized));
    } catch {}
  }
  return normalized;
}

export function toggleHecanSystem(
  current: readonly HecanSystemId[],
  id: HecanSystemId,
): HecanSystemId[] {
  const normalized = normalizeHecanSystems(current);
  if (normalized.includes(id)) {
    if (normalized.length <= 1) return normalized;
    return normalized.filter((item) => item !== id);
  }
  return normalizeHecanSystems([...normalized, id]);
}

export function getHecanSystemAvailability(
  person: PersonalCase,
  id: HecanSystemId,
): { available: boolean; reason?: string } {
  const meta = HECAN_SYSTEM_MAP.get(id);
  if (!meta) return { available: false, reason: '暂不支持该术数' };
  const hasExplicitClock =
    String(person.birthHour ?? '').trim() !== '' &&
    String(person.birthMinute ?? '').trim() !== '';
  const isUnknownTime = person.timeIndex === 'unknown' && !hasExplicitClock;

  if (person.reverseSource && id !== 'bazi' && isUnknownTime) {
    return { available: false, reason: '四柱反推仅支持八字区间' };
  }
  if (isUnknownTime && meta.needsKnownTime) {
    return { available: false, reason: '未知时辰' };
  }
  return { available: true };
}

export function getAvailableHecanSystems(person: PersonalCase): HecanSystemId[] {
  return ALL_HECAN_SYSTEMS.filter((id) => getHecanSystemAvailability(person, id).available);
}
