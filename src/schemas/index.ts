import { z } from 'zod';
import { methodEnglishLabels, methodIds, methodLabels, type Method } from '../method-meta';
import { isoTime, outputLanguage, requiredQuestion } from './shared';
import {
  zhouyiInput, calendarInput, instantInput, numberEnergyInput,
  baziReverseInput, characterQueryInput, chineseNameInput, chineseNamingInput,
} from './reference';
import {
  qizhengInput, qizhengRangeInput, ziweiIndependentInput, ziweiSynastryIndependentInput,
  baziZiweiIndependentInput, astrolabeIndependentInput, astrolabeRangeInput,
  astrolabeSynastryIndependentInput, baziIndependentInput, baziSynastryIndependentInput, mingluInput, fortuneInput,
} from './birth';
import {
  randomDivinationInput, liuyaoInput, liurenInput, jinkoujueInput, taiyiInput, wuyunInput,
  huangjiInput, tarotInput, lenormandInput, xiaoliurenInput, ssgwInput,
  zhugeInput, meihuaInput, qimenInput, qimenLifetimeInput,
} from './divination';
import { almanacInput, bazhaiInput, xuankongInput, residentialInput } from './fengshui';

export { randomDivinationMethods } from '../random-methods';
export {
  zhouyiInput, calendarInput, instantInput, numberEnergyInput,
  baziReverseInput, characterQueryInput, chineseNameInput, chineseNamingInput,
  qizhengInput, qizhengRangeInput, ziweiIndependentInput, ziweiSynastryIndependentInput,
  baziZiweiIndependentInput, astrolabeIndependentInput, astrolabeRangeInput,
  astrolabeSynastryIndependentInput, baziIndependentInput, baziSynastryIndependentInput, mingluInput, fortuneInput,
  randomDivinationInput, liuyaoInput, liurenInput, jinkoujueInput, taiyiInput, wuyunInput,
  huangjiInput, tarotInput, lenormandInput, xiaoliurenInput, ssgwInput,
  zhugeInput, meihuaInput, qimenInput, qimenLifetimeInput,
  almanacInput, bazhaiInput, xuankongInput, residentialInput,
};
export { taiyiScopeMatches, qimenScopeMatches } from './divination';

export const inputSchemas = {
  'instant': instantInput,
  'random-divination': randomDivinationInput,
  'calendar': calendarInput,
  'zhouyi': zhouyiInput,
  'number-energy': numberEnergyInput,
  'character-query': characterQueryInput,
  'chinese-name': chineseNameInput,
  'chinese-naming': chineseNamingInput,
  'bazi-reverse': baziReverseInput,
  'tarot': tarotInput,
  'lenormand': lenormandInput,
  'xiaoliuren': xiaoliurenInput,
  'ssgw': ssgwInput,
  'zhuge': zhugeInput,
  'wuyun-liuqi': wuyunInput,
  'huangji-jingshi': huangjiInput,
  'jinkoujue': jinkoujueInput,
  'liuren': liurenInput,
  'meihua': meihuaInput,
  'liuyao': liuyaoInput,
  'taiyi': taiyiInput,
  'qimen': qimenInput,
  'qimen-lifetime': qimenLifetimeInput,
  'bazi': baziIndependentInput,
  'bazi-synastry': baziSynastryIndependentInput,
  'bazhai': bazhaiInput,
  'xuankong': xuankongInput,
  'residential': residentialInput,
  'almanac': almanacInput,
  'qizheng': qizhengInput,
  'qizheng-range': qizhengRangeInput,
  'ziwei': ziweiIndependentInput,
  'ziwei-synastry': ziweiSynastryIndependentInput,
  'bazi-ziwei': baziZiweiIndependentInput,
  'astrolabe': astrolabeIndependentInput,
  'astrolabe-synastry': astrolabeSynastryIndependentInput,
  'astrolabe-range': astrolabeRangeInput,
  minglu: mingluInput,
  fortune: fortuneInput,
} as const;

export { methodIds, methodLabels, methodEnglishLabels, type Method };
// 编译期护栏：保证零依赖元数据与完整 Zod Schema 映射表键集完全同步
type SchemaMetaDrift =
  | Exclude<keyof typeof inputSchemas, Method>
  | Exclude<Method, keyof typeof inputSchemas>;
const assertNoSchemaMetaDrift: SchemaMetaDrift extends never ? true : never = true;
void assertNoSchemaMetaDrift;

export function createRepromptInput(enabled: readonly Method[]) {
  return z.object({
    method: z.enum(enabled),
    result: z.object({
      method: z.enum(enabled),
      currentTime: isoTime,
      data: z.record(z.string(), z.unknown()),
      promptOptions: z.unknown().optional().describe('原结果保存的提示词选项；追问未指定 prompt 时沿用。'),
      outputLanguage: outputLanguage.describe('原结果保存的输出语言；追问未指定 outputLanguage 时沿用。'),
    }).passthrough().describe('之前计算接口返回的完整结果；盘面内容由调用方提供。'),
    question: requiredQuestion,
    currentTime: isoTime.optional().describe('提示词的参考时间；省略时使用本次追问的调用时间，不改变原盘时间。'),
    prompt: z.unknown().optional().describe('与对应术数计算输入相同的提示词选项；省略时沿用原结果中的选项，传空对象可恢复默认。'),
    outputLanguage,
  }).strict();
}

export const repromptInput = createRepromptInput(methodIds);
