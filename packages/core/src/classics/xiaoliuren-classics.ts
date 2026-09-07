import type { XiaoliurenPalaceClassic } from './types';

/**
 * 《小六壬口诀》六神经典诗赋与断语全录
 * 原典出处：《小六壬通占》《诸葛马前课》
 */
export const XIAOLIUREN_CLASSICS: Record<string, XiaoliurenPalaceClassic> = {
  大安: {
    name: '大安',
    wuxing: '木',
    auspice: '大吉',
    sourceBook: '小六壬通占',
    poem: '大安事事昌，求谋在坤方；失物去不远，宅舍保安康。行人身未动，病者在寻常；移徙一事吉，诸事皆吉祥。',
    modernAdvice:
      '当前局势安定平稳，事态发展顺遂。宜守正固本，按部就班推进，利于长期谋划与稳健合作。',
    direction: '震东方',
    bodyPart: '足部、肝胆',
  },
  留连: {
    name: '留连',
    wuxing: '水',
    auspice: '平',
    sourceBook: '小六壬通占',
    poem: '留连事难成，求谋日未明；官事只宜缓，去者未回程。失物南方见，急讨方称心；更防口舌起，延引并淹留。',
    modernAdvice:
      '当前事态处于停滞、拖延或犹豫期。不宜急躁盲进，需有耐心，做好延期准备并防范沟通口舌。',
    direction: '坎北方',
    bodyPart: '肾脏、泌尿',
  },
  速喜: {
    name: '速喜',
    wuxing: '火',
    auspice: '吉',
    sourceBook: '小六壬通占',
    poem: '速喜喜来临，求财向南行；失物申未午，逢人路上寻。官事有福德，病者无祸侵；田宅六畜吉，行人有信音。',
    modernAdvice: '喜讯与好运即刻降临，办事效率极高。宜果断决策、把握良机，速战速决必有收获。',
    direction: '离南方',
    bodyPart: '心脏、目部',
  },
  赤口: {
    name: '赤口',
    wuxing: '金',
    auspice: '凶',
    sourceBook: '小六壬通占',
    poem: '赤口主口舌，官非切要防；失物速速讨，行人有惊慌。六畜多怪异，病者入西方；更防咒诅害，小人及损伤。',
    modernAdvice:
      '防范人际矛盾、口舌是非或争执冲突。做事宜低调慎言，避免签署有争议的协议或硬碰硬。',
    direction: '兑西方',
    bodyPart: '口舌、呼吸道',
  },
  小吉: {
    name: '小吉',
    wuxing: '木',
    auspice: '小吉',
    sourceBook: '小六壬通占',
    poem: '小吉最吉昌，路上好商量；阴人来报喜，失物在坤方。行人即便至，交关甚是强；求财必称意，病者在安康。',
    modernAdvice:
      '多得贵人与朋友相助，合作交易和美圆满。适合商谈协议、走访亲友、团队协作与小额求财。',
    direction: '乾西北',
    bodyPart: '筋骨、肠胃',
  },
  空亡: {
    name: '空亡',
    wuxing: '土',
    auspice: '凶',
    sourceBook: '小六壬通占',
    poem: '空亡事不祥，阴人多乖张；求财无利益，行人有灾殃。失物寻不见，官事有刑伤；病人逢暗鬼，解禳保安康。',
    modernAdvice:
      '事态落空虚浮，努力恐难见成效。宜止步防守、休养生息，切勿盲目投资或听信不可靠的承诺。',
    direction: '中宫/坤西南',
    bodyPart: '脾胃、神经',
  },
};

export function getXiaoliurenClassic(palaceName: string): XiaoliurenPalaceClassic | undefined {
  return XIAOLIUREN_CLASSICS[palaceName];
}
