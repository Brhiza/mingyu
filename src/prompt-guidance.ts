import type { Method } from './schema';
import {
  ASTROLOGY_METHODS,
  BAZI_METHODS,
  CARD_SIGN_METHODS,
  FENGSHUI_METHODS,
  MACRO_LUCK_METHODS,
  MULTI_NATAL_METHODS,
  NAMING_METHODS,
  QIZHENG_METHODS,
  RANGE_COMPARE_METHODS,
  REFERENCE_LOOKUP_METHODS,
  SYNASTRY_METHODS,
  TRADITIONAL_DIVINATION_METHODS,
  WESTERN_ASTRO_METHODS,
  ZIWEI_METHODS,
} from './method-registry';
import { getYearSixtyCycle } from './systems/ganzhi-foundation';
import { parseQuestionContext, type QuestionTopic } from './systems/question-context';

const GUIDANCE_HEADER = '【解读与交付契约】';
const TOP_ANCHOR_HEADER = '【顶部任务锚点】';
const LONG_PROMPT_ANCHOR_THRESHOLD = 1600;

export type PromptReplyStyle = 'standard' | 'concise' | 'deep';

export interface PromptGuidanceOptions {
  enableContract?: boolean;
  replyStyle?: PromptReplyStyle;
  topTaskAnchor?: boolean;
  customFramework?: string;
}

type PromptGuidanceProvider = () => PromptGuidanceOptions | undefined;
let defaultGuidanceProvider: PromptGuidanceProvider | null = null;

/** 供浏览器设置模块注册全局提示词偏好；Node/Worker 无状态环境默认不注册。 */
export function setDefaultPromptGuidanceProvider(provider: PromptGuidanceProvider | null): void {
  defaultGuidanceProvider = provider;
}

function detectInstantKind(promptText: string): 'astro' | 'ziwei' | 'bazi' | 'mixed' {
  if (/西洋星盘|七政四余/.test(promptText)) return 'astro';
  if (/即时紫微/.test(promptText) && !/即时四柱/.test(promptText)) return 'ziwei';
  if (/即时四柱/.test(promptText) && !/即时紫微/.test(promptText)) return 'bazi';
  return 'mixed';
}

function detectRandomDivinationKind(promptText: string): 'card-sign' | 'traditional' {
  if (/【签面】|【签诗】|塔罗|雷诺曼|正逆位/.test(promptText)) return 'card-sign';
  return 'traditional';
}

function getEvidenceFocus(method: Method, promptText: string): string {
  if (method === 'bazi-reverse') return '四柱结构与反推得到的候选出生范围';
  if (method === 'qimen-lifetime') return '九宫门星神、盘面格局、候选宫间关系与反证条件';
  if (method === 'instant') {
    const kind = detectInstantKind(promptText);
    if (kind === 'astro') return '即时星体落宫与相位/吊照（区分即时盘与出生盘）';
    if (kind === 'ziwei') return '即时紫微命身宫位与起盘四化（不虚构个人岁限）';
    if (kind === 'bazi') return '即时四柱干支强弱与刑冲合害（不虚构个人大运）';
    return '即时四柱干支与紫微命身宫四化（区分即时盘与个人出生盘）';
  }
  if (method === 'random-divination') {
    return detectRandomDivinationKind(promptText) === 'card-sign'
      ? '实际牌序、牌位、正逆位或签诗原文'
      : '世应/用神、动变、门星神、证据层与应期条件';
  }
  if (BAZI_METHODS.has(method)) return '四柱、月令旺衰、格局成败、调候、神煞与岁运';
  if (ZIWEI_METHODS.has(method)) return '命财官迁及主题宫星曜、本命格局、四化与运限';
  if (MULTI_NATAL_METHODS.has(method)) return '多体系盘面事实、规则证据与跨盘互证项';
  if (ASTROLOGY_METHODS.has(method)) return '星体落座落宫、相位/吊照、格局与推运/流曜';
  if (method === 'meihua') return '体用生克、主互变卦象与动爻辞';
  if (method === 'xiaoliuren') return '月日时三宫落点与体用生克';
  if (method === 'taiyi') return '主客定算、三门五将与十六神职司';
  if (TRADITIONAL_DIVINATION_METHODS.has(method)) return '世应/用神、动变、门星神、四课三传/四位与证据层';
  if (method === 'tarot') return '实际牌序、牌位、正逆位与牌面核心意象';
  if (method === 'lenormand') return '实际牌面与生活化日常线索（单牌不强行脑补邻牌）';
  if (CARD_SIGN_METHODS.has(method)) return '签诗原文意象与对应事项提示';
  if (method === 'number-energy') return '八星组合走势、0/5 位置与数理特征';
  if (method === 'almanac') return '优选日与可用吉时、忌用时辰及冲煞避忌';
  if (method === 'bazhai') return '命卦与宅向对照、坐山误差安全交集方位';
  if (method === 'xuankong') return '原盘山向旺衰、组合煞气与流年飞星吉凶';
  if (method === 'residential') return '八宅命宅与玄空飞星交集吉位及重煞避忌';
  if (NAMING_METHODS.has(method)) return '字义、音律、字形笔画、重名谐音与五行参考';
  return '上方引擎返回的精确历法、经文、字库或周期事实';
}

