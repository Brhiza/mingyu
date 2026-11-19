import { SolarTime } from 'tyme4ts';
import { buildPillarFact } from '../systems/bazi/pillars';
import { getYearMonthList, getYearSixtyCycle } from '../systems/ganzhi-foundation';
import './boards.css';
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
    flowYear?: number;
    inChildhood?: boolean;
    cycle?: BaziFortuneCycle;
    year?: BaziPillarData;
    month?: BaziPillarData;
    day?: BaziPillarData;
    hour?: BaziPillarData;
    smallFortune?: { nominalAge?: number; pillar?: BaziPillarData };
    evidence?: {
      comparisons?: Array<{
        source?: string;
        sourceGanZhi?: string;
        target?: string;
        targetGanZhi?: string;
        relations?: Array<{ name?: string; values?: string[]; subtype?: string }>;
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
  '太极贵人',
  '文昌贵人',
  '福星贵人',
  '国印贵人',
  '金舆',
  '天厨贵人',
  '禄神',
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
  '天赦日',
  '三奇贵人',
  '拱禄',
  '将星',
  '十灵日',
  '六秀日',
  '金神',
]);

const UNLUCKY_SHENSHA = new Set([
  '羊刃',
  '飞刃',
  '流霞',
  '亡神',
  '劫煞',
  '灾煞',
  '孤辰',
  '寡宿',
  '丧门',
  '吊客',
  '披麻',
  '血刃',
  '勾绞煞',
  '天罗地网',
  '童子煞',
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
  metaChips.append(el('span', { className: 'board-hint', text: '点击干支、十神、神煞查看百科释义' }));
  head.append(metaChips);
  shell.append(head);

  // 命主农历 / 生肖 / 星座 / 当令节气总览条
  const inputGender =
    ((payload as unknown as Record<string, unknown>).input as { gender?: string } | undefined)?.gender ??
    ((chart as unknown as Record<string, unknown>).input as { gender?: string } | undefined)?.gender;
  const localMatch = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/.exec(
    chart.basis?.localDateTime ?? '',
  );
  if (localMatch || inputGender) {
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
    if (metaBar.childElementCount > 0) {
      shell.append(metaBar);
    }
  }

  // V1 精致四柱纵向网格表
  const visibleStems = new Set(columns.map((c) => c.pillar.gan).filter(Boolean));
  const tableWrap = el('div', { className: 'bazi-table-wrap' });
  const table = el('div', { className: 'bazi-pillars-table', role: 'table', ariaLabel: '四柱八字表' });

  // 表头行
  table.append(el('div', { className: 'bazi-pillars-cell is-label is-head', text: '四柱' }));
  for (const col of columns) {
    const headCell = el('div', {
      className: `bazi-pillars-cell is-head ${col.isDay ? 'is-day-master' : ''}`.trim(),
    });
    headCell.append(el('span', { text: col.label }));
    if (col.caption) {
      headCell.append(el('small', { text: col.caption }));
    }
    table.append(headCell);
  }

  // 命式主格（天干十神 → 超大宋楷干支 → 地支十神）
  table.append(el('div', { className: 'bazi-pillars-cell is-label is-pillar-label', text: '命式' }));
  for (const col of columns) {
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
        { className: `bazi-pillars-cell is-pillar ${col.isDay ? 'is-day-master' : ''}`.trim() },
        pillarBox,
      ),
    );
  }

  // 藏干行（天干五行色 + 十神小字）
  table.append(el('div', { className: 'bazi-pillars-cell is-label', text: '藏干' }));
  for (const col of columns) {
    const hidden = col.pillar.hiddenStems ?? [];
    const cell = el('div', {
      className: `bazi-pillars-cell is-hidden-stems ${col.isDay ? 'is-day-master' : ''}`.trim(),
    });
    if (!hidden.length) {
      cell.append(el('span', { className: 'bazi-shensha-empty', text: '无' }));
    } else {
      const list = el('div', { className: 'bazi-hidden-stem-list' });
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
              title: `${item.stem}已透出至天干`,
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
  for (const col of columns) {
    table.append(
      el(
        'div',
        { className: `bazi-pillars-cell ${col.isDay ? 'is-day-master' : ''}`.trim() },
        termButton(col.pillar.naYin ?? '—', col.pillar.naYin ?? '', openTerm, { className: 'bazi-meta-btn' }),
      ),
    );
  }

  // 自坐
  table.append(el('div', { className: 'bazi-pillars-cell is-label', text: '自坐' }));
  for (const col of columns) {
    const selfStage = col.pillar.selfLifeStage ?? '—';
    table.append(
      el(
        'div',
        { className: `bazi-pillars-cell ${col.isDay ? 'is-day-master' : ''}`.trim() },
        termButton(selfStage, selfStage === '—' ? '' : selfStage, openTerm, { className: 'bazi-meta-btn' }),
      ),
    );
  }

  // 星运（十二长生）
  table.append(el('div', { className: 'bazi-pillars-cell is-label', text: '星运' }));
  for (const col of columns) {
    const stage = col.pillar.lifeStage ?? '—';
    table.append(
      el(
        'div',
        { className: `bazi-pillars-cell ${col.isDay ? 'is-day-master' : ''}`.trim() },
        termButton(stage, stage === '—' ? '十二长生' : stage, openTerm, { className: 'bazi-meta-btn' }),
      ),
    );
  }

  // 空亡（旬空，并标明是否落入日柱主空）
  const dayVoidSet = new Set(chart.pillars.day.voidBranches ?? []);
  table.append(el('div', { className: 'bazi-pillars-cell is-label', text: '空亡' }));
  for (const col of columns) {
    const voids = col.pillar.voidBranches?.length ? col.pillar.voidBranches.join('') : '无';
    const isHitDayVoid = !col.isDay && dayVoidSet.has(col.pillar.zhi);
    const cell = el('div', {
      className: `bazi-pillars-cell is-multiline ${col.isDay ? 'is-day-master' : ''}`.trim(),
    });
    cell.append(termButton(voids, '旬空', openTerm, { className: 'bazi-meta-btn' }));
    if (isHitDayVoid) {
      cell.append(el('span', { className: 'bazi-void-hit-badge', text: '日空', title: `${col.label}地支${col.pillar.zhi}落入日柱旬空` }));
    }
    table.append(cell);
  }

  // 神煞徽章行
  table.append(el('div', { className: 'bazi-pillars-cell is-label is-shensha-label', text: '神煞' }));
  for (const col of columns) {
    const items = shenshaByPos[col.key];
    const cell = el('div', {
      className: `bazi-pillars-cell is-shensha ${col.isDay ? 'is-day-master' : ''}`.trim(),
    });
    if (!items.length) {
      cell.append(el('span', { className: 'bazi-shensha-empty', text: '无' }));
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

  tableWrap.append(table);
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

  // 四垣附柱条（胎元 / 命宫 / 身宫 / 胎息）
  const extraList: Array<[string, BaziPillarData | undefined]> = [
    ['胎元', extraPalaces?.taiYuan],
    ['命宫', extraPalaces?.mingGong],
    ['身宫', extraPalaces?.shenGong],
    ['胎息', extraPalaces?.taiXi],
  ];
  const validExtras = extraList.filter((item): item is [string, BaziPillarData] => Boolean(item[1]?.ganZhi));
  if (validExtras.length > 0) {
    const epStrip = el('div', { className: 'bazi-extra-pillars' });
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
    shell.append(epStrip);
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
  appendInsightCell(
    '原局五行统计',
    wxSummary,
    `${strongest}较旺（${wxCounts[strongest]}）${lacking.length ? ` · 缺${lacking.join('、')}` : ' · 五行俱全'}`,
  );

  if (insightGrid.childElementCount > 0) {
    shell.append(insightGrid);
  }

  if (fullUsefulGod?.matchedRules?.length) {
    const ruleStrip = el('div', { className: 'bazi-rules-strip' });
    for (const r of fullUsefulGod.matchedRules) {
      if (!r.label && !r.description) continue;
      const item = el('div', { className: 'bazi-rule-pill' });
      if (r.label) item.append(el('strong', { text: `${r.label}：` }));
      if (r.description) item.append(el('span', { text: r.description }));
      ruleStrip.append(item);
    }
    if (ruleStrip.childElementCount > 0) shell.append(ruleStrip);
  }

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
  if (godText) {
    wxHead.append(el('span', { className: 'bazi-wuxing-bars-sub', text: `十神结构：${godText}` }));
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

  // 日主根气与生助/克泄来源拆解
  const fullStrength = rawChart.strength as
    | {
        roots?: Array<{ branch?: string; stem?: string; hiddenRole?: string; clashStatus?: string }>;
        support?: Array<{ value?: string; effect?: string }>;
        constraint?: Array<{ value?: string; effect?: string }>;
      }
    | undefined;
  if (fullStrength?.roots?.length || fullStrength?.support?.length || fullStrength?.constraint?.length) {
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
          .slice(0, 5)
          .map((c) => `${c.value ?? ''}(${c.effect ?? '制身'})`)
          .join(' · '),
      );
    }
    shell.append(breakdown);
  }

  const rels = natalFacts?.relations ?? [];
  if (rels.length > 0) {
    const relBar = el('div', { className: 'bz-relations-bar' });
    relBar.append(el('span', { className: 'bz-relations-label', text: '合冲关系' }));
    const relChips = el('div', { className: 'bz-relations-chips' });
    for (const rel of rels.slice(0, 10)) {
      const vals = rel.values?.join('') ?? '';
      const txt = `${rel.name ?? ''}${vals ? ` ${vals}` : ''}${rel.element ? `(${rel.element})` : ''}`.trim();
      if (txt) {
        relChips.append(el('span', { className: 'board-chip', text: txt }));
      }
    }
    relBar.append(relChips);
    shell.append(relBar);
  }

  // 下方精致大运 / 流年 / 当前流运四柱与合冲排盘
  const located = payload.located;
  const annualPillar = located?.year ?? payload.timeline?.year;
  const activeCycleIndex = located?.cycle?.index;
  const startYears = fortune?.startAge?.years ?? 0;

  if (fortune?.cycles?.length || annualPillar) {
    const dayunSection = el('div', { className: 'bazi-dayun-section' });
    const secHead = el('div', { className: 'bazi-dayun-head' });
    const secTitleWrap = el('div', { className: 'bazi-dayun-head-left' });
    secTitleWrap.append(el('div', { className: 'bazi-dayun-title', text: '大运与流年排盘' }));
    if (fortune?.startAge) {
      secTitleWrap.append(
        el('span', {
          className: 'bazi-dayun-sub',
          text: `${startYears}岁起运 · 每十年一运${located?.flowYear ? ` · 当前${located.flowYear}年` : ''}`,
        }),
      );
    }
    secHead.append(secTitleWrap);

    const cyclesList = (fortune?.cycles ?? []).slice(0, 10);
    const nowTs = Date.now();
    const currentBeijingYear = new Date(nowTs + 8 * 3600_000).getUTCFullYear();
    const currentBeijingMonth = new Date(nowTs + 8 * 3600_000).getUTCMonth(); // 0..11 approx
    const birthYearFromBasis = chart.basis?.utcTimestamp
      ? new Date(chart.basis.utcTimestamp + 8 * 3600_000).getUTCFullYear()
      : undefined;
    const defaultCycleIdx = Math.max(
      0,
      cyclesList.findIndex((c) => activeCycleIndex !== undefined ? c.index === activeCycleIndex : c.startTimestamp <= nowTs && nowTs < c.endTimestamp),
    );
    let selectedCycleIdx = defaultCycleIdx;
    const getCycleStartYear = (c: BaziFortuneCycle) =>
      new Date(c.startTimestamp + 8 * 3600_000).getUTCFullYear();
    const defaultStartYear = cyclesList[defaultCycleIdx]
      ? getCycleStartYear(cyclesList[defaultCycleIdx])
      : currentBeijingYear;
    let selectedYear =
      currentBeijingYear >= defaultStartYear && currentBeijingYear < defaultStartYear + 10
        ? currentBeijingYear
        : defaultStartYear;
    // 立春年起首月为寅月（公历约2月）
    let selectedMonthIdx = Math.max(0, Math.min(11, (currentBeijingMonth + 11) % 12));

    const strip = el('div', { className: 'bazi-dayun-strip' });
    const cycleDetailBox = el('div', { className: 'bazi-dayun-detail' });
    const annualMonthBox = el('div', { className: 'bazi-annual-month-explorer' });
    const cycleCards: HTMLElement[] = [];

    const renderCycleDetail = (title: string, p: BaziPillarData | undefined, extraText?: string) => {
      cycleDetailBox.replaceChildren();
      if (!p) {
        cycleDetailBox.hidden = true;
        return;
      }
      cycleDetailBox.hidden = false;
      const headLine = el('div', { className: 'bazi-dayun-detail-head' });
      headLine.append(el('strong', { text: `${title} · ${p.ganZhi}` }));
      if (p.tenGod) headLine.append(el('span', { className: 'board-chip is-accent', text: p.tenGod }));
      if (p.naYin) headLine.append(el('span', { className: 'board-chip', text: p.naYin }));
      if (p.lifeStage) headLine.append(el('span', { className: 'board-chip', text: `星运 ${p.lifeStage}` }));
      if (p.selfLifeStage) headLine.append(el('span', { className: 'board-chip', text: `自坐 ${p.selfLifeStage}` }));
      if (p.voidBranches?.length) headLine.append(el('span', { className: 'board-chip', text: `空 ${p.voidBranches.join('')}` }));
      cycleDetailBox.append(headLine);
      if (p.hiddenStems?.length) {
        const hsText = p.hiddenStems.map((h) => `${h.stem}(${h.tenGod})`).join(' · ');
        cycleDetailBox.append(el('div', { className: 'bazi-dayun-detail-sub', text: `地支藏干：${hsText}` }));
      }
      if (extraText) {
        cycleDetailBox.append(el('div', { className: 'bazi-dayun-detail-sub', text: extraText }));
      }
    };

    const renderAnnualMonthExplorer = () => {
      annualMonthBox.replaceChildren();
      const activeCycle = cyclesList[selectedCycleIdx];
      if (!activeCycle) {
        annualMonthBox.hidden = true;
        return;
      }
      annualMonthBox.hidden = false;
      const cycleStartYr = getCycleStartYear(activeCycle);
      const years = Array.from({ length: 10 }, (_, idx) => {
        const yr = cycleStartYr + idx;
        const gz = getYearSixtyCycle(yr);
        const ageNum = birthYearFromBasis ? Math.max(1, yr - birthYearFromBasis + 1) : startYears + selectedCycleIdx * 10 + idx;
        return { year: yr, age: ageNum, ganZhi: gz };
      });
      if (!years.some((item) => item.year === selectedYear)) {
        selectedYear = years[0]!.year;
      }

      const yearRow = el('div', { className: 'bazi-explorer-row' });
      yearRow.append(el('span', { className: 'bazi-explorer-label', text: '流年' }));
      const yearChips = el('div', { className: 'bazi-explorer-strip' });
      for (const item of years) {
        const isCurrentYear = item.year === currentBeijingYear;
        const dmGan = chart.pillars.day?.gan;
        const fact = dmGan ? buildPillarFact(item.ganZhi, dmGan as Parameters<typeof buildPillarFact>[1]) : undefined;
        const btn = el('button', {
          type: 'button',
          className: `bazi-explorer-chip${item.year === selectedYear ? ' is-selected' : ''}${isCurrentYear ? ' is-today' : ''}`,
          onClick: () => {
            selectedYear = item.year;
            renderAnnualMonthExplorer();
          },
        });
        btn.append(
          el('span', { className: 'bazi-exp-meta', text: `${item.year} · ${item.age}岁` }),
          el('strong', {
            className: 'bazi-exp-gz',
            text: item.ganZhi,
            dataset: { wuxing: fact ? getWuxing(fact.gan) : getWuxing(item.ganZhi[0]) },
          }),
          el('span', { className: 'bazi-exp-god', text: fact?.tenGod ?? '' }),
        );
        yearChips.append(btn);
      }
      yearRow.append(yearChips);

      const months = getYearMonthList(selectedYear).map((ganZhi, idx) => ({
        index: idx,
        label: `${ganZhi[1]}月`,
        ganZhi,
      }));
      if (selectedMonthIdx < 0 || selectedMonthIdx >= months.length) selectedMonthIdx = 0;

      const monthRow = el('div', { className: 'bazi-explorer-row' });
      monthRow.append(el('span', { className: 'bazi-explorer-label', text: `${selectedYear}流月` }));
      const monthChips = el('div', { className: 'bazi-explorer-strip' });
      for (const m of months) {
        const dmGan = chart.pillars.day?.gan;
        const fact = dmGan ? buildPillarFact(m.ganZhi, dmGan as Parameters<typeof buildPillarFact>[1]) : undefined;
        const btn = el('button', {
          type: 'button',
          className: `bazi-explorer-chip${m.index === selectedMonthIdx ? ' is-selected' : ''}`,
          onClick: () => {
            selectedMonthIdx = m.index;
            renderAnnualMonthExplorer();
          },
        });
        btn.append(
          el('span', { className: 'bazi-exp-meta', text: m.label }),
          el('strong', {
            className: 'bazi-exp-gz',
            text: m.ganZhi,
            dataset: { wuxing: fact ? getWuxing(fact.gan) : getWuxing(m.ganZhi[0]) },
          }),
          el('span', { className: 'bazi-exp-god', text: fact?.tenGod ?? '' }),
        );
        monthChips.append(btn);
      }
      monthRow.append(monthChips);

      annualMonthBox.append(yearRow, monthRow);
    };

    if (cyclesList.length > 0) {
      const todayBtn = el('button', {
        type: 'button',
        className: 'bazi-dayun-today-btn',
        text: '今',
        title: '回到今年今月',
        ariaLabel: '回到今年今月',
        onClick: () => {
          selectedCycleIdx = defaultCycleIdx;
          const cyc = cyclesList[selectedCycleIdx];
          const cycStart = cyc ? getCycleStartYear(cyc) : currentBeijingYear;
          selectedYear =
            currentBeijingYear >= cycStart && currentBeijingYear < cycStart + 10
              ? currentBeijingYear
              : cycStart;
          selectedMonthIdx = Math.max(0, Math.min(11, (currentBeijingMonth + 11) % 12));
          cycleCards.forEach((c) => c.classList.remove('is-selected'));
          const offset = annualPillar?.gan && annualPillar?.zhi ? 1 : 0;
          const targetCard = cycleCards[selectedCycleIdx + offset];
          targetCard?.classList.add('is-selected');
          if (cyc?.pillar) {
            renderCycleDetail(
              `当前大运 · ${startYears + selectedCycleIdx * 10}岁 · ${formatYear(cyc.startTimestamp)}–${formatYear(cyc.endTimestamp)}`,
              cyc.pillar,
            );
          }
          renderAnnualMonthExplorer();
        },
      });
      secHead.append(todayBtn);
    }
    dayunSection.append(secHead);

    if (annualPillar?.gan && annualPillar?.zhi) {
      const aCard = el('button', {
        type: 'button',
        className: 'bazi-dayun-card is-annual',
        onClick: () => {
          cycleCards.forEach((c) => c.classList.remove('is-selected'));
          aCard.classList.add('is-selected');
          renderCycleDetail(
            located?.flowYear ? `${located.flowYear}流年` : '当前流年',
            annualPillar as BaziPillarData,
          );
        },
      });
      aCard.append(
        el('div', { className: 'bazi-dayun-years', text: located?.flowYear ? `${located.flowYear}流年` : '当前流年' }),
        el(
          'div',
          { className: 'bazi-dayun-ganzhi' },
          el('span', { className: 'bazi-dayun-char', text: annualPillar.gan, dataset: { wuxing: getWuxing(annualPillar.gan) } }),
          el('span', { className: 'bazi-dayun-char', text: annualPillar.zhi, dataset: { wuxing: getWuxing(annualPillar.zhi) } }),
        ),
        el('span', { className: 'bazi-dayun-god', text: annualPillar.tenGod ?? '流年' }),
      );
      if ('naYin' in annualPillar && typeof annualPillar.naYin === 'string' && annualPillar.naYin) {
        aCard.append(el('div', { className: 'bazi-dayun-nayin', text: annualPillar.naYin }));
      }
      cycleCards.push(aCard);
      strip.append(aCard);
    }

    for (const [idx, cycle] of cyclesList.entries()) {
      const gan = cycle.pillar?.gan ?? cycle.ganZhi.slice(0, 1);
      const zhi = cycle.pillar?.zhi ?? cycle.ganZhi.slice(1, 2);
      const ganWx = cycle.pillar?.stemElement ?? getWuxing(gan);
      const zhiWx = cycle.pillar?.branchElement ?? getWuxing(zhi);
      const tenGod = cycle.pillar?.tenGod ?? '';
      const zhiTenGod = cycle.pillar?.hiddenStems?.[0]?.tenGod ?? '';
      const ageStart = startYears + idx * 10;
      const yearSpan = `${formatYear(cycle.startTimestamp)}–${formatYear(cycle.endTimestamp)}`;
      const isCurrent = activeCycleIndex !== undefined && cycle.index === activeCycleIndex;

      const card = el('button', {
        type: 'button',
        className: `bazi-dayun-card${isCurrent ? ' is-current' : ''}`,
        onClick: () => {
          cycleCards.forEach((c) => c.classList.remove('is-selected'));
          card.classList.add('is-selected');
          selectedCycleIdx = idx;
          selectedYear = getCycleStartYear(cycle);
          renderCycleDetail(
            `第${idx + 1}步大运 · ${ageStart}岁 · ${yearSpan}`,
            cycle.pillar ?? { ganZhi: cycle.ganZhi, gan, zhi, tenGod },
          );
          renderAnnualMonthExplorer();
        },
      });
      card.append(
        el('div', { className: 'bazi-dayun-age', text: `${ageStart}岁${isCurrent ? ' · 当运' : ''}` }),
        el('div', { className: 'bazi-dayun-years', text: yearSpan }),
        el(
          'div',
          { className: 'bazi-dayun-ganzhi' },
          el('span', { className: 'bazi-dayun-char', text: gan, dataset: { wuxing: ganWx } }),
          el('span', { className: 'bazi-dayun-char', text: zhi, dataset: { wuxing: zhiWx } }),
        ),
        el('span', {
          className: 'bazi-dayun-god',
          text: [tenGod, zhiTenGod].filter(Boolean).join('/') || '—',
        }),
      );
      if (cycle.pillar?.naYin || cycle.pillar?.lifeStage) {
        card.append(
          el('div', {
            className: 'bazi-dayun-nayin',
            text: [cycle.pillar.naYin, cycle.pillar.lifeStage].filter(Boolean).join(' · '),
          }),
        );
      }
      cycleCards.push(card);
      strip.append(card);
    }

    dayunSection.append(strip, cycleDetailBox, annualMonthBox);

    // 默认选中当前大运或流年
    const defaultCycle = (fortune?.cycles ?? []).find((c) => c.index === activeCycleIndex);
    if (defaultCycle?.pillar) {
      const idx = (fortune?.cycles ?? []).indexOf(defaultCycle);
      renderCycleDetail(
        `当前大运 · ${startYears + Math.max(0, idx) * 10}岁 · ${formatYear(defaultCycle.startTimestamp)}–${formatYear(defaultCycle.endTimestamp)}`,
        defaultCycle.pillar,
      );
    } else if (annualPillar) {
      renderCycleDetail(
        located?.flowYear ? `${located.flowYear}流年` : '当前流年',
        annualPillar as BaziPillarData,
      );
    }
    renderAnnualMonthExplorer();

    // 若有完整 located 岁运流月流日流时与引动关系，渲染联动条
    if (located && (located.month || located.day || located.smallFortune)) {
      const flowStrip = el('div', { className: 'bazi-flow-pillars' });
      const flowItems: Array<[string, BaziPillarData | undefined]> = [
        ['当前大运', located.cycle?.pillar],
        [located.flowYear ? `${located.flowYear}流年` : '流年', located.year],
        [located.smallFortune?.nominalAge ? `小运 ${located.smallFortune.nominalAge}岁` : '小运', located.smallFortune?.pillar],
        ['流月', located.month],
        ['流日', located.day],
        ['流时', located.hour],
      ];
      for (const [fLabel, fp] of flowItems) {
        if (!fp?.ganZhi) continue;
        const fCard = el('div', { className: 'bazi-flow-card' });
        fCard.append(
          el('span', { className: 'bazi-flow-label', text: fLabel }),
          el('strong', {
            className: 'bazi-flow-gz',
            text: fp.ganZhi,
            dataset: { wuxing: fp.stemElement ?? getWuxing(fp.gan) },
          }),
          el('span', { className: 'bazi-flow-god', text: [fp.tenGod, fp.lifeStage].filter(Boolean).join(' · ') || '—' }),
        );
        flowStrip.append(fCard);
      }
      if (flowStrip.childElementCount > 0) dayunSection.append(flowStrip);

      const activeComps = (located.evidence?.comparisons ?? []).filter((c) => (c.relations?.length ?? 0) > 0);
      if (activeComps.length > 0) {
        const compBox = el('div', { className: 'bz-relations-bar' });
        compBox.append(el('span', { className: 'bz-relations-label', text: '岁运引动' }));
        const chips = el('div', { className: 'bz-relations-chips' });
        const posLabelMap: Record<string, string> = {
          dayun: '大运',
          year: '流年',
          month: '流月',
          'natal-year': '年柱',
          'natal-month': '月柱',
          'natal-day': '日柱',
          'natal-hour': '时柱',
        };
        for (const comp of activeComps.slice(0, 8)) {
          const relNames = (comp.relations ?? []).map((r) => `${r.name ?? ''}${r.subtype ? `(${r.subtype})` : ''}`).join('·');
          const txt = `${posLabelMap[comp.source ?? ''] ?? comp.source ?? ''}${comp.sourceGanZhi ?? ''} ↔ ${posLabelMap[comp.target ?? ''] ?? comp.target ?? ''}${comp.targetGanZhi ?? ''}：${relNames}`;
          chips.append(el('span', { className: 'board-chip', text: txt }));
        }
        compBox.append(chips);
        dayunSection.append(compBox);
      }
    }

    shell.append(dayunSection);
  }

  shell.append(termPanel.element);

  container.hidden = false;
  container.replaceChildren(shell);
  return true;
}
