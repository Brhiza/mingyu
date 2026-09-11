import { READING_CLASSIC_TABLES, READING_CALCULATION_ROUTES } from './reading-capabilities';
import workflow from '../../../skills/mingyu/references/reading-workflow.json';
import type { ChatMessage, StreamOptions } from './stream-client';
import { verifyReadingAnswer } from './reading-verification';
import type { ReadingSubjectSnapshot } from './reading-subject';
import { FRONTEND_DEFAULT_TIME_ZONE_ID } from '@/lib/time-policy';
import {
  formatZiweiFortuneTimelinePhase,
  formatZiweiPayloadForPrompt,
  formatZiweiTargetLowerScopeFacts,
  type SerializableZiweiResult,
  type ZiweiFortuneTimeline,
  type ZiweiFortuneTimelinePhaseSelection,
} from 'mingyu-core/prompt';

export type ReadingTarget = 'primary' | 'partner';

export type ReadingAction =
  | { kind: 'classic'; method: string; query: string }
  | { kind: 'schema'; method: string }
  | {
      kind: 'calculate';
      method: string;
      target?: ReadingTarget;
      input: Record<string, unknown>;
    };
export type ReadingResource = {
  key: string;
  title: string;
  text: string;
  usable: boolean;
  kind?: 'evidence' | 'schema';
  sourceIds?: string[];
  structured?: Record<string, unknown>;
};
type ZiweiPhaseStatus = 'pending' | 'succeeded' | 'failed' | 'cancelled';
type ZiweiPhaseMemory = {
  resourceKey: string;
  resourceText: string;
  structuredText: string;
  subjectId: string;
  question: string;
  phases: Array<{
    index: number;
    resourceKey: string;
    subjectTitle: string;
    facts: string;
    status: ZiweiPhaseStatus;
    answer?: string;
  }>;
};
export type ReadingMemory = {
  resources: ReadingResource[];
  schemas?: ReadingResource[];
  ziweiPhaseReading?: ZiweiPhaseMemory;
};
export type ReadingMemorySeed = {
  subjectId: string;
  key: string;
  resources: ReadingResource[];
};
export type { ReadingSubjectSnapshot } from './reading-subject';
export type ReadingProgress = {
  stage: 'preparing' | 'consulting' | 'calculating' | 'checking' | 'writing';
  text: string;
};
export interface ReadingDependencies {
  stream: (messages: ChatMessage[], options: StreamOptions) => Promise<void>;
  execute: (
    action: ReadingAction,
    signal?: AbortSignal,
    subject?: ReadingSubjectSnapshot,
  ) => Promise<ReadingResource>;
}
export interface ReadingOptions extends StreamOptions {
  memory: ReadingMemory;
  subject?: ReadingSubjectSnapshot;
  readingMethod?: string;
  onProgress: (progress: ReadingProgress) => void;
  onNotice: (notice: string) => void;
}

const MAX_CONTEXT = 49_000;
const MAX_ACTIONS = 4;
const CALCULATIONS = Object.keys(READING_CALCULATION_ROUTES);

const FRIENDLY_FIELD_NAMES: Record<string, string> = {
  birthDate: '出生日期',
  birthTime: '出生时间',
  birthPlace: '出生地点',
  birthLongitude: '出生经度',
  birthLatitude: '出生纬度',
  timeZone: '时区',
  timeZoneId: '时区名称',
  question: '问题',
  numbers: '起卦数字',
};

function isSchemaResource(resource: ReadingResource): boolean {
  if (resource.kind === 'schema') return true;
  try {
    return JSON.parse(resource.key)?.kind === 'schema';
  } catch {
    return false;
  }
}

function describeReadingFailure(action: ReadingAction, error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const message = raw.replace(
    /\b(birthDate|birthTime|birthPlace|birthLongitude|birthLatitude|timeZone|timeZoneId|question|numbers)\b/g,
    (field) => FRIENDLY_FIELD_NAMES[field] ?? field,
  );
  const target = action.kind === 'classic' ? `“${action.query}”条文` : `${action.method}补充资料`;
  return `${target}未取得：${message}`;
}

const SOURCE_METHODS: Record<ReadingSubjectSnapshot['source'], string[]> = {
  bazi: ['bazi'],
  ziwei: ['ziwei'],
  'bazi-ziwei': ['bazi', 'ziwei'],
  'qimen-lifetime': ['qimen-lifetime'],
  astrolabe: ['astrolabe'],
  qizheng: ['qizheng'],
  bazhai: ['fengshui'],
  taiyi: ['taiyi'],
  huangji: ['huangji'],
  wuyun: ['wuyun'],
};

function resolveReadingMethod(method?: string) {
  const normalized = method?.trim();
  if (!normalized) return undefined;
  if (normalized === 'huangji-jingshi') return 'huangji';
  return Object.hasOwn(workflow.methods, normalized) ? normalized : undefined;
}

export function getReadingGuide(
  text: string,
  subject?: ReadingSubjectSnapshot,
  readingMethod?: string,
) {
  const explicitMethods = subject ? SOURCE_METHODS[subject.source] : undefined;
  const explicitReadingMethod = resolveReadingMethod(readingMethod);
  const hasReadingMethod = Boolean(readingMethod?.trim());
  const methods = explicitMethods?.length
    ? explicitMethods
        .map((method) => workflow.methods[method as keyof typeof workflow.methods])
        .filter((item): item is (typeof workflow.methods)[keyof typeof workflow.methods] =>
          Boolean(item),
        )
    : hasReadingMethod
      ? explicitReadingMethod
        ? [workflow.methods[explicitReadingMethod as keyof typeof workflow.methods]]
        : []
      : Object.entries(workflow.methods)
          .filter(([, item]) => item.match.some((keyword) => text.includes(keyword)))
          .map(([, item]) => item);
  return [
    '【解读方法】',
    ...workflow.principles,
    ...methods.map((item) => `${item.label}：${item.guide}`),
  ].join('\n');
}

