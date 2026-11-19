import type { z } from 'zod';
import { sameJsonValue } from '../json-value';
import type { RuntimeContext } from '../runtime-context';
import type { mingluInput } from '../schemas/birth';
import { getOppositeSeasonBranch } from './ganzhi-foundation';
import { astrolabeIndependent } from './astrolabe';
import { bazhai } from './bazhai';
import { baziIndependent } from './bazi';
import { qizheng } from './qizheng';
import { qimenLifetime } from './qimen-lifetime';
import { collectZiweiMajorStars, ziweiIndependent } from './ziwei';
import { evaluateBaziZiweiCorroboration, formatCorroborationSection } from './bazi-ziwei-corroboration';
import { selectMingluGlossary } from './minglu-glossary';
import { dedupeExcerpts, formatClassicExcerpts, selectBaziClassics, selectBazhaiClassics, selectZiweiClassics } from './classics';

type Input = z.infer<typeof mingluInput>;
export type MingluSource = Omit<Input, 'question' | 'currentTime' | 'prompt'>;

const topicLabels: Record<NonNullable<NonNullable<Input['prompt']>['topic']>, string> = {
  overview: '综合命录总览',
  career: '事业与职业路径',
  wealth: '财富与资源配置',
  relationships: '情感与人际关系',
  family: '家庭与六亲结构',
  health: '身心状态与节律',
  timing: '岁运与阶段节奏',
};

function buildSections(
  baziData: Awaited<ReturnType<typeof baziIndependent>>,
  ziweiData: Awaited<ReturnType<typeof ziweiIndependent>> | null,
  astrolabeData: Awaited<ReturnType<typeof astrolabeIndependent>> | null,
  bazhaiData: ReturnType<typeof bazhai> | null,
  qizhengData: Awaited<ReturnType<typeof qizheng>> | null,
  qimenLifetimeData: Awaited<ReturnType<typeof qimenLifetime>> | null,
  omitted: Array<{ system: string; reason: string }>,
  detailMode: 'compact' | 'full',
) {
  const clip = (text: string, systemId: string) => {
    const blocks = text.split('\n\n').filter((block) => {
      if (/^【(?:任务|限制与任务|限制|问题)】/u.test(block)) return false;
      if (systemId === 'bazhai' && /未提供住宅坐山|缺少住宅方向/u.test(block)) return false;
      if (detailMode !== 'full' && systemId === 'ziwei' && (block.startsWith('【本命宫干四化】') || block.startsWith('【计算口径】'))) return false;
      if (detailMode !== 'full' && systemId === 'bazhai' && block.startsWith('【八方六亲归宫与门主灶布局指引】')) return false;
      return true;
    });
    return detailMode === 'full' ? blocks.join('\n\n') : blocks.slice(0, 4).join('\n\n');
  };
  const sections: Array<{ id: string; title: string; markdown: string }> = [
    { id: 'bazi', title: '一、八字资料', markdown: clip(baziData.prompt.text, 'bazi') },
  ];
  if (ziweiData) sections.push({ id: 'ziwei', title: '二、紫微斗数资料', markdown: clip(ziweiData.prompt.text, 'ziwei') });
  if (astrolabeData) sections.push({ id: 'astrolabe', title: '三、西洋星盘资料', markdown: clip(astrolabeData.prompt.text, 'astrolabe') });
  if (bazhaiData) sections.push({ id: 'bazhai', title: '四、八宅命卦资料', markdown: clip(bazhaiData.prompt.text, 'bazhai') });
  if (qizhengData) sections.push({ id: 'qizheng', title: '五、七政四余资料', markdown: clip(qizhengData.prompt.text, 'qizheng') });
  if (qimenLifetimeData) sections.push({ id: 'qimen-lifetime', title: '六、奇门终身局资料', markdown: clip(qimenLifetimeData.prompt.text, 'qimen-lifetime') });
  if (omitted.length) {
    sections.push({
      id: 'omitted',
      title: '未计算项目与原因',
      markdown: omitted.map((item) => `- **${item.system}**：${item.reason}`).join('\n'),
    });
  }
  return sections;
}

