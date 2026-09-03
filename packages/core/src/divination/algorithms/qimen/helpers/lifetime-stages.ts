/**
 * @file 奇门终身局阶段划分引擎（Stage Engine）
 * @description 支持四柱分限法（默认）、洛书九宫巡行法以及符使卦轨法，生成结构化人生阶段卡。
 */

import type {
  QimenData,
  QimenLifetimeStage,
  QimenPersonalMarker,
  QimenStagePolicy,
  QimenTopicCandidate,
} from '../../../../types/divination';
import { diPanPalaces } from './_constants';
import { getDunJiaStem } from './jushu';

const CLOCKWISE_OUTER_PALACES = [1, 8, 3, 4, 9, 2, 7, 6];
const COUNTER_CLOCKWISE_OUTER_PALACES = [1, 6, 7, 2, 9, 4, 3, 8];

const YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];

function addYearsToDate(date: Date, years: number): string {
  const d = new Date(date.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d.toISOString().split('T')[0];
}

/**
 * 汇总宫位的吉凶与约束支持
 */
function evaluatePalaceSupportAndConstraints(
  palaceNum: number,
  baseChart: QimenData,
): { support: string[]; constraints: string[] } {
  const support: string[] = [];
  const constraints: string[] = [];

  const palace = baseChart.jiuGongGe.find((p) => p.gong === palaceNum);
  if (!palace) return { support, constraints };

  // 八门吉凶
  const door = palace.renPan.door;
  if (['开门', '休门', '生门'].includes(door)) {
    support.push(`临三大吉门之${door}，人事实质通达顺畅`);
  } else if (['死门', '伤门', '惊门'].includes(door)) {
    constraints.push(`临凶门${door}，需防滞塞阻力、言语是非或折伤耗散`);
  } else if (door === '杜门') {
    constraints.push('临杜门，主隐秘闭塞，宜潜心深耕而不利高调激进');
  } else if (door === '景门') {
    support.push('临景门，主文书声誉、名气外显与合同机遇');
  }

  // 八神吉凶
  const god = palace.shenPan.god;
  if (['值符', '太阴', '六合', '九天', '九地'].includes(god)) {
    support.push(`得吉神${god}护持，贵人引路、协同有方`);
  } else if (['白虎', '螣蛇', '玄武'].includes(god)) {
    constraints.push(`值${god}乘临，警惕暗耗、口舌争执或意外波动`);
  }

  // 空亡与马星
  const isVoid = baseChart.voidPalaces?.some((vp) => vp.palace === palaceNum);
  const hasHorse = baseChart.horseStar?.palace === palaceNum;
  if (isVoid) {
    constraints.push('宫逢旬空，吉凶能量暂未落地，多有虚耗等待与变动');
  }
  if (hasHorse) {
    support.push('临驿马星，主走动频繁、迁移外出或生活节奏加速');
  }

  // 经典格局
  if (baseChart.classicPatterns) {
    for (const pat of baseChart.classicPatterns) {
      if (pat.palaces.includes(palaceNum)) {
        if (pat.type === 'good') {
          support.push(`成吉格「${pat.name}」：${pat.summary}`);
        } else if (pat.type === 'bad') {
          constraints.push(`逢凶格「${pat.name}」：${pat.summary}`);
        }
      }
    }
  }

  return { support, constraints };
}

function getAnchorBaseDate(birthDate: Date, anchorRule?: QimenStagePolicy['anchorRule']): Date {
  if (anchorRule === 'lunarNewYear') {
    return new Date(Date.UTC(birthDate.getUTCFullYear(), 0, 1));
  }
  if (anchorRule === 'solarTermBoundary') {
    return new Date(Date.UTC(birthDate.getUTCFullYear(), 1, 4));
  }
  return birthDate;
}

/**
 * 构建终身局阶段卡列表
 */
export function buildLifetimeStages(
  baseChart: QimenData,
  _personalMarkers: QimenPersonalMarker[],
  _topicCandidates: QimenTopicCandidate[],
  policy: QimenStagePolicy,
  birthDate: Date,
  gender?: 'male' | 'female',
): QimenLifetimeStage[] {
  const model = policy.model ?? 'pillarFourLimits';
  const stages: QimenLifetimeStage[] = [];
  const anchorBaseDate = getAnchorBaseDate(birthDate, policy.anchorRule);
  const ageOffset = policy.ageSystem === 'nominalAge' ? 1 : 0;

  const getPalaceName = (p: number) =>
    baseChart.jiuGongGe.find((item) => item.gong === p)?.name || `${p}宫`;

  if (model === 'pillarFourLimits') {
    // -------------------------------------------------------------
    // 模型一：传统四柱分限法（0-16, 17-32, 33-48, 49+）
    // -------------------------------------------------------------
    const yearStem = baseChart.ganzhi.year[0];
    const yearBranch = baseChart.ganzhi.year[1];
    const monthStem = baseChart.ganzhi.month[0];
    const monthBranch = baseChart.ganzhi.month[1];
    const dayStem = baseChart.ganzhi.day[0];
    const hourStem = baseChart.ganzhi.hour[0];

    const yearLookupStem = yearStem === '甲' ? getDunJiaStem(baseChart.ganzhi.year) : yearStem;
    const monthLookupStem = monthStem === '甲' ? getDunJiaStem(baseChart.ganzhi.month) : monthStem;
    const dayLookupStem = dayStem === '甲' ? getDunJiaStem(baseChart.ganzhi.day) : dayStem;
    const hourLookupStem = hourStem === '甲' ? getDunJiaStem(baseChart.ganzhi.hour) : hourStem;

    const yearPalaces = baseChart.jiuGongGe
      .filter((p) => p.tianPan.stem === yearLookupStem || p.diPan.stem === yearLookupStem)
      .map((p) => p.gong);
    const yearBranchGong = diPanPalaces[yearBranch];
    if (yearBranchGong && !yearPalaces.includes(yearBranchGong)) {
      yearPalaces.push(yearBranchGong);
    }

    const monthPalaces = baseChart.jiuGongGe
      .filter((p) => p.tianPan.stem === monthLookupStem || p.diPan.stem === monthLookupStem)
      .map((p) => p.gong);
    const monthBranchGong = diPanPalaces[monthBranch];
    if (monthBranchGong && !monthPalaces.includes(monthBranchGong)) {
      monthPalaces.push(monthBranchGong);
    }

    const dayPalaces = baseChart.jiuGongGe
      .filter((p) => p.tianPan.stem === dayLookupStem || p.diPan.stem === dayLookupStem)
      .map((p) => p.gong);

    const hourPalaces = baseChart.jiuGongGe
      .filter((p) => p.tianPan.stem === hourLookupStem || p.diPan.stem === hourLookupStem)
      .map((p) => p.gong);
    const zhiShiGong = baseChart.jiuGongGe.find((p) => p.renPan.door === baseChart.zhiShi)?.gong;
    if (zhiShiGong && !hourPalaces.includes(zhiShiGong)) {
      hourPalaces.push(zhiShiGong);
    }

    const stageDefs = [
      {
        index: 0,
        title: '初限·早年根基',
        ageStart: 0 + ageOffset,
        ageEnd: 16 + ageOffset,
        calStart: addYearsToDate(anchorBaseDate, 0),
        calEnd: addYearsToDate(anchorBaseDate, 16),
        gongs: yearPalaces,
        theme: '年柱主限：主家庭原生教养、长辈福荫护持、学识基础与先天命质形成。',
        markers: [`年干${yearStem}`, `年支${yearBranch}`],
      },
      {
        index: 1,
        title: '中前限·青年立业',
        ageStart: 17 + ageOffset,
        ageEnd: 32 + ageOffset,
        calStart: addYearsToDate(anchorBaseDate, 17),
        calEnd: addYearsToDate(anchorBaseDate, 32),
        gongs: monthPalaces,
        theme: '月柱主限：走出家庭踏入社会、人际圈层开拓、事业基石奠定与青年自我认知。',
        markers: [`月干${monthStem}`, `月支${monthBranch}`],
      },
      {
        index: 2,
        title: '中后限·中年鼎盛',
        ageStart: 33 + ageOffset,
        ageEnd: 48 + ageOffset,
        calStart: addYearsToDate(anchorBaseDate, 33),
        calEnd: addYearsToDate(anchorBaseDate, 48),
        gongs: dayPalaces,
        theme: '日柱主限：人生核心建树期，自身心力智慧完全展现，家庭与社会中流砥柱。',
        markers: [`日干${dayStem}`],
      },
      {
        index: 3,
        title: '末限·晚景安泰',
        ageStart: 49 + ageOffset,
        ageEnd: 80 + ageOffset,
        calStart: addYearsToDate(anchorBaseDate, 49),
        calEnd: addYearsToDate(anchorBaseDate, 80),
        gongs: hourPalaces,
        theme: '时柱主限：事业收获定型、后辈晚生接班、生活闲适自洽与精神安泰归宿。',
        markers: [`时干${hourStem}`, `值使${baseChart.zhiShi}`],
      },
    ];

    for (const def of stageDefs) {
      const allSupport: string[] = [];
      const allConstraints: string[] = [];

      for (const g of def.gongs) {
        const { support, constraints } = evaluatePalaceSupportAndConstraints(g, baseChart);
        allSupport.push(...support);
        allConstraints.push(...constraints);
      }

      stages.push({
        stageIndex: def.index,
        title: def.title,
        ageStart: def.ageStart,
        ageEnd: def.ageEnd,
        calendarStart: def.calStart,
        calendarEnd: def.calEnd,
        dominantPalaces: def.gongs.map((g) => ({ palace: g, name: getPalaceName(g) })),
        associatedMarkers: def.markers,
        stageTheme: def.theme,
        supportFacts: Array.from(new Set(allSupport)),
        constraintFacts: Array.from(new Set(allConstraints)),
        limitations: [
          '四柱分限只反映人生不同年龄主干阶段的能量倾向与宏观节奏，不代表具体某一年的必然事件。',
        ],
      });
    }
  } else if (model === 'palaceWalk') {
    // -------------------------------------------------------------
    // 模型二：洛书九宫行限法（九阶段循环，阳顺阴逆）
    // -------------------------------------------------------------
    const yearStem = baseChart.ganzhi.year[0];
    const isYangYear = YANG_STEMS.includes(yearStem);
    const isClockwise = gender === 'female' ? !isYangYear : isYangYear;

    const ring = isClockwise ? CLOCKWISE_OUTER_PALACES : COUNTER_CLOCKWISE_OUTER_PALACES;
    const yearBranch = baseChart.ganzhi.year[1];
    const startGong = diPanPalaces[yearBranch] || 1;
    let startIdx = ring.indexOf(startGong);
    if (startIdx < 0) startIdx = 0;

    const yearsPerStage = policy.yearsPerStage || 10;

    for (let i = 0; i < 9; i++) {
      const gong = ring[(startIdx + i) % ring.length];
      const ageStart = i * yearsPerStage + ageOffset;
      const ageEnd = (i + 1) * yearsPerStage - 1 + ageOffset;
      const { support, constraints } = evaluatePalaceSupportAndConstraints(gong, baseChart);

      stages.push({
        stageIndex: i,
        title: `行限第${i + 1}步（${getPalaceName(gong)}）`,
        ageStart,
        ageEnd,
        calendarStart: addYearsToDate(anchorBaseDate, i * yearsPerStage),
        calendarEnd: addYearsToDate(anchorBaseDate, (i + 1) * yearsPerStage - 1),
        dominantPalaces: [{ palace: gong, name: getPalaceName(gong) }],
        associatedMarkers: [`行限临${getPalaceName(gong)}`],
        stageTheme: `九宫巡行运限：当值${getPalaceName(gong)}，能量由该宫门星神干及奇仪克应主导。`,
        supportFacts: Array.from(new Set(support)),
        constraintFacts: Array.from(new Set(constraints)),
        limitations: [
          '九宫巡行阶段卡依据洛书运限流布生成，反映该区间内特定方位的气机起伏，需结合流年动态合参。',
        ],
      });
    }
  } else {
    // -------------------------------------------------------------
    // 模型三：符使卦轨法（依《统宗》值符值使立卦起运，覆盖至 80 岁）
    // -------------------------------------------------------------
    const zhiFuPalace =
      baseChart.jiuGongGe.find((p) => p.tianPan.star === baseChart.zhiFu)?.gong || 1;
    const zhiShiPalace =
      baseChart.jiuGongGe.find((p) => p.renPan.door === baseChart.zhiShi)?.gong || 6;

    for (let yao = 1; yao <= 8; yao++) {
      const ageStart = (yao - 1) * 10 + ageOffset;
      const ageEnd = (yao === 8 ? 80 : yao * 10 - 1) + ageOffset;
      const curGong = yao % 2 === 1 ? zhiFuPalace : zhiShiPalace;
      const { support, constraints } = evaluatePalaceSupportAndConstraints(curGong, baseChart);

      const yaoTitle =
        yao <= 6
          ? `卦轨大运第${yao}爻限`
          : yao === 7
            ? `卦轨大运归魂限（甲子重周）`
            : `卦轨大运晚晴限（颐养天年）`;

      stages.push({
        stageIndex: yao - 1,
        title: yaoTitle,
        ageStart,
        ageEnd,
        calendarStart: addYearsToDate(anchorBaseDate, (yao - 1) * 10),
        calendarEnd: addYearsToDate(anchorBaseDate, yao === 8 ? 80 : yao * 10 - 1),
        dominantPalaces: [{ palace: curGong, name: getPalaceName(curGong) }],
        associatedMarkers: [
          yao % 2 === 1 ? `值符星${baseChart.zhiFu}` : `值使门${baseChart.zhiShi}`,
        ],
        stageTheme: `符使卦轨运限：${yao <= 6 ? `初至末六爻周流，第${yao}限` : `六爻周天后延续，第${yao}步`}由${getPalaceName(curGong)}符使气数主导。`,
        supportFacts: Array.from(new Set(support)),
        constraintFacts: Array.from(new Set(constraints)),
        limitations: ['符使卦轨运限为《奇门遁甲统宗》古法理路，爻限大运反映整体十年荣枯趋势。'],
      });
    }
  }

  return stages;
}
