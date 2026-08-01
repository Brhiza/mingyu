import { formatPromptCurrentTime } from './prompt-time';
import { appendTraditionalResearchNotice } from 'mingyu-core/prompt-evidence';
import { buildPromptGuidanceSections, type MetaphysicsPromptMethod } from './prompt-guidance';

export interface MetaphysicsPromptOptions {
  method: MetaphysicsPromptMethod;
  measurement?: string;
  currentTime?: Date;
  context?: PromptRealWorldContext;
}

export interface PromptRealWorldContext {
  currentSituation?: string;
  currentState?: string;
  knownFacts?: string;
  desiredOutcome?: string;
  constraints?: string;
}

export function formatPromptRealWorldContext(context?: PromptRealWorldContext): string {
  if (!context) return '';
  return [
    ['当前情况', context.currentSituation],
    ['当前状态', context.currentState],
    ['已知事实', context.knownFacts],
    ['期望结果', context.desiredOutcome],
    ['现实限制', context.constraints],
  ]
    .filter((item): item is [string, string] => Boolean(item[1]?.trim()))
    .map(([label, value]) => `${label}：${value.trim()}`)
    .join('\n');
}

export function insertPromptRealWorldContext(
  prompt: string,
  context?: PromptRealWorldContext,
): string {
  const contextText = formatPromptRealWorldContext(context);
  if (!prompt || !contextText) return prompt;
  const section = `【补充信息】\n${contextText}`;
  const questionMarker = '\n\n【问题】';
  return prompt.includes(questionMarker)
    ? prompt.replace(questionMarker, `\n\n${section}${questionMarker}`)
    : `${prompt}\n\n${section}`;
}

export function buildMetaphysicsPrompt(
  basePrompt: string,
  question: string | undefined,
  options: MetaphysicsPromptOptions,
): string {
  const keepsResidentialFacts = options.method === 'bazhai' || options.method === 'residential';
  const keepsZodiacFacts = options.method === 'zodiac';
  const keepsTaiyiFacts = options.method === 'taiyi';
  const normalizedQuestion =
    question?.trim() ||
    (keepsResidentialFacts
      ? '请说明本次盘面的关键事实、可继续推算的条件与仍需补充的资料。'
      : keepsZodiacFacts
        ? '请说明本次资料命中的固定关系、可继续推算的范围与仍需补充的信息。'
        : keepsTaiyiFacts
          ? '请核对本次太乙年计的可复算事实、来源边界与继续解释所需资料。'
          : '请综合解读本次排盘的重点、风险与行动建议。');
  const contextText = formatPromptRealWorldContext(options.context);

  return appendTraditionalResearchNotice(
    [
      buildPromptGuidanceSections(options.method),
      '',
      '【当前时间】',
      formatPromptCurrentTime(options.currentTime),
      '',
      basePrompt,
      ...(options.measurement ? ['', '【测量换算】', options.measurement] : []),
      ...(contextText ? ['', '【补充信息】', contextText] : []),
      '',
      '【问题】',
      normalizedQuestion,
      '',
      '【任务】',
      keepsResidentialFacts
        ? '请直接回答【问题】，先说明采用的传统对象与关键盘面依据，再继续推算；资料不闭合时保留待定，不得把单一八宫标签、命宅分组或玄空星盘直接改写成方向宜避、住宅现实效果或保证有效的布置结论。'
        : keepsZodiacFacts
          ? '请直接回答【问题】，先区分生肖年支、流年干支、固定地支关系与五行生克方向，再结合问题继续推算；不得把三合六合直接改写成现实贵人，不得把五行方向直接改写成利弊，也不得生成现实吉凶保证、固定应期或化解保证。'
          : keepsTaiyiFacts
            ? '请直接回答【问题】，只核对年计积数、七十二局、核心落宫、主客定算数值、将参宫位和十六神位置；未明确解释底本版本、所问事项及主客现实角色时，不得生成总体态势、胜负、时机或行动建议。'
            : '请直接回答【问题】，说明关键盘面依据，并给出可执行建议。',
      '',
      '【输出要求】',
      keepsResidentialFacts
        ? '使用简体中文，区分盘面事实、后续推算、资料缺口与现实限制；不得补造未提供的山向、年份、流派或现场条件。'
        : keepsZodiacFacts
          ? '使用简体中文，区分固定关系事实、后续推算、资料缺口与现实条件；不补造出生月、日、时或未提供的现实信息。'
          : keepsTaiyiFacts
            ? '使用简体中文，区分已校勘年计事实、未校解释规则与继续推算所需资料；不补造算数属性、月日时计或现实主客含义。'
            : '使用简体中文，先说结论，再展开依据和建议。',
    ].join('\n'),
  );
}
