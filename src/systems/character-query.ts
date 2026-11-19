import type { z } from 'zod';
import type { characterQueryInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { lookupCharacters, searchCharacters } from './characters';
import type { CharacterShardLoader } from '../character-data';

type Input = z.infer<typeof characterQueryInput>;
async function dataFor(query: Input['query'], loadShard?: CharacterShardLoader) {
  if (query.kind === 'text') return { query, result: await lookupCharacters(query.text, query.includeReferences ?? true, loadShard) };
  return { query, result: await searchCharacters(query, loadShard) };
}
type Data = Awaited<ReturnType<typeof dataFor>>;
function render(data: Data, question: string) {
  const entries = 'characters' in data.result ? data.result.characters.map(({ char, detail }) => {
    if (!detail) return `【${char}】字典资料缺失。`;
    return [`【${char}】简体${detail.simplified}；繁体${detail.traditional}；姓名学康熙笔画${detail.kangxiStrokes}，简体${detail.simplifiedStrokes ?? '待考'}画、繁体${detail.traditionalStrokes ?? '待考'}画。`,
      `读音：${detail.pinyin ?? '待考'}${detail.readingNote ? `；${detail.readingNote}` : ''}。部首${detail.radical ?? '待考'}，结构${detail.structure ?? '待考'}，姓名学五行${detail.wuxing ?? '待考'}。`,
      `字义：${detail.definition ?? '待考'}${detail.strokeNote ? `\n笔画说明：${detail.strokeNote}` : ''}`,
      'kangxiText' in detail ? `康熙字典原文：${detail.kangxiText ?? '未收录。'}` : '未请求康熙字典原文。'].join('\n');
  }).join('\n\n') : 'items' in data.result ? data.result.items.map((item) => `${item.char}（${item.pinyin ?? '待考'}，${item.kangxiStrokes}画，${item.wuxing ?? '五行待考'}）：${item.definition ?? '字义待考'}`).join('\n') || '当前页无匹配汉字。' : '';
  const section = 'items' in data.result ? `筛选共${data.result.total}字；本页起点${data.result.offset}，下一页${data.result.nextOffset ?? '无'}。` : '';
  const text = [`【汉字资料】\n${section}\n${entries}`, '【任务】\n结合实际资料说明字形、读音、字义及姓名使用；区分字书原文与推测，姓名学五行和笔画为传统取象。原有字库和来源尚待独立校勘，缺失原文不可补造。', `【问题】\n${question}`].join('\n\n');
  return { text };
}
export async function characterQuery(input: Input, loadShard?: CharacterShardLoader) {
  const data = await dataFor(input.query, loadShard);
  const count = 'characters' in data.result ? data.result.characters.length : data.result.items.length;
  return { data, summary: { title: '汉字查询', lines: [`本次返回 ${count} 字`] }, prompt: render(data, input.question) };
}
export async function promptForSavedCharacterQuery(data: unknown, query: Input['query'], question: string, loadShard?: CharacterShardLoader) {
  const expected = await dataFor(query, loadShard);
  if (!sameJsonValue(data, expected)) throw new Error('汉字查询结果与输入不一致。');
  return render(expected, question);
}
