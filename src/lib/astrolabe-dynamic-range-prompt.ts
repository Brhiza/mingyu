import type {
  AstrolabeDynamicRangeBranch,
  AstrolabeDynamicRangeSummary,
  AstrolabeDynamicSample,
} from 'mingyu-core/divination/astrolabe-dynamic-range';
import {
  formatAstrolabeForPrompt,
  formatPromptSchoolGuidance,
  getPromptSelectionSection,
  requirePromptSelection,
} from 'mingyu-core/prompt';
import {
  formatAstrolabeBirthRangeInterval,
  formatAstrolabeRangeContinuousFact,
  localizeAstrolabeChartText,
} from './astrolabe-birth-range-prompt';

export type AstrolabeDynamicPromptPage = {
  branchIndex: number;
  pageIndex: number;
  firstFactIndex: number;
  factCount: number;
  lastPageOfBranch: boolean;
  nextCursor: AstrolabeDynamicPromptCursor | null;
  text: string;
};

export type AstrolabeDynamicPromptCursor = {
  branchIndex: number;
  pageIndex: number;
  branchStartTimestamp: number;
};

export type AstrolabeDynamicPromptOptions = {
  question?: string;
  topicId?: string;
  subtopicId?: string;
  schools?: readonly string[];
};

/** 盘面与时限资料用于解读；数值求解步骤保留在本地核对资料中。 */
export function isAstrolabeDynamicReadingFact(path: string): boolean {
  return (
    !path.includes('.steps.') && !path.includes('.timeScale.') && !path.endsWith('.residualDegrees')
  );
}

/** 按原有事实顺序展开，候选相位和朔望触碰保留完整成员。 */
function* sampleFacts(sample: AstrolabeDynamicSample, endpoint: string): Generator<string> {
  for (const line of formatAstrolabeForPrompt(sample.natal).split('\n').filter(Boolean)) {
    yield `${endpoint}本命：${line.replaceAll('Placidus', '普拉西德斯')}`;
  }
  for (const scope of sample.scopes) {
    const prefix = `${endpoint}${scope.displayLabel}（${scope.displayText}）`;
    if (scope.transitFacts) {
      yield `${prefix}行运相位：${scope.transitFacts.status}，共${scope.transitFacts.facts.length}项。`;
      for (const [index, fact] of scope.transitFacts.facts.entries()) {
        yield `${prefix}行运相位第${index + 1}项：${fact.promptText}；${fact.line}；实际夹角${fact.actualAngle}度，精确角${fact.exactAngle}度，偏差${fact.deviation}度，容许度${fact.allowedOrb}度；${fact.isOutOfSign ? '跨星座相位' : '同类星座关系内相位'}。`;
      }
    }
    for (const fact of scope.transitHouseFacts?.facts ?? []) {
      yield `${prefix}行运落宫：${fact.promptText}。`;
    }
    for (const [technique, evidence] of [
      ['太阳返照', scope.solarReturnEvidence],
      ['次限推进', scope.secondaryProgressionEvidence],
      ['太阳弧', scope.solarArcEvidence],
    ] as const) {
      if (!evidence) continue;
      const status = {
        calculated: '推运资料',
        exact: '精确返照',
        approximate: '近似返照',
        'not-applicable': '不适用',
        unavailable: '资料不足',
      }[evidence.status];
      yield `${prefix}${technique}：${status}；共${evidence.movingPointFacts.length}个推运点，${evidence.candidateAspectFacts.length}项候选相位。`;
      if ('dateTime' in evidence && evidence.dateTime)
        yield `${prefix}${technique}返照时刻：${evidence.dateTime}。`;
      if ('progressedDateTime' in evidence && evidence.progressedDateTime)
        yield `${prefix}${technique}推进时刻：${evidence.progressedDateTime}；年龄${evidence.age}岁。`;
      if ('arcDegrees' in evidence && evidence.arcDegrees !== undefined)
        yield `${prefix}${technique}推进弧：${evidence.arcDegrees}度。`;
      for (const point of evidence.movingPointFacts) {
        yield `${prefix}${technique}推运点${point.label}：${point.signLabel}${point.degree}度${point.minute}分${point.second}秒；黄经${point.longitude}度${point.house === undefined ? '' : `；第${point.house}宫`}${point.retrograde === undefined ? '' : `；${point.retrograde ? '逆行' : '顺行'}`}。`;
      }
      const selected = new Map(evidence.aspectFacts.map((fact, index) => [fact.key, index + 1]));
      for (const [index, fact] of evidence.candidateAspectFacts.entries()) {
        yield `${prefix}${technique}候选相位第${index + 1}项：${fact.movingPoint}${fact.aspectName}${fact.natalPoint}；${selected.has(fact.key) ? `主要相位第${selected.get(fact.key)}项` : '其余相位'}；实际夹角${fact.actualAngle}度，精确角${fact.exactAngle}度，偏差${fact.deviation}度，容许度${fact.allowedOrb}度；${fact.closeness}。`;
      }
    }
    const period = scope.periodEvents;
    if (!period) continue;
    yield `${prefix}周期：${period.startDateTime}至${period.endDateTime}，${period.timezoneLabel}；共${period.events.length}项事件。`;
    const labels = new Map(
      period.events.map((event, index) => [
        event.key,
        `事件${index + 1}（${event.dateTime}，${event.kind}）`,
      ]),
    );
    const member = (key: string) => {
      const label = labels.get(key);
      if (!label) throw new Error('西占周期成员缺少对应事件。');
      return label;
    };
    for (const event of period.events) {
      yield `${prefix}${member(event.key)}：${event.promptText}`;
      for (const [index, touch] of (
        event.lunationTouchCandidates ??
        event.lunationTouches ??
        []
      ).entries()) {
        yield `${prefix}${member(event.key)}触碰第${index + 1}项：${touch.pointLabel}${touch.aspectName}；实际夹角${touch.actualAngle}度，精确角${touch.exactAngle}度，偏差${touch.deviation}度，容许度${touch.allowedOrb}度。`;
      }
    }
    for (const [index, group] of period.groups.entries()) {
      for (const event of group.events)
        yield `${prefix}事件组${index + 1}（${group.movingPoint}${group.aspectName}${group.targetPoint}）成员：${member(event.key)}。`;
    }
    for (const [index, window] of period.windows.entries()) {
      for (const key of window.eventKeys)
        yield `${prefix}窗口${index + 1}（${window.startDateTime}至${window.endDateTime}）成员：${member(key)}。`;
    }
    for (const [index, axis] of period.axis.entries()) {
      yield `${prefix}主轴第${index + 1}项：${axis.promptText}`;
      for (const key of axis.eventKeys ?? [])
        yield `${prefix}主轴第${index + 1}项成员：${member(key)}。`;
    }
  }
}