function hasUncertainTimeSignal(method: Method, promptText: string): boolean {
  if (method === 'astrolabe-range' || method === 'qizheng-range') return true;
  if (method === 'bazi-reverse') return /候选\s*2|候选范围[^\n]*[2-9]/.test(promptText);
  return /(?:【区间分支\s*1】|【分支\s*1】|【稳定与候选】|【候选时段)/.test(promptText);
}

function getScenarioRule(method: Method, promptText: string): string {
  if (SYNASTRY_METHODS.has(method)) {
    return '双盘对照：先简述双方底色再析跨盘互动；若含多候选，分别说明差异，不私自选盘。';
  }
  if (
    BAZI_METHODS.has(method)
    || ZIWEI_METHODS.has(method)
    || MULTI_NATAL_METHODS.has(method)
    || ASTROLOGY_METHODS.has(method)
    || method === 'bazi-reverse'
    || method === 'qimen-lifetime'
  ) {
    if (hasUncertainTimeSignal(method, promptText)) {
      return '多候选考时：严禁私自选盘；须明确分出「各候选共同稳定特征」与「因时辰而异的差异点」，再引导用户提供 2–3 件过往大事年份定盘（宝宝/青少年跳过考时）。';
    }
    return '';
  }
  if (TRADITIONAL_DIVINATION_METHODS.has(method) || method === 'random-divination') {
    return '一事一占：紧扣所问主体与当前盘面；应期只按已列条件判断，缺依据时改为提示关键观察节点；追问沿用原盘不重起。';
  }
  if (CARD_SIGN_METHODS.has(method) || method === 'number-energy') {
    return '温和直白：用生活化语言解读当下处境与心理盲区，不堆砌学术审查腔或版本免责话术；追问沿用原盘不重抽。';
  }
  if (method === 'almanac') {
    return '择日取舍：不忽略同日宜忌冲突；无完美日期时直接给出折中优选与取舍理由。';
  }
  if (FENGSHUI_METHODS.has(method)) {
    return '方位落地：若存在坐向误差或八宅/玄空方位冲突，优先提取共同安全吉位并避开二五/五二重煞直接给布置建议，再点出需复测或留意的争议方位。';
  }
  if (NAMING_METHODS.has(method)) {
    return '起名实用：不要用单姓天格吉凶吓唬家长；务必评估字义气质、简体书写难度、重名度风险，并提醒用普通话/方言连读排查谐音及长辈避讳。';
  }
  return '';
}

