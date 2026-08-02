import type { DivinationMethodId } from '../config';

export function buildTaskText(method: Exclude<DivinationMethodId, 'random'>) {
  switch (method) {
    case 'liuyao':
      return '请围绕已给出的用神主线、世应、动变、伏神、空亡、月日与作用链直接回答【问题】，说明判断、时机与趋势。';
    case 'meihua':
      return '请围绕已给出的体用关系、互卦过程、变卦结果和四时旺衰直接回答【问题】，说明起因、过程、结果与转折。';
    case 'xiaoliuren':
      return '请按通行月、日、时顺数确定时宫，读取时宫歌诀对应句义，结合所问事项直接回答【问题】。';
    case 'jinkoujue':
      return '请围绕已给出的取用主线与地分、将神、贵神、人元四位直接回答【问题】，说明主客、人情与落点。';
    case 'qimen':
      return '请围绕已给出的取用主线、值符值使、落宫门星神干、格局与旬空马星直接回答【问题】，说明判断、方向与时机。';
    case 'liuren':
      return '请围绕已给出的月将、四课、三传、天将、课体与神煞主线直接回答【问题】，说明发端、转折与归结。';
    case 'tarot':
      return '请围绕牌阵整体主题、关键牌、正逆位与位置关系直接回答【问题】，说明当前主题、阻力与发展趋势。';
    case 'ssgw':
      return '请围绕签诗、签意、典故与事项对应直接回答【问题】，说明判断与节奏。';
    case 'almanac':
      return '请围绕候选日期、建除神煞、参与人关系与时课作答，先给优先日、备选日与避开日，再说明取舍依据。';
    case 'lenormand':
      return '请围绕牌阵、牌位、牌名与牌义直接回答【问题】，说明局势结构与变化链条。';
    case 'astrolabe':
      return '请围绕太阳、月亮、上升、星体落宫、元素模式和主要相位直接回答【问题】，说明本命结构与阶段触发。';
    case 'taiyi':
      return '请围绕年家局数、太乙、文昌、始击、计神与主客定算直接回答【问题】，说明年度态势、动静与时宜。';
    default:
      return '请结合占卜信息直接回答【问题】，说明判断与趋势。';
  }
}
