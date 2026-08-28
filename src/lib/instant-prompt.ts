import { getTenGodForBranch, type BaziChartResult } from 'mingyu-core/bazi';
import type { QizhengResult } from 'mingyu-core/qizheng';
import type { ZiweiRuntime } from 'mingyu-core/ziwei';
import type { AstrolabeData } from '@/types/divination';

type ZiweiPayload = ZiweiRuntime['payloadByScope']['origin'];

const PILLAR_KEYS = ['year', 'month', 'day', 'hour'] as const;
const PILLAR_LABELS = ['年柱', '月柱', '日柱', '时柱'] as const;

function buildInstantTaskBook(options: {
  chartLabel: string;
  traditionalBasis: string;
  timeBasisLabel: string;
  chartText: string;
  question: string;
  task: string;
}) {
  const question = options.question.trim() || `请整体解读这张${options.chartLabel}。`;
  return [
    `【传统依据】\n${options.traditionalBasis}`,
    `【时间口径】\n${options.timeBasisLabel}`,
    `【盘面资料】\n${options.chartText}`,
    `【任务】\n${options.task}`,
    `【问题】\n${question}`,
  ].join('\n\n');
}

function formatInstantBaziData(result: BaziChartResult) {
  const lunar = result.lunarDate;
  const pillarLines = PILLAR_KEYS.map((key, index) => {
    const hidden = result.hiddenStems[key]
      .map((stem, stemIndex) => {
        const tenGod = result.hiddenTenGods[key][stemIndex];
        return `${stem}${tenGod ? `（${tenGod}）` : ''}`;
      })
      .join('、');
    const kongWang = result.kongWang[key]?.join('、') || '无';
    return `${PILLAR_LABELS[index]}：${result.pillars[key].ganZhi}；天干十神：${
      key === 'day' ? '日元' : result.tenGods[key]
    }；地支十神：${getTenGodForBranch(result.pillars[key].zhi, result.dayMaster.gan)}；藏干：${hidden || '无'}；纳音：${result.nayin[key]}；空亡：${kongWang}`;
  });

  return [
    `起盘时刻：${result.solarDate.year}年${result.solarDate.month}月${result.solarDate.day}日 ${result.timeInfo.name}`,
    `农历：${lunar.year}年${lunar.monthName}${lunar.dayName}；生肖：${result.zodiac}`,
    `日元：${result.dayMaster.gan}${result.dayMaster.element}（${result.dayMaster.yinYang}）`,
    result.monthCommander ? `月令司权：${result.monthCommander}` : '',
    ...pillarLines,
    `五行：出现${result.wuxingStrength.present.join('、') || '无'}；结构比较优先${result.wuxingStrength.dominantByRule.join('、') || '无'}；缺失${result.wuxingStrength.missing.join('、') || '无'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatZiweiStar(star: ZiweiPayload['palaces'][number]['major_stars'][number]) {
  return [
    star.name,
    star.brightness ? `（${star.brightness}）` : '',
    star.birth_mutagen ? `化${star.birth_mutagen}` : '',
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
    return `${palace.name}（${palace.heavenly_stem}${palace.earthly_branch}）${
      palace.is_body_palace ? '，身宫' : ''
    }：${stars || '无主星'}`;
  });
  const mutagens = payload.active_scope.mutagen_map
    .map(
      (item) => `${item.star}化${item.mutagen}${item.palace_name ? `入${item.palace_name}` : ''}`,
    )
    .join('；');

  return [
    `起盘时刻：${basic.solar_date}；农历：${basic.lunar_date}；时辰：${basic.birth_time_label}`,
    basic.four_pillars
      ? `四柱：${basic.four_pillars.year_pillar} ${basic.four_pillars.month_pillar} ${basic.four_pillars.day_pillar} ${basic.four_pillars.hour_pillar}`
      : '',
    `五行局：${basic.five_elements_class}；命宫主星：${basic.soul}；身宫主星：${basic.body}`,
    mutagens ? `生年四化：${mutagens}` : '',
    ...palaceLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatInstantAstrolabeData(data: AstrolabeData) {
  const ascendant = data.angles.find((item) => item.name === 'Ascendant');
  const planets = data.planets.map(
    (item) => `${item.label}${item.formatted}，第${item.house}宫${item.retrograde ? '，逆行' : ''}`,
  );
  const aspects = data.aspects
    .slice(0, 12)
    .map(
      (item) =>
        `${item.body1}${item.symbol}${item.body2}（${item.type}，容许度${item.orb.toFixed(2)}°）`,
    );
  return [
    `起盘时刻：${data.birth.dateTime}；观测地点：${data.birth.location}；时区：UTC${data.birth.timezone >= 0 ? '+' : ''}${data.birth.timezone}`,
    data.birth.isTrueSolarTime
      ? `真太阳时：${data.birth.trueSolarDateTime || data.birth.dateTime}`
      : '',
    `上升点：${ascendant?.formatted || '未列'}`,
    `主要格局：${data.summary.patterns.join('、') || '未见明显格局'}`,
    '星体位置：',
    ...planets,
    '主要相位：',
    ...(aspects.length ? aspects : ['未见容许度内的主要相位']),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatInstantQizhengData(result: QizhengResult) {
  return result.prompt
    .replace('【七政四余 · 果老星宗】\n', '')
    .replace('出生时间：', '起盘时间：')
    .replace(/命主([^；\n]+)；/u, '命宫主星$1；');
}

export function buildInstantBaziPrompt(
  result: BaziChartResult,
  question: string,
  timeBasisLabel: string,
) {
  return buildInstantTaskBook({
    chartLabel: '八字即时盘',
    traditionalBasis: '以当前时刻四柱为事件盘，结合日元、月令、十神、藏干、空亡与五行结构判断。',
    timeBasisLabel,
    chartText: formatInstantBaziData(result),
    question,
    task: '请把盘面作为当前时刻的事件盘，依据四柱、十神、藏干、纳音、空亡与五行结构直接回答问题，并说明主要判断依据。',
  });
}

export function buildInstantZiweiPrompt(
  payload: ZiweiPayload,
  question: string,
  timeBasisLabel: string,
) {
  return buildInstantTaskBook({
    chartLabel: '紫微即时盘',
    traditionalBasis: '以当前时刻命身十二宫为事件盘，结合星曜、三方四正与四化判断。',
    timeBasisLabel,
    chartText: formatInstantZiweiData(payload),
    question,
    task: '请把盘面作为当前时刻的事件盘，依据十二宫、星曜、四化与三方四正直接回答问题，并说明主要判断依据。',
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
      '八字以当前时刻四柱、十神与五行结构判断，紫微以当前时刻命身十二宫、星曜、三方四正与四化判断，再交叉印证。',
    timeBasisLabel,
    chartText: `【八字盘】\n${formatInstantBaziData(bazi)}\n\n【紫微盘】\n${formatInstantZiweiData(ziwei)}`,
    question,
    task: '请把两张盘作为同一当前时刻的事件盘，分别依据八字与紫微的盘面结构判断，再综合两者共同指向直接回答问题，并说明主要依据与分歧。',
  });
}

export function buildInstantAstrolabePrompt(
  data: AstrolabeData,
  question: string,
  timeBasisLabel: string,
) {
  return buildInstantTaskBook({
    chartLabel: '星盘即时盘',
    traditionalBasis: '以当前时刻星盘为事件盘，结合四轴、行星落座落宫与主要相位判断。',
    timeBasisLabel,
    chartText: formatInstantAstrolabeData(data),
    question,
    task: '请把星盘作为当前时刻的事件盘，依据四轴、行星落座落宫与主要相位直接回答问题，并说明主要判断依据。',
  });
}

export function buildInstantQizhengPrompt(
  result: QizhengResult,
  question: string,
  timeBasisLabel: string,
) {
  return buildInstantTaskBook({
    chartLabel: '七政四余即时盘',
    traditionalBasis:
      '以当前时刻七政四余盘为事件盘，结合星体位置、二十八宿、十二宫与吊照关系判断。',
    timeBasisLabel,
    chartText: formatInstantQizhengData(result),
    question,
    task: '请把盘面作为当前时刻的事件盘，依据七政四余星体位置、二十八宿、十二宫与吊照关系直接回答问题，并说明主要判断依据。',
  });
}
