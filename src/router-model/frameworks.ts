/**
 * 浏览器端轻量推荐小模型 — 8 大提示词解读框架与 10 大细分主题领域看盘侧重点模块
 * 用于在前端本地提前锁定“回答结构框架 + 主题看盘侧重点”，大幅减轻下游大模型负担并防跑偏。
 */

import {
  DIVINATION_METHODS,
  normalizeQuery,
  type MethodId,
  type RouterInput,
} from './features';

export const FRAMEWORK_IDS = [
  'decision-ab',
  'event-verdict',
  'period-roadmap',
  'natal-panorama',
  'relationship-diagnosis',
  'crisis-remedy',
  'space-layout',
  'naming-aesthetic',
] as const;

export type FrameworkId = (typeof FRAMEWORK_IDS)[number];

export const DOMAIN_IDS = [
  'career',
  'wealth',
  'love',
  'family',
  'study',
  'health',
  'travel',
  'dispute',
  'lost_and_misc',
  'general',
] as const;

export type DomainId = (typeof DOMAIN_IDS)[number];

export interface PromptFrameworkDef {
  id: FrameworkId;
  name: string;
  summary: string;
  template: string;
}

export interface DomainDefinition {
  id: DomainId;
  label: string;
  generalFocus: string[];
  byMethodFamily: Partial<Record<MethodFamily, string[]>>;
  safetyNote?: string;
}

type MethodFamily =
  | 'bazi'
  | 'ziwei'
  | 'astrolabe'
  | 'qizheng'
  | 'qimen'
  | 'liuyao'
  | 'liuren'
  | 'meihua'
  | 'cards'
  | 'fengshui'
  | 'almanac'
  | 'naming'
  | 'macro';

function getMethodFamily(method: MethodId): MethodFamily {
  switch (method) {
    case 'bazi':
    case 'bazi-synastry':
    case 'bazi-reverse':
    case 'bazi-ziwei':
    case 'minglu':
      return 'bazi';
    case 'ziwei':
    case 'ziwei-synastry':
      return 'ziwei';
    case 'astrolabe':
    case 'astrolabe-synastry':
    case 'astrolabe-range':
      return 'astrolabe';
    case 'qizheng':
    case 'qizheng-range':
      return 'qizheng';
    case 'qimen':
    case 'qimen-lifetime':
      return 'qimen';
    case 'liuyao':
    case 'zhouyi':
      return 'liuyao';
    case 'liuren':
    case 'jinkoujue':
    case 'xiaoliuren':
      return 'liuren';
    case 'meihua':
    case 'zhuge':
    case 'ssgw':
    case 'instant':
    case 'random-divination':
      return 'meihua';
    case 'tarot':
    case 'lenormand':
      return 'cards';
    case 'bazhai':
    case 'xuankong':
    case 'residential':
      return 'fengshui';
    case 'almanac':
    case 'calendar':
      return 'almanac';
    case 'chinese-name':
    case 'chinese-naming':
    case 'character-query':
    case 'number-energy':
      return 'naming';
    case 'wuyun-liuqi':
    case 'taiyi':
    case 'huangji-jingshi':
    case 'fortune':
    default:
      return 'macro';
  }
}

