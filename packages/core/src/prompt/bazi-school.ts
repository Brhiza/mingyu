import {
  analyzeStemRootProfile,
  analyzeTenGodFlow,
  analyzeTenGodStructure,
  analyzeTombStorage,
  getTenGod,
  getTenGodForBranch,
  getWuxing,
  type BaziChartResult,
} from '../bazi';

export const BAZI_PROMPT_SCHOOLS = ['traditional', 'ziping', 'mangpai', 'xinpai'] as const;
export const BAZI_PROMPT_MULTI_SCHOOLS = ['ziping', 'mangpai', 'xinpai'] as const;

export type BaziPromptSchool = (typeof BAZI_PROMPT_SCHOOLS)[number];
export type NormalizedBaziPromptSchool = Exclude<BaziPromptSchool, 'traditional'>;

type BaziPillarKey = 'year' | 'month' | 'day' | 'hour';

type SchoolProfile = {
  label: string;
  task: string;
  basis: string;
};

const PILLAR_KEYS: BaziPillarKey[] = ['year', 'month', 'day', 'hour'];

const PILLAR_LABELS: Record<BaziPillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

const MANGPAI_PALACE_REFERENCES: Record<BaziPillarKey, string> = {
  year: '祖上、早年与外部环境',
  month: '父母、手足、成长环境与事业门户',
  day: '日干为命主，日支为夫妻宫与内在家庭',
  hour: '子女、晚景、成果与归宿，通常与日柱同归主位',
};

export const BAZI_SCHOOL_PROFILES: Record<NormalizedBaziPromptSchool, SchoolProfile> = {
  ziping: {
    label: '子平派（传统）',
    task: '先以月令定格，结合日主得令、通根、透干与全局制化判断旺衰，再以调候、格局成败和岁运引动回答问题。',
    basis:
      '《渊海子平》《子平真诠》《三命通会》《滴天髓》《穷通宝鉴》的月令、格局、旺衰、调候与行运资料。',
  },
  mangpai: {
    label: '盲派',
    task: '以四柱宫位和十神落位为骨架，先分主位与宾位，再看透干、藏干、通根、墓库、空亡及柱间组合形成的做功与取象；围绕问题确定体用，并以大运流年复核阶段与触发。',
    basis:
      '十神、藏干、宫位、通根、墓库和柱间生克关系参照《渊海子平》《三命通会》《滴天髓》；宾主体用、组合取象与分柱年限采用近现代盲派的通行整理口径。',
  },
  xinpai: {
    label: '新派',
    task: '先依据月令、司令、通根、帮扶与克泄耗确定日主旺衰，再区分扶抑、调候和格局需要，落实喜用与忌神在各柱的显隐位置；按原局、大运、流年逐层观察五行与十神的动态作用。',
    basis:
      '月令、旺衰、调候和生克制化参照《子平真诠》《滴天髓》《穷通宝鉴》《三命通会》；喜忌落位、五行流通与岁运动态采用近现代新派的通行整理口径。',
  },
};

function joinFacts(values: Array<string | undefined | null>, fallback = '未记录') {
  const text = values.filter((value): value is string => Boolean(value?.trim())).join('；');
  return text || fallback;
}

function pillarInputs(result: BaziChartResult) {
  return PILLAR_KEYS.map((key) => ({
    gan: result.pillars[key].gan,
    zhi: result.pillars[key].zhi,
    hiddenStems: result.hiddenStems[key] ?? [],
  }));
}

function formatPillars(
  result: BaziChartResult,
  options: { includePalace?: boolean; includeLifeStage?: boolean } = {},
) {
  return PILLAR_KEYS.map((key) => {
    const pillar = result.pillars[key];
    const hidden = (result.hiddenStems[key] ?? []).map(
      (stem, index) =>
        `${stem}${result.hiddenTenGods[key]?.[index] ? `[${result.hiddenTenGods[key][index]}]` : ''}`,
    );
    const parts = [
      `${PILLAR_LABELS[key]}${pillar.ganZhi}`,
      `天干十神${result.tenGods[key] || (key === 'day' ? '日主' : '未记录')}`,
      `藏干${hidden.join('、') || '无'}`,
      options.includeLifeStage && result.lifeStages[key]
        ? `日主十二运${result.lifeStages[key]}`
        : '',
      result.ziZuo[key] ? `自坐${result.ziZuo[key]}` : '',
      options.includePalace ? `宫位参照${MANGPAI_PALACE_REFERENCES[key]}` : '',
    ].filter(Boolean);
    return parts.join('；');
  }).join('\n');
}

