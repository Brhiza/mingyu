import { createShuffledTarotDeck, drawNext, type ShuffledTarotCard } from '../interactive';
import { methodLabels, type Method } from '../schema';
import { loadGlobalRules } from '../web-settings';
import { mountains, mountainTrigram } from '../systems/compass';
import { type LocationEntry } from '../systems/location';
import tarotData from '../systems/tarot-data.json';
import lenormandData from '../systems/lenormand-data.json';
import {
  createLenormandCardFace,
  createTarotCardBack,
  createTarotCardFace,
} from '../web-boards/tarot-card-art';
import { openBirthPlaceModal } from './birth-place-modal';
import { createAstroCalendarWidget, renderGanzhiCalendarPanel } from './culture-and-calendar';
import {
  renderInteractiveLiuyaoStudio,
  renderInteractiveLotRitual,
  rollShengbeiResult,
  rollThreeCoins,
  type CoinThrow,
} from './manual-cast-studio';

import {
  DIVINATION_FORM_METHODS,
  isDivinationFormMethod,
  type DivinationFormMethod,
} from './chart-payloads';

export {
  DIVINATION_FORM_METHODS,
  isDivinationFormMethod,
  type DivinationFormMethod,
};

export interface DivinationFormOptions {
  container: HTMLElement;
  method: DivinationFormMethod;
  initialPayload?: Record<string, unknown>;
  tarotMajorOnly?: boolean;
  onChange?: (payload: Record<string, unknown>) => void;
  onSubmit?: (payload: Record<string, unknown>) => void;
  showSubmitButton?: boolean;
}

type DrawnCardItem = {
  id: number;
  name: string;
  position: string;
  reversed?: boolean;
};

type AlmanacParticipantDraft = {
  id: string;
  name: string;
  gender: '' | '男' | '女';
  year: string;
  month: string;
  day: string;
  shichenIndex: string;
  calendar: 'solar' | 'lunar';
};

const LIUYAO_YAO_OPTIONS: ReadonlyArray<{ value: 6 | 7 | 8 | 9; label: string; short: string }> = [
  { value: 7, label: '7 · 少阳', short: '少阳' },
  { value: 8, label: '8 · 少阴', short: '少阴' },
  { value: 9, label: '9 · 老阳 ○', short: '老阳 ○' },
  { value: 6, label: '6 · 老阴 ×', short: '老阴 ×' },
];

const MEIHUA_METHODS: ReadonlyArray<{
  id: 'time' | 'number' | 'character' | 'sound' | 'direction';
  label: string;
  mark: string;
}> = [
  { id: 'time', label: '时间起卦', mark: '时' },
  { id: 'number', label: '报数起卦', mark: '数' },
  { id: 'character', label: '汉字起卦', mark: '字' },
  { id: 'sound', label: '声音起卦', mark: '声' },
  { id: 'direction', label: '方位物象', mark: '方' },
];

const MEIHUA_DIRECTIONS: ReadonlyArray<{ value: string; label: string; glyph: string }> = [
  { value: 'southeast', label: '东南 · 巽', glyph: '☴' },
  { value: 'south', label: '正南 · 离', glyph: '☲' },
  { value: 'southwest', label: '西南 · 坤', glyph: '☷' },
  { value: 'east', label: '正东 · 震', glyph: '☳' },
  { value: 'west', label: '正西 · 兑', glyph: '☱' },
  { value: 'northeast', label: '东北 · 艮', glyph: '☶' },
  { value: 'north', label: '正北 · 坎', glyph: '☵' },
  { value: 'northwest', label: '西北 · 乾', glyph: '☰' },
];

const MEIHUA_OBJECTS: ReadonlyArray<{ value: string; label: string; glyph: string }> = [
  { value: 'heaven', label: '天象 · 乾', glyph: '☰' },
  { value: 'lake', label: '泽水 · 兑', glyph: '☱' },
  { value: 'fire', label: '火光 · 离', glyph: '☲' },
  { value: 'thunder', label: '雷电 · 震', glyph: '☳' },
  { value: 'wind', label: '风木 · 巽', glyph: '☴' },
  { value: 'water', label: '流水 · 坎', glyph: '☵' },
  { value: 'mountain', label: '山石 · 艮', glyph: '☶' },
  { value: 'earth', label: '大地 · 坤', glyph: '☷' },
];

const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

const ALMANAC_TOPICS: ReadonlyArray<{ value: string; label: string; desc: string }> = [
  { value: 'marriage', label: '嫁娶订婚', desc: '领证、婚礼、纳采问名' },
  { value: 'move', label: '入宅搬家', desc: '乔迁新居、安床入户' },
  { value: 'opening', label: '开业开市', desc: '店铺开张、项目启动' },
  { value: 'travel', label: '出行远行', desc: '旅游、出差、赴任远行' },
  { value: 'renovation', label: '动土修造', desc: '装修开工、破土修缮' },
  { value: 'contract', label: '签约交易', desc: '商务签署、置业纳财' },
  { value: 'medical', label: '求医问药', desc: '体检、手术、调理养生' },
  { value: 'study', label: '入学赴试', desc: '进修、考试、拜师习艺' },
  { value: 'burial', label: '安葬祭祀', desc: '安葬、立碑、祭奠追思' },
  { value: 'custom', label: '自定义事项', desc: '输入特定黄历宜忌词' },
];

const CONSTRUCTION_PERIODS: ReadonlyArray<{ label: string; year: number; desc: string }> = [
  { label: '九运 2024–2043', year: 2024, desc: '下元九紫离火运' },
  { label: '八运 2004–2023', year: 2008, desc: '下元八白艮土运' },
  { label: '七运 1984–2003', year: 1996, desc: '下元七赤兑金运' },
  { label: '六运 1964–1983', year: 1975, desc: '中元六白乾金运' },
];

const SHICHEN_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: '时辰不详' },
  { value: '0', label: '早子时 (00:00–01:00)' },
  { value: '1', label: '丑时 (01:00–03:00)' },
  { value: '2', label: '寅时 (03:00–05:00)' },
  { value: '3', label: '卯时 (05:00–07:00)' },
  { value: '4', label: '辰时 (07:00–09:00)' },
  { value: '5', label: '巳时 (09:00–11:00)' },
  { value: '6', label: '午时 (11:00–13:00)' },
  { value: '7', label: '未时 (13:00–15:00)' },
  { value: '8', label: '申时 (15:00–17:00)' },
  { value: '9', label: '酉时 (17:00–19:00)' },
  { value: '10', label: '戌时 (19:00–21:00)' },
  { value: '11', label: '亥时 (21:00–23:00)' },
  { value: '12', label: '晚子时 (23:00–24:00)' },
];

const TAROT_SPREAD_LIST: ReadonlyArray<{
  id: string;
  name: string;
  cardCount: number;
  positions: readonly string[];
  description: string;
}> = Object.entries(tarotData.spreads).map(([id, item]) => ({
  id,
  name: item.name,
  cardCount: item.cardCount,
  positions: item.positions,
  description: item.description,
}));

const TAROT_SPREAD_CATEGORIES: ReadonlyArray<{
  id: 'common' | 'love' | 'career' | 'deep';
  label: string;
  spreadIds: readonly string[];
}> = [
  {
    id: 'common',
    label: '常用通用',
    spreadIds: ['single', 'three', 'holyTriangle', 'fourElements'],
  },
  {
    id: 'love',
    label: '感情人际',
    spreadIds: ['love', 'relationship', 'decision'],
  },
  {
    id: 'career',
    label: '事业财富',
    spreadIds: ['career', 'wealth', 'problemSolving', 'horseshoe'],
  },
  {
    id: 'deep',
    label: '深度全息',
    spreadIds: ['celtic', 'year', 'twelveHouses', 'chakra', 'mindBodySpirit', 'hexagram', 'universal'],
  },
];

const FENGSHUI_COMPASS_GROUPS: ReadonlyArray<{
  id: string;
  label: string;
  subLabel: string;
  mountains: readonly [string, string, string];
}> = [
  { id: '坎', label: '坐北朝南 · 坎宅', subLabel: '壬 / 子 / 癸山', mountains: ['壬', '子', '癸'] },
  { id: '离', label: '坐南朝北 · 离宅', subLabel: '丙 / 午 / 丁山', mountains: ['丙', '午', '丁'] },
  { id: '震', label: '坐东朝西 · 震宅', subLabel: '甲 / 卯 / 乙山', mountains: ['甲', '卯', '乙'] },
  { id: '兑', label: '坐西朝东 · 兑宅', subLabel: '庚 / 酉 / 辛山', mountains: ['庚', '酉', '辛'] },
  { id: '巽', label: '坐东南朝西北 · 巽宅', subLabel: '辰 / 巽 / 巳山', mountains: ['辰', '巽', '巳'] },
  { id: '坤', label: '坐西南朝东北 · 坤宅', subLabel: '未 / 坤 / 申山', mountains: ['未', '坤', '申'] },
  { id: '乾', label: '坐西北朝东南 · 乾宅', subLabel: '戌 / 乾 / 亥山', mountains: ['戌', '乾', '亥'] },
  { id: '艮', label: '坐东北朝西南 · 艮宅', subLabel: '丑 / 艮 / 寅山', mountains: ['丑', '艮', '寅'] },
];

const LENORMAND_SPREAD_LIST: ReadonlyArray<{
  id: string;
  name: string;
  cardCount: number;
  positions: readonly string[];
}> = Object.entries(lenormandData.spreads).map(([id, item]) => ({
  id,
  name: item.name,
  cardCount: item.positions.length,
  positions: item.positions,
}));

function getBeijingNowParts(): {
  year: number;
  month: number;
  day: number;
  dateStr: string;
  timeStr: string;
} {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const year = Number(map.year || 2026);
  const month = Number(map.month || 1);
  const day = Number(map.day || 1);
  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const hour = map.hour === '24' ? '00' : map.hour;
  const timeStr = `${hour}:${map.minute}`;
  return { year, month, day, dateStr, timeStr };
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return dateStr;
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toBeijingIso(dateStr: string, timeStr: string): string {
  const cleanDate = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : getBeijingNowParts().dateStr;
  const timeParts = timeStr.split(':');
  const hh = (timeParts[0] || '12').padStart(2, '0');
  const mm = (timeParts[1] || '00').padStart(2, '0');
  const ss = (timeParts[2] || '00').padStart(2, '0');
  return `${cleanDate}T${hh}:${mm}:${ss}+08:00`;
}

/**
 * 打开三列省市区县地点选择弹窗（直接复用 `birth-place-modal.ts`）。
 */
export function openPlacePickerModal(options: {
  title?: string;
  currentDisplayName?: string;
  onSelect: (entry: LocationEntry) => void;
}): void {
  openBirthPlaceModal({
    purpose: 'observer',
    initialPlace: options.currentDisplayName,
    onConfirm: (selection) => {
      options.onSelect({
        name: selection.districtName,
        displayName: selection.displayName,
        level: selection.isOverseas ? 'overseas' : 'district',
        country: selection.isOverseas ? selection.cityName : '中国',
        province: selection.provinceName,
        city: selection.cityName,
        district: selection.districtName,
        longitude: selection.longitude,
        latitude: selection.latitude,
        ...(selection.timezone !== undefined ? { timezone: selection.timezone } : {}),
        ...(selection.timeZoneId ? { timeZoneId: selection.timeZoneId } : {}),
      });
    },
  });
}

function createSegmented<T extends string>(
  currentValue: T,
  options: ReadonlyArray<{ id: T; label: string }>,
  onSelect: (next: T) => void,
): HTMLElement {
  let activeVal = currentValue;
  const seg = document.createElement('div');
  seg.className = 'workspace-ui-segmented';
  const activeIdx = Math.max(
    0,
    options.findIndex((o) => o.id === activeVal),
  );
  const indicator = document.createElement('div');
  indicator.className = 'workspace-ui-segmented-indicator';
  indicator.style.width = `${100 / Math.max(1, options.length)}%`;
  indicator.style.left = `${(100 / Math.max(1, options.length)) * activeIdx}%`;
  seg.appendChild(indicator);

  const buttons: HTMLButtonElement[] = [];
  options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `workspace-ui-segmented-item workspace-ui-segmented-option${
      activeVal === opt.id ? ' is-active' : ''
    }`;
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      if (activeVal === opt.id) return;
      activeVal = opt.id;
      indicator.style.left = `${(100 / Math.max(1, options.length)) * idx}%`;
      buttons.forEach((b, bIdx) => {
        b.classList.toggle('is-active', bIdx === idx);
      });
      onSelect(opt.id);
    });
    buttons.push(btn);
    seg.appendChild(btn);
  });
  return seg;
}