export const PROMPT_FRAMEWORKS: Record<FrameworkId, PromptFrameworkDef> = {
  'decision-ab': {
    id: 'decision-ab',
    name: '二选一/重大决策权衡框架',
    summary: '双路径利弊对照 + 风险底线 + 行动窗口 + 明确倾向',
    template: [
      '请严格按以下四步结构输出【二选一/重大决策权衡报告】：',
      '1. 【双路径利弊对照】：分别拆解方案 A 与方案 B 的盘面依据、核心收益与现实短板，禁止模棱两可。',
      '2. 【风险底线与盲区】：明确指出每个选项最容易踩坑的环节、隐性成本及不可接受的底线条件。',
      '3. 【关键行动窗口】：给出最利于拍板、签约或切换赛道的时间节点与观察信号。',
      '4. 【明确倾向结论】：在首尾均给出清晰的倾向建议，并说明“什么前提下选 A、什么前提下选 B”。',
    ].join('\n'),
  },
  'event-verdict': {
    id: 'event-verdict',
    name: '单事占验与应期直断框架',
    summary: '首句先断成败倾向 + 用神/主客依据 + 阻滞点 + 应期时间窗',
    template: [
      '请严格按以下四步结构输出【单事占验与应期直断报告】：',
      '1. 【首句直断结论】：开篇第一句直接给出成败/吉凶倾向（成、难成、先阻后成等），不要绕弯。',
      '2. 【用神与主客依据】：只围绕本次核心用神、主客生克或牌面主线展开，禁止堆砌无关神煞。',
      '3. 【关键阻滞点】：指出事情推进中最容易卡壳的人、事或外部变量。',
      '4. 【应期时间窗与应对】：给出最可能出结果或转折的时间窗口，并附 2 条可立即执行的现实建议。',
    ].join('\n'),
  },
  'period-roadmap': {
    id: 'period-roadmap',
    name: '流年/周期运势规划框架',
    summary: '年度总基调 + 重点流月/节点节奏 + 发力方向 + 防守红线',
    template: [
      '请严格按以下四步结构输出【流年/周期运势规划报告】：',
      '1. 【周期总基调】：用一句大白话概括本阶段（日/月/年/周期）的整体气象与主旋律。',
      '2. 【重点流月与节点节奏】：按时间顺序标出最值得把握的上升窗口与需谨慎应对的波动节点。',
      '3. 【主动发力方向】：明确这段时间最容易出成果的发力点（事业、求财、合作、学习或关系）。',
      '4. 【防守红线清单】：给出 2～3 条明确的避险红线（如大额投资、冲动辞职、情绪决裂或作息透支）。',
    ].join('\n'),
  },
  'natal-panorama': {
    id: 'natal-panorama',
    name: '本命全景与大运路线图框架',
    summary: '格局根基 + 事业财官 + 感情健康 + 人生大运走势',
    template: [
      '请严格按以下四步结构输出【本命全景与大运路线图报告】：',
      '1. 【本命格局根基】：点出命主底层性格底色、核心优势与最需修补的短板（若有未知时辰则先说明考时定盘重点）。',
      '2. 【事业与财官路径】：判断更适合平台稳进、专业深耕还是创业求财，说明生财方式与守财要点。',
      '3. 【感情与身心提示】：梳理亲密关系相处模式及长期身心保养重点。',
      '4. 【人生大运路线图】：按阶段梳理当下及未来 5～10 年大运/大限/行运起伏，指出关键转折年份。',
    ].join('\n'),
  },
  'relationship-diagnosis': {
    id: 'relationship-diagnosis',
    name: '关系合盘与相处诊断框架',
    summary: '双方底色 + 互补与摩擦点 + 关键磨合年份 + 现实相处建议',
    template: [
      '请严格按以下四步结构输出【关系合盘与相处诊断报告】：',
      '1. 【双方关系底色】：概括两人的性格基调、情感/合作需求及互相吸引的核心磁点。',
      '2. 【互补优势与核心摩擦点】：直指双方最能互相成就的地方，以及最容易引发争执或内耗的雷区。',
      '3. 【关键磨合时间节点】：标出近期及未来 1～2 年最考验关系或最利于推进承诺的流年/节点。',
      '4. 【现实相处建议】：给出 3 条具体可落地的沟通方式、分工边界或降温止损建议。',
    ].join('\n'),
  },
  'crisis-remedy': {
    id: 'crisis-remedy',
    name: '破局避坑与风险化解框架',
    summary: '定位核心病药与隐患 + 避坑清单 + 可落地的现实调适方案',
    template: [
      '请严格按以下三步结构输出【破局避坑与风险化解报告】：',
      '1. 【核心病药与隐患定位】：一针见血指出当前诸事不顺、失衡或潜在危机背后的主要触发点。',
      '2. 【高危避坑清单】：列出当下最不能做的 3 件事（防盲目加杠杆、防口舌升级、防情绪化决策）。',
      '3. 【可落地现实调适方案】：结合盘面喜用/有利方位与时机，给出分步骤、低成本、可立即执行的止损与破局动作。',
    ].join('\n'),
  },
  'space-layout': {
    id: 'space-layout',
    name: '阳宅风水与择吉执行框架',
    summary: '吉凶方位/日子定性 + 重点功能区布局 + 避忌与实操步骤',
    template: [
      '请严格按以下三步结构输出【阳宅风水与择吉执行报告】：',
      '1. 【核心定性与优选分级】：明确给出房屋吉凶方位总评或候选吉日的“优选 / 次选 / 慎用”分级结论。',
      '2. 【重点功能区实操布局】：针对大门、主卧床头、书桌、财位/文昌位或具体仪程给出清晰可落地的安排。',
      '3. 【冲克避忌与执行步骤】：提醒需避开的凶位（如五黄、二黑、绝命）或冲克生肖/凶煞，并附简洁执行清单。',
    ].join('\n'),
  },
  'naming-aesthetic': {
    id: 'naming-aesthetic',
    name: '姓名分析与起名审美框架',
    summary: '音形义美感 + 文化底蕴 + 谐音避讳排查 + 备选方案对比',
    template: [
      '请严格按以下四步结构输出【姓名分析与起名审美报告】：',
      '1. 【音形义美感评测】：分析读音平仄韵律、字形繁简平衡、书写观感与字义搭配张力。',
      '2. 【文化底蕴与五行适配】：说明字词典故出处、气质适配度，以及与生辰/偏好五行的贴合程度。',
      '3. 【谐音避讳与重名排查】：逐一核查普通话与常见方言谐音、生僻字风险及烂大街网红字倾向。',
      '4. 【优选对比建议】：对多个候选名或单字做横向对比，明确给出最推荐排序及理由。',
    ].join('\n'),
  },
};

