import {
  READING_CLASSIC_TABLES as TABLES,
  READING_CALCULATION_ROUTES as ROUTES,
} from './reading-capabilities';
import type { ReadingAction, ReadingResource } from './reading-workflow';
import { getAiApiEndpoint } from './stream-client';

const LABELS: Record<string, string> = {
  sourceBook: '典籍',
  source: '典籍',
  verse: '原文',
  classicVerse: '原文',
  modernMeaning: '取义',
  modernExplanation: '释义',
  explanation: '释义',
  modernAdvice: '取义',
  careerAdvice: '事业取义',
  nature: '性质',
  dayMaster: '日主',
  monthBranch: '月令',
  primaryGods: '调候取用',
  seasonSummary: '月令概要',
  name: '名称',
  star: '星曜',
  pattern: '格局',
  auspice: '吉凶',
  guaCi: '卦辞',
  tuanCi: '彖辞',
  daXiang: '大象',
  wenYan: '文言',
  yaoCi: '爻辞',
  xiaoXiang: '小象',
  yongCi: '用辞',
  positionName: '爻位',
  yaos: '六爻',
  heavenStem: '天盘干',
  earthStem: '地盘干',
  wuxing: '五行',
  polarity: '阴阳',
  brightnessGeneral: '星性',
  upper: '上卦',
  lower: '下卦',
  palace: '宫位',
};

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function textValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textValues);
  if (record(value)) return Object.values(value).flatMap(textValues);
  return [];
}
export function formatClassicEntry(value: unknown): string {
  if (!record(value)) return textValues(value).join('；');
  return Object.entries(value)
    .flatMap(([key, item]) => {
      if (['id', 'key', 'score', 'type', 'category'].includes(key)) return [];
      if (key === 'yaos' && Array.isArray(item)) return item.map(formatClassicEntry);
      const text = textValues(item).join('；');
      return text ? [`${LABELS[key] ? `${LABELS[key]}：` : ''}${text}`] : [];
    })
    .join('\n');
}
export async function lookupReadingClassics(
  method: string,
  query: string,
): Promise<ReadingResource> {
  const library: Record<string, unknown> = await import('mingyu-core/classics');
  const terms = query.split(/[\s，、,；;+＋]+/u).filter(Boolean);
  const dayMaster =
    method === 'bazi' ? query.match(/([甲乙丙丁戊己庚辛壬癸])[木火土金水]?日主/u)?.[1] : undefined;
  const matches = (TABLES[method] ?? []).flatMap((table) => {
    if (dayMaster && query.includes('滴天髓') && table !== 'BAZI_DITIANSUI_TABLE') return [];
    const entries = library[table];
    return (
      Array.isArray(entries) ? entries : record(entries) ? Object.values(entries) : []
    ).filter((entry) =>
      dayMaster && query.includes('滴天髓')
        ? record(entry) && entry.stem === dayMaster
        : terms.every((term) => textValues(entry).join(' ').includes(term)),
    );
  });
  const unique = [...new Set(matches.map(formatClassicEntry))];
  const selected = unique.slice(0, 5);
  return {
    key: '',
    title: `传统条文：${query}`,
    usable: selected.length > 0,
    text: selected.length
      ? `${selected.join('\n\n')}${unique.length > 5 ? `\n另有${unique.length - 5}条相关条文，可使用更具体的名称查询。` : ''}`
      : '本次检索未找到对应条文，可依据已附盘面和传统资料继续解读。',
  };
}

export function resolveReadingSchema(
  value: unknown,
  document: Record<string, unknown>,
  depth = 0,
): unknown {
  if (depth > 12) throw new Error('补算参数层级过多。');
  if (Array.isArray(value))
    return value.map((item) => resolveReadingSchema(item, document, depth + 1));
  if (!record(value)) return value;
  if (typeof value.$ref === 'string') {
    if (!value.$ref.startsWith('#/components/schemas/')) throw new Error('补算参数引用无效。');
    let target: unknown = document;
    for (const part of value.$ref.slice(2).split('/'))
      target = record(target) ? target[part] : undefined;
    if (!target) throw new Error('补算参数定义缺失。');
    return resolveReadingSchema(target, document, depth + 1);
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      resolveReadingSchema(item, document, depth + 1),
    ]),
  );
}

async function fetchReadingData(
  path: string,
  signal?: AbortSignal,
  input?: Record<string, unknown>,
) {
  const timeout = new AbortController();
  const abort = () => timeout.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 45_000);
  try {
    if (signal?.aborted) throw new DOMException('已停止解读', 'AbortError');
    const response = await fetch(getAiApiEndpoint(`/api/v1${path}`), {
      method: input ? 'POST' : 'GET',
      ...(input
        ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }
        : {}),
      signal: timeout.signal,
    });
    const body: unknown = await response.json();
    if (!response.ok || !record(body) || body.success === false) {
      const error =
        record(body) && record(body.error) && typeof body.error.message === 'string'
          ? body.error.message
          : '补充资料请求失败。';
      throw new Error(error);
    }
    return record(body.data) ? body.data : body;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}

export async function executeReadingAction(
  action: ReadingAction,
  signal?: AbortSignal,
): Promise<ReadingResource> {
  if (action.kind === 'classic') return lookupReadingClassics(action.method, action.query);
  const path = Object.hasOwn(ROUTES, action.method) ? ROUTES[action.method] : undefined;
  if (!path) throw new Error('此方法暂不支持自动补算。');
  if (action.kind === 'schema') {
    const document = await fetchReadingData('/openapi.json', signal);
    const paths = document.paths as Record<
      string,
      { post?: { requestBody?: { content?: Record<string, { schema?: unknown }> } } }
    >;
    const schema = (
      paths?.[path] ??
      (action.method === 'astrolabe' ? paths?.['/divination/{method}/prompt'] : undefined)
    )?.post?.requestBody?.content?.['application/json']?.schema;
    if (!schema) throw new Error('暂未取得该方法的补算参数。');
    return {
      key: '',
      title: `${action.method}补算参数`,
      text: JSON.stringify(resolveReadingSchema(schema, document)),
      usable: false,
    };
  }
  const data = await fetchReadingData(path, signal, {
    ...action.input,
    responseMode: 'prompt-only',
  });
  if (typeof data.prompt !== 'string' || !data.prompt.trim())
    throw new Error('补算未返回完整盘面。');
  return { key: '', title: '目标时段补充盘面', text: data.prompt, usable: true };
}
