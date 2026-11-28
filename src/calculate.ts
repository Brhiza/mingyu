import type { z } from 'zod';
import { applyOutputLanguageToPrompt, normalizeOutputLanguage } from './output-language';
import { applyPromptGuidance } from './prompt-guidance';
import { applyPromptProfileToPrompt, resolveEffectivePromptProfile } from './prompt-profile';
import { inputSchemas, methodIds, type Method } from './schema';
import type { RuntimeContext } from './runtime-context';

type Calculators = {
  [M in Method]: (input: z.output<(typeof inputSchemas)[M]>, currentTime: string, context?: RuntimeContext) => object | Promise<object>;
};

// 每个方法只声明一次计算入口；动态导入让网页和 Node 按使用情况加载。
const calculators = {
  instant: async (input, now, context) => (await import('./systems/instant')).instant(input, now, context),
  'random-divination': async (input, now, context) => (await import('./systems/random-divination')).randomDivination(input, now, context, calculate),
  calendar: async (input) => (await import('./systems/calendar-tool')).calendarTool(input),
  zhouyi: async (input, _now, context) => (await import('./systems/zhouyi')).zhouyi(input, context),
  'number-energy': async (input) => (await import('./systems/number-energy')).numberEnergy(input),
  'character-query': async (input, _now, context) => (await import('./systems/character-query')).characterQuery(input, context?.characterShard, context?.characterIndex),
  'chinese-name': async (input, _now, context) => (await import('./systems/chinese-name')).chineseName(input, context?.characterShard, context?.characterIndex, context?.staticDataset),
  'chinese-naming': async (input, _now, context) => (await import('./systems/chinese-naming')).chineseNaming(input, context?.characterShard, context?.characterIndex, context?.staticDataset),
  'bazi-reverse': async (input) => (await import('./systems/bazi-reverse')).baziReverse(input),
  tarot: async (input, now) => (await import('./systems/tarot')).calculateTarot(input, now),
  lenormand: async (input, now) => (await import('./systems/lenormand')).calculateLenormand(input, now),
  xiaoliuren: async (input, now) => (await import('./systems/xiaoliuren')).calculateXiaoliuren(input, now),
  ssgw: async (input, now, context) => (await import('./systems/ssgw')).calculateSsgw(input, now, undefined, context?.staticDataset),
  zhuge: async (input, now, context) => (await import('./systems/zhuge')).calculateZhuge(input, now, undefined, context?.staticDataset),
  'wuyun-liuqi': async (input, now) => (await import('./systems/wuyun')).wuyun(input, now),
  'huangji-jingshi': async (input, now) => input.huangji.mode === 'reference'
    ? (await import('./systems/huangji-tables')).huangjiReference({ ...input, huangji: input.huangji }, now)
    : (await import('./systems/huangji-chart')).huangjiChart({ ...input, huangji: input.huangji }, now),
  jinkoujue: async (input, now) => (await import('./systems/jinkoujue')).jinkoujue(input, now),
  liuren: async (input, now) => (await import('./systems/liuren')).liuren(input, now),
  meihua: async (input, now, context) => (await import('./systems/meihua')).meihua(input, now, context),
  liuyao: async (input, now, context) => (await import('./systems/liuyao')).liuyao(input, now, context),
  taiyi: async (input, now) => (await import('./systems/taiyi')).taiyi(input, now),
  qimen: async (input, now) => (await import('./systems/qimen')).qimen(input, now),
  'qimen-lifetime': async (input, now) => (await import('./systems/qimen-lifetime')).qimenLifetime(input, now),
  'bazi': async (input, _now, context) => (await import('./systems/bazi')).baziIndependent(input, context),
  'bazi-synastry': async (input, _now, context) => (await import('./systems/bazi-synastry')).baziSynastryIndependent(input, context),
  bazhai: async (input) => (await import('./systems/bazhai')).bazhai(input),
  xuankong: async (input) => (await import('./systems/xuankong')).xuankong(input),
  residential: async (input) => (await import('./systems/residential')).residential(input),
  almanac: async (input, _now, context) => (await import('./systems/almanac')).almanac(input, context),
  qizheng: async (input) => (await import('./systems/qizheng')).qizheng(input),
  'qizheng-range': async (input) => (await import('./systems/qizheng-range')).qizhengRange(input),
  'ziwei': async (input) => (await import('./systems/ziwei')).ziweiIndependent(input),
  'ziwei-synastry': async (input) => (await import('./systems/ziwei-synastry')).ziweiSynastryIndependent(input),
  'bazi-ziwei': async (input, _now, context) => (await import('./systems/bazi-ziwei')).baziZiweiIndependent(input, context),
  'astrolabe': async (input, _now, context) => (await import('./systems/astrolabe')).astrolabeIndependent(input, context),
  'astrolabe-synastry': async (input, _now, context) => (await import('./systems/astrolabe-synastry')).astrolabeSynastryIndependent(input, context),
  'astrolabe-range': async (input, _now, context) => (await import('./systems/astrolabe-range')).astrolabeRange(input, context),
  minglu: async (input, _now, context) => (await import('./systems/minglu')).minglu(input, context),
  fortune: async (input, _now, context) => (await import('./systems/fortune')).fortune(input, context),
} satisfies Calculators;

