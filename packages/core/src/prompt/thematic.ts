/**
 * 大类主题咨询（Thematic Consultation）统一提示词与核心要素提取器。
 *
 * 提供统一的大类主题枚举、规范化映射、盘面焦点宫位与传统理法任务书。
 * 遵循 AGENTS.md 最高规范：自包含完整任务书，不含工程/API/MCP等噪声，纯盘面与正统理法。
 */
import {
  formatBaziForPrompt,
  type BaziChartResult,
  type BaziFortuneSelectionValue,
  type FortuneSelectionContext,
} from '../bazi';
import type { ZiweiRuntimeFacts } from '../ziwei/runtime';
import { formatBaziFortuneSelection, formatBaziFullFortune } from './bazi-fortune';
import { formatBaziPatternConditions } from './bazi';
import { formatPromptCurrentTime } from './current-time';
import { buildPromptGuidance, buildPromptTask } from './guidance';
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
import {
  PROMPT_TOPIC_IDS,
  getPromptSubtopicOptions,
  buildPromptSelectionTask,
  getPromptSelectionSection,
  requirePromptSelection,
  type PromptMethodId,
  type PromptScopeId,
  type PromptSelection,
  type PromptSubtopicId,
} from './framework';

export const THEMATIC_TOPICS = PROMPT_TOPIC_IDS;

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
  subtopics?: ReadonlyArray<{ id: string; label: string }>;
}