export function isTimeReadingFollowup(question: string) {
  return /(?:今年|明年|后年|去年|前年|本年|下年|上年|今日|明天|昨天|后天|前天|现在|当前时间|当前时刻|此刻|本周|下周|上周|本月|下个月|上个月|本季度|下季度|上季度|最近|接下来|\d{4}年|\d{1,2}月|流年|流月|流日|流时|大运|交运|应期|何时|什么时候|哪年|哪月|哪天|时间窗口|期间|近期|未来|过去)/u.test(
    question,
  );
}

function isRelativeTimeReadingFollowup(question: string) {
  return /(?:今年|明年|后年|去年|前年|本年|下年|上年|今日|明天|昨天|后天|前天|现在|当前时间|当前时刻|此刻|本周|下周|上周|本月|下个月|上个月|本季度|下季度|上季度|最近|接下来|流年|流月|流日|流时|大运|交运|应期|何时|什么时候|哪年|哪月|哪天|时间窗口|期间|近期|未来|过去)/u.test(
    question,
  );
}

export function isSimpleReadingFollowup(question: string) {
  const compact = question.replace(/[\s，。！？、,.!?；;：:]+/gu, '').trim();
  if (!compact || isTimeReadingFollowup(compact)) return false;
  return (
    /^(?:请)?(?:把|将)?(?:刚才|刚刚|上面|上一段|上一轮|上次)(?:的)?(?:回答|内容|结论)?(?:解释|总结|概括|说明|展开|换个说法|说简单点|讲清楚)(?:一下)?$/u.test(
      compact,
    ) ||
    /^(?:请)?(?:解释|说明|讲讲|总结|概括|简要说明|再解释|展开讲讲|换句话说|说人话|什么意思)(?:一下)?$/u.test(
      compact,
    ) ||
    /^(?:请)?(?:解释|说明|总结|概括|展开)(?:一下)?(?:这段|这个|上面的内容|刚才的回答)?$/u.test(
      compact,
    ) ||
    /^(?:请)?(?:解释|说明|总结|概括|展开)(?:一下)?(?:刚才|刚刚|上面|上一段|上一轮|上次)(?:的)?(?:回答|内容|结论)?$/u.test(
      compact,
    )
  );
}

export function formatReadingCurrentTime(value = new Date()) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: FRONTEND_DEFAULT_TIME_ZONE_ID,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

export function parseReadingPlan(text: string): ReadingAction[] {
  const clean = text
    .trim()
    .replace(/^```(?:json)?\s*/u, '')
    .replace(/\s*```$/u, '');
  const plan: unknown = JSON.parse(clean);
  if (!plan || typeof plan !== 'object' || !('actions' in plan) || !Array.isArray(plan.actions))
    throw new Error('资料准备结果格式不完整。');
  if (plan.actions.length > MAX_ACTIONS) throw new Error('一次补充资料过多。');
  return plan.actions.map((action: unknown) => {
    if (!action || typeof action !== 'object') throw new Error('资料准备条目不完整。');
    const item = action as Record<string, unknown>;
    if (typeof item.method !== 'string') throw new Error('资料准备缺少方法。');
    if (
      item.kind === 'classic' &&
      Object.hasOwn(READING_CLASSIC_TABLES, item.method) &&
      typeof item.query === 'string' &&
      item.query.trim() &&
      item.query.length <= 80
    )
      return { kind: 'classic', method: item.method, query: item.query.trim() };
    if (CALCULATIONS.includes(item.method as (typeof CALCULATIONS)[number])) {
      if (item.kind === 'schema') return { kind: 'schema', method: item.method };
      if (
        item.kind === 'calculate' &&
        item.input &&
        typeof item.input === 'object' &&
        !Array.isArray(item.input)
      ) {
        if (item.target !== undefined && item.target !== 'primary' && item.target !== 'partner') {
          throw new Error('资料准备的目标主体必须是 primary 或 partner。');
        }
        return {
          kind: 'calculate',
          method: item.method,
          target: item.target === undefined ? 'primary' : item.target,
          input: item.input as Record<string, unknown>,
        };
      }
    }
    throw new Error('资料准备包含暂不支持的操作。');
  });
}

export function fitReadingMessages(messages: ChatMessage[], addition: string): ChatMessage[] {
  const first = messages[0];
  if (!first || first.role !== 'user') throw new Error('请先提供本次排盘资料。');
  const result = [{ ...first, content: `${first.content}\n\n${addition}` }, ...messages.slice(1)];
  const size = () => result.reduce((sum, item) => sum + item.content.length, 0);
  while ((size() > MAX_CONTEXT || result.length > 28) && result.length > 3) {
    // 始终保留原始盘面、最近一问及其上一条解读。
    result.splice(1, Math.min(2, result.length - 3));
  }
  if (size() > MAX_CONTEXT) throw new Error('本次盘面和问题超出解读容量，请缩小运限范围后继续。');
  return result;
}

function formatReadingResources(resources: ReadingResource[]) {
  return resources.map((item) => `${item.title}\n${item.text}`).join('\n\n');
}

function formatCapacityNotice(stage: string, omitted: ReadingResource[]) {
  if (!omitted.length) return '';
  return `\n\n【资料覆盖】${stage}尚未覆盖以下资料，待后续补足：\n${omitted.map((item) => `- ${item.title}`).join('\n')}`;
}

type ResourceSelection = { selected: ReadingResource[]; omitted: ReadingResource[] };

