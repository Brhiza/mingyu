import {
  getQizhengSignBranch,
  type QizhengBirthRange,
  type QizhengFlowBirthRange,
  type QizhengFlowBirthRangeBranch,
  type QizhengResult,
} from 'mingyu-core/qizheng';

export function formatQizhengRangeTime(timestamp: number): string {
  return new Date(timestamp + 8 * 3_600_000).toISOString().slice(0, 19).replace('T', ' ');
}

function formatValue(value: number, unit: string): string {
  return unit === '毫秒时间戳'
    ? new Date(value + 8 * 3_600_000).toISOString().slice(0, 23).replace('T', ' ')
    : String(Number(value.toPrecision(10)));
}

function formatNatalFacts(data: QizhengResult): string[] {
  const context = data.calculationContext;
  const enNan = data.enNan;
  return [
    `命宫${getQizhengSignBranch(data.mingGong)}、身宫${getQizhengSignBranch(data.shenGong)}、命主${data.mingZhu}。`,
    `十二宫：${data.twelvePalaces.map((item) => `${item.palace}在${item.signBranch}`).join('；')}。`,
    ...data.stars.map(
      (star) =>
        `${star.name}：${star.xiu}宿，${star.signBranch}宫${star.palace}，${star.dignity || '无庙旺标记'}${star.retrograde === undefined ? '' : `，${star.retrograde ? '逆行' : '顺行'}`}；${star.precisionClass}。`,
    ),
    `吊照：${data.aspects.length ? data.aspects.map((item) => `${item.star1}与${item.star2}${item.type}，${item.closeness}，目标角${item.exactAngle}度、容许偏差${item.allowedOrb}度，${item.precisionClass}`).join('；') : '容许度内无主要吊照'}。`,
    `神煞：${data.shensha.map((item) => `${item.name}${item.value}`).join('；')}。`,
    ...(enNan
      ? [
          `昼夜分金：${enNan.sect}；${enNan.sectSummary}。此处按钟表时间六时至十八时为昼生。`,
          `命主五行${enNan.mingElement}；恩星${enNan.enStars.join('、')}；难星${enNan.nanStars.join('、')}；仇星${enNan.chouStars.join('、')}；用星${enNan.yongStars.join('、')}。`,
          `恩难交会：${enNan.aspectInteraction.length ? enNan.aspectInteraction.join('；') : '无对应交会'}。`,
        ]
      : []),
    `月相：${context.moonPhase.eightPhaseName}，${context.moonPhase.waxing ? '盈' : '亏'}；前一四正月相${context.moonPhase.previousPrincipalPhase.name}，后一四正月相${context.moonPhase.nextPrincipalPhase.name}。`,
    `光照日期${context.solarIllumination.localDate}：${context.solarIllumination.status}；${[context.solarIllumination.sunriseSunset, context.solarIllumination.civilTwilight, context.solarIllumination.nauticalTwilight, context.solarIllumination.astronomicalTwilight].map((item) => `${item.name}${item.status}`).join('；')}。`,
    `盘面证据：${data.evidenceAnalysis.summaryFact.status}；${data.evidenceAnalysis.counterEvidenceFacts.map((item) => `${item.type}：${item.status}`).join('；')}。`,
  ];
}

/** 流曜离散事实适用于整个分段，事件时刻由连续量给出整段极值。 */
export function formatQizhengFlowRangeFacts(
  data: QizhengResult,
  period?: QizhengFlowBirthRangeBranch['periodEvents'],
): string[] {
  const flow = data.flowingStars;
  if (!flow) return [];
  const limits = data.timeLords;
  return [
    '流曜落宫落宿：',
    ...flow.stars.map(
      (star) =>
        `${star.name}：${star.signBranch}宫${star.palace}，${star.xiu}宿${star.retrograde === undefined ? '' : `，${star.retrograde ? '逆行' : '顺行'}`}；${star.precisionClass}。`,
    ),
    `流曜与本命吊照：${flow.transits.length ? flow.transits.map((item) => `${item.star1}与${item.star2}${item.type}，${item.closeness}，目标角${item.exactAngle}度、容许偏差${item.allowedOrb}度，${item.precisionClass}`).join('；') : '容许度内无主要吊照'}。`,
    ...(limits
      ? [
          `行限：${limits.gender === 'male' ? '男命' : '女命'}，生年干${limits.yearStem}属${limits.yearStemYinYang}，${limits.direction}，虚岁${limits.nominalAge}；${limits.ageNote}。`,
          `大限：命宫宿度、出童限岁数和当前大限宫位未定；小限：${limits.currentMinorLimit.signBranch}宫${limits.currentMinorLimit.palace}；太岁${limits.annualBranch}入${limits.annualPalace.signBranch}宫${limits.annualPalace.palace}。`,
          `洞微宫序与各宫年数：${limits.majorPalaceYears.map((item) => `${item.signBranch}宫${item.palace}${item.years === null ? '依命度定年数' : `${item.years}年`}`).join('；')}。`,
        ]
      : ['行限：性别未提供。']),
    '周期事件（北京时间；按本段出生秒核对）：',
    ...(period
      ? period.events.length
        ? period.events.map(
            (event, index) =>
              `事件${index + 1}：${event.movingStar}${event.kind}${event.targetStar ? `本命${event.targetStar}` : ''}${event.aspectType || ''}${event.aspectDirection ? `（黄经差${event.aspectDirection}）` : ''}${event.signBranch ? `，${event.signBranch}宫` : ''}${event.palace || ''}${event.stationDirection ? `，转${event.stationDirection}` : ''}；${formatValue(event.minUtcMs, '毫秒时间戳')}${event.minUtcMs === event.maxUtcMs ? '' : ` 至 ${formatValue(event.maxUtcMs, '毫秒时间戳')}`}；覆盖本段${event.sampleCount}个出生秒。`,
          )
        : ['本段出生时刻对应的目标周期内未见上述事件。']
      : []),
  ];
}