function formatRelations(result: BaziChartResult) {
  const relations = result.pillarRelations;
  return joinFacts([
    relations.fuxin.length ? `伏吟与同柱${relations.fuxin.join('、')}` : undefined,
    relations.fanyin.length ? `反吟与天克地冲${relations.fanyin.join('、')}` : undefined,
    relations.xingChong.length
      ? `合冲刑害破及三合三会${relations.xingChong.join('、')}`
      : undefined,
  ]);
}

function usefulWuxing(result: BaziChartResult) {
  const useful = result.analysis.usefulGod;
  const favorable = Array.from(
    new Set(
      [
        useful.primaryFavorableWuxing,
        ...(useful.secondaryFavorableWuxing ?? []),
        ...(useful.favorableWuxing ?? []),
      ].filter((item): item is string => Boolean(item)),
    ),
  );
  const unfavorable = Array.from(
    new Set(
      [
        useful.primaryUnfavorableWuxing,
        ...(useful.secondaryUnfavorableWuxing ?? []),
        ...(useful.unfavorableWuxing ?? []),
      ].filter((item): item is string => Boolean(item)),
    ),
  );
  return { favorable, unfavorable };
}

function formatUsefulGod(result: BaziChartResult) {
  const useful = result.analysis.usefulGod;
  const { favorable, unfavorable } = usefulWuxing(result);
  return joinFacts([
    useful.primaryFavorableWuxing ? `主用${useful.primaryFavorableWuxing}` : undefined,
    useful.secondaryFavorableWuxing?.length
      ? `辅用${useful.secondaryFavorableWuxing.join('、')}`
      : undefined,
    useful.primaryUnfavorableWuxing ? `主忌${useful.primaryUnfavorableWuxing}` : undefined,
    useful.secondaryUnfavorableWuxing?.length
      ? `次忌${useful.secondaryUnfavorableWuxing.join('、')}`
      : undefined,
    !useful.primaryFavorableWuxing && favorable.length ? `喜用${favorable.join('、')}` : undefined,
    !useful.primaryUnfavorableWuxing && unfavorable.length
      ? `忌神${unfavorable.join('、')}`
      : undefined,
    useful.primaryReason ? `取用理由${useful.primaryReason}` : undefined,
  ]);
}

function formatTenGodStructure(result: BaziChartResult) {
  const structure = analyzeTenGodStructure(pillarInputs(result), result.dayMaster.gan, getTenGod);
  const present = structure.distributions
    .filter((item) => item.totalCount > 0)
    .map((item) => `${item.tenGod}${item.status}（透${item.visibleCount}、藏${item.hiddenCount}）`);
  const missing = structure.distributions
    .filter((item) => item.totalCount === 0)
    .map((item) => item.tenGod);
  return joinFacts([
    present.length ? `已见${present.join('、')}` : undefined,
    missing.length ? `原局未见${missing.join('、')}` : undefined,
  ]);
}

function formatTenGodFlow(result: BaziChartResult) {
  const structure = analyzeTenGodStructure(pillarInputs(result), result.dayMaster.gan, getTenGod);
  const flow = analyzeTenGodFlow(structure);
  return flow.items.length
    ? flow.items.map((item) => item.name).join('、')
    : '原局已列十神未形成完整的相邻生化链';
}

function formatRoots(result: BaziChartResult) {
  const roots = analyzeStemRootProfile(
    pillarInputs(result),
    result.dayMaster.gan,
    getWuxing,
    getTenGod,
  );
  return roots.items
    .map(
      (item) =>
        `${PILLAR_LABELS[item.pillar as BaziPillarKey]}${item.stem}[${item.tenGod}]${item.status}`,
    )
    .join('、');
}

function formatTombAndVoid(result: BaziChartResult) {
  const tomb = analyzeTombStorage(pillarInputs(result), result.dayMaster.gan, getWuxing, getTenGod);
  const tombText = tomb.items.map(
    (item) =>
      `${item.branch}库藏${item.storageStem}[${item.storageTenGod}]${item.isDayMasterTomb ? '，兼为日主墓位' : ''}`,
  );
  const dayVoid = result.kongWang.day ?? [];
  const voidPillars = PILLAR_KEYS.filter((key) => dayVoid.includes(result.pillars[key].zhi)).map(
    (key) => `${PILLAR_LABELS[key]}${result.pillars[key].zhi}`,
  );
  return joinFacts([
    tombText.length ? `墓库${tombText.join('、')}` : '四柱未见辰戌丑未墓库',
    dayVoid.length
      ? `日柱旬空${dayVoid.join('、')}，命中${voidPillars.join('、') || '无'}`
      : undefined,
  ]);
}