async function computeMinglu(source: MingluSource, question: string, context?: RuntimeContext) {
  const omitted: Array<{ system: string; reason: string }> = [];
  const baziResult = await baziIndependent({
    question,
    ...(source.birth ? { birth: source.birth } : {}),
    ...(source.birthRange ? { birthRange: source.birthRange } : {}),
    ...(source.gender ? { gender: source.gender } : {}),
    ...(source.referenceTime ? { referenceTime: source.referenceTime } : {}),
    ...(source.timelineYear !== undefined ? { timelineYear: source.timelineYear } : {}),
  });

  let ziweiResult: Awaited<ReturnType<typeof ziweiIndependent>> | null = null;
  if (source.include?.ziwei === false) {
    omitted.push({ system: '紫微斗数', reason: '调用方已关闭紫微斗数。' });
  } else if (!source.birth) {
    omitted.push({ system: '紫微斗数', reason: '仅提供 birthRange 时暂不直接组装紫微盘面，请改用 ziwei。' });
  } else if (!source.gender) {
    omitted.push({ system: '紫微斗数', reason: '未提供性别，无法排定紫微大限顺逆。' });
  } else {
    ziweiResult = await ziweiIndependent({
      question,
      birth: source.birth,
      gender: source.gender,
      ...(source.referenceTime ? { referenceTime: source.referenceTime } : {}),
      ...(source.ziweiRules ? { rules: source.ziweiRules } : {}),
    });
  }

  let astrolabeResult: Awaited<ReturnType<typeof astrolabeIndependent>> | null = null;
  if (source.include?.astrolabe === false) {
    omitted.push({ system: '西洋星盘', reason: '调用方已关闭西洋星盘。' });
  } else if (!source.birth || source.birth.clock.kind !== 'exact') {
    omitted.push({ system: '西洋星盘', reason: '未提供精确时分秒出生资料，不以候选首秒或中点冒充确定本命盘。' });
  } else if (source.birth.calendar === 'lunar') {
    omitted.push({ system: '西洋星盘', reason: '当前仅对公历精确出生直接组装西洋星盘。' });
  } else if (!source.location) {
    omitted.push({ system: '西洋星盘', reason: '未提供出生地经纬度，无法计算西洋星盘宫位与四轴。' });
  } else if (source.birth.timezone === undefined && !source.birth.timeZoneId) {
    omitted.push({ system: '西洋星盘', reason: '未提供固定时区偏移或 IANA 时区，无法组装西洋星盘。' });
  } else {
    astrolabeResult = await astrolabeIndependent({
      question,
      birth: {
        year: source.birth.year,
        month: source.birth.month,
        day: source.birth.day,
        hour: source.birth.clock.hour,
        minute: source.birth.clock.minute,
        second: source.birth.clock.second,
        latitude: source.location.latitude,
        longitude: source.location.longitude,
        ...(source.birth.timezone !== undefined ? { timezone: source.birth.timezone } : {}),
        ...(source.birth.timeZoneId ? { timeZoneId: source.birth.timeZoneId } : {}),
        ...(source.location.locationName ? { locationName: source.location.locationName } : {}),
        ...(source.birth.timeStandard === 'true-solar' ? { useTrueSolarTime: true } : {}),
      },
    }, context);
  }

  let bazhaiResult: ReturnType<typeof bazhai> | null = null;
  if (source.include?.bazhai === false) {
    omitted.push({ system: '八宅命卦', reason: '调用方已关闭八宅命卦。' });
  } else if (!source.birth) {
    omitted.push({ system: '八宅命卦', reason: '仅提供 birthRange 时不推断单一年份命卦。' });
  } else if (!source.gender) {
    omitted.push({ system: '八宅命卦', reason: '未提供性别，无法计算八宅命卦。' });
  } else if (source.birth.calendar === 'lunar') {
    omitted.push({ system: '八宅命卦', reason: '命卦立春换年按公历出生资料核对；当前未直接换算农历。' });
  } else {
    bazhaiResult = bazhai({
      question,
      person: {
        kind: 'birth',
        year: source.birth.year,
        month: source.birth.month,
        day: source.birth.day,
        gender: source.gender,
        ...(source.birth.clock.kind === 'exact' ? { clock: { hour: source.birth.clock.hour, minute: source.birth.clock.minute, second: source.birth.clock.second } } : {}),
        ...(source.birth.timezone !== undefined ? { timezone: source.birth.timezone } : {}),
        ...(source.birth.timeZoneId ? { timeZoneId: source.birth.timeZoneId } : {}),
      },
      ...(source.house ? { house: source.house } : {}),
    });
  }

  let qizhengResult: Awaited<ReturnType<typeof qizheng>> | null = null;
  const wantQizheng = source.include?.qizheng === true || (source.include?.all === true && source.include?.qizheng !== false);
  if (wantQizheng) {
    if (!source.birth || source.birth.clock.kind !== 'exact') {
      omitted.push({ system: '七政四余', reason: '未提供精确时分秒出生资料，无法直接排定七政四余本命盘。' });
    } else if (source.birth.calendar === 'lunar') {
      omitted.push({ system: '七政四余', reason: '当前仅对公历精确出生直接组装七政四余。' });
    } else if (!source.location) {
      omitted.push({ system: '七政四余', reason: '未提供出生地经纬度，无法计算七政四余命度与宫位。' });
    } else if (source.birth.timezone === undefined && !source.birth.timeZoneId) {
      omitted.push({ system: '七政四余', reason: '未提供固定时区偏移或 IANA 时区，无法组装七政四余。' });
    } else {
      qizhengResult = await qizheng({
        question,
        birth: {
          year: source.birth.year,
          month: source.birth.month,
          day: source.birth.day,
          hour: source.birth.clock.hour,
          minute: source.birth.clock.minute,
          second: source.birth.clock.second,
          latitude: source.location.latitude,
          longitude: source.location.longitude,
          ...(source.birth.timezone !== undefined ? { timezone: source.birth.timezone } : {}),
          ...(source.birth.timeZoneId ? { timeZoneId: source.birth.timeZoneId } : {}),
          ...(source.location.locationName ? { locationName: source.location.locationName } : {}),
        },
        ...(source.referenceTime ? { flow: { kind: 'year' as const, year: new Date(Date.parse(source.referenceTime)).getUTCFullYear() } } : {}),
      });
    }
  }

  let qimenLifetimeResult: Awaited<ReturnType<typeof qimenLifetime>> | null = null;
  const wantQimenLifetime = source.include?.qimenLifetime === true || (source.include?.all === true && source.include?.qimenLifetime !== false);
  if (wantQimenLifetime) {
    if (!source.birth || source.birth.clock.kind !== 'exact') {
      omitted.push({ system: '奇门终身局', reason: '未提供精确时分秒出生资料，无法直接排定奇门终身局。' });
    } else {
      const { clock, ...birthRest } = source.birth;
      qimenLifetimeResult = await qimenLifetime({
        question,
        birth: {
          ...birthRest,
          hour: clock.hour,
          minute: clock.minute,
          second: clock.second,
        },
        ...(source.gender ? { gender: source.gender } : {}),
      }, source.referenceTime ?? new Date().toISOString());
    }
  }

  return { baziResult, ziweiResult, astrolabeResult, bazhaiResult, qizhengResult, qimenLifetimeResult, omitted };
}

