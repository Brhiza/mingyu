import {
  ASSET_ORIGIN,
  DEFAULT_WORKSPACE_THEME_ID,
  ENABLE_CUSTOM_EDITION,
} from '../brand-config';
import type { Method } from '../method-meta';
import type { CultureToolTabId } from './components/culture/culture-types';
import {
  PERSONAL_CHART_TABS,
  isDivinationFormMethod,
  type DivinationFormMethod,
  type PersonalChartTabId,
} from '../v2-ui/chart-tabs';
import { applyGlobalRulesToPayload, loadGlobalRules } from '../web-settings';

export type WorkspaceRouteId =
  | 'home'
  | 'fortune'
  | 'chat'
  | 'chart-input'
  | 'time-reverse'
  | 'divination-input'
  | 'tools'
  | 'utilities'
  | 'result'
  | 'history'
  | 'cases'
  | 'me'
  | 'connect';

export type TopDomainId =
  | 'home'
  | 'fortune'
  | 'chat'
  | 'personal-chart'
  | 'divination'
  | 'tools'
  | 'utilities'
  | 'history'
  | 'cases'
  | 'me'
  | 'connect';

export type ColorThemeId = 'blossom' | 'jade' | 'indigo' | 'amber' | 'violet';

export type WorkspaceThemeId = ColorThemeId | (string & {});

export type DivinationCenterMethod = DivinationFormMethod | 'number-energy' | 'shiyue-oracle';
export type AlmanacSubTabId = 'almanac' | 'calendar';
export type UtilityMainTabId =
  | 'almanac'
  | 'residential'
  | 'name-char'
  | 'number-energy';
export type NameCharSubTabId =
  | 'chinese-name'
  | 'chinese-naming'
  | 'character-query'
  | 'zhouyi'
  | 'terms';
export type UtilityToolId =
  | 'almanac'
  | 'calendar'
  | 'residential'
  | 'chinese-name'
  | 'chinese-naming'
  | 'character-query'
  | 'zhouyi'
  | 'terms'
  | 'number-energy';

export interface WorkspacePreferences {
  theme: WorkspaceThemeId;
  defaultChartFeature: PersonalChartTabId;
  defaultDivinationFeature: DivinationFormMethod;
}

export const COLOR_THEME_DEFINITIONS: ReadonlyArray<{
  id: ColorThemeId;
  label: string;
  swatches: readonly [string, string, string];
}> = [
  { id: 'blossom', label: '朱砂', swatches: ['#9e2d20', '#9a7740', '#f7f4ee'] },
  { id: 'jade', label: '松青', swatches: ['#185c4b', '#5d8a78', '#f1f6f3'] },
  { id: 'indigo', label: '青黛', swatches: ['#21496b', '#5c82a3', '#f1f5f9'] },
  { id: 'amber', label: '琥珀', swatches: ['#8c4f12', '#b5893e', '#f8f4ec'] },
  { id: 'violet', label: '紫檀', swatches: ['#583563', '#8e6d9c', '#f6f2f8'] },
];

export const WORKSPACE_THEME_DEFINITIONS = COLOR_THEME_DEFINITIONS;

export const DIVINATION_METHOD_OPTIONS: ReadonlyArray<{ id: DivinationFormMethod; label: string }> = [
  { id: 'liuyao', label: '六爻' },
  { id: 'meihua', label: '梅花易数' },
  { id: 'qimen', label: '奇门遁甲' },
  { id: 'liuren', label: '大六壬' },
  { id: 'xiaoliuren', label: '小六壬' },
  { id: 'jinkoujue', label: '金口诀' },
  { id: 'taiyi', label: '太乙神数' },
  { id: 'tarot', label: '塔罗占卜' },
  { id: 'lenormand', label: '雷诺曼牌' },
  { id: 'ssgw', label: '三山国王灵签' },
  { id: 'zhuge', label: '诸葛神数' },
  { id: 'huangji-jingshi', label: '皇极经世' },
  { id: 'wuyun-liuqi', label: '五运六气' },
  { id: 'almanac', label: '万年历' },
  { id: 'residential', label: '阳宅风水' },
];

export const HOME_NICHE_DIVINATION_ITEMS: ReadonlyArray<{
  id: 'taiyi' | 'huangji-jingshi' | 'wuyun-liuqi' | 'zhuge';
  label: string;
}> = [
  { id: 'taiyi', label: '太乙神数' },
  { id: 'huangji-jingshi', label: '皇极经世' },
  { id: 'wuyun-liuqi', label: '五运六气' },
  { id: 'zhuge', label: '诸葛神数' },
];

