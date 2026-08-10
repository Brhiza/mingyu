import type { DivinationMethodId } from '../config';

export function buildTaskText(method: Exclude<DivinationMethodId, 'random'>) {
  switch (method) {
    case 'liuyao':
      return '依据用神、世应、动变、伏神与月日资料回答【问题】。';
    case 'meihua':
      return '依据体用、互卦、变卦与四时旺衰回答【问题】。';
    case 'xiaoliuren':
      return '依据占得宫与歌诀回答【问题】。';
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
    case 'almanac':
      return '请依据候选日期、宜忌、建除、神煞与参与人资料，给出首选日期、备选日期和慎用日期。';
    case 'astrolabe':
      return '依据星体、宫位和相位回答【问题】。';
    case 'taiyi':
      return '依据年家局数、太乙、文昌、始击、计神与主客算回答【问题】。';
    default:
      return '请结合占卜信息回答【问题】。';
  }
}