function getTopicFocusRule(method: Method, topic: QuestionTopic, promptText = ''): string {
  if (
    topic === 'general'
    || NAMING_METHODS.has(method)
    || FENGSHUI_METHODS.has(method)
    || REFERENCE_LOOKUP_METHODS.has(method)
    || MACRO_LUCK_METHODS.has(method)
    || RANGE_COMPARE_METHODS.has(method)
    || method === 'almanac'
  ) {
    return '';
  }

  const effectiveMethod: Method =
    method === 'instant'
      ? (() => {
          const kind = detectInstantKind(promptText);
          if (kind === 'ziwei') return 'ziwei';
          if (kind === 'bazi') return 'bazi';
          if (kind === 'astro') return /七政四余/.test(promptText) ? 'qizheng' : 'astrolabe';
          return 'bazi-ziwei';
        })()
      : method;

  const isCardOrNumber =
    CARD_SIGN_METHODS.has(effectiveMethod)
    || effectiveMethod === 'number-energy'
    || (effectiveMethod === 'random-divination' && detectRandomDivinationKind(promptText) === 'card-sign');

  if (isCardOrNumber) {
    switch (topic) {
      case 'shiye':
        return '事业焦点：落到具体工作方向、合作沟通与近期推进节奏上，直接给可执行建议。';
      case 'caifu':
        return '财运焦点：落到收支管理、投入风险与守成发力点上，给出务实提醒。';
      case 'ganqing':
        return '感情焦点：聚焦双方真实沟通状态、情感需求与关系卡点，给温和可行的破冰或相处建议。';
      case 'academic':
        return '学业考试焦点：聚焦备考状态、心态调节与临场发挥关键。';
      case 'house':
        return '家宅置业焦点：落到居住舒心度、搬迁置业节奏与现实预算边界上，给出务实提醒。';
      case 'guaishen':
        return '身心焦点：聚焦近期情绪压力、精力消耗与作息调养节奏（仅作生活调适参考，不替代就医）。';
      case 'travel':
        return '出行焦点：聚焦行程节奏、沟通协调与途中备选预案提醒。';
      case 'lost':
        return '寻物线索焦点：结合牌面/签意中的环境特征给出具体排查方向。';
      case 'litigation':
        return '是非沟通焦点：聚焦双方立场、核心分歧与稳妥应对策略。';
      default:
        return '';
    }
  }

  // 1. 八字体系（绝不混入紫微/西洋占星宫位词）
  if (BAZI_METHODS.has(effectiveMethod)) {
    switch (topic) {
      case 'shiye':
        return '事业焦点：紧扣月令格局、官杀/印星/食伤配置与岁运引动，明确适配方向、发力窗口与主要阻力。';
      case 'caifu':
        return '财运焦点：紧扣正偏财星根气、食伤生财、财库开合与比劫分合，区分稳健积累、阶段机会与破耗风险。';
      case 'ganqing':
        return '感情焦点：紧扣日支夫妻宫、配偶星（男看财星、女看官杀）、合冲刑害或双盘喜忌互补，直指相处模式与改善关键，避免宿命恐吓。';
      case 'academic':
        return '学业考试焦点：紧扣印星、食伤吐秀、文昌与考年岁运引动，直指备考节奏与发挥关键。';
      case 'house':
        return '家宅置业焦点：紧扣印星、财库、日支及岁运冲合动静，区分置业/搬迁时机与资金承压边界。';
      case 'guaishen':
        return '身心焦点：聚焦五行偏枯、寒暖燥湿失衡与刑冲刃杀象意，给出作息与节律调养提醒（不替代医学诊疗）。';
      case 'travel':
        return '出行焦点：结合驿马、四柱冲动与岁运方位象意，提示变动顺逆与注意事项。';
      case 'litigation':
        return '是非纠纷焦点：紧扣官杀刑冲、伤官见官与三刑六害岁运，提示合同边界与避险节点。';
      default:
        return '';
    }
  }

  // 2. 紫微斗数体系（绝不混入八字十神/西洋十宫）
  if (ZIWEI_METHODS.has(effectiveMethod)) {
    switch (topic) {
      case 'shiye':
        return '事业焦点：紧扣官禄宫、迁移宫、命宫三方四正及四化飞入，明确适配路径、发力运限与阻力点。';
      case 'caifu':
        return '财运焦点：紧扣财帛宫、田宅宫（积蓄不动产）、兄弟宫（现金流）及禄忌流向，区分稳健积累与破耗风险。';
      case 'ganqing':
        return '感情焦点：紧扣夫妻宫、福德宫及跨盘生年/飞星四化，直指相处模式、核心矛盾与改善关键，避免宿命恐吓。';
      case 'academic':
        return '学业考试焦点：紧扣文昌文曲、化科落宫、官禄与命迁互动，直指备考节奏与发挥关键。';
      case 'house':
        return '家宅置业焦点：紧扣田宅宫星曜、禄忌引动及流年叠宫，分析置业搬迁时机与居家稳固度。';
      case 'guaishen':
        return '身心焦点：聚焦疾厄宫与福德宫煞忌冲照象意，给出作息、情绪与节律调养提醒（不替代医学诊疗）。';
      case 'travel':
        return '出行焦点：结合迁移宫、天马星及流运引动，提示外派、出行或换城市的顺逆节点。';
      default:
        return '';
    }
  }

  // 3. 西洋星盘体系（绝不混入中式十神/夫妻宫）
  if (WESTERN_ASTRO_METHODS.has(effectiveMethod)) {
    switch (topic) {
      case 'shiye':
        return '事业焦点：紧扣第十宫（MC 天顶）、第六宫、土星/木星相位与事业行运，明确适配方向与推进窗口。';
      case 'caifu':
        return '财运焦点：紧扣第二宫、第八宫、金星/木星相位及土星约束，区分主业积累、合作偏财与风险边界。';
      case 'ganqing':
        return '感情焦点：紧扣第七宫、金星、月亮、火星及跨盘相位/互溶，直指互动模式、需求差异与磨合建议。';
      case 'academic':
        return '学业考试焦点：紧扣第三宫、第九宫、水星状态与相关行运，直指学习节奏与临场发挥关键。';
      case 'house':
        return '家宅置业焦点：紧扣第四宫（IC 天底）、月亮与相关行运，分析居住变动、家庭安顿与置业节奏。';
      case 'guaishen':
        return '身心焦点：聚焦第六宫、第十二宫及紧张相位压力源，给出作息与情绪减压提醒（不替代医学诊疗）。';
      case 'travel':
        return '出行焦点：结合第九宫、第三宫及木星/水星行运，提示远行、外派或迁移的顺逆节点。';
      default:
        return '';
    }
  }

  // 4. 七政四余体系
  if (QIZHENG_METHODS.has(effectiveMethod)) {
    switch (topic) {
      case 'shiye':
        return '事业焦点：紧扣官禄宫、命度主、十干化禄化科与行限流曜，明确适配方向与发力节点。';
      case 'caifu':
        return '财运焦点：紧扣财帛宫、田宅宫、恩用星助益与难仇克制，区分稳健聚财与破耗风险。';
      case 'ganqing':
        return '感情焦点：紧扣妻妾宫、日月金星庙旺与吊照互动，直指相处模式与改善关键。';
      case 'academic':
        return '学业考试焦点：紧扣官禄宫、命宫、科名与文星吊照，直指备考节奏与发挥关键。';
      case 'house':
        return '家宅置业焦点：紧扣田宅宫与恩难流曜引动，评估置业搬迁时机与居住安稳度。';
      case 'guaishen':
        return '身心焦点：聚焦疾厄宫与难仇星克制象意，给出作息节律调养提醒（不替代医学诊疗）。';
      default:
        return '';
    }
  }

  // 5. 多体系合参（星平合参/命录/运势）
  if (MULTI_NATAL_METHODS.has(effectiveMethod)) {
    switch (topic) {
      case 'shiye':
        return '事业焦点：跨盘对照事业核心宫位/十神/行运的同向共振与分歧，明确适配方向、发力窗口与阻力。';
      case 'caifu':
        return '财运焦点：跨盘对照财源、积蓄与破耗风险的共振点，给出稳健积累与避险边界。';
      case 'ganqing':
        return '感情焦点：跨盘对照关系宫位与互动信号，直指相处模式、核心矛盾与改善关键。';
      case 'academic':
        return '学业考试焦点：跨盘对照文昌/印星/化科与阶段流运，直指备考节奏与发挥关键。';
      case 'house':
        return '家宅置业焦点：跨盘对照田宅/印财与方位时机，分析搬迁置业节奏与现实边界。';
      case 'guaishen':
        return '身心焦点：跨盘对照体质偏枯、疾厄与压力节点，给出作息与情绪调养提醒（不替代医学诊疗）。';
      case 'travel':
        return '出行焦点：结合迁移/驿马与当期流运，提示出行与变动的顺逆节点。';
      default:
        return '';
    }
  }

  // 6. 奇门遁甲与奇门终身局（只用奇门术语）
  if (effectiveMethod === 'qimen' || effectiveMethod === 'qimen-lifetime') {
    switch (topic) {
      case 'shiye':
        return '事业焦点：紧扣开门、值符、年命/日干落宫生克与门星神格局，说明推进顺逆与合作阻力。';
      case 'caifu':
        return '财运焦点：紧扣生门、甲子戊（资本）、日干与生门生克，区分真实收益与垫资破耗风险。';
      case 'ganqing':
        return '感情焦点：紧扣六合、乙奇与庚金落宫生克及门星神互动，直指双方态度与相处卡点。';
      case 'academic':
        return '学业考试焦点：紧扣景门、天辅星、值符与日干生克，直指备考状态与临场发挥关键。';
      case 'house':
        return '家宅置业焦点：紧扣生门（房屋）、值符、日干落宫生克与方位吉凶，分析居住与置业利弊。';
      case 'guaishen':
        return '身心焦点：紧扣天芮星、天心星与乙奇生克落宫，仅作传统节律与就医配合参考（不替代专业诊疗）。';
      case 'travel':
        return '出行焦点：紧扣目标方位落宫、马星、开门/景门与白虎九天吉凶，提示行程顺逆。';
      case 'lost':
        return '失物/寻人焦点：紧扣用神落宫、方位、空亡伏吟与马星线索，给出具体排查方向。';
      case 'litigation':
        return '诉讼纠纷焦点：紧扣值符、开门、惊门、白虎与主客落宫生克，直指双方强弱与策略。';
      default:
        return '';
    }
  }

  // 7. 六爻纳甲（只用六爻术语）
  if (effectiveMethod === 'liuyao') {
    switch (topic) {
      case 'shiye':
        return '事业焦点：紧扣官鬼爻、父母爻、世应生克与动变旺衰，说明推进顺逆、阻力与发力重点。';
      case 'caifu':
        return '财运焦点：紧扣妻财爻旺衰、子孙爻（财源）及兄弟爻是否动而劫财，区分真财与虚耗风险。';
      case 'ganqing':
        return '感情焦点：紧扣世应生合冲克、财官用神动变与空破，直指双方态度与关系契机。';
      case 'academic':
        return '学业考试焦点：紧扣父母爻（文书成绩）、官鬼爻与世爻旺衰，直指备考与临场关键。';
      case 'house':
        return '家宅置业焦点：紧扣父母爻、二爻宅位、世应与六神动变，分析居住安稳度与置业利弊。';
      case 'guaishen':
        return '身心焦点：紧扣官鬼爻、子孙爻与世爻元气旺衰，仅作传统状态参考（不适请及时就医）。';
      case 'travel':
        return '出行焦点：紧扣世应、父母爻与动变空破，提示行程平顺度与阻滞节点。';
      case 'lost':
        return '失物/寻人焦点：紧扣用神落宫方位、伏藏/入墓/空亡与动变线索，给出具体排查方向。';
      case 'litigation':
        return '诉讼纠纷焦点：紧扣世应强弱、官鬼爻、父母爻（证据文书）与朱雀白虎，直指胜算关键。';
      default:
        return '';
    }
  }

  // 8. 大六壬与金口诀（只用壬学/四位术语）
  if (effectiveMethod === 'liuren' || effectiveMethod === 'jinkoujue') {
    const core = effectiveMethod === 'liuren' ? '四课三传、类神与天将' : '四位生克、发用与五动三动';
    switch (topic) {
      case 'shiye':
        return `事业焦点：紧扣${core}与官鬼/贵人状态，说明推进节奏、贵人助力与合作阻力。`;
      case 'caifu':
        return `财运焦点：紧扣${core}与财爻/青龙/玄武信号，区分真实收益与虚耗防骗风险。`;
      case 'ganqing':
        return `感情焦点：紧扣${core}与日辰/六合/主客互动，直指双方真实态度与沟通卡点。`;
      case 'academic':
        return `学业考试焦点：紧扣${core}与父母文书/朱雀/贵人，直指备考与临场发挥关键。`;
      case 'house':
        return `家宅置业焦点：紧扣${core}与宅支/人宅生克，分析居住环境与置业取舍。`;
      case 'guaishen':
        return `身心焦点：紧扣${core}与官鬼/白虎生克，仅作传统节律参考（身体不适请及时就医）。`;
      case 'travel':
        return `出行焦点：紧扣${core}与驿马/行程动静，提示途中顺逆与延误信号。`;
      case 'lost':
        return `失物/寻人焦点：紧扣${core}指向的方位、藏伏与动静线索，给出具体排查方向。`;
      case 'litigation':
        return `诉讼纠纷焦点：紧扣${core}与主客强弱、朱雀/玄武/贵人，直指双方态势与化解点。`;
      default:
        return '';
    }
  }

  // 9. 梅花易数 / 小六壬 / 太乙神数 / 兜底传统占卜（不串入奇门/八字词）
  const fallbackCore =
    effectiveMethod === 'meihua'
      ? '体用生克、主互变卦象与动爻辞'
      : effectiveMethod === 'xiaoliuren'
        ? '月日时三宫递进与体用生克'
        : effectiveMethod === 'taiyi'
          ? '主客定算、三门五将与十六神职司'
          : '盘面主轴、生克强弱与动静变化';

  switch (topic) {
    case 'shiye':
      return `事业焦点：紧扣${fallbackCore}，说明推进顺逆、合作阻力与发力重点。`;
    case 'caifu':
      return `财运焦点：紧扣${fallbackCore}，区分稳妥收益与冲动破耗风险。`;
    case 'ganqing':
      return `感情焦点：紧扣${fallbackCore}，直指双方互动节奏、核心卡点与改善契机。`;
    case 'academic':
      return `学业考试焦点：紧扣${fallbackCore}，直指备考状态与临场发挥关键。`;
    case 'house':
      return `家宅置业焦点：紧扣${fallbackCore}，评估居住安稳度与搬迁置业节奏。`;
    case 'guaishen':
      return `身心焦点：紧扣${fallbackCore}，提示精力与作息调节重点（不适请及时就医）。`;
    case 'travel':
      return `出行焦点：紧扣${fallbackCore}，提示行程顺逆与途中需留意的节点。`;
    case 'lost':
      return `失物/寻人焦点：紧扣${fallbackCore}与方位物象线索，给出具体排查方向。`;
    case 'litigation':
      return `诉讼纠纷焦点：紧扣${fallbackCore}与主客强弱，直指双方优劣势与应对重点。`;
    default:
      return '';
  }
}

