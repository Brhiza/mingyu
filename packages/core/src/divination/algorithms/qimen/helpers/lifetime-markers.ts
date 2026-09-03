/**
 * @file 奇门终身局个人标记与六亲主题宫映射模块
 * @description 依据《奇门遁甲统宗》推人年命法与传统八门八神专司，
 * 提取年命、日干、时干、值符值使等个人标记，并系统映射人生九大主题候选宫。
 */

import type {
  QimenData,
  QimenJiuGongGe,
  QimenPersonalMarker,
  QimenTopic,
  QimenTopicCandidate,
} from '../../../../types/divination';
import { diPanPalaces } from './_constants';
import { getDunJiaStem } from './jushu';

const STEM_WUXING: Record<string, '木' | '火' | '土' | '金' | '水'> = {
  甲: '木',
  乙: '木',
  丙: '火',
  丁: '火',
  戊: '土',
  己: '土',
  庚: '金',
  辛: '金',
  壬: '水',
  癸: '水',
};

const WUXING_RELATIONS: Record<
  '木' | '火' | '土' | '金' | '水',
  { generates: string; controlledBy: string; controls: string; generatedBy: string }
> = {
  木: { generates: '火', controlledBy: '金', controls: '土', generatedBy: '水' },
  火: { generates: '土', controlledBy: '水', controls: '金', generatedBy: '木' },
  土: { generates: '金', controlledBy: '木', controls: '水', generatedBy: '火' },
  金: { generates: '水', controlledBy: '火', controls: '木', generatedBy: '土' },
  水: { generates: '木', controlledBy: '土', controls: '火', generatedBy: '金' },
};

export type SixRelative = '父母' | '子息' | '兄弟' | '官鬼' | '妻财';

/**
 * 确定天盘奇仪相对于主体天干的六亲属性
 */
function getSixRelative(subjectStem: string, targetStem: string): SixRelative {
  const subEl = STEM_WUXING[subjectStem] || '土';
  const tgtEl = STEM_WUXING[targetStem] || '土';

  if (subEl === tgtEl) return '兄弟';
  if (WUXING_RELATIONS[subEl].generatedBy === tgtEl) return '父母';
  if (WUXING_RELATIONS[subEl].generates === tgtEl) return '子息';
  if (WUXING_RELATIONS[subEl].controlledBy === tgtEl) return '官鬼';
  return '妻财';
}

/**
 * 提取个人标记落宫
 */
