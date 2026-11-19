import type { z } from 'zod';
import type { numberEnergyInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { bazhaiPalaces } from './bazhai/palaces';
import { trigrams } from './trigrams';
import numerology from './number-numerology.json';

type Input = z.infer<typeof numberEnergyInput>;
type Source = Pick<Input, 'value' | 'purpose' | 'prompt'>;
const gua: Record<string, string> = { '1': '坎', '2': '坤', '3': '震', '4': '巽', '6': '乾', '7': '兑', '8': '艮', '9': '离' };
const definitions: Record<string, { nature: '助益' | '守成' | '考验'; star: string; keywords: string[]; meaning: string }> = {
  天医: { nature: '助益', star: '巨门', keywords: ['资源', '成果', '正向关系'], meaning: '重视资源积累、成果兑现与稳定关系，也需要把机会落实为长期安排。' },
  生气: { nature: '助益', star: '贪狼', keywords: ['贵人', '机会', '适应'], meaning: '象征开放、乐观与外部助力，适合通过协作和变化打开局面。' },
  延年: { nature: '助益', star: '武曲', keywords: ['专业', '执行', '责任'], meaning: '强调能力、承担与持续推进，容易把注意力放在工作标准和掌控感上。' },
  伏位: { nature: '守成', star: '辅弼', keywords: ['延续', '蓄势', '谨慎'], meaning: '延续前一状态并积蓄力量，适合稳定推进，也要留意迟疑和停滞。' },
  绝命: { nature: '考验', star: '破军', keywords: ['决断', '投入', '起伏'], meaning: '行动直接、敢于投入并追求突破，重要决定更需要衡量承受范围。' },
  五鬼: { nature: '考验', star: '廉贞', keywords: ['灵感', '变化', '敏感'], meaning: '思路活跃、反应快速且不拘常规，变化较多时需要保持节奏和可执行性。' },
  六煞: { nature: '考验', star: '文曲', keywords: ['情绪', '人际', '审美'], meaning: '感受细腻并重视关系氛围，面对牵绊时需要清晰表达边界和需求。' },
  祸害: { nature: '考验', star: '禄存', keywords: ['表达', '争执', '压力'], meaning: '语言和立场容易成为焦点，适合把表达能力用于协商并减少无谓消耗。' },
};
const tradition = {
  title: '《钦定协纪辨方书》卷二·大游年变卦', sourceUrl: 'https://www.shidianguji.com/book/SK1619/chapter/1l9llp3fvijvs',
  scope: '大游年原为宅卦相配之法；号码解读借用其卦变关系作民俗取象。',
  numberMapping: '后天卦数：1坎、2坤、3震、4巽、6乾、7兑、8艮、9离。',
  conversion: '字母按 A=1 至 Z=26 展开；两端有效卦数之间的 0 取隐藏、5 取增强，头尾的 0、5 单独记录。',
};
const labels = { phone: '手机号', plate: '车牌号', general: '数字字母编号' } as const;
const reduce = (value: bigint) => Number(value % 80n) || 80;

export function numberEnergyPair(left: string, right: string) {
  const fromGua = gua[left], toGua = gua[right];
  if (!fromGua || !toGua) throw new Error('八星卦数须为 1、2、3、4、6、7、8、9。');
  const trigram = (digit: string, name: string) => {
    const item = Object.values(trigrams).find((value) => value.name === name)!;
    return { digit: Number(digit), name, symbol: item.symbol, element: item.element, lines: [...item.lines] };
  };
  const from = trigram(left, fromGua), to = trigram(right, toGua), name = bazhaiPalaces(fromGua).find((item) => item.gua === toGua)!.label;
  const definition = definitions[name];
  if (!definition) throw new Error('八宅卦变缺少对应的八星资料。');
  const changedLines = from.lines.flatMap((line, index) => line === to.lines[index] ? [] : [index + 1]);
  const changedLineText = changedLines.length ? `${changedLines.map((line) => ['下爻', '中爻', '上爻'][line - 1]).join('、')}变化` : '三爻相同';
  return { from, to, name, starName: definition.star, changedLines, changedLineText,
    explanation: `${left}为${from.name}${from.symbol}，${right}为${to.name}${to.symbol}；${changedLineText}，大游年对应${name}、${definition.star}。` };
}

function calculateData(source: Source) {
  const purpose = source.purpose ?? 'general', input = { value: source.value, purpose, ...(source.prompt ? { prompt: source.prompt } : {}) };
  const normalized = source.value.replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).trim().replace(/[a-z]/g, (char) => char.toUpperCase()).replace(/[\s-]/g, '');
  if (!normalized || normalized.length > 64) throw new Error('请输入 1 至 64 位号码。');
  const chars = [...normalized], digits = chars.filter((char) => /[0-9]/.test(char)), letters = chars.filter((char) => /[A-Z]/.test(char));
  if (!digits.length && !letters.length) throw new Error('号码中需包含数字或英文字母。');
  const alphanumeric = chars.filter((char) => /[0-9A-Z]/.test(char)).join('');
  const excludedCharacters = [...new Set(chars.filter((char) => !/[0-9A-Z·.()]/.test(char)))];
  const digitSum = digits.reduce((total, digit) => total + Number(digit), 0), alphanumericSum = digitSum + letters.reduce((total, letter) => total + letter.charCodeAt(0) - 64, 0);
  const primaryIndex = purpose === 'plate' ? reduce(BigInt(alphanumericSum)) : reduce(digits.length ? BigInt(digits.join('')) : BigInt(alphanumericSum)), sumIndex = reduce(BigInt(alphanumericSum));
  const letterConversions: Array<{ letter: string; value: number; digits: string }> = [], sequence: Array<{ digit: number; source: string; sourceIndex: number; energyIndex: number }> = [];
  for (const [sourceIndex, char] of [...alphanumeric].entries()) {
    const converted = /[A-Z]/.test(char) ? String(char.charCodeAt(0) - 64) : char;
    if (/[A-Z]/.test(char)) letterConversions.push({ letter: char, value: Number(converted), digits: converted });
    for (const digit of converted) sequence.push({ digit: Number(digit), source: char, sourceIndex, energyIndex: sequence.length });
  }
  const pairs: Array<{
    pair: string; span: string; start: number; end: number; sourceText: string; sourceStart: number; sourceEnd: number;
    name: string; nature: '助益' | '守成' | '考验'; keywords: string[]; meaning: string;
    trigramEvidence: ReturnType<typeof numberEnergyPair>; modifiers: Array<{ digit: 0 | 5; effect: '隐藏' | '增强' }>;
  }> = [];
  let previous: typeof sequence[number] | undefined;
  for (const item of sequence) {
    if (item.digit === 0 || item.digit === 5) continue;
    if (previous) {
      const pair = `${previous.digit}${item.digit}`, trigramEvidence = numberEnergyPair(String(previous.digit), String(item.digit)), info = definitions[trigramEvidence.name];
      const modifiers = sequence.slice(previous.energyIndex + 1, item.energyIndex).map((value) => ({ digit: value.digit as 0 | 5, effect: value.digit === 0 ? '隐藏' as const : '增强' as const }));
      pairs.push({ pair, span: sequence.slice(previous.energyIndex, item.energyIndex + 1).map((value) => value.digit).join(''), start: previous.energyIndex, end: item.energyIndex,
        sourceText: alphanumeric.slice(previous.sourceIndex, item.sourceIndex + 1), sourceStart: previous.sourceIndex, sourceEnd: item.sourceIndex,
        name: trigramEvidence.name, nature: info.nature, keywords: [...info.keywords], meaning: info.meaning, trigramEvidence, modifiers });
    }
    previous = item;
  }
  const modifiers = sequence.filter((item) => item.digit === 0 || item.digit === 5).map((item) => {
    const pair = pairs.find((value) => value.start < item.energyIndex && value.end > item.energyIndex);
    const left = sequence.some((value) => value.energyIndex < item.energyIndex && value.digit !== 0 && value.digit !== 5);
    const right = sequence.some((value) => value.energyIndex > item.energyIndex && value.digit !== 0 && value.digit !== 5);
    const placement = pair ? '组内' : left ? '尾部' : right ? '头部' : '独立', effect = item.digit === 0 ? '隐藏' as const : '增强' as const;
    return { digit: item.digit as 0 | 5, position: item.energyIndex, effect, placement,
      relatedPair: pair ? { pair: pair.pair, span: pair.span, name: pair.name, start: pair.start, end: pair.end } : null,
      meaning: pair ? `${pair.span} 取 ${pair.pair}，对应${pair.name}；按夹数口径，${item.digit}取${effect}象意。` : `${placement}位置，两端有效数字不足，保留${item.digit}的位置供整体阅读。` };
  });
  const order = ['天医', '生气', '延年', '伏位', '绝命', '五鬼', '六煞', '祸害'];
  const distribution = order.map((name) => ({ name, nature: definitions[name].nature, count: pairs.filter((pair) => pair.name === name).length, keywords: [...definitions[name].keywords] })).filter((item) => item.count > 0);
  const maxCount = Math.max(0, ...distribution.map((item) => item.count));
  const segments: Array<{ name: string; nature: typeof pairs[number]['nature']; start: number; end: number; pairCount: number; span: string }> = [];
  for (const pair of pairs) {
    const last = segments.at(-1);
    if (last?.name === pair.name) { last.end = pair.end; last.pairCount++; last.span = sequence.slice(last.start, last.end + 1).map((item) => item.digit).join(''); }
    else segments.push({ name: pair.name, nature: pair.nature, start: pair.start, end: pair.end, pairCount: 1, span: pair.span });
  }
  return { input, normalized, alphanumeric, excludedCharacters, digitCount: digits.length, letterCount: letters.length, digitSum, alphanumericSum,
    oddCount: digits.filter((digit) => Number(digit) % 2 === 1).length, evenCount: digits.filter((digit) => Number(digit) % 2 === 0).length,
    repeatedGroups: alphanumeric.match(/(.)\1+/g) ?? [], primaryIndex, primaryNumerology: structuredClone(numerology[primaryIndex - 1]), sumIndex, sumNumerology: structuredClone(numerology[sumIndex - 1]),
    formula: purpose === 'plate' ? '数字按原值、字母按 A=1 至 Z=26 相加，再按 80 循环取数。' : digits.length ? '提取全部数字组成整数，再按 80 循环取数；整除时取 80。' : '数字与字母序号相加，再按 80 循环取数；整除时取 80。',
    tradition: { ...tradition }, letterConversions, energySequence: sequence.map((item) => item.digit).join(''), energyPairs: pairs, modifiers, magneticDistribution: distribution, magneticSegments: segments,
    dominantFields: maxCount > 1 ? distribution.filter((item) => item.count === maxCount).map((item) => item.name) : [],
    magneticSummary: { pairCount: pairs.length, supportiveCount: pairs.filter((item) => item.nature === '助益').length, steadyCount: pairs.filter((item) => item.nature === '守成').length, challengingCount: pairs.filter((item) => item.nature === '考验').length },
    limitation: '八星与数理为民俗取象；号码频次不证明现实效果、个人经历或事件结果。数理资料和古籍来源仍需独立核验。' };
}
type Data = ReturnType<typeof calculateData>;
function buildMagneticFlowSummary(data: Data): string {
  if (!data.energyPairs.length) return '';
  const first = data.energyPairs[0];
  const last = data.energyPairs.at(-1)!;
  const endsWithZero = data.energySequence.endsWith('0');
  const remedies: string[] = [];
  for (let i = 0; i < data.energyPairs.length - 1; i++) {
    const cur = data.energyPairs[i].name;
    const next = data.energyPairs[i + 1].name;
    const afterNext = data.energyPairs[i + 2]?.name;
    if (cur === '绝命' && next === '天医') remedies.push(`第${i + 1}→${i + 2}组「绝命→天医」（天医制绝命，化冲动投入为成果资源）`);
    if (cur === '六煞' && next === '延年') remedies.push(`第${i + 1}→${i + 2}组「六煞→延年」（延年制六煞，以责任定力收束人际情绪）`);
    if (cur === '五鬼' && next === '生气' && (afterNext === '天医' || afterNext === '延年')) {
      remedies.push(`第${i + 1}→${i + 3}组「五鬼→生气→${afterNext}」（生气通化五鬼之变）`);
    }
    if (cur === '祸害' && (next === '生气' || next === '延年' || next === '伏位')) {
      remedies.push(`第${i + 1}→${i + 2}组「祸害→${next}」（缓和口舌消耗）`);
    }
  }
  const tailNote = endsWithZero
    ? `尾数以 0 收口（夹数口径视为尾位隐藏/空散），末组八星为${last.name}（${last.nature}）`
    : `尾组收口落在「${last.span}」${last.name}（${last.nature}，主${last.keywords.join('、')}）`;
  return `起首八星：「${first.span}」${first.name}（${first.nature}）；${tailNote}；整体配比：助益${data.magneticSummary.supportiveCount}组、守成${data.magneticSummary.steadyCount}组、考验${data.magneticSummary.challengingCount}组。${remedies.length ? `\n相邻制化关系：${remedies.join('；')}。` : ''}`;
}
function render(data: Data, question: string, options: Input['prompt']) {
  const seenStars = new Set<string>();
  const pairs = data.energyPairs.map((item, index) => {
    const firstSeen = !seenStars.has(item.name);
    seenStars.add(item.name);
    const spanLabel = item.span === item.pair ? item.pair : `${item.span} → ${item.pair}`;
    const desc = firstSeen ? `${item.keywords.join('、')}：${item.meaning}` : `同取${item.name}之象`;
    return `${index + 1}. ${spanLabel}：${item.name}（${item.nature}）；序列第${item.start + 1}至${item.end + 1}位，原字「${item.sourceText}」；${item.trigramEvidence.explanation}${item.modifiers.length ? `夹数${item.modifiers.map((modifier) => `${modifier.digit}${modifier.effect}`).join('、')}；` : ''}${desc}`;
  });
  const flowSummary = buildMagneticFlowSummary(data);
  const task = data.input.purpose === 'phone' ? '结合日常联系与号码辨识讨论。' : data.input.purpose === 'plate' ? '结合实际出行、辨识和审美讨论；驾驶安全以交通规则和实际情况为准。' : '结合用户说明的实际用途讨论。';
  const text = [`【号码资料】\n类型：${labels[data.input.purpose]}；原文：${data.input.value}；归一：${data.normalized}；参与序列：${data.alphanumeric}。\n字母换算：${data.letterConversions.map((item) => `${item.letter}=${item.value}`).join('、') || '无'}；展开序列：${data.energySequence}。${data.excludedCharacters.length ? `\n未参与计算的标记：${data.excludedCharacters.join('、')}。` : ''}`,
    `【八星配对】\n${pairs.join('\n') || '有效卦数不足，未形成八星配对。'}\n分布：${data.magneticDistribution.map((item) => `${item.name}${item.count}组`).join('、') || '无'}；连续段：${data.magneticSegments.map((item) => `${item.name}${item.span}（${item.pairCount}组）`).join(' → ') || '无'}。${flowSummary ? `\n${flowSummary}` : ''}`,
    `【0与5】\n${data.modifiers.map((item) => `序列第${item.position + 1}位：${item.digit}，${item.meaning}`).join('\n') || '无'}`,
    `【数理取数】\n${data.formula}\n主数${data.primaryIndex}：${data.primaryNumerology.poem}（${data.primaryNumerology.level}），${data.primaryNumerology.keywords}；数值和取数${data.sumIndex}：${data.sumNumerology.poem}（${data.sumNumerology.level}），${data.sumNumerology.keywords}。`,
    `【传统依据】\n${data.tradition.title}；${data.tradition.sourceUrl}\n${data.tradition.scope}\n${data.tradition.numberMapping}\n${data.tradition.conversion}`,
    options?.subtopicId ? '【解读选择】\n号码能量；自定义范围。' : '', `【任务与限制】\n${task}${data.limitation} 结合实际序列、顺序与夹数解释，不将统计次数当成作用强弱。`, `【问题】\n${question}`].filter(Boolean).join('\n\n');
  return { text };
}
export function numberEnergy(input: Input) {
  const data = calculateData(input);
  return { data, summary: { title: '数字能量', lines: [`${labels[data.input.purpose]}：${data.energyPairs.length} 组八星配对`, `数理主数：${data.primaryIndex}`] }, prompt: render(data, input.question, input.prompt) };
}
export function promptForSavedNumberEnergy(data: unknown, source: Source, question: string, options?: Input['prompt']) {
  const expected = calculateData(source);
  if (!sameJsonValue(data, expected)) throw new Error('数字能量结果与输入号码不一致。');
  return render(expected, question, options ?? source.prompt);
}