function getReplyStructureRule(method: Method, style: PromptReplyStyle, promptText: string): string {
  if (method === 'calendar') {
    return '输出格式：直接给出准确的北京时间结论（精确到分/秒），无需粘贴英文调试参数或求根误差；如数据确有缺失则简短说明。';
  }
  if (method === 'zhouyi') {
    return '输出格式：先忠实完整列出所查卦辞与爻辞原文，随后附 2–3 句大白话导读帮普通读者理解核心意思，文末一行附注版本口径即可。';
  }
  if (method === 'character-query') {
    return '输出格式：仅针对用户所问汉字作答；① 一句话总结康熙笔画、五行与造字本义 → ② 节选《说文》或最核心释义 1–2 句并用大白话讲清（严禁整段粘贴冷僻反切）→ ③ 常用引申义与起名/使用参考。';
  }
  if (RANGE_COMPARE_METHODS.has(method)) {
    return '输出格式：① 一句话差异/范围结论 → ② 共同稳定特征 → ③ 各分支差异与边界核对点 → ④ 考时或下一步使用建议。';
  }
  if (NAMING_METHODS.has(method)) {
    return '输出格式：① 综合印象或精选方案对比 → ② 字义、音律与重名/谐音排查 → ③ 传统数理与五行参考（白话简述）→ ④ 实用取舍建议。';
  }
  if (FENGSHUI_METHODS.has(method) || method === 'almanac') {
    return '输出格式：① 一句话明确推荐（优选日期吉时 / 优先安全吉位）→ ② 关键依据（大白话拆解）→ ③ 必须避开的冲煞或争议位提醒 → ④ 可直接落地的布置或行动建议。';
  }
  if (MACRO_LUCK_METHODS.has(method)) {
    return '输出格式：① 一句话年度大势总断 → ② 核心气候/趋势依据（必须翻译为现代体感到冷暖干湿或行业趋势，严禁堆砌古文病症/凶辞吓人）→ ③ 顺风点与防备点 → ④ 务实生活或处事建议。';
  }
  if (CARD_SIGN_METHODS.has(method) || method === 'number-energy') {
    return style === 'concise'
      ? '输出格式（精简直白）：① 一句话直给结论 → ② 2–3 条生活化依据 → ③ 一条当下最该做的具体动作。'
      : '输出格式：① 核心直断 → ② 关键依据（生活化大白话，不念学术审查腔）→ ③ 留意信号与盲区 → ④ 接地气的行动建议。';
  }
  if (method === 'fortune' && promptText.includes('【AI 报告输出规范】')) {
    return '输出格式：严格按上方【AI 报告输出规范】分节输出，保持简洁直白、不重复抄录加减分日志。';
  }
  if (style === 'concise') {
    return '输出格式（精简直白）：① 一句话直给结论 → ② 2–3 条最核心依据（用大白话讲清）→ ③ 一条当下最该做的具体动作。';
  }
  if (style === 'deep') {
    return '输出格式（专业详尽）：① 核心总断 → ② 分层拆解关键盘面事实、格局/规则与古籍原文 → ③ 冲突因子与反证条件 → ④ 阶段时间窗口（无推运数据时不编月份）与务实策略。';
  }
  return '输出格式：① 一句话明确结论 → ② 2–4 条最关键的盘面依据 → ③ 机会、阻力与关键节点（无推运数据时不编具体月份）→ ④ 具体可落地的行动建议。';
}

