import { getTenGodForBranch, type BaziChartResult } from 'mingyu-core/bazi';
import { formatFixedTimezoneOffset } from 'mingyu-core/calendar';
import type { QizhengResult } from 'mingyu-core/qizheng';
import { formatInstantQizhengPrompt } from 'mingyu-core/instant';
import type { ZiweiRuntime } from 'mingyu-core/ziwei';
import type { AstrolabeData } from '@/types/divination';
import { formatAstrolabeAspectSections } from 'mingyu-core/divination/astrolabe-scope';
import { formatPalaceRelations } from 'mingyu-core/ziwei/prompt';

type ZiweiPayload = ZiweiRuntime['payloadByScope']['origin'];

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'] as const;

function formatInstantPillarRelation(label: string, relation: string) {
  return label === '伏吟' ? relation.replace(/干支同为.+$/u, '干支相同') : relation;
}

function buildInstantTaskBook(options: {
  chartLabel: string;
  traditionalBasis: string;
  timeBasisLabel: string;
  chartText: string;
  question: string;
  task?: string;
}) {
  const question = options.question.trim() || `请整体解读这张${options.chartLabel}。`;
  return [
    `【解读对象】\n${options.chartLabel}。盘面年月日时均为本次事件的起盘时间；所问事项是本次判断的对象。`,
    `【传统依据】\n${options.traditionalBasis}`,
    `【时间口径】\n${options.timeBasisLabel}`,
    `【盘面资料】\n${options.chartText}`,
    `【任务】\n请围绕所问事项的当前条件、相互作用与发展可能直接回答问题，将每项判断对应到起盘时刻的具体盘面依据；涉及时间变化时，区分起盘已有状态与满足条件后的变化。${options.task ? ` ${options.task}` : ''}`,
    `【问题】\n${question}`,
  ].join('\n\n');
}

