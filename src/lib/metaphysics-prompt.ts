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
  const keepsResidentialFacts =
    options.method === 'bazhai' ||
    options.method === 'xuankong' ||
    options.method === 'residential';
  const keepsQizhengFacts = options.method === 'qizheng';
  const keepsZodiacFacts = options.method === 'zodiac';
  const keepsTaiyiFacts = options.method === 'taiyi';
  const normalizedQuestion =
    question?.trim() ||
    (keepsResidentialFacts
      ? '请说明本次盘面的关键事实、可继续推算的条件与仍需补充的资料。'
      : keepsQizhengFacts
        ? '请核对本次七政四余盘的可复算事实、来源精度与继续解释所需资料。'
        : keepsZodiacFacts
          ? '请说明本次资料命中的固定关系、可继续推算的范围与仍需补充的信息。'
          : keepsTaiyiFacts
            ? '请核对本次太乙年计的可复算事实、来源边界与继续解释所需资料。'
            : '请核对本次排盘已列出的可复算事实、来源边界与继续解释所需资料。');
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
        ? '只核对输入与测量口径、命卦宅卦、八宫传统标签、三元九运、山向、运山向三盘、候选山向、边界状态及两体系分层事实。问题文字不能选择重点宫位，也不能把标签、分组或星位改写成现实吉凶。只有调用方同时明确具体解释底本和版本、完整解释规则、现场形峦与用途及空间条件、已指定判断对象时，才可按所给资料继续现实推算；缺少任一项时保持事实层。'
        : keepsQizhengFacts
          ? '只核对民用时间、地点、时区、位置来源与精度、十一星黄经宿度和宫位、命身十二职宫、55组星对实际夹角、传统神煞起例目标支、月相及光照事实。问题文字不能指定所谓重点宫位，也不能把宫位、星位、夹角或神煞目标支改写成现实吉凶。只有调用方同时明确具体解释底本、版本与可定位原文、完整庙旺吊照及宫星神煞解释规则、已指定判断对象、明确出生地点时区与资料精度时，才可按所给资料继续现实推算；缺少任一项时保持事实层。'
          : keepsZodiacFacts
            ? '只核对生肖年支、流年干支、值冲固定刑害破、六合固定支对、三合三会成员与年干五行方向；【问题】只限定核对范围。上述关系只证明固定结构，不证明现实贵人、利弊、吉凶、人物意图、事件结果、概率、应期或化解效果。'
            : keepsTaiyiFacts
              ? '只核对年计积数、七十二局、核心落宫、主客定算数值、将参宫位和十六神位置；【问题】只限定核对范围。未明确解释底本版本、所问事项及主客现实角色时，不得生成总体态势、胜负、时机或行动建议。'
              : '只核对已列出的原始输入、可复算事实、来源和限制；【问题】只限定核对范围。具体版本、完整规则与适用条件未闭合时，不得生成现实吉凶、事件、概率、应期或行动建议。',
      '',
      '【输出要求】',
      keepsResidentialFacts
        ? '使用简体中文，按“可复算盘面事实、边界状态、继续推算所需资料”的顺序回答；不得补造未提供的山向、年份、流派或现场条件，不生成吉方、凶方、宜避方向、住宅现实效果、优先级、布置装修或行动建议、综合总分与效果保证。'
        : keepsQizhengFacts
          ? '使用简体中文，按“输入与精度、可复算位置和几何事实、已校勘排盘规则、未采用解释规则、继续推算所需资料”的顺序回答；不得补造庙旺、吊照、强弱或神煞命中，不生成性格、现实事件、吉凶、应期、概率或行动建议。'
          : keepsZodiacFacts
            ? '使用简体中文，按“生肖年支与流年干支、固定关系事实、五行方向、资料缺口、条件性后续推算”的顺序回答；不补造出生月、日、时或未提供的现实信息，不生成现实吉凶、人物意图、事件结果、概率、固定应期、行动建议或化解保证。'
            : keepsTaiyiFacts
              ? '使用简体中文，按“已校勘年计事实、未校解释规则、资料缺口、条件性后续推算”的顺序回答；不补造算数属性、月日时计或现实主客含义，不生成总体态势、胜负、时机或行动建议。'
              : '使用简体中文，按“原始输入、可复算事实、来源限制、资料缺口、条件性后续推算”的顺序回答。',
    ].join('\n'),
  );
}
