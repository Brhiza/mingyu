import { z } from 'zod';
import { isoTime, requiredQuestion } from './shared';
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

export type Method = keyof typeof inputSchemas;
export const methodIds = Object.keys(inputSchemas) as [Method, ...Method[]];
export const methodLabels = {
  instant: '即时起盘', 'random-divination': '随机起卦', calendar: '历法与天文', zhouyi: '周易经文',
  'number-energy': '数字能量', 'character-query': '汉字查询', 'chinese-name': '姓名分析', 'chinese-naming': '中文起名',
  'bazi-reverse': '四柱反推', almanac: '黄历择日', qizheng: '七政四余', 'qizheng-range': '七政四余出生范围',
  bazi: '八字排盘', 'bazi-synastry': '八字双人合盘', ziwei: '紫微斗数', 'ziwei-synastry': '紫微合盘',
  'bazi-ziwei': '八字紫微合参', astrolabe: '西洋星盘', 'astrolabe-range': '西洋星盘出生范围',
  'astrolabe-synastry': '西洋星盘合盘', liuyao: '六爻', liuren: '大六壬', jinkoujue: '金口诀',
  bazhai: '八宅', xuankong: '玄空飞星', residential: '阳宅风水', taiyi: '太乙神数',
  'wuyun-liuqi': '五运六气', 'huangji-jingshi': '皇极经世', meihua: '梅花易数', tarot: '塔罗', lenormand: '雷诺曼',
  xiaoliuren: '小六壬', ssgw: '三山国王灵签', zhuge: '诸葛神数',
  qimen: '奇门遁甲', 'qimen-lifetime': '奇门终身局', minglu: '个人命录', fortune: '流运运势',
} as const satisfies Record<Method, string>;

export function createRepromptInput(enabled: readonly Method[]) {
  return z.object({
    method: z.enum(enabled),
    result: z.object({
      method: z.enum(enabled),
      currentTime: isoTime,
      data: z.record(z.string(), z.unknown()),
      promptOptions: z.unknown().optional().describe('原结果保存的提示词选项；追问未指定 prompt 时沿用。'),
    }).passthrough().describe('之前计算接口返回的完整结果；盘面内容由调用方提供。'),
    question: requiredQuestion,
    currentTime: isoTime.optional().describe('提示词的参考时间；省略时使用本次追问的调用时间，不改变原盘时间。'),
    prompt: z.unknown().optional().describe('与对应术数计算输入相同的提示词选项；省略时沿用原结果中的选项，传空对象可恢复默认。'),
  }).strict();
}

export const repromptInput = createRepromptInput(methodIds);
