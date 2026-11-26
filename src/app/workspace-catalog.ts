import type { Method } from '../core';
import type { CultureToolTabId } from '../v2-ui/culture-and-calendar';
import {
  PERSONAL_CHART_TABS,
  isDivinationFormMethod,
  type DivinationFormMethod,
  type PersonalChartTabId,
} from '../v2-ui/chart-payloads';
import { applyGlobalRulesToPayload, loadGlobalRules } from '../web-settings';

export type WorkspaceRouteId =
  | 'home'
  | 'fortune'
  | 'chat'
  | 'chart-input'
  | 'time-reverse'
  | 'divination-input'
  | 'utilities'
  | 'result'
  | 'history'
  | 'connect';

export type TopDomainId =
  | 'home'
  | 'fortune'
  | 'chat'
  | 'personal-chart'
  | 'divination'
  | 'utilities'
  | 'history'
  | 'connect';

export type WorkspaceThemeId = 'blossom' | 'jade' | 'indigo' | 'amber' | 'violet';
export type HomeModeId = 'divination' | 'chart' | 'instant';
export type HomePinActionMode = 'direct' | 'workbench';

export type DivinationCenterMethod = DivinationFormMethod | 'number-energy';
export type UtilityMainTabId =
  | 'almanac'
  | 'calendar'
  | 'residential'
  | 'name-char'
  | 'number-energy';
export type NameCharSubTabId =
  | 'chinese-name'
  | 'chinese-naming'
  | 'character-query'
  | 'zhouyi';
export type UtilityToolId =
  | 'almanac'
  | 'calendar'
  | 'residential'
  | 'chinese-name'
  | 'chinese-naming'
  | 'character-query'
  | 'zhouyi'
  | 'number-energy';

export interface WorkspacePreferences {
  theme: WorkspaceThemeId;
  defaultChartFeature: PersonalChartTabId;
  defaultDivinationFeature: DivinationFormMethod;
  defaultInstantType: 'bazi' | 'ziwei' | 'bazi-ziwei' | 'astrolabe' | 'qizheng';
  homeModeOrder: HomeModeId[];
  navigationOrder: string[];
}

export interface HomeTileItem {
  id: string;
  label: string;
  quickLabel?: string;
  category: 'sanshi' | 'cards' | 'timing';
}

export const WORKSPACE_THEME_DEFINITIONS: ReadonlyArray<{
  id: WorkspaceThemeId;
  label: string;
  swatches: readonly [string, string, string];
}> = [
  { id: 'blossom', label: '朱砂', swatches: ['#b83b2b', '#9c7a44', '#f6f3ec'] },
  { id: 'jade', label: '松青', swatches: ['#2e6b56', '#6d9986', '#ebf4f0'] },
  { id: 'indigo', label: '青黛', swatches: ['#355c7d', '#6c8ea8', '#ecf2f6'] },
  { id: 'amber', label: '琥珀', swatches: ['#9a6324', '#b88f54', '#f8f1e6'] },
  { id: 'violet', label: '紫檀', swatches: ['#6e4d75', '#9980a3', '#f4eff6'] },
];

export const INSTANT_OPTIONS: ReadonlyArray<{
  value: WorkspacePreferences['defaultInstantType'];
  label: string;
}> = [
  { value: 'bazi', label: '即时八字' },
  { value: 'ziwei', label: '即时紫微' },
  { value: 'bazi-ziwei', label: '即时八字紫微' },
  { value: 'astrolabe', label: '即时星盘' },
  { value: 'qizheng', label: '即时七政四余' },
];

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
  { id: 'almanac', label: '择吉万年历' },
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
  { id: 'ssgw', label: '三山灵签' },
];

export const UTILITY_MAIN_TABS: ReadonlyArray<{ id: UtilityMainTabId; label: string }> = [
  { id: 'almanac', label: '择吉万年历' },
  { id: 'calendar', label: '干支天文历' },
  { id: 'residential', label: '阳宅风水' },
  { id: 'name-char', label: '汉字经籍' },
  { id: 'number-energy', label: '数字能量' },
];

