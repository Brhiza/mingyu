import {
  collectAstrolabeDynamicReadingText,
  type AstrolabeDynamicReadingRoundOptions,
  type AstrolabeDynamicReadingSource,
  type AstrolabeDynamicReadingStream,
} from './astrolabe-dynamic-reading';
import {
  iterateAstrolabeDynamicPromptPages,
  type AstrolabeDynamicPromptCursor,
} from '../astrolabe-dynamic-range-prompt';

export type AstrolabeDynamicCollectionTarget = 'primary' | 'partner';

export type AstrolabeDynamicCollectionSource = AstrolabeDynamicReadingSource & {
  target: AstrolabeDynamicCollectionTarget;
};

export type AstrolabeDynamicCollectionSupplemental = {
  key: string;
  title: string;
  text: string;
};

type AstrolabeDynamicCollectionSourceCheckpoint = {
  key: string;
  target: AstrolabeDynamicCollectionTarget;
  subjectId: string;
  identity: string;
  cursor: AstrolabeDynamicPromptCursor | null;
  completedPages: number;
  completedBranches: number;
};

export type AstrolabeDynamicCollectionCheckpoint = {
  version: 2;
  identity: string;
  stage: 'supplemental' | 'pages' | 'summary' | 'complete';
  sourceIndex: number | null;
  cursor: AstrolabeDynamicPromptCursor | null;
  supplementalPageIndex: number;
  completedPages: number;
  completedBranches: number;
  completedSources: number;
  synopsis: string;
  question: string;
  sources: AstrolabeDynamicCollectionSourceCheckpoint[];
};

const PAGE_CHARACTERS = 6000;
const ANSWER_CHARACTERS = 12000;
const SYNOPSIS_CHARACTERS = 8000;
const SUPPLEMENTAL_PAGE_CHARACTERS = 9000;
const MAX_QUESTION_CHARACTERS = 8000;

