import { inputSchemas, type Method } from '../schema';
import type { RuntimeContext } from '../runtime-context';
import type { RepromptHandler } from './shared';
import { requireSavedInput } from './shared';

type BirthSavedMethod =
  | 'astrolabe-range'
  | 'astrolabe-synastry'
  | 'astrolabe'
  | 'bazi-ziwei'
  | 'ziwei-synastry'
  | 'ziwei'
  | 'qizheng-range'
  | 'qizheng'
  | 'minglu';

function makeSavedBirthHandler<M extends BirthSavedMethod>(
  method: M,
  missingMessage: string,
  run: (
    data: unknown,
    saved: ReturnType<(typeof inputSchemas)[M]['parse']>,
    question: string,
    options: ReturnType<(typeof inputSchemas)[M]['shape']['prompt']['parse']>,
    context?: RuntimeContext,
  ) => Promise<{ text: string }>,
): RepromptHandler {
  return async ({ request, data, promptOptions, context }) => {
    requireSavedInput(data, missingMessage);
    const schema = inputSchemas[method];
    const saved = schema.parse({ ...data.input, question: request.question }) as ReturnType<(typeof inputSchemas)[M]['parse']>;
    const options = schema.shape.prompt.parse(promptOptions) as ReturnType<(typeof inputSchemas)[M]['shape']['prompt']['parse']>;
    return run(data, saved, request.question, options, context);
  };
}

export const birthHandlers = {
  'astrolabe-range': makeSavedBirthHandler('astrolabe-range', '星盘出生范围结果缺少输入。', async (data, saved, question, options, context) =>
    (await import('../systems/astrolabe-range')).promptForSavedAstrolabeRange(data, saved, question, options, context)),
  'astrolabe-synastry': makeSavedBirthHandler('astrolabe-synastry', '双盘结果缺少出生资料。', async (data, saved, question, options, context) =>
    (await import('../systems/astrolabe-synastry')).promptForSavedAstrolabeSynastryIndependent(data, saved, question, options, context)),
  'astrolabe': makeSavedBirthHandler('astrolabe', '星盘结果缺少出生资料。', async (data, saved, question, options, context) =>
    (await import('../systems/astrolabe')).promptForSavedAstrolabeIndependent(data, saved, question, options, context)),
  'bazi-ziwei': makeSavedBirthHandler('bazi-ziwei', '合参结果缺少出生资料。', async (data, saved, question, options, context) =>
    (await import('../systems/bazi-ziwei')).promptForSavedBaziZiweiIndependent(data, saved, question, options, context)),
  'ziwei-synastry': makeSavedBirthHandler('ziwei-synastry', '紫微双盘结果缺少双方出生资料。', async (data, saved, question, options) =>
    (await import('../systems/ziwei-synastry')).promptForSavedZiweiSynastryIndependent(data, saved, question, options)),
  'ziwei': makeSavedBirthHandler('ziwei', '紫微结果缺少出生资料。', async (data, saved, question, options) =>
    (await import('../systems/ziwei')).promptForSavedZiweiIndependent(data, saved, question, options)),
  'qizheng-range': makeSavedBirthHandler('qizheng-range', '七政出生范围结果缺少输入。', async (data, saved, question, options) =>
    (await import('../systems/qizheng-range')).promptForSavedQizhengRange(data, saved, question, options)),
  'qizheng': makeSavedBirthHandler('qizheng', '七政四余结果缺少出生资料。', async (data, saved, question, options) =>
    (await import('../systems/qizheng')).promptForSavedQizheng(data, saved, question, options)),
  'minglu': makeSavedBirthHandler('minglu', '命录结果缺少出生资料。', async (data, saved, question, options, context) => {
    const { question: _q, currentTime: _t, prompt: _p, ...source } = saved;
    return (await import('../systems/minglu')).promptForSavedMinglu(data, source, question, options, context);
  }),
  'fortune': async ({ request, data, currentTime, promptOptions, context }) => {
    requireSavedInput(data, '运势结果缺少输入资料。');
    const saved = inputSchemas['fortune'].parse({ ...data.input, question: request.question });
    const options = inputSchemas['fortune'].shape.prompt.parse(promptOptions);
    const { question: _q, prompt: _p, ...source } = saved;
    return (await import('../systems/fortune')).promptForSavedFortune(data, source, request.question, options, currentTime, context);
  },
  'bazi-synastry': async ({ request, data, promptOptions, context }) => {
    requireSavedInput(data, '八字双盘结果缺少双方出生资料。');
    const saved = inputSchemas['bazi-synastry'].parse({ ...data.input, question: request.question, prompt: promptOptions });
    const module = await import('../systems/bazi-synastry');
    return await module.promptForSavedBaziSynastryIndependent(data, { person1: saved.person1, person2: saved.person2, relationship: saved.relationship, ...(saved.referenceTime ? { referenceTime: saved.referenceTime } : {}), ...(saved.syncYears ? { syncYears: saved.syncYears } : {}), compareCandidates: saved.compareCandidates, comparisonPage: saved.comparisonPage }, request.question, saved.prompt, context);
  },
  'bazi': async ({ request, data, promptOptions, context }) => {
    requireSavedInput(data, '八字预览结果缺少原始出生资料。');
    const saved = inputSchemas['bazi'].parse({ ...data.input, question: request.question, prompt: promptOptions });
    const { birth, birthRange, gender, referenceTime, timelineYear, dailyRange, rules, prompt: options } = saved;
    const module = await import('../systems/bazi');
    return await module.promptForBaziIndependent(data, { birth, birthRange, gender, referenceTime, timelineYear, dailyRange, rules }, request.question, options, context);
  },
  'qimen-lifetime': async ({ request, data, currentTime, promptOptions }) => {
    requireSavedInput(data, '奇门终身局结果缺少原始出生资料。');
    const saved = inputSchemas['qimen-lifetime'].parse({ ...data.input, question: request.question, prompt: promptOptions });
    const { birth, birthRange, name, gender, method, juMethod, topics, stagePolicy, periodRange, prompt: options } = saved;
    const module = await import('../systems/qimen-lifetime');
    return await module.promptForQimenLifetime(data, { birth, birthRange, name, gender, method, juMethod, topics, stagePolicy, periodRange }, request.question, options, currentTime);
  },
} satisfies Partial<Record<Method, RepromptHandler>>;