export const DOMAIN_DEFINITIONS: Record<DomainId, DomainDefinition> = {
  career: {
    id: 'career',
    label: '事业职场',
    generalFocus: [
      '锁定事业发展路径（体制/大平台/专业深耕/自主创业）与晋升跳槽窗口',
      '重点排查职场贵人助力、竞争对手压力及变动风险',
    ],
    byMethodFamily: {
      bazi: ['八字重点看月令格局、官杀印星组合、食伤配印及大运流年事业宫动静'],
      ziwei: ['紫微重点看官禄宫、迁移宫、命宫三方四正及流年四化飞入'],
      astrolabe: ['西洋星盘重点看十宫（MC天顶）、六宫、土星/木星相位及事业行运触发'],
      qizheng: ['七政四余重点看官禄宫、命度主、十干化禄化科及洞微行限'],
      qimen: ['奇门遁甲重点看开门、值符、年命/日干落宫生克与方位助力'],
      liuyao: ['六爻重点看官鬼爻、父母爻（文书/单位）、世应生克及动变应期'],
      liuren: ['大六壬重点看初传中传末传演变、青龙太常贵人与官鬼爻互动'],
      cards: ['牌卡重点看职场权杖/星币能量、对方（面试官/领导）态度及短期推进事件链'],
    },
  },
  wealth: {
    id: 'wealth',
    label: '财运投资',
    generalFocus: [
      '区分正财（薪资主业）与偏财（投资/副业/项目回款）的财源强弱与守财能力',
      '明确提示资金回笼节点、破财/被套风险与风控底线（投资请自主审慎决策）',
    ],
    byMethodFamily: {
      bazi: ['八字重点看正偏财源、食伤生财路径、财库开合与比劫护财/夺财'],
      ziwei: ['紫微重点看财帛宫、田宅宫（不动产与积蓄）、兄弟宫（现金流库位）及化禄化忌'],
      astrolabe: ['西洋星盘重点看二宫财帛、八宫偏财投资、金星木星相位及土星约束'],
      qizheng: ['七政四余重点看财帛宫、禄勋科名与流曜入财宫的恩难生克'],
      qimen: ['奇门遁甲重点看生门、戊土资本、日干与生门生克及求财有利方位'],
      liuyao: ['六爻重点看妻财爻旺衰、子孙爻（财源）及兄弟爻是否动而劫财'],
      liuren: ['大六壬重点看财爻落宫、青龙财星与玄武防骗隐患'],
      fengshui: ['风水重点看当运向星财位、八宅生气/延年位及流年八白九紫财星飞临'],
      naming: ['号码/姓名重点看天医、延年等守财聚气组合，排查绝命五鬼破耗象意'],
    },
  },
  love: {
    id: 'love',
    label: '感情婚姻',
    generalFocus: [
      '聚焦双方情感温度、真实态度、相处模式及关系推进/复合/婚期节点',
      '区分单人姻缘走势与双人合盘磨合，给出具体可落地的沟通建议',
    ],
    byMethodFamily: {
      bazi: ['八字重点看日支夫妻宫、男看财星女看官杀、桃花合冲及双人合盘喜忌互补'],
      ziwei: ['紫微重点看夫妻宫、福德宫（情绪感受）、红鸾天喜及合盘生年四化跨盘落宫'],
      astrolabe: ['西洋星盘重点看金星、火星、月亮、七宫与比较盘跨盘相位及接纳互溶'],
      qizheng: ['七政四余重点看夫妻宫宿度、日月金星庙旺与流曜引动'],
      qimen: ['奇门遁甲重点看六合、乙奇/庚金落宫关系及双方门星神互动'],
      liuyao: ['六爻重点看应爻、世应生合冲克及财官用神动变与空亡'],
      cards: ['塔罗/雷诺曼重点看圣杯情感流动、双方潜意识视角与近期关系现实事件线'],
    },
  },
  family: {
    id: 'family',
    label: '家庭六亲',
    generalFocus: [
      '关注家人相处磨合、亲子教育、长辈照料与家宅居住安宁',
      '强调温和沟通边界与实际生活安排',
    ],
    byMethodFamily: {
      bazi: ['八字重点看年柱父母宫、月柱兄弟、时柱子女宫及印财官食互动'],
      ziwei: ['紫微重点看田宅宫、父母宫、子女宫、兄弟宫及六亲四化互动'],
      fengshui: ['风水重点看大门、主卧、厨房与儿童房功能区配卦及家宅飞星安稳度'],
      almanac: ['黄历择日重点过滤冲克参与家人生肖与三娘煞/杨公忌等凶煞日'],
      naming: ['起名重点兼顾辈分字、家族避讳与亲子期望寓意'],
    },
  },
  study: {
    id: 'study',
    label: '学业考试',
    generalFocus: [
      '聚焦考试上岸概率、复习发挥状态、专业/院校选择与临场心态',
      '给出考前发力重点与志愿/方向匹配参考',
    ],
    byMethodFamily: {
      bazi: ['八字重点看印星文昌、食伤吐秀、官杀功名与考年流年喜用'],
      ziwei: ['紫微重点看文昌文曲、化科落宫、命迁与官禄宫互动'],
      liuyao: ['六爻重点看父母爻（成绩/录取文书）、官鬼爻（名次功名）及世爻旺衰'],
      qimen: ['奇门遁甲重点看景门（考卷发挥）、天辅星（学业）、值符与日干生克'],
      fengshui: ['风水重点看本命文昌位与四绿文曲飞星方位布局书桌'],
    },
  },
  health: {
    id: 'health',
    label: '健康身心',
    generalFocus: [
      '从传统节律与体质倾向角度提示薄弱脏腑、作息与情绪调节重点',
      '严格恪守医疗安全边界：所有术数分析仅作传统养生文化参考，绝不替代专业医疗诊断与治疗',
    ],
    byMethodFamily: {
      bazi: ['八字重点看五行偏枯、寒暖燥湿失衡及原局/岁运刑冲刃杀'],
      ziwei: ['紫微重点看疾厄宫、福德宫（睡眠与精神状态）及流年煞忌冲照'],
      macro: ['五运六气重点看年度岁运太过不及、司天在泉与当前六气交司对脏腑养生的普遍提醒'],
      liuyao: ['六爻重点看官鬼爻（病症）、子孙爻（医药/康复）与世爻元气旺衰'],
      qimen: ['奇门遁甲重点看天芮星（病灶）、天心星与乙奇（医药医生）及就医有利方位'],
    },
    safetyNote: '⚠️ 医疗安全边界：命理与运气分析仅作日常顺时养生参考，如有身体不适请务必及时前往正规医院就诊并遵医嘱。',
  },
  travel: {
    id: 'travel',
    label: '出行变动',
    generalFocus: [
      '评估出行/出差/迁居/外派的平顺度、有利方位、行程延误或突发阻滞',
      '提醒出发前的备选预案与交通安全细节',
    ],
    byMethodFamily: {
      bazi: ['八字重点看驿马星、寅申巳亥四马地及流年冲动迁移契机'],
      ziwei: ['紫微重点看迁移宫、天马星及外出贵人与波折提示'],
      qimen: ['奇门遁甲重点看目标方位落宫、马星、景门/开门与九天/白虎吉凶'],
      liuyao: ['六爻重点看世爻与应爻（目的地）、父母爻（交通工具）及行程阻滞'],
      liuren: ['小六壬/大六壬/金口诀重点看速喜/大安/空亡/赤口等行程顺逆与延误信号'],
    },
  },
  dispute: {
    id: 'dispute',
    label: '诉讼是非',
    generalFocus: [
      '理清主客胜负强弱、证据文书优势、背后隐情与和解/维权策略',
      '提示防范口舌升级、合同漏洞与暗箱陷阱（法律事务请咨询专业律师）',
    ],
    byMethodFamily: {
      bazi: ['八字重点看官杀刑冲、三刑六害、伤官见官及是非流年'],
      liuyao: ['六爻重点看世应强弱、官鬼爻（官方裁决）、父母爻（证据文书）与朱雀/白虎是非'],
      qimen: ['奇门遁甲重点看值符（裁判）、开门、惊门（口舌官司）、白虎与主客落宫生克'],
      liuren: ['大六壬重点看四课三传人物隐情、玄武欺诈、朱雀口舌与贵人调停'],
    },
  },
  lost_and_misc: {
    id: 'lost_and_misc',
    label: '失物杂占',
    generalFocus: [
      '优先判断物品/宠物/人在室内还是室外、大概方位、周边环境特征及找回时间窗',
      '给出立刻排查的优先区域提示（人员失联请务必同步报警）',
    ],
    byMethodFamily: {
      liuyao: ['六爻重点看用神（妻财/父母/子孙）落宫方位、入墓/伏藏/空亡及出空冲墓应期'],
      liuren: ['小六壬/大六壬重点看大安在家、速喜快寻、空亡难觅或三传指向的方位与场所特征'],
      meihua: ['梅花易数重点看体用生克、卦象方位与外应物象线索'],
      cards: ['雷诺曼/塔罗重点看具象物品线索牌与消息/寻回信号'],
    },
  },
  general: {
    id: 'general',
    label: '综合全盘',
    generalFocus: [
      '先抓最核心的 1～2 个盘面主轴（格局/主星/核心卦象），避免面面俱到流水账',
      '围绕用户当前最在意的现实痛点给出清晰、可执行的下一步行动建议',
    ],
    byMethodFamily: {},
  },
};