function createCardOptionGrid<T extends string>(
  currentValue: T,
  options: ReadonlyArray<{ id: T; label: string; mark?: string; instant?: boolean }>,
  onSelect: (next: T) => void,
  columns?: 2 | 3 | 4,
): HTMLElement {
  let activeVal = currentValue;
  const grid = document.createElement('div');
  const colClass = columns
    ? `is-cols-${columns}`
    : options.length === 4
      ? 'is-cols-4'
      : options.length === 3
        ? 'is-cols-3'
        : options.length >= 5
          ? 'is-cols-auto'
          : 'is-cols-2';
  grid.className = `divination-card-selector-grid ${colClass}`;
  const buttons: Array<{ btn: HTMLButtonElement; indicator: HTMLSpanElement }> = [];

  options.forEach((opt) => {
    const isInitiallyActive = activeVal === opt.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `divination-card-option${isInitiallyActive ? ' is-active' : ''}`;
    btn.setAttribute('aria-pressed', String(isInitiallyActive));

    const topRow = document.createElement('div');
    topRow.className = 'divination-card-option-top';

    const badge = document.createElement('span');
    badge.className = 'divination-card-option-mark';
    badge.textContent = opt.mark ?? Array.from(opt.label)[0] ?? '占';

    const indicator = document.createElement('span');
    indicator.className = 'divination-card-option-indicator';
    indicator.setAttribute('aria-hidden', 'true');
    indicator.textContent = !opt.instant && isInitiallyActive ? '✓' : '↗';

    topRow.append(badge, indicator);

    const labelSpan = document.createElement('strong');
    labelSpan.className = 'divination-card-option-label';
    labelSpan.textContent = opt.label;

    btn.append(topRow, labelSpan);
    btn.addEventListener('click', () => {
      if (!opt.instant && activeVal === opt.id) return;
      activeVal = opt.id;
      buttons.forEach((entry, idx) => {
        const entryOpt = options[idx]!;
        const isSel = entryOpt.id === activeVal;
        entry.btn.classList.toggle('is-active', isSel);
        entry.btn.setAttribute('aria-pressed', String(isSel));
        entry.indicator.textContent = !entryOpt.instant && isSel ? '✓' : '↗';
      });
      onSelect(opt.id);
    });
    buttons.push({ btn, indicator });
    grid.appendChild(btn);
  });

  return grid;
}

/**
 * 渲染 1:1 复刻 V1 的传统占卜、黄历择日与八宅/玄空/住宅风水手工定制表单。
 * 严格使用 V1 原版 DOM 结构与 CSS 类名。
 */