function classifyWuxing(value: string, favorable: string[], unfavorable: string[]) {
  const element = getWuxing(value);
  if (favorable.includes(element)) return `${value}${element}[喜用]`;
  if (unfavorable.includes(element)) return `${value}${element}[忌神]`;
  return `${value}${element}[中性]`;
}

function formatUsefulGodPlacements(result: BaziChartResult) {
  const { favorable, unfavorable } = usefulWuxing(result);
  return PILLAR_KEYS.map((key) => {
    const pillar = result.pillars[key];
    const visible = classifyWuxing(pillar.gan, favorable, unfavorable);
    const hidden = (result.hiddenStems[key] ?? []).map((stem) =>
      classifyWuxing(stem, favorable, unfavorable),
    );
    return `${PILLAR_LABELS[key]}：透干${visible}；藏干${hidden.join('、') || '无'}`;
  }).join('\n');
}

function formatFortune(result: BaziChartResult) {
  const cycles = (result.luckInfo?.cycles ?? []).filter((cycle) => !cycle.isXiaoyun).slice(0, 8);
  const cycleText = cycles.map((cycle) => {
    const stem = cycle.ganZhi.charAt(0);
    const branch = cycle.ganZhi.charAt(1);
    return `${cycle.ganZhi}（${cycle.year}年起，约${cycle.age}岁；${getTenGod(stem, result.dayMaster.gan)}、${getTenGodForBranch(branch, result.dayMaster.gan)}）`;
  });
  return joinFacts([
    result.luckInfo?.startInfo ? `起运${result.luckInfo.startInfo}` : undefined,
    cycleText.length ? `大运${cycleText.join('、')}` : undefined,
  ]);
}

function formatZipingFacts(result: BaziChartResult) {
  const strength = result.analysis.dayMasterStrength;
  const details = strength.details;
  return [
    `月令与节候：月柱${result.pillars.month.ganZhi}，月令司权${result.monthCommander || '未记录'}，${result.seasonInfo.currentSeason || '当前'}令，节气${result.seasonInfo.currentJieqi || '未记录'}`,
    `日主旺衰：${result.dayMaster.gan}${result.dayMaster.element}${result.dayMaster.yinYang}，${strength.status}；得令${details.timely ? '是' : '否'}，通根${details.hasRoot ? '有' : '无'}，强根${details.hasStrongRoot ? '有' : '无'}，帮扶${details.hasSupport ? '可见' : '不显'}，克泄耗${details.hasConstraint ? '可见' : '不显'}`,
    `透干通根：${formatRoots(result)}`,
    `格局与成败：${result.analysis.mingGe.pattern}${result.analysis.mingGe.basis ? `；${result.analysis.mingGe.basis}` : ''}`,
    `调候与取用：${formatUsefulGod(result)}；五行季节状态${
      Object.entries(result.wuxingSeasonStatus)
        .map(([element, status]) => `${element}${status}`)
        .join('、') || '未记录'
    }`,
    `岁运：${formatFortune(result)}`,
  ].join('\n');
}

function formatMangpaiFacts(result: BaziChartResult) {
  return [
    '四柱宫位与十神落位：',
    formatPillars(result, { includePalace: true, includeLifeStage: true }),
    `主宾定位：主位为日柱${result.pillars.day.ganZhi}与时柱${result.pillars.hour.ganZhi}，其中日干${result.dayMaster.gan}代表命主，日支${result.pillars.day.zhi}为夫妻宫；宾位为年柱${result.pillars.year.ganZhi}与月柱${result.pillars.month.ganZhi}，再围绕所问事项从相应宫位和十神确定体用。`,
    `十神显隐：${formatTenGodStructure(result)}`,
    `透干通根：${formatRoots(result)}`,
    `四柱组合与做功线索：${formatRelations(result)}；从主宾之间的制、化、合、冲关系观察十神作用与组合取象。`,
    `墓库与空亡：${formatTombAndVoid(result)}`,
    `纳音旁参：${PILLAR_KEYS.map((key) => `${PILLAR_LABELS[key]}${result.nayin[key] || '未记录'}`).join('、')}`,
    `分柱年限：年柱约对应1至16岁，月柱约对应17至32岁，日柱约对应33至48岁，时柱约对应49岁以后；${formatFortune(result)}`,
  ].join('\n');
}