const methodPreloaders: Partial<Record<Method, () => Promise<unknown>>> = {
  instant: () => import('./systems/instant'),
  'random-divination': () => import('./systems/random-divination'),
  calendar: () => import('./systems/calendar-tool'),
  zhouyi: () => import('./systems/zhouyi'),
  'number-energy': () => import('./systems/number-energy'),
  'bazi-reverse': () => import('./systems/bazi-reverse'),
  tarot: () => import('./systems/tarot'),
  lenormand: () => import('./systems/lenormand'),
  xiaoliuren: () => import('./systems/xiaoliuren'),
  ssgw: () => import('./systems/ssgw'),
  zhuge: () => import('./systems/zhuge'),
  'wuyun-liuqi': () => import('./systems/wuyun'),
  'huangji-jingshi': () => import('./systems/huangji-chart'),
  jinkoujue: () => import('./systems/jinkoujue'),
  liuren: () => import('./systems/liuren'),
  meihua: () => import('./systems/meihua'),
  liuyao: () => import('./systems/liuyao'),
  taiyi: () => import('./systems/taiyi'),
  qimen: () => import('./systems/qimen'),
  'qimen-lifetime': () => import('./systems/qimen-lifetime'),
  bazi: () => import('./systems/bazi'),
  'bazi-synastry': () => import('./systems/bazi-synastry'),
  bazhai: () => import('./systems/bazhai'),
  xuankong: () => import('./systems/xuankong'),
  residential: () => import('./systems/residential'),
  almanac: () => import('./systems/almanac'),
  qizheng: () => import('./systems/qizheng'),
  ziwei: () => import('./systems/ziwei'),
  'ziwei-synastry': () => import('./systems/ziwei-synastry'),
  'bazi-ziwei': () => import('./systems/bazi-ziwei'),
  astrolabe: () => import('./systems/astrolabe'),
  'astrolabe-synastry': () => import('./systems/astrolabe-synastry'),
  minglu: () => import('./systems/minglu'),
  fortune: () => import('./systems/fortune'),
};

export function preloadMethodCalculator(method: Method): Promise<unknown> {
  const loader = methodPreloaders[method];
  return loader ? loader() : Promise.resolve();
}

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
  const rawOutputLanguage = 'outputLanguage' in input && typeof input.outputLanguage === 'string'
    ? input.outputLanguage
    : undefined;
  const requestedOutputLanguage = normalizeOutputLanguage(rawOutputLanguage);
  const calcInput = rawOutputLanguage !== undefined
    ? (() => {
        const { outputLanguage: _ol, ...rest } = input as typeof input & { outputLanguage?: string };
        return rest as typeof input;
      })()
    : input;
  const savedOptions = 'prompt' in calcInput && calcInput.prompt !== undefined ? { promptOptions: calcInput.prompt } : {};
  // 键和输入来自同一次 schema 查找；类型系统无法将动态索引关联到对应输入。
  const calculator = calculators[method] as (value: typeof input, now: string, context?: RuntimeContext) => Promise<Calculation>;
  const result = await calculator(calcInput, currentTime, context);
  const question = 'question' in calcInput && typeof calcInput.question === 'string' ? calcInput.question : '';
  const guidanceMethod: Method =
    method === 'random-divination'
    && 'data' in result
    && result.data
    && typeof result.data === 'object'
    && 'selectedMethod' in result.data
    && typeof (result.data as { selectedMethod?: unknown }).selectedMethod === 'string'
      ? ((result.data as { selectedMethod: Method }).selectedMethod)
      : method;
  const anchorRef = extractGuidanceReferenceTime(calcInput as Record<string, unknown>, currentTime);
  const rawPromptInput = 'prompt' in calcInput ? calcInput.prompt : undefined;
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
          prompt: applyOutputLanguageToPrompt(
            applyPromptProfileToPrompt(
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
            requestedOutputLanguage,
            guidanceMethod,
          ),
        }
      : result;
  return {
    version: '2.0.0',
    method,
    currentTime,
    ...enriched,
    ...savedOptions,
    ...(requestedOutputLanguage ? { outputLanguage: requestedOutputLanguage } : {}),
  };
}