function selectResourcesForMessages(
  messages: ChatMessage[],
  resources: ReadingResource[],
  buildAddition: (selected: ReadingResource[], omitted: ReadingResource[]) => string,
): ResourceSelection {
  const fits = (selected: ReadingResource[], omitted: ReadingResource[]) => {
    try {
      fitReadingMessages(messages, buildAddition(selected, omitted));
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('解读容量')) return false;
      throw error;
    }
  };

  if (fits(resources, [])) return { selected: resources, omitted: [] };

  const selected: ReadingResource[] = [];
  const omitted: ReadingResource[] = [];
  for (const resource of resources) {
    if (fits([...selected, resource], omitted)) selected.push(resource);
    else omitted.push(resource);
  }
  while (!fits(selected, omitted) && selected.length) omitted.push(selected.pop()!);
  return { selected, omitted };
}

function collectResponse(
  messages: ChatMessage[],
  options: ReadingOptions,
  stream: ReadingDependencies['stream'],
) {
  return new Promise<string>((resolve, reject) => {
    let text = '';
    const abort = () => reject(new DOMException('已停止解读', 'AbortError'));
    if (options.signal?.aborted) return abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    const cleanup = () => options.signal?.removeEventListener('abort', abort);
    void stream(messages, {
      signal: options.signal,
      aiConfig: options.aiConfig,
      onChunk: (chunk) => {
        text += chunk;
      },
      onDone: () => {
        cleanup();
        resolve(text);
      },
      onError: (message) => {
        cleanup();
        reject(new Error(message));
      },
    }).catch((error: unknown) => {
      cleanup();
      reject(error);
    });
  });
}

type ZiweiPhaseDraft = {
  selection: ZiweiFortuneTimelinePhaseSelection[];
  includeTargetLower: boolean;
};

type ZiweiPhase = ZiweiPhaseDraft & {
  resourceKey: string;
  subjectTitle: string;
  summaryLabel: string;
  facts: string;
};

type PhaseAnswer = {
  indices: number[];
  labels: string[];
  answer: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getZiweiFullResult(resource: ReadingResource): SerializableZiweiResult | undefined {
  const structured = resource.structured;
  if (!structured || structured.fortuneTimeline === undefined) return undefined;
  const timeline = structured.fortuneTimeline;
  const payloadByScope = structured.payloadByScope;
  if (
    !isRecord(timeline) ||
    timeline.scope !== 'all' ||
    !Array.isArray(timeline.periods) ||
    !timeline.periods.length ||
    !isRecord(payloadByScope) ||
    ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly'].some(
      (scope) => !isRecord(payloadByScope[scope]),
    )
  )
    return undefined;
  if (
    timeline.periods.some(
      (period: unknown) =>
        !isRecord(period) || !Array.isArray(period.years) || !period.years.length,
    )
  )
    return undefined;
  return structured as unknown as SerializableZiweiResult;
}

function getZiweiTargetYearIndex(timeline: ZiweiFortuneTimeline) {
  const periodIndex = timeline.selectedPeriodIndex;
  const period = timeline.periods[periodIndex];
  if (!period) throw new Error('紫微完整运限资料缺少目标大限。');
  const yearIndex = period.years.findIndex(
    (year) =>
      year.age === timeline.targetAge &&
      year.dateStr <= timeline.targetDateStr &&
      (year.endDateStr ?? year.dateStr) >= timeline.targetDateStr,
  );
  if (yearIndex < 0) throw new Error('紫微完整运限资料缺少目标流年。');
  return { periodIndex, yearIndex };
}

