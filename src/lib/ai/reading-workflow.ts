import { READING_CLASSIC_TABLES, READING_CALCULATION_ROUTES } from './reading-capabilities';
import workflow from '../../../skills/mingyu/references/reading-workflow.json';
import type { ChatMessage, StreamOptions } from './stream-client';
import { verifyReadingAnswer } from './reading-verification';
import type { ReadingSubjectSnapshot } from './reading-subject';

export type ReadingAction =
  | { kind: 'classic'; method: string; query: string }
  | { kind: 'schema'; method: string }
  | { kind: 'calculate'; method: string; input: Record<string, unknown> };
export type ReadingResource = {
  key: string;
  title: string;
  text: string;
  usable: boolean;
  kind?: 'evidence' | 'schema';
  sourceIds?: string[];
};
export type ReadingMemory = { resources: ReadingResource[]; schemas?: ReadingResource[] };
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
  onProgress: (progress: ReadingProgress) => void;
  onNotice: (notice: string) => void;
}

const MAX_CONTEXT = 49_000;
const MAX_RESOURCES = 18_000;
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

export function getReadingGuide(text: string) {
  const methods = Object.entries(workflow.methods).filter(([, item]) =>
    item.match.some((keyword) => text.includes(keyword)),
  );
  return [
    '【解读方法】',
    ...workflow.principles,
    ...methods.map(([, item]) => `${item.label}：${item.guide}`),
  ].join('\n');
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
      )
        return {
          kind: 'calculate',
          method: item.method,
          input: item.input as Record<string, unknown>,
        };
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

export async function runReadingWorkflow(
  messages: ChatMessage[],
  options: ReadingOptions,
  deps: ReadingDependencies,
) {
  const guard = () => {
    if (options.signal?.aborted) throw new DOMException('已停止解读', 'AbortError');
  };
  const guide = getReadingGuide(messages[0]?.content ?? '');
  const storedResources = [...options.memory.resources];
  const schemaResources = [
    ...(options.memory.schemas ?? []),
    ...storedResources.filter(isSchemaResource),
  ];
  const resources = storedResources.filter((item) => !isSchemaResource(item));
  const seen = new Set([...resources, ...schemaResources].map((item) => item.key));
  const notes: string[] = [];
  let calls = 0;
  options.onProgress({ stage: 'preparing', text: '正在梳理问题与盘面' });
  try {
    for (let round = 0; round < 2; round += 1) {
      let needsRefinement = false;
      guard();
      const catalog = `【当前任务：准备解读资料】\n请依据本次问题判断哪些额外资料能改变判断。输出一个JSON对象 {"actions":[]}，资料充足时使用空数组。每次最多4项。排盘类优先补齐当前阶段、所属上层运限和问题涉及的目标时段；占卜类优先保留本次起盘已有的时间、动变、牌阵或签谱事实。只有传统条文能改变取义时才查询。可选动作：\n1. {"kind":"schema","method":"${CALCULATIONS.join('或')}"}，查看补算参数。\n2. {"kind":"calculate","method":"方法编号","input":{}}，按已读取的参数格式补算。参数取自用户明确提供的出生资料、地点、历法和目标时段，保持原盘的主体与计算口径；必要输入缺失时直接进入已有资料解读并指出具体缺项。原始卦、课、牌、签沿用本次结果。\n3. {"kind":"classic","method":"方法编号","query":"具体星曜、日主月令、格局或卦名"}，查阅传统条文。方法编号：${Object.keys(READING_CLASSIC_TABLES).join('、')}。\n本轮仅完成资料选择，解读正文将在下一步生成。`;
      const schemas = schemaResources.length
        ? `\n\n【补算参数】\n${schemaResources.map((item) => `${item.title}\n${item.text}`).join('\n\n')}`
        : '';
      const prepared = fitReadingMessages(
        [...messages, { role: 'user', content: catalog }],
        `${guide}${schemas}\n\n${resources.map((item) => `${item.title}\n${item.text}`).join('\n\n')}`,
      );
      let actions: ReadingAction[];
      try {
        actions = parseReadingPlan(await collectResponse(prepared, options, deps.stream));
      } catch (error) {
        guard();
        // 格式不支持时沿用已准备资料；网络、限流等请求失败交由用户重试。
        if (
          error instanceof SyntaxError ||
          (error instanceof Error && /资料准备|一次补充/u.test(error.message))
        ) {
          options.onNotice('本次自动补查未完成，解读将使用已有盘面与解读方法。');
          break;
        }
        throw error;
      }
      if (!actions.length) break;
      for (const action of actions) {
        guard();
        if (calls >= MAX_ACTIONS) break;
        const key = JSON.stringify(action);
        if (seen.has(key)) continue;
        if (action.kind === 'calculate' && !options.subject) {
          notes.push('当前会话缺少主体快照，无法安全补算目标时段；请重新开始解读。');
          options.onNotice('当前对话缺少主体快照，已跳过自动补算。');
          continue;
        }
        if (
          action.kind === 'calculate' &&
          !schemaResources.some(
            (item) => item.key === JSON.stringify({ kind: 'schema', method: action.method }),
          )
        ) {
          notes.push(`${action.method}补算所需参数格式未取得，无法断言目标时段。`);
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
          guard();
          if (action.kind === 'schema') {
            schemaResources.push({ ...resource, key, kind: 'schema' });
            continue;
          }
          if (action.kind === 'classic' && !resource.usable) {
            needsRefinement = true;
            notes.push(describeReadingFailure(action, new Error('未命中')));
            options.onNotice(`“${action.query}”未查到对应条文，已保留原有盘面资料。`);
          }
          if (resource.text.length > MAX_RESOURCES) {
            notes.push('补充资料已达到本轮容量，可围绕具体问题进一步查询。');
            options.onNotice('本轮补充资料较多，已保留完整盘面与已取得的条目。');
            continue;
          }
          while (
            resources.length &&
            resources.reduce((sum, item) => sum + item.text.length, 0) + resource.text.length >
              MAX_RESOURCES
          )
            seen.delete(resources.shift()?.key ?? '');
          resources.push({ ...resource, key, kind: 'evidence' });
        } catch (error) {
          guard();
          notes.push(describeReadingFailure(action, error));
          options.onNotice('部分补充资料暂未取得，将依据已有资料继续解读。');
        }
      }
      if (calls >= MAX_ACTIONS) break;
      if (round === 0 && !needsRefinement && actions.every((action) => action.kind !== 'schema'))
        break;
    }
    guard();
    options.memory.resources = resources;
    options.memory.schemas = schemaResources;
    const material = resources
      .filter((item) => item.usable)
      .map((item) => `${item.title}\n${item.text}`)
      .join('\n\n');
    const status = notes.length
      ? `\n\n【资料状态】\n${notes.map((note) => `- ${note}`).join('\n')}\n已取得的完整盘面与补充资料仍可用于完成判断。`
      : '';
    const finalMessages = fitReadingMessages(
      messages,
      `${guide}${material ? `\n\n【补充资料】\n${material}` : ''}${status}\n\n【本轮解读】\n请完整回答用户最近的问题，将已知盘面与查得传统条文结合具体情境推导。先说明主要判断，再展开支持依据、变化条件与关键时段。对影响当前结论的缺项，具体说明所需资料，同时完成已知部分。`,
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
