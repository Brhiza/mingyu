import type { DivinationMethodId } from '../config';

export function buildTaskText(method: Exclude<DivinationMethodId, 'random'>) {
  switch (method) {
    case 'liuyao':
      return '请严格围绕已给出的用神主线、世应、动变、伏神、空亡、月日与作用链作答；用神已定时不得改换他爻为主断，直接给出判断、时机与行动建议。';
    case 'meihua':
      return '请严格围绕已给出的体用关系、互卦过程、变卦结果和四时旺衰作答，直接给出判断与应对建议。';
    case 'xiaoliuren':
      return '请严格围绕已给出的起因、过程、结果三段宫位与五行推进作答，直接给出走势、阻力与行动节奏。';
    case 'jinkoujue':
      return '请严格围绕已给出的取用主线与地分、将神、贵神、人元四位一体作答；主线已定时不得另立主神，直接给出主客、人情、落点与行动建议。';
    case 'qimen':
      return '请严格围绕已给出的取用主线、值符值使、落宫门星神干、格局与旬空马星作答；取用主线已定时不得另立用神，直接给出判断、方向与时机。';
    case 'liuren':
      return '请严格围绕已给出的月将、四课、三传、天将、课体与神煞主线作答，直接说明演变、卡点与下一步。';
    case 'tarot':
      return '请围绕牌阵整体主题、关键牌、正逆位与位置关系判断，直接回答问题，并给出最值得执行的建议。';
    case 'ssgw':
      return '请围绕签诗本意、典故启示、现实处境与行动提醒判断，直接回答问题，并说明当前宜进还是宜守。';
    case 'almanac':
      return '请严格围绕已给出的事项主线、候选日支持与限制、建除神煞硬规则和参与人八字适配作答；先给优先日、备选日与避开日，再说明条件与风险。';
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