function resolveGuidanceOptions(explicit?: PromptGuidanceOptions): Required<PromptGuidanceOptions> {
  const fromProvider = defaultGuidanceProvider?.() ?? {};
  const merged = { ...fromProvider, ...explicit };
  return {
    enableContract: merged.enableContract ?? true,
    replyStyle:
      merged.replyStyle === 'concise' || merged.replyStyle === 'deep' ? merged.replyStyle : 'standard',
    topTaskAnchor: merged.topTaskAnchor ?? false,
    customFramework: typeof merged.customFramework === 'string' ? merged.customFramework.trim() : '',
  };
}

export function buildPromptGuidance(
  method: Method,
  question = '',
  promptText = '',
  options?: PromptGuidanceOptions,
): string {
  const resolved = resolveGuidanceOptions(options);
  if (!resolved.enableContract) {
    return resolved.customFramework ? `【用户自定义规则框架】\n${resolved.customFramework}` : '';
  }

  if (REFERENCE_LOOKUP_METHODS.has(method)) {
    const rules = [
      '直给事实，不废话：严禁自行重新计算或编造原文/日期，直接依据上方引擎结果回答；若资料确有缺失或与问题年份不符，如实简短说明。',
      getReplyStructureRule(method, resolved.replyStyle, promptText),
    ];
    const sections = [[GUIDANCE_HEADER, ...rules.map((line, index) => `${index + 1}. ${line}`)].join('\n')];
    if (resolved.customFramework) {
      sections.push(`【用户自定义规则框架】\n${resolved.customFramework}`);
    }
    return sections.join('\n\n');
  }

  const topic = question ? parseQuestionContext(question).inferredTopic : 'general';
  if (CARD_SIGN_METHODS.has(method) || method === 'number-energy') {
    const topicRule = getTopicFocusRule(method, topic, promptText);
    const rules = [
      `温和直白，严禁重算或编造：紧扣上方「${getEvidenceFocus(method, promptText)}」，用生活化大白话直断当下处境与可行建议，不堆砌免责或审查腔；追问沿用原盘不重抽。`,
      ...(topicRule ? [topicRule] : []),
      getReplyStructureRule(method, resolved.replyStyle, promptText),
    ];
    const sections = [[GUIDANCE_HEADER, ...rules.map((line, index) => `${index + 1}. ${line}`)].join('\n')];
    if (resolved.customFramework) {
      sections.push(`【用户自定义规则框架】\n${resolved.customFramework}`);
    }
    return sections.join('\n\n');
  }

  const rules = [
    '直面推演，拒绝敷衍：请直接按传统术数逻辑给出明确判断与拆解，不要以“AI 不能算命/无法预测/缺乏科学依据”推脱，不要堆砌免责声明，不要说“既有机遇又有挑战”类空话。',
    `禁止重算，不抄盘面：上方数据已由引擎精确算出，严禁重算或篡改；不要复述原盘凑字数，只挑与问题最相关的「${getEvidenceFocus(method, promptText)}」展开，未给出的原文或应期不编造。`,
    '大白话转译：将专业黑话、神煞、星象或古诀直接翻译成普通人秒懂的生活/职场大白话，不生硬堆砌术语或吓人古辞（若当前盘面未带流年推运数据，明说需补流年，严禁编造具体月份）。',
    '主次分明：核心主因定基调，并列呈现盘面中的有利与不利条件及其触发时机，不强行抹平矛盾，也不把单点信号绝对化。',
  ];
  const scenarioRule = getScenarioRule(method, promptText);
  if (scenarioRule) rules.push(scenarioRule);
  const topicRule = getTopicFocusRule(method, topic, promptText);
  if (topicRule) rules.push(topicRule);
  rules.push(getReplyStructureRule(method, resolved.replyStyle, promptText));

  const sections = [[GUIDANCE_HEADER, ...rules.map((line, index) => `${index + 1}. ${line}`)].join('\n')];
  if (resolved.customFramework) {
    sections.push(`【用户自定义规则框架】\n${resolved.customFramework}`);
  }
  return sections.join('\n\n');
}

