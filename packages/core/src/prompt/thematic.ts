/**
 * 大类主题咨询（Thematic Consultation）统一提示词与核心要素提取器。
 *
 * 提供统一的大类主题枚举、规范化映射、盘面焦点宫位与传统理法任务书。
 * 遵循 AGENTS.md 最高规范：自包含完整任务书，不含工程/API/MCP等噪声，纯盘面与正统理法。
 */
import { formatBaziForPrompt, type BaziChartResult, type FortuneSelectionContext } from '../bazi';
import type { ZiweiRuntime } from '../ziwei/runtime';
import { formatBaziFortuneSelection } from './bazi-fortune';
import { formatPromptCurrentTime } from './current-time';
import { buildCustomQuestionTask, buildPromptGuidance, buildPromptTask } from './guidance';
import { buildPromptSection, joinPromptSections } from './sections';
import {
  buildBaziSchoolPromptSection,
  buildBaziSchoolsPromptSection,
  type BaziPromptSchool,
} from './bazi-school';
import { formatZiweiPayloadForPrompt } from './ziwei';
import {
  formatZiweiEvidenceText,
  formatPublicZiweiFullScopeText,
  getZiweiPromptCalculationScopes,
  getZiweiSchoolGuidance,
  type ZiweiPromptScope,
  type ZiweiSchool,
} from './public-api';
import { formatPromptSchoolGuidance } from './schools';

export const THEMATIC_TOPICS = [
  'general',
  'relationship',
  'career',
  'wealth',
  'health',
  'family',
  'academic',
  'timing',
] as const;

export type ThematicTopic = (typeof THEMATIC_TOPICS)[number];

export interface ThematicTopicConfig {
  topic: ThematicTopic;
  name: string;
  title: string;
  scopeDescription: string;
  defaultQuestion: string;
  baziTask: string;
  ziweiTask: string;
  combinedTask: string;
  ziweiFocusPalaces: string[];
  baziFocusElements: string[];
}

