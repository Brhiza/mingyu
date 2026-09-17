import type {
  AstrolabeDynamicRangeBranch,
  AstrolabeDynamicRangeSummary,
} from 'mingyu-core/divination/astrolabe-dynamic-range';
import { formatAstrolabeBirthRangeInterval } from '../astrolabe-birth-range-prompt';
import {
  iterateAstrolabeDynamicPromptPages,
  type AstrolabeDynamicPromptCursor,
  type AstrolabeDynamicPromptOptions,
} from '../astrolabe-dynamic-range-prompt';
import type { ChatMessage, StreamOptions } from './stream-client';

export type AstrolabeDynamicReadingSource = {
  key: string;
  subjectId: string;
  summary: AstrolabeDynamicRangeSummary;
  promptOptions?: AstrolabeDynamicPromptOptions;
  readBranch: (index: number) => Promise<AstrolabeDynamicRangeBranch>;
};

/** 可随会话保存；原始盘面仍由对应主体的本地分段资料提供。 */
export type AstrolabeDynamicReadingCheckpoint = {
  version: 1;
  identity: string;
  stage: 'pages' | 'summary' | 'complete';
  cursor: AstrolabeDynamicPromptCursor | null;
  completedPages: number;
  completedBranches: number;
  synopsis: string;
  question: string;
};

type RoundOptions = Pick<StreamOptions, 'signal' | 'aiConfig' | 'onChunk'> & {
  question: string;
  onProgress: (text: string) => void;
};
type Stream = (messages: ChatMessage[], options: StreamOptions) => Promise<void>;
const PAGE_CHARACTERS = 6000;
const SUMMARY_CHARACTERS = 8000;
const ANSWER_CHARACTERS = 12000;

export function isAstrolabeDynamicReadingCheckpoint(
  value: unknown,
): value is AstrolabeDynamicReadingCheckpoint {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<AstrolabeDynamicReadingCheckpoint>;
  if (
    item.version !== 1 ||
    typeof item.identity !== 'string' ||
    !item.identity ||
    !['pages', 'summary', 'complete'].includes(item.stage ?? '') ||
    !Number.isSafeInteger(item.completedPages) ||
    item.completedPages! < 0 ||
    !Number.isSafeInteger(item.completedBranches) ||
    item.completedBranches! < 0 ||
    typeof item.synopsis !== 'string' ||
    typeof item.question !== 'string' ||
    item.synopsis.length > SUMMARY_CHARACTERS ||
    (item.completedPages! > 0 && !item.synopsis.trim())
  )
    return false;
  if (item.stage !== 'pages') return item.cursor === null && item.completedPages! > 0;
  const cursor = item.cursor;
  return Boolean(
    cursor &&
    Number.isSafeInteger(cursor.branchIndex) &&
    cursor.branchIndex === item.completedBranches &&
    Number.isSafeInteger(cursor.pageIndex) &&
    cursor.pageIndex >= 0 &&
    Number.isSafeInteger(cursor.branchStartTimestamp) &&
    cursor.branchStartTimestamp % 1000 === 0,
  );
}

async function collect(
  text: string,
  limit: number,
  emit: boolean,
  options: RoundOptions,
  stream: Stream,
) {
  if (text.length > 40000) throw new Error('本轮解读资料超过容量，请缩短补充问题后重试。');
  options.signal?.throwIfAborted();
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  let result = '';
  let completed = false;
  let failure = '';
  try {
    await stream([{ role: 'user', content: text }], {
      aiConfig: options.aiConfig,
      signal: controller.signal,
      onChunk(chunk) {
        if (failure || controller.signal.aborted) return;
        if (result.length + chunk.length > limit) {
          failure = '本轮解读内容超过容量，本页进度尚未推进，请重试。';
          controller.abort();
          return;
        }
        result += chunk;
        if (emit) options.onChunk(chunk);
      },
      onDone() {
        completed = true;
      },
      onError(message) {
        failure = message;
      },
    });
    options.signal?.throwIfAborted();
    if (failure) throw new Error(failure);
    if (!completed || !result.trim()) throw new Error('本轮解读尚未完整返回，本页进度未推进。');
    return result.trim();
  } finally {
    options.signal?.removeEventListener('abort', abort);
    controller.abort();
  }
}