function resolveAnchorYear(referenceTime?: string): number {
  if (referenceTime) {
    const trimmed = referenceTime.trim();
    if (/^\d{4}$/.test(trimmed)) {
      const y = Number(trimmed);
      if (y >= 1900 && y <= 2200) return y;
    }
    const parsed = Date.parse(trimmed);
    if (Number.isFinite(parsed)) {
      const y = new Date(parsed + 8 * 3_600_000).getUTCFullYear();
      if (y >= 1900 && y <= 2200) return y;
    }
  }
  return new Date().getFullYear();
}

function buildTopTaskAnchor(question: string, anchorYear?: number): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  const baseYear = anchorYear ?? new Date().getFullYear();
  const yearNote = `（时间基准：${baseYear}年为${getYearSixtyCycle(baseYear)}年，${baseYear + 1}年为${getYearSixtyCycle(baseYear + 1)}年）`;
  const focus = clean && clean !== '问题'
    ? `请紧扣用户问题“${clean.slice(0, 60)}${clean.length > 60 ? '…' : ''}”直接推演作答；`
    : '请紧扣文末用户问题直接推演作答；';
  return `${TOP_ANCHOR_HEADER}\n${focus}${yearNote}下方盘面与规则指标已由引擎精确算出，严禁自行重新排盘或篡改数据，也不要推脱敷衍。`;
}