export interface DetectedDomainResult {
  id: DomainId;
  label: string;
  focusPoints: string[];
}

export interface RecommendedFrameworkResult {
  id: FrameworkId;
  name: string;
  reason: string;
  template: string;
  composedPromptGuidance: string;
}

const DOMAIN_PATTERNS: Array<{ id: DomainId; weight: number; re: RegExp }> = [
  {
    id: 'lost_and_misc',
    weight: 3.2,
    re: /(丢了|丢东西|找不到|找不着|找不找得回|找得回来|忘在|落在|失物|猫.*跑出去|宠物.*走丢|离家出走|失联|耳机|钥匙|身份证|电脑包|重要文件在哪)/,
  },
  {
    id: 'dispute',
    weight: 3.0,
    re: /(官司|诉讼|仲裁|维权|纠纷|赔偿|骗局|隐瞒|瞒着|作梗|使绊子|谣言|小人|闹掰|欠薪|催.*账|老赖|讨债)/,
  },
  {
    id: 'study',
    weight: 2.8,
    re: /(考研|考公|公务员|教师编|考试|上岸|笔试|高考|选专业|论文|录用|升学|学业|进修|留学|跨考|文昌|科名|一战成硕|读易经|周易.*原文)/,
  },
  {
    id: 'health',
    weight: 2.8,
    re: /(生病|住院|手术|复查|体检|就医|医院|病情|健康|体弱|多病|疾厄宫|失眠|体虚|湿气|痰湿|上火|脾胃|呼吸系统|肝胆|心脑|养生|五运六气|气候.*养生|感冒咳嗽|老慢支)/,
  },
  {
    id: 'travel',
    weight: 2.6,
    re: /(出门|出行|出差|自驾|堵车|误机|赶高铁|旅游|签证|出国|移民|外派|外地|换城市|迁移宫|往.*方向走)/,
  },
  {
    id: 'love',
    weight: 2.6,
    re: /(感情|恋爱|失恋|婚姻|结婚|领证|婚礼|订婚|合婚|对象|伴侣|男友|男朋友|女友|女朋友|老公|老婆|未婚夫|未婚妻|前任|暧昧|暗恋|表白|相亲|桃花|正缘|脱单|分手|冷战|复合|夫妻宫|原谅他|异地恋)/,
  },
  {
    id: 'wealth',
    weight: 2.5,
    re: /(财运|财官|偏财|正财|赚钱|发财|求财|理财|基金|股票|投资|亏损|止盈|财库|存不住钱|破财|花钱|买房|卖房|房产|尾款|报销款|要回来|借.*钱|分红|合不合财|财帛宫|财位|招财|房租|砍价|刮刮乐|打麻将|定金)/,
  },
  {
    id: 'career',
    weight: 2.4,
    re: /(事业|工作|职场|跳槽|辞职|裸辞|面试|复试|终面|简历|offer|升职|加薪|晋升|答辩|调岗|竞聘|裁员|打工|创业|单干|合伙|开店|开业|商铺|公司|客户|签约|竞标|标书|项目|副业|官禄宫|上司|领导|同事|赛道|国企|大厂)/,
  },
  {
    id: 'family',
    weight: 2.3,
    re: /(家人|全家|父母|爸妈|爸爸|妈妈|老人|长辈|孩子|宝宝|女宝|男宝|女儿|儿子|大宝|二胎|母女|母子|父子|亲子|婆婆|婆媳|家宅|搬家|乔迁|入宅|装修|动土|新房|租房|卧室|床头|书桌|厨房|安床|阳宅|田宅宫|买房置业|家里.*(矛盾|关系|风水|装修|老人|孩子))/,
  },
];

