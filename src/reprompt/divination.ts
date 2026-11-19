import { inputSchemas, qimenScopeMatches, randomDivinationMethods, repromptInput, type Method } from '../schema';
import { requireSavedInput, type RepromptHandler } from './shared';

const randomDivinationHandler: RepromptHandler = async ({ request, data, currentTime, promptOptions, context }) => {
    if (typeof data.selectedMethod !== 'string' || !randomDivinationMethods.includes(data.selectedMethod as typeof randomDivinationMethods[number])
      || !data.result || typeof data.result !== 'object' || Array.isArray(data.result)
      || !('method' in data.result) || data.result.method !== data.selectedMethod) throw new Error('随机占法结果缺少一致的已选术数和盘面。');
    if (context?.enabledMethods && !context.enabledMethods.includes(data.selectedMethod)) throw new Error('原占法未在当前服务启用。');
    const selected = data.selectedMethod as typeof randomDivinationMethods[number];
    const nested = repromptInput.parse({ method: selected, result: data.result, question: request.question, currentTime });
    const handler: RepromptHandler = divinationHandlers[selected];
    return handler({ request: nested, data: nested.result.data, currentTime,
      promptOptions: promptOptions === undefined ? nested.result.promptOptions : promptOptions, context });
};

export const divinationHandlers = {
  'random-divination': randomDivinationHandler,
  'qimen': async ({ request, data, currentTime, promptOptions }) => {
    const module = await import('../systems/qimen');
    const options = inputSchemas.qimen.shape.prompt.parse(promptOptions);
    if (data.kind === 'range') {
      requireSavedInput(data, '奇门范围结果缺少原始输入。');
      const original = data.input;
      const input = inputSchemas.qimen.parse({ question: request.question, range: original.range, qimen: original.qimen, prompt: options });
      return await module.promptForQimenRange(data, input, currentTime);
    }
    if (!Array.isArray(data.jiuGongGe)) throw new Error('结果缺少必要盘面资料。');
    if (!qimenScopeMatches(String(data.scope), options?.scope)) throw new Error('提示词时间范围与奇门盘层级不一致。');
    return await module.promptForQimen(data, request.question, options, currentTime);
  },
  'taiyi': async ({ request, data, currentTime, promptOptions }) => {
    const module = await import('../systems/taiyi');
    if (data.kind === 'range') {
      requireSavedInput(data, '太乙范围结果缺少原始输入。');
      const original = data.input;
      const input = inputSchemas.taiyi.parse({ taiyi: original.taiyi, range: original.range, question: request.question, prompt: promptOptions });
      return await module.promptForTaiyiRange(data, input, currentTime);
    }
    const input = inputSchemas.taiyi.parse({ taiyi: data.input, question: request.question, prompt: promptOptions });
    return await module.promptForTaiyi(data, input, currentTime);
  },
  'liuyao': async ({ request, data, currentTime, promptOptions }) => {
    const module = await import('../systems/liuyao');
    const options = inputSchemas.liuyao.shape.prompt.parse(promptOptions);
    if (data.kind === 'range') {
      requireSavedInput(data, '六爻范围结果缺少原始输入。');
      const original = data.input;
      const input = inputSchemas.liuyao.parse({ range: original.range, liuyao: original.liuyao, question: request.question, prompt: options });
      return await (await import('../systems/liuyao-range')).promptForLiuyaoRange(data, input, currentTime);
    }
    return await module.promptForLiuyao(data, request.question, options, currentTime);
  },
  'meihua': async ({ request, data, currentTime, promptOptions }) => {
    const module = await import('../systems/meihua');
    const options = inputSchemas.meihua.shape.prompt.parse(promptOptions);
    return await module.promptForMeihua(data, request.question, options, currentTime);
  },
  'liuren': async ({ request, data, currentTime, promptOptions }) => {
    const module = await import('../systems/liuren');
    const options = inputSchemas.liuren.shape.prompt.parse(promptOptions);
    if (data.kind === 'range') {
      requireSavedInput(data, '大六壬范围结果缺少原始输入。');
      const original = data.input;
      const input = inputSchemas.liuren.parse({ question: request.question, range: original.range, liuren: original.liuren, prompt: options });
      return await module.promptForLiurenRange(data, input, currentTime);
    }
    return await module.promptForLiuren(data, request.question, options, currentTime);
  },
  'jinkoujue': async ({ request, data, currentTime, promptOptions }) => {
    const module = await import('../systems/jinkoujue');
    const options = inputSchemas.jinkoujue.shape.prompt.parse(promptOptions);
    if (data.kind === 'range') {
      requireSavedInput(data, '金口诀范围结果缺少原始输入。');
      const original = data.input;
      const input = inputSchemas.jinkoujue.parse({ question: request.question, range: original.range, jinkoujue: original.jinkoujue, prompt: options });
      return await module.promptForJinkouRange(data, input, currentTime);
    }
    return await module.promptForJinkoujue(data, request.question, options, currentTime);
  },
  'wuyun-liuqi': async ({ request, data, currentTime, promptOptions }) => {
    const module = await import('../systems/wuyun');
    const input = inputSchemas['wuyun-liuqi'].parse({ wuyun: data.input, question: request.question, prompt: promptOptions });
    return module.promptForWuyun(data, input, currentTime);
  },
  'xiaoliuren': async ({ request, data, currentTime, promptOptions }) => {
    if (typeof data.primary !== 'object' || data.primary === null) throw new Error('结果缺少必要盘面资料。');
    const module = await import('../systems/xiaoliuren');
    const options = inputSchemas.xiaoliuren.shape.prompt.parse(promptOptions);
    return module.promptForXiaoliuren(data, request.question, options, currentTime);
  },
  'tarot': async ({ request, data, currentTime, promptOptions }) => {
    if (!Array.isArray(data.cards)) throw new Error('结果缺少必要盘面资料。');
    const module = await import('../systems/tarot');
    const options = inputSchemas.tarot.shape.prompt.parse(promptOptions);
    return module.promptForTarot(data, request.question, options, currentTime);
  },
  'lenormand': async ({ request, data, currentTime, promptOptions }) => {
    if (!Array.isArray(data.cards)) throw new Error('结果缺少必要盘面资料。');
    const module = await import('../systems/lenormand');
    const options = inputSchemas.lenormand.shape.prompt.parse(promptOptions);
    return module.promptForLenormand(data, request.question, options, currentTime);
  },
  'ssgw': async ({ request, data, currentTime, promptOptions }) => {
    if (typeof data.number !== 'number') throw new Error('结果缺少必要盘面资料。');
    const module = await import('../systems/ssgw');
    const options = inputSchemas.ssgw.shape.prompt.parse(promptOptions);
    return module.promptForSsgw(data, request.question, options, currentTime);
  },
  'zhuge': async ({ request, data, currentTime, promptOptions }) => {
    const module = await import('../systems/zhuge');
    const options = inputSchemas.zhuge.shape.prompt.parse(promptOptions);
    return module.promptForZhuge(data, request.question, options, currentTime);
  },
} satisfies Partial<Record<Method, RepromptHandler>>;