/**
 * 将本地推荐解读框架与已有提示词无冲突融合：
 * 若存在【解读与交付契约】中的默认“输出格式”条目，将其替换为指向该框架的衔接语，
 * 避免同一份提示词末尾并排出现两套互相矛盾的四步输出模板。
 */
export function mergeFrameworkIntoPrompt(promptText: string, frameworkBlock: string): string {
  if (!promptText.trim() || !frameworkBlock.trim()) return promptText;
  if (promptText.includes('【指定解读框架：')) return promptText;
  let next = promptText.trimEnd();
  // 若已有【AI 报告输出规范】（如运势页），与外部指定框架二选一，避免三套格式并存
  next = next.replace(/\n{2,}【AI 报告输出规范】[\s\S]*?(?=\n{2,}【|$)/u, '');
  if (next.includes(GUIDANCE_HEADER)) {
    next = next.replace(
      /^(\d+\.\s*)输出格式(?:（[^）]+）)?[：:][^\n]+$/mu,
      '$1输出格式：严格按下方【指定解读框架】分步结构输出，保持通俗直白、有据可依。',
    );
  }
  return `${next}\n\n${frameworkBlock.trim()}`;
}

export function applyPromptGuidance<T extends { text?: string } | undefined>(
  method: Method,
  prompt: T,
  question = '',
  options?: PromptGuidanceOptions,
  referenceTime?: string,
): T {
  if (!prompt || typeof prompt.text !== 'string' || !prompt.text.trim()) return prompt;
  const resolved = resolveGuidanceOptions(options);
  let text = prompt.text;

  if (
    resolved.topTaskAnchor
    && text.length >= LONG_PROMPT_ANCHOR_THRESHOLD
    && !text.includes(TOP_ANCHOR_HEADER)
  ) {
    text = `${buildTopTaskAnchor(question, resolveAnchorYear(referenceTime))}\n\n${text}`;
  }

  if (!text.includes(GUIDANCE_HEADER)) {
    const guidance = buildPromptGuidance(method, question, prompt.text, resolved);
    if (guidance) {
      text = `${text}\n\n${guidance}`;
    }
  }

  return text === prompt.text ? prompt : { ...prompt, text };
}