export const THEMATIC_TOPIC_CONFIGS: Record<ThematicTopic, ThematicTopicConfig> = {
  general: {
    topic: 'general',
    name: '通用',
    title: '综合大局与命身全景',
    scopeDescription: '原局根基、格局高低、五行喜忌配合、命身主轴与人生核心运程',
    defaultQuestion: '请结合命理资料完成全面深入的整体解读。',
    baziTask:
      '请依据八字排盘资料完成全局综合解读：一辨原局日主旺衰强弱与十神格局高低，二察寒暖燥湿与调候通关喜忌用神，三审四柱根气通达与干支生克流通，四推演当前及未来大运流年对原局气象的吉凶帮扶与制化，给出全面客观测断。',
    ziweiTask:
      '请依据紫微盘面资料完成全局综合解读：以命宫、身宫为核心主轴，审视十四主星庙旺吉凶与命主身主气象，合看三方四正（官禄、财帛、迁移）吉凶会照与辅煞杂曜夹拱，结合生年四化与当前运限引动，全面系统解析本命格局与人生走势。',
    combinedTask:
      '请将八字与紫微斗数进行双向交叉合参：先以八字子平格局立原局五行主轴、旺衰用神与富贵贫贱层次，再以紫微命身十二宫、三方四正星曜组合与四化飞伏校验具体宫位人事与细节象意。双方印证同一人生大局，并在时辰与限运层面相互核验。',
    ziweiFocusPalaces: ['命宫', '身宫', '官禄', '财帛', '迁移', '福德'],
    baziFocusElements: ['日主旺衰', '格局用神', '调候喜忌', '四柱藏干', '大运流年'],
  },
  relationship: {
    topic: 'relationship',
    name: '感情',
    title: '婚恋情感与配偶桃花',
    scopeDescription: '配偶相貌性格、夫妻感情深浅、正缘桃花契机、感情波动节点与合婚维系',
    defaultQuestion: '请重点分析婚恋感情与配偶缘分。',
    baziTask:
      '请依据八字排盘资料重点分析婚恋感情：一辨配偶星（男看正偏财、女看正偏官）得令得气与纯杂清浊，二察日支夫妻宫之坐支喜忌及与邻支是否存在刑冲破害或暗合争妒，三推断原局神煞（如红鸾、天喜、桃花、孤鸾、阴差阳错等）之感情心性影响，四审大运流年引动夫妻宫或配偶星逢合逢冲之婚恋转折与应期节律，给出有理有据的相处趋避建议。',
    ziweiTask:
      '请依据紫微盘面资料重点分析婚恋感情：必须完整列出并深入解析夫妻宫的主星庙旺、辅曜杂曜、宫干四化与宫内自化；合看夫妻对宫（官禄宫）与三方会照（福德宫、迁移宫），重点审视福德宫之精神享受与夫妻宫之气数因果；追踪生年四化、运限四化及各宫飞化入夫妻宫之吉凶牵引，结合命身主轴推断正缘特征、婚恋相处与波动应期。',
    combinedTask:
      '请以八字与紫微双盘合参重点分析婚恋情感：八字侧深究配偶星状态与日支夫妻宫刑冲合害，紫微侧详审夫妻宫主星辅曜、四化落宫与福德宫气数；双方交叉印证配偶心性外貌特征、情感互动模式、关键婚恋转折流年，并结合双方命理线索指出情感磨合与趋避之道。',
    ziweiFocusPalaces: ['夫妻', '命宫', '官禄', '福德', '迁移', '身宫'],
    baziFocusElements: ['配偶星', '夫妻宫日支', '比劫争合', '刑冲破害', '桃花红鸾'],
  },
  career: {
    topic: 'career',
    name: '事业',
    title: '事业职场与发展变动',
    scopeDescription: '职场定位、职位升迁、跳槽转行时机、创业合伙与适宜行业方向',
    defaultQuestion: '请重点分析事业发展与职场前程。',
    baziTask:
      '请依据八字排盘资料重点分析事业前程：一辨原局官杀印星格局之清纯清透与制化得力程度，审视是宜走体制平台、企业管理还是专业技能，二察食伤吐秀生财之才华展露与变动倾向，三审岁运提纲冲合、驿马引动与官印逢冲之职场升迁或变动转折时机，四结合五行喜忌明确契合之行业领域与发展方位，定宜守宜动之决策时序。',
    ziweiTask:
      '请依据紫微盘面资料重点分析事业职场：以官禄宫（事业宫）为主轴，详审官禄宫主星星系庙旺与辅煞化吉情况；合看命宫之志向魄力、财帛宫之收益配合与迁移宫之外界际遇；兼看父母宫（职场上司、印信资质）与兄弟宫（同僚竞争与团队合作）；结合生年四化、大限流年化禄化权化忌引动，推演职位变动、升迁契机与适宜发展路径。',
    combinedTask:
      '请八字紫微双盘合参重点分析事业职场：八字定原局格局层次（官印、伤官生财、杀印相生）与岁运大盘气机助力，紫微定官禄宫星系配合、职场人事际遇与具体行运落点；双方交叉印证升迁、跳槽、创业之吉凶利弊与最佳决断窗口期。',
    ziweiFocusPalaces: ['官禄', '命宫', '身宫', '财帛', '迁移', '父母', '兄弟'],
    baziFocusElements: ['正偏官杀', '正偏印星', '食伤生财', '提纲驿马', '格局喜忌'],
  },
  wealth: {
    topic: 'wealth',
    name: '财运',
    title: '求财路径与财富运势',
    scopeDescription: '正财偏财来源、身强身弱任财能力、财库聚散、投资合伙利弊与防破耗节点',
    defaultQuestion: '请重点分析财运走势与求财路径。',
    baziTask:
      '请依据八字排盘资料重点分析财富运势：一辨日主身强身弱能否担财（身旺任财还是身弱财多反被财累），二察正财偏财之透干藏支、真伪纯杂与食伤财源之生化流通，三审原局四库（辰戌丑未）开闭与比劫争财之病药，四推演岁运大运流年引动财星或冲开财库之丰盈年份，指出谨防破耗借贷风险之关键节点与求财投资趋避策略。',
    ziweiTask:
      '请依据紫微盘面资料重点分析财运走势：以财帛宫为主轴，详审主星庙旺与禄存、天马、化禄、化忌之汇聚状态；合看田宅宫（不动产库藏与终极守财能力）、福德宫（财源之根基造化与精神消费观）与官禄宫之收益转化；排查地劫、地空、羊陀火铃等煞星对财路之冲破，结合运限四化分析进财机遇与漏财破耗风险。',
    combinedTask:
      '请八字紫微双盘合参重点分析求财与财富：八字侧推演日主担财格局、财库逢冲开闭与大运财气走势，紫微侧精细分析财帛宫与田宅宫之进财形态、聚财实力与煞星损耗；双方合参厘清正职求财还是副业投资更契合，并给出稳健财富累积的节奏指引。',
    ziweiFocusPalaces: ['财帛', '田宅', '福德', '官禄', '命宫', '兄弟'],
    baziFocusElements: ['正偏财星', '日主旺衰', '食神伤官', '财库冲合', '比劫争夺'],
  },
  health: {
    topic: 'health',
    name: '健康',
    title: '身体健康与气机调护',
    scopeDescription: '原局五行偏枯、脏腑经络薄弱点、疾厄寿元关窍与易发波动岁运时节',
    defaultQuestion: '请重点分析身体健康与五行气机调护。',
    baziTask:
      '请依据八字排盘资料重点分析身体健康：依照中医五行藏象理论，一辨原局金木水火土之过旺、不及与寒暖燥湿偏枯状态，二察地支刑冲破害对对应脏腑器官（如子午相冲动心肾、寅申相冲动肝胆筋骨）之冲击，三审岁运克伐日主、冲克印星寿元之年岁时段，指明需要重点防范养护之身体系统，给出作息起居与五行平衡调养方向。',
    ziweiTask:
      '请依据紫微盘面资料重点分析健康体质：以疾厄宫为主轴，详审疾厄宫主星星系特性与五行归属；兼看父母宫（相貌遗传与身体对宫）、福德宫（精神心理与气血寿元）、命宫身宫之体质根基；结合擎羊、陀罗、火星、铃星、天刑、化忌等凶煞引动，推断易感病机部位与需要警惕的运限时节。',
    combinedTask:
      '请八字紫微双盘合参重点分析健康养生：八字侧依据五行干支偏枯生克锁定脏腑经络之先天虚实，紫微侧依据疾厄宫、命身宫与煞忌星曜定位具体病理体征；双向印证身心状态与易感波动的岁运周期，提供正统五行调和与起居趋避依据。',
    ziweiFocusPalaces: ['疾厄', '父母', '命宫', '身宫', '福德'],
    baziFocusElements: ['五行偏枯', '地支相冲相刑', '干支克伐', '寿元用神', '寒暖燥湿'],
  },
  family: {
    topic: 'family',
    name: '家庭',
    title: '家庭六亲与房宅田宅',
    scopeDescription: '父母亲缘、子女成长亲情、兄弟同胞相处、家庭房产置业与家宅安宁',
    defaultQuestion: '请重点分析家庭关系、六亲缘分与家宅田宅运势。',
    baziTask:
      '请依据八字排盘资料重点分析家庭六亲：一审四柱宫位分布（年柱父母长辈、月柱兄弟同胞、日支配偶内室、时柱子女归宿），二辨六亲十神（印星为母、偏财为父、比劫为同胞、食伤/官杀为子女）得力与缘分深浅，三察原局宫位生克合冲与田宅安宁情况，四推演岁运引动六亲宫位之吉凶变化，提供家庭相处与置业搬迁之考量依据。',
    ziweiTask:
      '请依据紫微盘面资料重点分析家庭田宅：以田宅宫（不动产、家宅气运）、父母宫、子女宫、兄弟宫为核心，详审各宫主星吉凶配置与辅煞相会；结合命宫与福德宫之家族福荫，追踪生年四化与运限四化对田宅宫与六亲宫之飞化牵动，解析家业传承、房产置业与六亲关系之和谐互动。',
    combinedTask:
      '请八字紫微双盘合参重点分析家庭与六亲：八字推演四柱六亲宫位与十神亲缘亲疏，紫微深究田宅宫、父母宫、子女宫之具体星情吉凶与家运走势；双方合参指引房产置业契机与家庭关系的良性维系。',
    ziweiFocusPalaces: ['田宅', '父母', '子女', '兄弟', '命宫', '夫妻'],
    baziFocusElements: ['年柱月柱时柱', '六亲十神', '刑冲克害', '田宅地支', '喜用落位'],
  },
  academic: {
    topic: 'academic',
    name: '学业',
    title: '学业功名与考试进修',
    scopeDescription: '学业天赋、考试应考状态、考公考研上岸运、文书进修与功名资质',
    defaultQuestion: '请重点分析学业前程、考试功名与进修运势。',
    baziTask:
      '请依据八字排盘资料重点分析学业功名：一辨印星（正印偏印）之生身得令得气与学术钻研能力，二察食伤之秀气发露、聪明智慧与临场应变发挥，三审原局是否存在官印相生、伤官配印等贵格文星气象，四推演岁运引动文昌、天乙贵人与岁运逢财坏印之考试年份利弊，指明发挥最佳之考运时段与备考调控关键。',
    ziweiTask:
      '请依据紫微盘面资料重点分析学业考运：以官禄宫（学业事业）、父母宫（考官印鉴文凭）、命宫（智慧领悟力）为主轴，详审文昌、文曲、天魁、天钺、化科等文秀吉星之落宫与会照；合看福德宫之专注定力与迁移宫之外界环境；排查化忌与煞星之分心干扰，推演重要考试与进修升学之应考气机。',
    combinedTask:
      '请八字紫微双盘合参重点分析学业与考运：八字审视印星食伤格局与岁运文星引动，紫微详辨官禄父母宫与昌曲魁钺化科之会合力量；双方相互校验考运顺逆时段，明确最佳备考状态与考试发挥策略。',
    ziweiFocusPalaces: ['官禄', '父母', '命宫', '福德', '迁移'],
    baziFocusElements: ['正印偏印', '食神伤官', '文昌贵人', '官印相生', '财星破印'],
  },
  timing: {
    topic: 'timing',
    name: '时机',
    title: '岁运流年与动静时机',
    scopeDescription: '当前大限大运走势、流年流月节律、关键转折契机与动静进退抉择',
    defaultQuestion: '请重点分析当前岁运走势与近期关键动静时机。',
    baziTask:
      '请依据八字排盘资料重点分析岁运时机：一审当前大运十年之干支五行气机是助身抑或克身，定位人生大周期阶段属性，二察流年太岁天干地支与原局及大运之天克地冲、天合地合或冲起提纲禄马，三权衡当务之急宜主动进攻拓展、宜稳健防守积蓄、抑或宜静观其变，四明确未来关键吉凶转折流年节点与应对策略。',
    ziweiTask:
      '请依据紫微盘面资料重点分析运限时机：以当前大限命宫及其三方四正为主轴，合看流年命宫落点与太岁干支四化引动；追踪大限四化与流年四化对本命核心宫位之叠并激荡（特别是化忌引动与禄权交驰）；解析当前运势起伏节律，指出何时当进、何时宜退、何时转折之时间节点。',
    combinedTask:
      '请八字紫微双盘合参重点分析岁运时机：八字定大运大势与流年岁君生克吉凶，紫微定运限具体落宫、四化引动人事与细节吉凶象意；双向推演统一时间轴上的转折契机，给出明确客观的进退决策与行动时机依据。',
    ziweiFocusPalaces: ['命宫', '迁移', '官禄', '财帛', '身宫', '福德'],
    baziFocusElements: ['大运干支', '流年太岁', '冲合提纲', '天克地冲', '天合地合'],
  },
};