export function extractPersonalMarkers(baseChart: QimenData): QimenPersonalMarker[] {
  const markers: QimenPersonalMarker[] = [];
  const { year, day, hour } = baseChart.ganzhi;
  const yearStem = year[0];
  const yearBranch = year[1];
  const dayStem = day[0];
  const hourStem = hour[0];

  const yearLookupStem = yearStem === '甲' ? getDunJiaStem(year) : yearStem;
  const dayLookupStem = dayStem === '甲' ? getDunJiaStem(day) : dayStem;
  const hourLookupStem = hourStem === '甲' ? getDunJiaStem(hour) : hourStem;

  const getPalaceName = (p: number) =>
    baseChart.jiuGongGe.find((item) => item.gong === p)?.name || `${p}宫`;

  // 1. 年干天盘落宫与地盘落宫
  for (const p of baseChart.jiuGongGe) {
    if (p.tianPan.stem === yearLookupStem || p.tianPan.companionStem === yearLookupStem) {
      markers.push({
        markerType: 'yearStem',
        value: yearStem === '甲' ? `甲(遁${yearLookupStem})` : yearStem,
        palace: p.gong,
        palaceName: p.name,
        layer: 'tianPan',
        traditionalSignificance: `年干天盘落宫（${yearStem === '甲' ? `甲木遁${yearLookupStem}` : yearStem}）：表外在社会名位、长辈福荫、名声根基与时代大势`,
      });
    }
    if (p.diPan.stem === yearLookupStem) {
      markers.push({
        markerType: 'yearStem',
        value: yearStem === '甲' ? `甲(遁${yearLookupStem})` : yearStem,
        palace: p.gong,
        palaceName: p.name,
        layer: 'diPan',
        traditionalSignificance: `年干地盘落宫（${yearStem === '甲' ? `甲木遁${yearLookupStem}` : yearStem}）：表先天祖业沉淀、内在家族根基与深层心理安全感`,
      });
    }
  }

  // 2. 年支本宫（地支所属八卦宫位）
  const branchPalaceNum = diPanPalaces[yearBranch];
  if (branchPalaceNum) {
    markers.push({
      markerType: 'yearBranch',
      value: yearBranch,
      palace: branchPalaceNum,
      palaceName: getPalaceName(branchPalaceNum),
      layer: 'baseGong',
      traditionalSignificance: `年支本宫（${yearBranch}在${getPalaceName(branchPalaceNum)}）：身体元气与先天命基之寄托本原`,
    });
  }

  // 3. 日干天盘与地盘落宫（自身）
  for (const p of baseChart.jiuGongGe) {
    if (p.tianPan.stem === dayLookupStem || p.tianPan.companionStem === dayLookupStem) {
      markers.push({
        markerType: 'dayStem',
        value: dayStem === '甲' ? `甲(遁${dayLookupStem})` : dayStem,
        palace: p.gong,
        palaceName: p.name,
        layer: 'tianPan',
        traditionalSignificance: `日干天盘落宫（${dayStem === '甲' ? `甲木遁${dayLookupStem}` : dayStem}）：求测者本人显性行藏、心智精力与中年主要作为`,
      });
    }
    if (p.diPan.stem === dayLookupStem) {
      markers.push({
        markerType: 'dayStem',
        value: dayStem === '甲' ? `甲(遁${dayLookupStem})` : dayStem,
        palace: p.gong,
        palaceName: p.name,
        layer: 'diPan',
        traditionalSignificance: `日干地盘落宫（${dayStem === '甲' ? `甲木遁${dayLookupStem}` : dayStem}）：本人内心隐秘居所、精神寄托与底层支撑`,
      });
    }
  }

  // 4. 时干天盘与地盘落宫（归宿与产出）
  for (const p of baseChart.jiuGongGe) {
    if (p.tianPan.stem === hourLookupStem || p.tianPan.companionStem === hourLookupStem) {
      markers.push({
        markerType: 'hourStem',
        value: hourStem === '甲' ? `甲(遁${hourLookupStem})` : hourStem,
        palace: p.gong,
        palaceName: p.name,
        layer: 'tianPan',
        traditionalSignificance: `时干天盘落宫（${hourStem === '甲' ? `甲木遁${hourLookupStem}` : hourStem}）：晚景运势、具体事业产出、下属晚辈及事态最终归宿`,
      });
    }
    if (p.diPan.stem === hourLookupStem) {
      markers.push({
        markerType: 'hourStem',
        value: hourStem === '甲' ? `甲(遁${hourLookupStem})` : hourStem,
        palace: p.gong,
        palaceName: p.name,
        layer: 'diPan',
        traditionalSignificance: `时干地盘落宫（${hourStem === '甲' ? `甲木遁${hourLookupStem}` : hourStem}）：晚运蓄势储备与底层执行承载`,
      });
    }
  }

  // 5. 值符星落宫
  const zhiFuPalace = baseChart.jiuGongGe.find((p) => p.tianPan.star === baseChart.zhiFu);
  if (zhiFuPalace) {
    markers.push({
      markerType: 'zhiFuStar',
      value: baseChart.zhiFu,
      palace: zhiFuPalace.gong,
      palaceName: zhiFuPalace.name,
      layer: 'tianPan',
      traditionalSignificance: `值符星落宫（${baseChart.zhiFu}）：一身大纲领，时代机遇与贵人庇佑之枢纽`,
    });
  }

  // 6. 值使门落宫
  const zhiShiPalace = baseChart.jiuGongGe.find((p) => p.renPan.door === baseChart.zhiShi);
  if (zhiShiPalace) {
    markers.push({
      markerType: 'zhiShiDoor',
      value: baseChart.zhiShi,
      palace: zhiShiPalace.gong,
      palaceName: zhiShiPalace.name,
      layer: 'renPan',
      traditionalSignificance: `值使门落宫（${baseChart.zhiShi}）：人事具体权柄、行动落地与办事主宰`,
    });
  }

  // 7. 天禽伴生干
  const companionPalace = baseChart.jiuGongGe.find((p) => p.tianPan.companionStem);
  if (companionPalace && companionPalace.tianPan.companionStem) {
    markers.push({
      markerType: 'companionStem',
      value: companionPalace.tianPan.companionStem,
      palace: companionPalace.gong,
      palaceName: companionPalace.name,
      layer: 'tianPan',
      traditionalSignificance: `天禽寄宫携干（${companionPalace.tianPan.companionStem}）：中五厚土兼化之隐性能量`,
    });
  }

  return markers;
}