function buildCrossSynthesis(
  computed: Awaited<ReturnType<typeof computeMinglu>>,
  topic: NonNullable<NonNullable<Input['prompt']>['topic']>,
) {
  const baziChart = computed.baziResult.data.chart;
  const ziweiData = computed.ziweiResult?.data;
  const ziweiExact = ziweiData && !('unknown' in ziweiData) ? ziweiData : null;
  const astroData = computed.astrolabeResult?.data ?? null;
  const bazhaiData = computed.bazhaiResult?.data ?? null;
  const qizhengData = computed.qizhengResult?.data as any ?? null;
  const qimenData = computed.qimenLifetimeResult?.data as any ?? null;

  const baziZiweiCorroboration = baziChart && ziweiExact
    ? evaluateBaziZiweiCorroboration(baziChart, ziweiExact)
    : null;

  const dimensions: Array<{ id: string; label: string; baziFocus: string; ziweiFocus: string | null; astrolabeFocus: string | null; qizhengFocus: string | null; qimenFocus: string | null; bazhaiFocus: string | null }> = [
    {
      id: 'temperament',
      label: '本命心性与能量分布',
      baziFocus: baziChart
        ? `日主${baziChart.pillars.day.gan}${baziChart.pillars.day.stemElement}（旺衰${baziChart.strength.status}，格局${baziChart.patternOverview.pattern}，主用${baziChart.usefulGod.useful}）`
        : '出生时段未定（见各候选四柱与用神方向）',
      ziweiFocus: ziweiExact
        ? `命宫${ziweiExact.natal.soulBranch}（${ziweiExact.natal.palaces.find((p) => p.name === '命宫')?.majorStars.map((s) => s.name).join('、') || '无主星'}）、身宫${ziweiExact.natal.bodyBranch}、${ziweiExact.natal.fiveElementsClass}`
        : null,
      astrolabeFocus: astroData
        ? `太阳${astroData.points.find((p) => p.id === 'sun')?.sign ?? ''}、月亮${astroData.points.find((p) => p.id === 'moon')?.sign ?? ''}、上升${astroData.angles.find((a) => a.id === 'asc')?.sign ?? ''}；四元素分布${astroData.distributions.elements.map((e) => `${e.label}${e.members.length}`).join('/')}`
        : null,
      qizhengFocus: qizhengData?.natal?.mingGong
        ? `命宫${qizhengData.natal.mingGong.sign ?? ''}（度主${qizhengData.natal.mingGong.degreeLord ?? qizhengData.natal.mingGong.lord ?? ''}）`
        : qizhengData ? '七政本命盘已计算' : null,
      qimenFocus: qimenData?.baseChart
        ? `${qimenData.baseChart.isYangDun ? '阳遁' : '阴遁'}${qimenData.baseChart.juShu}局（值符${qimenData.baseChart.zhiFu?.star ?? ''}、值使${qimenData.baseChart.zhiShi?.door ?? ''}）`
        : null,
      bazhaiFocus: bazhaiData
        ? `命卦${bazhaiData.mingPalaces.map((m) => `${m.gua}卦`).join(' / ')}`
        : null,
    },
    {
      id: 'career-wealth',
      label: '事业与财富通道',
      baziFocus: baziChart
        ? `月柱${baziChart.pillars.month.ganZhi}（${baziChart.pillars.month.tenGod}）、时柱${baziChart.pillars.hour.ganZhi}（${baziChart.pillars.hour.tenGod}）；喜用五行${baziChart.usefulGod.favorableWuxing.join('、') || '待定'}`
        : '需先确定出生时辰以核对时柱与最终用神落位',
      ziweiFocus: ziweiExact
        ? `官禄宫（${ziweiExact.natal.palaces.find((p) => p.name === '官禄')?.majorStars.map((s) => s.name).join('、') || '借对宫'}）、财帛宫（${ziweiExact.natal.palaces.find((p) => p.name === '财帛')?.majorStars.map((s) => s.name).join('、') || '借对宫'}）`
        : null,
      astrolabeFocus: astroData
        ? `天顶MC${astroData.angles.find((a) => a.id === 'mc')?.sign ?? ''}；第10宫星体：${astroData.points.filter((p) => p.house === 10).map((p) => p.name).join('、') || '无'}；第2宫星体：${astroData.points.filter((p) => p.house === 2).map((p) => p.name).join('、') || '无'}`
        : null,
      qizhengFocus: qizhengData ? '参考七政官禄宫/财帛宫星曜躔度与恩难' : null,
      qimenFocus: qimenData?.stages ? `终身局分 ${qimenData.stages.length} 个阶段（详见奇门终身局分节）` : null,
      bazhaiFocus: bazhaiData
        ? `生气方：${bazhaiData.mingPalaces.map((m) => m.palaces.find((p) => p.label === '生气')?.direction ?? '').join('/')}；延年方：${bazhaiData.mingPalaces.map((m) => m.palaces.find((p) => p.label === '延年')?.direction ?? '').join('/')}`
        : null,
    },
    {
      id: 'relationships',
      label: '情感与合作结构',
      baziFocus: baziChart
        ? `日支夫妻宫${baziChart.pillars.day.zhi}（藏${baziChart.pillars.day.hiddenStems.map((h) => `${h.stem}${h.tenGod}`).join('、')}）`
        : `日支候选：${computed.baziResult.data.unknown?.possible.day.map((gz) => gz[1]).join('、') ?? '待核'}`,
      ziweiFocus: ziweiExact
        ? `夫妻宫（${ziweiExact.natal.palaces.find((p) => p.name === '夫妻')?.majorStars.map((s) => s.name).join('、') || '借对宫'}）、福德宫（${ziweiExact.natal.palaces.find((p) => p.name === '福德')?.majorStars.map((s) => s.name).join('、') || '借对宫'}）`
        : null,
      astrolabeFocus: astroData
        ? `下降点${astroData.angles.find((a) => a.id === 'desc')?.sign ?? ''}；金星${astroData.points.find((p) => p.id === 'venus')?.sign ?? ''}（第${astroData.points.find((p) => p.id === 'venus')?.house ?? ''}宫）、第7宫星体：${astroData.points.filter((p) => p.house === 7).map((p) => p.name).join('、') || '无'}`
        : null,
      qizhengFocus: qizhengData ? '参考七政夫妻宫主星与难星照临' : null,
      qimenFocus: null,
      bazhaiFocus: null,
    },
  ];

  return {
    topic,
    topicLabel: topicLabels[topic],
    dimensions,
    baziZiweiCorroboration,
    note: '跨体系对照将八字干支、紫微宫星、西洋黄道宫位与八宅方位的同题观察点并列整理；不同体系推演逻辑独立，不作机械加权打分。',
  };
}