function* branchFacts(branch: AstrolabeDynamicRangeBranch): Generator<string> {
  yield* sampleFacts(branch.representative, '首秒');
  yield* sampleFacts(branch.last, '末秒');
  for (const fact of branch.continuous) {
    if (!isAstrolabeDynamicReadingFact(fact.path)) continue;
    yield `整段连续事实：${formatAstrolabeRangeContinuousFact(fact, branch.representative.natal)}`;
  }
}

/** 消费者请求下一页时才继续读取；任一时刻仅持有当前分段和一页事实。 */
export async function* iterateAstrolabeDynamicPromptPages(
  summary: AstrolabeDynamicRangeSummary,
  readBranch: (index: number) => Promise<AstrolabeDynamicRangeBranch>,
  options: AstrolabeDynamicPromptOptions & {
    maxCharacters?: number;
    signal?: AbortSignal;
    startAt?: AstrolabeDynamicPromptCursor;
  } = {},
): AsyncGenerator<AstrolabeDynamicPromptPage> {
  const limit = options.maxCharacters ?? 12000;
  if (!Number.isSafeInteger(limit) || limit < 2000)
    throw new Error('每页提示词容量至少为2000个字符。');
  const interval = formatAstrolabeBirthRangeInterval(
    summary.source.startTimestamp,
    summary.source.endTimestamp,
  );
  const selection =
    options.topicId !== undefined || options.subtopicId !== undefined
      ? requirePromptSelection({
          methodId: 'astrolabe',
          topicId: options.topicId,
          subtopicId: options.subtopicId,
          scope: summary.scope,
        })
      : undefined;
  const schoolText = formatPromptSchoolGuidance('astrolabe', options.schools);
  if (
    !Number.isSafeInteger(summary.branchCount) ||
    summary.branchCount < 1 ||
    summary.sampleCount * 1000 !== summary.source.endTimestamp - summary.source.startTimestamp
  )
    throw new Error('西占区间汇总与出生范围不一致。');
  const startAt = options.startAt ?? {
    branchIndex: 0,
    pageIndex: 0,
    branchStartTimestamp: summary.source.startTimestamp,
  };
  if (
    !Number.isSafeInteger(startAt.branchIndex) ||
    startAt.branchIndex < 0 ||
    startAt.branchIndex >= summary.branchCount ||
    !Number.isSafeInteger(startAt.pageIndex) ||
    startAt.pageIndex < 0 ||
    !Number.isSafeInteger(startAt.branchStartTimestamp) ||
    startAt.branchStartTimestamp % 1000 !== 0 ||
    startAt.branchStartTimestamp < summary.source.startTimestamp ||
    startAt.branchStartTimestamp >= summary.source.endTimestamp ||
    (startAt.branchIndex === 0 && startAt.branchStartTimestamp !== summary.source.startTimestamp)
  )
    throw new Error('西占解读续读位置无效。');
  let end = startAt.branchStartTimestamp;
  for (let branchIndex = startAt.branchIndex; branchIndex < summary.branchCount; branchIndex += 1) {
    options.signal?.throwIfAborted();
    const branch = await readBranch(branchIndex);
    options.signal?.throwIfAborted();
    if (
      branch.startTimestamp !== end ||
      !Number.isSafeInteger(branch.sampleCount) ||
      branch.sampleCount < 1 ||
      branch.sampleCount * 1000 !== branch.endTimestamp - branch.startTimestamp ||
      branch.endTimestamp > summary.source.endTimestamp ||
      (branchIndex === summary.branchCount - 1 &&
        branch.endTimestamp !== summary.source.endTimestamp)
    )
      throw new Error('西占分段覆盖范围不连续或样本数量不符。');
    end = branch.endTimestamp;
    let pageIndex = 0;
    let firstFactIndex = 0;
    let lines: string[] = [];
    const header = () =>
      [
        '【西洋占星出生时间区间解读】',
        `全部出生范围：${interval}，共${summary.sampleCount}个整秒样本。`,
        `本轮出生时段：${formatAstrolabeBirthRangeInterval(branch.startTimestamp, branch.endTimestamp)}，共${branch.sampleCount}个整秒样本；第${branchIndex + 1}/${summary.branchCount}段，资料第${pageIndex + 1}页。`,
        `推运目标：${summary.referenceDate}；${{ yearly: '流年', monthly: '流月', daily: '流日', full: '本命、流年、流月与流日' }[summary.scope]}。`,
        `时间与地点：北京时间东八区；${branch.representative.natal.birth.location || '出生地'}，经度${branch.representative.natal.birth.longitude ?? '未提供'}、纬度${branch.representative.natal.birth.latitude ?? '未提供'}；${branch.representative.natal.houseSystem === 'whole_sign' ? '整宫制' : '普拉西德斯宫位制'}。`,
        selection ? `【解读选择】\n${getPromptSelectionSection(selection)}` : '',
        schoolText ? `【解读口径】\n${schoolText}` : '',
        options.question?.trim() ? `【问题】\n${options.question.trim()}` : '',
        '【任务】\n依据本页星体、宫位、相位与时限资料解读本轮时段。每项结论注明本轮出生时段、盘面依据和条件，首末秒位置结合连续事实理解；跨时段共同结论在各段全部资料齐备后归纳。',
        '【输出要求】\n用中文说明本页支持的具体判断与适用范围，并列出需要结合其余资料继续核对的内容。',
        '【本轮资料】',
      ]
        .filter(Boolean)
        .join('\n\n');
    const page = (lastPageOfBranch: boolean): AstrolabeDynamicPromptPage => ({
      branchIndex,
      pageIndex,
      firstFactIndex,
      factCount: lines.length,
      lastPageOfBranch,
      nextCursor: lastPageOfBranch
        ? branchIndex + 1 === summary.branchCount
          ? null
          : {
              branchIndex: branchIndex + 1,
              pageIndex: 0,
              branchStartTimestamp: branch.endTimestamp,
            }
        : { branchIndex, pageIndex: pageIndex + 1, branchStartTimestamp: branch.startTimestamp },
      text: `${header()}\n${lines.join('\n')}`,
    });
    for (const raw of branchFacts(branch)) {
      options.signal?.throwIfAborted();
      const line = localizeAstrolabeChartText(raw, branch.representative.natal);
      if (`${header()}\n${[...lines, line].join('\n')}`.length > limit && lines.length) {
        if (branchIndex > startAt.branchIndex || pageIndex >= startAt.pageIndex) yield page(false);
        options.signal?.throwIfAborted();
        firstFactIndex += lines.length;
        pageIndex += 1;
        lines = [];
      }
      if (`${header()}\n${line}`.length > limit)
        throw new Error('单项西占事实或问题超过每页提示词容量。');
      lines.push(line);
    }
    if (branchIndex === startAt.branchIndex && pageIndex < startAt.pageIndex)
      throw new Error('西占解读续读页超出当前分段资料。');
    if (lines.length) yield page(true);
  }
}