export function detectDomain(rawQuery: string, primaryMethod: MethodId): DetectedDomainResult {
  const q = normalizeQuery(rawQuery);
  const scores: Record<DomainId, number> = {
    career: 0,
    wealth: 0,
    love: 0,
    family: 0,
    study: 0,
    health: 0,
    travel: 0,
    dispute: 0,
    lost_and_misc: 0,
    general: 0.5,
  };

  for (const rule of DOMAIN_PATTERNS) {
    const matches = q.match(new RegExp(rule.re.source, 'g'));
    if (matches && matches.length > 0) {
      scores[rule.id] += rule.weight + (matches.length - 1) * 0.9;
    }
  }

  // Slight method priors for specialized tools
  if (primaryMethod === 'wuyun-liuqi') scores.health += 2.2;
  if (primaryMethod === 'bazhai' || primaryMethod === 'xuankong' || primaryMethod === 'residential') {
    if (scores.wealth < 2 && scores.career < 2) scores.family += 1.2;
  }

  let bestDomain: DomainId = 'general';
  let bestScore = scores.general;
  for (const id of DOMAIN_IDS) {
    if (scores[id] > bestScore) {
      bestScore = scores[id];
      bestDomain = id;
    }
  }

  const def = DOMAIN_DEFINITIONS[bestDomain];
  const family = getMethodFamily(primaryMethod);
  const methodSpecific = def.byMethodFamily[family] ?? [];
  const focusPoints = [...methodSpecific, ...def.generalFocus];
  if (def.safetyNote) {
    focusPoints.push(def.safetyNote);
  }

  return {
    id: bestDomain,
    label: def.label,
    focusPoints,
  };
}