export const NAME_CHAR_SUB_TABS: ReadonlyArray<{ id: NameCharSubTabId; label: string }> = [
  { id: 'chinese-name', label: '姓名五格' },
  { id: 'chinese-naming', label: '起名方案' },
  { id: 'character-query', label: '汉字字典' },
  { id: 'zhouyi', label: '周易经文' },
];

export const HOME_ALL_TILES: ReadonlyArray<HomeTileItem> = [
  { id: 'liuren', label: '大六壬', quickLabel: '⚡起课', category: 'sanshi' },
  { id: 'qimen', label: '奇门遁甲', quickLabel: '⚡起局', category: 'sanshi' },
  { id: 'liuyao', label: '六爻', quickLabel: '⚡起卦', category: 'sanshi' },
  { id: 'meihua', label: '梅花易数', quickLabel: '⚡起卦', category: 'sanshi' },
  { id: 'xiaoliuren', label: '小六壬', quickLabel: '⚡起课', category: 'sanshi' },
  { id: 'jinkoujue', label: '金口诀', quickLabel: '⚡起课', category: 'sanshi' },
  { id: 'taiyi', label: '太乙神数', category: 'sanshi' },
  { id: 'tarot', label: '塔罗占卜', quickLabel: '⚡抽牌', category: 'cards' },
  { id: 'lenormand', label: '雷诺曼牌', quickLabel: '⚡抽牌', category: 'cards' },
  { id: 'ssgw', label: '三山国王灵签', quickLabel: '⚡求签', category: 'cards' },
  { id: 'zhuge', label: '诸葛神数', category: 'cards' },
  { id: 'huangji-jingshi', label: '皇极经世', category: 'cards' },
  { id: 'wuyun-liuqi', label: '五运六气', category: 'cards' },
  { id: 'almanac', label: '择吉万年历', category: 'timing' },
  { id: 'calendar', label: '干支天文历', category: 'timing' },
  { id: 'residential', label: '阳宅风水', category: 'timing' },
  { id: 'chinese-name', label: '姓名五格', category: 'timing' },
  { id: 'chinese-naming', label: '起名方案', category: 'timing' },
  { id: 'character-query', label: '汉字字典', category: 'timing' },
  { id: 'zhouyi', label: '周易经文', category: 'timing' },
  { id: 'number-energy', label: '数字能量', category: 'timing' },
];

const WORKSPACE_PREFERENCES_STORAGE_KEY = 'mingyu_workspace_preferences_v5';
const HOME_PINS_STORAGE_KEY = 'mingyu.v2.pinnedHomeItems';
const HOME_PIN_ACTION_STORAGE_KEY = 'mingyu.v2.homePinActionMode';
const DEFAULT_HOME_PINS = ['liuren', 'tarot', 'liuyao', 'qimen', 'meihua', 'almanac'];

export const DEFAULT_WORKSPACE_PREFERENCES: WorkspacePreferences = {
  theme: 'blossom',
  defaultChartFeature: 'bazi',
  defaultDivinationFeature: 'liuyao',
  defaultInstantType: 'bazi',
  homeModeOrder: ['chart', 'divination', 'instant'],
  navigationOrder: ['bazi', 'ziwei', 'liuyao', 'meihua', 'qimen', 'liuren'],
};

