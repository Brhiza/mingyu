import type { z } from 'zod';
import { applyPromptGuidance } from './prompt-guidance';
import { applyPromptProfileToPrompt, resolveEffectivePromptProfile } from './prompt-profile';
import { inputSchemas, methodIds, type Method } from './schema';
import type { RuntimeContext } from './runtime-context';

type Calculators = {
  [M in Method]: (input: z.output<(typeof inputSchemas)[M]>, currentTime: string, context?: RuntimeContext) => object | Promise<object>;
};

// 每个方法只声明一次计算入口；动态导入让网页和 Node 按使用情况加载。
const calculators = {
  instant: async (input, now) => (await import('./systems/instant')).instant(input, now),
  'random-divination': async (input, now, context) => (await import('./systems/random-divination')).randomDivination(input, now, context, calculate),
  calendar: async (input) => (await import('./systems/calendar-tool')).calendarTool(input),
  zhouyi: async (input) => (await import('./systems/zhouyi')).zhouyi(input),
  'number-energy': async (input) => (await import('./systems/number-energy')).numberEnergy(input),
  'character-query': async (input, _now, context) => (await import('./systems/character-query')).characterQuery(input, context?.characterShard),
  'chinese-name': async (input, _now, context) => (await import('./systems/chinese-name')).chineseName(input, context?.characterShard),
  'chinese-naming': async (input, _now, context) => (await import('./systems/chinese-naming')).chineseNaming(input, context?.characterShard),
  'bazi-reverse': async (input) => (await import('./systems/bazi-reverse')).baziReverse(input),
  tarot: async (input, now) => (await import('./systems/tarot')).calculateTarot(input, now),
  lenormand: async (input, now) => (await import('./systems/lenormand')).calculateLenormand(input, now),
  xiaoliuren: async (input, now) => (await import('./systems/xiaoliuren')).calculateXiaoliuren(input, now),
  ssgw: async (input, now) => (await import('./systems/ssgw')).calculateSsgw(input, now),
  zhuge: async (input, now) => (await import('./systems/zhuge')).calculateZhuge(input, now),
  'wuyun-liuqi': async (input, now) => (await import('./systems/wuyun')).wuyun(input, now),
  'huangji-jingshi': async (input, now) => input.huangji.mode === 'reference'
    ? (await import('./systems/huangji-tables')).huangjiReference({ ...input, huangji: input.huangji }, now)
    : (await import('./systems/huangji-chart')).huangjiChart({ ...input, huangji: input.huangji }, now),
  jinkoujue: async (input, now) => (await import('./systems/jinkoujue')).jinkoujue(input, now),
  liuren: async (input, now) => (await import('./systems/liuren')).liuren(input, now),
  meihua: async (input, now) => (await import('./systems/meihua')).meihua(input, now),
  liuyao: async (input, now) => (await import('./systems/liuyao')).liuyao(input, now),
  taiyi: async (input, now) => (await import('./systems/taiyi')).taiyi(input, now),
  qimen: async (input, now) => (await import('./systems/qimen')).qimen(input, now),
  'qimen-lifetime': async (input, now) => (await import('./systems/qimen-lifetime')).qimenLifetime(input, now),
  'bazi': async (input) => (await import('./systems/bazi')).baziIndependent(input),
  'bazi-synastry': async (input) => (await import('./systems/bazi-synastry')).baziSynastryIndependent(input),
  bazhai: async (input) => (await import('./systems/bazhai')).bazhai(input),
  xuankong: async (input) => (await import('./systems/xuankong')).xuankong(input),
  residential: async (input) => (await import('./systems/residential')).residential(input),
  almanac: async (input) => (await import('./systems/almanac')).almanac(input),
  qizheng: async (input) => (await import('./systems/qizheng')).qizheng(input),
  'qizheng-range': async (input) => (await import('./systems/qizheng-range')).qizhengRange(input),
  'ziwei': async (input) => (await import('./systems/ziwei')).ziweiIndependent(input),
  'ziwei-synastry': async (input) => (await import('./systems/ziwei-synastry')).ziweiSynastryIndependent(input),
  'bazi-ziwei': async (input) => (await import('./systems/bazi-ziwei')).baziZiweiIndependent(input),
  'astrolabe': async (input, _now, context) => (await import('./systems/astrolabe')).astrolabeIndependent(input, context),
  'astrolabe-synastry': async (input, _now, context) => (await import('./systems/astrolabe-synastry')).astrolabeSynastryIndependent(input, context),
  'astrolabe-range': async (input, _now, context) => (await import('./systems/astrolabe-range')).astrolabeRange(input, context),
  minglu: async (input, _now, context) => (await import('./systems/minglu')).minglu(input, context),
  fortune: async (input, _now, context) => (await import('./systems/fortune')).fortune(input, context),
} satisfies Calculators;