export function selectPromptFramework(
  input: RouterInput,
  primaryMethod: MethodId,
  detectedDomain: DetectedDomainResult,
): RecommendedFrameworkResult {
  const q = normalizeQuery(input.query || '');
  let id: FrameworkId = 'event-verdict';
  let reason = '';

  // 1. Naming / Character / Aesthetic domain
  if (
    primaryMethod === 'chinese-name' ||
    primaryMethod === 'chinese-naming' ||
    primaryMethod === 'character-query'
  ) {
    id = 'naming-aesthetic';
    reason = '提问涉及姓名评测、起新名或单字甄选，最适合采用音形义与谐音避讳并重的审美框架。';
  }
  // 2. Space / Fengshui / Almanac date selection
  else if (
    primaryMethod === 'bazhai' ||
    primaryMethod === 'xuankong' ||
    primaryMethod === 'residential' ||
    primaryMethod === 'almanac'
  ) {
    id = 'space-layout';
    reason = '提问属于阳宅风水布局或黄历择吉场景，直接按吉凶定性、功能区实操与避忌步骤输出最实用。';
  }
  // 3. Explicit A vs B / multi-option choice
  else if (
    /(选a.*还是.*选b|二选一|哪一家|选哪边|选哪一个|哪一个更好|哪张.*更|哪个更|哪个.*更稳|两个.*哪个|留.*还是.*去|还是.*拼一把|去不去|该不该.*还是|两家.*offer|两个.*纠结|两个.*铺位|两套.*户型|之间纠结|之间选)/.test(
      q,
    )
  ) {
    id = 'decision-ab';
    reason = '你正在多个具体选项之间权衡取舍，二选一决策框架能直观对照双路径利弊、底线与明确倾向。';
  }
  // 4. Synastry / Relationship diagnosis
  else if (
    primaryMethod === 'bazi-synastry' ||
    primaryMethod === 'ziwei-synastry' ||
    primaryMethod === 'astrolabe-synastry' ||
    (/(原谅他|怎么想我|合不合|吵架|磨合|沟通不来|关系.*修复|搭档顺不顺|合不合财|婆媳|相处)/.test(q) &&
      !/(能不能过|成不成|会不会分|会不会回复)/.test(q))
  ) {
    id = 'relationship-diagnosis';
    reason = '提问聚焦双人互动、磨合摩擦或关系心理诊断，关系诊断框架能系统拆解双方底色与相处建议。';
  }
  // 5. Crisis / trouble / remedy / hidden risk
  else if (
    /(诸事不顺|喝凉水都塞牙|干啥.*不成|干啥都卡壳|走背运|运势低迷|失眠|体虚|睡不好|财运下滑|心神不宁|内耗|焦虑|迷茫|低谷|好累|崩溃|情绪差|职场危机|投资亏损|隐情|瞒着|使绊子|谣言|骗局|小人|踩坑|隐患|化解|避坑|怎么破局|破冰|存不住钱)/.test(
      q,
    ) &&
    !/(二选一|选a还是选b)/.test(q)
  ) {
    id = 'crisis-remedy';
    reason = '提问带有明显的不顺困扰、健康/隐情隐患或避坑诉求，破局化解框架可直指病药并给出落地止损动作。';
  }
  // 6. Period / Annual / Monthly / Daily / Macro roadmap
  else if (
    primaryMethod === 'fortune' ||
    primaryMethod === 'wuyun-liuqi' ||
    primaryMethod === 'taiyi' ||
    primaryMethod === 'huangji-jingshi' ||
    primaryMethod === 'calendar' ||
    (/(今年(?!\d{1,2}岁)|明年|未来三年|未来五年|202\d年|本月|这个月|这周|今日|今天.*运势|流年|年运|月运|日运|太阳返照|行运|流曜)/.test(
      q,
    ) &&
      !DIVINATION_METHODS.has(primaryMethod))
  ) {
    id = 'period-roadmap';
    reason = '提问关注特定年度、月份或时代周期的节奏规划，流年周期框架能清晰标出上升窗口与防守红线。';
  }
  // 7. Long-term natal panorama
  else if (
    primaryMethod === 'bazi' ||
    primaryMethod === 'ziwei' ||
    primaryMethod === 'bazi-ziwei' ||
    primaryMethod === 'astrolabe' ||
    primaryMethod === 'astrolabe-range' ||
    primaryMethod === 'qizheng' ||
    primaryMethod === 'qizheng-range' ||
    primaryMethod === 'qimen-lifetime' ||
    primaryMethod === 'minglu' ||
    primaryMethod === 'bazi-reverse'
  ) {
    id = 'natal-panorama';
    reason = '提问指向本命格局、先天禀赋或长期大运路线，本命全景框架能系统梳理根基、财官与阶段走势。';
  }
  // 8. Default: Single event verdict
  else {
    id = 'event-verdict';
    reason = '提问属于具体单事占验或短期结果预测，直断框架会首句定性成败并明确阻滞点与应期时间窗。';
  }

  const def = PROMPT_FRAMEWORKS[id];
  const focusLines = detectedDomain.focusPoints.map((pt, i) => `  ${i + 1}. ${pt}`).join('\n');
  const composedPromptGuidance = [
    `【推荐解读框架：${def.name}】`,
    def.template,
    '',
    `【已锁定主题领域：${detectedDomain.label} · 专属看盘侧重点】`,
    focusLines,
  ].join('\n');

  return {
    id: def.id,
    name: def.name,
    reason,
    template: def.template,
    composedPromptGuidance,
  };
}
