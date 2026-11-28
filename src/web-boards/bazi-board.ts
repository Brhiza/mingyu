import { SolarTime } from 'tyme4ts';
import { comparePillars } from '../systems/bazi/natal-facts';
import {
  getCurrentSolarTermMonthIndex,
  getFlowDayHours,
  getFlowMonthDays,
  getFlowMonthStartMeta,
  getShichenIndexForBeijingHour,
} from '../systems/bazi/flow-calendar';
import { buildPillarFact, type BaziPillar } from '../systems/bazi/pillars';
import { EARTHLY_BRANCHES, getYearMonthList, getYearSixtyCycle } from '../systems/ganzhi-foundation';
import { createBoardDetailBar, createBoardModalTrigger } from './dom';
import { createTermPanel, el, getWuxing, unwrapBoardData } from './shared';

interface BaziHiddenStem {
  stem: string;
  tenGod: string;
}

interface BaziPillarData {
  ganZhi: string;
  gan: string;
  zhi: string;
  stemElement?: string;
  branchElement?: string;
  tenGod?: string;
  hiddenStems?: BaziHiddenStem[];
  naYin?: string;
  voidBranches?: string[];
  lifeStage?: string;
  selfLifeStage?: string;
}

interface BaziShenshaEntry {
  name: string;
  position: 'year' | 'month' | 'day' | 'hour';
}

interface BaziFortuneCycle {
  index: number;
  ganZhi: string;
  startTimestamp: number;
  endTimestamp: number;
  pillar?: BaziPillarData;
}

interface BaziChartPayload {
  chart: {
    basis?: {
      localDateTime?: string;
      timeStandard?: string;
      utcTimestamp?: number;
    };
    pillars: {
      year: BaziPillarData;
      month: BaziPillarData;
      day: BaziPillarData;
      hour: BaziPillarData;
    };
    shensha?: {
      entries?: BaziShenshaEntry[];
    };
  };
  fortune?: {
    direction?: 'forward' | 'backward';
    startAge?: {
      years?: number;
      months?: number;
      days?: number;
    };
    cycles?: BaziFortuneCycle[];
  };
  located?: {
    timestamp?: number;
    flowYear?: number;
    inChildhood?: boolean;
    cycle?: BaziFortuneCycle;
    year?: BaziPillarData;
    month?: BaziPillarData;
    day?: BaziPillarData;
    hour?: BaziPillarData;
    smallFortune?: { nominalAge?: number; pillar?: BaziPillarData };
    monthCommander?: {
      stem?: string;
      branch?: string;
      previousJie?: { name?: string };
      nextJie?: { name?: string };
      rule?: string;
    };
    shensha?: {
      layers?: Array<{
        id: string;
        ganZhi: string;
        entries?: Array<{ name: string; target?: string; targetKind?: string }>;
      }>;
    };
    evidence?: {
      comparisons?: Array<{
        source?: string;
        sourceGanZhi?: string;
        target?: string;
        targetGanZhi?: string;
        relations?: Array<{ name?: string; values?: string[]; subtype?: string }>;
      }>;
      formations?: Array<{
        name?: string;
        element?: string;
        branches?: string[];
        participants?: Array<{ layer?: string; branch?: string }>;
        triggers?: Array<{ layer?: string; branch?: string }>;
      }>;
    };
  } | null;
  timeline?: {
    year?: { ganZhi?: string; gan?: string; zhi?: string; tenGod?: string };
  };
}

type PillarKey = 'year' | 'month' | 'day' | 'hour';

const LUCKY_SHENSHA = new Set([
  '天乙贵人',
  '天官贵人',
  '太极贵人',
  '文昌贵人',
  '福星贵人',
  '国印贵人',
  '金舆',
  '天厨贵人',
  '禄神',
  '暗禄',
  '天德贵人',
  '天德合',
  '月德贵人',
  '月德合',
  '天医',
  '学堂',
  '词馆',
  '德秀贵人',
  '红艳煞',
  '红鸾',
  '天喜',
  '龙德',
  '紫微',
  '福德',
  '天赦日',
  '三奇贵人',
  '拱禄',
  '将星',
  '十灵日',
  '六秀日',
  '日德',
  '日贵',
  '进神',
  '金神',
]);

const UNLUCKY_SHENSHA = new Set([
  '羊刃',
  '飞刃',
  '流霞',
  '亡神',
  '劫煞',
  '灾煞',
  '岁煞',
  '六厄',
  '孤辰',
  '寡宿',
  '丧门',
  '官符',
  '岁破',
  '白虎',
  '吊客',
  '病符',
  '披麻',
  '血刃',
  '勾绞煞',
  '天罗地网',
  '童子煞',
  '隔角煞',
  '铁扫帚',
  '阴差阳错',
  '孤鸾煞',
  '九丑',
  '十恶大败',
  '四废日',
  '元辰',
  '空亡',
]);

function getShenshaTone(name: string): 'is-lucky' | 'is-unlucky' | 'is-neutral' {
  if (LUCKY_SHENSHA.has(name)) return 'is-lucky';
  if (UNLUCKY_SHENSHA.has(name)) return 'is-unlucky';
  return 'is-neutral';
}

function isPillar(value: unknown): value is BaziPillarData {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as BaziPillarData).gan === 'string' &&
    typeof (value as BaziPillarData).zhi === 'string'
  );
}

function extractBaziPayload(value: unknown): BaziChartPayload | undefined {
  const data = unwrapBoardData(value);
  if (!data || !data.chart || typeof data.chart !== 'object') return undefined;
  const chart = data.chart as Record<string, unknown>;
  if (!chart.pillars || typeof chart.pillars !== 'object') return undefined;
  const pillars = chart.pillars as Record<string, unknown>;
  if (!isPillar(pillars.year) || !isPillar(pillars.month) || !isPillar(pillars.day) || !isPillar(pillars.hour)) {
    return undefined;
  }
  return data as unknown as BaziChartPayload;
}

function termButton(
  label: string,
  query: string,
  onOpen: (term: string) => void,
  options?: { className?: string; wuxing?: string },
): HTMLElement {
  if (!label || label === '—' || label === '无') {
    return el('span', { className: options?.className ?? 'bazi-cell-muted', text: label || '—' });
  }
  return el('button', {
    type: 'button',
    className: `board-term-trigger ${options?.className ?? ''}`.trim(),
    text: label,
    title: `点击查看「${query}」释义`,
    dataset: options?.wuxing ? { wuxing: options.wuxing } : undefined,
    onClick: () => onOpen(query),
  });
}

function formatYear(timestamp: number): string {
  const date = new Date(timestamp + 8 * 3600 * 1000);
  return String(date.getUTCFullYear());
}

const FORTUNE_LAYER_LABELS: Record<string, string> = {
  dayun: '大运',
  cycle: '大运',
  decade: '大运',
  year: '流年',
  month: '流月',
  day: '流日',
  hour: '流时',
  smallFortune: '小运',
  'small-fortune': '小运',
  'natal-year': '年柱',
  'natal-month': '月柱',
  'natal-day': '日柱',
  'natal-hour': '时柱',
};

const TEN_GOD_ABBR_MAP: Record<string, string> = {
  比肩: '比',
  劫财: '劫',
  食神: '食',
  伤官: '伤',
  正财: '财',
  偏财: '才',
  正官: '官',
  七杀: '杀',
  正印: '印',
  偏印: '枭',
};

function formatTenGodAbbr(god?: string): string {
  if (!god) return '';
  return TEN_GOD_ABBR_MAP[god] ?? god;
}

function formatFortuneLayerLabel(id?: string): string {
  if (!id) return '';
  return FORTUNE_LAYER_LABELS[id] ?? id;
}

function toComparablePillar(p: BaziPillarData): BaziPillar {
  return {
    ganZhi: p.ganZhi,
    gan: p.gan,
    zhi: p.zhi,
    stemElement: p.stemElement ?? getWuxing(p.gan) ?? '',
    branchElement: p.branchElement ?? getWuxing(p.zhi) ?? '',
    stemYinYang: '阳',
    branchYinYang: '阳',
    tenGod: p.tenGod ?? '',
    hiddenStems: p.hiddenStems ?? [],
    naYin: p.naYin ?? '',
    voidBranches: p.voidBranches ?? [],
    lifeStage: p.lifeStage ?? '',
    selfLifeStage: p.selfLifeStage ?? '',
  };
}

