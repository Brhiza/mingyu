import type { z } from 'zod';
import type { zhugeInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { resolvePromptSelection } from '../prompt-selection';
import { randomContext } from './random';
import strokeData from './zhuge-strokes.json';
import signData from './zhuge-signs.json';
import coinEntries from './kongming-data.json';
import { buildMethodSituationDigest } from './situation-digest';

type Input = z.infer<typeof zhugeInput>;
const strokesByCharacter: Record<string, number> = strokeData;
type CoinEntry = (typeof coinEntries)[number];
type CoinData = CoinEntry & {
  mode: 'coins';
  draws: { index: number; symbol: string; polarity: string }[];
  draw: { method: 'random' | 'manual' };
};

function buildSignFromDigits(digits: number[]) {
  const rawNumber = digits[0]! * 100 + digits[1]! * 10 + digits[2]!;
  const number = rawNumber % 384 || 384;
  const sign = signData[number - 1];
  if (!sign || sign.number !== number || !sign.interpretation) {
    throw new Error('签谱资料不完整。');
  }
  return {
    rawNumber,
    number,
    sign: { number, poem: sign.poem, summary: sign.interpretation.interpretation },
    sourceSummary: sign.summary,
    interpretation: structuredClone(sign.interpretation),
  };
}

function makeTextData(text: string) {
  const chars = [...text.trim()];
  if (chars.length !== 3) throw new Error('诸葛神数汉字取签需输入恰好三个汉字。');
  const strokes = chars.map((character) => {
    if (!Object.hasOwn(strokesByCharacter, character)) {
      throw new Error(`笔画资料未收录“${character}”。`);
    }
    return strokesByCharacter[character];
  });
  const digits = strokes.map((count) => count % 10);
  return {
    mode: 'text' as const,
    text: chars.join(''),
    chars,
    strokes,
    digits,
    ...buildSignFromDigits(digits),
  };
}

function makeNumbersData(numbers: readonly [number, number, number]) {
  if (numbers.length !== 3 || numbers.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new Error('诸葛神数数字取签需提供三个非负整数。');
  }
  const normalized = [numbers[0], numbers[1], numbers[2]] as [number, number, number];
  const digits = normalized.map((n) => n % 10);
  return {
    mode: 'numbers' as const,
    numbers: normalized,
    digits,
    ...buildSignFromDigits(digits),
  };
}

function normalizeCoinPattern(pattern: string) {
  const symbol = pattern.trim().replace(/[阳正公1]/g, '●').replace(/[阴反字0]/g, '○');
  if (!/^[●○]{5}$/u.test(symbol)) throw new Error('五枚铜钱卦象需由五个阴阳结果组成。');
  return symbol;
}

function makeCoinsData(symbol: string, method: 'random' | 'manual'): CoinData {
  const entry = coinEntries.find((item) => item.symbol === symbol);
  if (!entry) throw new Error('未找到对应的诸葛神数铜钱卦象。');
  return {
    mode: 'coins',
    ...structuredClone(entry),
    draws: [...symbol].map((value, index) => ({
      index: index + 1,
      symbol: value,
      polarity: value === '●' ? '阳' : '阴',
    })),
    draw: { method },
  };
}

type TextData = ReturnType<typeof makeTextData>;
type NumbersData = ReturnType<typeof makeNumbersData>;
type SignData = TextData | NumbersData;

function buildSignPrompt(data: SignData, question: string, options: Input['prompt'], now: string) {
  const selected = resolvePromptSelection('zhuge', options);
  const detail = data.interpretation;
  const castHeader =
    data.mode === 'numbers'
      ? `【取数】\n报数：${data.numbers.join('、')}；各取个位：${data.digits.join('、')}\n三位数：${String(data.rawNumber).padStart(3, '0')}；按 384 爻象数循环：第${data.number}签。`
      : (() => {
          const parityText = data.strokes
            .map((s, i) => `第${i + 1}字「${data.chars[i]}」${s}画（${s % 2 === 1 ? '阳/奇' : '阴/偶'}）`)
            .join('、');
          return `【取数】\n三字：${data.text}（${parityText}）\n笔画：${data.strokes.join('、')}；各取个位：${data.digits.join('、')}\n三位数：${String(data.rawNumber).padStart(3, '0')}；按 384 爻象数循环：第${data.number}签。`;
        })();
  const basisNote =
    data.mode === 'numbers'
      ? '【资料口径】\n以本次三数字取数和签诗为主，原项目的摘要及解说为辅助；签谱版本和资料出处尚待独立核验。'
      : '【资料口径】\n以本次三字取数和签诗为主，原项目的摘要及解说为辅助；字形笔画口径、签谱版本和资料出处尚待独立核验。';
  const digestLines = buildMethodSituationDigest('zhuge', data, question);
  const user = [
    basisNote,
    digestLines.length ? `【局势要点】\n${digestLines.join('\n')}` : '',
    `【时间】\n提示词时间：${now}。`,
    castHeader,
    `【签诗】\n${data.sign.poem}`,
    `【辅助解说】\n原资料摘要：${data.sourceSummary}\n诗句：${detail.quote}\n取象：${detail.imageMeaning}\n解释：${detail.interpretation}\n条件：${detail.condition}`,
    detail.classicalImage
      ? `【传统取象资料】\n${detail.classicalImage}\n此处为项目原有辅助说明，不等同于已核验的签谱出处。`
      : '',
    selected ? `【解读选择】\n${selected.section}` : '',
    options?.includeClassics && !detail.classicalImage
      ? '【来源说明】\n当前签谱来源尚待独立核验，不补造经典出处。'
      : '',
    `【任务】\n依据取数、签诗及辅助解说回应问题，逐句说明意象、转折与成立条件；区分签诗和后人解说，不把签义当成必然发生的事实。${selected ? `\n${selected.task}` : ''}`,
    `【问题】\n${question}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { text: user };
}

function buildCoinsPrompt(data: CoinData, question: string, options: Input['prompt'], now: string) {
  const selected = resolvePromptSelection('zhuge', options);
  const interpretation = data.interpretation;
  const classical = interpretation.classicalImage;
  const yangCount = data.draws.filter((d) => d.polarity === '阳').length;
  const yinCount = 5 - yangCount;
  const polarityBalance =
    yangCount === 5
      ? '五阳纯全（阳刚急速，宜防过刚易折）'
      : yinCount === 5
        ? '五阴纯静（阴柔含蓄，宜守正待时）'
        : `五币阴阳比 ${yangCount}阳${yinCount}阴（${yangCount > yinCount ? '阳多阴少，主动外显居多' : '阴多阳少，稳守内蓄居多'}）`;
  const user = [
    '【资料口径】\n以本次卦诗和五枚铜钱的结果为主，项目原有释义为辅助；卦谱版本及历史来源尚待独立核验。',
    `【时间】\n提示词时间：${now}。`,
    `【卦象】\n五枚铜钱：${data.draws.map((item) => `${item.index}:${item.polarity}`).join('、')}（${polarityBalance}）\n第${data.number}卦 ${data.name}（${data.grade}）\n卦诗：${data.poem}`,
    `【辅助释义】\n诗句：${interpretation.quote}\n取象：${interpretation.imageMeaning}\n解释：${interpretation.interpretation}\n条件：${interpretation.condition}`,
    classical
      ? `【传统取象资料】\n项目原资料将${classical.element}与${classical.title}“${classical.quote}”相联系：${classical.meaning}。该联系是辅助取象，不等同于已核验的卦谱出处。`
      : '',
    selected ? `【解读选择】\n${selected.section}` : '',
    options?.includeClassics && !classical
      ? '【来源说明】\n当前卦谱来源尚待独立核验，不补造经典出处。'
      : '',
    `【任务】\n依据本卦卦诗、阴阳结果及辅助释义回应问题，逐句说明取象、转折与成立条件；区分卦诗原文和后人解说，不把等第或卦辞当成必然发生的事实。${selected ? `\n${selected.task}` : ''}`,
    `【问题】\n${question}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  return { text: user };
}

export function calculateZhuge(input: Input, now: string, source?: () => number) {
  const mode =
    input.zhuge.method ??
    (input.zhuge.pattern !== undefined
      ? 'coins'
      : input.zhuge.numbers !== undefined
        ? 'numbers'
        : 'text');

  if (mode === 'coins') {
    const pattern = input.zhuge.pattern;
    const drawMethod = pattern === undefined ? 'random' : 'manual';
    const random = randomContext(source);
    const symbol =
      pattern === undefined
        ? Array.from({ length: 5 }, () => (random.integer(2) ? '●' : '○')).join('')
        : normalizeCoinPattern(pattern);
    const data = makeCoinsData(symbol, drawMethod);
    return {
      data,
      summary: {
        title: '诸葛神数',
        tags: ['五枚铜钱', `卦象：${data.symbol}`, data.name, data.grade],
        lines: [data.poem],
      },
      prompt: buildCoinsPrompt(data, input.question, input.prompt, now),
    };
  }

  if (mode === 'numbers') {
    const data = makeNumbersData(input.zhuge.numbers!);
    return {
      data,
      summary: {
        title: '诸葛神数',
        tags: [`数字：${data.numbers.join('·')}`, `第${data.number}签`],
        lines: [data.sign.poem],
      },
      prompt: buildSignPrompt(data, input.question, input.prompt, now),
    };
  }

  const data = makeTextData(input.zhuge.text!);
  return {
    data,
    summary: {
      title: '诸葛神数',
      tags: [`三字：${data.text}`, `第${data.number}签`],
      lines: [data.sign.poem],
    },
    prompt: buildSignPrompt(data, input.question, input.prompt, now),
  };
}

export function promptForZhuge(value: unknown, question: string, options: Input['prompt'], now: string) {
  const raw = (value && typeof value === 'object' ? value : undefined) as
    | {
        mode?: unknown;
        symbol?: unknown;
        draw?: { method?: unknown };
        numbers?: unknown;
        text?: unknown;
      }
    | undefined;
  if (!raw) throw new Error('诸葛神数结果缺少有效资料。');

  if (raw.mode === 'coins' || typeof raw.symbol === 'string') {
    if (
      !raw.draw ||
      (raw.draw.method !== 'random' && raw.draw.method !== 'manual') ||
      typeof raw.symbol !== 'string'
    ) {
      throw new Error('诸葛神数铜钱结果缺少有效卦象或起卦方式。');
    }
    const expected = makeCoinsData(normalizeCoinPattern(raw.symbol), raw.draw.method);
    if (!sameJsonValue(raw, expected)) {
      throw new Error('卦面或五枚铜钱的结果与卦象不一致。');
    }
    return buildCoinsPrompt(expected, question, options, now);
  }

  if (raw.mode === 'numbers' || Array.isArray(raw.numbers)) {
    if (!Array.isArray(raw.numbers) || raw.numbers.length !== 3) {
      throw new Error('诸葛神数数字取签结果缺少三组数字。');
    }
    const expected = makeNumbersData([raw.numbers[0], raw.numbers[1], raw.numbers[2]] as [
      number,
      number,
      number,
    ]);
    if (!sameJsonValue(raw, expected)) {
      throw new Error('取数或签面与输入的数字不一致。');
    }
    return buildSignPrompt(expected, question, options, now);
  }

  if (typeof raw.text !== 'string') {
    throw new Error('诸葛神数结果缺少有效取数或卦象资料。');
  }
  const expected = makeTextData(raw.text);
  if (!sameJsonValue(raw, expected)) {
    throw new Error('笔画、取数或签面与输入的三字不一致。');
  }
  return buildSignPrompt(expected, question, options, now);
}
