import type { z } from 'zod';
import type { zhouyiInput } from '../schema';
import type { RuntimeContext } from '../runtime-context';
import { sameJsonValue } from '../json-value';
import { ensureZhouyiTextsLoaded, ensureZhouyiWingsLoaded, findHexagram, getAllHexagrams, getAllWings, searchWings, source, sourceUrl, type Hexagram, type WingSearchParams } from './zhouyi-text';

type Input = z.infer<typeof zhouyiInput>;
type Query = Input['query'];

export { getAllWings };
export function searchZhouyiWings(params: WingSearchParams = {}) {
  return searchWings(params);
}

function fields(item: Hexagram) {
  return [
    { field: '卦名', text: item.name }, { field: '卦辞', text: item.guaCi }, { field: '彖辞', text: item.tuanCi }, { field: '大象', text: item.daXiang },
    ...(item.wenYan ? [{ field: '文言', text: item.wenYan }] : []), ...(item.yongCi ? [{ field: '用辞', text: item.yongCi }] : []),
    ...item.yaos.flatMap((line) => [{ field: `${line.positionName}爻辞`, text: line.yaoCi }, { field: `${line.positionName}小象`, text: line.xiaoXiang }]),
  ];
}
function calculate(query: Query) {
  if (query.kind === 'hexagram') {
    const record = findHexagram(query.id ?? query.name!);
    if (!record) throw new Error('未找到该卦；请提供六十四卦卦序、全名或简称。');
    const { sourceRevision, shortName, ...content } = record;
    const hexagram = { ...content, shortName, yaos: query.line ? content.yaos.filter((line) => line.position === query.line) : content.yaos, sourceUrl: sourceUrl(record) };
    return { input: { query }, result: { kind: 'hexagram' as const, hexagram }, source };
  }
  if (query.kind === 'wings') {
    const wingsResult = searchWings({
      wing: query.wing,
      chapter: query.chapter,
      trigram: query.trigram,
      text: query.text,
      offset: query.offset,
      limit: query.limit,
    });
    return { input: { query }, result: { kind: 'wings' as const, ...wingsResult }, source };
  }
  const entries = getAllHexagrams().flatMap((item) => {
    const matches = fields(item).flatMap(({ field, text }) => {
      const index = text.indexOf(query.text);
      return index < 0 ? [] : [{ field, excerpt: `${index > 20 ? '…' : ''}${text.slice(Math.max(0, index - 20), Math.min(text.length, index + query.text.length + 20))}${index + query.text.length + 20 < text.length ? '…' : ''}` }];
    });
    return matches.length ? [{ id: item.id, name: item.name, shortName: item.shortName, matches: matches.slice(0, 3), omittedMatches: Math.max(0, matches.length - 3), sourceUrl: sourceUrl(item) }] : [];
  });
  const offset = query.offset ?? 0, limit = query.limit ?? 10;
  return { input: { query }, result: { kind: 'search' as const, items: entries.slice(offset, offset + limit), total: entries.length,
    offset, limit, nextOffset: offset + limit < entries.length ? offset + limit : null }, source };
}
type Data = ReturnType<typeof calculate>;
import huangjiHexagrams from './huangji-hexagrams.json';

function formatHexagramStructure(id: number): string {
  const h = huangjiHexagrams.find((item) => item.id === id);
  if (!h) return '';
  const bottomUp = h.binarySymbol.slice(3) + h.binarySymbol.slice(0, 3);
  const toBinarySymbol = (b: string) => b.slice(3, 6) + b.slice(0, 3);
  const byBin = (b: string) => huangjiHexagrams.find((item) => item.binarySymbol === toBinarySymbol(b));
  const cuoBin = [...bottomUp].map((c) => (c === '1' ? '0' : '1')).join('');
  const zongBin = [...bottomUp].reverse().join('');
  const huBin = bottomUp.slice(1, 4) + bottomUp.slice(2, 5);
  const cuo = byBin(cuoBin), zong = byBin(zongBin), hu = byBin(huBin);
  return `卦体结构：上卦${h.upper}、下卦${h.lower}（${h.symbol}）；互卦：${hu?.name ?? '待考'}；错卦（旁通卦）：${cuo?.name ?? '待考'}；综卦（反对卦）：${zong?.name ?? '待考'}。`;
}

function render(data: Data, question: string) {
  let body: string;
  if (data.result.kind === 'hexagram') {
    const h = data.result.hexagram;
    const structLine = formatHexagramStructure(h.id);
    const lines = [
      `第${h.id}卦：${h.name}（简称：${h.shortName}）`,
      structLine,
      `卦辞：${h.guaCi}`,
      `彖辞：${h.tuanCi}`,
      `大象：${h.daXiang}`,
      h.yongCi ? `用辞：${h.yongCi}` : '',
      h.wenYan ? `文言：${h.wenYan}` : '',
      ...h.yaos.map((y) => `${y.positionName}（第${y.position}爻）：${y.yaoCi}｜小象：${y.xiaoXiang}`),
    ].filter(Boolean);
    body = lines.join('\n');
  } else if (data.result.kind === 'wings') {
    body = [
      `共匹配十翼 ${data.result.total} 篇（当前偏移 ${data.result.offset}，上限 ${data.result.limit}）：`,
      ...data.result.items.map((item) => `《${item.wing}·${item.chapter}》${item.title}：${item.text}`),
    ].join('\n\n');
  } else {
    body = [
      `共匹配 ${data.result.total} 卦（当前偏移 ${data.result.offset}，上限 ${data.result.limit}）：`,
      ...data.result.items.map((item) => `第${item.id}卦 ${item.name}：${item.matches.map((m) => `［${m.field}］${m.excerpt}`).join('；')}`),
    ].join('\n');
  }
  const text = [`【周易资料】\n${body}`, `【来源】\n${data.source.attribution}；${data.source.edition}；${data.source.license}（${data.source.licenseUrl}）。${data.source.note}`,
    '【任务】\n根据所列经文回答，区分原文与解释，不补造未提供的篇章或现实事实。', `【问题】\n${question}`].join('\n\n');
  return { text };
}
export async function zhouyi(input: Input, context?: RuntimeContext) {
  if (input.query.kind === 'wings') {
    await ensureZhouyiWingsLoaded(context?.staticDataset);
  } else {
    await ensureZhouyiTextsLoaded(context?.staticDataset);
  }
  const data = calculate(input.query), question = input.question?.trim() || '请解释这些周易经文。';
  const summaryLine =
    data.result.kind === 'hexagram'
      ? data.result.hexagram.name
      : data.result.kind === 'wings'
        ? `匹配十翼 ${data.result.total} 篇`
        : `匹配 ${data.result.total} 卦`;
  return { data, summary: { title: '周易经文查询', lines: [summaryLine] }, prompt: render(data, question) };
}
export async function promptForZhouyi(value: unknown, input: Input, question: string, context?: RuntimeContext) {
  if (input.query.kind === 'wings') {
    await ensureZhouyiWingsLoaded(context?.staticDataset);
  } else {
    await ensureZhouyiTextsLoaded(context?.staticDataset);
  }
  const expected = calculate(input.query);
  if (!sameJsonValue(value, expected)) throw new Error('周易资料与保存的查询不一致。');
  return render(expected, question);
}