export const DIVINATION_FLAT_ITEMS: ReadonlyArray<{ id: DivinationCenterMethod; label: string }> = [
  { id: 'liuyao', label: '六爻' },
  { id: 'meihua', label: '梅花易数' },
  { id: 'xiaoliuren', label: '小六壬' },
  { id: 'qimen', label: '奇门遁甲' },
  { id: 'liuren', label: '大六壬' },
  { id: 'jinkoujue', label: '金口诀' },
  { id: 'tarot', label: '塔罗占卜' },
  { id: 'lenormand', label: '雷诺曼牌' },
  ...(ENABLE_CUSTOM_EDITION ? [{ id: 'shiyue-oracle' as const, label: '时月神谕' }] : []),
  { id: 'ssgw', label: '三山灵签' },
];

export const UTILITY_MAIN_TABS: ReadonlyArray<{ id: UtilityMainTabId; label: string }> = [
  { id: 'almanac', label: '万年历' },
  { id: 'residential', label: '阳宅风水' },
  { id: 'name-char', label: '汉字经籍' },
  { id: 'number-energy', label: '数字能量' },
];

export const NAME_CHAR_SUB_TABS: ReadonlyArray<{ id: NameCharSubTabId; label: string }> = [
  { id: 'chinese-name', label: '姓名五格' },
  { id: 'chinese-naming', label: '起名方案' },
  { id: 'character-query', label: '汉字字典' },
  { id: 'zhouyi', label: '周易经文' },
  { id: 'terms', label: '术语词典' },
];

const WORKSPACE_PREFERENCES_STORAGE_KEY = 'mingyu_workspace_preferences_v5';

const COLOR_THEME_IDS = new Set<string>(COLOR_THEME_DEFINITIONS.map((item) => item.id));
const VALID_REMOTE_SKIN_ID = /^[a-z0-9-]+$/;

export function isWorkspaceThemeId(value: unknown): value is WorkspaceThemeId {
  if (typeof value !== 'string' || !value) return false;
  if (COLOR_THEME_IDS.has(value)) return true;
  return Boolean(ASSET_ORIGIN) && VALID_REMOTE_SKIN_ID.test(value);
}

const resolvedDefaultTheme: WorkspaceThemeId = isWorkspaceThemeId(DEFAULT_WORKSPACE_THEME_ID)
  ? DEFAULT_WORKSPACE_THEME_ID
  : 'blossom';

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  theme: resolvedDefaultTheme,
  defaultChartFeature: 'bazi',
  defaultDivinationFeature: 'liuyao',
};

export function readWorkspacePreferences(): WorkspacePreferences {
  try {
    const raw = localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_WORKSPACE_PREFERENCES };
    }
    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences>;
    const theme: WorkspaceThemeId = isWorkspaceThemeId(parsed.theme)
      ? parsed.theme
      : resolvedDefaultTheme;
    const defaultChartFeature: PersonalChartTabId =
      typeof parsed.defaultChartFeature === 'string' &&
      PERSONAL_CHART_TABS.some((item) => item.id === parsed.defaultChartFeature)
        ? (parsed.defaultChartFeature as PersonalChartTabId)
        : 'bazi';
    const defaultDivinationFeature: DivinationFormMethod =
      typeof parsed.defaultDivinationFeature === 'string' &&
      isDivinationFormMethod(parsed.defaultDivinationFeature)
        ? parsed.defaultDivinationFeature
        : 'liuyao';
    return {
      ...DEFAULT_WORKSPACE_PREFERENCES,
      theme,
      defaultChartFeature,
      defaultDivinationFeature,
    };
  } catch {
    return { ...DEFAULT_WORKSPACE_PREFERENCES };
  }
}

export function saveWorkspacePreferences(next: WorkspacePreferences): WorkspacePreferences {
  try {
    localStorage.setItem(WORKSPACE_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
  } catch {}
  applyWorkspaceTheme(next.theme);
  return next;
}

export function applyWorkspaceTheme(theme: WorkspaceThemeId): void {
  if (theme === 'blossom') {
    document.documentElement.removeAttribute('data-accent-theme');
  } else {
    document.documentElement.setAttribute('data-accent-theme', theme);
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mingyu:theme-changed', { detail: theme }));
  }
}

export function getDisplayThemeMode(): 'light' | 'dark' {
  const explicit = document.documentElement.getAttribute('data-theme');
  if (explicit === 'dark' || explicit === 'light') return explicit;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setDisplayThemeMode(mode: 'light' | 'dark'): void {
  document.documentElement.setAttribute('data-theme', mode);
  try {
    localStorage.setItem('mingyu-theme-mode', mode);
  } catch {}
}

export function initSavedDisplayThemeMode(): void {
  try {
    const saved = localStorage.getItem('mingyu-theme-mode');
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved);
    }
  } catch {}
}

export interface CustomShortcutOption {
  id: string;
  label: string;
  group: '命盘' | '占卜' | '工具';
}

