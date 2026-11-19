import { inputSchemas, type Method } from '../schema';
import { requireSavedInput, rejectPromptOptions, type RepromptHandler } from './shared';

const chineseName: RepromptHandler = async ({ request, data, promptOptions, context }) => {
  requireSavedInput(data, '姓名结果缺少输入资料。');
  if (request.method === 'chinese-name') {
    const saved = inputSchemas['chinese-name'].parse({ ...data.input, question: request.question });
    const { question: _question, currentTime: _time, ...source } = saved;
    const options = inputSchemas['chinese-name'].shape.prompt.parse(promptOptions);
    return await (await import('../systems/chinese-name')).promptForSavedChineseName(data, source, request.question, options, context?.characterShard);
  }
  const saved = inputSchemas['chinese-naming'].parse({ ...data.input, question: request.question });
  const { question: _question, currentTime: _time, ...source } = saved;
  const options = inputSchemas['chinese-naming'].shape.prompt.parse(promptOptions);
  return await (await import('../systems/chinese-naming')).promptForSavedChineseNaming(data, source, request.question, options, context?.characterShard);
};

export const referenceHandlers = {
  'zhouyi': async ({ request, data, promptOptions }) => {
    requireSavedInput(data, '周易结果缺少查询资料。');
    rejectPromptOptions(promptOptions, '周易经文查询不支持提示词选项。');
    const saved = inputSchemas.zhouyi.parse(data.input);
    return (await import('../systems/zhouyi')).promptForZhouyi(data, saved, request.question);
  },
  'calendar': async ({ request, data, promptOptions }) => {
    requireSavedInput(data, '历法结果缺少输入资料。');
    rejectPromptOptions(promptOptions, '历法资料不支持提示词选项。');
    const saved = inputSchemas.calendar.parse(data.input);
    return await (await import('../systems/calendar-tool')).promptForCalendar(data, saved, request.question);
  },
  'bazi-reverse': async ({ request, data, promptOptions }) => {
    requireSavedInput(data, '四柱反推结果缺少输入资料。');
    rejectPromptOptions(promptOptions, '四柱反推不支持提示词选项。');
    const saved = inputSchemas['bazi-reverse'].parse(data.input);
    return (await import('../systems/bazi-reverse')).promptForBaziReverse(data, saved, request.question);
  },
  'chinese-name': chineseName,
  'chinese-naming': chineseName,
  'character-query': async ({ request, data, promptOptions, context }) => {
    const saved = inputSchemas['character-query'].parse({ query: data.query, question: request.question });
    rejectPromptOptions(promptOptions, '汉字查询不支持提示词选项。');
    return await (await import('../systems/character-query')).promptForSavedCharacterQuery(data, saved.query, request.question, context?.characterShard);
  },
  'number-energy': async ({ request, data, promptOptions }) => {
    requireSavedInput(data, '数字能量结果缺少号码资料。');
    const saved = inputSchemas['number-energy'].parse({ ...data.input, question: request.question });
    const options = inputSchemas['number-energy'].shape.prompt.parse(promptOptions);
    return (await import('../systems/number-energy')).promptForSavedNumberEnergy(data, saved, request.question, options);
  },
  'instant': async ({ request, data, promptOptions }) => {
    requireSavedInput(data, '即时盘缺少起盘资料。');
    rejectPromptOptions(promptOptions, '即时盘不支持提示词选项。');
    const saved = inputSchemas.instant.parse({ ...data.input, question: request.question });
    return await (await import('../systems/instant')).promptForSavedInstant(data, saved, request.question);
  },
  'almanac': async ({ request, data, promptOptions }) => {
    requireSavedInput(data, '黄历结果缺少原始资料。');
    const saved = inputSchemas.almanac.parse({ ...data.input, question: request.question });
    const options = inputSchemas.almanac.shape.prompt.parse(promptOptions);
    const module = await import('../systems/almanac');
    return await module.promptForSavedAlmanac(data, saved, request.question, options);
  },
  'huangji-jingshi': async ({ request, data, currentTime, promptOptions }) => {
    if (data.kind === 'range') {
      requireSavedInput(data, '皇极经世范围结果缺少原始输入。');
      const original = data.input;
      const input = inputSchemas['huangji-jingshi'].parse({ huangji: original.huangji, range: original.range, question: request.question, prompt: promptOptions });
      if (input.huangji.mode !== 'datetime') throw new Error('皇极范围仅支持年月日时模式。');
      const module = await import('../systems/huangji-chart');
      return await module.promptForHuangjiRange(data, { ...input, huangji: input.huangji }, currentTime);
    }
    const input = inputSchemas['huangji-jingshi'].parse({ huangji: data.input, question: request.question, prompt: promptOptions });
    if (input.huangji.mode === 'reference') {
      const module = await import('../systems/huangji-tables');
      return module.promptForHuangjiReference(data, { ...input, huangji: input.huangji }, currentTime);
    }
    const module = await import('../systems/huangji-chart');
    return await module.promptForHuangjiChart(data, { ...input, huangji: input.huangji }, currentTime);
  },
  'residential': async ({ request, data, promptOptions }) => {
    requireSavedInput(data, '住宅风水结果缺少原始资料。');
    const saved = inputSchemas.residential.parse({ ...data.input, question: request.question });
    const options = inputSchemas.residential.shape.prompt.parse(promptOptions);
    const module = await import('../systems/residential');
    return module.promptForSavedResidential(data, { person: saved.person, orientation: saved.orientation, construction: saved.construction, mode: saved.mode, confirmJianXiang: saved.confirmJianXiang, flow: saved.flow }, request.question, options);
  },
  'xuankong': async ({ request, data, promptOptions }) => {
    requireSavedInput(data, '玄空结果缺少原始资料。');
    const saved = inputSchemas.xuankong.parse({ ...data.input, question: request.question });
    const options = inputSchemas.xuankong.shape.prompt.parse(promptOptions);
    const module = await import('../systems/xuankong');
    return module.promptForSavedXuankong(data, { construction: saved.construction, orientation: saved.orientation, mode: saved.mode, confirmJianXiang: saved.confirmJianXiang, flow: saved.flow }, request.question, options);
  },
  'bazhai': async ({ request, data, promptOptions }) => {
    requireSavedInput(data, '八宅结果缺少原始资料。');
    const saved = inputSchemas.bazhai.parse({ ...data.input, question: request.question });
    const options = inputSchemas.bazhai.shape.prompt.parse(promptOptions);
    const module = await import('../systems/bazhai');
    return module.promptForSavedBazhai(data, { person: saved.person, house: saved.house }, request.question, options);
  },
} satisfies Partial<Record<Method, RepromptHandler>>;