export const THEMATIC_TOPIC_CONFIGS: Record<ThematicTopic, ThematicTopicConfig> = {
  general: {
    topic: 'general',
    name: '通用',
    title: '综合大局与命身全景',
    scopeDescription: '原局结构、格局与取用依据、命身宫位及所选资料范围',
    defaultQuestion: '请结合命理资料完成全面深入的整体解读。',
    baziTask:
      '请依据已列八字资料综合分析日主旺衰、月令、格局、调候与取用，说明四柱根气和干支作用；结合所列岁运，比较原局结构在对应时间层级的变化。',
    ziweiTask:
      '请依据已列紫微盘面分析命宫、身宫、三方四正的星曜状态与四化作用；结合所列运限，说明本命结构在对应时间层级的变化。',
    combinedTask:
      '请分别梳理八字的月令、格局、旺衰与取用，以及紫微命身宫、三方四正与四化事实；按已列时间层级比较两套盘面的共同主题和分歧，并回答咨询问题。',
    ziweiFocusPalaces: ['命宫', '身宫', '官禄', '财帛', '迁移', '福德'],
    baziFocusElements: ['日主旺衰', '格局用神', '调候喜忌', '四柱藏干', '大运流年'],
  },
  relationship: {
    topic: 'relationship',
    name: '感情',
    title: '婚恋情感与配偶桃花',
    scopeDescription: '日支与夫妻宫、配偶星及相关星曜的传统取象与关系互动',
    defaultQuestion: '请重点分析婚恋感情与配偶缘分。',
    baziTask:
      '请依据已列八字资料核对日支夫妻宫、配偶星及实际命中的合冲刑害，结合所列岁运说明关系取象的变化条件，并与咨询问题中的相处事实对应。',
    ziweiTask:
      '请依据已列紫微盘面核对夫妻宫、对宫及三方宫位的星曜和四化作用，结合所列运限说明传统关系取象，并与咨询问题中的互动事实对应。',
    combinedTask:
      '请分别核对八字的日支、配偶星与合冲关系，以及紫微夫妻宫、相关宫位与四化作用；比较两套盘面的共同关系主题、分歧和所列时间层级，并与咨询问题中的现实互动对应。',
    ziweiFocusPalaces: ['夫妻', '命宫', '官禄', '福德', '迁移', '身宫'],
    baziFocusElements: ['配偶星', '夫妻宫日支', '比劫争合', '刑冲破害', '桃花红鸾'],
  },
  career: {
    topic: 'career',
    name: '事业',
    title: '事业职场与发展变动',
    scopeDescription: '官印食伤与官禄宫取象，以及实际职业选择',
    defaultQuestion: '请重点分析事业发展与职场前程。',
    baziTask:
      '请依据已列八字资料核对格局、官印食伤与取用，结合所列岁运说明职业相关结构在当前时间窗口的变化，并与咨询问题中的职业选项和现实条件对应。',
    ziweiTask:
      '请依据已列紫微盘面核对官禄宫、命宫、财帛宫与迁移宫的星曜和四化作用，结合所列运限说明事业取象的变化，并与咨询问题中的职业选项对应。',
    combinedTask:
      '请分别核对八字格局、官印食伤与岁运作用，以及紫微官禄宫星系与四化运限；比较共同主题和分歧，结合咨询问题中的职业选择说明可核对的条件。',
    ziweiFocusPalaces: ['官禄', '命宫', '身宫', '财帛', '迁移', '父母', '兄弟'],
    baziFocusElements: ['正偏官杀', '正偏印星', '食伤生财', '提纲驿马', '格局喜忌'],
  },
  wealth: {
    topic: 'wealth',
    name: '财运',
    title: '求财路径与财富运势',
    scopeDescription: '财星与财帛宫取象、结构性制约和现实收支条件',
    defaultQuestion: '请重点分析财运走势与求财路径。',
    baziTask:
      '请依据已列八字资料核对日主旺衰、财星、食伤与比劫的实际作用，结合所列岁运说明对应时间窗口的条件变化，并与咨询问题中的收入、负债或合作事实对应。',
    ziweiTask:
      '请依据已列紫微盘面核对财帛宫、田宅宫、福德宫及官禄宫的星曜与四化作用，结合所列运限说明财富主题的传统取象，并与咨询问题中的实际收支对应。',
    combinedTask:
      '请分别核对八字财星、日主旺衰与所列岁运，以及紫微财帛宫、田宅宫与四化运限；比较共同主题和分歧，并结合咨询问题中的现实收支与风险承受条件。',
    ziweiFocusPalaces: ['财帛', '田宅', '福德', '官禄', '命宫', '兄弟'],
    baziFocusElements: ['正偏财星', '日主旺衰', '食神伤官', '财库冲合', '比劫争夺'],
  },
  health: {
    topic: 'health',
    name: '健康',
    title: '身体健康与气机调护',
    scopeDescription: '原局五行寒暖燥湿、疾厄宫系与实际身心状态',
    defaultQuestion: '请重点分析身体健康与五行气机调护。',
    baziTask:
      '请依据八字盘面分析健康主题的传统取象：先核对月令、根气、生克制化与寒暖燥湿，再说明藏象对应的象征含义；刑冲破害与岁运引动逐项交代作用对象、成立条件和时间层级。将盘象推断与已知症状、检查结果、作息及压力分别列明，以实际健康资料核验相关性，身体疾病的判断依据医学检查与专业评估。围绕已知生活状态提出可观察、可复盘的起居关注点。',
    ziweiTask:
      '请依据紫微盘面分析健康主题的传统取象：以疾厄宫及其三方四正为主轴，结合命身、父母与福德宫，核对主星庙旺落陷、辅煞组合与四化的作用方向；将本命结构、大限背景和流年引动分别说明。星系与身体部位的对应按传统象意表达，以实际症状、检查结果及身心状态核验，身体疾病的判断依据医学检查与专业评估。给出各阶段值得记录的作息、压力与恢复情况。',
    combinedTask:
      '请八字紫微双盘合参健康主题：八字侧核对五行寒暖燥湿与制化条件，紫微侧核对疾厄宫系、星曜状态及四化引动，各自形成传统取象后比较共同主题与分歧。共同主题表示两套象意的交集，实际身体情况依据症状、医学检查和专业评估核实；结合已知作息与压力，说明可观察的阶段变化、核验节点和生活关注点。',
    ziweiFocusPalaces: ['疾厄', '父母', '命宫', '身宫', '福德'],
    baziFocusElements: ['五行偏枯', '地支相冲相刑', '生克制化', '月令根气', '寒暖燥湿'],
  },
  family: {
    topic: 'family',
    name: '家庭',
    title: '家庭六亲与房宅田宅',
    scopeDescription: '六亲宫位与十神取象、田宅宫位和家庭互动',
    defaultQuestion: '请重点分析家庭关系、六亲缘分与家宅田宅运势。',
    baziTask:
      '请依据已列八字资料核对四柱宫位、相关十神及实际命中的合冲关系，结合所列岁运说明家庭主题的传统取象，并与咨询问题中的家庭成员和居住事实对应。',
    ziweiTask:
      '请依据已列紫微盘面核对田宅宫、父母宫、子女宫与兄弟宫的星曜和四化作用，结合所列运限说明家庭主题的传统取象，并与咨询问题中的实际家庭关系对应。',
    combinedTask:
      '请分别核对八字六亲宫位、十神与干支关系，以及紫微田宅宫、父母宫和子女宫的星曜与四化；比较共同主题和分歧，并与咨询问题中的家庭事实对应。',
    ziweiFocusPalaces: ['田宅', '父母', '子女', '兄弟', '命宫', '夫妻'],
    baziFocusElements: ['年柱月柱时柱', '六亲十神', '刑冲克害', '田宅地支', '喜用落位'],
  },
  academic: {
    topic: 'academic',
    name: '学业',
    title: '学业功名与考试进修',
    scopeDescription: '印星食伤与相关宫位的传统取象、实际备考条件',
    defaultQuestion: '请重点分析学业前程、考试功名与进修运势。',
    baziTask:
      '请依据已列八字资料核对印星、食伤及实际成立的官印或伤官配印结构，结合所列岁运说明学业主题的传统取象，并与咨询问题中的备考安排和客观成绩对应。',
    ziweiTask:
      '请依据已列紫微盘面核对官禄宫、父母宫、命宫及实际出现的文曜和四化作用，结合所列运限说明学业主题的传统取象，并与咨询问题中的备考安排对应。',
    combinedTask:
      '请分别核对八字印星、食伤与所列岁运，以及紫微官禄宫、父母宫、文曜与四化运限；比较共同主题和分歧，结合咨询问题中的实际备考条件。',
    ziweiFocusPalaces: ['官禄', '父母', '命宫', '福德', '迁移'],
    baziFocusElements: ['正印偏印', '食神伤官', '文昌贵人', '官印相生', '财星破印'],
  },
  timing: {
    topic: 'timing',
    name: '时机',
    title: '岁运流年与动静时机',
    scopeDescription: '所选大运或运限、流年流月的实际作用和现实决策条件',
    defaultQuestion: '请重点分析当前岁运走势与近期关键动静时机。',
    baziTask:
      '请依据已列八字岁运资料核对所选大运、流年或流月与原局的实际干支作用，按对应时间层级说明成立条件和变化，并与咨询问题中的现实决策条件对应。',
    ziweiTask:
      '请依据已列紫微运限资料核对所选大限或流年宫位、星曜与四化作用，按对应时间层级说明成立条件和变化，并与咨询问题中的现实决策条件对应。',
    combinedTask:
      '请分别核对八字所选岁运的干支作用，以及紫微所选运限的宫位与四化变化；在相同时间层级比较共同主题和分歧，结合咨询问题中的现实条件说明决策依据。',
    ziweiFocusPalaces: ['命宫', '迁移', '官禄', '财帛', '身宫', '福德'],
    baziFocusElements: ['大运干支', '流年太岁', '冲合提纲', '天克地冲', '天合地合'],
  },
};

