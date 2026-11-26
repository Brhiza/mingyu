/**
 * R4 · 纯本地端侧路由个人偏好与配置（零隐私上传，仅存浏览器 localStorage）。
 */
import type { MethodId, TraditionPref } from './features';

const STORAGE_KEY = 'mingyu.v2.router.userMethodPrefs';
const ROUTER_SETTINGS_STORAGE_KEY = 'mingyu.v2.router.settings';

export type RouterPreferenceWeight = 'off' | 'mild' | 'strong';

export interface RouterMethodItem {
  id: MethodId;
  label: string;
  linkedIds?: readonly MethodId[];
  defaultDisabled?: boolean;
}

export interface RouterMethodCategory {
  id: string;
  label: string;
  items: readonly RouterMethodItem[];
}

export const EXCLUDED_ROUTER_METHODS: readonly MethodId[] = ['random-divination', 'instant'];

export const ROUTER_METHOD_CATALOG: readonly RouterMethodCategory[] = [
  {
    id: 'natal',
    label: '命盘与合盘',
    items: [
      { id: 'bazi', label: '八字' },
      { id: 'ziwei', label: '紫微斗数' },
      { id: 'bazi-ziwei', label: '八字紫微合参' },
      { id: 'astrolabe', label: '西洋星盘', linkedIds: ['astrolabe-range'] },
      { id: 'qizheng', label: '七政四余', linkedIds: ['qizheng-range'] },
      { id: 'minglu', label: '个人命录' },
      { id: 'qimen-lifetime', label: '奇门终身局' },
      { id: 'bazi-synastry', label: '八字合盘' },
      { id: 'ziwei-synastry', label: '紫微合盘' },
      { id: 'astrolabe-synastry', label: '星盘合盘' },
    ],
  },
  {
    id: 'eastern-divination',
    label: '东方占卜',
    items: [
      { id: 'liuyao', label: '六爻' },
      { id: 'meihua', label: '梅花易数' },
      { id: 'qimen', label: '奇门遁甲' },
      { id: 'liuren', label: '大六壬' },
      { id: 'jinkoujue', label: '金口诀' },
      { id: 'xiaoliuren', label: '小六壬' },
      { id: 'taiyi', label: '太乙神数', defaultDisabled: true },
    ],
  },
  {
    id: 'cards-lots',
    label: '牌阵与灵签',
    items: [
      { id: 'tarot', label: '塔罗牌' },
      { id: 'lenormand', label: '雷诺曼' },
      { id: 'ssgw', label: '三山国王灵签' },
      { id: 'zhuge', label: '诸葛神数', defaultDisabled: true },
    ],
  },
  {
    id: 'fengshui-almanac',
    label: '风水与历法',
    items: [
      { id: 'almanac', label: '黄历择吉' },
      { id: 'bazhai', label: '八宅' },
      { id: 'xuankong', label: '玄空飞星' },
      { id: 'residential', label: '阳宅风水' },
      { id: 'calendar', label: '干支天文历' },
    ],
  },
  {
    id: 'name-tools',
    label: '姓名与文字',
    items: [
      { id: 'chinese-name', label: '姓名评测' },
      { id: 'chinese-naming', label: '中文起名' },
      { id: 'character-query', label: '汉字查询' },
      { id: 'number-energy', label: '数字能量' },
      { id: 'zhouyi', label: '周易经文' },
      { id: 'bazi-reverse', label: '四柱反推' },
    ],
  },
  {
    id: 'cycle-fortune',
    label: '运势与宏观周期',
    items: [
      { id: 'fortune', label: '日/月/年运势', defaultDisabled: true },
      { id: 'wuyun-liuqi', label: '五运六气', defaultDisabled: true },
      { id: 'huangji-jingshi', label: '皇极经世', defaultDisabled: true },
    ],
  },
];

export const DEFAULT_BROWSER_DISABLED_ROUTER_METHODS: readonly MethodId[] =
  ROUTER_METHOD_CATALOG.flatMap((cat) =>
    cat.items
      .filter((item) => item.defaultDisabled)
      .flatMap((item) => [item.id, ...(item.linkedIds ?? [])]),
  );

export interface LocalRouterSettings {
  preferredChart: MethodId | null;
  preferredDivination: MethodId | null;
  disabledMethods: MethodId[];
  traditionPref: TraditionPref;
  preferenceWeight: RouterPreferenceWeight;
  learnFromHistory: boolean;
}

export const DEFAULT_LOCAL_ROUTER_SETTINGS: LocalRouterSettings = {
  preferredChart: null,
  preferredDivination: null,
  disabledMethods: [...DEFAULT_BROWSER_DISABLED_ROUTER_METHODS],
  traditionPref: 'any',
  preferenceWeight: 'mild',
  learnFromHistory: true,
};

const VALID_PREFERRED_CHARTS = new Set<MethodId>([
  'bazi',
  'ziwei',
  'bazi-ziwei',
  'astrolabe',
  'qizheng',
  'minglu',
  'qimen-lifetime',
]);

const VALID_PREFERRED_DIVINATIONS = new Set<MethodId>([
  'liuyao',
  'meihua',
  'qimen',
  'liuren',
  'jinkoujue',
  'xiaoliuren',
  'tarot',
  'lenormand',
  'ssgw',
  'zhuge',
  'taiyi',
  'huangji-jingshi',
  'wuyun-liuqi',
]);