type SupplementalPage = {
  key: string;
  title: string;
  pageIndex: number;
  pageCount: number;
  text: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isTarget(value: unknown): value is AstrolabeDynamicCollectionTarget {
  return value === 'primary' || value === 'partner';
}

function isCursor(value: unknown): value is AstrolabeDynamicPromptCursor {
  if (!isRecord(value)) return false;
  const branchIndex = value.branchIndex;
  const pageIndex = value.pageIndex;
  const branchStartTimestamp = value.branchStartTimestamp;
  return (
    typeof branchIndex === 'number' &&
    typeof pageIndex === 'number' &&
    typeof branchStartTimestamp === 'number' &&
    Number.isSafeInteger(branchIndex) &&
    Number.isSafeInteger(pageIndex) &&
    branchIndex >= 0 &&
    pageIndex >= 0 &&
    Number.isSafeInteger(branchStartTimestamp) &&
    branchStartTimestamp % 1000 === 0
  );
}

function isBoundedCount(value: unknown) {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isSourceCheckpoint(value: unknown): value is AstrolabeDynamicCollectionSourceCheckpoint {
  if (!isRecord(value)) return false;
  return (
    typeof value.key === 'string' &&
    value.key.length > 0 &&
    isTarget(value.target) &&
    typeof value.subjectId === 'string' &&
    value.subjectId.length > 0 &&
    typeof value.identity === 'string' &&
    value.identity.length > 0 &&
    (value.cursor === null || isCursor(value.cursor)) &&
    isBoundedCount(value.completedPages) &&
    isBoundedCount(value.completedBranches)
  );
}

export function isAstrolabeDynamicCollectionCheckpoint(
  value: unknown,
): value is AstrolabeDynamicCollectionCheckpoint {
  if (!isRecord(value)) return false;
  if (
    value.version !== 2 ||
    typeof value.identity !== 'string' ||
    !value.identity ||
    !['supplemental', 'pages', 'summary', 'complete'].includes(value.stage as string) ||
    (value.sourceIndex !== null && !Number.isSafeInteger(value.sourceIndex)) ||
    (value.cursor !== null && !isCursor(value.cursor)) ||
    !isBoundedCount(value.supplementalPageIndex) ||
    !isBoundedCount(value.completedPages) ||
    !isBoundedCount(value.completedBranches) ||
    !isBoundedCount(value.completedSources) ||
    typeof value.synopsis !== 'string' ||
    value.synopsis.length > SYNOPSIS_CHARACTERS ||
    typeof value.question !== 'string' ||
    value.question.length > MAX_QUESTION_CHARACTERS ||
    !Array.isArray(value.sources) ||
    value.sources.length === 0 ||
    value.sources.some((source) => !isSourceCheckpoint(source))
  ) {
    return false;
  }
  const checkpoint = value as unknown as AstrolabeDynamicCollectionCheckpoint;
  if (checkpoint.stage === 'pages') {
    return (
      checkpoint.sourceIndex !== null &&
      checkpoint.sourceIndex >= 0 &&
      checkpoint.sourceIndex < checkpoint.sources.length &&
      checkpoint.cursor !== null
    );
  }
  return checkpoint.sourceIndex === null && checkpoint.cursor === null;
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function sourceIdentity(source: AstrolabeDynamicCollectionSource) {
  return JSON.stringify([
    source.target,
    source.key,
    source.subjectId,
    source.summary,
    source.promptOptions ?? {},
  ]);
}

function supplementalIdentity(item: AstrolabeDynamicCollectionSupplemental) {
  return [item.key, item.title, item.text.length, hashText(item.text)];
}

function collectionIdentity(
  sources: readonly AstrolabeDynamicCollectionSource[],
  supplemental: readonly AstrolabeDynamicCollectionSupplemental[],
) {
  return JSON.stringify({
    sources: sources.map((source) => sourceIdentity(source)),
    supplemental: supplemental.map(supplementalIdentity),
  });
}

function validateInputs(
  sources: readonly AstrolabeDynamicCollectionSource[],
  supplemental: readonly AstrolabeDynamicCollectionSupplemental[],
  question: string,
) {
  if (!sources.length) throw new Error('动态出生区间解读至少需要一个资料主体。');
  if (question.length > MAX_QUESTION_CHARACTERS) {
    throw new Error('动态出生区间问题超过单轮容量，请缩短问题后重试。');
  }
  const sourceKeys = new Set<string>();
  for (const source of sources) {
    if (!source.key || !source.subjectId || !isTarget(source.target)) {
      throw new Error('动态出生区间资料缺少主体、目标或来源标识。');
    }
    const sourceKey = `${source.target}:${source.subjectId}:${source.key}`;
    if (sourceKeys.has(sourceKey)) throw new Error('同一主体的动态出生区间来源 key 不能重复。');
    sourceKeys.add(sourceKey);
    if (typeof source.readBranch !== 'function') throw new Error('动态出生区间缺少分段读取器。');
  }
  const supplementalKeys = new Set<string>();
  for (const item of supplemental) {
    if (!item.key || !item.title || typeof item.text !== 'string') {
      throw new Error('动态出生区间补充资料格式无效。');
    }
    if (supplementalKeys.has(item.key)) throw new Error('动态出生区间补充资料 key 不能重复。');
    supplementalKeys.add(item.key);
  }
}

function splitSupplemental(
  supplemental: readonly AstrolabeDynamicCollectionSupplemental[],
): SupplementalPage[] {
  return supplemental.flatMap((item) => {
    const text = item.text || '（本资料为空）';
    const pageCount = Math.max(1, Math.ceil(text.length / SUPPLEMENTAL_PAGE_CHARACTERS));
    return Array.from({ length: pageCount }, (_, pageIndex) => ({
      key: item.key,
      title: item.title,
      pageIndex,
      pageCount,
      text: text.slice(
        pageIndex * SUPPLEMENTAL_PAGE_CHARACTERS,
        (pageIndex + 1) * SUPPLEMENTAL_PAGE_CHARACTERS,
      ),
    }));
  });
}

function cloneCursor(cursor: AstrolabeDynamicPromptCursor | null) {
  return cursor ? { ...cursor } : null;
}

function cloneSources(sources: readonly AstrolabeDynamicCollectionSourceCheckpoint[]) {
  return sources.map((source) => ({ ...source, cursor: cloneCursor(source.cursor) }));
}

function targetLabel(target: AstrolabeDynamicCollectionTarget) {
  return target === 'primary' ? '本人' : '对方';
}

function makeInitialSources(sources: readonly AstrolabeDynamicCollectionSource[]) {
  return sources.map((source) => ({
    key: source.key,
    target: source.target,
    subjectId: source.subjectId,
    identity: sourceIdentity(source),
    cursor: {
      branchIndex: 0,
      pageIndex: 0,
      branchStartTimestamp: source.summary.source.startTimestamp,
    },
    completedPages: 0,
    completedBranches: 0,
  }));
}

function makeInitialCheckpoint(
  sources: readonly AstrolabeDynamicCollectionSource[],
  supplementalPages: readonly SupplementalPage[],
  question: string,
  identity: string,
): AstrolabeDynamicCollectionCheckpoint {
  const sourceStates = makeInitialSources(sources);
  const hasSupplemental = supplementalPages.length > 0;
  return {
    version: 2,
    identity,
    stage: hasSupplemental ? 'supplemental' : 'pages',
    sourceIndex: hasSupplemental ? null : 0,
    cursor: hasSupplemental ? null : cloneCursor(sourceStates[0]!.cursor),
    supplementalPageIndex: 0,
    completedPages: 0,
    completedBranches: 0,
    completedSources: 0,
    synopsis: '',
    question,
    sources: sourceStates,
  };
}

function assertSourceState(
  state: AstrolabeDynamicCollectionSourceCheckpoint,
  source: AstrolabeDynamicCollectionSource,
) {
  if (
    state.key !== source.key ||
    state.target !== source.target ||
    state.subjectId !== source.subjectId ||
    state.identity !== sourceIdentity(source)
  ) {
    throw new Error('动态区间解读进度与主体、范围或解读口径不匹配。');
  }
  if (state.completedBranches > source.summary.branchCount) {
    throw new Error('动态区间解读进度超出主体分段范围。');
  }
  if (state.cursor && state.cursor.branchIndex !== state.completedBranches) {
    throw new Error('动态区间解读进度的分段游标不一致。');
  }
  if (!state.cursor && state.completedBranches !== source.summary.branchCount) {
    throw new Error('动态区间解读已完成状态不完整。');
  }
}

function assertCheckpoint(
  checkpoint: AstrolabeDynamicCollectionCheckpoint,
  sources: readonly AstrolabeDynamicCollectionSource[],
  supplementalPages: readonly SupplementalPage[],
  identity: string,
) {
  if (!isAstrolabeDynamicCollectionCheckpoint(checkpoint) || checkpoint.identity !== identity) {
    throw new Error('动态区间解读进度与当前主体、范围或补充资料不匹配。');
  }
  if (checkpoint.question.length > MAX_QUESTION_CHARACTERS) {
    throw new Error('动态区间解读进度中的问题超过容量。');
  }
  if (checkpoint.sources.length !== sources.length) {
    throw new Error('动态区间解读进度的主体数量不匹配。');
  }
  checkpoint.sources.forEach((state, index) => assertSourceState(state, sources[index]!));
  const completedBranches = checkpoint.sources.reduce(
    (total, source) => total + source.completedBranches,
    0,
  );
  if (completedBranches !== checkpoint.completedBranches) {
    throw new Error('动态区间解读进度的总分段数不一致。');
  }
  const completedPages = checkpoint.sources.reduce(
    (total, source) => total + source.completedPages,
    checkpoint.supplementalPageIndex,
  );
  if (completedPages !== checkpoint.completedPages) {
    throw new Error('动态区间解读进度的总页数不一致。');
  }
  const completedSources = checkpoint.sources.filter((source) => source.cursor === null).length;
  if (completedSources !== checkpoint.completedSources) {
    throw new Error('动态区间解读进度的主体完成数不一致。');
  }
  if (checkpoint.stage === 'supplemental') {
    if (checkpoint.supplementalPageIndex >= supplementalPages.length) {
      throw new Error('动态区间解读补充资料游标超出范围。');
    }
    if (checkpoint.completedSources !== 0 || checkpoint.sourceIndex !== null) {
      throw new Error('动态区间解读尚未完成补充资料却推进了主体。');
    }
    if (checkpoint.sources.some((source) => source.cursor === null)) {
      throw new Error('动态区间解读尚未完成补充资料却标记主体完成。');
    }
  } else if (checkpoint.supplementalPageIndex !== supplementalPages.length) {
    throw new Error('动态区间解读未完成全部补充资料。');
  }
  if (checkpoint.stage === 'pages') {
    const index = checkpoint.sourceIndex!;
    const state = checkpoint.sources[index]!;
    if (!state.cursor || JSON.stringify(state.cursor) !== JSON.stringify(checkpoint.cursor)) {
      throw new Error('动态区间解读主体游标不一致。');
    }
    if (checkpoint.sources.slice(0, index).some((source) => source.cursor !== null)) {
      throw new Error('动态区间解读主体顺序不连续。');
    }
    if (checkpoint.sources.slice(index + 1).some((source) => source.cursor === null)) {
      throw new Error('动态区间解读主体顺序不连续。');
    }
  } else if (checkpoint.stage === 'summary' || checkpoint.stage === 'complete') {
    if (checkpoint.completedSources !== sources.length) {
      throw new Error('动态区间解读尚未完成全部主体资料。');
    }
  }
}

function formatSupplementalPage(page: SupplementalPage, question: string, synopsis: string) {
  return [
    '【西洋占星动态出生区间补充资料页】',
    `资料：${page.title}，第${page.pageIndex + 1}/${page.pageCount}页。`,
    question ? `【原问题】\n${question}` : '',
    synopsis ? `【此前归纳】\n${synopsis}` : '',
    '【任务】\n先整理本页普通补充资料中会影响后续出生区间判断的事实、条件和时间范围，作为后续动态出生区间判断的事实基础。',
    '【本页资料】',
    page.text,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function formatDynamicPage(
  source: AstrolabeDynamicCollectionSource,
  pageText: string,
  question: string,
  synopsis: string,
) {
  return [
    `【主体】${targetLabel(source.target)}`,
    question ? `【原问题】\n${question}` : '',
    synopsis ? `【已处理资料归纳】\n${synopsis}` : '',
    pageText,
    '【任务】\n逐页解读当前主体的当前出生时段，保留本页盘面依据、适用时段、成立条件和仍需结合其余主体资料核对的内容。',
    '【输出要求】\n使用中文，聚焦本页已读取的主体与时段，先给具体判断，再列依据、成立条件和适用范围。',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function formatSynopsisPrompt(
  pageLabel: string,
  pageText: string,
  answer: string,
  question: string,
  synopsis: string,
) {
  return [
    '【动态区间资料归纳】',
    `【本轮资料】${pageLabel}\n${pageText}`,
    `【本轮解读】\n${answer}`,
    question ? `【原问题】\n${question}` : '',
    `【已有归纳】\n${synopsis || '尚无此前归纳。'}`,
    '【任务】\n把本轮资料与解读合并为可继续使用的中文归纳。保留主体、出生时段、盘面依据、推运日期、成立条件和待核对内容；分别标明主体与出生时段，共同判断注明覆盖范围，普通补充资料中的关键事实也要保留。',
    `【输出要求】\n只输出归纳正文，合并重复描述，控制在${SYNOPSIS_CHARACTERS}字以内。`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function sourceSummaryLabel(source: AstrolabeDynamicCollectionSource) {
  const summary = source.summary;
  const scopeLabel = {
    yearly: '流年',
    monthly: '流月',
    daily: '流日',
    full: '本命、流年、流月与流日',
  }[summary.scope];
  return `${targetLabel(source.target)}主体·${scopeLabel}·推运目标${summary.referenceDate}`;
}

function formatFinalPrompt(
  sources: readonly AstrolabeDynamicCollectionSource[],
  checkpoint: AstrolabeDynamicCollectionCheckpoint,
  question: string,
) {
  return [
    '【西洋占星动态出生区间最终归纳】',
    `已完成${checkpoint.completedPages}页资料、${checkpoint.completedBranches}个出生分段，覆盖${sources.length}个主体资料源：${sources.map(sourceSummaryLabel).join('；')}。`,
    question ? `【原问题】\n${checkpoint.question}` : '',
    question ? `【本轮问题】\n${question}` : '',
    `【全部资料归纳】\n${checkpoint.synopsis}`,
    '【任务】\n结合已完成的全部主体和普通补充资料归纳共同成立的判断、主体差异、出生时段差异、推运日期、盘面依据和成立条件。每项结论标明适用主体与时段；资料尚不足的地方明确指出。',
    '【输出要求】\n使用中文，先给主要判断，再列关键依据和适用边界，控制在1200字以内。',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function cloneCheckpoint(checkpoint: AstrolabeDynamicCollectionCheckpoint) {
  return {
    ...checkpoint,
    cursor: cloneCursor(checkpoint.cursor),
    sources: cloneSources(checkpoint.sources),
  };
}

function updateSynopsis(checkpoint: AstrolabeDynamicCollectionCheckpoint, synopsis: string) {
  if (synopsis.length > SYNOPSIS_CHARACTERS) {
    throw new Error('动态区间整体归纳超过8000字符，本轮进度未推进。');
  }
  checkpoint.synopsis = synopsis;
}

export async function runAstrolabeDynamicCollectionRound(
  sources: readonly AstrolabeDynamicCollectionSource[],
  supplemental: readonly AstrolabeDynamicCollectionSupplemental[],
  previous: AstrolabeDynamicCollectionCheckpoint | undefined,
  options: AstrolabeDynamicReadingRoundOptions,
  stream: AstrolabeDynamicReadingStream,
): Promise<AstrolabeDynamicCollectionCheckpoint> {
  const supplementalPages = splitSupplemental(supplemental);
  validateInputs(sources, supplemental, options.question);
  const identity = collectionIdentity(sources, supplemental);
  const checkpoint = previous
    ? cloneCheckpoint(previous)
    : makeInitialCheckpoint(sources, supplementalPages, options.question, identity);
  assertCheckpoint(checkpoint, sources, supplementalPages, identity);
  options.signal?.throwIfAborted();

  if (checkpoint.stage === 'supplemental') {
    const page = supplementalPages[checkpoint.supplementalPageIndex]!;
    options.onProgress(
      `正在整理普通补充资料第${page.pageIndex + 1}/${page.pageCount}页：${page.title}`,
    );
    const pageText = formatSupplementalPage(page, checkpoint.question, checkpoint.synopsis);
    const answer = await collectAstrolabeDynamicReadingText(
      pageText,
      ANSWER_CHARACTERS,
      true,
      options,
      stream,
    );
    const synopsis = await collectAstrolabeDynamicReadingText(
      formatSynopsisPrompt(
        `普通补充资料「${page.title}」第${page.pageIndex + 1}/${page.pageCount}页`,
        page.text,
        answer,
        checkpoint.question,
        checkpoint.synopsis,
      ),
      SYNOPSIS_CHARACTERS,
      false,
      options,
      stream,
    );
    const next = cloneCheckpoint(checkpoint);
    updateSynopsis(next, synopsis);
    next.supplementalPageIndex += 1;
    next.completedPages += 1;
    if (next.supplementalPageIndex === supplementalPages.length) {
      next.stage = 'pages';
      next.sourceIndex = 0;
      next.cursor = cloneCursor(next.sources[0]!.cursor);
    }
    return next;
  }

  if (checkpoint.stage === 'summary' || checkpoint.stage === 'complete') {
    options.onProgress(
      checkpoint.stage === 'summary'
        ? '全部资料已读完，正在归纳区间结论'
        : '正在结合区间解读回答追问',
    );
    await collectAstrolabeDynamicReadingText(
      formatFinalPrompt(sources, checkpoint, options.question),
      ANSWER_CHARACTERS,
      true,
      options,
      stream,
    );
    return { ...checkpoint, stage: 'complete' };
  }

  const sourceIndex = checkpoint.sourceIndex!;
  const source = sources[sourceIndex]!;
  const sourceState = checkpoint.sources[sourceIndex]!;
  const iterator = iterateAstrolabeDynamicPromptPages(source.summary, source.readBranch, {
    ...source.promptOptions,
    maxCharacters: PAGE_CHARACTERS,
    startAt: sourceState.cursor!,
    signal: options.signal,
  });
  let result: Awaited<ReturnType<typeof iterator.next>>;
  try {
    result = await iterator.next();
  } finally {
    await iterator.return(undefined);
  }
  if (result.done) throw new Error('当前动态区间续读位置没有解读资料。');
  const page = result.value;
  const pageLabel = `${targetLabel(source.target)}主体${sourceIndex + 1}/${sources.length}，出生分段${page.branchIndex + 1}/${source.summary.branchCount}，资料第${page.pageIndex + 1}页`;
  options.onProgress(`正在解读${pageLabel}`);
  const answer = await collectAstrolabeDynamicReadingText(
    formatDynamicPage(source, page.text, checkpoint.question, checkpoint.synopsis),
    ANSWER_CHARACTERS,
    true,
    options,
    stream,
  );
  options.onProgress(`正在保存${pageLabel}的解读要点`);
  const synopsis = await collectAstrolabeDynamicReadingText(
    formatSynopsisPrompt(pageLabel, page.text, answer, checkpoint.question, checkpoint.synopsis),
    SYNOPSIS_CHARACTERS,
    false,
    options,
    stream,
  );
  const next = cloneCheckpoint(checkpoint);
  updateSynopsis(next, synopsis);
  const nextSource = next.sources[sourceIndex]!;
  nextSource.cursor = cloneCursor(page.nextCursor);
  nextSource.completedPages += 1;
  if (page.lastPageOfBranch) nextSource.completedBranches += 1;
  next.completedPages += 1;
  next.completedBranches = next.sources.reduce((total, item) => total + item.completedBranches, 0);
  if (page.nextCursor) {
    next.cursor = cloneCursor(page.nextCursor);
  } else {
    next.completedSources = next.sources.filter((item) => item.cursor === null).length;
    const nextIndex = sourceIndex + 1;
    if (nextIndex < sources.length) {
      next.sourceIndex = nextIndex;
      next.cursor = cloneCursor(next.sources[nextIndex]!.cursor);
    } else {
      next.stage = 'summary';
      next.sourceIndex = null;
      next.cursor = null;
    }
  }
  return next;
}
