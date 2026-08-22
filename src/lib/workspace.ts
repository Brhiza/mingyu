import { DIVINATION_METHOD_OPTIONS, type DivinationMethodId } from 'mingyu-core/divination/config';
import { safeStorage } from '@/lib/safe-storage';
import type { PromptSourceKey, QueryInputState } from '@/lib/query-state';

export type ChartWorkspaceId =
  'bazi' | 'ziwei' | 'bazi-ziwei' | 'astrolabe' | 'qizheng' | 'bazhai' | 'compatibility';

export type DivinationWorkspaceId = Exclude<DivinationMethodId, 'astrolabe'>;
export type WorkspaceFeatureId = ChartWorkspaceId | DivinationWorkspaceId;
export type WorkspaceFeatureGroup = 'chart' | 'divination' | 'timing';

export type WorkspaceFeature = {
  id: WorkspaceFeatureId;
  label: string;
  shortLabel: string;
  mark: string;
  description: string;
  group: WorkspaceFeatureGroup;
};

const chartFeatures: WorkspaceFeature[] = [
  {
    id: 'bazi',
    label: '八字',
    shortLabel: '八字',
    mark: '八',
    description: '四柱、大运与流年',
    group: 'chart',
  },
  {
    id: 'ziwei',
    label: '紫微斗数',
    shortLabel: '紫微',
    mark: '紫',
    description: '十二宫与行运',
    group: 'chart',
  },
  {
    id: 'bazi-ziwei',
    label: '八字紫微合参',
    shortLabel: '合参',
    mark: '合',
    description: '两种命盘交叉参看',
    group: 'chart',
  },
  {
    id: 'astrolabe',
    label: '西洋星盘',
    shortLabel: '星盘',
    mark: '星',
    description: '星体、宫位与相位',
    group: 'chart',
  },
  {
    id: 'qizheng',
    label: '七政四余',
    shortLabel: '七政',
    mark: '政',
    description: '七政四余完整星盘',
    group: 'chart',
  },
  {
    id: 'bazhai',
    label: '八宅风水',
    shortLabel: '八宅',
    mark: '宅',
    description: '命卦与住宅方位',
    group: 'chart',
  },
  {
    id: 'compatibility',
    label: '双人合盘',
    shortLabel: '合盘',
    mark: '双',
    description: '关系与婚恋合参',
    group: 'chart',
  },
];

const divinationMarks: Record<DivinationWorkspaceId, string> = {
  random: '问',
  liuyao: '爻',
  meihua: '梅',
  qimen: '奇',
  liuren: '壬',
  xiaoliuren: '小',
  jinkoujue: '金',
  taiyi: '太',
  ssgw: '签',
  tarot: '塔',
  lenormand: '雷',
  almanac: '日',
};

const divinationFeatures: WorkspaceFeature[] = DIVINATION_METHOD_OPTIONS.filter(
  (
    item,
  ): item is (typeof DIVINATION_METHOD_OPTIONS)[number] & {
    value: DivinationWorkspaceId;
  } => item.value !== 'astrolabe',
).map((item) => ({
  id: item.value,
  label: item.value === 'random' ? '随机问事' : item.label,
  shortLabel: item.label,
  mark: divinationMarks[item.value],
  description: item.description,
  group: item.value === 'almanac' ? 'timing' : 'divination',
}));

export const WORKSPACE_FEATURES: WorkspaceFeature[] = [...chartFeatures, ...divinationFeatures];
export const WORKSPACE_FEATURE_IDS = WORKSPACE_FEATURES.map((item) => item.id);
export const DEFAULT_WORKSPACE_FEATURE_ID: WorkspaceFeatureId = 'bazi';

const WORKSPACE_PREFERENCES_KEY = 'mingyu_workspace_preferences_v2';
export const WORKSPACE_PREFERENCES_EVENT = 'mingyu:workspace-preferences';

export type WorkspacePreferences = {
  defaultFeature: WorkspaceFeatureId;
  startBehavior: 'new' | 'recent';
  navigationOrder: WorkspaceFeatureId[];
};

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  defaultFeature: DEFAULT_WORKSPACE_FEATURE_ID,
  startBehavior: 'new',
  navigationOrder: [...WORKSPACE_FEATURE_IDS],
};

export function isWorkspaceFeatureId(value: unknown): value is WorkspaceFeatureId {
  return typeof value === 'string' && WORKSPACE_FEATURE_IDS.includes(value as WorkspaceFeatureId);
}

export function isChartWorkspaceId(value: unknown): value is ChartWorkspaceId {
  return chartFeatures.some((item) => item.id === value);
}

export function isDivinationWorkspaceId(value: unknown): value is DivinationWorkspaceId {
  return divinationFeatures.some((item) => item.id === value);
}

export function getWorkspaceFeature(id: WorkspaceFeatureId) {
  return WORKSPACE_FEATURES.find((item) => item.id === id) ?? WORKSPACE_FEATURES[0];
}

export function normalizeNavigationOrder(value: unknown): WorkspaceFeatureId[] {
  const requested = Array.isArray(value) ? value.filter(isWorkspaceFeatureId) : [];
  const unique = [...new Set(requested)];
  return [...unique, ...WORKSPACE_FEATURE_IDS.filter((id) => !unique.includes(id))];
}

export function readWorkspacePreferences(): WorkspacePreferences {
  const stored = safeStorage.getJSON<Partial<WorkspacePreferences>>(WORKSPACE_PREFERENCES_KEY, {});
  return {
    defaultFeature: isWorkspaceFeatureId(stored.defaultFeature)
      ? stored.defaultFeature
      : DEFAULT_WORKSPACE_PREFERENCES.defaultFeature,
    startBehavior: stored.startBehavior === 'recent' ? 'recent' : 'new',
    navigationOrder: normalizeNavigationOrder(stored.navigationOrder),
  };
}

export function saveWorkspacePreferences(preferences: WorkspacePreferences) {
  const normalized: WorkspacePreferences = {
    defaultFeature: isWorkspaceFeatureId(preferences.defaultFeature)
      ? preferences.defaultFeature
      : DEFAULT_WORKSPACE_PREFERENCES.defaultFeature,
    startBehavior: preferences.startBehavior === 'recent' ? 'recent' : 'new',
    navigationOrder: normalizeNavigationOrder(preferences.navigationOrder),
  };
  safeStorage.setJSON(WORKSPACE_PREFERENCES_KEY, normalized);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(WORKSPACE_PREFERENCES_EVENT));
  }
  return normalized;
}

export function buildWorkspaceFeaturePath(id: WorkspaceFeatureId) {
  return isChartWorkspaceId(id) ? `/chart/${id}` : `/divination/${id}`;
}

export function resolvePersonalWorkspaceSource(
  chartType: QueryInputState['chartType'],
  storedSource?: PromptSourceKey,
): PromptSourceKey {
  if (chartType === 'astrolabe') {
    return storedSource === 'qizheng' ? 'qizheng' : 'astrolabe';
  }
  if (chartType === 'ziwei') {
    return 'ziwei';
  }
  return storedSource === 'bazi-ziwei' || storedSource === 'bazhai' ? storedSource : 'bazi';
}
