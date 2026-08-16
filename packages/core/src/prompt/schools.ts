import { buildPromptSection } from './sections';

export interface PromptSchoolProfile {
  label: string;
  task: string;
  basis: string;
  category: '流派' | '断法' | '侧重';
}

type PromptSchoolProfiles = Record<string, Record<string, PromptSchoolProfile>>;

/**
 * 各术数可由同一份既定盘面支持的解读口径。
 * 会改变排盘结果的算法（例如奇门转盘/飞盘、拆补/置闰）不放在这里，
 * 由各自排盘参数决定并在盘面资料中明确标注。
 */
export const PROMPT_SCHOOL_PROFILES = {
  bazi: {
    ziping: {
      label: '子平派',
      category: '流派',
      task: '以月令为提纲，结合日主根气、透干、格局成败、调候与岁运制化形成判断。',
      basis: '《渊海子平》《三命通会》《子平真诠》《滴天髓》《穷通宝鉴》的子平法资料。',
    },
    mangpai: {
      label: '盲派',
      category: '流派',
      task: '以四柱宫位和十神落位为骨架，结合宾主、体用、透干通根、墓库空亡、组合做功与分柱年限形成判断。',
      basis: '子平典籍的十神、藏干、宫位和生克资料，以及近现代盲派通行整理口径。',
    },
    xinpai: {
      label: '新派',
      category: '流派',
      task: '按月令、司令、通根、帮扶与克泄耗判定旺衰，落实喜用忌神的位置并观察原局与岁运的动态作用。',
      basis: '子平典籍的旺衰、调候和生克制化资料，以及近现代新派通行整理口径。',
    },
  },
  ziwei: {
    sanhe: {
      label: '三合派',
      category: '流派',
      task: '以命身宫为核心，结合本宫主星庙旺、对宫、三方四正和辅煞夹拱形成判断。',
      basis: '《紫微斗数全书》《紫微斗数全集》的宫位、星曜与三方四正资料。',
    },
    feixing: {
      label: '飞星派',
      category: '流派',
      task: '以生年、运限、自化和飞化链路为主线，追踪四化起点、落宫及宫位之间的动态作用。',
      basis: '《紫微斗数全书》的十干四化资料及后世飞星派通行读法。',
    },
    sihua: {
      label: '四化派',
      category: '流派',
      task: '以禄权科忌为主线，结合生年四化、运限四化及其落宫解释主题、助力、显化与阻滞。',
      basis: '《紫微斗数全书》的十干四化资料及四化派通行读法。',
    },
  },
  liuyao: {
    huozhulin: {
      label: '火珠林法',
      category: '断法',
      task: '以纳甲、六亲、世应、用神和月日旺衰为主线，结合动变、空破与伏神形成判断。',
      basis: '京房八宫纳甲体系及《火珠林》的纳甲占断资料。',
    },
    bushizhengzong: {
      label: '《卜筮正宗》法',
      category: '断法',
      task: '先定用神与原忌仇神，再结合月建日辰、动变生克、旬空月破和进退反伏形成判断。',
      basis: '《卜筮正宗》的用神、生克制化、动变与病药资料。',
    },
    zengshanbuyi: {
      label: '《增删卜易》法',
      category: '断法',
      task: '以用神真实旺衰和日月动变的有效作用为核心，结合应期与卦中实际触发形成判断。',
      basis: '《增删卜易》的用神旺衰、日月动变与应期资料。',
    },
  },
  meihua: {
    tiyong: {
      label: '体用生克法',
      category: '断法',
      task: '以体卦为主体、用卦为事项，结合主互变三层体用生克和四时旺衰形成判断。',
      basis: '通行本《梅花易数》的体用、互变与四时旺衰资料。',
    },
    xiangshu: {
      label: '象数取象法',
      category: '断法',
      task: '结合卦象、五行、方位、时序和动爻位置提取事项的形态、人物与过程线索。',
      basis: '《周易》八卦象类与通行本《梅花易数》的象数资料。',
    },
    yaoci: {
      label: '卦爻辞参断法',
      category: '断法',
      task: '以本卦、动爻和变卦对应的卦爻辞为义理主线，结合体用和盘面事实回答问题。',
      basis: '《周易》卦辞、爻辞及传统易象资料。',
    },
  },
  xiaoliuren: {
    shunshu: {
      label: '六宫顺数法',
      category: '断法',
      task: '依据农历月、日、时逐步顺数所得时宫，结合月宫、日宫到时宫的递进关系判断过程。',
      basis: '通行俗传小六壬六宫顺数掌诀。',
    },
    gongjue: {
      label: '六宫歌诀法',
      category: '断法',
      task: '以最终落宫歌诀为核心，结合月、日、时三宫的吉凶层次和语义形成判断。',
      basis: '通行俗传小六壬六宫歌诀。',
    },
  },
  jinkoujue: {
    siwei: {
      label: '四位生克法',
      category: '断法',
      task: '以地分、将神、贵神、人元四位及其五行生克、阴阳和月令旺衰形成判断。',
      basis: '《六壬神课金口诀古本》的四位、阴阳次第与五用资料。',
    },
    fayong: {
      label: '阴阳发用法',
      category: '断法',
      task: '先依阴阳次第确定发用位置，再结合发用旺衰、空亡及其与其余三位的作用形成判断。',
      basis: '《六壬神课金口诀古本》的阴阳发用资料。',
    },
    wudong: {
      label: '五动三动法',
      category: '断法',
      task: '以盘面实际成立的五动、三动为事件主线，结合四位关系说明人物、过程与结果。',
      basis: '《六壬神课金口诀古本》的五动三动资料。',
    },
  },
  qimen: {
    gongwei: {
      label: '宫位用神法',
      category: '断法',
      task: '先确定事项用神及其落宫，结合宫内门、星、神、天地盘干和宫位生克形成判断。',
      basis: '《烟波钓叟歌》《御定奇门宝鉴》的九宫、三奇六仪、九星八门八神资料。',
    },
    geju: {
      label: '格局取象法',
      category: '断法',
      task: '以值符值使、三奇格局、九遁、伏吟反吟、门迫击刑、入墓空亡等实际命中格局形成判断。',
      basis: '《烟波钓叟歌》《御定奇门宝鉴》《奇门遁甲秘籍大全》的格局资料。',
    },
    zhuke: {
      label: '主客方略法',
      category: '断法',
      task: '结合日干、时干、值符值使和事项用神区分主客、动静、先后与方位时机，形成策略判断。',
      basis: '时家奇门主客、动静、方位与时机的通行资料。',
    },
  },
  liuren: {
    keti: {
      label: '课体法',
      category: '断法',
      task: '以四课、发用、取传规则、三传结构和课体为主线，说明事情的发端、转折与归结。',
      basis: '《大六壬大全》《御定六壬直指》的四课三传与课体资料。',
    },
    bifafu: {
      label: '《毕法赋》法',
      category: '断法',
      task: '依据盘面实际成立的课传关系，对照《毕法赋》法则提炼主要矛盾、助力和阻力。',
      basis: '《毕法赋》及《六壬指南》的课传判断资料。',
    },
    leishen: {
      label: '类神神将法',
      category: '断法',
      task: '围绕问题选取类神，结合类神在四课三传中的旺衰、空亡、天将和前后传递形成判断。',
      basis: '《大六壬大全》《六壬指南》的类神、天将与旺衰资料。',
    },
  },
  tarot: {
    rws: {
      label: 'RWS 图像法',
      category: '流派',
      task: '依据牌面图像、人物姿态、象征物、正逆位及牌位职能形成判断。',
      basis: 'Rider-Waite-Smith 体系及《The Pictorial Key to the Tarot》的牌义资料。',
    },
    yuansu: {
      label: '元素与数序法',
      category: '断法',
      task: '结合牌组层次、火水风土元素、数字递进与宫廷牌角色观察能量分布和发展阶段。',
      basis: 'Rider-Waite-Smith 体系的四元素、数字序列与大小阿卡纳结构。',
    },
    narrative: {
      label: '牌阵叙事法',
      category: '断法',
      task: '按牌位顺序和相邻牌关系建立事件线，说明现状、推动因素、转折与趋向。',
      basis: '现代塔罗牌阵位置、牌序与组合解读的通行资料。',
    },
  },
  lenormand: {
    combination: {
      label: '邻牌组合法',
      category: '断法',
      task: '以相邻牌的名词、动词和修饰关系组成事件短句，再结合牌序回答现实问题。',
      basis: 'Petit Lenormand 传统牌义与邻牌组合资料。',
    },
    eventline: {
      label: '事件线法',
      category: '断法',
      task: '按牌阵位置与牌序追踪事件的起点、变化、阻力和结果，突出可观察的现实发展。',
      basis: 'Petit Lenormand 牌序与线性牌阵的通行读法。',
    },
    significator: {
      label: '主题牌法',
      category: '断法',
      task: '以问题对应的主题牌为中心，结合其邻牌、方向和所在位置归纳核心人物与事件。',
      basis: 'Petit Lenormand 主题牌与邻牌关系的通行读法。',
    },
  },
  almanac: {
    xieji: {
      label: '协纪择日法',
      category: '流派',
      task: '先核对事项宜忌和直接冲犯，再综合岁月日时神煞、参与人关系与可用时辰比较候选日。',
      basis: '《钦定协纪辨方书》的择日体系资料。',
    },
    jianchu: {
      label: '建除十二神法',
      category: '断法',
      task: '以建除十二神与事项性质的匹配为主线，结合日辰宜忌、冲煞和时辰形成判断。',
      basis: '传统建除十二神及《选择要略》的择日资料。',
    },
    comprehensive: {
      label: '综合择日法',
      category: '断法',
      task: '分层比较原始宜忌、建除、宿曜神煞、参与人刑冲破害与可用时辰，形成候选日排序。',
      basis: '《钦定协纪辨方书》《选择要略》及通行择日资料。',
    },
  },
  astrolabe: {
    modern: {
      label: '现代心理占星',
      category: '流派',
      task: '以太阳、月亮、上升、命主星和主要相位解释性格动力、需求、关系模式与成长主题。',
      basis: '现代西方占星的行星、星座、宫位与相位通行资料。',
    },
    traditional: {
      label: '古典占星',
      category: '流派',
      task: '以命主星、宫主星、行星落宫与主要相位为主线，结合盘面已列资料判断具体生活领域。',
      basis: '希腊化与传统西方占星的宫位主宰、行星性质和相位资料。',
    },
    timing: {
      label: '时限触发法',
      category: '断法',
      task: '以本命结构为根，结合盘面实际提供的行运或时限资料观察阶段主题和触发时间。',
      basis: '现代与传统西方占星的本命承接和行运触发通行资料。',
    },
  },
  taiyi: {
    zhuke: {
      label: '主客定算法',
      category: '断法',
      task: '以主算、客算、定算及主客将参为核心，比较主客强弱、动静与攻守条件。',
      basis: '《太乙金镜式经》的主客定算与将参资料。',
    },
    gongwei: {
      label: '宫位神将法',
      category: '断法',
      task: '结合太乙、文昌、始击、计神的落宫、阴阳遁和局数形成阶段局势判断。',
      basis: '《太乙金镜式经》的七十二局与神将落宫资料。',
    },
  },
  bazhai: {
    dayounian: {
      label: '大游年法',
      category: '断法',
      task: '以宅卦起大游年，结合八方四吉四凶及门、房、灶所在方位形成判断。',
      basis: '《八宅明镜》《阳宅十书》的宅卦与大游年八宫资料。',
    },
    mingzhai: {
      label: '命宅配合法',
      category: '断法',
      task: '结合命卦、宅卦、东四西四分类与实际门向，判断居住者和住宅方位的配合。',
      basis: '《八宅明镜》《阳宅十书》的命卦、宅卦与人宅配合资料。',
    },
  },
  residential: {
    bazhai: {
      label: '八宅派',
      category: '流派',
      task: '依据命卦、宅卦、坐向门向和八方四吉四凶判断人宅配合与空间用途。',
      basis: '《八宅明镜》《阳宅十书》的八宅大游年资料。',
    },
    xuankong: {
      label: '玄空飞星派',
      category: '流派',
      task: '依据三元九运、运盘山盘向盘、旺衰与到山到向判断宅运和方位时效。',
      basis: '玄空飞星三元九运、元龙阴阳顺逆与下卦资料。',
    },
  },
  xuankong: {
    sanYuan: {
      label: '三元九运法',
      category: '断法',
      task: '以建造时间所属三元九运和当前运势为背景，判断各星当运、退运与未来作用。',
      basis: '玄空飞星三元九运与九星旺衰的通行资料。',
    },
    shanxiang: {
      label: '山向飞星法',
      category: '断法',
      task: '以坐山、向首、运盘、山盘和向盘的组合为核心，判断到山到向及各宫作用。',
      basis: '玄空飞星二十四山、元龙阴阳顺逆和下卦飞布资料。',
    },
  },
  qizheng: {
    guolao: {
      label: '果老星宗法',
      category: '流派',
      task: '以命身宫、七政四余、星曜落宫与二十八宿为骨架，结合主要吊照形成判断。',
      basis: '《果老星宗》的命身、星曜、宫位与吊照资料。',
    },
    wuxingjingyi: {
      label: '五星精义法',
      category: '断法',
      task: '以日月五星性质、星曜强弱、宫位和彼此关系为主线，结合盘面已列星历位置形成判断。',
      basis: '《御定五星精义》《星学大成》的五星、宫位与星曜关系资料。',
    },
  },
  zodiac: {
    ganzhi: {
      label: '干支关系法',
      category: '断法',
      task: '以生肖地支与流年干支的值、冲、刑、害、破、六合关系形成年度判断。',
      basis: '《三命通会》等传统干支关系资料。',
    },
    sanhe: {
      label: '三合五行法',
      category: '断法',
      task: '结合生肖所属三合三会、流年五行和年干生克，观察助力、牵制与环境变化。',
      basis: '传统地支三合三会与干支五行生克资料。',
    },
  },
  'wuyun-liuqi': {
    yunqi: {
      label: '五运六气法',
      category: '断法',
      task: '以岁运、司天、在泉、主气和客气为骨架，说明全年气候与阶段气化主线。',
      basis: '《黄帝内经·素问》七篇大论的五运六气资料。',
    },
    sitian: {
      label: '司天在泉法',
      category: '断法',
      task: '以司天主上半年、在泉主下半年的气化关系为主线，结合间气与时段变化形成判断。',
      basis: '《素问·天元纪大论》《素问·六微旨大论》等司天在泉资料。',
    },
    kezhu: {
      label: '客主加临法',
      category: '断法',
      task: '逐步比较主运客运、主气客气的加临、生克与顺逆，观察各阶段偏盛偏衰。',
      basis: '《素问》运气七篇的主客运气与加临资料。',
    },
  },
  'huangji-jingshi': {
    yuanhui: {
      label: '元会运世法',
      category: '断法',
      task: '以元、会、运、世的时间层级定位当前阶段，再结合值年卦观察长期与年度主题。',
      basis: '《皇极经世》的元会运世时间体系资料。',
    },
    guaqi: {
      label: '值年卦气法',
      category: '断法',
      task: '以值年卦、互卦、变卦和动爻为主线，结合卦气与时间位置形成年度判断。',
      basis: '《皇极经世》值年卦与传统卦气资料。',
    },
  },
} as const satisfies PromptSchoolProfiles;