export function readWorkspacePreferences(): WorkspacePreferences {
  try {
    const raw = localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_WORKSPACE_PREFERENCES };
    }
    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences>;
    const theme: WorkspaceThemeId =
      parsed.theme === 'jade' ||
      parsed.theme === 'indigo' ||
      parsed.theme === 'amber' ||
      parsed.theme === 'violet' ||
      parsed.theme === 'blossom'
        ? parsed.theme
        : 'blossom';
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
    const defaultInstantType =
      parsed.defaultInstantType &&
      INSTANT_OPTIONS.some((o) => o.value === parsed.defaultInstantType)
        ? parsed.defaultInstantType
        : 'bazi';
    return {
      ...DEFAULT_WORKSPACE_PREFERENCES,
      theme,
      defaultChartFeature,
      defaultDivinationFeature,
      defaultInstantType,
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

export function readHomePinActionMode(): HomePinActionMode {
  try {
    const saved = window.localStorage.getItem(HOME_PIN_ACTION_STORAGE_KEY);
    if (saved === 'direct' || saved === 'workbench') return saved;
  } catch {}
  return 'direct';
}

export function saveHomePinActionMode(next: HomePinActionMode): void {
  try {
    window.localStorage.setItem(HOME_PIN_ACTION_STORAGE_KEY, next);
  } catch {}
}

export function readHomePinnedIds(): string[] {
  try {
    const raw = window.localStorage.getItem(HOME_PINS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((x): x is string => typeof x === 'string');
      }
    }
  } catch {}
  return [...DEFAULT_HOME_PINS];
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
  { id: 'bazi-ziwei', label: '星平合参', group: '命盘' },
  { id: 'astrolabe', label: '西洋星盘', group: '命盘' },
  { id: 'qizheng', label: '七政四余', group: '命盘' },
  { id: 'qimen-lifetime', label: '奇门终身', group: '命盘' },
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
  { id: 'almanac', label: '择吉万年历', group: '工具' },
  { id: 'calendar', label: '干支天文历', group: '工具' },
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
  mark: string;
  label: string;
  group: '常用占卜' | '宏观周期';
}

export const HOME_INSTANT_CAST_CATALOG: ReadonlyArray<HomeInstantCastOption> = [
  { id: 'liuren', mark: '壬', label: '大六壬', group: '常用占卜' },
  { id: 'qimen', mark: '奇', label: '奇门遁甲', group: '常用占卜' },
  { id: 'liuyao', mark: '爻', label: '六爻', group: '常用占卜' },
  { id: 'meihua', mark: '梅', label: '梅花易数', group: '常用占卜' },
  { id: 'xiaoliuren', mark: '小', label: '小六壬', group: '常用占卜' },
  { id: 'jinkoujue', mark: '诀', label: '金口诀', group: '常用占卜' },
  { id: 'tarot', mark: '塔', label: '塔罗', group: '常用占卜' },
  { id: 'lenormand', mark: '雷', label: '雷诺曼', group: '常用占卜' },
  { id: 'ssgw', mark: '签', label: '三山灵签', group: '常用占卜' },
  { id: 'zhuge', mark: '诸', label: '诸葛神数', group: '常用占卜' },
  { id: 'taiyi', mark: '乙', label: '太乙神数', group: '常用占卜' },
  { id: 'huangji-jingshi', mark: '皇', label: '皇极经世', group: '宏观周期' },
  { id: 'wuyun-liuqi', mark: '运', label: '五运六气', group: '宏观周期' },
];

export interface HomeChartEntryOption {
  id: string;
  label: string;
  hint: string;
}

export const HOME_CHART_ENTRY_CATALOG: ReadonlyArray<HomeChartEntryOption> = [
  { id: 'single', label: '个人排盘', hint: '八字 · 紫微 · 七政 · 星盘 · 奇门终身' },
  { id: 'compat', label: '双人合盘', hint: '八字 · 紫微 · 星盘' },
  { id: 'cases', label: '档案', hint: '快速调用已存命造' },
  { id: 'fortune', label: '流运运势', hint: '日运 · 月运 · 年运（支持案例定制）' },
  { id: 'bazi', label: '八字排盘', hint: '四柱八字命盘' },
  { id: 'ziwei', label: '紫微斗数', hint: '十二宫紫微盘' },
  { id: 'bazi-ziwei', label: '星平合参', hint: '八字紫微双盘对照' },
  { id: 'astrolabe', label: '西洋星盘', hint: '本命星盘与宫位' },
  { id: 'qizheng', label: '七政四余', hint: '古法星度命盘' },
  { id: 'qimen-lifetime', label: '奇门终身', hint: '奇门终身局排盘' },
];

export interface HomeInstantChipOption {
  id: string;
  label: string;
}