export const CUSTOM_SHORTCUT_CATALOG: ReadonlyArray<CustomShortcutOption> = [
  { id: 'fortune', label: '日/月/年运势', group: '命盘' },
  { id: 'bazi', label: '八字排盘', group: '命盘' },
  { id: 'ziwei', label: '紫微斗数', group: '命盘' },
  { id: 'astrolabe', label: '西洋星盘', group: '命盘' },
  { id: 'qizheng', label: '七政四余', group: '命盘' },
  { id: 'qimen-lifetime', label: '奇门终身', group: '命盘' },
  { id: 'bazi-ziwei', label: '多术数合参', group: '命盘' },
  { id: 'compatibility', label: '双人合盘', group: '命盘' },
  { id: 'cases', label: '个人档案', group: '命盘' },
  { id: 'liuren', label: '大六壬', group: '占卜' },
  { id: 'qimen', label: '奇门遁甲', group: '占卜' },
  { id: 'liuyao', label: '六爻手动起卦', group: '占卜' },
  { id: 'meihua', label: '梅花易数', group: '占卜' },
  { id: 'xiaoliuren', label: '小六壬', group: '占卜' },
  { id: 'jinkoujue', label: '金口诀', group: '占卜' },
  { id: 'tarot', label: '塔罗自选牌阵', group: '占卜' },
  { id: 'lenormand', label: '雷诺曼牌', group: '占卜' },
  { id: 'ssgw', label: '三山国王灵签', group: '占卜' },
  { id: 'taiyi', label: '太乙神数', group: '占卜' },
  { id: 'huangji-jingshi', label: '皇极经世', group: '占卜' },
  { id: 'wuyun-liuqi', label: '五运六气', group: '占卜' },
  { id: 'zhuge', label: '诸葛神数', group: '占卜' },
  { id: 'almanac', label: '万年历', group: '工具' },
  { id: 'residential', label: '阳宅风水', group: '工具' },
  { id: 'name-char', label: '汉字经籍', group: '工具' },
  { id: 'chinese-name', label: '姓名五格', group: '工具' },
  { id: 'chinese-naming', label: '起名方案', group: '工具' },
  { id: 'character-query', label: '汉字字典', group: '工具' },
  { id: 'zhouyi', label: '周易经文', group: '工具' },
  { id: 'number-energy', label: '数字能量', group: '工具' },
  { id: 'connect', label: '接入 AI', group: '工具' },
  { id: 'history', label: '历史记录', group: '工具' },
];

export interface HomeInstantCastOption {
  id: string;
  label: string;
  group: '常用占卜' | '宏观周期';
}

export const HOME_INSTANT_CAST_CATALOG: ReadonlyArray<HomeInstantCastOption> = [
  { id: 'liuren', label: '大六壬', group: '常用占卜' },
  { id: 'qimen', label: '奇门遁甲', group: '常用占卜' },
  { id: 'liuyao', label: '六爻', group: '常用占卜' },
  { id: 'meihua', label: '梅花易数', group: '常用占卜' },
  { id: 'xiaoliuren', label: '小六壬', group: '常用占卜' },
  { id: 'jinkoujue', label: '金口诀', group: '常用占卜' },
  { id: 'tarot', label: '塔罗', group: '常用占卜' },
  { id: 'lenormand', label: '雷诺曼', group: '常用占卜' },
  { id: 'ssgw', label: '三山灵签', group: '常用占卜' },
  { id: 'zhuge', label: '诸葛神数', group: '常用占卜' },
  { id: 'taiyi', label: '太乙神数', group: '常用占卜' },
  { id: 'huangji-jingshi', label: '皇极经世', group: '宏观周期' },
  { id: 'wuyun-liuqi', label: '五运六气', group: '宏观周期' },
];

export interface HomeChartEntryOption {
  id: string;
  label: string;
  hint: string;
}

export const HOME_CHART_ENTRY_CATALOG: ReadonlyArray<HomeChartEntryOption> = [
  { id: 'bazi', label: '八字排盘', hint: '四柱八字命盘' },
  { id: 'ziwei', label: '紫微斗数', hint: '十二宫紫微盘' },
  { id: 'astrolabe', label: '西洋星盘', hint: '本命星盘与宫位' },
  { id: 'qizheng', label: '七政四余', hint: '古法星度命盘' },
  { id: 'qimen-lifetime', label: '奇门终身', hint: '奇门终身局排盘' },
  { id: 'bazi-ziwei', label: '多术数合参', hint: '多体系综合排盘' },
  { id: 'compatibility', label: '双人合盘', hint: '八字 · 紫微 · 星盘' },
  { id: 'birth-range', label: '时辰反推', hint: '未知时辰范围校对' },
  { id: 'single', label: '单人排盘', hint: '八字 · 紫微 · 星盘 · 七政 · 奇门' },
  { id: 'compat', label: '双人合盘', hint: '八字 · 紫微 · 星盘合盘' },
  { id: 'cases', label: '个人档案', hint: '调用与管理已存生辰' },
  { id: 'fortune', label: '流运运势', hint: '日运 · 月运 · 年运（支持案例定制）' },
];