type Calculation = Awaited<ReturnType<(typeof calculators)[Method]>>;

function extractGuidanceReferenceTime(input: Record<string, unknown>, currentTime: string): string {
  if (typeof input.referenceTime === 'string' && input.referenceTime.trim()) return input.referenceTime;
  for (const key of ['target', 'flow', 'calendar', 'wuyun'] as const) {
    const obj = input[key];
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      const rec = obj as Record<string, unknown>;
      if (typeof rec.at === 'string' && rec.at.trim()) return rec.at;
      if (typeof rec.year === 'number' && Number.isFinite(rec.year)) return String(rec.year);
    }
  }
  return currentTime;
}

export async function calculate(method: Method, value: unknown, context?: RuntimeContext) {
  if (!methodIds.includes(method)) throw new Error(`暂不支持术数：${method}`);
  const input = inputSchemas[method].parse(value);
  const currentTime = input.currentTime ?? new Date().toISOString();
  const savedOptions = 'prompt' in input && input.prompt !== undefined ? { promptOptions: input.prompt } : {};
  // 键和输入来自同一次 schema 查找；类型系统无法将动态索引关联到对应输入。
  const calculator = calculators[method] as (value: typeof input, now: string, context?: RuntimeContext) => Promise<Calculation>;
  const result = await calculator(input, currentTime, context);
  const question = 'question' in input && typeof input.question === 'string' ? input.question : '';
  const guidanceMethod: Method =
    method === 'random-divination'
    && 'data' in result
    && result.data
    && typeof result.data === 'object'
    && 'selectedMethod' in result.data
    && typeof (result.data as { selectedMethod?: unknown }).selectedMethod === 'string'
      ? ((result.data as { selectedMethod: Method }).selectedMethod)
      : method;
  const anchorRef = extractGuidanceReferenceTime(input as Record<string, unknown>, currentTime);
  const rawPromptInput = 'prompt' in input ? input.prompt : undefined;
  const promptProfile = resolveEffectivePromptProfile(
    rawPromptInput,
    context?.promptProfile,
  );
  const includeClassics = Boolean(
    rawPromptInput
    && typeof rawPromptInput === 'object'
    && !Array.isArray(rawPromptInput)
    && (rawPromptInput as { includeClassics?: unknown }).includeClassics === true,
  );
  const skipGuidance = promptProfile === 'agent' || promptProfile === 'ultra-compact';
  const enriched =
    'prompt' in result && result.prompt && typeof result.prompt === 'object'
      ? {
          ...result,
          prompt: applyPromptProfileToPrompt(
            skipGuidance
              ? (result.prompt as { text?: string })
              : applyPromptGuidance(
                  guidanceMethod,
                  result.prompt as { text?: string },
                  question,
                  context?.promptGuidance,
                  anchorRef,
                ),
            promptProfile,
            { includeClassics },
          ),
        }
      : result;
  return { version: '2.0.0', method, currentTime, ...enriched, ...savedOptions };
}