/**
 * 将任意输入的主题字符串或别名规范化为 8 大类主题之一，不匹配时平滑回退到 'general'。
 */
export function normalizeThematicTopic(topic?: string | null): ThematicTopic {
  if (!topic) return 'general';
  const clean = topic.trim().toLowerCase();

  // 1. 直接精确匹配
  if ((THEMATIC_TOPICS as readonly string[]).includes(clean)) {
    return clean as ThematicTopic;
  }

  // 2. 映射历史细碎子主题或中文别名
  if (/relationship|marriage|love|婚恋|感情|配偶|夫妻|桃花|合婚|复合|去留|推进/.test(clean)) {
    return 'relationship';
  }
  if (/startup|career|job|work|profession|事业|职场|工作|升迁|跳槽|创业|变动/.test(clean)) {
    return 'career';
  }
  if (/wealth|money|finance|investment|partnership|财运|财富|求财|投资|资产|合伙/.test(clean)) {
    return 'wealth';
  }
  if (/health|body|disease|健康|身体|疾厄|体质|病|五行平气/.test(clean)) {
    return 'health';
  }
  if (
    /family|parent|children|home|house|settle|relocate|家庭|六亲|父母|子女|房宅|置业|搬家|定居/.test(
      clean,
    )
  ) {
    return 'family';
  }
  if (/academic|study|exam|education|学业|考试|考运|考研|考公|上岸|进修|升学|考证/.test(clean)) {
    return 'academic';
  }
  if (/timing|time|recent|fortune|cycle|时机|应期|岁运|流年|近期|动静|抉择/.test(clean)) {
    return 'timing';
  }

  return 'general';
}

