import type { DivinationMethodId } from '../config';

export function buildTaskText(method: Exclude<DivinationMethodId, 'random'>) {
  switch (method) {
    case 'liuyao':
      return '请围绕用神、世应、动爻、变卦、伏神、空亡、日破、月破、化进神、化退神和旺衰判断，直接回答问题，并说明该如何推进或规避风险。';
    case 'meihua':
      return '请围绕体用关系、互卦过程、变卦结果和四时旺衰判断，直接回答问题，并给出顺势应对建议。';
    case 'xiaoliuren':
      return '请围绕起因、过程、结果三段宫位变化，判断当前事情的走势、阻力与行动节奏，直接回答问题。';
    case 'qimen':
      return '请围绕值符值使、用门落宫、门星神干组合、格局强弱、特殊时辰与时机策略判断，直接回答问题，并指出可行方向。';
    case 'liuren':
      return '请围绕月将、四课、三传、天将、课体与神煞主线判断，直接回答问题，并说明事情会如何演变、卡点在哪、下一步该先做什么。';
    case 'tarot':
      return '请围绕牌阵整体主题、关键牌、正逆位与位置关系判断，直接回答问题，并给出最值得执行的建议。';
    case 'ssgw':
      return '请围绕签诗本意、典故启示、现实处境与行动提醒判断，直接回答问题，并说明当前宜进还是宜守。';
    case 'almanac':
      return '请围绕事项、候选日期、黄历宜忌、冲煞、神煞和参与人八字参考，筛出优先日期、备选日期和需要避开的日期。';
    case 'lenormand':
      return '请围绕牌阵、牌位、牌名、牌义和行动建议判断，直接回答问题。';
    case 'astrolabe':
      return '请围绕太阳、月亮、上升、星体落宫、元素模式和主要相位判断，直接回答问题，并给出现实建议。';
    case 'taiyi':
      return '请围绕年家局数、太乙、文昌、始击、计神与主客算判断年度气运、动静、攻守与时宜，直接回答问题。';
    default:
      return '请结合占卜信息直接回答问题，并给出明确建议。';
  }
}