function buildThematicTask(
  config: ThematicTopicConfig,
  selection: PromptSelection,
  system: 'bazi' | 'ziwei' | 'bazi_ziwei',
) {
  if (selection.scope !== 'natal') {
    return system === 'bazi'
      ? config.baziTask
      : system === 'ziwei'
        ? config.ziweiTask
        : config.combinedTask;
  }
  if (config.topic === 'health') {
    if (system === 'bazi') {
      return '请依据已列四柱、月令、寒暖燥湿与实际形成的干支作用说明传统健康取象，结合咨询问题中的症状、检查结果与作息资料核对，身体状态依据医学资料评估。';
    }
    if (system === 'ziwei') {
      return '请依据已列疾厄宫、命身宫、相关星曜与生年四化说明传统健康取象，结合咨询问题中的症状、检查结果与作息资料核对，身体状态依据医学资料评估。';
    }
    return '请分别依据已列八字四柱与紫微本命宫位资料说明传统健康取象，交叉核对共同依据与分歧，结合咨询问题中的症状和检查结果核对，身体状态依据医学资料评估。';
  }
  if (system === 'bazi') {
    return `请依据已列四柱、月令、格局、取用与实际命中的干支关系分析${config.name}，说明盘面依据和传统取义，结合咨询问题列出需要现实核对的条件。`;
  }
  if (system === 'ziwei') {
    return `请依据已列命身宫、相关宫位、星曜与四化事实分析${config.name}，说明盘面依据和传统取义，结合咨询问题列出需要现实核对的条件。`;
  }
  return `请分别依据已列八字四柱与紫微本命宫位资料分析${config.name}，交叉核对共同依据与分歧，结合咨询问题列出需要现实核对的条件。`;
}

