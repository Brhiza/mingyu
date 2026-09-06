import type { XiaoliurenPalaceClassic } from './types';

/**
 * 《大杂字万事不求人》民国三十五年本，扫描第21—22页六宫歌诀。
 * 现代解释按歌诀主题整理。
 */
export const XIAOLIUREN_CLASSICS: Record<string, XiaoliurenPalaceClassic> = {
  大安: {
    name: '大安',
    wuxing: '木',
    auspice: '大吉',
    sourceBook: '《大杂字万事不求人》六壬时课（1946年本）',
    poem: '大安事事昌，求财在坤方，失物去不远，宅舍保安康，行人身未动，病者主无妨，将军回田野，仔细与推详。',
    modernAdvice: '歌诀以安定、守成为主题。联系所问事项，核对已有安排及可持续推进的条件。',
  },
  留连: {
    name: '留连',
    wuxing: '水',
    auspice: '平',
    sourceBook: '《大杂字万事不求人》六壬时课（1946年本）',
    poem: '留连事难成，求谋日未明，官事只宜缓，去者未回程，失物南方见，急讨方称心，更须防口舌，人口且平平。',
    modernAdvice: '歌诀以延迟、等待及沟通为主题。联系实际进度，核对尚未明确的信息与约定。',
  },
  速喜: {
    name: '速喜',
    wuxing: '火',
    auspice: '吉',
    sourceBook: '《大杂字万事不求人》六壬时课（1946年本）',
    poem: '速喜喜来临，求财向南行，失物申未午，逢人路上寻，官事有福德，病者无祸侵，田家六畜吉，行人有信音。',
    modernAdvice: '歌诀以消息、进展与往来为主题。联系实际收到的通知、回复或安排理解相应句义。',
  },
  赤口: {
    name: '赤口',
    wuxing: '金',
    auspice: '凶',
    sourceBook: '《大杂字万事不求人》六壬时课（1946年本）',
    poem: '赤口主口舌，官非切要防，失物急去寻，行人有惊慌，鸡犬多作怪，病者出西方，更须防咒咀，恐怕染瘟癀。',
    modernAdvice: '歌诀以口舌、争议为主题。联系已有分歧，核对沟通内容、约定和事实。',
  },
  小吉: {
    name: '小吉',
    wuxing: '木',
    auspice: '小吉',
    sourceBook: '《大杂字万事不求人》六壬时课（1946年本）',
    poem: '小吉最吉昌，路上好商量，阴人来报喜，失物在坤方，行人立便至，交关甚是强，凡事皆和合，病者祷上苍。',
    modernAdvice: '歌诀以商量、往来与和合为主题。联系已有合作基础和双方意愿理解相应句义。',
  },
  空亡: {
    name: '空亡',
    wuxing: '土',
    auspice: '凶',
    sourceBook: '《大杂字万事不求人》六壬时课（1946年本）',
    poem: '空亡事不长，阴人小乖张，求财无利益，行人有灾殃，失物寻不见，官事有刑伤，病人逢暗鬼，禳解保安康。',
    modernAdvice: '歌诀以落空、难觅为主题。联系所问事项，核对实际进展、信息可靠程度与完成条件。',
  },
};

export function getXiaoliurenClassic(palaceName: string): XiaoliurenPalaceClassic | undefined {
  if (typeof palaceName !== 'string' || !Object.hasOwn(XIAOLIUREN_CLASSICS, palaceName))
    return undefined;
  return { ...XIAOLIUREN_CLASSICS[palaceName] };
}