function formatZiweiPhaseFacts(
  result: SerializableZiweiResult,
  draft: ZiweiPhaseDraft,
  phaseNumber: number,
  phaseCount: number,
  resourceTitle: string,
) {
  const timeline = result.fortuneTimeline;
  if (!timeline) throw new Error('紫微完整资料缺少运限时间线。');
  const origin = result.payloadByScope.origin;
  if (!origin) throw new Error('紫微完整资料缺少本命资料。');
  const algorithmText =
    (origin.calculation_config?.algorithm ?? result.calculationConfig.algorithm) === 'zhongzhou'
      ? '安星口径：中州派安星法'
      : '安星口径：传统通行安星法';
  const originText = formatZiweiPayloadForPrompt(origin, { includeBasicInfo: true });
  const timelineText = formatZiweiFortuneTimelinePhase(
    timeline,
    draft.selection,
    phaseNumber,
    phaseCount,
  );
  const lowerText = draft.includeTargetLower ? formatZiweiTargetLowerScopeFacts(result) : '';
  return [
    `主体：${resourceTitle}`,
    algorithmText,
    `本命资料：\n${originText}`,
    timelineText,
    lowerText,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildZiweiPhaseAddition(
  guide: string,
  currentTimeContext: string,
  facts: string,
  supplementalText: string,
) {
  return `${guide}${currentTimeContext}\n\n【紫微完整资料阶段】\n${facts}${
    supplementalText ? `\n\n【其他已取得资料】\n${supplementalText}` : ''
  }\n\n【阶段解读】依据本阶段盘面分析，保留阶段编号、日期与运限边界，给出本阶段结论及其适用条件。`;
}

function buildZiweiPhasePlan(
  messages: ChatMessage[],
  result: SerializableZiweiResult,
  resourceKey: string,
  resourceTitle: string,
  guide: string,
  currentTimeContext: string,
  supplementalText: string,
): ZiweiPhase[] {
  const timeline = result.fortuneTimeline;
  if (!timeline) throw new Error('紫微完整资料缺少运限时间线。');
  const target = getZiweiTargetYearIndex(timeline);
  const drafts: ZiweiPhaseDraft[] = [];
  const fits = (draft: ZiweiPhaseDraft) => {
    const facts = formatZiweiPhaseFacts(result, draft, 9999, 9999, resourceTitle);
    try {
      fitReadingMessages(
        messages,
        buildZiweiPhaseAddition(guide, currentTimeContext, facts, supplementalText),
      );
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('解读容量')) return false;
      throw error;
    }
  };

  for (let periodIndex = 0; periodIndex < timeline.periods.length; periodIndex += 1) {
    const period = timeline.periods[periodIndex]!;
    const wholePeriod: ZiweiPhaseDraft = {
      selection: [
        {
          periodIndex,
          startYearIndex: 0,
          endYearIndex: period.years.length - 1,
        },
      ],
      includeTargetLower: periodIndex === target.periodIndex,
    };
    if (fits(wholePeriod)) {
      drafts.push(wholePeriod);
      continue;
    }

    let startYearIndex = 0;
    while (startYearIndex < period.years.length) {
      let endYearIndex = -1;
      for (
        let candidateEnd = startYearIndex;
        candidateEnd < period.years.length;
        candidateEnd += 1
      ) {
        const candidate: ZiweiPhaseDraft = {
          selection: [{ periodIndex, startYearIndex, endYearIndex: candidateEnd }],
          includeTargetLower:
            periodIndex === target.periodIndex &&
            target.yearIndex >= startYearIndex &&
            target.yearIndex <= candidateEnd,
        };
        if (!fits(candidate)) break;
        endYearIndex = candidateEnd;
      }
      if (endYearIndex < startYearIndex) {
        throw new Error(`紫微完整资料的第${periodIndex + 1}个大限仍超出单阶段容量。`);
      }
      drafts.push({
        selection: [{ periodIndex, startYearIndex, endYearIndex }],
        includeTargetLower:
          periodIndex === target.periodIndex &&
          target.yearIndex >= startYearIndex &&
          target.yearIndex <= endYearIndex,
      });
      startYearIndex = endYearIndex + 1;
    }
  }

  const packedDrafts: ZiweiPhaseDraft[] = [];
  for (const draft of drafts) {
    const previous = packedDrafts.at(-1);
    const combined = previous
      ? {
          selection: [...previous.selection, ...draft.selection],
          includeTargetLower: previous.includeTargetLower || draft.includeTargetLower,
        }
      : undefined;
    if (combined && fits(combined)) packedDrafts[packedDrafts.length - 1] = combined;
    else packedDrafts.push(draft);
  }
  const phases = packedDrafts.map((draft, index) => ({
    ...draft,
    resourceKey,
    subjectTitle: resourceTitle,
    summaryLabel: `主体：${resourceTitle}｜阶段${index + 1}/${packedDrafts.length}`,
    facts: formatZiweiPhaseFacts(result, draft, index + 1, packedDrafts.length, resourceTitle),
  }));
  for (const phase of phases) {
    fitReadingMessages(
      messages,
      buildZiweiPhaseAddition(guide, currentTimeContext, phase.facts, supplementalText),
    );
  }
  return phases;
}

function buildPhaseSummaryAddition(
  guide: string,
  currentTimeContext: string,
  entries: readonly PhaseAnswer[],
  phaseCount: number,
  intermediate: boolean,
) {
  const covered = [...new Set(entries.flatMap((entry) => entry.indices))].sort((a, b) => a - b);
  const facts = entries
    .map((entry) => `【${entry.labels.join('；')}分析】\n${entry.answer}`)
    .join('\n\n');
  return `${guide}${currentTimeContext}\n\n【阶段覆盖核对】已纳入阶段：${covered
    .map((index) => `${index + 1}/${phaseCount}`)
    .join('、')}；阶段资料必须全部参与当前${intermediate ? '归并' : '汇总'}。\n\n${
    intermediate
      ? '【阶段归并】请保留每个阶段编号、日期和事实边界，依据各阶段已列事实归并分析。'
      : '【最终解读】请综合已完成的全部阶段分析回答本轮问题；结论必须能追溯到阶段编号和日期范围。'
  }\n\n${facts}`;
}

function assertPhaseCoverage(entries: readonly PhaseAnswer[], phaseCount: number) {
  for (const entry of entries) {
    if (!entry.answer.trim()) {
      throw new Error(
        `紫微阶段${entry.indices.map((index) => `${index + 1}/${phaseCount}`).join('、')}返回空结果，请重试。`,
      );
    }
  }
  const covered = new Set(entries.flatMap((entry) => entry.indices));
  for (let index = 0; index < phaseCount; index += 1) {
    if (!covered.has(index)) throw new Error(`紫微阶段${index + 1}/${phaseCount}未参与汇总。`);
  }
}

function requirePhaseAnswer(answer: string, label: string) {
  if (!answer.trim()) throw new Error(`${label}返回空结果，请重试。`);
  return answer;
}

function assertPhaseIndices(entries: readonly PhaseAnswer[], phaseCount: number) {
  for (const index of entries.flatMap((entry) => entry.indices)) {
    if (!Number.isInteger(index) || index < 0 || index >= phaseCount) {
      throw new Error(`紫微阶段编号${index + 1}超出当前阶段范围。`);
    }
  }
}

function packPhaseAnswers(
  messages: ChatMessage[],
  entries: readonly PhaseAnswer[],
  guide: string,
  currentTimeContext: string,
  phaseCount: number,
) {
  const groups: PhaseAnswer[][] = [];
  let current: PhaseAnswer[] = [];
  for (const entry of entries) {
    const candidate = [...current, entry];
    try {
      fitReadingMessages(
        messages,
        buildPhaseSummaryAddition(guide, currentTimeContext, candidate, phaseCount, false),
      );
      current = candidate;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('解读容量')) throw error;
      if (!current.length)
        throw new Error(`紫微阶段${entry.indices[0]! + 1}/${phaseCount}的分析结果超出汇总容量。`, {
          cause: error,
        });
      groups.push(current);
      current = [entry];
    }
  }
  if (current.length) groups.push(current);
  return groups;
}