function collectMatchedGlossary(computed: Awaited<ReturnType<typeof computeMinglu>>) {
  const baziData = computed.baziResult.data;
  const dayStems = baziData.chart
    ? [baziData.chart.pillars.day.gan]
    : [...new Set(baziData.unknown?.segments.map((s) => s.pillars.day.gan) ?? [])];
  const tenGods = baziData.chart
    ? baziData.chart.natalFacts.tenGodDistribution.filter((t) => t.visible.length || t.hidden.length).map((t) => t.tenGod)
    : [...new Set(baziData.unknown?.segments.flatMap((s) => s.natalFacts.tenGodDistribution.filter((t) => t.visible.length || t.hidden.length).map((t) => t.tenGod)) ?? [])];
  const shenshaNames = baziData.chart
    ? [...baziData.chart.shensha.global.map((x) => x.name), ...baziData.chart.shensha.entries.map((x) => x.name)]
    : [...new Set(baziData.unknown?.segments.flatMap((s) => [...s.shensha.global.map((x) => x.name), ...s.shensha.entries.map((x) => x.name)]) ?? [])];
  const ziweiData = computed.ziweiResult?.data;
  const ziweiStars = !ziweiData
    ? []
    : 'unknown' in ziweiData
      ? [...new Set(ziweiData.unknown.candidates.flatMap((c) => collectZiweiMajorStars(c.chart.natal.palaces)))]
      : collectZiweiMajorStars(ziweiData.natal.palaces);
  return selectMingluGlossary({
    dayStems,
    tenGods,
    shenshaNames,
    ziweiStars,
    hasZiwei: !!computed.ziweiResult,
    hasAstrolabe: !!computed.astrolabeResult,
    hasBazhai: !!computed.bazhaiResult,
  });
}