export const HOME_INSTANT_CHIP_CATALOG: ReadonlyArray<HomeInstantChipOption> = [
  { id: 'instant-bazi', label: '八字' },
  { id: 'instant-ziwei', label: '紫微' },
  { id: 'instant-astrolabe', label: '星盘' },
  { id: 'instant-qizheng', label: '七政' },
  { id: 'qimen', label: '奇门' },
  { id: 'liuren', label: '六壬' },
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

export const DEFAULT_HOME_INSTANT_CHIP_IDS: ReadonlyArray<string> = [
  'instant-bazi',
  'instant-ziwei',
  'instant-astrolabe',
  'instant-qizheng',
];

export const DEFAULT_HOME_CARD_IDS: ReadonlyArray<string> = [
  'fortune',
  'almanac',
  'residential',
  'name-char',
  'number-energy',
  'taiyi',
  'huangji-jingshi',
  'wuyun-liuqi',
  'zhuge',
];

export interface HomeCustomizationState {
  instantCastIds: string[];
  chartEntryIds: string[];
  instantChipIds: string[];
  cardIds: string[];
}

export function createDefaultHomeCustomization(): HomeCustomizationState {
  return {
    instantCastIds: [...DEFAULT_HOME_INSTANT_CAST_IDS],
    chartEntryIds: [...DEFAULT_HOME_CHART_ENTRY_IDS],
    instantChipIds: [...DEFAULT_HOME_INSTANT_CHIP_IDS],
    cardIds: [...DEFAULT_HOME_CARD_IDS],
  };
}

const HOME_CUSTOMIZATION_STORAGE_KEY = 'mingyu.v2.homeCustomization';
const DRAWER_PINNED_STORAGE_KEY = 'mingyu.v2.drawerPinned';

function filterValidUniqueIds(raw: unknown, validIds: Set<string>): string[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string' && validIds.has(item) && !seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

export function readHomeCustomization(): HomeCustomizationState {
  const defaults = createDefaultHomeCustomization();
  try {
    const raw = window.localStorage.getItem(HOME_CUSTOMIZATION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<HomeCustomizationState>;
      const validInstant = new Set(HOME_INSTANT_CAST_CATALOG.map((item) => item.id));
      const validChart = new Set(HOME_CHART_ENTRY_CATALOG.map((item) => item.id));
      const validChip = new Set(HOME_INSTANT_CHIP_CATALOG.map((item) => item.id));
      const validCard = new Set(CUSTOM_SHORTCUT_CATALOG.map((item) => item.id));
      return {
        instantCastIds:
          filterValidUniqueIds(parsed.instantCastIds, validInstant) ?? defaults.instantCastIds,
        chartEntryIds:
          filterValidUniqueIds(parsed.chartEntryIds, validChart) ?? defaults.chartEntryIds,
        instantChipIds:
          filterValidUniqueIds(parsed.instantChipIds, validChip) ?? defaults.instantChipIds,
        cardIds: filterValidUniqueIds(parsed.cardIds, validCard) ?? defaults.cardIds,
      };
    }
  } catch {}
  return defaults;
}

export function saveHomeCustomization(next: HomeCustomizationState): void {
  try {
    window.localStorage.setItem(HOME_CUSTOMIZATION_STORAGE_KEY, JSON.stringify(next));
  } catch {}
}

export function resetHomeCustomization(): HomeCustomizationState {
  const defaults = createDefaultHomeCustomization();
  saveHomeCustomization(defaults);
  return defaults;
}

function sameIdList(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  return a.length === b.length && a.every((val, idx) => val === b[idx]);
}

export function isHomeCustomizationModified(state: HomeCustomizationState): boolean {
  return !(
    sameIdList(state.instantCastIds, DEFAULT_HOME_INSTANT_CAST_IDS) &&
    sameIdList(state.chartEntryIds, DEFAULT_HOME_CHART_ENTRY_IDS) &&
    sameIdList(state.instantChipIds, DEFAULT_HOME_INSTANT_CHIP_IDS) &&
    sameIdList(state.cardIds, DEFAULT_HOME_CARD_IDS)
  );
}

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

export function saveHomePinnedIds(next: string[]): void {
  try {
    window.localStorage.setItem(HOME_PINS_STORAGE_KEY, JSON.stringify(next));
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