async function collectZiweiPhaseSummary(
  messages: ChatMessage[],
  phases: readonly ZiweiPhase[],
  options: ReadingOptions,
  deps: ReadingDependencies,
  guide: string,
  currentTimeContext: string,
  supplementalText: string,
) {
  const entries: PhaseAnswer[] = Array.from({ length: phases.length }, (_, index) => ({
    indices: [index],
    labels: [phases[index]!.summaryLabel],
    answer: '',
  }));
  const cached = options.memory.ziweiPhaseReading;
  for (let index = 0; index < phases.length; index += 1) {
    const phase = phases[index]!;
    const record = cached?.phases[index];
    if (
      record?.status === 'succeeded' &&
      record.resourceKey === phase.resourceKey &&
      record.subjectTitle === phase.subjectTitle &&
      record.facts === phase.facts &&
      record.answer?.trim()
    ) {
      entries[index]!.answer = record.answer;
      continue;
    }
    const prepared = fitReadingMessages(
      messages,
      buildZiweiPhaseAddition(guide, currentTimeContext, phase.facts, supplementalText),
    );
    options.onProgress({
      stage: 'writing',
      text: `正在分析${phase.subjectTitle} ${phase.summaryLabel.split('｜').at(-1)}`,
    });
    if (cached) {
      cached.phases[index] = {
        index,
        resourceKey: phase.resourceKey,
        subjectTitle: phase.subjectTitle,
        facts: phase.facts,
        status: 'pending',
      };
    }
    try {
      const answer = requirePhaseAnswer(
        await collectResponse(prepared, options, deps.stream),
        `紫微阶段${index + 1}/${phases.length}`,
      );
      entries[index]!.answer = answer;
      if (cached)
        cached.phases[index] = {
          index,
          resourceKey: phase.resourceKey,
          subjectTitle: phase.subjectTitle,
          facts: phase.facts,
          status: 'succeeded',
          answer,
        };
    } catch (error) {
      if (cached) {
        cached.phases[index] = {
          index,
          resourceKey: phase.resourceKey,
          subjectTitle: phase.subjectTitle,
          facts: phase.facts,
          status: options.signal?.aborted ? 'cancelled' : 'failed',
        };
      }
      throw error;
    }
  }
  assertPhaseCoverage(entries, phases.length);

  let currentEntries = entries;
  let reductionRound = 0;
  while (true) {
    const groups = packPhaseAnswers(
      messages,
      currentEntries,
      guide,
      currentTimeContext,
      phases.length,
    );
    if (groups.length === 1) {
      assertPhaseCoverage(groups[0]!, phases.length);
      const addition = buildPhaseSummaryAddition(
        guide,
        currentTimeContext,
        groups[0]!,
        phases.length,
        false,
      );
      return fitReadingMessages(messages, addition);
    }
    reductionRound += 1;
    if (reductionRound > 8) throw new Error('紫微阶段汇总超过可控归并层数，请重试。');
    const nextEntries: PhaseAnswer[] = [];
    for (const group of groups) {
      assertPhaseIndices(group, phases.length);
      const prepared = fitReadingMessages(
        messages,
        buildPhaseSummaryAddition(guide, currentTimeContext, group, phases.length, true),
      );
      const answer = await collectResponse(prepared, options, deps.stream);
      requirePhaseAnswer(
        answer,
        `紫微阶段归并（${group.map((entry) => entry.indices.map((index) => index + 1).join('、')).join('、')}）`,
      );
      nextEntries.push({
        indices: [...new Set(group.flatMap((entry) => entry.indices))].sort((a, b) => a - b),
        labels: [...new Set(group.flatMap((entry) => entry.labels))],
        answer,
      });
    }
    assertPhaseCoverage(nextEntries, phases.length);
    currentEntries = nextEntries;
  }
}