function renderMinglu(
  source: MingluSource,
  computed: Awaited<ReturnType<typeof computeMinglu>>,
  question: string,
  options?: Input['prompt'],
) {
  const detailMode = options?.detailMode ?? 'compact';
  const topic = options?.topic ?? 'overview';
  const sections = buildSections(
    computed.baziResult,
    computed.ziweiResult,
    computed.astrolabeResult,
    computed.bazhaiResult,
    computed.qizhengResult,
    computed.qimenLifetimeResult,
    computed.omitted,
    detailMode,
  );
  const crossSynthesis = buildCrossSynthesis(computed, topic);
  const matchedGlossary = collectMatchedGlossary(computed);
  const synthesisText = [
    `【跨体系同题合参对照（${crossSynthesis.topicLabel}）】`,
    ...crossSynthesis.dimensions.map((dim) => [
      `- **${dim.label}**：`,
      `  - 八字：${dim.baziFocus}`,
      ...(dim.ziweiFocus ? [`  - 紫微：${dim.ziweiFocus}`] : []),
      ...(dim.astrolabeFocus ? [`  - 西洋星盘：${dim.astrolabeFocus}`] : []),
      ...(dim.qizhengFocus ? [`  - 七政四余：${dim.qizhengFocus}`] : []),
      ...(dim.qimenFocus ? [`  - 奇门终身局：${dim.qimenFocus}`] : []),
      ...(dim.bazhaiFocus ? [`  - 八宅命卦：${dim.bazhaiFocus}`] : []),
    ].join('\n')),
    ...(crossSynthesis.baziZiweiCorroboration ? [formatCorroborationSection(crossSynthesis.baziZiweiCorroboration)] : []),
  ].join('\n');
  const glossaryText = detailMode === 'full' && matchedGlossary.length
    ? `【盘面命中核心术语释义（共 ${matchedGlossary.length} 条）】\n${matchedGlossary.map((g) => `- **${g.term}**（${g.category}）：${g.shortDesc}${g.classicSource ? ` ${g.classicSource}` : ''}`).join('\n')}`
    : '';
  const markdown = ['# 命录综合资料', ...sections.map((section) => `## ${section.title}\n\n${section.markdown}`)].join('\n\n');
  const classics = options?.includeClassics
    ? (() => {
        const baziData = computed.baziResult.data;
        const baziExcerpts = baziData.chart
          ? selectBaziClassics(baziData.chart.pillars.day.gan, baziData.chart.ordinaryPattern.candidate)
          : baziData.unknown?.segments.flatMap((s) => selectBaziClassics(s.pillars.day.gan, s.ordinaryPattern.candidate)) ?? [];
        const ziweiData = computed.ziweiResult?.data;
        const ziweiExcerpts = !ziweiData
          ? []
          : 'unknown' in ziweiData
            ? ziweiData.unknown.candidates.flatMap((c) => selectZiweiClassics(collectZiweiMajorStars(c.chart.natal.palaces)))
            : selectZiweiClassics(collectZiweiMajorStars(ziweiData.natal.palaces));
        const bazhaiData = computed.bazhaiResult?.data;
        const bazhaiExcerpts = bazhaiData
          ? selectBazhaiClassics([
              ...bazhaiData.mingPalaces.flatMap((p) => p.palaces.map((x) => x.label)),
              ...bazhaiData.housePalaces.flatMap((p) => p.starPalaces.map((x) => x.label)),
            ])
          : [];
        return formatClassicExcerpts(
          dedupeExcerpts([...baziExcerpts, ...ziweiExcerpts, ...bazhaiExcerpts]),
          '典籍片段',
        );
      })()
    : '';
  const southernHemisphereNote = source.location && source.location.latitude < 0
    ? (() => {
        const baziChart = computed.baziResult.data.chart;
        const monthBranch = baziChart?.pillars.month.zhi;
        const mirrorBranch = monthBranch ? getOppositeSeasonBranch(monthBranch) : null;
        return `出生地位于南半球（纬度 ${source.location.latitude}°）：八字主盘仍按全球统一节气（太阳黄经）起${monthBranch ? `${monthBranch}月` : '月令'}；若按南半球寒暖季节反推调候派参看，对应季节月令约为${mirrorBranch ? `${mirrorBranch}月` : '对冲六合节令'}，仅作流派对照附注。`;
      })()
    : undefined;
  const promptText = [
    `【命录综合资料（V2 聚合）】\n主题：${topicLabels[topic]}；详略：${detailMode === 'full' ? '完整' : '精简'}。\n本命录直接复用现有独立排盘内核，不生成旧版加权评分，也不将跨体系并行展示当作互相证明。`,
    ...(southernHemisphereNote ? [`【南半球节令对照说明】\n${southernHemisphereNote}`] : []),
    synthesisText,
    ...sections.map((section) => `【${section.title}】\n${section.markdown}`),
    glossaryText,
    classics,
    `【任务】\n围绕「${topicLabels[topic]}」分开陈述各已计算体系的盘面依据、成立条件与资料缺口；未计算项目不得凭空补造。\n【问题】\n${question}`,
  ].filter(Boolean).join('\n\n');
  return {
    data: {
      input: source,
      bazi: computed.baziResult.data,
      ziwei: computed.ziweiResult?.data ?? null,
      astrolabe: computed.astrolabeResult?.data ?? null,
      bazhai: computed.bazhaiResult?.data ?? null,
      ...(computed.qizhengResult ? { qizheng: computed.qizhengResult.data } : {}),
      ...(computed.qimenLifetimeResult ? { qimenLifetime: computed.qimenLifetimeResult.data } : {}),
      omitted: computed.omitted,
      crossSynthesis,
      ...(southernHemisphereNote ? { southernHemisphereNote } : {}),
      matchedGlossary,
      sections,
      markdown,
    },
    prompt: { text: promptText },
  };
}

