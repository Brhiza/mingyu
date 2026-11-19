import { getSplitSolarPillars } from './calendar';
import type { z } from 'zod';
import type { ssgwInput } from '../schema';
import { resolvePromptSelection } from '../prompt-selection';
import { randomContext } from './random';
import signData from './ssgw-data.json';

type Input = z.infer<typeof ssgwInput>;
type Sign = { id: number; title: string; qianwen: string; story: string; details: Record<string, string> };
const signs = signData as unknown as Sign[];
type Data = {
  number: number; title: string; poem: string; story: string; details: Record<string, string>;
  timestamp: number; ganzhi: { year: string; month: string; day: string; hour: string };
  draw: { method: 'random' | 'manual'; poolSize: number; selectedNumber: number };
};

function timeFacts(timestamp: number) {
  if (!Number.isSafeInteger(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) throw new Error('求签时间无效。');
  const wall = new Date(timestamp + 8 * 60 * 60 * 1000);
  const year = wall.getUTCFullYear();
  const month = wall.getUTCMonth() + 1;
  const day = wall.getUTCDate();
  const hour = wall.getUTCHours();
  const minute = wall.getUTCMinutes();
  return getSplitSolarPillars(
    { year, month, day, hour, minute, second: wall.getUTCSeconds() },
    { year, month, day, hour },
  );
}

function makeData(sign: Sign, timestamp: number, method: 'random' | 'manual'): Data {
  return {
    number: sign.id, title: sign.title, poem: sign.qianwen, story: sign.story, details: { ...sign.details },
    timestamp, ganzhi: timeFacts(timestamp), draw: { method, poolSize: signs.length, selectedNumber: sign.id },
  };
}

// The old source keeps modern interpretations beside the verse; do not conflate them.
function evidence(data: Data) {
  return {
    source: '项目原有三山国王签谱资料；签谱版本及典故来源尚待独立核验。',
    principal: { number: data.number, title: data.title, poem: data.poem },
    supplementary: { story: data.story, interpretations: { ...data.details } },
    limitations: [
      '签诗是本次签面原文；典故和分类解读是辅助材料，不能与签诗混为一谈。',
      '签谱版本、典故和解说的历史来源尚待核验，不能将所有材料都当作古籍原文。',
      '签文象征及吉凶分类不能证明现实事件必然发生；结论需结合问题和现实条件。',
    ],
  };
}

function storyForPrompt(story: string, number: number) {
  return story.split(/(?<=[。！？!?])\s*/u).map((sentence) => sentence.trim()).filter((sentence) => {
    const references = [...sentence.matchAll(/第\s*(\d+|[一二三四五六七八九十]{1,3})\s*签/gu)];
    return references.every((match) => /^\d+$/u.test(match[1]) && Number(match[1]) === number) && !sentence.includes('全方位的多');
  }).join('');
}

function buildPrompt(data: Data, question: string, options: Input['prompt'], now: string) {
  const selected = resolvePromptSelection('ssgw', options);
  const story = storyForPrompt(data.story, data.number);
  const detailEntries = Object.entries(data.details).filter(([, value]) => value.trim());
  const coreMeaning = data.details['此签核心']?.trim();
  const details = detailEntries
    .filter(([key, value]) => !(key === '核心寓意' && coreMeaning && value.trim() === coreMeaning))
    .map(([key, value]) => `${key}：${value}`)
    .join('；');
  const sections = [
    '【资料口径】\n以本次签诗为主证，典故和分类解说为辅；签谱版本和典故来源尚待独立核验，现代解说不等同于古籍原文。',
    `【时间】\n求签：${new Date(data.timestamp).toISOString()}；历法时区 UTC+08:00；干支：${Object.values(data.ganzhi).join(' ')}；提示词时间：${now}。`,
    `【签面】\n第${data.number}签：${data.title}\n签诗：${data.poem}`,
    story ? `【典故辅助资料】\n${story}` : '',
    details ? `【分类解说辅助资料】\n${details}` : '',
    selected ? `【解读选择】\n${selected.section}` : '',
    options?.includeClassics ? '【来源说明】\n当前使用项目原有签谱资料；尚无经过独立核验的版本或典故出处，不补造经典出处。' : '',
    `【任务】\n围绕问题逐句说明签诗取象，关联相关分类解说并标出资料来源层次；说明不同理解、成立条件和现实核验点，不把吉凶或签文说成确定事件。${selected ? `\n${selected.task}` : ''}`,
    `【问题】\n${question}`,
  ].filter(Boolean);
  const user = sections.join('\n\n');
  return { text: user };
}

export function calculateSsgw(input: Input, now: string, source?: () => number) {
  const method = input.ssgw?.method ?? 'random';
  const index = method === 'manual' ? input.ssgw!.number! - 1 : randomContext(source).integer(signs.length);
  const sign = signs[index];
  if (!sign) throw new Error('签号不在签谱中。');
  const data = makeData(sign, new Date(input.divinationTime ?? now).getTime(), method);
  const analysis = evidence(data);
  return {
    data: { ...data, evidenceAnalysis: analysis },
    summary: { title: '三山国王灵签', tags: [`第${data.number}签`, data.title], lines: [data.poem] },
    prompt: buildPrompt(data, input.question, input.prompt, now),
  };
}

export function promptForSsgw(value: unknown, question: string, options: Input['prompt'], now: string) {
  const data = (value && typeof value === 'object' ? value : undefined) as Data | undefined;
  if (!data || !Number.isInteger(data.number) || typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp) || !['random', 'manual'].includes(data.draw?.method)) throw new Error('灵签结果缺少有效签号或求签方式。');
  const sign = signs.find((item) => item.id === data.number);
  if (!sign) throw new Error('签号不在签谱中。');
  const canonical = makeData(sign, data.timestamp, data.draw.method);
  const details = data.details;
  if (data.title !== canonical.title || data.poem !== canonical.poem || data.story !== canonical.story ||
      !details || Object.keys(details).length !== Object.keys(canonical.details).length ||
      Object.entries(canonical.details).some(([key, value]) => details[key] !== value) ||
      data.draw.poolSize !== canonical.draw.poolSize || data.draw.selectedNumber !== data.number ||
      !data.ganzhi || Object.entries(canonical.ganzhi).some(([key, value]) => data.ganzhi[key as keyof Data['ganzhi']] !== value)) {
    throw new Error('签面、求签记录或时间资料与签号不一致。');
  }
  return buildPrompt(canonical, question, options, now);
}
