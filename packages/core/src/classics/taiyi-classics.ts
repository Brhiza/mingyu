import type { TaiyiGeneralClassic } from './types';

/**
 * 《太乙金镜式经》《太乙统宗宝鉴》太乙神数诸神与八将精解
 */
export const TAIYI_GENERAL_CLASSICS: Record<string, TaiyiGeneralClassic> = {
  太乙: {
    general: '太乙',
    role: '天乙神尊 · 统领式局',
    wuxing: '水',
    sourceBook: '太乙金镜式经·卷一',
    verse: '太乙天尊主宰明，巡行八极按时行；统摄万神消大蠹，乘风御气镇乾坤。',
    nature: '式盘之至尊，化气为帝德，掌天下安危、天命转移与时代大势。',
    actionAdvice: '逢太乙入局，顺天应人，以至公至正之心处事，谋大事可得天助。',
  },
  文昌: {
    general: '文昌',
    role: '主将之佐 · 文德之府',
    wuxing: '火',
    sourceBook: '太乙金镜式经·卷一',
    verse: '文昌主将发机先，算策精详步九天；辅弼明君成伟业，筹谋帷幄决胜全。',
    nature: '主方核心谋士，司文书政令、战略决策与智慧运筹。',
    actionAdvice: '文昌得位利于战略规划、文书制定、谈判公关与智力输出。',
  },
  始击: {
    general: '始击',
    role: '客将之佐 · 行动先锋',
    wuxing: '火',
    sourceBook: '太乙金镜式经·卷一',
    verse: '始击如雷震万山，突袭先锋勇向前；敌阵未安逢击发，乘胜破竹破重关。',
    nature: '客方突击力量，司快速出击、外部变局、突发事件与主动变革。',
    actionAdvice: '始击旺相宜主动出击、破局立新；若受制宜防突发危机与意外冲击。',
  },
  主将: {
    general: '主将',
    role: '主方元帅 · 防守中枢',
    wuxing: '金',
    sourceBook: '太乙金镜式经·卷二',
    verse: '主将威严立本营，坚城深堑御敌兵；稳重从容成胜算，修德固本享泰宁。',
    nature: '代表内部、我方、守方与阵地核心。主沉稳、防御、内功与根基。',
    actionAdvice: '主将得算宜守正不阿、深挖护城河、稳扎稳打，以静制动。',
  },
  客将: {
    general: '客将',
    role: '客方先驱 · 进攻锋芒',
    wuxing: '水',
    sourceBook: '太乙金镜式经·卷二',
    verse: '客将扬威跨远疆，风驰电掣势难当；远征开拓图宏业，战伐开疆日月长。',
    nature: '代表外部、彼方、攻方、开拓者与新势力。主进取、远征、冲击与扩张。',
    actionAdvice: '客将得算利于开拓新市场、远行出征、破旧立新、主动争取。',
  },
  主参: {
    general: '主参',
    role: '主将副手 · 补位护卫',
    wuxing: '木',
    sourceBook: '太乙金镜式经·卷二',
    verse: '主参副佐卫中军，辅弼同心力不分；济困扶危资底蕴，后方充沛策超群。',
    nature: '主方副将，负责后勤保障、内部协调、应急预案与底线兜底。',
    actionAdvice: '主参得力宜强化团队协同、完善后勤供应链与巩固后方。',
  },
  客参: {
    general: '客参',
    role: '客将副手 · 奇兵策应',
    wuxing: '土',
    sourceBook: '太乙金镜式经·卷二',
    verse: '客参策应发奇兵，左右逢源势自成；暗度陈仓开胜路，奇谋迭出显功名。',
    nature: '客方副将，负责侧翼包抄、奇兵策应、灵活应变与多线突破。',
    actionAdvice: '客参逢吉宜出奇制胜、寻找差异化突破口与灵活试错。',
  },
  计神: {
    general: '计神',
    role: '岁星之使 · 岁计枢机',
    wuxing: '土',
    sourceBook: '太乙统宗宝鉴·卷一',
    verse: '计神司岁掌权纲，巡视周天定吉殃；暗室亏心难逃避，公平守道自荣昌。',
    nature: '年度计谋枢机，司年度大局、监督审计、因果反馈与长期大势。',
    actionAdvice: '计神照临宜守公道规矩、重视长远审计与合规风控。',
  },
};

export function getTaiyiGeneralClassic(general: string): TaiyiGeneralClassic | undefined {
  if (!general) return undefined;
  for (const [key, val] of Object.entries(TAIYI_GENERAL_CLASSICS)) {
    if (general.includes(key)) return val;
  }
  return undefined;
}