export function getThematicTopicConfig(topic?: string | null): ThematicTopicConfig {
  const normalized = normalizeThematicTopic(topic);
  return THEMATIC_TOPIC_CONFIGS[normalized];
}

export interface ThematicConsultationOptions {
  system?: 'bazi_ziwei' | 'bazi' | 'ziwei';
  topic?: ThematicTopic | string;
  question?: string;
  currentTime?: Date | string;
  // 八字资料
  baziResult?: BaziChartResult;
  fortuneSelectionContext?: FortuneSelectionContext | null;
  baziSchool?: BaziPromptSchool;
  baziSchools?: readonly BaziPromptSchool[];
  // 紫微资料
  ziweiResult?: ZiweiRuntime;
  ziweiScope?: ZiweiPromptScope;
  ziweiSchool?: ZiweiSchool;
  ziweiSchools?: readonly ZiweiSchool[];
  // 模式
  mode?: 'framework' | 'custom';
}

export interface ThematicConsultationResult {
  topic: ThematicTopic;
  topicLabel: string;
  topicTitle: string;
  system: 'bazi_ziwei' | 'bazi' | 'ziwei';
  prompt: string;
  focusPalaces: string[];
  focusElements: string[];
  scope: string;
}

/**
 * 构建大类主题咨询 AI 提示词（自包含完整任务书）。
 */