function formatXinpaiFacts(result: BaziChartResult) {
  const strength = result.analysis.dayMasterStrength;
  const details = strength.details;
  const positiveRuleBasis = details.ruleBasis
    .flatMap((item) => item.split(/[；。]/))
    .map((item) => item.trim())
    .filter((item) => item && !/^(?:不|不得|不能|禁止|避免)/.test(item));
  return [
    `旺衰判定：日主${result.dayMaster.gan}${result.dayMaster.element}${result.dayMaster.yinYang}，结论${strength.status}；得令${details.timely ? '是' : '否'}，通根${details.hasRoot ? '有' : '无'}，强根${details.hasStrongRoot ? '有' : '无'}，帮扶${details.hasSupport ? '可见' : '不显'}，克泄耗${details.hasConstraint ? '可见' : '不显'}；月令作用${details.seasonalEffect}，司令作用${details.commanderEffect}，成局作用${details.formationEffect}`,
    `旺衰依据：${positiveRuleBasis.join('；') || '月令、司令、通根、帮扶与克泄耗合看'}`,
    `透干通根：${formatRoots(result)}`,
    `五行结构：已见${result.wuxingStrength.present.join('、') || '未记录'}；结构偏重${result.wuxingStrength.dominantByRule.join('、') || '未记录'}；原局缺项${result.wuxingStrength.missing.join('、') || '无'}；月令状态${
      Object.entries(result.wuxingSeasonStatus)
        .map(([element, status]) => `${element}${status}`)
        .join('、') || '未记录'
    }`,
    `十神结构：${formatTenGodStructure(result)}`,
    `十神流通：候选链条${formatTenGodFlow(result)}`,
    `格局与取用：格局${result.analysis.mingGe.pattern}；${formatUsefulGod(result)}`,
    '喜忌落位：',
    formatUsefulGodPlacements(result),
    `原局作用：${formatRelations(result)}`,
    `动态岁运：${formatFortune(result)}`,
  ].join('\n');
}

export function normalizeBaziPromptSchool(school: BaziPromptSchool): NormalizedBaziPromptSchool {
  return school === 'traditional' ? 'ziping' : school;
}

export function getBaziSchoolGuidance(school?: BaziPromptSchool) {
  if (!school) return '';
  const profile = BAZI_SCHOOL_PROFILES[normalizeBaziPromptSchool(school)];
  return `${profile.label}：${profile.task}\n依据：${profile.basis}`;
}

export function formatBaziSchoolFacts(result: BaziChartResult, school: BaziPromptSchool) {
  const normalized = normalizeBaziPromptSchool(school);
  if (normalized === 'ziping') return formatZipingFacts(result);
  if (normalized === 'mangpai') return formatMangpaiFacts(result);
  return formatXinpaiFacts(result);
}

export function formatBaziSchoolPrompt(result: BaziChartResult, school: BaziPromptSchool) {
  const normalized = normalizeBaziPromptSchool(school);
  const profile = BAZI_SCHOOL_PROFILES[normalized];
  return [
    `八字流派：${profile.label}`,
    `流派任务：${profile.task}`,
    `流派依据：${profile.basis}`,
    '流派盘面资料：',
    formatBaziSchoolFacts(result, school),
  ].join('\n');
}

export function buildBaziSchoolPromptSection(result: BaziChartResult, school?: BaziPromptSchool) {
  return school ? `【流派】\n${formatBaziSchoolPrompt(result, school)}` : '';
}

export function normalizeBaziPromptSchools(
  schools?: readonly BaziPromptSchool[] | null,
): NormalizedBaziPromptSchool[] {
  if (!schools?.length) return [];
  const selected = schools.map(normalizeBaziPromptSchool).filter((school, index, list) => {
    return list.indexOf(school) === index;
  });
  if (selected.length > 3) throw new RangeError('八字多派合参最多选择三个流派。');
  return selected;
}

export function formatBaziSchoolsPrompt(
  result: BaziChartResult,
  schools?: readonly BaziPromptSchool[] | null,
) {
  const selected = normalizeBaziPromptSchools(schools);
  if (!selected.length) return '';
  const blocks = selected.map((school, index) => {
    const profile = BAZI_SCHOOL_PROFILES[school];
    return [
      `派系${index + 1}：${profile.label}`,
      `流派任务：${profile.task}`,
      `流派依据：${profile.basis}`,
      '本派盘面资料：',
      formatBaziSchoolFacts(result, school),
    ].join('\n');
  });
  if (selected.length > 1) {
    blocks.push(
      '合参任务：请先按每个流派分别形成判断，再归纳共同结论、分歧及各自对应的盘面依据，最后围绕问题给出综合判断。',
    );
  }
  return blocks.join('\n\n');
}

export function buildBaziSchoolsPromptSection(
  result: BaziChartResult,
  schools?: readonly BaziPromptSchool[] | null,
) {
  const selected = normalizeBaziPromptSchools(schools);
  const content = formatBaziSchoolsPrompt(result, selected);
  return content ? `【${selected.length > 1 ? '多派合参' : '解读流派'}】\n${content}` : '';
}