/**
 * 汇总宫位的格局与特殊标记
 */
function summarizePalacePatterns(palace: QimenJiuGongGe, baseChart: QimenData): string[] {
  const summaries: string[] = [];

  // 八门八神
  if (palace.renPan.door) summaries.push(`人盘${palace.renPan.door}`);
  if (palace.shenPan.god) summaries.push(`神盘${palace.shenPan.god}`);
  if (palace.tianPan.star) summaries.push(`天盘${palace.tianPan.star}`);

  // 天地盘干
  summaries.push(`干组合: ${palace.tianPan.stem}+${palace.diPan.stem}`);

  // 空亡与马星
  const isVoid = baseChart.voidPalaces?.some((vp) => vp.palace === palace.gong);
  const hasHorse = baseChart.horseStar?.palace === palace.gong;
  if (isVoid) summaries.push('临旬空');
  if (hasHorse) summaries.push('临驿马');

  // 经典格局
  if (baseChart.classicPatterns) {
    for (const pat of baseChart.classicPatterns) {
      if (pat.palaces.includes(palace.gong)) {
        summaries.push(
          `格局:${pat.name}(${pat.type === 'good' ? '吉' : pat.type === 'bad' ? '凶' : '平'})`,
        );
      }
    }
  }

  return summaries;
}

/**
 * 构建人生主题候选宫
 */