/** 一次调用只解读一页，或在全部页完成后生成总述。失败时调用方保留原检查点。 */
export async function runAstrolabeDynamicReadingRound(
  source: AstrolabeDynamicReadingSource,
  previous: AstrolabeDynamicReadingCheckpoint | undefined,
  options: RoundOptions,
  stream: Stream,
): Promise<AstrolabeDynamicReadingCheckpoint> {
  const identity = JSON.stringify([
    source.key,
    source.subjectId,
    source.summary,
    source.promptOptions ?? {},
  ]);
  if (!source.key || !source.subjectId) throw new Error('动态区间解读缺少锁定主体。');
  if (previous && (previous.version !== 1 || previous.identity !== identity))
    throw new Error('动态区间解读进度与当前主体、范围或问题不匹配，请切换回原资料后继续。');
  const checkpoint: AstrolabeDynamicReadingCheckpoint = previous ?? {
    version: 1,
    identity,
    stage: 'pages',
    cursor: {
      branchIndex: 0,
      pageIndex: 0,
      branchStartTimestamp: source.summary.source.startTimestamp,
    },
    completedPages: 0,
    completedBranches: 0,
    synopsis: '',
    question: options.question,
  };
  if (
    !isAstrolabeDynamicReadingCheckpoint(checkpoint) ||
    !['pages', 'summary', 'complete'].includes(checkpoint.stage) ||
    !Number.isSafeInteger(checkpoint.completedPages) ||
    checkpoint.completedPages < 0 ||
    !Number.isSafeInteger(checkpoint.completedBranches) ||
    checkpoint.completedBranches < 0 ||
    checkpoint.completedBranches > source.summary.branchCount ||
    typeof checkpoint.synopsis !== 'string' ||
    checkpoint.synopsis.length > SUMMARY_CHARACTERS ||
    (checkpoint.stage === 'pages'
      ? !checkpoint.cursor || checkpoint.cursor.branchIndex !== checkpoint.completedBranches
      : checkpoint.cursor !== null ||
        checkpoint.completedBranches !== source.summary.branchCount ||
        checkpoint.completedPages < 1)
  )
    throw new Error('动态区间解读进度不完整，请重新开始解读。');
  options.signal?.throwIfAborted();
  const interval = formatAstrolabeBirthRangeInterval(
    source.summary.source.startTimestamp,
    source.summary.source.endTimestamp,
  );
  if (checkpoint.stage !== 'pages') {
    options.onProgress(
      checkpoint.stage === 'summary'
        ? '全部资料已读完，正在归纳区间结论'
        : '正在结合区间解读回答追问',
    );
    await collect(
      [
        '【西洋占星出生区间解读】',
        `出生范围：${interval}。已逐页解读${checkpoint.completedPages}页、${checkpoint.completedBranches}个出生时段。`,
        `【原问题】\n${checkpoint.question || source.promptOptions?.question || '综合解读'}`,
        `【本轮问题】\n${options.question}`,
        `【分段解读归纳】\n${checkpoint.synopsis}`,
        '【任务】\n结合各时段判断归纳共同点和差异，逐项保留适用时段、盘面依据与条件。以已有归纳能支持的范围回答本轮问题，具体说明仍需核对的原始资料。',
        '【输出要求】\n使用中文，先给主要判断，再列关键依据与适用条件，控制在1200字以内。',
      ].join('\n\n'),
      ANSWER_CHARACTERS,
      true,
      options,
      stream,
    );
    return { ...checkpoint, stage: 'complete' };
  }
  const iterator = iterateAstrolabeDynamicPromptPages(source.summary, source.readBranch, {
    ...source.promptOptions,
    maxCharacters: PAGE_CHARACTERS,
    startAt: checkpoint.cursor!,
    signal: options.signal,
  });
  const result = await iterator.next();
  await iterator.return(undefined);
  if (result.done) throw new Error('当前续读位置没有解读资料。');
  const page = result.value;
  const coverage = `第${page.branchIndex + 1}/${source.summary.branchCount}段，资料第${page.pageIndex + 1}页`;
  options.onProgress(`正在解读${coverage}`);
  const answer = await collect(
    [
      page.text,
      `【原问题】\n${checkpoint.question}`,
      checkpoint.synopsis ? `【此前分段归纳】\n${checkpoint.synopsis}` : '',
      `【本轮问题】\n${options.question}`,
      '【本轮回答范围】\n本轮完成当前页资料的解读；每项判断注明本轮出生时段和依据，需结合后续资料的判断说明成立条件。控制在1200字以内。',
    ]
      .filter(Boolean)
      .join('\n\n'),
    ANSWER_CHARACTERS,
    true,
    options,
    stream,
  );
  options.onProgress(`正在保存${coverage}的解读要点`);
  const synopsis = await collect(
    [
      '【任务】\n将已有分段归纳与本页资料、解读合并成可继续使用的中文归纳。保留问题、关键盘面依据、结论适用的出生时段与推运日期、相反条件和待核对内容。共同判断标明已覆盖范围，区分本页成立与跨页已确认的判断。',
      `【全部出生范围】\n${interval}`,
      `【本轮资料】\n${page.text}`,
      `【已有归纳】\n${checkpoint.synopsis || '尚无此前归纳。'}`,
      `【本页解读】\n${answer}`,
      `【原问题】\n${checkpoint.question}`,
      '【输出要求】\n直接输出归纳正文，合并重复描述，保留不同出生时段的分歧和适用条件，控制在6000字以内。',
    ].join('\n\n'),
    SUMMARY_CHARACTERS,
    false,
    options,
    stream,
  );
  options.signal?.throwIfAborted();
  return {
    ...checkpoint,
    stage: page.nextCursor ? 'pages' : 'summary',
    cursor: page.nextCursor,
    completedPages: checkpoint.completedPages + 1,
    completedBranches: checkpoint.completedBranches + (page.lastPageOfBranch ? 1 : 0),
    synopsis,
  };
}