export async function minglu(input: Input, context?: RuntimeContext) {
  const { question, currentTime: _currentTime, prompt: options, ...source } = input;
  const computed = await computeMinglu(source, question, context);
  const rendered = renderMinglu(source, computed, question, options);
  const included = [
    '八字',
    ...(computed.ziweiResult ? ['紫微'] : []),
    ...(computed.astrolabeResult ? ['西洋星盘'] : []),
    ...(computed.bazhaiResult ? ['八宅'] : []),
  ];
  return {
    data: rendered.data,
    summary: {
      title: '命录综合资料',
      tags: included,
      lines: [
        `已聚合：${included.join('、')}`,
        ...(computed.omitted.length ? [`未计算：${computed.omitted.map((item) => item.system).join('、')}`] : []),
      ],
    },
    prompt: rendered.prompt,
  };
}

export async function promptForSavedMinglu(
  data: unknown,
  source: MingluSource,
  question: string,
  options?: Input['prompt'],
  context?: RuntimeContext,
) {
  const computed = await computeMinglu(source, question, context);
  const expected = renderMinglu(source, computed, question, options).data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('命录结果格式无效。');
  const saved = data as Record<string, unknown>;
  if (
    !sameJsonValue(saved.input, expected.input)
    || !sameJsonValue(saved.bazi, expected.bazi)
    || !sameJsonValue(saved.ziwei, expected.ziwei)
    || !sameJsonValue(saved.astrolabe, expected.astrolabe, 1e-9)
    || !sameJsonValue(saved.bazhai, expected.bazhai)
    || !sameJsonValue(saved.omitted, expected.omitted)
    || !sameJsonValue(saved.matchedGlossary, expected.matchedGlossary)
  ) {
    throw new Error('命录结果与保存的出生资料不一致。');
  }
  return renderMinglu(source, computed, question, options).prompt;
}