function getFocusElements(elements: string[], selection: PromptSelection) {
  const applicableElements =
    selection.scope === 'natal'
      ? elements.filter((item) => !/(大运|流年|岁运|运限)/u.test(item))
      : elements;
  return selection.subtopicLabel
    ? [...applicableElements, `主题细项：${selection.subtopicLabel}`]
    : applicableElements;
}

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
  return {
    ...THEMATIC_TOPIC_CONFIGS[normalized],
    subtopics: getPromptSubtopicOptions(normalized),
  };
}

export interface ThematicConsultationOptions {
  system?: 'bazi_ziwei' | 'bazi' | 'ziwei';
  methodId?: PromptMethodId | string;
  topic?: ThematicTopic | string;
  topicId?: string;
  subtopicId?: PromptSubtopicId | string;
  scope?: PromptScopeId | string;
  question?: string;
  currentTime?: Date | string;
  // 八字资料
  baziResult?: BaziChartResult;
  fortuneSelectionContext?: FortuneSelectionContext | null;
  fortuneScope?: BaziFortuneSelectionValue['scope'];
  baziSchool?: BaziPromptSchool;
  baziSchools?: readonly BaziPromptSchool[];
  // 紫微资料
  ziweiResult?: ZiweiRuntimeFacts;
  ziweiScope?: ZiweiPromptScope;
  ziweiSchool?: ZiweiSchool;
  ziweiSchools?: readonly ZiweiSchool[];
  // 模式
  mode?: 'framework' | 'custom';
}

export interface ThematicConsultationResult {
  methodId: PromptMethodId;
  topic: ThematicTopic;
  topicLabel: string;
  topicTitle: string;
  subtopicId?: string;
  subtopicLabel?: string;
  selection: PromptSelection;
  system: 'bazi_ziwei' | 'bazi' | 'ziwei';
  prompt: string;
  focusPalaces: string[];
  focusElements: string[];
  scope: string;
}

const ZIWEI_SCOPE_BY_PROMPT_SCOPE: Partial<Record<PromptScopeId, ZiweiPromptScope>> = {
  natal: 'origin',
  full: 'full',
  decadal: 'decadal',
  yearly: 'yearly',
  monthly: 'monthly',
  daily: 'daily',
  hourly: 'hourly',
};