/** 将逐秒分段事实写成可独立阅读的中文资料。 */
export function formatQizhengBirthRangePrompt(
  range: QizhengBirthRange | QizhengFlowBirthRange,
): string {
  const first = range.branches[0].representative;
  const context = first.calculationContext;
  const flow = first.flowingStars;
  return [
    flow ? '【七政四余流曜与出生区间】' : '【七政四余本命出生区间】',
    `出生范围（北京时间）：${formatQizhengRangeTime(range.source.startTimestamp)} 至 ${formatQizhengRangeTime(range.source.endTimestamp)}，起点含、终点不含。`,
    `区间按整秒核对，共${range.sampleCount}个时刻、${range.branches.length}段。各段列出保持一致的命身宫、星曜落宫落宿、吊照与恩难关系，并汇总连续量。`,
    '【任务】',
    flow
      ? '依据《果老星宗》的落宫、落宿、吊照及恩难仇用关系，结合目标时段的流曜、小限与太岁解读。区分整个出生范围共同成立的判断与各出生分段的差异，逐项写明出生时段和目标周期。周期事件的时刻范围表示出生时间不确定带来的变化。'
      : '依据《果老星宗》的落宫、落宿、吊照及恩难仇用关系解读本命根基。区分整个出生范围均成立的结论与仅在部分时段成立的结论，逐项写明适用时间。流年与行限属于另外的时段资料。',
    ...(flow
      ? [
          '【流曜目标】',
          `${flow.timestampNote}；代表时刻${flow.localDateTime}。`,
          `周期事件窗口：${flow.periodEvents!.startDateTime} 至 ${flow.periodEvents!.endDateTime}（起点含、终点不含），${flow.periodEvents!.mode === 'yearly' ? '流年' : flow.periodEvents!.mode === 'monthly' ? '流月' : '流日'}。`,
        ]
      : []),
    '【时间与地点】',
    `东八区；纬度${context.latitude}、经度${context.longitude}；${context.locationSource}；传统宫位采用${context.palaceTimeMode || '民用时间'}。`,
    '【计算口径】',
    '七政、罗睺、计都、月孛采用天文位置，紫炁采用传统均速模型；吊照容许度与紧密程度描述几何关系。整秒覆盖表示时间扫描步长，星历及传统模型各有其计算精度。',
    '连续量列出本段所有整秒的极值；圆周量按相对首值的最短弧展开，折回零至三百六十度可得圆周位置。事件时间统一列为北京时间。',
    ...range.branches.flatMap((branch, index) => [
      `【时段${index + 1}】`,
      `${formatQizhengRangeTime(branch.startTimestamp)} 至 ${formatQizhengRangeTime(branch.endTimestamp)}（起点含、终点不含），共${branch.sampleCount}秒。`,
      ...formatNatalFacts(branch.representative),
      ...formatQizhengFlowRangeFacts(
        branch.representative,
        'periodEvents' in branch ? branch.periodEvents : undefined,
      ),
      '连续量（最小至最大）：',
      ...branch.continuous.map(
        (item) =>
          `${item.label}：${formatValue(item.min, item.unit)}${item.min === item.max ? '' : ` 至 ${formatValue(item.max, item.unit)}`}${item.unit === '毫秒时间戳' ? '' : item.unit}。`,
      ),
    ]),
  ].join('\n');
}
