import type { DivinationMethodId } from '../config';
import type { DivinationData, MeihuaData } from '../../types/divination';
import type { HuangjiJingshiResult } from '../../huangji-jingshi';
import { buildPromptTask } from '../../prompt/guidance';

function getMeihuaPromptMethod(data?: DivinationData) {
  if (!data) return 'meihua';
  const methodKey = (data as MeihuaData | undefined)?.calculation?.methodKey;
  switch (methodKey) {
    case 'number':
      return 'meihua-number';
    case 'random':
      return 'meihua-random';
    case 'time':
    case 'timeTrigram':
    default:
      return 'meihua-time';
  }
}

function getPromptMethod(method: Exclude<DivinationMethodId, 'random'>, data?: DivinationData) {
  if (method === 'meihua') return getMeihuaPromptMethod(data);
  if (method === 'huangji' && data && !(data as HuangjiJingshiResult).forecast) {
    return 'huangji-cycle';
  }
  return method;
}

function buildMethodTaskText(method: Exclude<DivinationMethodId, 'random'>, data?: DivinationData) {
  switch (method) {
    case 'liuyao':
      return '依据用神、世应、动变、伏神与月日资料回答【问题】。';
    case 'meihua':
      return '依据体用、互卦、变卦与四时旺衰回答【问题】。';
    case 'xiaoliuren':
      return '依据本次顺数结果、时宫与歌诀回答【问题】。';
    case 'jinkoujue':
      return '依据地分、将神、贵神、人元四位、阴阳发用与五动三动回答【问题】。';
    case 'qimen':
      return '依据用神、值符值使、宫位门星神干与格局回答【问题】。';
    case 'liuren':
      return '依据月将、四课、三传、天将与课体回答【问题】。';
    case 'tarot':
      return '依据牌阵、牌位、正逆位与牌序组合回答【问题】。';
    case 'ssgw':
      return '依据签诗原文和签题回答【问题】。';
    case 'zhuge':
      return '依据三个汉字的康熙笔画、取数过程、签序与签文回答【问题】。';
    case 'kongming':
      return '依据五枚硬币所得阴阳卦象、卦名、等第与卦诗回答【问题】。';
    case 'almanac':
      return '';
    case 'astrolabe':
      return '依据星体、宫位和相位回答【问题】。';
    case 'taiyi':
      return '依据年家局数、太乙、文昌、始击、计神与主客算回答【问题】。';
    case 'huangji':
      return !data || (data as HuangjiJingshiResult).forecast
        ? '依据元会运世位置、会内统卦、运卦、六十年统卦、十年卦、值年卦以及月经、旬纬、日卦和时经卦回答【问题】。'
        : '依据元会运世周期资料回答【问题】，说明目标年在周期层级中的位置、当前进度与下一周期边界。';
    default:
      return '请结合占卜信息回答【问题】。';
  }
}

export function buildTaskText(
  method: Exclude<DivinationMethodId, 'random'>,
  data?: DivinationData,
) {
  return buildPromptTask(buildMethodTaskText(method, data), getPromptMethod(method, data));
}