/**
 * 构建大类主题咨询 AI 提示词（自包含完整任务书）。
 */
export function buildThematicConsultationPrompt(
  options: ThematicConsultationOptions,
): ThematicConsultationResult {
  const rawSystem = options.system ?? 'bazi_ziwei';
  const requestedMethodId =
    options.methodId ??
    (rawSystem === 'bazi' ? 'bazi' : rawSystem === 'ziwei' ? 'ziwei' : 'bazi-ziwei');
  const effectiveSystem: 'bazi_ziwei' | 'bazi' | 'ziwei' =
    requestedMethodId === 'bazi'
      ? 'bazi'
      : requestedMethodId === 'ziwei'
        ? 'ziwei'
        : requestedMethodId === 'bazi-ziwei'
          ? 'bazi_ziwei'
          : rawSystem === 'bazi_ziwei' && !options.baziResult && options.ziweiResult
            ? 'ziwei'
            : rawSystem === 'bazi_ziwei' && options.baziResult && !options.ziweiResult
              ? 'bazi'
              : rawSystem;

  if (
    requestedMethodId !== 'bazi' &&
    requestedMethodId !== 'ziwei' &&
    requestedMethodId !== 'bazi-ziwei'
  ) {
    throw new Error(`大类主题咨询不支持方法 ${requestedMethodId}。`);
  }

  const legacyScope =
    options.scope ??
    (options.fortuneScope === 'full'
      ? 'full'
      : options.fortuneSelectionContext?.scope === 'dayun'
        ? 'decadal'
        : options.fortuneSelectionContext?.scope === 'year'
          ? 'yearly'
          : options.fortuneSelectionContext?.scope === 'month'
            ? 'monthly'
            : options.fortuneSelectionContext?.scope === 'day'
              ? 'daily'
              : options.ziweiScope === 'origin'
                ? 'natal'
                : options.ziweiScope === 'full'
                  ? 'full'
                  : options.ziweiScope === 'age'
                    ? 'natal'
                    : options.ziweiScope);
  const selection = requirePromptSelection({
    methodId: requestedMethodId,
    topicId: options.topicId ?? options.topic,
    subtopicId: options.subtopicId,
    scope: legacyScope,
  });
  const config = getThematicTopicConfig(selection.topicId);

  const question =
    options.question?.trim() ||
    (selection.scope === 'natal' && config.topic === 'timing'
      ? '请说明本命结构中与时机取义相关的条件。'
      : config.defaultQuestion);
  const isCustomMode = options.mode === 'custom';
  const ziweiScope =
    options.ziweiScope ?? ZIWEI_SCOPE_BY_PROMPT_SCOPE[selection.scope] ?? 'decadal';
  const batchedFullZiweiScope =
    ziweiScope === 'full' &&
    Boolean(options.ziweiResult?.calculationBatch || options.ziweiResult?.fortuneTimeline?.batch);
  const promptSelection = batchedFullZiweiScope
    ? { ...selection, scopeLabel: '本次所列资料' }
    : selection;
  const currentDate =
    typeof options.currentTime === 'string' ? new Date(options.currentTime) : options.currentTime;

  // 1. 仅八字体系
  if (effectiveSystem === 'bazi') {
    if (!options.baziResult) {
      throw new Error('生成八字大类主题提示词必须提供 baziResult。');
    }
    const fortuneSelection = formatBaziFortuneSelection(options.fortuneSelectionContext);
    const hasFullBaziFortune = options.fortuneScope === 'full';
    const baziChartText = formatBaziForPrompt(
      options.baziResult,
      null,
      fortuneSelection || hasFullBaziFortune ? 'fortune' : 'general',
    );
    const baziPatternConditions =
      options.baziSchool || options.baziSchools?.length
        ? ''
        : formatBaziPatternConditions(options.baziResult);
    const taskText = isCustomMode
      ? buildPromptSelectionTask(
          buildPromptTask(
            '请依据八字排盘资料回答咨询问题。',
            selection.scope === 'natal' ? 'bazi-natal' : 'bazi',
          ),
          selection,
        )
      : buildPromptTask(
          buildThematicTask(config, selection, 'bazi'),
          selection.scope === 'natal' ? 'bazi-natal' : 'bazi',
        );

    const schoolSection = options.baziSchools?.length
      ? buildBaziSchoolsPromptSection(options.baziResult, options.baziSchools, true, true)
      : buildBaziSchoolPromptSection(options.baziResult, options.baziSchool, true, true);

    const promptText = joinPromptSections([
      buildPromptGuidance('bazi'),
      schoolSection,
      buildPromptSection('当前时间', formatPromptCurrentTime(currentDate)),
      buildPromptSection(
        '分析主题',
        `${getPromptSelectionSection(selection)}\n咨询主题：${config.name}（${config.title}）\n主题范畴：${config.scopeDescription}\n八字核心考察：${getFocusElements(config.baziFocusElements, selection).join('、')}`,
      ),
      buildPromptSection('排盘信息', baziChartText),
      baziPatternConditions ? buildPromptSection('八字格局条件', baziPatternConditions) : '',
      fortuneSelection
        ? buildPromptSection(
            '岁运资料',
            `${fortuneSelection.analysisObject}\n${fortuneSelection.focus}`,
          )
        : '',
      hasFullBaziFortune
        ? buildPromptSection('命限资料', formatBaziFullFortune(options.baziResult))
        : '',
      buildPromptSection(
        '资料范围',
        fortuneSelection
          ? fortuneSelection.analysisObject
          : hasFullBaziFortune
            ? '八字：本命盘与完整大运流年资料。'
            : '八字：本命原局。',
      ),
      buildPromptSection('任务', taskText),
      buildPromptSection('问题', question),
    ]);

    return {
      topic: config.topic,
      methodId: selection.methodId,
      topicLabel: config.name,
      topicTitle: config.title,
      subtopicId: selection.subtopicId,
      subtopicLabel: selection.subtopicLabel,
      selection,
      system: 'bazi',
      prompt: promptText,
      focusPalaces: [],
      focusElements: getFocusElements(config.baziFocusElements, selection),
      scope: fortuneSelection
        ? fortuneSelection.analysisObject
        : hasFullBaziFortune
          ? '本命盘与完整命限'
          : '本命盘',
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
      ? buildPromptSelectionTask(
          buildPromptTask(
            '请依据紫微盘面资料回答咨询问题。',
            ziweiScope === 'origin' ? 'ziwei-natal' : 'ziwei',
          ),
          promptSelection,
        )
      : buildPromptTask(
          buildThematicTask(config, promptSelection, 'ziwei'),
          ziweiScope === 'origin' ? 'ziwei-natal' : 'ziwei',
        );

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
        `${getPromptSelectionSection(promptSelection)}\n咨询主题：${config.name}（${config.title}）\n主题范畴：${config.scopeDescription}\n紫微核心宫位：${config.ziweiFocusPalaces.map((p) => (p.endsWith('宫') ? p : `${p}宫`)).join('、')}`,
      ),
      buildPromptSection('紫微盘面资料', chartText),
      buildPromptSection(
        '资料范围',
        ziweiScope === 'origin'
          ? '紫微：本命盘。'
          : batchedFullZiweiScope
            ? '紫微：本命与本次所列运限。'
            : `紫微：${selection.scopeLabel}。`,
      ),
      buildPromptSection('任务', taskText),
      buildPromptSection('问题', question),
    ]);

    return {
      topic: config.topic,
      methodId: selection.methodId,
      topicLabel: config.name,
      topicTitle: config.title,
      subtopicId: selection.subtopicId,
      subtopicLabel: selection.subtopicLabel,
      selection,
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
  const hasFullBaziFortune = options.fortuneScope === 'full';
  const baziChartText = formatBaziForPrompt(
    options.baziResult,
    null,
    fortuneSelection || hasFullBaziFortune ? 'fortune' : 'general',
  );
  const baziPatternConditions =
    options.baziSchool || options.baziSchools?.length
      ? ''
      : formatBaziPatternConditions(options.baziResult);
  const ziweiText = formatZiweiEvidenceText(options.ziweiResult, ziweiScope);

  const schoolSections = [
    options.baziSchools?.length
      ? buildBaziSchoolsPromptSection(options.baziResult, options.baziSchools, true, true)
      : buildBaziSchoolPromptSection(options.baziResult, options.baziSchool, true, true),
    options.ziweiSchools?.length
      ? `【紫微多派合参】\n${formatPromptSchoolGuidance('ziwei', options.ziweiSchools)}`
      : options.ziweiSchool
        ? `【紫微流派】\n${getZiweiSchoolGuidance(options.ziweiSchool)}`
        : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const taskText = isCustomMode
    ? buildPromptSelectionTask(
        buildPromptTask(
          '请依据八字和紫微盘面资料回答咨询问题。',
          selection.scope === 'natal' ? 'bazi-ziwei-natal' : 'bazi-ziwei',
        ),
        promptSelection,
      )
    : buildPromptTask(
        buildThematicTask(config, selection, 'bazi_ziwei'),
        selection.scope === 'natal' ? 'bazi-ziwei-natal' : 'bazi-ziwei',
      );

  const promptText = joinPromptSections([
    buildPromptGuidance('bazi-ziwei'),
    schoolSections,
    buildPromptSection('当前时间', formatPromptCurrentTime(currentDate)),
    buildPromptSection(
      '分析主题',
      `${getPromptSelectionSection(promptSelection)}\n咨询主题：${config.name}（${config.title}）\n主题范畴：${config.scopeDescription}\n核心考查：紫微重点审视${config.ziweiFocusPalaces.map((p) => `${p}宫`).join('、')}；八字重点审视${getFocusElements(config.baziFocusElements, selection).join('、')}`,
    ),
    buildPromptSection('八字排盘信息', baziChartText),
    baziPatternConditions ? buildPromptSection('八字格局条件', baziPatternConditions) : '',
    fortuneSelection
      ? buildPromptSection(
          '八字岁运',
          `${fortuneSelection.analysisObject}\n${fortuneSelection.focus}`,
        )
      : '',
    hasFullBaziFortune
      ? buildPromptSection('八字完整命限资料', formatBaziFullFortune(options.baziResult))
      : '',
    buildPromptSection(
      '资料范围',
      [
        fortuneSelection
          ? `八字：${fortuneSelection.analysisObject}`
          : hasFullBaziFortune
            ? '八字：本命盘与完整大运流年资料。'
            : '八字：本命原局。',
        ziweiScope === 'origin'
          ? '紫微：本命盘。'
          : batchedFullZiweiScope
            ? '紫微：本命与本次所列运限。'
            : `紫微：${selection.scopeLabel}。`,
      ].join('\n'),
    ),
    buildPromptSection('紫微盘面信息', ziweiText),
    buildPromptSection('任务', taskText),
    buildPromptSection('问题', question),
  ]);

  return {
    topic: config.topic,
    methodId: selection.methodId,
    topicLabel: config.name,
    topicTitle: config.title,
    subtopicId: selection.subtopicId,
    subtopicLabel: selection.subtopicLabel,
    selection,
    system: 'bazi_ziwei',
    prompt: promptText,
    focusPalaces: config.ziweiFocusPalaces,
    focusElements: config.baziFocusElements,
    scope: fortuneSelection
      ? `${fortuneSelection.analysisObject} / 紫微${ziweiScope}`
      : `本命合参（紫微${ziweiScope}）`,
  };
}