export function buildTopicCandidates(
  baseChart: QimenData,
  gender?: 'male' | 'female',
  selectedTopics?: QimenTopic[],
): QimenTopicCandidate[] {
  const yearStem = baseChart.ganzhi.year[0];
  const candidates: QimenTopicCandidate[] = [];

  // 提取各门、神、星所在宫位
  const findGongByDoor = (door: string) =>
    baseChart.jiuGongGe.find((p) => p.renPan.door === door)?.gong;
  const findGongsByGod = (god: string) =>
    baseChart.jiuGongGe.filter((p) => p.shenPan.god === god).map((p) => p.gong);
  const findGongByStar = (star: string) =>
    baseChart.jiuGongGe.find((p) => p.tianPan.star === star)?.gong;
  const findGongsByStem = (stem: string) =>
    baseChart.jiuGongGe
      .filter((p) => p.tianPan.stem === stem || p.tianPan.companionStem === stem)
      .map((p) => p.gong);

  // 六亲落宫
  const relativeGongs: Record<SixRelative, number[]> = {
    父母: [],
    子息: [],
    兄弟: [],
    官鬼: [],
    妻财: [],
  };

  for (const p of baseChart.jiuGongGe) {
    const rel = getSixRelative(yearStem, p.tianPan.stem);
    relativeGongs[rel].push(p.gong);
    if (p.tianPan.companionStem) {
      const cRel = getSixRelative(yearStem, p.tianPan.companionStem);
      if (!relativeGongs[cRel].includes(p.gong)) {
        relativeGongs[cRel].push(p.gong);
      }
    }
  }

  const kaiGong = findGongByDoor('开门');
  const shengGong = findGongByDoor('生门');
  const xiuGong = findGongByDoor('休门');
  const siGong = findGongByDoor('死门');
  const shangGong = findGongByDoor('伤门');
  const jingGong = findGongByDoor('景门');
  const duGong = findGongByDoor('杜门');

  const liuHeGongs = findGongsByGod('六合');
  const jiuDiGongs = findGongsByGod('九地');
  const jiuTianGongs = findGongsByGod('九天');
  const xuanWuGongs = findGongsByGod('玄武');
  const zhiFuGongs = findGongsByGod('值符');

  const ruiGong = findGongByStar('天芮');
  const fuGong = findGongByStar('天辅');

  const wuGongs = findGongsByStem('戊');
  const yiGongs = findGongsByStem('乙');
  const gengGongs = findGongsByStem('庚');
  const dingGongs = findGongsByStem('丁');

  const horseGong = baseChart.horseStar?.palace;

  const makeCandidate = (
    topic: QimenTopic,
    topicName: string,
    primary: (number | undefined)[],
    secondary: (number | undefined)[],
    basis: string,
  ): QimenTopicCandidate => {
    const validPrimary = Array.from(
      new Set(primary.filter((g): g is number => typeof g === 'number')),
    );
    const validSecondary = Array.from(
      new Set(
        secondary.filter((g): g is number => typeof g === 'number' && !validPrimary.includes(g)),
      ),
    );

    const patternSummary: string[] = [];
    for (const g of validPrimary) {
      const p = baseChart.jiuGongGe.find((item) => item.gong === g);
      if (p) {
        patternSummary.push(`${p.name}: ${summarizePalacePatterns(p, baseChart).join('，')}`);
      }
    }

    return {
      topic,
      topicName,
      primaryPalaces: validPrimary,
      secondaryPalaces: validSecondary,
      basis,
      patternSummary,
    };
  };

  // 1. 事业仕途 (career)
  candidates.push(
    makeCandidate(
      'career',
      '事业官禄',
      [kaiGong, ...zhiFuGongs, ...relativeGongs['官鬼']],
      [jingGong, ...jiuTianGongs],
      '《统宗》开门专司官爵仕途，值符为百官尊长，克我者官鬼司名权威柄，景门司文书名望',
    ),
  );

  // 2. 资产财富 (wealth)
  candidates.push(
    makeCandidate(
      'wealth',
      '资产财帛',
      [shengGong, ...wuGongs, ...relativeGongs['妻财']],
      [...jiuDiGongs, ...xuanWuGongs],
      '《统宗》生门专司财帛产业，甲子戊为青龙钱财资本，我克者妻财司日常资产，九地主储蓄',
    ),
  );

  // 3. 婚恋感情 (marriage)
  const spouseRelGongs = gender === 'female' ? relativeGongs['官鬼'] : relativeGongs['妻财'];
  candidates.push(
    makeCandidate(
      'marriage',
      '婚恋配偶',
      [...liuHeGongs, ...spouseRelGongs, ...(gender === 'female' ? gengGongs : yiGongs)],
      [xiuGong, ...(gender === 'female' ? yiGongs : gengGongs)],
      '《统宗》六合专司媒约婚姻，男取我克之妻财、女取克我之官鬼，乙庚为阴阳夫妇正配，休门司家庭',
    ),
  );

  // 4. 身体健康 (health)
  candidates.push(
    makeCandidate(
      'health',
      '身体疾厄',
      [ruiGong, siGong, ...relativeGongs['官鬼']],
      [shangGong],
      '《统宗》天芮星为疾病根源病灶，死门主气机滞塞，克我者官鬼疾厄司病患侵袭，伤门司外伤手术',
    ),
  );

  // 5. 学业进修 (academic)
  candidates.push(
    makeCandidate(
      'academic',
      '学业进修',
      [...relativeGongs['父母'], fuGong, jingGong, ...dingGongs],
      [...jiuTianGongs],
      '《统宗》生我者父母司学业文凭庇荫，天辅为文曲导师，景门司试卷考选，丁奇为文书玉印',
    ),
  );

  // 6. 居所差旅 (relocation)
  candidates.push(
    makeCandidate(
      'relocation',
      '居所差旅',
      [horseGong, ...jiuTianGongs, kaiGong],
      [shangGong, duGong],
      '《烟波钓叟歌》天马为动应之神，九天主升迁远行迁徙，开门司通达，伤门司车马动迁',
    ),
  );

  // 7. 原生家庭 (family)
  candidates.push(
    makeCandidate(
      'family',
      '原生家庭',
      [...relativeGongs['父母'], xiuGong],
      [...baseChart.jiuGongGe.filter((p) => p.tianPan.stem === yearStem).map((p) => p.gong)],
      '《统宗》生我者为父母长辈，年干为宗族根基，休门为宅舍庇护之宫',
    ),
  );

  // 8. 晚辈后嗣 (children)
  const hourStem = baseChart.ganzhi.hour[0];
  const hourGongs = baseChart.jiuGongGe
    .filter((p) => p.tianPan.stem === hourStem)
    .map((p) => p.gong);
  candidates.push(
    makeCandidate(
      'children',
      '晚辈后嗣',
      [...relativeGongs['子息'], ...hourGongs],
      [shengGong],
      '《统宗》我生者子息司晚辈团队，时干司晚运终局与具体事态产出',
    ),
  );

  // 9. 合伙合作 (partnership)
  candidates.push(
    makeCandidate(
      'partnership',
      '合伙合作',
      [...relativeGongs['兄弟'], ...liuHeGongs],
      [kaiGong],
      '《统宗》比肩者兄弟司同侪伙伴与合伙人，六合主契约协议合作共事',
    ),
  );

  if (selectedTopics && selectedTopics.length > 0) {
    return candidates.filter((c) => selectedTopics.includes(c.topic));
  }

  return candidates;
}