export type PromptSchoolMethod = keyof typeof PROMPT_SCHOOL_PROFILES;
export type PromptSchoolId<Method extends PromptSchoolMethod> =
  keyof (typeof PROMPT_SCHOOL_PROFILES)[Method] & string;

export function getPromptSchoolProfiles(method: PromptSchoolMethod) {
  return PROMPT_SCHOOL_PROFILES[method] as Record<string, PromptSchoolProfile>;
}

export function getPromptSchoolIds(method: PromptSchoolMethod) {
  return Object.keys(getPromptSchoolProfiles(method));
}

export function normalizePromptSchoolIds(
  method: PromptSchoolMethod,
  schools?: readonly string[] | null,
) {
  if (!schools?.length) return [];
  const profiles = getPromptSchoolProfiles(method);
  const selected: string[] = [];
  for (const school of schools) {
    if (!(school in profiles)) {
      throw new RangeError(
        `${method} 不支持解读口径 ${school}；可选值：${Object.keys(profiles).join('、')}。`,
      );
    }
    if (!selected.includes(school)) selected.push(school);
  }
  if (selected.length > 3) throw new RangeError('多口径合参最多选择三个值。');
  return selected;
}

export function getPromptSchoolSectionTitle(
  method: PromptSchoolMethod,
  schools?: readonly string[] | null,
) {
  const selected = normalizePromptSchoolIds(method, schools);
  if (!selected.length) return '';
  const profiles = getPromptSchoolProfiles(method);
  const categories = [...new Set(selected.map((school) => profiles[school].category))];

  if (selected.length === 1) return `解读${categories[0]}`;
  if (categories.length > 1) return '多口径合参';
  if (categories[0] === '流派') return '多派合参';
  if (categories[0] === '断法') return '多法合参';
  return '多角度合参';
}

export function formatPromptSchoolGuidance(
  method: PromptSchoolMethod,
  schools?: readonly string[] | null,
) {
  const selected = normalizePromptSchoolIds(method, schools);
  if (!selected.length) return '';
  const profiles = getPromptSchoolProfiles(method);
  const blocks = selected.map((school, index) => {
    const profile = profiles[school];
    const prefix = selected.length > 1 ? `${profile.category}${index + 1}` : profile.category;
    return [
      `${prefix}：${profile.label}`,
      `${profile.category}任务：${profile.task}`,
      `传统依据：${profile.basis}`,
    ].join('\n');
  });
  if (selected.length > 1) {
    blocks.push(
      '合参任务：请先按每种解读口径分别形成判断，再归纳共同结论、分歧及各自对应的盘面依据，最后围绕问题给出综合判断。',
    );
  }
  return blocks.join('\n\n');
}

export function buildPromptSchoolSection(
  method: PromptSchoolMethod,
  schools?: readonly string[] | null,
) {
  const selected = normalizePromptSchoolIds(method, schools);
  const guidance = formatPromptSchoolGuidance(method, selected);
  return guidance
    ? buildPromptSection(getPromptSchoolSectionTitle(method, selected), guidance)
    : '';
}