export function buildThematicConsultationPrompt(
  options: ThematicConsultationOptions,
): ThematicConsultationResult {
  const config = getThematicTopicConfig(options.topic);
  const rawSystem = options.system ?? 'bazi_ziwei';
  const effectiveSystem: 'bazi_ziwei' | 'bazi' | 'ziwei' =
    rawSystem === 'bazi_ziwei' && !options.baziResult && options.ziweiResult
      ? 'ziwei'
      : rawSystem === 'bazi_ziwei' && options.baziResult && !options.ziweiResult
        ? 'bazi'
        : rawSystem;

  const question = options.question?.trim() || config.defaultQuestion;
  const isCustomMode = options.mode === 'custom';
  const ziweiScope = options.ziweiScope ?? 'origin';
  const currentDate =
    typeof options.currentTime === 'string' ? new Date(options.currentTime) : options.currentTime;

  // 1. 仅八字体系
  if (effectiveSystem === 'bazi') {
    if (!options.baziResult) {
      throw new Error('生成八字大类主题提示词必须提供 baziResult。');
    }
    const fortuneSelection = formatBaziFortuneSelection(options.fortuneSelectionContext);
    const baziChartText = formatBaziForPrompt(
      options.baziResult,
      null,
      fortuneSelection ? 'fortune' : 'general',
    );
    const taskText = isCustomMode
      ? buildCustomQuestionTask('八字排盘资料', 'bazi')
      : buildPromptTask(config.baziTask, 'bazi');

    const schoolSection = options.baziSchools?.length
      ? buildBaziSchoolsPromptSection(options.baziResult, options.baziSchools)
      : buildBaziSchoolPromptSection(options.baziResult, options.baziSchool);

    const promptText = joinPromptSections([
      buildPromptGuidance('bazi'),
      schoolSection,
      buildPromptSection('当前时间', formatPromptCurrentTime(currentDate)),
      buildPromptSection(
        '分析主题',
        `咨询主题：${config.name}（${config.title}）\n主题范畴：${config.scopeDescription}\n八字核心考察：${config.baziFocusElements.join('、')}`,
      ),
      buildPromptSection('排盘信息', baziChartText),
      fortuneSelection
        ? buildPromptSection(
            '岁运资料',
            `${fortuneSelection.analysisObject}\n${fortuneSelection.focus}`,
          )
        : '',
      buildPromptSection('任务', taskText),
      buildPromptSection('问题', question),
    ]);

    return {
      topic: config.topic,
      topicLabel: config.name,
      topicTitle: config.title,
      system: 'bazi',
      prompt: promptText,
      focusPalaces: [],
      focusElements: config.baziFocusElements,
      scope: fortuneSelection ? fortuneSelection.analysisObject : '本命盘',
    };
  }

  // 2. 仅紫微体系
  if (effectiveSystem === 'ziwei') {
    if (!options.ziweiResult) {
      throw new Error('生成紫微大类主题提示词必须提供 ziweiResult。');
    }
    const scopes = getZiweiPromptCalculationScopes(ziweiScope);
    const payloads = scopes
      .map((item) => options.ziweiResult?.payloadByScope[item])
      .filter(Boolean);
    const chartText =
      ziweiScope === 'full'
        ? formatPublicZiweiFullScopeText(options.ziweiResult)
        : payloads.length
          ? formatZiweiPayloadForPrompt(payloads[0]!, {
              focusPalaceNames: config.ziweiFocusPalaces,
            })
          : formatZiweiEvidenceText(options.ziweiResult, ziweiScope);

    const taskText = isCustomMode
      ? buildCustomQuestionTask('紫微盘面资料', ziweiScope === 'origin' ? 'ziwei-natal' : 'ziwei')
      : buildPromptTask(config.ziweiTask, ziweiScope === 'origin' ? 'ziwei-natal' : 'ziwei');

    const selectedSchools = options.ziweiSchools?.length ? options.ziweiSchools : [];
    const schoolText = selectedSchools.length
      ? formatPromptSchoolGuidance('ziwei', selectedSchools)
      : options.ziweiSchool
        ? getZiweiSchoolGuidance(options.ziweiSchool)
        : '';

    const promptText = joinPromptSections([
      buildPromptGuidance('ziwei'),
      schoolText
        ? buildPromptSection(selectedSchools.length > 1 ? '多派合参' : '流派', schoolText)
        : '',
      buildPromptSection('当前时间', formatPromptCurrentTime(currentDate)),
      buildPromptSection(
        '分析主题',
        `咨询主题：${config.name}（${config.title}）\n主题范畴：${config.scopeDescription}\n紫微核心宫位：${config.ziweiFocusPalaces.map((p) => (p.endsWith('宫') ? p : `${p}宫`)).join('、')}`,
      ),
      buildPromptSection('紫微盘面资料', chartText),
      buildPromptSection('任务', taskText),
      buildPromptSection('问题', question),
    ]);

    return {
      topic: config.topic,
      topicLabel: config.name,
      topicTitle: config.title,
      system: 'ziwei',
      prompt: promptText,
      focusPalaces: config.ziweiFocusPalaces,
      focusElements: [],
      scope: ziweiScope === 'origin' ? '本命盘' : ziweiScope,
    };
  }

  // 3. 八字与紫微双盘合参（默认最完整）
  if (!options.baziResult || !options.ziweiResult) {
    throw new Error('八字紫微双盘大类主题合参必须同时提供 baziResult 与 ziweiResult。');
  }

  const fortuneSelection = formatBaziFortuneSelection(options.fortuneSelectionContext);
  const baziChartText = formatBaziForPrompt(
    options.baziResult,
    null,
    fortuneSelection ? 'fortune' : 'general',
  );
  const ziweiText = formatZiweiEvidenceText(options.ziweiResult, ziweiScope);

  const schoolSections = [
    options.baziSchools?.length
      ? buildBaziSchoolsPromptSection(options.baziResult, options.baziSchools)
      : buildBaziSchoolPromptSection(options.baziResult, options.baziSchool),
    options.ziweiSchools?.length
      ? `【紫微多派合参】\n${formatPromptSchoolGuidance('ziwei', options.ziweiSchools)}`
      : options.ziweiSchool
        ? `【紫微流派】\n${getZiweiSchoolGuidance(options.ziweiSchool)}`
        : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const taskText = isCustomMode
    ? buildCustomQuestionTask('八字和紫微盘面资料', 'bazi-ziwei')
    : buildPromptTask(config.combinedTask, 'bazi-ziwei');

  const promptText = joinPromptSections([
    buildPromptGuidance('bazi-ziwei'),
    schoolSections,
    buildPromptSection('当前时间', formatPromptCurrentTime(currentDate)),
    buildPromptSection(
      '分析主题',
      `咨询主题：${config.name}（${config.title}）\n主题范畴：${config.scopeDescription}\n核心考查：紫微重点审视${config.ziweiFocusPalaces.map((p) => `${p}宫`).join('、')}；八字重点审视${config.baziFocusElements.join('、')}`,
    ),
    buildPromptSection('八字排盘信息', baziChartText),
    fortuneSelection
      ? buildPromptSection(
          '八字岁运',
          `${fortuneSelection.analysisObject}\n${fortuneSelection.focus}`,
        )
      : '',
    buildPromptSection('紫微盘面信息', ziweiText),
    buildPromptSection('任务', taskText),
    buildPromptSection('问题', question),
  ]);

  return {
    topic: config.topic,
    topicLabel: config.name,
    topicTitle: config.title,
    system: 'bazi_ziwei',
    prompt: promptText,
    focusPalaces: config.ziweiFocusPalaces,
    focusElements: config.baziFocusElements,
    scope: fortuneSelection
      ? `${fortuneSelection.analysisObject} / 紫微${ziweiScope}`
      : `本命合参（紫微${ziweiScope}）`,
  };
}