function groupShenshaByPosition(entries: BaziShenshaEntry[] | undefined): Record<PillarKey, string[]> {
  const map: Record<PillarKey, string[]> = { year: [], month: [], day: [], hour: [] };
  if (!entries?.length) return map;
  for (const entry of entries) {
    const bucket = map[entry.position];
    if (bucket && entry.name && !bucket.includes(entry.name)) {
      bucket.push(entry.name);
    }
  }
  return map;
}

export function renderBaziBoard(container: HTMLElement, value: unknown): boolean {
  const payload = extractBaziPayload(value);
  if (!payload) {
    container.hidden = true;
    container.replaceChildren();
    return false;
  }

  const { chart, fortune } = payload;
  const located = payload.located;
  const annualPillar = located?.year ?? payload.timeline?.year;
  const activeCycleIndex = located?.cycle?.index;
  const startYears = fortune?.startAge?.years ?? 0;
  const cyclesList = fortune?.cycles ?? [];

  const columns: Array<{ key: PillarKey; label: string; caption?: string; pillar: BaziPillarData; isDay?: boolean }> = [
    { key: 'year', label: '年柱', pillar: chart.pillars.year },
    { key: 'month', label: '月柱', pillar: chart.pillars.month },
    { key: 'day', label: '日柱', caption: '日主', pillar: chart.pillars.day, isDay: true },
    { key: 'hour', label: '时柱', pillar: chart.pillars.hour },
  ];
  const shenshaByPos = groupShenshaByPosition(chart.shensha?.entries);

  const termPanel = createTermPanel();
  const openTerm = (query: string) => termPanel.open(query);

  const shell = el('section', { className: 'board-card bazi-board-shell', ariaLabel: '八字四柱命盘' });

  // 头部信息
  const head = el('div', { className: 'board-head' });
  const titleGroup = el('div', { className: 'board-title-group' });
  titleGroup.append(el('h3', { className: 'board-title', text: '八字四柱盘' }));
  if (chart.basis?.localDateTime) {
    titleGroup.append(
      el('span', { className: 'board-subtitle', text: chart.basis.localDateTime.replace('T', ' ') }),
    );
  }
  head.append(titleGroup);

  const metaChips = el('div', { className: 'board-chips' });
  if (chart.basis?.timeStandard) {
    const stdMap: Record<string, string> = {
      'true-solar': '真太阳时',
      trueSolar: '真太阳时',
      civil: '标准钟表时',
      beijing: '北京时间',
      local: '地方平太阳时',
    };
    const stdLabel = stdMap[chart.basis.timeStandard] ?? '真太阳时/标准时';
    metaChips.append(el('span', { className: 'board-chip', text: stdLabel }));
  }
  if (fortune?.direction) {
    metaChips.append(
      el('span', {
        className: 'board-chip',
        text: fortune.direction === 'forward' ? '顺排大运' : '逆排大运',
      }),
    );
  }
  if (fortune?.startAge) {
    const years = fortune.startAge.years ?? 0;
    const months = fortune.startAge.months ?? 0;
    const days = fortune.startAge.days ?? 0;
    metaChips.append(
      el('span', {
        className: 'board-chip is-accent',
        text: `${years}岁${months ? `${months}月` : ''}${days ? `${days}天` : ''}起运`,
      }),
    );
  }
  const firstCycleTs = fortune?.cycles?.[0]?.startTimestamp;
  if (firstCycleTs) {
    const dt = new Date(firstCycleTs + 8 * 3600_000);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dt.getUTCDate()).padStart(2, '0');
    metaChips.append(
      el('span', {
        className: 'board-chip',
        text: `交运 ${yyyy}-${mm}-${dd}`,
      }),
    );
  }
  head.append(metaChips);
  shell.append(head);

  const rawStrengthForHeader = ((chart as unknown as Record<string, unknown>).strength ?? undefined) as
    | { month?: { commanderStem?: string } }
    | undefined;
  const commanderStem = rawStrengthForHeader?.month?.commanderStem;

  // 命主农历 / 生肖 / 星座 / 当令节气 / 人元司令总览条
  const inputGender =
    ((payload as unknown as Record<string, unknown>).input as { gender?: string } | undefined)?.gender ??
    ((chart as unknown as Record<string, unknown>).input as { gender?: string } | undefined)?.gender;
  const localMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(
    chart.basis?.localDateTime ?? '',
  );
  if (localMatch || inputGender || commanderStem) {
    const metaBar = el('div', { className: 'bazi-person-meta-bar' });
    if (inputGender === 'male' || inputGender === 'female') {
      metaBar.append(
        el('span', {
          className: 'bazi-meta-pill is-gender',
          text: inputGender === 'male' ? '乾造 · 男命' : '坤造 · 女命',
        }),
      );
    }
    if (localMatch) {
      try {
        const st = SolarTime.fromYmdHms(
          Number(localMatch[1]),
          Number(localMatch[2]),
          Number(localMatch[3]),
          Number(localMatch[4]),
          Number(localMatch[5]),
          Number(localMatch[6]),
        );
        const ld = st.getLunarHour().getLunarDay();
        const ly = ld.getLunarMonth().getLunarYear();
        const zodiac = ly.getSixtyCycle().getEarthBranch().getZodiac().getName();
        const constellation = st.getSolarDay().getConstellation().getName();
        const term = st.getTerm().getName();
        metaBar.append(
          el('span', { className: 'bazi-meta-pill', text: ld.toString() }),
          el('span', { className: 'bazi-meta-pill', text: `生肖 · ${zodiac}` }),
          el('span', { className: 'bazi-meta-pill', text: `${constellation}座` }),
          el('span', { className: 'bazi-meta-pill', text: `节令 · ${term}后` }),
        );
      } catch {
        // 忽略边界时间换算异常
      }
    }
    if (commanderStem) {
      metaBar.append(el('span', { className: 'bazi-meta-pill', text: `人元司令 · ${commanderStem}` }));
    }
    if (metaBar.childElementCount > 0) {
      shell.append(metaBar);
    }
  }

  // 四柱 + 岁运并列纵向网格表
  const nowTs = Date.now();
  const currentBeijingDate = new Date(nowTs + 8 * 3600_000);
  const currentBeijingYear = currentBeijingDate.getUTCFullYear();
  const currentBeijingMonthNum = currentBeijingDate.getUTCMonth() + 1;
  const currentBeijingDayNum = currentBeijingDate.getUTCDate();
  const currentYmdKey = `${currentBeijingYear}-${String(currentBeijingMonthNum).padStart(2, '0')}-${String(currentBeijingDayNum).padStart(2, '0')}`;
  const currentShichenIdx = getShichenIndexForBeijingHour(currentBeijingDate.getUTCHours());
  const { flowYear: todayFlowYear, monthIndex: todaySolarMonthIdx } =
    getCurrentSolarTermMonthIndex(currentBeijingDate);

  const birthYearFromBasis = chart.basis?.utcTimestamp
    ? new Date(chart.basis.utcTimestamp + 8 * 3600_000).getUTCFullYear()
    : undefined;
  const getCycleStartYear = (c: BaziFortuneCycle) =>
    new Date(c.startTimestamp + 8 * 3600_000).getUTCFullYear();
  const defaultCycleIdx = Math.max(
    0,
    cyclesList.findIndex((c) =>
      activeCycleIndex !== undefined
        ? c.index === activeCycleIndex
        : c.startTimestamp <= nowTs && nowTs < c.endTimestamp,
    ),
  );
  let selectedCycleIdx = defaultCycleIdx;
  const defaultStartYear = cyclesList[defaultCycleIdx]
    ? getCycleStartYear(cyclesList[defaultCycleIdx])
    : (located?.flowYear ?? todayFlowYear);
  let selectedYear =
    located?.flowYear ??
    (todayFlowYear >= defaultStartYear && todayFlowYear < defaultStartYear + 10
      ? todayFlowYear
      : defaultStartYear);
  const initialMonthsList = getYearMonthList(selectedYear);
  const locatedMonthIdx =
    located?.month?.ganZhi ? initialMonthsList.indexOf(located.month.ganZhi) : -1;
  let selectedMonthIdx = locatedMonthIdx >= 0 ? locatedMonthIdx : todaySolarMonthIdx;

  const locatedYmdKey = (() => {
    if (!located?.timestamp) return '';
    const d = new Date(located.timestamp + 8 * 3600_000);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  })();
  let selectedDayKey = locatedYmdKey || currentYmdKey;
  let selectedHourIdx = (() => {
    if (located?.hour?.zhi) {
      const idx = EARTHLY_BRANCHES.indexOf(located.hour.zhi as (typeof EARTHLY_BRANCHES)[number]);
      if (idx >= 0) return idx;
    }
    return currentShichenIdx;
  })();

  const resolveActiveDayAndHour = () => {
    const daysList = selectedYear ? getFlowMonthDays(selectedYear, selectedMonthIdx) : [];
    let activeDay = daysList.find((d) => d.key === selectedDayKey);
    if (!activeDay) {
      activeDay = daysList.find((d) => d.key === currentYmdKey) ?? daysList[0];
      if (activeDay) selectedDayKey = activeDay.key;
    }
    const hoursList = activeDay?.ganZhi ? getFlowDayHours(activeDay.ganZhi) : [];
    const safeHourIdx =
      selectedHourIdx >= 0 && selectedHourIdx < hoursList.length ? selectedHourIdx : 0;
    selectedHourIdx = safeHourIdx;
    const activeHour = hoursList[safeHourIdx];
    return { daysList, activeDay, hoursList, activeHour };
  };

  const hasFortuneColumnsAvailable = Boolean(
    cyclesList.length > 0 || annualPillar?.ganZhi || located?.month?.ganZhi,
  );
  let showFortuneColumns = hasFortuneColumnsAvailable;

  const visibleStems = new Set(columns.map((c) => c.pillar.gan).filter(Boolean));
  const modeBar = el('div', { className: 'bazi-table-mode-bar' });
  const modeHint = el('span', { className: 'bazi-table-mode-hint' });
  const modeToggleGroup = el('div', { className: 'bazi-table-mode-pills', role: 'group', ariaLabel: '盘面显示列切换' });
  const modeWithFortuneBtn = el('button', { type: 'button', className: 'bazi-table-mode-btn', text: '含岁运' });
  const modeNatalOnlyBtn = el('button', { type: 'button', className: 'bazi-table-mode-btn', text: '仅四柱' });
  if (hasFortuneColumnsAvailable) {
    modeToggleGroup.append(modeWithFortuneBtn, modeNatalOnlyBtn);
    modeBar.append(modeHint, modeToggleGroup);
    shell.append(modeBar);
  }

  const tableWrap = el('div', { className: 'bazi-table-wrap' });
  const fortuneShenshaLayers = located?.shensha?.layers ?? [];

  type DisplayColumn = {
    key: string;
    label: string;
    caption?: string;
    pillar: BaziPillarData;
    isDay?: boolean;
    isFortune?: boolean;
    isFortuneStart?: boolean;
    shensha: string[];
  };

  const renderPillarsTable = () => {
    const displayColumns: DisplayColumn[] = columns.map((col) => ({
      ...col,
      shensha: shenshaByPos[col.key] ?? [],
    }));

    if (showFortuneColumns && hasFortuneColumnsAvailable) {
      const dmGan = chart.pillars.day?.gan ?? '';
      const activeCycle = cyclesList[selectedCycleIdx];
      const fortuneCols: Array<{
        key: string;
        label: string;
        caption?: string;
        pillar?: BaziPillarData;
        shensha: string[];
      }> = [];

      const cyclePillar =
        activeCycle?.pillar ??
        (activeCycle?.ganZhi && dmGan
          ? (buildPillarFact(activeCycle.ganZhi, dmGan) as BaziPillarData)
          : located?.cycle?.pillar);
      if (cyclePillar?.ganZhi) {
        const cycleMatchLayer = fortuneShenshaLayers.find(
          (l) => (l.id === 'dayun' || l.id === 'cycle') && l.ganZhi === cyclePillar.ganZhi,
        );
        const ageCaption = activeCycle ? `${startYears + selectedCycleIdx * 10}岁` : undefined;
        fortuneCols.push({
          key: 'dayun',
          label: '大运',
          caption: ageCaption,
          pillar: cyclePillar,
          shensha: (cycleMatchLayer?.entries ?? []).map((e) => e.name).slice(0, 6),
        });
      }

      const yearGanZhi = selectedYear ? getYearSixtyCycle(selectedYear) : (annualPillar?.ganZhi ?? '');
      const yearPillar: BaziPillarData | undefined =
        yearGanZhi && located?.year?.ganZhi === yearGanZhi && located?.flowYear === selectedYear
          ? located.year
          : yearGanZhi && dmGan
            ? (buildPillarFact(yearGanZhi, dmGan) as BaziPillarData)
            : isPillar(annualPillar)
              ? annualPillar
              : undefined;
      if (yearPillar?.ganZhi) {
        const yearMatchLayer = fortuneShenshaLayers.find(
          (l) => l.id === 'year' && l.ganZhi === yearPillar.ganZhi,
        );
        fortuneCols.push({
          key: 'liunian',
          label: '流年',
          caption: selectedYear ? `${selectedYear}年` : undefined,
          pillar: yearPillar,
          shensha: (yearMatchLayer?.entries ?? []).map((e) => e.name).slice(0, 6),
        });
      }

      const monthList = selectedYear ? getYearMonthList(selectedYear) : [];
      const monthGanZhi = monthList[selectedMonthIdx] ?? located?.month?.ganZhi ?? '';
      const monthPillar =
        monthGanZhi && located?.month?.ganZhi === monthGanZhi && located?.flowYear === selectedYear
          ? located.month
          : monthGanZhi && dmGan
            ? (buildPillarFact(monthGanZhi, dmGan) as BaziPillarData)
            : undefined;
      if (monthPillar?.ganZhi) {
        const monthMatchLayer = fortuneShenshaLayers.find(
          (l) => l.id === 'month' && l.ganZhi === monthPillar.ganZhi,
        );
        fortuneCols.push({
          key: 'liuyue',
          label: '流月',
          caption: `${monthGanZhi[1] ?? monthPillar.zhi}月`,
          pillar: monthPillar,
          shensha: (monthMatchLayer?.entries ?? []).map((e) => e.name).slice(0, 6),
        });
      }

      const { activeDay, activeHour } = resolveActiveDayAndHour();
      const dayPillar: BaziPillarData | undefined =
        activeDay?.ganZhi && located?.day?.ganZhi === activeDay.ganZhi && locatedYmdKey === activeDay.key
          ? located.day
          : activeDay?.ganZhi && dmGan
            ? (buildPillarFact(activeDay.ganZhi, dmGan) as BaziPillarData)
            : located?.day;
      if (dayPillar?.ganZhi) {
        const dayMatchLayer = fortuneShenshaLayers.find(
          (l) => l.id === 'day' && l.ganZhi === dayPillar.ganZhi,
        );
        fortuneCols.push({
          key: 'liuri',
          label: '流日',
          caption: activeDay?.shortDate,
          pillar: dayPillar,
          shensha: (dayMatchLayer?.entries ?? []).map((e) => e.name).slice(0, 6),
        });
      }

      const hourPillar: BaziPillarData | undefined =
        activeHour?.ganZhi &&
        located?.hour?.ganZhi === activeHour.ganZhi &&
        locatedYmdKey === activeDay?.key
          ? located.hour
          : activeHour?.ganZhi && dmGan
            ? (buildPillarFact(activeHour.ganZhi, dmGan) as BaziPillarData)
            : located?.hour;
      if (hourPillar?.ganZhi) {
        const hourMatchLayer = fortuneShenshaLayers.find(
          (l) => l.id === 'hour' && l.ganZhi === hourPillar.ganZhi,
        );
        fortuneCols.push({
          key: 'liushi',
          label: '流时',
          caption: activeHour?.label ?? `${hourPillar.zhi}时`,
          pillar: hourPillar,
          shensha: (hourMatchLayer?.entries ?? []).map((e) => e.name).slice(0, 6),
        });
      }

      fortuneCols.forEach((fc, idx) => {
        if (!fc.pillar) return;
        displayColumns.push({
          key: fc.key,
          label: fc.label,
          caption: fc.caption,
          pillar: fc.pillar,
          isFortune: true,
          isFortuneStart: idx === 0,
          shensha: fc.shensha,
        });
      });
    }

    if (hasFortuneColumnsAvailable) {
      const hasAddedFortune = displayColumns.length > 4;
      modeHint.textContent = hasAddedFortune ? '四柱与岁运' : '原局四柱';
      modeWithFortuneBtn.classList.toggle('is-active', showFortuneColumns);
      modeWithFortuneBtn.setAttribute('aria-pressed', String(showFortuneColumns));
      modeNatalOnlyBtn.classList.toggle('is-active', !showFortuneColumns);
      modeNatalOnlyBtn.setAttribute('aria-pressed', String(!showFortuneColumns));
    }

    const table = el('div', {
      className: `bazi-pillars-table${displayColumns.length > 4 ? ' has-fortune-cols' : ''}`,
      role: 'table',
      ariaLabel: displayColumns.length > 4 ? '四柱与岁运并列命表' : '四柱八字表',
    });
    table.style.setProperty('--bazi-col-count', String(displayColumns.length));
    table.style.setProperty('--bazi-display-column-count', String(displayColumns.length));

    const colToneClass = (col: DisplayColumn) =>
      `${col.isDay ? ' is-day-master' : ''}${col.isFortune ? ' is-fortune-col' : ''}${col.isFortuneStart ? ' is-fortune-start' : ''}`;

    // 表头行（所有列均维持两行等高结构，确保主标题水平基线严格对齐）
    table.append(el('div', { className: 'bazi-pillars-cell is-label is-head', text: displayColumns.length > 4 ? '四柱/运' : '四柱' }));
    for (const col of displayColumns) {
      const headCell = el('div', {
        className: `bazi-pillars-cell is-head${colToneClass(col)}`.trim(),
      });
      headCell.append(
        el('span', { className: 'bazi-head-title', text: col.label }),
        el('small', {
          className: col.caption ? 'bazi-head-sub' : 'bazi-head-sub is-empty',
          text: col.caption ?? '\u00A0',
        }),
      );
      table.append(headCell);
    }

    // 命式主格（天干十神 → 超大宋楷干支 → 地支十神）
    table.append(el('div', { className: 'bazi-pillars-cell is-label is-pillar-label', text: '命式' }));
    for (const col of displayColumns) {
      const ganTenGod = col.pillar.tenGod ?? (col.isDay ? '日主' : '—');
      const zhiTenGod = col.pillar.hiddenStems?.[0]?.tenGod ?? '—';
      const ganWx = col.pillar.stemElement ?? getWuxing(col.pillar.gan);
      const zhiWx = col.pillar.branchElement ?? getWuxing(col.pillar.zhi);

      const pillarBox = el('div', { className: 'bazi-pillar-value' });
      pillarBox.append(
        termButton(ganTenGod, ganTenGod, openTerm, { className: 'bazi-pillar-tengod' }),
        el(
          'div',
          { className: 'bazi-pillar-ganzhi' },
          termButton(col.pillar.gan, col.pillar.gan, openTerm, {
            className: 'bazi-ganzhi-symbol',
            wuxing: ganWx,
          }),
          termButton(col.pillar.zhi, col.pillar.zhi, openTerm, {
            className: 'bazi-ganzhi-symbol',
            wuxing: zhiWx,
          }),
        ),
        termButton(zhiTenGod, zhiTenGod, openTerm, { className: 'bazi-pillar-tengod is-branch-god' }),
      );

      table.append(
        el(
          'div',
          { className: `bazi-pillars-cell is-pillar${colToneClass(col)}`.trim() },
          pillarBox,
        ),
      );
    }

    // 藏干行（天干五行色 + 十神小字）
    table.append(el('div', { className: 'bazi-pillars-cell is-label', text: '藏干' }));
    for (const col of displayColumns) {
      const hidden = col.pillar.hiddenStems ?? [];
      const cell = el('div', {
        className: `bazi-pillars-cell is-hidden-stems${colToneClass(col)}`.trim(),
      });
      if (!hidden.length) {
        cell.append(el('span', { className: 'bazi-shensha-empty', text: '无' }));
      } else {
        const hasAnyRevealed = hidden.some((item) => visibleStems.has(item.stem));
        const list = el('div', {
          className: hasAnyRevealed ? 'bazi-hidden-stem-list has-revealed' : 'bazi-hidden-stem-list',
        });
        for (const item of hidden) {
          const wx = getWuxing(item.stem);
          const row = el('div', { className: 'bazi-hidden-item' });
          row.append(
            termButton(item.stem, item.stem, openTerm, { className: 'bazi-hidden-stem', wuxing: wx }),
            termButton(item.tenGod, item.tenGod, openTerm, { className: 'bazi-hidden-god' }),
          );
          if (visibleStems.has(item.stem)) {
            row.append(
              el('span', {
                className: 'bazi-stem-revealed',
                text: '透',
                title: `${item.stem}已透出至原局天干`,
              }),
            );
          }
          list.append(row);
        }
        cell.append(list);
      }
      table.append(cell);
    }

    // 纳音
    table.append(el('div', { className: 'bazi-pillars-cell is-label', text: '纳音' }));
    for (const col of displayColumns) {
      table.append(
        el(
          'div',
          { className: `bazi-pillars-cell${colToneClass(col)}`.trim() },
          termButton(col.pillar.naYin ?? '—', col.pillar.naYin ?? '', openTerm, { className: 'bazi-meta-btn' }),
        ),
      );
    }

    // 自坐
    table.append(el('div', { className: 'bazi-pillars-cell is-label', text: '自坐' }));
    for (const col of displayColumns) {
      const selfStage = col.pillar.selfLifeStage ?? '—';
      table.append(
        el(
          'div',
          { className: `bazi-pillars-cell${colToneClass(col)}`.trim() },
          termButton(selfStage, selfStage === '—' ? '' : selfStage, openTerm, { className: 'bazi-meta-btn' }),
        ),
      );
    }

    // 星运（十二长生）
    table.append(el('div', { className: 'bazi-pillars-cell is-label', text: '星运' }));
    for (const col of displayColumns) {
      const stage = col.pillar.lifeStage ?? '—';
      table.append(
        el(
          'div',
          { className: `bazi-pillars-cell${colToneClass(col)}`.trim() },
          termButton(stage, stage === '—' ? '十二长生' : stage, openTerm, { className: 'bazi-meta-btn' }),
        ),
      );
    }

    // 空亡（旬空，并标明是否落入日柱主空）
    const dayVoidSet = new Set(chart.pillars.day.voidBranches ?? []);
    table.append(el('div', { className: 'bazi-pillars-cell is-label', text: '空亡' }));
    for (const col of displayColumns) {
      const voids = col.pillar.voidBranches?.length ? col.pillar.voidBranches.join('') : '无';
      const isHitDayVoid = !col.isDay && dayVoidSet.has(col.pillar.zhi);
      const cell = el('div', {
        className: `bazi-pillars-cell is-multiline${colToneClass(col)}`.trim(),
      });
      cell.append(termButton(voids, '旬空', openTerm, { className: 'bazi-meta-btn' }));
      if (isHitDayVoid) {
        cell.append(el('span', { className: 'bazi-void-hit-badge', text: '日空', title: `${col.label}地支${col.pillar.zhi}落入日柱旬空` }));
      }
      table.append(cell);
    }

    // 神煞徽章行
    table.append(el('div', { className: 'bazi-pillars-cell is-label is-shensha-label', text: '神煞' }));
    for (const col of displayColumns) {
      const items = col.shensha;
      const cell = el('div', {
        className: `bazi-pillars-cell is-shensha${colToneClass(col)}`.trim(),
      });
      if (!items.length) {
        cell.append(el('span', { className: 'bazi-shensha-empty', text: col.isFortune ? '—' : '无' }));
      } else {
        const list = el('div', { className: 'bazi-shensha-list' });
        for (const item of items) {
          const tone = getShenshaTone(item);
          list.append(
            el('button', {
              type: 'button',
              className: `bazi-shensha-tag ${tone}`,
              text: item,
              title: `点击查看「${item}」释义`,
              onClick: () => openTerm(item),
            }),
          );
        }
        cell.append(list);
      }
      table.append(cell);
    }

    tableWrap.replaceChildren(table);
  };

  if (hasFortuneColumnsAvailable) {
    modeWithFortuneBtn.addEventListener('click', () => {
      if (!showFortuneColumns) {
        showFortuneColumns = true;
        renderPillarsTable();
      }
    });
    modeNatalOnlyBtn.addEventListener('click', () => {
      if (showFortuneColumns) {
        showFortuneColumns = false;
        renderPillarsTable();
      }
    });
  }

  renderPillarsTable();
  shell.append(tableWrap);

  // 命局结构与引擎测算提要（身强身弱 / 核心格局 / 喜用调候 / 三垣 / 合冲刑害）
  const rawChart = chart as unknown as Record<string, unknown>;
  const strength = rawChart.strength as
    | { status?: string; hasRoot?: boolean; strongRoot?: boolean; month?: { season?: string; commanderStem?: string; commanderEffect?: string } }
    | undefined;
  const patternOverview = rawChart.patternOverview as { pattern?: string; source?: string } | undefined;
  const usefulGod = rawChart.usefulGod as
    | {
        favorableWuxing?: string[];
        unfavorableWuxing?: string[];
        favorable?: string[];
        useful?: string;
        avoid?: string;
        strategyTrace?: string[];
      }
    | undefined;
  const climateDecision = rawChart.climateDecision as { referenceOrder?: string[] } | undefined;
  const extraPalaces = rawChart.extraPalaces as
    | {
        taiYuan?: BaziPillarData;
        mingGong?: BaziPillarData;
        shenGong?: BaziPillarData;
        taiXi?: BaziPillarData;
      }
    | undefined;
  const ordinaryPattern = rawChart.ordinaryPattern as
    | {
        candidate?: string;
        source?: string;
        selectedStem?: string;
        monthPrincipal?: { stem?: string; tenGod?: string; pattern?: string };
        commander?: { stem?: string; tenGod?: string; pattern?: string; isMonthHidden?: boolean };
      }
    | undefined;
  const climateData = rawChart.climate as
    | {
        currentJieqi?: string;
        candidates?: Array<{ label?: string; recommendationStems?: string[]; hint?: string }>;
      }
    | undefined;
  const usefulStrategy = rawChart.usefulStrategy as
    | {
        disease?: { status?: string; direction?: string; element?: string; reason?: string };
        bridges?: Array<{ elements?: string[]; bridge?: string }>;
      }
    | undefined;
  const fullUsefulGod = rawChart.usefulGod as
    | {
        favorableWuxing?: string[];
        unfavorableWuxing?: string[];
        favorable?: string[];
        useful?: string;
        avoid?: string;
        primaryReason?: string;
        matchedRules?: Array<{ label?: string; description?: string }>;
        strategyTrace?: string[];
      }
    | undefined;
  const natalFacts = rawChart.natalFacts as
    | { relations?: Array<{ name?: string; element?: string; values?: string[] }> }
    | undefined;

  // 时月东方风格五层岁运联动选择器（大运 / 流年 / 流月 / 流日 / 流时），紧贴主表下方
  const relationsWrap = el('div', { className: 'bazi-relations-stack' });
  const natalColumns: Array<{ key: PillarKey; label: string; pillar: BaziPillar }> = [
    { key: 'year', label: '年柱', pillar: toComparablePillar(chart.pillars.year) },
    { key: 'month', label: '月柱', pillar: toComparablePillar(chart.pillars.month) },
    { key: 'day', label: '日柱', pillar: toComparablePillar(chart.pillars.day) },
    { key: 'hour', label: '时柱', pillar: toComparablePillar(chart.pillars.hour) },
  ];

  const renderRelationsSection = () => {
    relationsWrap.replaceChildren();
    const rels = natalFacts?.relations ?? [];
    if (rels.length > 0) {
      const relBar = el('div', { className: 'bz-relations-bar' });
      relBar.append(el('span', { className: 'bz-relations-label', text: '合冲关系' }));
      const relChips = el('div', { className: 'bz-relations-chips' });
      for (const rel of rels) {
        const vals = rel.values?.join('') ?? '';
        const txt = `${rel.name ?? ''}${vals ? ` ${vals}` : ''}${rel.element ? `(${rel.element})` : ''}`.trim();
        if (txt) relChips.append(el('span', { className: 'board-chip', text: txt }));
      }
      relBar.append(relChips);
      relationsWrap.append(relBar);
    }

    const dmGan = chart.pillars.day?.gan ?? '';
    const activeCycle = cyclesList[selectedCycleIdx];
    const activeCyclePillar =
      activeCycle?.pillar ??
      (activeCycle?.ganZhi && dmGan ? (buildPillarFact(activeCycle.ganZhi, dmGan) as BaziPillarData) : undefined);
    const activeYearGz = selectedYear ? getYearSixtyCycle(selectedYear) : (annualPillar?.ganZhi ?? '');
    const activeYearPillar =
      activeYearGz && located?.year?.ganZhi === activeYearGz && located?.flowYear === selectedYear
        ? located.year
        : activeYearGz && dmGan
          ? (buildPillarFact(activeYearGz, dmGan) as BaziPillarData)
          : isPillar(annualPillar)
            ? annualPillar
            : undefined;

    const fortuneChips: Array<{ text: string; accent?: boolean }> = [];
    const seenTexts = new Set<string>();
    const pushChip = (text: string, accent = false) => {
      if (!text || seenTexts.has(text)) return;
      seenTexts.add(text);
      fortuneChips.push({ text, accent });
    };

    if (located?.flowYear === selectedYear) {
      for (const fm of located.evidence?.formations ?? []) {
        const branchStr = fm.branches?.join('') ?? '';
        const triggerNames = (fm.triggers ?? [])
          .map((t) => formatFortuneLayerLabel(t.layer))
          .filter(Boolean)
          .join('/');
        pushChip(
          `${fm.name ?? '成局'}${fm.element ? `(${fm.element})` : ''}${branchStr ? ` ${branchStr}` : ''}${triggerNames ? ` · ${triggerNames}引动` : ''}`,
          true,
        );
      }
    }

    const activeSources: Array<{ label: string; pillar: BaziPillarData | undefined }> = [
      { label: activeCyclePillar ? `大运${activeCyclePillar.ganZhi}` : '', pillar: activeCyclePillar },
      { label: activeYearPillar ? `${selectedYear ? `${selectedYear}流年` : '流年'}${activeYearPillar.ganZhi}` : '', pillar: activeYearPillar },
    ];
    for (const src of activeSources) {
      if (!src.pillar?.ganZhi || !src.label) continue;
      const cmp = toComparablePillar(src.pillar);
      for (const nat of natalColumns) {
        const hitRels = comparePillars(cmp, nat.pillar);
        if (hitRels.length > 0) {
          const names = hitRels.map((r) => `${r.name}${r.subtype ? `(${r.subtype})` : ''}`).join('·');
          pushChip(`${src.label} ↔ ${nat.label}${nat.pillar.ganZhi}：${names}`);
        }
      }
    }

    if (fortuneChips.length > 0) {
      const compBox = el('div', { className: 'bz-relations-bar' });
      compBox.append(el('span', { className: 'bz-relations-label', text: '岁运引动' }));
      const chips = el('div', { className: 'bz-relations-chips' });
      for (const item of fortuneChips) {
        chips.append(el('span', { className: item.accent ? 'board-chip is-accent' : 'board-chip', text: item.text }));
      }
      compBox.append(chips);
      relationsWrap.append(compBox);
    }

    relationsWrap.hidden = relationsWrap.childElementCount === 0;
  };

  if (cyclesList.length > 0 || annualPillar) {
    const fortuneCard = el('section', { className: 'bazi-fortune-card', ariaLabel: '岁运联动选择' });
    const secHead = el('div', { className: 'bazi-dayun-head' });
    const secTitleWrap = el('div', { className: 'bazi-dayun-head-left' });
    secTitleWrap.append(el('div', { className: 'bazi-dayun-title', text: '岁运' }));
    const subParts: string[] = [];
    if (fortune?.startAge) subParts.push(`${startYears}岁起运`);
    if (located?.smallFortune?.pillar?.ganZhi) {
      subParts.push(
        `小运 ${located.smallFortune.pillar.ganZhi}${located.smallFortune.nominalAge ? `(${located.smallFortune.nominalAge}岁)` : ''}`,
      );
    }
    if (subParts.length > 0) {
      secTitleWrap.append(el('span', { className: 'bazi-dayun-sub', text: subParts.join(' · ') }));
    }
    secHead.append(secTitleWrap);

    const fortuneGrid = el('div', { className: 'bazi-fortune-grid' });
    const stripScrollCache = new Map<string, number>();

    const buildFortuneGz = (ganZhi: string, dmGan: string, overrideGanGod?: string) => {
      const gan = ganZhi.slice(0, 1);
      const zhi = ganZhi.slice(1, 2);
      const fact =
        dmGan && gan && zhi
          ? buildPillarFact(ganZhi, dmGan as Parameters<typeof buildPillarFact>[1])
          : undefined;
      const ganGod = formatTenGodAbbr(overrideGanGod || fact?.tenGod);
      const zhiGod = formatTenGodAbbr(fact?.hiddenStems?.[0]?.tenGod);

      const gzWrap = el('div', { className: 'bazi-fortune-gz' });
      const topPair = el('div', { className: 'bazi-fortune-pair' });
      topPair.append(
        el('span', {
          className: 'bazi-fortune-char',
          text: gan || '—',
          dataset: gan ? { wuxing: fact?.stemElement ?? getWuxing(gan) } : undefined,
        }),
      );
      if (ganGod) topPair.append(el('small', { className: 'bazi-fortune-god', text: ganGod }));

      const botPair = el('div', { className: 'bazi-fortune-pair' });
      botPair.append(
        el('span', {
          className: 'bazi-fortune-char',
          text: zhi || '',
          dataset: zhi ? { wuxing: fact?.branchElement ?? getWuxing(zhi) } : undefined,
        }),
      );
      if (zhiGod) botPair.append(el('small', { className: 'bazi-fortune-god', text: zhiGod }));

      gzWrap.append(topPair, botPair);
      return gzWrap;
    };

    const renderFortuneSelector = (recenterRows?: Set<string>) => {
      fortuneGrid.querySelectorAll<HTMLElement>('.bazi-fortune-strip').forEach((node) => {
        const key = node.dataset.rowKey;
        if (key) stripScrollCache.set(key, node.scrollLeft);
      });
      fortuneGrid.replaceChildren();
      const dmGan = chart.pillars.day?.gan ?? '';
      const stripsToSync: Array<{ rowKey: string; strip: HTMLElement }> = [];

      const appendRow = (rowKey: string, title: string, strip: HTMLElement) => {
        strip.dataset.rowKey = rowKey;
        const row = el('div', { className: 'bazi-fortune-row' });
        row.append(el('div', { className: 'bazi-fortune-row-title', text: title }), strip);
        fortuneGrid.append(row);
        stripsToSync.push({ rowKey, strip });
      };

      // 1. 大运行（仅列大运，不混入重复流年卡）
      if (cyclesList.length > 0) {
        const cycleStrip = el('div', { className: 'bazi-fortune-strip' });
        for (const [idx, cycle] of cyclesList.entries()) {
          const ganZhi = cycle.pillar?.ganZhi ?? cycle.ganZhi;
          const ageStart = startYears + idx * 10;
          const startYearText = formatYear(cycle.startTimestamp);
          const isCurrent = activeCycleIndex !== undefined && cycle.index === activeCycleIndex;
          const isSelected = idx === selectedCycleIdx;
          const btn = el('button', {
            type: 'button',
            className: `bazi-fortune-item${isSelected ? ' is-selected' : ''}${isCurrent ? ' is-today' : ''}`,
            onClick: () => {
              selectedCycleIdx = idx;
              const cycStart = getCycleStartYear(cycle);
              selectedYear =
                todayFlowYear >= cycStart && todayFlowYear < cycStart + 10 ? todayFlowYear : cycStart;
              renderPillarsTable();
              renderRelationsSection();
              renderFortuneSelector(new Set(['year', 'month', 'day', 'hour']));
            },
          });
          btn.append(
            el('div', { className: 'bazi-fortune-top', text: startYearText }),
            el('div', { className: 'bazi-fortune-sub', text: `${ageStart}岁` }),
            buildFortuneGz(ganZhi, dmGan, cycle.pillar?.tenGod),
          );
          cycleStrip.append(btn);
        }
        appendRow('dayun', '大运', cycleStrip);
      }

      // 2. 流年行
      const activeCycle = cyclesList[selectedCycleIdx];
      const years = activeCycle
        ? Array.from({ length: 10 }, (_, idx) => {
            const yr = getCycleStartYear(activeCycle) + idx;
            const ageNum = birthYearFromBasis
              ? Math.max(1, yr - birthYearFromBasis + 1)
              : startYears + selectedCycleIdx * 10 + idx;
            return { year: yr, age: ageNum, ganZhi: getYearSixtyCycle(yr) };
          })
        : selectedYear
          ? [{ year: selectedYear, age: birthYearFromBasis ? Math.max(1, selectedYear - birthYearFromBasis + 1) : 1, ganZhi: getYearSixtyCycle(selectedYear) }]
          : [];
      if (years.length > 0) {
        if (!years.some((item) => item.year === selectedYear)) {
          selectedYear = years[0]!.year;
        }
        const yearStrip = el('div', { className: 'bazi-fortune-strip' });
        for (const item of years) {
          const isSelected = item.year === selectedYear;
          const isToday = item.year === currentBeijingYear;
          const btn = el('button', {
            type: 'button',
            className: `bazi-fortune-item${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`,
            onClick: () => {
              selectedYear = item.year;
              renderPillarsTable();
              renderRelationsSection();
              renderFortuneSelector(new Set(['month', 'day', 'hour']));
            },
          });
          btn.append(
            el('div', { className: 'bazi-fortune-top', text: String(item.year) }),
            el('div', { className: 'bazi-fortune-sub', text: `${item.age}岁` }),
            buildFortuneGz(item.ganZhi, dmGan),
          );
          yearStrip.append(btn);
        }
        appendRow('year', '流年', yearStrip);
      }

      // 3. 流月行（含交节名称与公历日期，对齐时月东方）
      const months = getYearMonthList(selectedYear).map((ganZhi, idx) => {
        const meta = getFlowMonthStartMeta(selectedYear, idx);
        return {
          index: idx,
          label: `${ganZhi[1]}月`,
          sub: `${meta.termName} ${meta.shortDate}`,
          ganZhi,
        };
      });
      if (selectedMonthIdx < 0 || selectedMonthIdx >= months.length) selectedMonthIdx = 0;
      const monthStrip = el('div', { className: 'bazi-fortune-strip' });
      for (const m of months) {
        const isSelected = m.index === selectedMonthIdx;
        const isTodayMonth = selectedYear === todayFlowYear && m.index === todaySolarMonthIdx;
        const btn = el('button', {
          type: 'button',
          className: `bazi-fortune-item${isSelected ? ' is-selected' : ''}${isTodayMonth ? ' is-today' : ''}`,
          onClick: () => {
            selectedMonthIdx = m.index;
            renderPillarsTable();
            renderRelationsSection();
            renderFortuneSelector(new Set(['day', 'hour']));
          },
        });
        btn.append(
          el('div', { className: 'bazi-fortune-top', text: m.label }),
          el('div', { className: 'bazi-fortune-sub', text: m.sub }),
          buildFortuneGz(m.ganZhi, dmGan),
        );
        monthStrip.append(btn);
      }
      appendRow('month', '流月', monthStrip);

      // 4. 流日行（公历日期 + 农历日标签）
      const { daysList, activeDay, hoursList, activeHour } = resolveActiveDayAndHour();
      if (daysList.length > 0) {
        const dayStrip = el('div', { className: 'bazi-fortune-strip' });
        for (const d of daysList) {
          const isSelected = d.key === activeDay?.key;
          const isToday = d.key === currentYmdKey;
          const btn = el('button', {
            type: 'button',
            className: `bazi-fortune-item${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`,
            onClick: () => {
              selectedDayKey = d.key;
              renderPillarsTable();
              renderRelationsSection();
              renderFortuneSelector(new Set(['hour']));
            },
          });
          btn.append(
            el('div', { className: 'bazi-fortune-top', text: d.shortDate }),
            el('div', { className: 'bazi-fortune-sub', text: d.lunarLabel }),
            buildFortuneGz(d.ganZhi, dmGan),
          );
          dayStrip.append(btn);
        }
        appendRow('day', '流日', dayStrip);
      }

      // 5. 流时行
      if (hoursList.length > 0) {
        const hourStrip = el('div', { className: 'bazi-fortune-strip' });
        for (const h of hoursList) {
          const isSelected = h.index === activeHour?.index;
          const isNowHour = activeDay?.key === currentYmdKey && h.index === currentShichenIdx;
          const btn = el('button', {
            type: 'button',
            className: `bazi-fortune-item${isSelected ? ' is-selected' : ''}${isNowHour ? ' is-today' : ''}`,
            onClick: () => {
              selectedHourIdx = h.index;
              renderPillarsTable();
              renderRelationsSection();
              renderFortuneSelector(new Set());
            },
          });
          btn.append(
            el('div', { className: 'bazi-fortune-top', text: h.label }),
            el('div', { className: 'bazi-fortune-sub', text: h.range }),
            buildFortuneGz(h.ganZhi, dmGan),
          );
          hourStrip.append(btn);
        }
        appendRow('hour', '流时', hourStrip);
      }

      requestAnimationFrame(() => {
        for (const { rowKey, strip } of stripsToSync) {
          const shouldCenter = !recenterRows || recenterRows.has(rowKey);
          if (shouldCenter) {
            const activeItem = strip.querySelector<HTMLElement>('.bazi-fortune-item.is-selected');
            if (activeItem) {
              strip.scrollLeft = Math.max(
                0,
                activeItem.offsetLeft - strip.clientWidth / 2 + activeItem.clientWidth / 2,
              );
              continue;
            }
          }
          const prevLeft = stripScrollCache.get(rowKey);
          if (prevLeft !== undefined) strip.scrollLeft = prevLeft;
        }
      });
    };

    if (cyclesList.length > 0) {
      const todayBtn = el('button', {
        type: 'button',
        className: 'bazi-dayun-today-btn',
        text: '今',
        title: '回到今日流运',
        ariaLabel: '回到今日流运',
        onClick: () => {
          selectedCycleIdx = defaultCycleIdx;
          const cyc = cyclesList[selectedCycleIdx];
          const cycStart = cyc ? getCycleStartYear(cyc) : todayFlowYear;
          selectedYear =
            todayFlowYear >= cycStart && todayFlowYear < cycStart + 10 ? todayFlowYear : cycStart;
          selectedMonthIdx = todaySolarMonthIdx;
          selectedDayKey = currentYmdKey;
          selectedHourIdx = currentShichenIdx;
          renderPillarsTable();
          renderRelationsSection();
          renderFortuneSelector(new Set(['dayun', 'year', 'month', 'day', 'hour']));
        },
      });
      secHead.append(todayBtn);
    }

    fortuneCard.append(secHead, fortuneGrid);
    renderFortuneSelector(new Set(['dayun', 'year', 'month', 'day', 'hour']));
    shell.append(fortuneCard);
  }

  renderRelationsSection();
  shell.append(relationsWrap);

  // 四垣附柱条（稍后放置于五行分布下方，保持主体与岁运紧贴）
  const extraList: Array<[string, BaziPillarData | undefined]> = [
    ['胎元', extraPalaces?.taiYuan],
    ['命宫', extraPalaces?.mingGong],
    ['身宫', extraPalaces?.shenGong],
    ['胎息', extraPalaces?.taiXi],
  ];
  const validExtras = extraList.filter((item): item is [string, BaziPillarData] => Boolean(item[1]?.ganZhi));
  const epStrip = validExtras.length > 0 ? el('div', { className: 'bazi-extra-pillars' }) : undefined;
  if (epStrip) {
    for (const [epLabel, ep] of validExtras) {
      const card = el('div', { className: 'bazi-ep-card' });
      const headRow = el('div', { className: 'bazi-ep-head' });
      headRow.append(termButton(epLabel, epLabel, openTerm, { className: 'bazi-ep-label' }));
      if (ep.tenGod) headRow.append(el('span', { className: 'bazi-ep-god', text: ep.tenGod }));
      const gzRow = el('div', { className: 'bazi-ep-gz' });
      gzRow.append(
        el('span', { className: 'bazi-ep-char', text: ep.gan, dataset: { wuxing: ep.stemElement ?? getWuxing(ep.gan) } }),
        el('span', { className: 'bazi-ep-char', text: ep.zhi, dataset: { wuxing: ep.branchElement ?? getWuxing(ep.zhi) } }),
      );
      const foot = el('div', {
        className: 'bazi-ep-foot',
        text: [ep.naYin, ep.lifeStage].filter(Boolean).join(' · '),
      });
      card.append(headRow, gzRow, foot);
      epStrip.append(card);
    }
  }

  const insightGrid = el('div', { className: 'bz-computed-grid' });

  const appendInsightCell = (title: string, mainText: string, subText?: string) => {
    const cell = el('div', { className: 'bz-computed-card' });
    cell.append(
      el('span', { className: 'bz-computed-label', text: title }),
      el('strong', { className: 'bz-computed-value', text: mainText }),
    );
    if (subText) cell.append(el('small', { className: 'bz-computed-sub', text: subText }));
    insightGrid.append(cell);
  };

  if (strength?.status) {
    const rootText = strength.strongRoot ? '强根' : strength.hasRoot ? '有根' : '无根';
    const seasonText = strength.month?.season ? `月令${strength.month.season}` : '';
    const cmdText = strength.month?.commanderStem ? `司令${strength.month.commanderStem}` : '';
    appendInsightCell(
      '日主强弱',
      strength.status,
      [seasonText, rootText, cmdText].filter(Boolean).join(' · '),
    );
  }
  if (patternOverview?.pattern) {
    const ordSub = [
      patternOverview.source,
      ordinaryPattern?.selectedStem ? `取干${ordinaryPattern.selectedStem}` : '',
      ordinaryPattern?.monthPrincipal?.pattern && ordinaryPattern.monthPrincipal.pattern !== patternOverview.pattern
        ? `本气${ordinaryPattern.monthPrincipal.pattern}`
        : '',
    ]
      .filter(Boolean)
      .join(' · ');
    appendInsightCell('参考格局', patternOverview.pattern, ordSub);
  }
  if (fullUsefulGod?.favorableWuxing?.length || fullUsefulGod?.useful) {
    const favWx = fullUsefulGod.favorableWuxing?.join('、') || '';
    const favGods = fullUsefulGod.favorable?.slice(0, 4).join('·') || '';
    const unfavWx = fullUsefulGod.unfavorableWuxing?.length
      ? `忌${fullUsefulGod.unfavorableWuxing.join('、')}`
      : '';
    appendInsightCell(
      '喜用五行',
      favWx ? `喜 ${favWx}` : fullUsefulGod.useful ?? '—',
      [fullUsefulGod.primaryReason ? `主取${fullUsefulGod.primaryReason}` : '', favGods, unfavWx].filter(Boolean).join(' · '),
    );
  }
  if (climateDecision?.referenceOrder?.length || climateData?.candidates?.length) {
    const mainClimate = climateDecision?.referenceOrder?.length
      ? climateDecision.referenceOrder.join(' → ')
      : climateData?.candidates?.[0]?.recommendationStems?.join('、') ?? '—';
    const subClimate =
      climateData?.candidates?.[0]?.hint ??
      fullUsefulGod?.strategyTrace?.find((s) => s.startsWith('病药提示:'))?.replace('病药提示:', '');
    appendInsightCell(
      `调候参考${climateData?.currentJieqi ? `（${climateData.currentJieqi}）` : ''}`,
      mainClimate,
      subClimate,
    );
  }
  if (usefulStrategy?.bridges?.length || usefulStrategy?.disease?.reason) {
    const bridgeTxt = usefulStrategy.bridges
      ?.map((b) => `${b.elements?.join('↔') ?? ''}需${b.bridge ?? ''}`)
      .join('；');
    appendInsightCell(
      '病药与通关',
      usefulStrategy.bridges?.length ? `通关 ${usefulStrategy.bridges.map((b) => b.bridge).filter(Boolean).join('、')}` : usefulStrategy.disease?.status ?? '均衡观察',
      [bridgeTxt, usefulStrategy.disease?.reason].filter(Boolean).join(' · ') || undefined,
    );
  }

  // 四柱明字五行计数
  const wxCounts: Record<'木' | '火' | '土' | '金' | '水', number> = {
    木: 0,
    火: 0,
    土: 0,
    金: 0,
    水: 0,
  };
  for (const col of columns) {
    const gWx = (col.pillar.stemElement ?? getWuxing(col.pillar.gan)) as keyof typeof wxCounts;
    const zWx = (col.pillar.branchElement ?? getWuxing(col.pillar.zhi)) as keyof typeof wxCounts;
    if (gWx in wxCounts) wxCounts[gWx] += 1;
    if (zWx in wxCounts) wxCounts[zWx] += 1;
  }
  const wxSummary = (['木', '火', '土', '金', '水'] as const)
    .map((k) => `${k}${wxCounts[k]}`)
    .join(' · ');
  const lacking = (['木', '火', '土', '金', '水'] as const).filter((k) => wxCounts[k] === 0);
  const strongest = (['木', '火', '土', '金', '水'] as const).reduce((a, b) =>
    wxCounts[b] > wxCounts[a] ? b : a,
  );
  const wxOverviewText = `${strongest}旺(${wxCounts[strongest]})${lacking.length ? ` · 缺${lacking.join('、')}` : ' · 五行俱全'}`;

  if (insightGrid.childElementCount > 0) {
    shell.append(insightGrid);
  }

  const matchedRulesList = fullUsefulGod?.matchedRules?.filter((r) => r.label || r.description) ?? [];

  // 五行力量分布可视化彩条（含地支藏干本/中/余气权重）与十神格局频次
  const FIVE_ELEMENTS = ['木', '火', '土', '金', '水'] as const;
  type WxKey = (typeof FIVE_ELEMENTS)[number];
  const wxWeight: Record<WxKey, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  const hiddenRoleWeights = [1.0, 0.5, 0.25];
  const godGroups: Record<string, number> = { 比劫: 0, 食伤: 0, 财星: 0, 官杀: 0, 印枭: 0 };
  const mapTenGodGroup = (god: string | undefined) => {
    if (!god || god === '日主') return;
    if (god === '比肩' || god === '劫财') godGroups['比劫'] += 1;
    else if (god === '食神' || god === '伤官') godGroups['食伤'] += 1;
    else if (god === '偏财' || god === '正财') godGroups['财星'] += 1;
    else if (god === '七杀' || god === '正官') godGroups['官杀'] += 1;
    else if (god === '偏印' || god === '正印') godGroups['印枭'] += 1;
  };
  for (const col of columns) {
    const gWx = (col.pillar.stemElement ?? getWuxing(col.pillar.gan)) as WxKey;
    if (gWx in wxWeight) wxWeight[gWx] += 1.0;
    if (!col.isDay) mapTenGodGroup(col.pillar.tenGod);
    const hiddens = col.pillar.hiddenStems ?? [];
    if (hiddens.length > 0) {
      hiddens.forEach((h, idx) => {
        const hw = getWuxing(h.stem) as WxKey;
        if (hw in wxWeight) wxWeight[hw] += hiddenRoleWeights[idx] ?? 0.25;
        if (idx === 0) mapTenGodGroup(h.tenGod);
      });
    } else {
      const zWx = (col.pillar.branchElement ?? getWuxing(col.pillar.zhi)) as WxKey;
      if (zWx in wxWeight) wxWeight[zWx] += 1.0;
    }
  }
  const totalWeight = FIVE_ELEMENTS.reduce((s, k) => s + wxWeight[k], 0) || 1;
  const favSet = new Set(usefulGod?.favorableWuxing ?? []);
  const unfavSet = new Set(usefulGod?.unfavorableWuxing ?? []);
  const wxSection = el('div', { className: 'bazi-wuxing-bars' });
  const wxHead = el('div', { className: 'bazi-wuxing-bars-head' });
  wxHead.append(el('span', { className: 'bazi-wuxing-bars-title', text: '含藏干五行力量分布' }));
  const godText = Object.entries(godGroups)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k}×${n}`)
    .join(' · ');
  const wxSubText = [wxOverviewText, godText ? `十神：${godText}` : ''].filter(Boolean).join(' · ');
  if (wxSubText) {
    wxHead.append(el('span', { className: 'bazi-wuxing-bars-sub', text: wxSubText }));
  }
  wxSection.append(wxHead);
  const wxGrid = el('div', { className: 'bazi-wuxing-bar-grid' });
  for (const k of FIVE_ELEMENTS) {
    const pct = Math.round((wxWeight[k] / totalWeight) * 100);
    const tag = favSet.has(k) ? '喜' : unfavSet.has(k) ? '忌' : '';
    const item = el('div', { className: 'bazi-wuxing-bar-item', dataset: { wuxing: k } });
    const rowTop = el('div', { className: 'bazi-wuxing-bar-top' });
    rowTop.append(
      el('span', { className: 'bazi-wuxing-bar-name', text: `${k}${tag ? `(${tag})` : ''}` }),
      el('span', { className: 'bazi-wuxing-bar-pct', text: `${wxCounts[k]}字 · ${pct}%` }),
    );
    const track = el('div', { className: 'bazi-wuxing-bar-track' });
    const fill = el('div', { className: 'bazi-wuxing-bar-fill' });
    fill.style.width = `${Math.max(pct, wxCounts[k] > 0 ? 6 : 0)}%`;
    track.append(fill);
    item.append(rowTop, track);
    wxGrid.append(item);
  }
  wxSection.append(wxGrid);
  shell.append(wxSection);
  if (epStrip) shell.append(epStrip);

  // 日主根气与生助/克泄来源 + 取用规则拆解（收拢至弹窗，主盘面只留核心结果）
  const fullStrength = rawChart.strength as
    | {
        roots?: Array<{ branch?: string; stem?: string; hiddenRole?: string; clashStatus?: string }>;
        support?: Array<{ value?: string; effect?: string }>;
        constraint?: Array<{ value?: string; effect?: string }>;
      }
    | undefined;
  const hasStrengthBasis = Boolean(
    fullStrength?.roots?.length || fullStrength?.support?.length || fullStrength?.constraint?.length,
  );
  const strengthBasisTrigger =
    hasStrengthBasis || matchedRulesList.length > 0
      ? createBoardModalTrigger(
          '根气与取用依据',
          '日主根气与喜用取法依据',
          () => {
            const frag = document.createDocumentFragment();
            if (matchedRulesList.length > 0) {
              const ruleStrip = el('div', { className: 'bazi-rules-strip' });
              for (const r of matchedRulesList) {
                const item = el('div', { className: 'bazi-rule-pill' });
                if (r.label) item.append(el('strong', { text: `${r.label}：` }));
                if (r.description) item.append(el('span', { text: r.description }));
                ruleStrip.append(item);
              }
              frag.append(ruleStrip);
            }
            if (hasStrengthBasis && fullStrength) {
              const breakdown = el('div', { className: 'bazi-strength-breakdown' });
              const addLine = (label: string, valueText: string) => {
                const row = el('div', { className: 'bazi-strength-row' });
                row.append(
                  el('span', { className: 'bazi-strength-k', text: label }),
                  el('span', { className: 'bazi-strength-v', text: valueText }),
                );
                breakdown.append(row);
              };
              const rootText = fullStrength.roots?.length
                ? fullStrength.roots
                    .map((r) => `${r.branch ?? ''}藏${r.stem ?? ''}(${r.hiddenRole ?? '根'}·${r.clashStatus ?? '未受冲'})`)
                    .join('、')
                : '四柱地支无通根（虚浮无根）';
              addLine('日主根气', rootText);
              if (fullStrength.support?.length) {
                addLine(
                  '生助来源',
                  fullStrength.support.map((s) => `${s.value ?? ''}(${s.effect ?? '扶身'})`).join(' · '),
                );
              }
              if (fullStrength.constraint?.length) {
                addLine(
                  '克泄耗源',
                  fullStrength.constraint
                    .map((c) => `${c.value ?? ''}(${c.effect ?? '制身'})`)
                    .join(' · '),
                );
              }
              frag.append(breakdown);
            }
            return frag;
          },
          matchedRulesList.length > 0 ? `${matchedRulesList.length}条` : undefined,
        )
      : undefined;

  // 岁运神煞与流月司令弹窗触发器
  const fortuneLayersWithEntries = (located?.shensha?.layers ?? []).filter((l) => (l.entries?.length ?? 0) > 0);
  const mcInfo = located?.monthCommander;
  const hasFortuneModal = fortuneLayersWithEntries.length > 0 || Boolean(mcInfo?.stem);
  const fortuneShenshaCount = fortuneLayersWithEntries.reduce((sum, l) => sum + (l.entries?.length ?? 0), 0);
  const fortuneShenshaTrigger = hasFortuneModal
    ? createBoardModalTrigger(
        '岁运神煞与司令',
        '岁运神煞与流月司令',
        () => {
          const frag = document.createDocumentFragment();
          if (mcInfo?.stem) {
            const noteText = [
              `流月人元司令：${mcInfo.stem}干用事`,
              mcInfo.branch ? `（${mcInfo.branch}月）` : '',
              mcInfo.previousJie?.name ? ` · ${mcInfo.previousJie.name}交节` : '',
              mcInfo.nextJie?.name ? `至${mcInfo.nextJie.name}` : '',
            ].join('');
            frag.append(el('p', { className: 'wb-note-box', text: noteText }));
          }
          if (fortuneLayersWithEntries.length > 0) {
            const list = el('div', { className: 'wb-computed-list' });
            for (const layer of fortuneLayersWithEntries) {
              const card = el('div', { className: 'wb-computed-item' });
              card.append(
                el('strong', {
                  className: 'wb-computed-title',
                  text: `${formatFortuneLayerLabel(layer.id)} · ${layer.ganZhi}`,
                }),
              );
              const chipWrap = el('div', { className: 'bazi-dayun-detail-chips' });
              for (const entry of layer.entries ?? []) {
                chipWrap.append(
                  el('span', {
                    className: `bazi-shensha-tag ${getShenshaTone(entry.name)}`,
                    text: entry.target ? `${entry.name}(${entry.target})` : entry.name,
                  }),
                );
              }
              card.append(chipWrap);
              list.append(card);
            }
            frag.append(list);
          }
          return frag;
        },
        fortuneShenshaCount > 0 ? `${fortuneShenshaCount}项` : undefined,
      )
    : undefined;

  const finalDetailBar = createBoardDetailBar([strengthBasisTrigger, fortuneShenshaTrigger]);
  if (finalDetailBar) shell.append(finalDetailBar);

  shell.append(termPanel.element);

  container.hidden = false;
  container.replaceChildren(shell);
  return true;
}