export const DEFAULT_HOME_INSTANT_CAST_IDS: ReadonlyArray<string> = [
  'liuren',
  'qimen',
  'liuyao',
  'meihua',
  'xiaoliuren',
  'jinkoujue',
  'tarot',
  'lenormand',
  'ssgw',
  'zhuge',
  'taiyi',
];

export const DEFAULT_HOME_CHART_ENTRY_IDS: ReadonlyArray<string> = ['single', 'compat', 'cases'];

export const DEFAULT_HOME_CARD_IDS: ReadonlyArray<string> = [
  'almanac',
  'residential',
  'name-char',
  'number-energy',
  'huangji-jingshi',
  'wuyun-liuqi',
];

const DRAWER_PINNED_STORAGE_KEY = 'mingyu.v2.drawerPinned';

export function readDrawerPinned(): boolean {
  try {
    const val = window.localStorage.getItem(DRAWER_PINNED_STORAGE_KEY);
    return val === null ? true : val === '1';
  } catch {}
  return true;
}

export function saveDrawerPinned(next: boolean): void {
  try {
    window.localStorage.setItem(DRAWER_PINNED_STORAGE_KEY, next ? '1' : '0');
  } catch {}
}

export function formatUpdatedAt(iso: string): string {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return `${String(dt.getMonth() + 1).padStart(2, '0')}/${String(dt.getDate()).padStart(2, '0')} ${String(
    dt.getHours(),
  ).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}

export function buildInstantPayload(
  choice: 'bazi' | 'qimen' | 'liuren' | 'qizheng' | 'ziwei' | 'bazi-ziwei' | 'astrolabe',
  timeStandard: 'beijing' | 'true-solar',
  place: { displayName: string; longitude: number; latitude: number },
  question: string,
): { method: Method; payload: Record<string, unknown> } {
  const now = new Date();
  const q = question.trim() || '请根据当下即时起盘，解析目前态势与核心吉凶。';

  if (choice === 'qimen') {
    const raw = {
      question: q,
      qimen: {
        method: '转盘',
        scope: 'hour',
        ...(timeStandard === 'true-solar'
          ? { timeStandard: 'true-solar', longitude: place.longitude }
          : { timeStandard: 'beijing' }),
      },
      prompt: { scope: 'hourly' },
    };
    return { method: 'qimen', payload: applyGlobalRulesToPayload('qimen', raw, true) as Record<string, unknown> };
  }
  if (choice === 'liuren') {
    const raw = {
      question: q,
      liuren:
        timeStandard === 'true-solar'
          ? { timeStandard: 'true-solar', longitude: place.longitude }
          : { timeStandard: 'beijing' },
      prompt: { liurenTemplate: 'general' },
    };
    return { method: 'liuren', payload: applyGlobalRulesToPayload('liuren', raw, true) as Record<string, unknown> };
  }

  const rules = loadGlobalRules();
  const tzOffset = -now.getTimezoneOffset();
  const sign = tzOffset >= 0 ? '+' : '-';
  const absMin = Math.abs(tzOffset);
  const offsetStr = `${sign}${String(Math.floor(absMin / 60)).padStart(2, '0')}:${String(
    absMin % 60,
  ).padStart(2, '0')}`;
  const raw = {
    question: q,
    birth: {
      calendar: 'solar',
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
      gender: 'male',
      timeStandard,
      clock: { kind: 'exact', hour: now.getHours(), minute: now.getMinutes() },
      referenceInstant: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate(),
      ).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes(),
      ).padStart(2, '0')}:00${offsetStr}`,
      ...(timeStandard === 'true-solar' || choice === 'astrolabe' || choice === 'qizheng'
        ? {
            locationName: place.displayName || rules.time.defaultPlaceDisplayName,
            longitude: place.longitude,
            latitude: place.latitude,
          }
        : {}),
    },
  };
  return {
    method: choice,
    payload: applyGlobalRulesToPayload(choice, raw, false) as Record<string, unknown>,
  };
}

export function isCultureTabToolMethod(
  tab: UtilityToolId | UtilityMainTabId,
): tab is Exclude<CultureToolTabId, 'number-energy'> | 'number-energy' {
  return (
    tab === 'character-query' ||
    tab === 'chinese-name' ||
    tab === 'chinese-naming' ||
    tab === 'number-energy'
  );
}