export interface LocalRouterDefaults {
  preferredChart: MethodId | null;
  preferredDivination: MethodId | null;
}

function normalizePreferredChart(raw: unknown): MethodId | null {
  return typeof raw === 'string' && VALID_PREFERRED_CHARTS.has(raw as MethodId)
    ? (raw as MethodId)
    : null;
}

function normalizePreferredDivination(raw: unknown): MethodId | null {
  return typeof raw === 'string' && VALID_PREFERRED_DIVINATIONS.has(raw as MethodId)
    ? (raw as MethodId)
    : null;
}

export function loadLocalRouterDefaults(): LocalRouterDefaults {
  const settings = loadLocalRouterSettings();
  return {
    preferredChart: settings.preferredChart,
    preferredDivination: settings.preferredDivination,
  };
}

export function loadLocalRouterDisabledMethods(): MethodId[] {
  return loadLocalRouterSettings().disabledMethods;
}

export function loadLocalRouterSettings(): LocalRouterSettings {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return {
        preferredChart: null,
        preferredDivination: null,
        disabledMethods: [],
        traditionPref: 'any',
        preferenceWeight: 'mild',
        learnFromHistory: true,
      };
    }
    const raw = window.localStorage.getItem(ROUTER_SETTINGS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<LocalRouterSettings>) : null;

    const disabledMethods: MethodId[] =
      parsed && Array.isArray(parsed.disabledMethods)
        ? (parsed.disabledMethods.filter((m): m is MethodId => typeof m === 'string') as MethodId[])
        : [...DEFAULT_BROWSER_DISABLED_ROUTER_METHODS];

    const traditionPref: TraditionPref =
      parsed?.traditionPref === 'eastern' ||
      parsed?.traditionPref === 'western_cards' ||
      parsed?.traditionPref === 'folk_signs' ||
      parsed?.traditionPref === 'any'
        ? parsed.traditionPref
        : 'any';
    const preferenceWeight: RouterPreferenceWeight =
      parsed?.preferenceWeight === 'off' ||
      parsed?.preferenceWeight === 'mild' ||
      parsed?.preferenceWeight === 'strong'
        ? parsed.preferenceWeight
        : 'mild';
    const learnFromHistory =
      typeof parsed?.learnFromHistory === 'boolean' ? parsed.learnFromHistory : true;
    return {
      preferredChart: normalizePreferredChart(parsed?.preferredChart),
      preferredDivination: normalizePreferredDivination(parsed?.preferredDivination),
      disabledMethods,
      traditionPref,
      preferenceWeight,
      learnFromHistory,
    };
  } catch {
    return {
      ...DEFAULT_LOCAL_ROUTER_SETTINGS,
      disabledMethods: [...DEFAULT_BROWSER_DISABLED_ROUTER_METHODS],
    };
  }
}

export function saveLocalRouterSettings(next: LocalRouterSettings): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const clean: LocalRouterSettings = {
      preferredChart: normalizePreferredChart(next.preferredChart),
      preferredDivination: normalizePreferredDivination(next.preferredDivination),
      disabledMethods: [...new Set(next.disabledMethods)],
      traditionPref: next.traditionPref,
      preferenceWeight: next.preferenceWeight,
      learnFromHistory: next.learnFromHistory,
    };
    window.localStorage.setItem(ROUTER_SETTINGS_STORAGE_KEY, JSON.stringify(clean));
  } catch {}
}

export function saveLocalRouterDisabledMethods(methods: readonly MethodId[]): void {
  const cur = loadLocalRouterSettings();
  saveLocalRouterSettings({ ...cur, disabledMethods: [...methods] });
}

export interface LocalRouterPreferences {
  counts: Partial<Record<MethodId, number>>;
  updatedAt: string;
}

export function loadLocalRouterPreferences(): LocalRouterPreferences {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { counts: {}, updatedAt: '' };
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { counts: {}, updatedAt: '' };
    const parsed = JSON.parse(raw) as Partial<LocalRouterPreferences>;
    if (!parsed || typeof parsed !== 'object' || !parsed.counts || typeof parsed.counts !== 'object') {
      return { counts: {}, updatedAt: '' };
    }
    return {
      counts: parsed.counts,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    };
  } catch {
    return { counts: {}, updatedAt: '' };
  }
}

export function recordLocalRouterMethodChoice(method: MethodId): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (!loadLocalRouterSettings().learnFromHistory) return;
    const prefs = loadLocalRouterPreferences();
    const prev = Number(prefs.counts[method] ?? 0);
    prefs.counts[method] = Math.min(50, (Number.isFinite(prev) ? prev : 0) + 1);
    prefs.updatedAt = new Date().toISOString();
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

export function resetLocalRouterPreferences(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(ROUTER_SETTINGS_STORAGE_KEY);
  } catch {}
}

export function getLocalRouterMethodBonus(method: MethodId): number {
  const prefs = loadLocalRouterPreferences();
  const count = Number(prefs.counts[method] ?? 0);
  if (!Number.isFinite(count) || count < 2) return 0;
  return Math.min(0.18, Math.log1p(count - 1) * 0.06);
}