function formatInstantBaziData(result: BaziChartResult) {
  const lunar = result.lunarDate;
  const dayEmptyBranches = result.kongWang.day;
  const pillarRelationGroups: Array<[string, string[]]> = [
    ['伏吟', result.pillarRelations.fuxin],
    ['反吟', result.pillarRelations.fanyin],
    ['同干', result.pillarRelations.sameStem],
    ['同支', result.pillarRelations.sameBranch],
    ['刑冲合害破', result.pillarRelations.xingChong],
  ];
  const pillarRelations = pillarRelationGroups
    .filter(([, values]) => values.length)
    .map(
      ([label, values]) =>
        `${label}：${values.map((value) => formatInstantPillarRelation(label, value)).join('、')}`,
    );
  const pillarLines = PILLAR_KEYS.map((key, index) => {
    const hidden = result.hiddenStems[key]
      .map((stem, stemIndex) => {
        const tenGod = result.hiddenTenGods[key][stemIndex];
        const visiblePillars = PILLAR_KEYS.flatMap((pillarKey, pillarIndex) =>
          result.pillars[pillarKey].gan === stem ? [PILLAR_LABELS[pillarIndex]] : [],
        );
        return `${stem}${tenGod ? `（${tenGod}）` : ''}〔${visiblePillars.length ? `明透于${visiblePillars.join('、')}天干` : '仅藏于支'}〕`;
      })
      .join('、');
    const kongWang = result.kongWang[key]?.join('、') || '无';
    const dayEmptyMark = dayEmptyBranches.includes(result.pillars[key].zhi)
      ? `；按日旬核对本柱${result.pillars[key].zhi}支：落空`
      : '';
    return `${PILLAR_LABELS[index]}：${result.pillars[key].ganZhi}；天干十神：${
      key === 'day' ? '日元' : result.tenGods[key]
    }；地支十神：${getTenGodForBranch(result.pillars[key].zhi, result.dayMaster.gan)}；藏干：${hidden || '无'}；纳音：${result.nayin[key]}；该柱所属旬空：${kongWang}${dayEmptyMark}`;
  });

  return [
    `起盘时刻：${result.solarDate.year}年${result.solarDate.month}月${result.solarDate.day}日 ${result.timeInfo.name}`,
    `农历：${lunar.year}年${lunar.monthName}${lunar.dayName}；生肖：${result.zodiac}`,
    `日元：${result.dayMaster.gan}${result.dayMaster.element}（${result.dayMaster.yinYang}）`,
    result.hiddenStems.month?.[0] ? `月支本气：${result.hiddenStems.month[0]}` : '',
    result.monthCommander ? `月令司权：${result.monthCommander}` : '',
    ...pillarLines,
    `五行：出现${result.wuxingStrength.present.join('、') || '无'}；结构比较优先${result.wuxingStrength.dominantByRule.join('、') || '无'}；缺失${result.wuxingStrength.missing.join('、') || '无'}`,
    `事件盘结构：日元${result.analysis.dayMasterStrength.status}；格局${result.analysis.mingGe.pattern}${result.analysis.mingGe.basis ? `（${result.analysis.mingGe.basis}）` : ''}；取用${result.analysis.usefulGod.useful}；忌用${result.analysis.usefulGod.avoid}`,
    result.climate && result.climate.nature !== '未见明显偏向'
      ? `水火分布参考：${result.climate.summary}`
      : '',
    pillarRelations.length ? `四柱关系：${pillarRelations.join('；')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatZiweiStar(star: ZiweiPayload['palaces'][number]['major_stars'][number]) {
  return [
    star.name,
    star.brightness ? `（${star.brightness}）` : '',
    star.birth_mutagen ? `（起盘年干化${star.birth_mutagen}）` : '',
  ]
    .filter(Boolean)
    .join('');
}

function formatInstantZiweiData(payload: ZiweiPayload) {
  const basic = payload.basic_info;
  const palaceLines = payload.palaces.map((palace) => {
    const stars = [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars]
      .map(formatZiweiStar)
      .join('、');
    const selfMutagens = palace.self_mutagens?.length
      ? `；${palace.self_mutagens.map((item) => `自化${item}`).join('、')}`
      : '';
    const flyingMutagens = palace.mutaged_palaces
      ?.filter(
        (item) =>
          item.palace_name &&
          !(item.palace_name === palace.name && palace.self_mutagens?.includes(item.mutagen)),
      )
      .map((item) => `化${item.mutagen}入${item.palace_name}`);
    return `${palace.name}（${palace.heavenly_stem}${palace.earthly_branch}）${
      palace.is_body_palace ? '，身宫' : ''
    }：${stars || '无主星'}${selfMutagens}${flyingMutagens?.length ? `；宫干飞化${flyingMutagens.join('、')}` : ''}\n宫位关系：${formatPalaceRelations(payload, palace)}`;
  });
  return [
    `起盘时刻：${basic.solar_date}；农历：${basic.lunar_date}；时辰：${basic.birth_time_label}`,
    basic.four_pillars
      ? `四柱：${basic.four_pillars.year_pillar} ${basic.four_pillars.month_pillar} ${basic.four_pillars.day_pillar} ${basic.four_pillars.hour_pillar}`
      : '',
    `五行局：${basic.five_elements_class}；命主星：${basic.soul}；身主星：${basic.body}`,
    ...palaceLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatInstantAstrolabeData(data: AstrolabeData) {
  const ascendant = data.angles.find((item) => item.name === 'Ascendant');
  const planets = data.planets.map(
    (item) =>
      `${item.label}${item.formatted}，第${item.house}宫${item.retrograde ? '，逆行' : ''}${item.dignityLabel ? `，${item.dignityLabel}` : ''}`,
  );
  const aspectSections = formatAstrolabeAspectSections(data.aspects, [
    ...data.planets,
    ...data.angles,
  ]);
  return [
    `起盘时刻：${data.birth.dateTime}；观测地点：${data.birth.location}；时区：UTC${formatFixedTimezoneOffset(data.birth.timezone)}`,
    data.birth.latitude !== undefined && data.birth.longitude !== undefined
      ? `观测坐标：${data.birth.latitude >= 0 ? '北纬' : '南纬'}${Math.abs(data.birth.latitude)}°，${data.birth.longitude >= 0 ? '东经' : '西经'}${Math.abs(data.birth.longitude)}°`
      : '',
    data.birth.timeZoneId ? `时区名称：${data.birth.timeZoneId}` : '',
    data.houseSystem
      ? `宫位制：${data.houseSystem === 'whole_sign' ? '整宫制' : '普拉西德斯宫制（Placidus）'}`
      : '',
    ...(data.ephemerisWarnings ?? []).map((warning) => `星历精度：${warning}`),
    data.birth.isTrueSolarTime
      ? `真太阳时：${data.birth.trueSolarDateTime || data.birth.dateTime}`
      : '',
    `上升点：${ascendant?.formatted || '未列'}`,
    ...data.angles
      .filter((item) => item.name !== 'Ascendant')
      .map((item) => `${item.label}：${item.formatted}`),
    '十二宫宫头：',
    ...data.houses.map((house) => `第${house.house}宫：${house.formatted}`),
    data.summary.patternBasis === 'ten-main-bodies-selected-aspects' && data.summary.patterns.length
      ? `十大星体格局：${data.summary.patterns.join('、')}`
      : '',
    '星体位置：',
    ...planets,
    ...(aspectSections.length ? aspectSections : ['相位明细：未见容许度内的主要相位']),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatInstantQizhengData(result: QizhengResult) {
  return formatInstantQizhengPrompt(result)
    .replace('【七政四余即时盘 · 果老星宗】\n', '')
    .replace('\n本盘记录起盘时刻的星曜位置、落宿、落宫和吊照。', '');
}

export function buildInstantBaziPrompt(
  result: BaziChartResult,
  question: string,
  timeBasisLabel: string,
) {
  return buildInstantTaskBook({
    chartLabel: '八字即时盘',
    traditionalBasis: '四柱结合日元、月令、十神、藏干、空亡与五行结构判断。',
    timeBasisLabel,
    chartText: formatInstantBaziData(result),
    question,
  });
}

export function buildInstantZiweiPrompt(
  payload: ZiweiPayload,
  question: string,
  timeBasisLabel: string,
) {
  return buildInstantTaskBook({
    chartLabel: '紫微即时盘',
    traditionalBasis: '命身十二宫结合星曜、三方四正与四化判断。',
    timeBasisLabel,
    chartText: formatInstantZiweiData(payload),
    question,
  });
}

export function buildInstantBaziZiweiPrompt(
  bazi: BaziChartResult,
  ziwei: ZiweiPayload,
  question: string,
  timeBasisLabel: string,
) {
  return buildInstantTaskBook({
    chartLabel: '八字紫微即时盘',
    traditionalBasis:
      '八字结合四柱、十神与五行结构判断，紫微结合命身十二宫、星曜、三方四正与四化判断。',
    timeBasisLabel,
    chartText: `【八字盘】\n${formatInstantBaziData(bazi)}\n\n【紫微盘】\n${formatInstantZiweiData(ziwei)}`,
    question,
    task: '请分别分析两张盘，再交叉印证共同指向与分歧。',
  });
}

export function buildInstantAstrolabePrompt(
  data: AstrolabeData,
  question: string,
  timeBasisLabel: string,
) {
  return buildInstantTaskBook({
    chartLabel: '星盘即时盘',
    traditionalBasis: '星盘结合四轴、行星落座落宫与主要相位判断。',
    timeBasisLabel,
    chartText: formatInstantAstrolabeData(data),
    question,
  });
}

export function buildInstantQizhengPrompt(
  result: QizhengResult,
  question: string,
  timeBasisLabel: string,
) {
  return buildInstantTaskBook({
    chartLabel: '七政四余即时盘',
    traditionalBasis: '七政四余结合星体位置、二十八宿、十二宫与吊照关系判断。',
    timeBasisLabel,
    chartText: formatInstantQizhengData(result),
    question,
  });
}
