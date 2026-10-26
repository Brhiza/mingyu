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
import { appendClassicalReferences } from './classical-references';
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
  buildPromptSelectionTask,
  getPromptSelectionSection,
  requirePromptSelection,
  type PromptMethodId,
  type PromptScopeId,
  type PromptSelection,
  type PromptSubtopicId,
} from './framework';

import {
  getThematicTopicConfig,
  type ThematicTopic,
  type ThematicTopicConfig,
} from './thematic-topics';

export {
  THEMATIC_TOPICS,
  THEMATIC_TOPIC_CONFIGS,
  normalizeThematicTopic,
  getThematicTopicConfig,
  type ThematicTopic,
  type ThematicTopicConfig,
} from './thematic-topics';

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

export interface ThematicConsultationOptions {
  includeClassics?: boolean;
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
      prompt: appendClassicalReferences(promptText, selection.methodId, options.includeClassics),
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
      prompt: appendClassicalReferences(promptText, selection.methodId, options.includeClassics),
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
    prompt: appendClassicalReferences(promptText, selection.methodId, options.includeClassics),
    focusPalaces: config.ziweiFocusPalaces,
    focusElements: config.baziFocusElements,
    scope: fortuneSelection
      ? `${fortuneSelection.analysisObject} / 紫微${ziweiScope}`
      : `本命合参（紫微${ziweiScope}）`,
  };
}