async function runZiweiPhasedReading(
  messages: ChatMessage[],
  options: ReadingOptions,
  deps: ReadingDependencies,
  fullResources: readonly {
    resource: ReadingResource;
    result: SerializableZiweiResult;
  }[],
  supplementalResources: ReadingResource[],
  guide: string,
  currentTimeContext: string,
  question: string,
) {
  if (!fullResources.length) throw new Error('紫微完整资料缺少主体。');
  const supplementalText = formatReadingResources(supplementalResources);
  const phases = fullResources.flatMap(({ resource, result }) =>
    buildZiweiPhasePlan(
      messages,
      result,
      resource.key,
      resource.title,
      guide,
      currentTimeContext,
      supplementalText,
    ),
  );
  const resourceKey = fullResources
    .map(({ resource }) => `${resource.key}:${resource.title}`)
    .join('\u0000');
  const resourceText = [
    ...fullResources.map(({ resource }) => `${resource.title}\n${resource.text}`),
    supplementalText,
  ].join('\u0000');
  const structuredText = fullResources
    .map(({ resource }) => JSON.stringify(resource.structured) ?? '')
    .join('\u0000');
  const previous = options.memory.ziweiPhaseReading;
  const reusable =
    previous?.resourceKey === resourceKey &&
    previous.resourceText === resourceText &&
    previous.structuredText === structuredText &&
    previous.subjectId === (options.subject?.id ?? '') &&
    previous.question === question &&
    previous.phases.length === phases.length;
  const phaseMemory: ZiweiPhaseMemory = reusable
    ? previous!
    : {
        resourceKey,
        resourceText,
        structuredText,
        subjectId: options.subject?.id ?? '',
        question,
        phases: phases.map((phase, index) => ({
          index,
          resourceKey: phase.resourceKey,
          subjectTitle: phase.subjectTitle,
          facts: phase.facts,
          status: 'pending',
        })),
      };
  if (reusable) {
    phaseMemory.phases = phases.map((phase, index) => {
      const old = previous!.phases[index];
      return old?.resourceKey === phase.resourceKey &&
        old.subjectTitle === phase.subjectTitle &&
        old.facts === phase.facts
        ? old
        : {
            index,
            resourceKey: phase.resourceKey,
            subjectTitle: phase.subjectTitle,
            facts: phase.facts,
            status: 'pending' as const,
          };
    });
  }
  options.memory.ziweiPhaseReading = phaseMemory;
  const finalMessages = await collectZiweiPhaseSummary(
    messages,
    phases,
    options,
    deps,
    guide,
    currentTimeContext,
    supplementalText,
  );
  if (finalMessages.length < messages.length)
    options.onNotice('对话较长，本轮保留原始盘面与最近的问答。');
  options.onProgress({ stage: 'writing', text: '正在综合全部紫微阶段解读' });
  let answer = '';
  await deps.stream(finalMessages, {
    ...options,
    onChunk: (chunk) => {
      answer += chunk;
      options.onChunk(chunk);
    },
    onDone: () => {
      if (!answer.trim()) {
        options.onError('紫微最终汇总返回空结果，请重试。');
        return;
      }
      options.onProgress({ stage: 'checking', text: '正在核对关键事实' });
      for (const issue of verifyReadingAnswer(messages[0]!.content, answer, [
        ...fullResources.map(({ resource }) => resource),
        ...supplementalResources,
      ]))
        options.onNotice(`回答中有一处需要核对：${issue}`);
      options.onDone();
    },
  });
}