export function renderDivinationForm(options: DivinationFormOptions): void {
  const {
    container,
    method,
    initialPayload = {},
    onChange,
    onSubmit,
    showSubmitButton = false,
  } = options;
  const nowParts = getBeijingNowParts();
  const globalPrefs = loadGlobalRules();

  // 时间与真太阳时状态（读取全局偏好默认值）
  let timeMode: 'current' | 'custom' = globalPrefs.time.defaultDivinationTimeMode;
  let customDate = nowParts.dateStr;
  let customTime = nowParts.timeStr;
  let useTrueSolar = globalPrefs.time.defaultTimeStandard === 'true-solar';
  let placeDisplayName = globalPrefs.time.defaultPlaceDisplayName || '北京市 东城区';
  let placeLongitude = globalPrefs.time.defaultPlaceLongitude || 116.416;
  let placeLatitude = globalPrefs.time.defaultPlaceLatitude || 39.928;

  // 六爻状态
  let liuyaoCastMode: 'coins' | 'manual' | 'yarrow' | 'time' = globalPrefs.casting.liuyaoDefaultMethod;
  let liuyaoCoinThrows: CoinThrow[] = [];
  let liuyaoShaking = false;
  let liuyaoManualYaos: Array<6 | 7 | 8 | 9> = [7, 8, 7, 8, 7, 8];
  let liuyaoYarrowYaos: Array<6 | 7 | 8 | 9> = [];

  // 梅花状态
  let meihuaCastMode: 'time' | 'number' | 'character' | 'sound' | 'direction' =
    globalPrefs.casting.meihuaDefaultMethod;
  let meihuaNumber = '';
  let meihuaCharText = '';
  let meihuaSoundCount = '';
  let meihuaDirection = 'south';
  let meihuaObjectType = 'fire';

  // 时课类核心状态
  let qimenMethod: 'zhuanpan' | 'feipan' = globalPrefs.casting.qimenDefaultMethod;
  let qimenScope: 'hour' | 'day' | 'month' | 'year' = 'hour';
  let liurenGuiRenTable: 'jia-wu-geng-chou-wei' | 'jia-yang-wu-geng-niu' =
    globalPrefs.liuren.guiRenTable;
  let jinkoujueMode: 'time' | 'branch' | 'number' | 'random' =
    globalPrefs.casting.jinkoujueDefaultMethod;
  let jinkoujueBranch = '午';
  let jinkoujueNumber = '';
  let taiyiScope: 'year' | 'month' | 'day' | 'hour' = 'year';
  let taiyiYear = String(nowParts.year);
  let xiaoliurenRule: 'common' | 'duoneng' = globalPrefs.casting.xiaoliurenDefaultRule;
  let huangjiMode: 'year' | 'datetime' | 'six-day' = 'year';
  let huangjiYear = String(nowParts.year);
  let wuyunYear = String(nowParts.year);

  // 牌卡与灵签类状态
  let tarotDeckScope: 'all' | 'major' =
    options.tarotMajorOnly ||
    (initialPayload.tarot as { deckScope?: string } | undefined)?.deckScope === 'major'
      ? 'major'
      : 'all';
  let tarotSpreadId = 'three';
  let tarotCategoryId: 'common' | 'love' | 'career' | 'deep' = 'common';
  let tarotDrawMode: 'interactive' | 'random' | 'manual' = globalPrefs.casting.tarotDefaultDrawMode;
  let tarotReversalMode: 'realistic' | 'balanced' | 'upright-only' = (() => {
    const initialMode = (initialPayload.tarot as { reversalMode?: string } | undefined)?.reversalMode;
    if (initialMode === 'realistic' || initialMode === 'balanced' || initialMode === 'upright-only') return initialMode;
    return globalPrefs.casting.tarotReversalMode;
  })();
  let tarotDrawnCards: DrawnCardItem[] = [];
  let tarotShuffledDeck: ShuffledTarotCard[] | null = null;
  let isDrawingInteractiveCard = false;
  let lenormandSpreadId = 'three';
  let lenormandDrawMode: 'interactive' | 'random' | 'manual' =
    globalPrefs.casting.lenormandDefaultDrawMode;
  let lenormandDrawnCards: DrawnCardItem[] = [];
  let zhugeCastMode: 'text' | 'numbers' | 'coins' =
    globalPrefs.casting.kongmingDefaultMode === 'random' ? 'coins' : 'text';
  let zhugeChars: [string, string, string] = ['', '', ''];
  let zhugeNumbers: [string, string, string] = ['', '', ''];
  let ssgwMode: 'interactive' | 'manual' | 'random' = globalPrefs.casting.ssgwDefaultMode;
  let ssgwNumber = '';
  let ssgwConfirmed = false;
  let ssgwBeiMessage = '';
  let ssgwBeiPair: readonly ['yang' | 'yin', 'yang' | 'yin'] | undefined;
  let ssgwBeiHistory: Array<{ short: string; ok: boolean }> = [];
  let ssgwShaking = false;
  let ssgwThrowing = false;
  let kongmingCoins: Array<'●' | '○'> = Array.from({ length: 5 }, () =>
    Math.random() < 0.5 ? '●' : '○',
  );

  // 黄历择日与万年历联动状态
  let almanacSubTab: 'select' | 'astro' = 'select';
  let almanacTopic = 'move';
  let almanacCustomKeyword = '';
  let almanacStartDate = nowParts.dateStr;
  let almanacEndDate = addDaysToDateStr(nowParts.dateStr, 6);
  let almanacWeekendPref: 'any' | 'prefer' | 'avoid' = 'any';
  let almanacTimePrefs: Array<'work-hours' | 'morning' | 'afternoon'> = [];
  let almanacParticipants: AlmanacParticipantDraft[] = [];
  const almanacAstroWidget =
    method === 'almanac' ? createAstroCalendarWidget({ initialDate: almanacStartDate }) : null;

  // 八宅 / 玄空 / 住宅风水状态
  let fengshuiOrientationKind: 'mountain' | 'degree' = 'mountain';
  let fengshuiSitMountain = '子';
  let fengshuiDegree = 0;
  let fengshuiConstructionYear = 2024;
  let fengshuiFlowYear = nowParts.year;
  let fengshuiMode: '下卦' | '替卦' = '下卦';
  let fengshuiPersonYear = '1990';
  let fengshuiPersonGender: 'male' | 'female' = 'female';

  function buildPayload(): Record<string, unknown> {
    const question = getDefaultQuestionForMethod(method);
    const divinationTimeIso =
      timeMode === 'custom' ? toBeijingIso(customDate, customTime) : undefined;

    switch (method) {
      case 'liuyao': {
        const liuyaoObj: Record<string, unknown> = {};
        let dt: string | undefined;
        if (liuyaoCastMode === 'time') {
          liuyaoObj.method = 'time';
          dt = divinationTimeIso;
        } else if (liuyaoCastMode === 'coins') {
          liuyaoObj.method = 'coins';
          if (liuyaoCoinThrows.length === 6) {
            liuyaoObj.coinThrows = liuyaoCoinThrows.map((item) => ({
              coins: [...item.coins],
              total: item.total,
            }));
          }
        } else if (liuyaoCastMode === 'manual') {
          liuyaoObj.method = 'manual';
          liuyaoObj.yaos = [...liuyaoManualYaos];
        } else {
          if (liuyaoYarrowYaos.length === 6) {
            liuyaoObj.method = 'manual';
            liuyaoObj.yaos = [...liuyaoYarrowYaos];
          } else {
            liuyaoObj.method = 'yarrow';
          }
        }
        return {
          question,
          ...(dt ? { divinationTime: dt } : {}),
          liuyao: liuyaoObj,
        };
      }

      case 'meihua': {
        const meihuaObj: Record<string, unknown> = {};
        let dt: string | undefined;
        if (meihuaCastMode === 'time') {
          meihuaObj.method = 'time';
          dt = divinationTimeIso;
        } else if (meihuaCastMode === 'number') {
          meihuaObj.method = 'number';
          meihuaObj.number = Math.max(1, Number.parseInt(meihuaNumber, 10) || 1);
        } else if (meihuaCastMode === 'character') {
          meihuaObj.method = 'character';
          meihuaObj.characterText = meihuaCharText.trim();
        } else if (meihuaCastMode === 'sound') {
          meihuaObj.method = 'sound';
          meihuaObj.soundCount = Math.max(1, Number.parseInt(meihuaSoundCount, 10) || 3);
        } else if (meihuaCastMode === 'direction') {
          meihuaObj.method = 'direction';
          meihuaObj.direction = meihuaDirection;
          meihuaObj.objectType = meihuaObjectType;
        }
        return {
          question,
          ...(dt ? { divinationTime: dt } : {}),
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
          ...(divinationTimeIso ? { divinationTime: divinationTimeIso } : {}),
          qimen: {
            method: qimenMethod,
            scope: qimenScope,
            ...(useTrueSolar
              ? { timeStandard: 'true-solar', longitude: placeLongitude }
              : { timeStandard: 'beijing' }),
          },
          prompt: { scope: scopeToPrompt[qimenScope] },
        };
      }

      case 'liuren': {
        return {
          question,
          ...(divinationTimeIso ? { divinationTime: divinationTimeIso } : {}),
          liuren: {
            ...(useTrueSolar
              ? { timeStandard: 'true-solar', longitude: placeLongitude }
              : { timeStandard: 'beijing' }),
            guiRenTable: liurenGuiRenTable,
          },
        };
      }

      case 'jinkoujue': {
        const jkj: Record<string, unknown> = {
          method: jinkoujueMode,
          ...(useTrueSolar
            ? { timeStandard: 'true-solar', longitude: placeLongitude }
            : { timeStandard: 'beijing' }),
        };
        if (jinkoujueMode === 'branch') jkj.branch = jinkoujueBranch;
        if (jinkoujueMode === 'number') {
          jkj.number = Math.max(1, Number.parseInt(jinkoujueNumber, 10) || 7);
        }
        return {
          question,
          ...(divinationTimeIso ? { divinationTime: divinationTimeIso } : {}),
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
        if (taiyiScope === 'year') {
          return {
            question,
            taiyi: {
              scope: 'year',
              year: Math.min(2200, Math.max(1900, Number.parseInt(taiyiYear, 10) || nowParts.year)),
            },
            prompt: { scope: 'yearly' },
          };
        }
        return {
          question,
          taiyi: {
            scope: taiyiScope,
            ...(divinationTimeIso ? { date: divinationTimeIso } : {}),
            ...(useTrueSolar
              ? { timeStandard: 'true-solar', longitude: placeLongitude }
              : { timeStandard: 'beijing' }),
          },
          prompt: { scope: scopeMap[taiyiScope] },
        };
      }

      case 'xiaoliuren': {
        return {
          question,
          ...(divinationTimeIso ? { divinationTime: divinationTimeIso } : {}),
          xiaoliuren: { rule: xiaoliurenRule },
        };
      }

      case 'huangji-jingshi': {
        if (huangjiMode === 'year') {
          const y = Number.parseInt(huangjiYear, 10) || nowParts.year;
          return {
            question,
            huangji: { mode: 'year', year: y === 0 ? 1 : y },
          };
        }
        if (huangjiMode === 'six-day') {
          return {
            question,
            huangji: {
              mode: 'six-day',
              dateTime: toBeijingIso(customDate, customTime),
              calendarModel: 'six-day-seven-part',
              timezone: 8,
            },
          };
        }
        return {
          question,
          huangji: {
            mode: 'datetime',
            date: toBeijingIso(customDate, customTime),
            ...(useTrueSolar
              ? { timeStandard: 'true-solar', longitude: placeLongitude }
              : { timeStandard: 'beijing' }),
          },
        };
      }

      case 'wuyun-liuqi': {
        return {
          question,
          wuyun: {
            year: Math.min(9999, Math.max(1, Number.parseInt(wuyunYear, 10) || nowParts.year)),
          },
        };
      }

      case 'tarot': {
        const spreadInfo =
          TAROT_SPREAD_LIST.find((s) => s.id === tarotSpreadId) ?? TAROT_SPREAD_LIST[1]!;
        const tarotObj: Record<string, unknown> = {
          spread: spreadInfo.id,
          ...(tarotDeckScope === 'major' ? { deckScope: 'major' } : {}),
        };
        if (tarotDrawMode !== 'random' && tarotDrawnCards.length === spreadInfo.cardCount) {
          tarotObj.manualCards = tarotDrawnCards.map((c) => ({
            id: c.id,
            reversed: Boolean(c.reversed),
          }));
          tarotObj.selectionMode = tarotDrawMode;
        } else if (tarotDrawMode === 'random') {
          tarotObj.reversalMode = tarotReversalMode;
        }
        return { question, tarot: tarotObj };
      }

      case 'lenormand': {
        const spreadInfo =
          LENORMAND_SPREAD_LIST.find((s) => s.id === lenormandSpreadId) ?? LENORMAND_SPREAD_LIST[1]!;
        const lenObj: Record<string, unknown> = { spread: spreadInfo.id };
        if (lenormandDrawMode !== 'random' && lenormandDrawnCards.length === spreadInfo.cardCount) {
          lenObj.manualCardIds = lenormandDrawnCards.map((c) => c.id);
          lenObj.selectionMode = lenormandDrawMode;
        }
        return { question, lenormand: lenObj };
      }

      case 'zhuge': {
        if (zhugeCastMode === 'coins') {
          return {
            question,
            zhuge: { method: 'coins', pattern: kongmingCoins.join('') },
          };
        }
        if (zhugeCastMode === 'numbers') {
          const numbers = zhugeNumbers.map((raw) => {
            const num = Number.parseInt(raw, 10);
            return Number.isNaN(num) ? 0 : Math.abs(num);
          }) as [number, number, number];
          return {
            question,
            zhuge: { method: 'numbers', numbers },
          };
        }
        const text = zhugeChars.map((c) => c.trim() || '定').join('');
        return {
          question,
          zhuge: { method: 'text', text: [...text].slice(0, 3).join('').padEnd(3, '乾') },
        };
      }

      case 'ssgw': {
        if (ssgwMode === 'manual') {
          const num = Math.min(92, Math.max(1, Number.parseInt(ssgwNumber, 10) || 36));
          return {
            question,
            ssgw: { method: 'manual', number: num },
          };
        }
        if (ssgwMode === 'interactive' && ssgwNumber) {
          const num = Math.min(92, Math.max(1, Number.parseInt(ssgwNumber, 10) || 36));
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
        const validParticipants = almanacParticipants
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
          topic: almanacTopic,
          ...(almanacTopic === 'custom'
            ? { customKeyword: almanacCustomKeyword.trim() || '祈福' }
            : {}),
          startDate: almanacStartDate,
          endDate: almanacEndDate >= almanacStartDate ? almanacEndDate : almanacStartDate,
          weekendPreference: almanacWeekendPref,
          ...(almanacTimePrefs.length ? { timePreferences: [...almanacTimePrefs] } : {}),
          ...(validParticipants.length ? { participants: validParticipants } : {}),
        };
      }

      case 'bazhai': {
        const yearNum = Math.min(
          2100,
          Math.max(1900, Number.parseInt(fengshuiPersonYear, 10) || 1990),
        );
        const house =
          fengshuiOrientationKind === 'mountain'
            ? { kind: 'mountain' as const, sitMountain: fengshuiSitMountain }
            : {
                kind: 'measurement' as const,
                reading: 'sit' as const,
                degree: fengshuiDegree,
                northReference: 'true' as const,
                uncertaintyDegrees: 1,
              };
        return {
          question,
          person: { kind: 'birth', year: yearNum, gender: fengshuiPersonGender },
          house,
        };
      }

      case 'xuankong': {
        const orientation =
          fengshuiOrientationKind === 'mountain'
            ? { kind: 'mountain' as const, sitMountain: fengshuiSitMountain }
            : {
                kind: 'degree' as const,
                reading: 'sit' as const,
                degree: fengshuiDegree,
                northReference: 'true' as const,
                uncertaintyDegrees: 1,
              };
        return {
          question,
          construction: { year: fengshuiConstructionYear },
          orientation,
          mode: fengshuiMode,
          ...(fengshuiMode === '替卦' ? { confirmJianXiang: true } : {}),
          flow: { kind: 'year', year: fengshuiFlowYear },
        };
      }

      case 'residential': {
        const yearNum = Math.min(
          2100,
          Math.max(1900, Number.parseInt(fengshuiPersonYear, 10) || 1990),
        );
        const orientation =
          fengshuiOrientationKind === 'mountain'
            ? { kind: 'mountain' as const, sitMountain: fengshuiSitMountain }
            : {
                kind: 'degree' as const,
                reading: 'sit' as const,
                degree: fengshuiDegree,
                northReference: 'true' as const,
                uncertaintyDegrees: 1,
              };
        return {
          question,
          person: { kind: 'birth', year: yearNum, gender: fengshuiPersonGender },
          orientation,
          construction: { year: fengshuiConstructionYear },
          mode: fengshuiMode,
          ...(fengshuiMode === '替卦' ? { confirmJianXiang: true } : {}),
          flow: { kind: 'year', year: fengshuiFlowYear },
        };
      }
    }
  }

  function emitChange() {
    onChange?.(buildPayload());
  }

  function renderUnifiedTimeBlock(
    fieldLabel = '起卦时间',
    actionLabel = '起卦',
    supportTrueSolar = false,
  ): HTMLElement {
    const wrap = document.createElement('div');
    wrap.className = 'unified-time-block';

    const timeField = document.createElement('div');
    timeField.className = 'workspace-ui-field';
    const timeLabel = document.createElement('label');
    timeLabel.textContent = fieldLabel;
    timeField.append(
      timeLabel,
      createSegmented(
        timeMode,
        [
          { id: 'current', label: '当前此刻' },
          { id: 'custom', label: '自定时间' },
        ],
        (next) => {
          timeMode = next;
          render();
        },
      ),
    );
    wrap.appendChild(timeField);

    if (timeMode === 'custom') {
      wrap.appendChild(renderDateTimeInputs(actionLabel));
    } else {
      const nowSummary = document.createElement('div');
      nowSummary.className = 'unified-time-now-hint';
      nowSummary.textContent = `按当下北京时间起盘：${nowParts.dateStr} ${nowParts.timeStr}`;
      wrap.appendChild(nowSummary);
    }

    if (supportTrueSolar) {
      const checkRow = document.createElement('div');
      checkRow.className = 'workspace-ui-form-row';
      const checkLabel = document.createElement('label');
      checkLabel.className = 'workspace-ui-checkbox';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = useTrueSolar;
      checkbox.addEventListener('change', () => {
        useTrueSolar = checkbox.checked;
        render();
      });
      const checkSpan = document.createElement('span');
      checkSpan.textContent = '使用真太阳时校正（按起局地点经度校正时辰）';
      checkLabel.append(checkbox, checkSpan);
      checkRow.appendChild(checkLabel);
      wrap.appendChild(checkRow);

      if (useTrueSolar) {
        const placePanel = document.createElement('div');
        placePanel.className =
          'divination-extra-panel divination-time-panel divination-solar-place-panel';
        const pField = document.createElement('div');
        pField.className = 'workspace-ui-field';
        const pLabel = document.createElement('label');
        pLabel.textContent = '起局地点';
        const placeBtn = document.createElement('button');
        placeBtn.type = 'button';
        placeBtn.className = 'workspace-ui-control address-trigger';
        placeBtn.innerHTML = `<span>${placeDisplayName}（东经 ${placeLongitude.toFixed(2)}°）</span><span class="address-trigger-arrow">选择</span>`;
        placeBtn.addEventListener('click', () => {
          openPlacePickerModal({
            currentDisplayName: placeDisplayName,
            onSelect: (entry) => {
              placeDisplayName = entry.displayName;
              placeLongitude = entry.longitude;
              if (entry.latitude !== undefined) placeLatitude = entry.latitude;
              render();
            },
          });
        });
        const hint = document.createElement('small');
        hint.className = 'workspace-ui-field-hint';
        hint.textContent = '按地点经度校正当前时间或自定时间';
        pField.append(pLabel, placeBtn, hint);
        placePanel.appendChild(pField);
        wrap.appendChild(placePanel);
      }
    }

    return wrap;
  }

  let ritualAnimTimer: number | null = null;
  function clearRitualTimer(): void {
    if (ritualAnimTimer !== null) {
      window.clearTimeout(ritualAnimTimer);
      ritualAnimTimer = null;
    }
  }

  function createSubmitActions(): HTMLElement | null {
    if (!showSubmitButton || !onSubmit) return null;
    if (method === 'almanac' && almanacSubTab === 'astro') return null;
    const actionsEl = document.createElement('div');
    actionsEl.className = 'workspace-ui-form-actions is-sticky-mobile';
    const submitBtn = document.createElement('button');
    submitBtn.type = 'submit';
    submitBtn.className = 'workspace-ui-button is-primary is-large is-block';
    submitBtn.textContent =
      method === 'almanac'
        ? '开始择日'
        : method === 'residential' || method === 'bazhai' || method === 'xuankong'
          ? '测算阳宅风水'
          : method === 'huangji-jingshi'
            ? '生成皇极盘'
            : method === 'wuyun-liuqi'
              ? '生成五运六气盘'
              : '开始占卜';
    actionsEl.appendChild(submitBtn);
    return actionsEl;
  }

  function validateFormInput(): string | null {
    if (method === 'meihua') {
      if (meihuaCastMode === 'number' && !meihuaNumber.trim()) {
        return '请先输入起卦数字。';
      }
      if (meihuaCastMode === 'character' && !meihuaCharText.trim()) {
        return '请先输入要测算的汉字。';
      }
      if (meihuaCastMode === 'sound' && !meihuaSoundCount.trim()) {
        return '请先输入声响次数。';
      }
    }
    if (method === 'jinkoujue' && jinkoujueMode === 'number' && !jinkoujueNumber.trim()) {
      return '请先输入起课数字。';
    }
    if (method === 'zhuge') {
      if (zhugeCastMode === 'text' && !zhugeChars.every((c) => Boolean(c.trim()))) {
        return '请先填齐三个汉字后再点击起卦。';
      }
      if (zhugeCastMode === 'numbers' && !zhugeNumbers.every((n) => Boolean(n.trim()))) {
        return '请先填齐三个起卦数字后再点击起卦。';
      }
    }
    if (method === 'tarot' && tarotDrawMode === 'interactive') {
      const spreadInfo =
        TAROT_SPREAD_LIST.find((s) => s.id === tarotSpreadId) ?? TAROT_SPREAD_LIST[1]!;
      if (tarotDrawnCards.length < spreadInfo.cardCount) {
        return `请先抽取全部 ${spreadInfo.cardCount} 张牌后，再点击「开始占卜」。`;
      }
    }
    if (method === 'lenormand' && lenormandDrawMode === 'interactive') {
      const spreadInfo =
        LENORMAND_SPREAD_LIST.find((s) => s.id === lenormandSpreadId) ?? LENORMAND_SPREAD_LIST[1]!;
      if (lenormandDrawnCards.length < spreadInfo.cardCount) {
        return `请先抽取全部 ${spreadInfo.cardCount} 张牌后，再点击「开始占卜」。`;
      }
    }
    if (method === 'ssgw' && ssgwMode === 'interactive' && !ssgwConfirmed) {
      return '请先摇动签筒并掷得圣杯确认，再点击「开始占卜」。';
    }
    if (method === 'ssgw' && ssgwMode === 'manual') {
      const n = Number.parseInt(ssgwNumber, 10);
      if (!Number.isInteger(n) || n < 1 || n > 92) {
        return '请输入 1 到 92 之间的签号。';
      }
    }
    return null;
  }

  function render() {
    // 自然单栏居中流式表单（不强硬拆成左右两栏，避免大片空白与视线割裂）
    const pageEl = document.createElement('div');
    pageEl.className = `workspace-focused-page workspace-divination-page${
      method === 'almanac' ? ' is-almanac' : ''
    }`;

    const shellEl = document.createElement('div');
    shellEl.className = 'divination-workspace-shell is-input-only divination-panel-shell';

    const formEl = document.createElement('form');
    formEl.className = 'workspace-ui-surface is-plain divination-form-panel';

    const formErrorEl = document.createElement('div');
    formErrorEl.className = 'workspace-ui-form-error';
    formErrorEl.hidden = true;

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const errMsg = validateFormInput();
      if (errMsg) {
        formErrorEl.hidden = false;
        formErrorEl.textContent = errMsg;
        return;
      }
      formErrorEl.hidden = true;
      onSubmit?.(buildPayload());
    });

    const cardEl = document.createElement('section');
    cardEl.className = 'workspace-ui-form-surface divination-form-card';

    if (method === 'almanac') {
      cardEl.appendChild(renderAlmanacSection());
      formEl.appendChild(cardEl);
      formEl.appendChild(formErrorEl);
      const actionsEl = createSubmitActions();
      if (actionsEl) formEl.appendChild(actionsEl);
    } else {
      const flowBox = document.createElement('div');
      flowBox.className = 'person-info-form workspace-ui-form-body divination-flow-workbench';

      if (method === 'bazhai' || method === 'xuankong' || method === 'residential') {
        populateFengshuiColumns(flowBox, flowBox);
      } else {
        const colsWrap = document.createElement('div');
        colsWrap.className = 'divination-workbench-cols';
        const leftCol = document.createElement('div');
        leftCol.className = 'divination-workbench-col is-left';
        const rightCol = document.createElement('div');
        rightCol.className = 'divination-workbench-col is-right';

        if (method === 'liuyao') {
          populateLiuyaoColumns(leftCol, rightCol);
        } else if (method === 'meihua') {
          populateMeihuaColumns(leftCol, rightCol);
        } else if (
          method === 'qimen' ||
          method === 'liuren' ||
          method === 'jinkoujue' ||
          method === 'taiyi' ||
          method === 'xiaoliuren' ||
          method === 'huangji-jingshi' ||
          method === 'wuyun-liuqi'
        ) {
          populateTimingColumns(leftCol, rightCol);
        } else if (
          method === 'tarot' ||
          method === 'lenormand' ||
          method === 'zhuge' ||
          method === 'ssgw' ||
          method === 'random-divination'
        ) {
          populateCardOrLotColumns(leftCol, rightCol);
        }

        if (leftCol.childElementCount > 0) colsWrap.appendChild(leftCol);
        if (rightCol.childElementCount > 0) colsWrap.appendChild(rightCol);
        if (leftCol.childElementCount === 0 || rightCol.childElementCount === 0) {
          colsWrap.classList.add('is-single-col');
        }
        flowBox.appendChild(colsWrap);
      }

      flowBox.appendChild(formErrorEl);
      const actionsEl = createSubmitActions();
      if (actionsEl) {
        flowBox.appendChild(actionsEl);
      }

      cardEl.appendChild(flowBox);
      formEl.appendChild(cardEl);
    }

    shellEl.appendChild(formEl);
    pageEl.appendChild(shellEl);
    container.replaceChildren(pageEl);
    emitChange();
  }

  function populateLiuyaoColumns(leftCol: HTMLElement, rightCol: HTMLElement): void {
    const castField = document.createElement('div');
    castField.className = 'workspace-ui-field';
    const castLabel = document.createElement('label');
    castLabel.textContent = '起卦方式';
    castField.append(
      castLabel,
      createCardOptionGrid(
        liuyaoCastMode,
        [
          { id: 'coins', label: '三钱摇卦', mark: '钱' },
          { id: 'yarrow', label: '蓍草十八变', mark: '蓍' },
          { id: 'time', label: '时间起卦', mark: '时' },
          { id: 'manual', label: '手动录爻', mark: '录' },
        ],
        (val) => {
          clearRitualTimer();
          liuyaoShaking = false;
          liuyaoCastMode = val;
          render();
        },
        4,
      ),
    );
    leftCol.appendChild(castField);

    if (liuyaoCastMode === 'time') {
      rightCol.appendChild(renderUnifiedTimeBlock('起卦时间', '起卦', false));
    } else {
      renderInteractiveLiuyaoStudio({
        mode: liuyaoCastMode,
        coinThrows: liuyaoCoinThrows,
        manualYaos: liuyaoManualYaos,
        yarrowYaos: liuyaoYarrowYaos,
        isShaking: liuyaoShaking,
        onRequestShakeCoin: () => {
          if (liuyaoShaking || liuyaoCoinThrows.length >= 6) return;
          clearRitualTimer();
          liuyaoShaking = true;
          render();
          ritualAnimTimer = window.setTimeout(() => {
            ritualAnimTimer = null;
            liuyaoShaking = false;
            liuyaoCoinThrows = [...liuyaoCoinThrows, rollThreeCoins()];
            render();
          }, 260);
        },
        onUpdateCoins: (next) => {
          liuyaoShaking = false;
          liuyaoCoinThrows = next;
          clearRitualTimer();
          render();
        },
        onUpdateManual: (next) => {
          liuyaoManualYaos = next;
          render();
        },
        onUpdateYarrow: (next) => {
          liuyaoYarrowYaos = next;
          clearRitualTimer();
          render();
        },
        splitTargets: { leftCol, rightCol },
      });
    }
  }

  function populateMeihuaColumns(leftCol: HTMLElement, rightCol: HTMLElement): void {
    const modeField = document.createElement('div');
    modeField.className = 'workspace-ui-field';
    const modeLabel = document.createElement('label');
    modeLabel.textContent = '梅花易数起卦方式';
    modeField.append(
      modeLabel,
      createCardOptionGrid(meihuaCastMode, MEIHUA_METHODS, (next) => {
        meihuaCastMode = next;
        render();
      }),
    );
    leftCol.appendChild(modeField);

    if (meihuaCastMode === 'time') {
      rightCol.appendChild(renderUnifiedTimeBlock('起卦时间', '起卦', false));
    } else if (meihuaCastMode === 'number') {
      const panel = document.createElement('div');
      panel.className = 'divination-extra-panel';
      panel.appendChild(
        createLabeledInput('起卦数字', meihuaNumber, '输入起卦数字', (val) => {
          meihuaNumber = val.replace(/[^\d]/g, '');
          emitChange();
        }),
      );
      rightCol.appendChild(panel);
    } else if (meihuaCastMode === 'character') {
      const panel = document.createElement('div');
      panel.className = 'divination-extra-panel';
      panel.appendChild(
        createLabeledInput('起卦文字', meihuaCharText, '输入起卦文字或短语', (val) => {
          meihuaCharText = val;
          emitChange();
        }),
      );
      rightCol.appendChild(panel);
    } else if (meihuaCastMode === 'sound') {
      const panel = document.createElement('div');
      panel.className = 'divination-extra-panel';
      panel.appendChild(
        createLabeledInput('声音数', meihuaSoundCount, '输入声响次数', (val) => {
          meihuaSoundCount = val.replace(/[^\d]/g, '');
          emitChange();
        }),
      );
      rightCol.appendChild(panel);
    } else if (meihuaCastMode === 'direction') {
      const panel = document.createElement('div');
      panel.className = 'divination-extra-panel meihua-compass-panel';

      const dirField = document.createElement('div');
      dirField.className = 'workspace-ui-field';
      const dirLabel = document.createElement('label');
      dirLabel.textContent = '取象方位';
      const dirGrid = document.createElement('div');
      dirGrid.className = 'cast-trigram-grid';
      for (const item of MEIHUA_DIRECTIONS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `cast-trigram-card${meihuaDirection === item.value ? ' is-active' : ''}`;
        btn.innerHTML = `<span class="cast-trigram-glyph">${item.glyph}</span><strong>${item.label}</strong>`;
        btn.addEventListener('click', () => {
          meihuaDirection = item.value;
          render();
        });
        dirGrid.appendChild(btn);
      }
      dirField.append(dirLabel, dirGrid);

      const objField = document.createElement('div');
      objField.className = 'workspace-ui-field';
      objField.style.marginTop = '12px';
      const objLabel = document.createElement('label');
      objLabel.textContent = '所见物类';
      const objGrid = document.createElement('div');
      objGrid.className = 'cast-trigram-grid';
      for (const item of MEIHUA_OBJECTS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `cast-trigram-card${meihuaObjectType === item.value ? ' is-active' : ''}`;
        btn.innerHTML = `<span class="cast-trigram-glyph">${item.glyph}</span><strong>${item.label}</strong>`;
        btn.addEventListener('click', () => {
          meihuaObjectType = item.value;
          render();
        });
        objGrid.appendChild(btn);
      }
      objField.append(objLabel, objGrid);

      panel.append(dirField, objField);
      rightCol.appendChild(panel);
    }
  }

  function populateTimingColumns(leftCol: HTMLElement, rightCol: HTMLElement): void {
    if (method === 'qimen') {
      const scopeField = document.createElement('div');
      scopeField.className = 'workspace-ui-field';
      const scopeLabel = document.createElement('label');
      scopeLabel.textContent = '四家奇门';
      scopeField.append(
        scopeLabel,
        createSegmented(
          qimenScope,
          [
            { id: 'hour', label: '时家' },
            { id: 'day', label: '日家' },
            { id: 'month', label: '月家' },
            { id: 'year', label: '年家' },
          ],
          (nextScope) => {
            qimenScope = nextScope;
            emitChange();
          },
        ),
      );
      leftCol.appendChild(scopeField);
    } else if (method === 'liuren') {
      // 贵人起例遵循偏好设置默认口径，不在起课主界面强迫用户挑选流派分支
      void liurenGuiRenTable;
    } else if (method === 'jinkoujue') {
      const modeRow = document.createElement('div');
      modeRow.className = 'workspace-ui-form-row';
      const modeField = document.createElement('div');
      modeField.className = 'workspace-ui-field';
      const modeLabel = document.createElement('label');
      modeLabel.textContent = '金口诀起课方式';
      modeField.append(
        modeLabel,
        createCardOptionGrid(
          jinkoujueMode,
          [
            { id: 'time', label: '时间起课', mark: '时' },
            { id: 'random', label: '随机起课', mark: '随' },
            { id: 'number', label: '报数起课', mark: '数' },
            { id: 'branch', label: '自选地分', mark: '地' },
          ],
          (next) => {
            jinkoujueMode = next;
            clearRitualTimer();
            render();
          },
          4,
        ),
      );
      modeRow.appendChild(modeField);
      leftCol.appendChild(modeRow);

      if (jinkoujueMode === 'branch') {
        rightCol.appendChild(renderUnifiedTimeBlock('起课时间', '起课', true));
        const branchField = document.createElement('div');
        branchField.className = 'workspace-ui-field';
        const branchLabel = document.createElement('label');
        branchLabel.textContent = '选择地分';
        const branchGrid = document.createElement('div');
        branchGrid.className = 'workspace-ui-choice-grid';
        for (const b of BRANCHES) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `workspace-ui-choice${jinkoujueBranch === b ? ' is-active' : ''}`;
          btn.textContent = `${b}位`;
          btn.addEventListener('click', () => {
            jinkoujueBranch = b;
            render();
          });
          branchGrid.appendChild(btn);
        }
        branchField.append(branchLabel, branchGrid);
        rightCol.appendChild(branchField);
        return;
      } else if (jinkoujueMode === 'number') {
        rightCol.appendChild(
          createLabeledInput('起课数字', jinkoujueNumber, '输入起课数字', (v) => {
            jinkoujueNumber = v.replace(/[^\d]/g, '');
            emitChange();
          }),
        );
      } else if (jinkoujueMode === 'random') {
        return;
      }
    } else if (method === 'taiyi') {
      const modeField = document.createElement('div');
      modeField.className = 'workspace-ui-field';
      const modeLabel = document.createElement('label');
      modeLabel.textContent = '太乙计式';
      modeField.append(
        modeLabel,
        createCardOptionGrid(
          taiyiScope,
          [
            { id: 'year', label: '太乙年计', mark: '年' },
            { id: 'month', label: '太乙月计', mark: '月' },
            { id: 'day', label: '太乙日计', mark: '日' },
            { id: 'hour', label: '太乙时计', mark: '时' },
          ],
          (next) => {
            taiyiScope = next;
            render();
          },
          4,
        ),
      );
      leftCol.appendChild(modeField);

      if (taiyiScope === 'year') {
        const panel = document.createElement('div');
        panel.className = 'divination-extra-panel divination-time-panel';
        panel.appendChild(
          createLabeledInput('起局年份', taiyiYear, '输入四位年份', (v) => {
            taiyiYear = v.replace(/[^\d]/g, '').slice(0, 4);
            emitChange();
          }),
        );
        rightCol.appendChild(panel);
        return;
      }
    } else if (method === 'xiaoliuren') {
      // 小六壬起课口径默认遵循全局偏好，不在前端强制分叉增加学习成本
      void xiaoliurenRule;
    } else if (method === 'huangji-jingshi') {
      const modeField = document.createElement('div');
      modeField.className = 'workspace-ui-field';
      const modeLabel = document.createElement('label');
      modeLabel.textContent = '起盘方式';
      modeField.append(
        modeLabel,
        createCardOptionGrid(
          huangjiMode,
          [
            { id: 'year', label: '元会运世 · 值年卦', mark: '年' },
            { id: 'datetime', label: '年月日时全盘', mark: '全' },
            { id: 'six-day', label: '六日七分逐爻', mark: '爻' },
          ],
          (next) => {
            huangjiMode = next;
            render();
          },
        ),
      );
      leftCol.appendChild(modeField);

      if (huangjiMode === 'year') {
        const panel = document.createElement('div');
        panel.className = 'divination-extra-panel divination-time-panel';
        panel.appendChild(
          createLabeledInput('推演公历年份', huangjiYear, '输入公历年份', (v) => {
            huangjiYear = v.replace(/[^\d-]/g, '');
            emitChange();
          }),
        );
        rightCol.appendChild(panel);
        return;
      }
    } else if (method === 'wuyun-liuqi') {
      const panel = document.createElement('div');
      panel.className = 'divination-extra-panel divination-time-panel';
      panel.appendChild(
        createLabeledInput('目标年份', wuyunYear, '输入四位年份', (v) => {
          wuyunYear = v.replace(/[^\d]/g, '').slice(0, 4);
          emitChange();
        }),
      );
      rightCol.appendChild(panel);
      return;
    }

    // 右栏：统一「此刻时间 / 自定时间」控件 + 可选真太阳时校正
    const supportTrueSolar =
      method === 'qimen' ||
      method === 'liuren' ||
      method === 'jinkoujue' ||
      method === 'taiyi' ||
      method === 'huangji-jingshi';
    rightCol.appendChild(renderUnifiedTimeBlock('起课时间', '起课', supportTrueSolar));

    if (method === 'huangji-jingshi' && huangjiMode !== 'year' && timeMode === 'current') {
      rightCol.appendChild(renderDateTimeInputs('起盘'));
    }
  }

  function populateCardOrLotColumns(leftCol: HTMLElement, rightCol: HTMLElement): void {
    if (method === 'tarot' || method === 'lenormand') {
      const isTarot = method === 'tarot';
      const spreads = isTarot ? TAROT_SPREAD_LIST : LENORMAND_SPREAD_LIST;
      const currentSpreadId = isTarot ? tarotSpreadId : lenormandSpreadId;
      const currentSpread = spreads.find((s) => s.id === currentSpreadId) ?? spreads[0]!;
      const currentMode = isTarot ? tarotDrawMode : lenormandDrawMode;
      const drawn = isTarot ? tarotDrawnCards : lenormandDrawnCards;

      // 左栏：抽牌方式切换 + 牌组范围（塔罗合并大阿卡纳） + 牌阵下拉选择
      const modeField = document.createElement('div');
      modeField.className = 'workspace-ui-field';
      const modeLabel = document.createElement('label');
      modeLabel.textContent = '抽牌方式';
      modeField.append(
        modeLabel,
        createCardOptionGrid(
          currentMode,
          [
            { id: 'random', label: '随机抽牌', mark: '随' },
            { id: 'interactive', label: '逐张抽牌', mark: '逐' },
            { id: 'manual', label: '手动录牌', mark: '录' },
          ],
          (next) => {
            if (isTarot) {
              tarotDrawMode = next;
              tarotDrawnCards = [];
              tarotShuffledDeck = null;
            } else {
              lenormandDrawMode = next;
              lenormandDrawnCards = [];
            }
            render();
          },
        ),
      );
      leftCol.appendChild(modeField);

      if (isTarot) {
        const deckField = document.createElement('div');
        deckField.className = 'workspace-ui-field';
        const deckLabel = document.createElement('label');
        deckLabel.textContent = '牌组范围';
        deckField.append(
          deckLabel,
          createSegmented(
            tarotDeckScope,
            [
              { id: 'all', label: '全副 78 张' },
              { id: 'major', label: '仅大阿卡纳 22 张' },
            ],
            (nextScope) => {
              tarotDeckScope = nextScope;
              tarotDrawnCards = [];
              tarotShuffledDeck = null;
              render();
            },
          ),
        );
        leftCol.appendChild(deckField);

        if (tarotDrawMode !== 'manual') {
          const revField = document.createElement('div');
          revField.className = 'workspace-ui-field';
          const revLabel = document.createElement('label');
          revLabel.textContent = '洗牌正逆位';
          revField.append(
            revLabel,
            createSegmented(
              tarotReversalMode,
              [
                { id: 'realistic', label: '现实 30%' },
                { id: 'balanced', label: '对半 50%' },
                { id: 'upright-only', label: '仅正位' },
              ],
              (nextRev) => {
                tarotReversalMode = nextRev;
                tarotDrawnCards = [];
                tarotShuffledDeck = null;
                render();
              },
            ),
          );
          leftCol.appendChild(revField);
        }
      }

      // 左栏：牌阵下拉选择（精简掉 20+ 平铺按钮，下拉按分类归档一目了然）
      {
        const spField = document.createElement('label');
        spField.className = 'workspace-ui-field';
        const spLabel = document.createElement('span');
        spLabel.textContent = `选择${isTarot ? '塔罗' : '雷诺曼'}牌阵`;
        const spSelect = document.createElement('select');
        spSelect.className = 'workspace-ui-control';
        if (isTarot) {
          for (const cat of TAROT_SPREAD_CATEGORIES) {
            const optGroup = document.createElement('optgroup');
            optGroup.label = cat.label;
            for (const sid of cat.spreadIds) {
              const sp = spreads.find((s) => s.id === sid);
              if (!sp) continue;
              const opt = document.createElement('option');
              opt.value = sp.id;
              opt.textContent = `${sp.name}（${sp.cardCount} 张）`;
              if (sp.id === currentSpreadId) opt.selected = true;
              optGroup.appendChild(opt);
            }
            spSelect.appendChild(optGroup);
          }
        } else {
          for (const sp of spreads) {
            const opt = document.createElement('option');
            opt.value = sp.id;
            opt.textContent = `${sp.name}（${sp.cardCount} 张）`;
            if (sp.id === currentSpreadId) opt.selected = true;
            spSelect.appendChild(opt);
          }
        }
        spSelect.addEventListener('change', () => {
          const val = spSelect.value;
          if (isTarot) {
            tarotSpreadId = val;
            tarotDrawnCards = [];
          } else {
            lenormandSpreadId = val;
            lenormandDrawnCards = [];
          }
          render();
        });
        spField.append(spLabel, spSelect);
        leftCol.appendChild(spField);
      }

      const summaryBox = document.createElement('div');
      summaryBox.className = 'divination-extra-panel';
      summaryBox.style.cssText = 'padding: 10px 12px; font-size: 13px;';
      summaryBox.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><strong>${currentSpread.name}</strong><span style="color:var(--text-muted);font-size:12px;">${
        isTarot && tarotDeckScope === 'major' ? '仅大阿卡纳 22 张 · ' : ''
      }共 ${currentSpread.cardCount} 张</span></div><div style="margin-top:4px;color:var(--text-muted);font-size:12px;">牌位：${currentSpread.positions.join(' · ')}</div>`;
      leftCol.appendChild(summaryBox);

      if (currentMode === 'random') {
        const previewPanel = document.createElement('div');
        previewPanel.className = 'divination-extra-panel tarot-spread-preview-table';
        previewPanel.style.cssText = 'padding: 12px;';

        const head = document.createElement('div');
        head.className = 'manual-entry-head';
        head.style.marginBottom = '10px';
        head.innerHTML = `<strong>牌位排布示意</strong><span style="font-size:12px;color:var(--text-muted);">点击起卦后随机抽取</span>`;
        previewPanel.appendChild(head);

        const row = document.createElement('div');
        row.className = 'tarot-preview-cards-row';
        row.style.cssText =
          'display:grid;grid-template-columns:repeat(auto-fit,minmax(88px,1fr));gap:10px;align-items:center;justify-items:center;';
        const previewLimit = Math.min(currentSpread.cardCount, 6);
        for (let i = 0; i < previewLimit; i++) {
          const posName = currentSpread.positions[i] ?? `第 ${i + 1} 牌位`;
          row.appendChild(
            createTarotCardBack({
              label: posName,
              sublabel: `第 ${i + 1} 张`,
              size: 'sm',
              deckTheme: isTarot ? 'tarot' : 'lenormand',
            }),
          );
        }
        previewPanel.appendChild(row);

        if (currentSpread.cardCount > previewLimit) {
          const moreBadge = document.createElement('div');
          moreBadge.style.cssText =
            'margin-top:8px;text-align:center;font-size:12px;color:var(--text-muted);';
          moreBadge.textContent = `＋ 其余 ${currentSpread.cardCount - previewLimit} 个牌位将在结果盘面完整展开`;
          previewPanel.appendChild(moreBadge);
        }
        rightCol.appendChild(previewPanel);
      } else if (currentMode === 'interactive' || currentMode === 'manual') {
        const panel = document.createElement('div');
        panel.className = 'divination-extra-panel manual-entry-panel';

        if (currentMode === 'interactive') {
          const session = document.createElement('div');
          session.className = 'interactive-draw-session';

          const triggerDrawNext = async () => {
            if (isDrawingInteractiveCard || drawn.length >= currentSpread.cardCount) return;
            isDrawingInteractiveCard = true;
            try {
              if (isTarot && (!tarotShuffledDeck || drawn.length === 0)) {
                tarotShuffledDeck = await createShuffledTarotDeck({
                  majorOnly: tarotDeckScope === 'major',
                  reversalMode: tarotReversalMode,
                });
              }
              const next = await drawNext(
                isTarot ? 'tarot' : 'lenormand',
                currentSpread.id,
                drawn,
                undefined,
                isTarot
                  ? {
                      majorOnly: tarotDeckScope === 'major',
                      reversalMode: tarotReversalMode,
                      preShuffledDeck: tarotShuffledDeck ?? undefined,
                    }
                  : undefined,
              );
              if (isTarot) {
                tarotDrawnCards = [...tarotDrawnCards, next.card];
              } else {
                lenormandDrawnCards = [...lenormandDrawnCards, next.card];
              }
              clearRitualTimer();
              render();
            } finally {
              isDrawingInteractiveCard = false;
            }
          };

          const head = document.createElement('div');
          head.className = 'manual-entry-head';
          head.innerHTML = `<strong>${
            drawn.length < currentSpread.cardCount
              ? `当前待抽牌位：${currentSpread.positions[drawn.length]}`
              : '✨ 牌阵已全部抽完，请点击「开始占卜」查看解读'
          }</strong><span>${drawn.length} / ${currentSpread.cardCount}</span>`;
          session.appendChild(head);

          // 视觉牌位桌台：已抽牌位展示完整牌面与外部名签，待抽牌位展示牌背
          const slotsGrid = document.createElement('div');
          slotsGrid.className = 'tarot-interactive-spread-row';
          slotsGrid.style.cssText =
            'display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:10px;margin:10px 0;';
          const visibleSlots = Math.min(currentSpread.cardCount, 6);
          for (let idx = 0; idx < visibleSlots; idx++) {
            const posName = currentSpread.positions[idx] ?? `第 ${idx + 1} 张`;
            const drawnCard = drawn[idx];
            const slotWrap = document.createElement('div');
            slotWrap.style.cssText =
              'display:flex;flex-direction:column;align-items:center;gap:5px;';
            const posTag = document.createElement('small');
            posTag.style.cssText = 'font-size:11px;font-weight:600;color:var(--text-secondary);';
            posTag.textContent = `${idx + 1}. ${posName}`;
            slotWrap.appendChild(posTag);

            if (drawnCard) {
              slotWrap.appendChild(
                isTarot
                  ? createTarotCardFace(
                      {
                        id: drawnCard.id,
                        name: drawnCard.name,
                        reversed: drawnCard.reversed,
                        position: posName,
                      },
                      { size: 'sm' },
                    )
                  : createLenormandCardFace(
                      {
                        id: drawnCard.id,
                        name: drawnCard.name,
                        position: posName,
                      },
                      { size: 'sm' },
                    ),
              );
              const nameCaption = document.createElement('div');
              nameCaption.className = 'tarot-slot-drawn-caption';
              nameCaption.textContent = `${drawnCard.name}${
                drawnCard.reversed === undefined ? '' : drawnCard.reversed ? ' · 逆位' : ' · 正位'
              }`;
              slotWrap.appendChild(nameCaption);
            } else {
              slotWrap.appendChild(
                createTarotCardBack({
                  label: posName,
                  sublabel: idx === drawn.length ? '点击抽取' : '待抽取',
                  active: idx === drawn.length,
                  size: 'sm',
                  deckTheme: isTarot ? 'tarot' : 'lenormand',
                  onClick: idx === drawn.length ? () => void triggerDrawNext() : undefined,
                }),
              );
            }
            slotsGrid.appendChild(slotWrap);
          }
          session.appendChild(slotsGrid);

          // 弧形叠加扇形牌堆（复刻 sydf 扇形手感，纯牌背展示）
          if (drawn.length < currentSpread.cardCount) {
            const fanBox = document.createElement('div');
            fanBox.className = 'tarot-arc-fan-panel';
            const fanHint = document.createElement('div');
            fanHint.className = 'tarot-arc-fan-hint';
            fanHint.textContent = `凭直觉点选扇形牌堆抽取「${currentSpread.positions[drawn.length]}」`;
            fanBox.appendChild(fanHint);

            const fanTrack = document.createElement('div');
            fanTrack.className = 'tarot-arc-fan-track';
            const fanCount = 13;
            const mid = (fanCount - 1) / 2;
            for (let f = 0; f < fanCount; f++) {
              const offset = (f - mid) / mid;
              const angle = offset * 24;
              const lift = (offset * offset) * 18;
              const btn = document.createElement('button');
              btn.type = 'button';
              btn.className = 'tarot-arc-fan-card';
              btn.style.setProperty('--fan-angle', `${angle.toFixed(1)}deg`);
              btn.style.setProperty('--fan-drop', `${lift.toFixed(1)}px`);
              btn.style.zIndex = String(10 + Math.round((1 - Math.abs(offset)) * 10));
              btn.setAttribute('aria-label', `抽取扇形牌堆第 ${f + 1} 张牌`);
              const backEl = createTarotCardBack({
                size: 'sm',
                deckTheme: isTarot ? 'tarot' : 'lenormand',
              });
              backEl.style.maxWidth = '100%';
              backEl.style.height = '100%';
              btn.appendChild(backEl);
              btn.addEventListener('click', () => void triggerDrawNext());
              fanTrack.appendChild(btn);
            }
            fanBox.appendChild(fanTrack);
            session.appendChild(fanBox);
          }

          if (drawn.length > 0) {
            const recList = document.createElement('div');
            recList.className = 'manual-record-list';
            for (const [idx, c] of drawn.entries()) {
              const item = document.createElement('div');
              item.className = 'manual-record-item is-revealed';
              item.innerHTML = `<span>${currentSpread.positions[idx] ?? c.position}</span><strong>${c.name}${
                c.reversed === undefined ? '' : c.reversed ? ' · 逆位' : ' · 正位'
              }</strong>`;
              recList.appendChild(item);
            }
            session.appendChild(recList);
          }

          const actions = document.createElement('div');
          actions.className = 'manual-session-actions';
          if (drawn.length < currentSpread.cardCount) {
            const drawBtn = document.createElement('button');
            drawBtn.type = 'button';
            drawBtn.className = 'workspace-ui-button is-secondary interactive-draw-button';
            drawBtn.textContent = `抽取下一张（${currentSpread.positions[drawn.length]}）`;
            drawBtn.addEventListener('click', () => void triggerDrawNext());
            actions.appendChild(drawBtn);
          }
          if (drawn.length > 0) {
            const resetBtn = document.createElement('button');
            resetBtn.type = 'button';
            resetBtn.className = 'workspace-ui-button is-secondary is-small manual-reset-button';
            resetBtn.textContent = '重新洗牌抽取';
            resetBtn.addEventListener('click', () => {
              clearRitualTimer();
              if (isTarot) tarotDrawnCards = [];
              else lenormandDrawnCards = [];
              render();
            });
            actions.appendChild(resetBtn);
          }
          session.appendChild(actions);
          panel.appendChild(session);
        } else if (currentMode === 'manual') {
          const deck = isTarot
            ? (tarotDeckScope === 'major' ? tarotData.cards.slice(0, 22) : tarotData.cards).map((c, idx) => ({
                id: idx + 1,
                name: c.name,
              }))
            : lenormandData.cards.map((c) => ({ id: c.id, name: c.name }));

          if (drawn.length !== currentSpread.cardCount) {
            const initialCards: DrawnCardItem[] = currentSpread.positions.map((pos, idx) => ({
              id: deck[idx % deck.length]!.id,
              name: deck[idx % deck.length]!.name,
              position: pos,
              ...(isTarot ? { reversed: false } : {}),
            }));
            if (isTarot) tarotDrawnCards = initialCards;
            else lenormandDrawnCards = initialCards;
          }
          const activeCards = isTarot ? tarotDrawnCards : lenormandDrawnCards;
          const manualWrap = document.createElement('div');
          manualWrap.className = 'workspace-ui-form-body';

          const previewRow = document.createElement('div');
          previewRow.className = 'tarot-manual-preview-row';
          previewRow.style.cssText =
            'display:grid;grid-template-columns:repeat(auto-fit,minmax(104px,1fr));gap:8px;margin-bottom:10px;';

          const refreshManualPreview = () => {
            previewRow.replaceChildren();
            for (const c of activeCards.slice(0, 6)) {
              previewRow.appendChild(
                isTarot
                  ? createTarotCardFace(
                      { id: c.id, name: c.name, reversed: c.reversed, position: c.position },
                      { size: 'sm' },
                    )
                  : createLenormandCardFace(
                      { id: c.id, name: c.name, position: c.position },
                      { size: 'sm' },
                    ),
              );
            }
          };
          refreshManualPreview();
          manualWrap.appendChild(previewRow);

          for (let i = 0; i < currentSpread.cardCount; i++) {
            const posName = currentSpread.positions[i]!;
            const item = activeCards[i]!;
            const row = document.createElement('div');
            row.className = `workspace-ui-form-row${isTarot ? ' is-two-column' : ''}`;

            const cardSelectField = createLabeledSelect(
              `${i + 1}. ${posName}`,
              deck.map((d) => ({ value: String(d.id), label: `${d.id}. ${d.name}` })),
              String(item.id),
              (val) => {
                const picked = deck.find((d) => d.id === Number(val)) ?? deck[0]!;
                activeCards[i] = { ...activeCards[i]!, id: picked.id, name: picked.name };
                refreshManualPreview();
                emitChange();
              },
            );
            row.appendChild(cardSelectField);

            if (isTarot) {
              const revField = createLabeledSelect(
                '正逆位',
                [
                  { value: 'false', label: '正位' },
                  { value: 'true', label: '逆位' },
                ],
                String(Boolean(item.reversed)),
                (val) => {
                  activeCards[i] = { ...activeCards[i]!, reversed: val === 'true' };
                  refreshManualPreview();
                  emitChange();
                },
              );
              row.appendChild(revField);
            }
            manualWrap.appendChild(row);
          }
          panel.appendChild(manualWrap);
        }

        rightCol.appendChild(panel);
      }
      return;
    }

    if (method === 'zhuge') {
      const modeField = document.createElement('div');
      modeField.className = 'workspace-ui-field';
      const modeLabel = document.createElement('label');
      modeLabel.textContent = '起卦方式';
      modeField.append(
        modeLabel,
        createCardOptionGrid(
          zhugeCastMode,
          [
            { id: 'coins', label: '五枚铜钱', mark: '钱' },
            { id: 'text', label: '汉字三字', mark: '汉' },
            { id: 'numbers', label: '数字取签', mark: '数' },
          ],
          (next) => {
            zhugeCastMode = next;
            render();
          },
          3,
        ),
      );
      leftCol.appendChild(modeField);

      const panel = document.createElement('div');
      panel.className = 'divination-extra-panel manual-entry-panel';

      if (zhugeCastMode === 'text') {
        const row = document.createElement('div');
        row.className = 'workspace-ui-form-row workspace-ui-date-row';
        for (let i = 0; i < 3; i++) {
          const field = document.createElement('label');
          field.className = 'workspace-ui-field';
          const span = document.createElement('span');
          span.textContent = `第${i + 1}个汉字`;
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.className = 'workspace-ui-control';
          inp.maxLength = 2;
          inp.placeholder = `第 ${i + 1} 个汉字`;
          inp.value = zhugeChars[i]!;
          inp.addEventListener('input', () => {
            const hanChar = [...inp.value.trim()].find((ch) => /\p{Script=Han}/u.test(ch));
            if (hanChar) {
              zhugeChars[i] = hanChar;
              inp.value = hanChar;
            } else if (!inp.value.trim()) {
              zhugeChars[i] = '';
            }
            emitChange();
          });
          field.append(span, inp);
          row.appendChild(field);
        }
        const hint = document.createElement('small');
        hint.className = 'workspace-ui-field-hint';
        hint.textContent = '依三个汉字的康熙笔画取末位数，合成签序（第 1–384 签）。';
        panel.append(row, hint);
      } else if (zhugeCastMode === 'numbers') {
        const row = document.createElement('div');
        row.className = 'workspace-ui-form-row workspace-ui-date-row';
        for (let i = 0; i < 3; i++) {
          const field = document.createElement('label');
          field.className = 'workspace-ui-field';
          const span = document.createElement('span');
          span.textContent = `第${i + 1}个数字`;
          const inp = document.createElement('input');
          inp.type = 'text';
          inp.inputMode = 'numeric';
          inp.className = 'workspace-ui-control';
          inp.maxLength = 4;
          inp.placeholder = `第 ${i + 1} 个数字`;
          inp.value = zhugeNumbers[i]!;
          inp.addEventListener('input', () => {
            const cleaned = inp.value.replace(/[^\d]/g, '').slice(0, 4);
            zhugeNumbers[i] = cleaned;
            inp.value = cleaned;
            emitChange();
          });
          field.append(span, inp);
          row.appendChild(field);
        }
        const hint = document.createElement('small');
        hint.className = 'workspace-ui-field-hint';
        hint.textContent = '心想三个数字或报数三组，依各自个位数合成签序（第 1–384 签）。';
        panel.append(row, hint);
      } else {
        const quickTossRow = document.createElement('div');
        quickTossRow.className = 'cast-action-row';
        quickTossRow.style.marginBottom = '10px';
        const tossBtn = document.createElement('button');
        tossBtn.type = 'button';
        tossBtn.className = 'workspace-ui-button is-secondary is-small';
        tossBtn.textContent = '模拟手掷五枚铜钱';
        tossBtn.addEventListener('click', () => {
          kongmingCoins = Array.from({ length: 5 }, () => (Math.random() < 0.5 ? '●' : '○'));
          clearRitualTimer();
          render();
        });
        quickTossRow.appendChild(tossBtn);
        panel.appendChild(quickTossRow);

        const coinsWrap = document.createElement('div');
        coinsWrap.className = 'culture-coins';
        coinsWrap.setAttribute('aria-label', '五枚铜钱的正反面');
        for (let i = 0; i < 5; i++) {
          const fs = document.createElement('fieldset');
          fs.className = 'culture-coin-entry';
          const legend = document.createElement('legend');
          legend.textContent = `第${i + 1}枚`;
          const opts = document.createElement('div');
          opts.className = 'culture-coin-options';
          for (const [symbol, face, polarity] of [
            ['●', '正面', '阳'],
            ['○', '反面', '阴'],
          ] as const) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = kongmingCoins[i] === symbol ? 'is-active' : '';
            const coinSrc =
              symbol === '●'
                ? '/divination-assets/ritual/coin-heads.webp'
                : '/divination-assets/ritual/coin-tails.webp';
            btn.innerHTML = `<img class="culture-coin-thumb" src="${coinSrc}" alt="${face}" loading="lazy" /><span><strong>${face}</strong><small>${polarity}</small></span>`;
            btn.addEventListener('click', () => {
              kongmingCoins[i] = symbol;
              render();
            });
            opts.appendChild(btn);
          }
          fs.append(legend, opts);
          coinsWrap.appendChild(fs);
        }
        const hint = document.createElement('small');
        hint.className = 'workspace-ui-field-hint';
        hint.textContent = '依五枚铜钱正反排布推演神数卦辞（共三十二课）。';
        panel.append(coinsWrap, hint);
      }

      rightCol.appendChild(panel);
      return;
    }

    if (method === 'ssgw') {
      const modeField = document.createElement('div');
      modeField.className = 'workspace-ui-field';
      const modeLabel = document.createElement('label');
      modeLabel.textContent = '抽签方式';
      modeField.append(
        modeLabel,
        createCardOptionGrid(
          ssgwMode,
          [
            { id: 'interactive', label: '摇筒抽签', mark: '筒' },
            { id: 'random', label: '随机抽签', mark: '随' },
            { id: 'manual', label: '手动填签', mark: '填' },
          ],
          (next) => {
            ssgwMode = next;
            clearRitualTimer();
            render();
          },
        ),
      );
      leftCol.appendChild(modeField);

      if (ssgwMode === 'interactive') {
        rightCol.appendChild(
          renderInteractiveLotRitual({
            method: 'ssgw',
            candidateNumber: ssgwNumber,
            confirmed: ssgwConfirmed,
            beiMessage: ssgwBeiMessage,
            beiPair: ssgwBeiPair,
            beiHistory: ssgwBeiHistory,
            isShaking: ssgwShaking,
            isThrowingCups: ssgwThrowing,
            onRequestShake: () => {
              if (ssgwShaking || ssgwThrowing) return;
              clearRitualTimer();
              ssgwShaking = true;
              ssgwConfirmed = false;
              ssgwBeiMessage = '';
              ssgwBeiHistory = [];
              render();
            },
            onShakeComplete: () => {
              if (!ssgwShaking) return;
              clearRitualTimer();
              ssgwShaking = false;
              ssgwNumber = String(Math.floor(Math.random() * 92) + 1);
              ssgwBeiPair = ['yang', 'yin'];
              ssgwBeiMessage = '签已落出，请掷圣杯核验。';
              render();
            },
            onRequestThrow: () => {
              if (!ssgwNumber || ssgwShaking || ssgwThrowing) return;
              clearRitualTimer();
              ssgwThrowing = true;
              render();
              ritualAnimTimer = window.setTimeout(() => {
                ritualAnimTimer = null;
                ssgwThrowing = false;
                const result = rollShengbeiResult();
                ssgwBeiPair = result.pair;
                ssgwBeiHistory = [...ssgwBeiHistory, { short: result.short, ok: result.ok }];
                ssgwConfirmed = result.ok;
                ssgwBeiMessage = result.ok
                  ? `${result.label} — 圣杯已定，请点击「开始占卜」解签。`
                  : `${result.label} — ${result.desc}`;
                render();
              }, 420);
            },
            onUpdate: (nextNumber, confirmed, beiMessage, beiPair) => {
              ssgwNumber = nextNumber;
              ssgwConfirmed = confirmed;
              ssgwBeiMessage = beiMessage;
              ssgwBeiPair = beiPair;
              clearRitualTimer();
              render();
            },
          }),
        );
      } else if (ssgwMode === 'random') {
        const notice = document.createElement('div');
        notice.className = 'workspace-ui-notice';
        const span = document.createElement('span');
        span.textContent = '由系统随机抽取灵签一枝。';
        notice.appendChild(span);
        rightCol.appendChild(notice);
      } else if (ssgwMode === 'manual') {
        const panel = document.createElement('div');
        panel.className = 'divination-extra-panel manual-entry-panel ssgw-manual-panel';
        const f = createLabeledInput('签号', ssgwNumber, '输入 1–92 签号', (v) => {
          ssgwNumber = v.replace(/[^\d]/g, '').slice(0, 2);
          emitChange();
        });
        f.classList.add('ssgw-number-field');
        panel.appendChild(f);
        rightCol.appendChild(panel);
      }
      return;
    }

    // random-divination
    const notice = document.createElement('div');
    notice.className = 'workspace-ui-notice';
    const span = document.createElement('span');
    span.textContent = '直接点击右下角「开始占卜」，随机抽取一门传统术数即时起卦。';
    notice.appendChild(span);
    leftCol.appendChild(notice);
  }

  function renderAlmanacSection(): HTMLElement {
    const flow = document.createElement('div');
    flow.className = 'almanac-form almanac-form-flow';

    let startInputRef: HTMLInputElement | null = null;
    let endInputRef: HTMLInputElement | null = null;

    // 1. 唯一融合的「干支万年历」主看板（公历农历 / 四柱节气 / 宜忌吉神 / 十二时辰同屏查看并联动下方工具）
    const calSec = document.createElement('section');
    calSec.className = 'almanac-form-section almanac-calendar-section';
    const calHost = document.createElement('div');
    renderGanzhiCalendarPanel({
      container: calHost,
      selectedDate: almanacStartDate,
      embedded: false,
      onSelectDate: (pickedDate) => {
        almanacStartDate = pickedDate;
        if (almanacEndDate < pickedDate) {
          almanacEndDate = pickedDate;
        }
        if (startInputRef) startInputRef.value = almanacStartDate;
        if (endInputRef) endInputRef.value = almanacEndDate;
        almanacAstroWidget?.syncDate(pickedDate);
        emitChange();
      },
    });
    calSec.appendChild(calHost);
    flow.appendChild(calSec);

    // 2. 下方工具切换（黄历择吉筛选 | 天文历法推算）—— 按页签分流，告别冗长叠页
    const modeSec = document.createElement('section');
    modeSec.className = 'almanac-form-section almanac-tool-tabs-section';
    const modeSwitch = createSegmented(
      almanacSubTab,
      [
        { id: 'select', label: '黄历择吉筛选' },
        { id: 'astro', label: '天文历法' },
      ],
      (nextTab) => {
        almanacSubTab = nextTab;
        render();
      },
    );
    modeSec.appendChild(modeSwitch);
    flow.appendChild(modeSec);

    if (almanacSubTab === 'astro' && almanacAstroWidget) {
      const astroSec = document.createElement('section');
      astroSec.className = 'almanac-form-section almanac-astro-section';
      astroSec.appendChild(almanacAstroWidget.element);
      flow.appendChild(astroSec);
      return flow;
    }

    // 2A. 择日事项
    const topicSec = document.createElement('section');
    topicSec.className = 'almanac-form-section';
    const topicHead = document.createElement('div');
    topicHead.className = 'almanac-form-section-head';
    const topicTitle = document.createElement('strong');
    topicTitle.textContent = '择日事项';
    topicHead.append(topicTitle);

    const topicGrid = document.createElement('div');
    topicGrid.className = 'almanac-topic-grid';
    topicGrid.setAttribute('role', 'group');
    topicGrid.setAttribute('aria-label', '择日事项');
    for (const item of ALMANAC_TOPICS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = almanacTopic === item.value ? 'is-active' : '';
      btn.setAttribute('aria-pressed', String(almanacTopic === item.value));
      btn.textContent = item.label;
      btn.addEventListener('click', () => {
        almanacTopic = item.value;
        render();
      });
      topicGrid.appendChild(btn);
    }
    topicSec.append(topicHead, topicGrid);

    if (almanacTopic === 'custom') {
      topicSec.appendChild(
        createLabeledInput('自定义黄历宜忌词', almanacCustomKeyword, '输入黄历宜忌关键词', (v) => {
          almanacCustomKeyword = v;
          emitChange();
        }),
      );
    }
    flow.appendChild(topicSec);

    // 2B. 日期范围
    const dateSec = document.createElement('section');
    dateSec.className = 'almanac-form-section almanac-date-section';
    const dateHead = document.createElement('div');
    dateHead.className = 'almanac-form-section-head';
    const dateTitle = document.createElement('strong');
    dateTitle.textContent = '择吉日期范围';

    const quickRanges = document.createElement('div');
    quickRanges.className = 'almanac-quick-ranges';
    for (const days of [7, 21, 30, 90, 180] as const) {
      const qBtn = document.createElement('button');
      qBtn.type = 'button';
      qBtn.textContent = `${days}天`;
      qBtn.addEventListener('click', () => {
        almanacEndDate = addDaysToDateStr(almanacStartDate, days - 1);
        render();
      });
      quickRanges.appendChild(qBtn);
    }
    dateHead.append(dateTitle, quickRanges);

    const dateFields = document.createElement('div');
    dateFields.className = 'almanac-date-fields';

    const startItem = document.createElement('div');
    startItem.className = 'form-item workspace-ui-field';
    const startLabel = document.createElement('label');
    startLabel.htmlFor = 'almanac-start-date-input';
    startLabel.textContent = '开始日期';
    const startInput = document.createElement('input');
    startInputRef = startInput;
    startInput.id = 'almanac-start-date-input';
    startInput.type = 'date';
    startInput.className = 'form-input workspace-ui-control';
    startInput.value = almanacStartDate;
    startInput.addEventListener('change', () => {
      almanacStartDate = startInput.value || nowParts.dateStr;
      if (almanacEndDate < almanacStartDate) {
        almanacEndDate = addDaysToDateStr(almanacStartDate, 20);
      }
      render();
    });
    startItem.append(startLabel, startInput);

    const toSpan = document.createElement('span');
    toSpan.setAttribute('aria-hidden', 'true');
    toSpan.textContent = '至';

    const endItem = document.createElement('div');
    endItem.className = 'form-item workspace-ui-field';
    const endLabel = document.createElement('label');
    endLabel.htmlFor = 'almanac-end-date-input';
    endLabel.textContent = '结束日期';
    const endInput = document.createElement('input');
    endInputRef = endInput;
    endInput.id = 'almanac-end-date-input';
    endInput.type = 'date';
    endInput.className = 'form-input workspace-ui-control';
    endInput.min = almanacStartDate;
    endInput.value = almanacEndDate;
    endInput.addEventListener('change', () => {
      almanacEndDate = endInput.value || almanacStartDate;
      emitChange();
    });
    endItem.append(endLabel, endInput);
    dateFields.append(startItem, toSpan, endItem);

    const commonOpts = document.createElement('div');
    commonOpts.className = 'almanac-common-options';

    const dateSpan = document.createElement('span');
    dateSpan.textContent = '日期';
    const weekendGroup = document.createElement('div');
    weekendGroup.setAttribute('role', 'group');
    for (const w of [
      { id: 'any', label: '日期不限' },
      { id: 'prefer', label: '优先周末' },
      { id: 'avoid', label: '避开周末' },
    ] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = almanacWeekendPref === w.id ? 'is-active' : '';
      btn.textContent = w.label;
      btn.addEventListener('click', () => {
        almanacWeekendPref = w.id;
        render();
      });
      weekendGroup.appendChild(btn);
    }

    const timeSpan = document.createElement('span');
    timeSpan.textContent = '时段';
    const timeGroup = document.createElement('div');
    timeGroup.setAttribute('role', 'group');
    for (const tp of [
      { id: 'work-hours', label: '工作时间' },
      { id: 'morning', label: '优先上午' },
      { id: 'afternoon', label: '优先下午' },
    ] as const) {
      const active = almanacTimePrefs.includes(tp.id);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = active ? 'is-active' : '';
      btn.textContent = tp.label;
      btn.addEventListener('click', () => {
        almanacTimePrefs = active
          ? almanacTimePrefs.filter((x) => x !== tp.id)
          : [...almanacTimePrefs, tp.id];
        render();
      });
      timeGroup.appendChild(btn);
    }

    commonOpts.append(dateSpan, weekendGroup, timeSpan, timeGroup);
    dateSec.append(dateHead, dateFields, commonOpts);
    flow.appendChild(dateSec);

    // 4. 参与人
    const partSec = document.createElement('section');
    partSec.className = 'almanac-form-section';
    const partHead = document.createElement('div');
    partHead.className = 'almanac-form-section-head';
    partHead.innerHTML =
      '<div><strong>参与人</strong><span>用于核对生肖、日柱关系和可用时辰</span></div>';
    const partActions = document.createElement('div');
    partActions.className = 'almanac-participant-actions';
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'workspace-ui-button is-secondary is-small';
    addBtn.textContent = '手动添加';
    addBtn.addEventListener('click', () => {
      almanacParticipants.push({
        id: `p-${Date.now()}`,
        name: '本人',
        gender: '',
        year: '1990',
        month: '5',
        day: '15',
        shichenIndex: '',
        calendar: 'solar',
      });
      render();
    });
    partActions.appendChild(addBtn);
    partHead.appendChild(partActions);
    partSec.appendChild(partHead);

    if (almanacParticipants.length > 0) {
      const pList = document.createElement('div');
      pList.className = 'almanac-participant-list';
      almanacParticipants.forEach((p, idx) => {
        const details = document.createElement('details');
        details.className = 'almanac-participant-item';
        details.open = true;

        const summary = document.createElement('summary');
        const shichenLabel =
          SHICHEN_OPTIONS.find((o) => o.value === p.shichenIndex)?.label ?? '时辰不详';
        summary.innerHTML = `<span class="almanac-participant-index">${idx + 1}</span>
          <span class="almanac-participant-summary">
            <strong>${p.name || `参与人${idx + 1}`}</strong>
            <small>${p.calendar === 'lunar' ? '农历' : '公历'} ${p.year}-${p.month}-${p.day} · ${shichenLabel}</small>
          </span>
          <span class="almanac-participant-edit">编辑</span>`;

        const editor = document.createElement('div');
        editor.className = 'almanac-participant-editor';

        const row1 = document.createElement('div');
        row1.className = 'form-row-flex';
        row1.append(
          createLabeledInput('称呼', p.name, '本人', (v) => {
            p.name = v;
            emitChange();
          }),
          createLabeledSelect(
            '历法',
            [
              { value: 'solar', label: '公历' },
              { value: 'lunar', label: '农历' },
            ],
            p.calendar,
            (v) => {
              p.calendar = v as 'solar' | 'lunar';
              emitChange();
            },
          ),
        );

        const row2 = document.createElement('div');
        row2.className = 'form-row-flex has-third-item';
        row2.append(
          createLabeledInput('年', p.year, '1990', (v) => {
            p.year = v.replace(/[^\d]/g, '').slice(0, 4);
            emitChange();
          }),
          createLabeledInput('月', p.month, '5', (v) => {
            p.month = v.replace(/[^\d]/g, '').slice(0, 2);
            emitChange();
          }),
          createLabeledInput('日', p.day, '15', (v) => {
            p.day = v.replace(/[^\d]/g, '').slice(0, 2);
            emitChange();
          }),
        );

        const row3 = document.createElement('div');
        row3.className = 'form-row';
        row3.appendChild(
          createLabeledSelect('时辰', SHICHEN_OPTIONS, p.shichenIndex, (v) => {
            p.shichenIndex = v;
            emitChange();
          }),
        );

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'almanac-participant-remove';
        removeBtn.textContent = '移除此人';
        removeBtn.addEventListener('click', () => {
          almanacParticipants = almanacParticipants.filter((item) => item.id !== p.id);
          render();
        });

        editor.append(row1, row2, row3, removeBtn);
        details.append(summary, editor);
        pList.appendChild(details);
      });
      partSec.appendChild(pList);
    } else {
      const empty = document.createElement('p');
      empty.className = 'almanac-participant-empty';
      empty.textContent = '不指定参与人时，将只按事项和日期比较。';
      partSec.appendChild(empty);
    }

    flow.appendChild(partSec);
    return flow;
  }

  function populateFengshuiColumns(leftCol: HTMLElement, rightCol: HTMLElement): void {
    // 左栏：坐向输入模式 + 宅主生辰（八宅/住宅）+ 建造元运（玄空/住宅）
    const switchField = document.createElement('div');
    switchField.className = 'workspace-ui-field';
    const switchLabel = document.createElement('label');
    switchLabel.textContent = '立向输入方式';
    const switchBar = document.createElement('div');
    switchBar.className = 'manual-orientation-switch';
    for (const [id, label] of [
      ['mountain', '二十四山罗盘'],
      ['degree', '度数输入（0–360°）'],
    ] as const) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = fengshuiOrientationKind === id ? 'is-active' : '';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        fengshuiOrientationKind = id;
        render();
      });
      switchBar.appendChild(btn);
    }
    switchField.append(switchLabel, switchBar);
    leftCol.appendChild(switchField);

    if (method === 'bazhai' || method === 'residential') {
      const ownerRow = document.createElement('div');
      ownerRow.className = 'workspace-ui-form-row is-two-column';
      ownerRow.append(
        createLabeledInput('宅主出生年份', fengshuiPersonYear, '输入四位出生年份', (v) => {
          fengshuiPersonYear = v.replace(/[^\d]/g, '').slice(0, 4);
          emitChange();
        }),
        createLabeledSelect(
          '宅主性别',
          [
            { value: 'male', label: '男' },
            { value: 'female', label: '女' },
          ],
          fengshuiPersonGender,
          (v) => {
            fengshuiPersonGender = v as 'male' | 'female';
            emitChange();
          },
        ),
      );
      leftCol.appendChild(ownerRow);
    }

    if (method === 'xuankong' || method === 'residential') {
      const periodField = document.createElement('div');
      periodField.className = 'workspace-ui-field';
      const periodLabel = document.createElement('label');
      periodLabel.textContent = '建造元运快捷选择';
      const periodGrid = document.createElement('div');
      periodGrid.className = 'workspace-ui-choice-grid';
      for (const p of CONSTRUCTION_PERIODS) {
        const active =
          (p.year === 2024 && fengshuiConstructionYear >= 2024) ||
          (p.year === 2008 &&
            fengshuiConstructionYear >= 2004 &&
            fengshuiConstructionYear <= 2023) ||
          (p.year === 1996 &&
            fengshuiConstructionYear >= 1984 &&
            fengshuiConstructionYear <= 2003) ||
          (p.year === 1975 &&
            fengshuiConstructionYear >= 1964 &&
            fengshuiConstructionYear <= 1983);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `workspace-ui-choice${active ? ' is-active' : ''}`;
        btn.textContent = p.label;
        btn.addEventListener('click', () => {
          fengshuiConstructionYear = p.year;
          render();
        });
        periodGrid.appendChild(btn);
      }
      periodField.append(periodLabel, periodGrid);

      const xuanRow = document.createElement('div');
      xuanRow.className = 'workspace-ui-form-row is-three-column fengshui-xuan-row';
      xuanRow.append(
        createLabeledInput(
          '建造或起运年',
          String(fengshuiConstructionYear),
          '2024',
          (v) => {
            const yr = Number.parseInt(v.replace(/[^\d]/g, ''), 10);
            if (yr >= 1900 && yr <= 2100) {
              fengshuiConstructionYear = yr;
              emitChange();
            }
          },
        ),
        createLabeledSelect(
          '玄空起法',
          [
            { value: '下卦', label: '下卦' },
            { value: '替卦', label: '替卦' },
          ],
          fengshuiMode,
          (v) => {
            fengshuiMode = v as '下卦' | '替卦';
            emitChange();
          },
        ),
        createLabeledInput(
          '目标流运年份',
          String(fengshuiFlowYear),
          String(nowParts.year),
          (v) => {
            const yr = Number.parseInt(v.replace(/[^\d]/g, ''), 10);
            if (yr >= 1900 && yr <= 2100) {
              fengshuiFlowYear = yr;
              emitChange();
            }
          },
        ),
      );
      leftCol.append(periodField, xuanRow);
    }

    // 右栏：两步罗盘坐向工作台（第一步：八方坐向 4×2 网格 + 第二步：三山细分胶囊）
    const panel = document.createElement('div');
    panel.className = 'divination-extra-panel manual-entry-panel fengshui-compass-workbench';

    if (fengshuiOrientationKind === 'mountain') {
      const activeGroup =
        FENGSHUI_COMPASS_GROUPS.find((grp) =>
          (grp.mountains as readonly string[]).includes(fengshuiSitMountain),
        ) ?? FENGSHUI_COMPASS_GROUPS[0]!;

      const step1Field = document.createElement('div');
      step1Field.className = 'workspace-ui-field';
      const step1Label = document.createElement('label');
      step1Label.textContent = '选择八方坐向';

      const compassGrid = document.createElement('div');
      compassGrid.className = 'fengshui-compass-group-grid';
      compassGrid.style.cssText =
        'display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 8px;';

      for (const grp of FENGSHUI_COMPASS_GROUPS) {
        const isGroupActive = grp.id === activeGroup.id;
        const cardBtn = document.createElement('button');
        cardBtn.type = 'button';
        cardBtn.className = `workspace-ui-choice fengshui-compass-group-card${
          isGroupActive ? ' is-active' : ''
        }`;
        cardBtn.style.cssText =
          'display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 10px; text-align: left;';
        cardBtn.innerHTML = `<strong style="font-size:13px;">${grp.label}</strong><small style="font-size:11px;opacity:0.78;">${grp.subLabel}</small>`;
        cardBtn.addEventListener('click', () => {
          const defaultSit = (grp.mountains as readonly string[]).includes(fengshuiSitMountain)
            ? fengshuiSitMountain
            : grp.mountains[1];
          fengshuiSitMountain = defaultSit;
          const mIdx = mountains.indexOf(defaultSit as (typeof mountains)[number]);
          if (mIdx >= 0) fengshuiDegree = mIdx * 15;
          render();
        });
        compassGrid.appendChild(cardBtn);
      }
      step1Field.append(step1Label, compassGrid);

      const step2Field = document.createElement('div');
      step2Field.className = 'workspace-ui-field';
      step2Field.style.marginTop = '10px';
      const step2Label = document.createElement('label');
      const currentMIdx = Math.max(
        0,
        mountains.indexOf(fengshuiSitMountain as (typeof mountains)[number]),
      );
      const currentFacing = mountains[(currentMIdx + 12) % 24]!;
      step2Label.textContent = `细分三山朝向 · ${fengshuiSitMountain}山${currentFacing}向 · ${activeGroup.id}宅`;

      const subOptions = activeGroup.mountains.map((sit) => {
        const idx = Math.max(0, mountains.indexOf(sit as (typeof mountains)[number]));
        const facing = mountains[(idx + 12) % 24]!;
        return {
          id: sit,
          label: `${sit}山${facing}向`,
        };
      });

      const subSeg = createSegmented(fengshuiSitMountain, subOptions, (nextSit) => {
        fengshuiSitMountain = nextSit;
        const mIdx = mountains.indexOf(nextSit as (typeof mountains)[number]);
        if (mIdx >= 0) fengshuiDegree = mIdx * 15;
        render();
      });
      step2Field.append(step2Label, subSeg);

      panel.append(step1Field, step2Field);
    } else {
      const idx = Math.floor(((((fengshuiDegree + 7.5) % 360) + 360) % 360) / 15);
      const sit = mountains[idx]!;
      const facing = mountains[(idx + 12) % 24]!;
      const preview = document.createElement('div');
      preview.className = 'metaphysics-direction-preview';
      preview.innerHTML = `<strong>${sit}山${facing}向 · ${mountainTrigram(sit)}宅</strong><span>当前坐山度数：${fengshuiDegree}°</span>`;

      const degField = createLabeledInput(
        '坐山度数',
        String(fengshuiDegree),
        '输入 0–360 度数',
        (v) => {
          const deg = Math.min(360, Math.max(0, Number(v) || 0));
          fengshuiDegree = deg;
          const nextIdx = Math.floor(((((deg + 7.5) % 360) + 360) % 360) / 15);
          const nextSit = mountains[nextIdx]!;
          const nextFacing = mountains[(nextIdx + 12) % 24]!;
          fengshuiSitMountain = nextSit;
          preview.innerHTML = `<strong>${nextSit}山${nextFacing}向 · ${mountainTrigram(nextSit)}宅</strong><span>当前坐山度数：${deg}°</span>`;
          emitChange();
        },
      );
      panel.append(preview, degField);
    }

    rightCol.appendChild(panel);
  }

  function renderDateTimeInputs(actionLabel: string): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'divination-extra-panel divination-time-panel';

    const row = document.createElement('div');
    row.className = 'workspace-ui-form-row is-two-column';

    const dateLabel = document.createElement('label');
    dateLabel.className = 'workspace-ui-field';
    const dateSpan = document.createElement('span');
    dateSpan.textContent = `${actionLabel}日期`;
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'workspace-ui-control';
    dateInput.value = customDate;
    dateInput.addEventListener('change', () => {
      customDate = dateInput.value || nowParts.dateStr;
      emitChange();
    });
    dateLabel.append(dateSpan, dateInput);

    const timeLabel = document.createElement('label');
    timeLabel.className = 'workspace-ui-field';
    const timeSpan = document.createElement('span');
    timeSpan.textContent = `${actionLabel}时间（北京时间）`;
    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.className = 'workspace-ui-control';
    timeInput.value = customTime;
    timeInput.addEventListener('change', () => {
      customTime = timeInput.value || nowParts.timeStr;
      emitChange();
    });
    timeLabel.append(timeSpan, timeInput);

    row.append(dateLabel, timeLabel);
    panel.appendChild(row);
    return panel;
  }

  render();
}

function createLabeledInput(
  label: string,
  value: string,
  placeholder: string,
  onInput: (val: string) => void,
): HTMLElement {
  const wrap = document.createElement('label');
  wrap.className = 'workspace-ui-field form-item';
  const span = document.createElement('span');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'workspace-ui-control form-input';
  input.value = value;
  input.placeholder = placeholder;
  input.addEventListener('input', () => onInput(input.value));
  wrap.append(span, input);
  return wrap;
}

function createLabeledSelect(
  label: string,
  options: ReadonlyArray<{ value: string; label: string }>,
  currentValue: string,
  onChange: (val: string) => void,
): HTMLElement {
  if (options.length <= 6) {
    const wrap = document.createElement('div');
    wrap.className = 'workspace-ui-field form-item';
    const span = document.createElement('span');
    span.textContent = label;
    const seg = createSegmented(
      currentValue,
      options.map((opt) => ({ id: opt.value, label: opt.label })),
      onChange,
    );
    wrap.append(span, seg);
    return wrap;
  }
  const wrap = document.createElement('label');
  wrap.className = 'workspace-ui-field form-item';
  const span = document.createElement('span');
  span.textContent = label;
  const select = document.createElement('select');
  select.className = 'workspace-ui-control form-input';
  for (const opt of options) {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === currentValue) o.selected = true;
    select.appendChild(o);
  }
  select.addEventListener('change', () => onChange(select.value));
  wrap.append(span, select);
  return wrap;
}

function getDefaultQuestionForMethod(method: DivinationFormMethod): string {
  switch (method) {
    case 'almanac':
      return '请筛选近期适合办理此事的黄道吉日与吉时。';
    case 'bazhai':
    case 'xuankong':
    case 'residential':
      return '这套住宅的坐向格局与居住人是否相合，布局上需要注意什么？';
    case 'wuyun-liuqi':
      return '这一年的五运六气气候节律与日常调养重点是什么？';
    case 'huangji-jingshi':
      return '这一阶段的元会运世值年卦象与大势主线如何理解？';
    default:
      return '这件事接下来的走向如何，我当下该如何应对？';
  }
}