export async function runReadingWorkflow(
  messages: ChatMessage[],
  options: ReadingOptions,
  deps: ReadingDependencies,
) {
  const guard = () => {
    if (options.signal?.aborted) throw new DOMException('已停止解读', 'AbortError');
  };
  const guide = getReadingGuide(messages[0]?.content ?? '', options.subject, options.readingMethod);
  const explicitReadingMethod = resolveReadingMethod(options.readingMethod);
  const latestUserQuestion =
    [...messages].reverse().find((message) => message.role === 'user')?.content ?? '';
  const hasPreviousAnswer = messages.some((message) => message.role === 'assistant');
  const isTimeFollowup = hasPreviousAnswer && isTimeReadingFollowup(latestUserQuestion);
  const isSimpleFollowup =
    hasPreviousAnswer && !isTimeFollowup && isSimpleReadingFollowup(latestUserQuestion);
  const currentTimeContext =
    isTimeFollowup && isRelativeTimeReadingFollowup(latestUserQuestion)
      ? `\n\n【本轮当前时间】${formatReadingCurrentTime()}；相对日期以本轮当前时间换算，用户明确指定的年月日作为目标时段。`
      : '';
  const storedResources = [...options.memory.resources];
  const schemaResources = [
    ...(options.memory.schemas ?? []),
    ...storedResources.filter(isSchemaResource),
  ];
  const subjectMethods = options.subject
    ? new Set([
        ...(SOURCE_METHODS[options.subject.source] ?? []),
        ...options.subject.allowedMethods,
        ...(options.subject.source === 'qizheng' ? ['qi-zheng'] : []),
      ])
    : options.readingMethod?.trim()
      ? new Set(explicitReadingMethod ? [explicitReadingMethod] : [])
      : undefined;
  const mismatchedMethodNotice = options.subject
    ? '已跳过与当前命盘类型不符的补充资料。'
    : '已跳过与当前术式不符的补充资料。';
  const resources = storedResources.filter((item) => !isSchemaResource(item) && item.usable);
  const persistResources = () => {
    options.memory.resources = [...resources];
    options.memory.schemas = [...schemaResources];
  };
  const seen = new Set([...resources, ...schemaResources].map((item) => item.key));
  const notes: string[] = [];
  const retryFailures = new Map<string, string>();
  let calls = 0;
  let planningRepairHint = '';
  const hasStoredFullZiwei = resources.some((resource) => Boolean(getZiweiFullResult(resource)));
  options.onProgress({ stage: 'preparing', text: '正在梳理问题与盘面' });
  const schemaKeyForMethod = (method: string) => JSON.stringify({ kind: 'schema', method });
  const getCalculationTargetInput = (action: Extract<ReadingAction, { kind: 'calculate' }>) => {
    const sortedInput = () =>
      Object.fromEntries(
        Object.entries(action.input).sort(([left], [right]) => left.localeCompare(right)),
      );
    const schema = schemaResources.find((item) => item.key === schemaKeyForMethod(action.method));
    if (!schema) return sortedInput();
    try {
      const parsed: unknown = JSON.parse(schema.text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return sortedInput();
      const properties = (parsed as Record<string, unknown>).properties;
      if (!properties || typeof properties !== 'object' || Array.isArray(properties))
        return sortedInput();
      return Object.fromEntries(
        Object.entries(action.input)
          .filter(([field]) => Object.hasOwn(properties, field))
          .sort(([left], [right]) => left.localeCompare(right)),
      );
    } catch {
      return sortedInput();
    }
  };
  const retryFailureKey = (key: string, action: ReadingAction) =>
    action.kind === 'calculate'
      ? JSON.stringify({
          kind: action.kind,
          method: action.method,
          target: action.target ?? 'primary',
          input: getCalculationTargetInput(action),
        })
      : key;
  const rememberRetryFailure = (key: string, action: ReadingAction, error: unknown) => {
    const note = describeReadingFailure(action, error);
    retryFailures.set(retryFailureKey(key, action), note);
  };
  const clearRetryFailure = (key: string, action: ReadingAction) => {
    retryFailures.delete(retryFailureKey(key, action));
  };
  const formatRetryFailures = () =>
    retryFailures.size
      ? `\n\n【上轮补算反馈】\n${[...retryFailures.values()].map((note) => `- ${note}`).join('\n')}\n`
      : '';
  const hasSchemaForMethod = (method: string) =>
    schemaResources.some((item) => item.key === schemaKeyForMethod(method));
  const loadSchema = async (method: string) => {
    if (hasSchemaForMethod(method)) return true;
    if (calls >= MAX_ACTIONS) return false;
    const key = schemaKeyForMethod(method);
    const schemaAction: ReadingAction = { kind: 'schema', method };
    calls += 1;
    seen.add(key);
    options.onProgress({ stage: 'consulting', text: '正在读取补算参数' });
    try {
      const resource = await deps.execute(schemaAction, options.signal, options.subject);
      clearRetryFailure(key, schemaAction);
      schemaResources.push({ ...resource, key, kind: 'schema' });
      persistResources();
      guard();
      return true;
    } catch (error) {
      guard();
      seen.delete(key);
      rememberRetryFailure(key, schemaAction, error);
      options.onNotice('补算参数暂未取得，将依据已有资料继续解读。');
      return false;
    }
  };
  const prefetchSubjectSchemas = async () => {
    if (!subjectMethods) return;
    for (const method of subjectMethods) {
      if (!CALCULATIONS.includes(method as (typeof CALCULATIONS)[number])) continue;
      if (calls >= MAX_ACTIONS) break;
      await loadSchema(method);
    }
  };
  try {
    for (let round = 0; round < (isSimpleFollowup || hasStoredFullZiwei ? 0 : 2); round += 1) {
      let needsRefinement = false;
      guard();
      const catalog = `${planningRepairHint}${formatRetryFailures()}【当前任务：准备解读资料】${currentTimeContext}\n请依据本次问题判断哪些额外资料能改变判断。输出一个JSON对象 {"actions":[]}，资料充足时使用空数组。每次最多4项。排盘类优先补齐当前阶段、所属上层运限和问题涉及的目标时段；占卜类优先保留本次起盘已有的时间、动变、牌阵或签谱事实。只有传统条文能改变取义时才查询。可选动作：\n1. {"kind":"schema","method":"${CALCULATIONS.join('或')}"}，查看补算参数。\n2. {"kind":"calculate","method":"方法编号","target":"primary","input":{}}（或使用 target:"partner"），按已读取的参数格式补算。双人解读时用 target 指定对象；primary 对应第一人，partner 对应第二人，两人分别填写各自的目标时段。参数取自用户明确提供的出生资料、地点、历法和目标时段，保持原盘的主体与计算口径；必要输入缺失时直接进入已有资料解读并指出具体缺项。partner 补算以本次已提供的第二人出生资料为依据。原始卦、课、牌、签沿用本次结果。\n3. {"kind":"classic","method":"方法编号","query":"具体星曜、日主月令、格局或卦名"}，查阅传统条文。方法编号：${Object.keys(READING_CLASSIC_TABLES).join('、')}。\n本轮仅完成资料选择，解读正文将在下一步生成。`;
      const schemas = schemaResources.length
        ? `\n\n【补算参数】\n${schemaResources.map((item) => `${item.title}\n${item.text}`).join('\n\n')}`
        : '';
      const planningMessages = [...messages, { role: 'user' as const, content: catalog }];
      const planningSelection = selectResourcesForMessages(
        planningMessages,
        resources,
        (selected, omitted) =>
          `${guide}${currentTimeContext}${schemas}${formatCapacityNotice('资料准备', omitted)}\n\n${formatReadingResources(selected)}`,
      );
      const prepared = fitReadingMessages(
        planningMessages,
        `${guide}${currentTimeContext}${schemas}${formatCapacityNotice('资料准备', planningSelection.omitted)}\n\n${formatReadingResources(planningSelection.selected)}`,
      );
      let actions: ReadingAction[];
      try {
        actions = parseReadingPlan(await collectResponse(prepared, options, deps.stream));
      } catch (error) {
        guard();
        // 格式问题在现有准备轮次内补充结构提示；网络、限流等请求失败交由用户重试。
        if (
          error instanceof SyntaxError ||
          (error instanceof Error && /资料准备|一次补充/u.test(error.message))
        ) {
          planningRepairHint =
            '\n【资料准备修正】上一次返回未形成可执行资料动作。请输出可解析的 JSON 对象，顶层包含 actions 数组；动作使用 schema、calculate 或 classic 的既定字段，并保留目标主体与目标时段。\n';
          await prefetchSubjectSchemas();
          if (round + 1 < 2) continue;
          notes.push(
            '本轮资料准备未取得可执行的补充动作，解读应依据当前已有盘面与已取得资料完成。',
          );
          options.onNotice('本次自动补查未完成，解读将使用已有盘面与解读方法。');
          break;
        }
        throw error;
      }
      if (!actions.length) break;
      for (const action of actions) {
        guard();
        if (calls >= MAX_ACTIONS) break;
        const key =
          action.kind === 'calculate'
            ? JSON.stringify({ ...action, target: action.target ?? 'primary' })
            : JSON.stringify(action);
        if (seen.has(key)) continue;
        if (subjectMethods && !subjectMethods.has(action.method)) {
          options.onNotice(mismatchedMethodNotice);
          continue;
        }
        if (action.kind === 'calculate' && !options.subject) {
          notes.push('当前会话缺少主体快照，无法安全补算目标时段；请重新开始解读。');
          options.onNotice('当前对话缺少主体快照，已跳过自动补算。');
          continue;
        }
        if (
          action.kind === 'calculate' &&
          action.target === 'partner' &&
          !options.subject?.lockedInputs[`${action.method}Partner`]
        ) {
          notes.push('当前会话没有第二人主体快照，无法安全补算伴侣目标时段。');
          options.onNotice('当前会话没有第二人主体快照，已跳过伴侣补算。');
          continue;
        }
        if (action.kind === 'calculate' && !hasSchemaForMethod(action.method)) {
          const canRetrySchema = calls < MAX_ACTIONS;
          const schemaLoaded = await loadSchema(action.method);
          if (schemaLoaded || canRetrySchema) needsRefinement = true;
          continue;
        }
        calls += 1;
        seen.add(key);
        options.onProgress({
          stage: action.kind === 'calculate' ? 'calculating' : 'consulting',
          text: action.kind === 'calculate' ? '正在补充目标时段的盘面' : '正在查阅相关资料',
        });
        try {
          const resource = await deps.execute(action, options.signal, options.subject);
          if (action.kind === 'schema') {
            clearRetryFailure(key, action);
            schemaResources.push({ ...resource, key, kind: 'schema' });
            persistResources();
            guard();
            continue;
          }
          if (action.kind === 'classic' && !resource.usable) {
            seen.delete(key);
            guard();
            needsRefinement = true;
            rememberRetryFailure(key, action, new Error('未命中'));
            options.onNotice(`“${action.query}”未查到对应条文，已保留原有盘面资料。`);
            continue;
          }
          clearRetryFailure(key, action);
          resources.push({ ...resource, key, kind: 'evidence' });
          persistResources();
          guard();
        } catch (error) {
          seen.delete(key);
          guard();
          rememberRetryFailure(key, action, error);
          needsRefinement = true;
          options.onNotice('部分补充资料暂未取得，将依据已有资料继续解读。');
        }
      }
      if (calls >= MAX_ACTIONS) break;
      if (round === 0 && !needsRefinement && actions.every((action) => action.kind !== 'schema'))
        break;
    }
    guard();
    persistResources();
    const finalResources = resources.filter((item) => item.usable);
    const getFinalStatusNotes = (omitted: ReadingResource[]) => {
      const capacityNote = formatCapacityNotice('本轮解读', omitted).trim();
      return [...notes, ...retryFailures.values(), ...(capacityNote ? [capacityNote] : [])];
    };
    const buildFinalAddition = (
      selected: ReadingResource[],
      omitted: ReadingResource[],
      statusNotes = getFinalStatusNotes(omitted),
    ) => {
      const status = statusNotes.length
        ? `\n\n【资料状态】\n${statusNotes.map((note) => `- ${note}`).join('\n')}${
            omitted.length || statusNotes.some((note) => note.includes('【资料覆盖】'))
              ? '\n已纳入资料可用于完成判断，未纳入资料保留供后续阶段。'
              : '\n已取得的完整盘面与补充资料仍可用于完成判断。'
          }`
        : '';
      const material = formatReadingResources(selected);
      return `${guide}${currentTimeContext}${material ? `\n\n【补充资料】\n${material}` : ''}${status}\n\n【本轮解读】\n${isSimpleFollowup ? '请结合当前盘面、已有补充资料和上一轮解读直接回答用户的追问，保持原盘主体与计算口径，说明判断依据和适用条件。' : '请完整回答用户最近的问题，将已知盘面与查得传统条文结合具体情境推导。'}先说明主要判断，再展开支持依据、变化条件与关键时段。对影响当前结论的缺项，具体说明所需资料，同时完成已知部分。`;
    };
    const finalSelection = selectResourcesForMessages(messages, finalResources, buildFinalAddition);
    const ziweiFullResources = finalResources.flatMap((resource) => {
      const result = getZiweiFullResult(resource);
      return result ? [{ resource, result }] : [];
    });
    const ziweiFullResourceSet = new Set(ziweiFullResources.map(({ resource }) => resource));
    const omittedZiweiFullResources = finalSelection.omitted.filter((resource) =>
      ziweiFullResourceSet.has(resource),
    );
    if (omittedZiweiFullResources.length && ziweiFullResources.length) {
      await runZiweiPhasedReading(
        messages,
        options,
        deps,
        ziweiFullResources,
        finalResources.filter((resource) => !ziweiFullResourceSet.has(resource)),
        guide,
        currentTimeContext,
        latestUserQuestion,
      );
      return;
    }
    const finalStatusNotes = getFinalStatusNotes(finalSelection.omitted);
    if (finalSelection.omitted.length) {
      options.onNotice(
        `本轮解读资料容量不足，以下范围未纳入本轮判断：${finalSelection.omitted
          .map((item) => item.title)
          .join('、')}。`,
      );
    }
    const finalMessages = fitReadingMessages(
      messages,
      buildFinalAddition(finalSelection.selected, [], finalStatusNotes),
    );
    if (finalMessages.length < messages.length)
      options.onNotice('对话较长，本轮保留原始盘面与最近的问答。');
    options.onProgress({ stage: 'writing', text: '正在综合资料解读' });
    let answer = '';
    await deps.stream(finalMessages, {
      ...options,
      onChunk: (chunk) => {
        answer += chunk;
        options.onChunk(chunk);
      },
      onDone: () => {
        options.onProgress({ stage: 'checking', text: '正在核对关键事实' });
        for (const issue of verifyReadingAnswer(messages[0].content, answer, resources))
          options.onNotice(`回答中有一处需要核对：${issue}`);
        options.onDone();
      },
    });
  } catch (error) {
    if (options.signal?.aborted) return;
    options.onError(error instanceof Error ? error.message : '解读准备失败，请重试。');
  }
}
