/**
 * 八字 AI 提示词模块
 *
 * 前端调用链：
 *   单盘 → buildPromptFromConfig()
 *   合盘 → getCompatibilityPrompt()
 *
 * 两者均通过 prompt-engine.ts 统一导出给 ResultPage.tsx
 */

import type { BaziChartResult } from '../bazi/baziTypes';
import { formatBaziForPrompt, type PromptChartScene } from '../bazi/baziAnalysisFormatter';
import type { FortuneSelectionContext } from '../bazi/fortuneSelection';
import {
  getBaziCompatibilityDefaultQuestion,
  getBaziDefaultQuestion,
} from '../../lib/prompt-default-questions';
import { formatPromptCurrentTime } from '../../lib/prompt-time';
import {
  generateEnhancedAnalysisSection,
  generateCompatibilityEnhancedSection,
} from '../bazi/baziPromptEnhancement';
import {
  BAZI_QUESTION_SCENES,
  buildBaziQuestionGuidanceSection,
  resolveBaziQuestionScene,
  type BaziQuestionScene,
} from './baziQuestionScene';

// ─── 类型 ──────────────────────────────────────────

export interface AIPromptOption {
  id: string;
  prompt: string;
  scene?: string;
}

export { BAZI_QUESTION_SCENES, buildBaziQuestionGuidanceSection, resolveBaziQuestionScene };
export type { BaziQuestionScene };

// ─── 系统提示词 ────────────────────────────────────

const BASE_SYSTEM_ROLE = '你是资深八字命理师，熟悉《渊海子平》《滴天髓》《三命通会》《穷通宝鉴》。';

const BASE_SYSTEM_RULES = [
  '只基于提供的命盘、岁运和问题作答',
  '不得编造已提供资料没有给出的新盘面事实；允许基于已提供资料做传统八字推理，但必须标明来自原局、岁运、十神、合冲刑害、神煞旁证或现实补充信息',
  '判断喜忌：先旺衰月令→格局调候→取用十神→神煞；普通格局按扶抑，专旺从格按顺势；神煞不得单独推翻主体判断',
  '标注为“传统旁证”的内容只作辅助验证，不得盖过核心判断依据',
  '说清核心用神、辅助喜用与主忌，结论与推理不一致时必须指出冲突点',
  '涉及年份、月份、日期或年龄时，只有【分析对象】中提供的大运、流年、流月、流日才可作为当前岁运证据',
  '优先使用命盘中的核心判断依据组织推理，不要平均复述四柱资料',
  '信息不足时说明证据不足，不得强行给确定结论',
  '用通俗中文，不写套话，不复述无关背景',
  '取用顺序：扶抑法为基础，病药法找突出问题，通关法调两神相战，调候法调寒热燥湿，专旺从势法顺势',
];

const COMPAT_SYSTEM_RULES = [
  '只基于提供的双方命盘、岁运和问题作答',
  '不得编造已提供资料没有给出的新盘面事实；允许基于双方已提供资料做传统八字推理，但必须标明来自原局、岁运、十神、合冲刑害、神煞旁证或现实补充信息',
  '双盘先分别判断旺衰、格局、调候和用忌，再汇总双方互动主线、互补点、冲突点、现实压力和建议',
  '判断喜忌仍按旺衰月令→格局调候→取用十神→神煞；普通格局按扶抑，专旺从格按顺势；神煞不得单独推翻主体判断',
  '标注为“传统旁证”的内容只作辅助验证，不得盖过核心判断依据',
  '双盘分析先看命局主线、喜忌互补与岁运节奏，再看十神、宫位、合冲刑害和神煞旁证',
  '优先提炼双方互动主线，不要平均复述两张命盘资料',
  '关系结论若与双方命局主线或岁运节奏不一致，必须指出冲突点',
  '信息不足时说明证据不足，不得强行给确定结论',
  '用通俗中文，不写套话，不复述无关背景',
];

function buildSystemText(rules: readonly string[] = BASE_SYSTEM_RULES): string {
  const normalizedRules = Array.from(new Set(rules.map((line) => line.trim()).filter(Boolean)));
  return [BASE_SYSTEM_ROLE, '要求：', ...normalizedRules.map((line) => `- ${line}`)].join('\n');
}

/** 单盘系统提示词 */
const SYSTEM_PROMPT = buildSystemText();
/** 合盘系统提示词 */
const COMPATIBILITY_SYSTEM_PROMPT = buildSystemText(COMPAT_SYSTEM_RULES);

// ─── 工具函数 ──────────────────────────────────────

function buildPromptSection(title: string, content: string): string {
  return `【${title}】\n${content}`;
}

function demoteEmbeddedPromptSections(content: string): string {
  return content.replace(/^【([^】]+)】$/gm, '$1：');
}

function joinPromptSections(sections: Array<string | null | undefined>): string {
  return sections.filter(Boolean).join('\n\n');
}

function resolvePromptScene(promptId: string): PromptChartScene {
  // 当前快捷按钮均已走 general 场景格式化，保留 fortune 分支以备将来扩展
  if (
    promptId.startsWith('ai-fortune-') ||
    promptId === 'ai-current-luck' ||
    promptId === 'ai-this-year'
  ) {
    return 'fortune';
  }
  return 'general';
}

function removePromptLabel(value: string, label: string) {
  return value.startsWith(label) ? value.slice(label.length).trim() : value;
}

function findFortuneSummaryLine(ctx: FortuneSelectionContext, prefixes: string[]) {
  return ctx.promptPayload.summaryLines.find((line) =>
    prefixes.some((prefix) => line.startsWith(prefix)),
  );
}

function buildFortuneSelectedObjectText(ctx: FortuneSelectionContext) {
  return removePromptLabel(ctx.promptPayload.scopeLabel, '分析对象：');
}

function buildFortuneTimingText(ctx: FortuneSelectionContext) {
  if (ctx.scope === 'dayun') {
    return `选择日期：${ctx.cycleStartYear}年起，约${ctx.cycleAge}岁交运`;
  }

  if (ctx.scope === 'year') {
    return `选择日期：${ctx.year ?? '未标注'}年${ctx.yearAge ? `（${ctx.yearAge}岁）` : ''}`;
  }

  if (ctx.scope === 'month') {
    const month = ctx.monthBreakdown?.[0];
    if (!month) return '';
    const start = [month.startTermName, month.startDateTime].filter(Boolean).join(' ');
    const end = [month.endTermName, month.endDateTime].filter(Boolean).join(' ');
    const jieqiText =
      start || end
        ? `（节气月：${start || month.startDate} 起，${end || month.endDate} 交下节）`
        : '';
    return `选择日期：${month.startDate} 至 ${month.endDate}${jieqiText}`;
  }

  const day = ctx.dayBreakdown?.[0];
  const ziChuText = findFortuneSummaryLine(ctx, ['按子初换日：']);
  return ['选择日期：', day?.date ?? ctx.displayLabel, ziChuText ? `（${ziChuText}）` : ''].join(
    '',
  );
}

function buildFortuneHierarchyText(ctx: FortuneSelectionContext) {
  const parents = ctx.promptPayload.summaryLines
    .filter(
      (line) =>
        line.startsWith('所属大运：') ||
        line.startsWith('所属流年：') ||
        line.startsWith('所属流月：'),
    )
    .map((line) =>
      line
        .replace(/^所属大运：/, '')
        .replace(/^所属流年：/, '')
        .replace(/^所属流月：/, '')
        .replace(/\s+/g, ''),
    );

  return parents.length ? `上层岁运：${parents.join(' > ')}` : '';
}

function buildFortuneGanZhiText(ctx: FortuneSelectionContext) {
  const ganZhiLine = findFortuneSummaryLine(ctx, ['大运干支：', '流年干支：', '流月：', '流日：']);
  const tenGodLine = findFortuneSummaryLine(ctx, [
    '大运十神：',
    '流年十神：',
    '流月十神：',
    '流日十神：',
  ]);

  if (!ganZhiLine && !tenGodLine) return '';
  return [
    '当前干支：',
    ganZhiLine ? removePromptLabel(ganZhiLine, ganZhiLine.split('：')[0] + '：') : '',
    tenGodLine ? `；${removePromptLabel(tenGodLine, tenGodLine.split('：')[0] + '：')}` : '',
  ].join('');
}

function buildFortuneTriggerText(ctx: FortuneSelectionContext) {
  const triggerLine = ctx.promptPayload.summaryLines.find((line) => line.includes('触发：'));
  return triggerLine ? `核心触发：${triggerLine.replace(/^[^：]+触发：/, '')}` : '';
}

function buildFortuneUsageBoundaryText(scope: FortuneSelectionContext['scope']) {
  const boundaryMap: Record<FortuneSelectionContext['scope'], string> = {
    dayun: '解读范围：重点判断这步大运的十年阶段主题；未选择流年时不指定某一年。',
    year: '解读范围：重点判断这一年的年度触发；未选择流月或流日时不指定具体月日。',
    month: '解读范围：重点判断这个节气月窗口；未选择流日时不指定具体日期。',
    day: '解读范围：重点判断这个流日的执行、沟通、触发和避险，不改写长期趋势。',
  };

  return boundaryMap[scope];
}

function formatFortuneSelectionSection(
  ctx: FortuneSelectionContext | null | undefined,
  _options: { includeBreakdown?: boolean } = {},
): string {
  if (!ctx) return '';
  const { promptPayload } = ctx;
  const scopeBoundaryMap: Record<FortuneSelectionContext['scope'], string> = {
    dayun: '解读范围：大运看十年阶段主题、环境压力与机会方向；若要精确到某年，需要用户再选择流年。',
    year: '解读范围：流年看年度触发；可以参考下列流月窗口，但不要把未被选择的流月、流日说成确定应期。',
    month: '解读范围：流月看月份窗口、推进节奏和短期触发；不宜反推一生命局层面的定论。',
    day: '解读范围：流日只看当日执行、沟通、触发和避险；不能把一天的波动说成长期命运。',
  };
  const lines = [
    promptPayload.scopeLabel,
    buildFortuneTimingText(ctx),
    scopeBoundaryMap[ctx.scope],
    '推断顺序：先看本命底色，再看大运阶段，再看流年年度触发，最后用流月、流日细化窗口。',
    '资料说明：下面列出的上层与下级岁运，是为了让在线 AI 能独立推算；本次仍以上面已选分析对象为主。',
  ];
  const detailGroups =
    promptPayload.detailGroups?.filter((group) => group.title && group.lines.length > 0) ?? [];
  if (detailGroups.length) {
    detailGroups.forEach((group) => {
      lines.push(group.title);
      lines.push(...group.lines.map((line, i) => `${i + 1}. ${line}`));
    });
  } else if (promptPayload.breakdownTitle && promptPayload.breakdownLines?.length) {
    lines.push(promptPayload.breakdownTitle);
    lines.push(...promptPayload.breakdownLines.map((line, i) => `${i + 1}. ${line}`));
  }
  return lines.join('\n');
}

function formatFortuneEvidenceSection(ctx: FortuneSelectionContext | null | undefined): string {
  if (!ctx) return '';

  return [
    `已选对象：${buildFortuneSelectedObjectText(ctx)}`,
    buildFortuneTimingText(ctx),
    buildFortuneHierarchyText(ctx),
    buildFortuneGanZhiText(ctx).replace(/^当前干支：/, '所选干支：'),
    buildFortuneTriggerText(ctx).replace(/^核心触发：/, '主要触发：'),
    buildFortuneUsageBoundaryText(ctx.scope),
  ]
    .filter(Boolean)
    .join('\n');
}

function buildBaziNatalAnalysisObjectSection(): string {
  return [
    '分析对象：本命盘',
    '解读范围：只判断命局长期结构、性格底色、能力资源、关系模式、长期风险与可调整方向。',
    '资料说明：本次没有提供具体大运、流年、流月、流日；问题涉及年份、月份、日期或年龄时，只能给本命倾向，并提醒需要补充对应岁运后再判断应期。',
    '推断顺序：先看日主旺衰、月令、格局调候、用神喜忌，再看十神、宫位、合冲刑害与神煞旁证。',
  ].join('\n');
}

function buildBaziScopePrioritySection(hasFortuneSelection: boolean): string {
  if (!hasFortuneSelection) {
    return [
      '本次只提供本命盘，没有提供具体大运、流年、流月、流日。',
      '回答只能判断命局长期结构、长期倾向和现实调整方向，不得自行展开具体年份应期。',
      '如果【问题】询问具体年份、月份、日期或年龄，开头先说明当前资料只能看本命倾向，并提示需要补充对应岁运后再判断时间窗口。',
      '写应期时只能说明“具备哪类触发条件时更容易出现”，不得给绝对年份或日期。',
    ].join('\n');
  }

  return [
    '只有【分析对象】中已经提供的大运、流年、流月、流日，才作为本次岁运依据。',
    '本次已经提供具体年限，回答要围绕该大运、流年、流月或流日展开。',
    '如果【问题】中的时间与【分析对象】不一致，开头先提醒不一致，再以【分析对象】为准。',
    '写应期时请说明依据来自本命底色、大运阶段、流年触发、流月窗口还是流日短期触发。',
  ].join('\n');
}

function buildBaziFortuneInterpretationRules(scope: FortuneSelectionContext['scope']): string {
  const selectedScopeRule: Record<FortuneSelectionContext['scope'], string> = {
    dayun:
      '当前已选大运：回答以十年阶段主题为主，只能在已提供的逐年列表中提示重点年份，不得把大运本身说成某个确定年份已经发生。',
    year: '当前已选流年：回答以该年年度触发为主，必须承接所属大运背景；可引用已提供的流月列表判断月份窗口，但未被问题或证据选中的月份不能硬断为唯一应期。',
    month:
      '当前已选流月：回答以该月节气范围内的推进窗口、短期触发和风险控制为主；必须说明它如何承接大运与流年，不得用一个月推翻本命和整年主线。',
    day: '当前已选流日：回答以当天执行、沟通、决策、避险和即时触发为主；必须服从所属流月、流年与大运，不得把一天的波动说成长期命运。',
  };

  return [
    selectedScopeRule[scope],
    '本命层：只定格局、旺衰、用忌、性格底色、长期能力与长期问题，不能单独推出具体年份。',
    '大运层：看十年阶段的环境、身份、资源、压力和机会方向；大运能定阶段强弱，不能替代流年给出精确应期。',
    '流年层：看年度触发、事件类别和该年更容易被引动的宫位/十神/合冲刑害；流年结论必须承接大运，不能脱离大运单独断吉凶。',
    '流月层：看月份窗口、推进节奏、临门一脚和短期反复；流月只能细化年度主题，不能覆盖整年趋势。',
    '流日层：看当日执行、沟通、签约、出行、冲突和避险；流日只作短期触发，不改写长期格局。',
    '写应期时，先说明上层背景，再说明当前所选层级的触发证据；如果缺少下层选择，只能说“更容易在某类窗口出现”，不得给绝对日期。',
  ].join('\n');
}

function buildBaziOutputRequirementText(kind: 'single' | 'fallback' = 'single') {
  const firstLine =
    kind === 'fallback'
      ? '先直接回答【问题】，再补关键依据、触发条件与建议。'
      : '先直接回答【问题】，再展开最关键的 2 到 4 个重点。';

  return [
    firstLine,
    '每个重点都要写明主证、辅证、反证或限制，以及应期条件；有【分析对象】时必须说明所选年限如何触发，没有选择年限时不得强断具体年份。',
    '证据不足处单独说明，不要为了给结论而编造盘面事实。',
  ].join('\n');
}

function buildFortunePromptAddon(promptId: string, ctx: FortuneSelectionContext | null): string {
  if (!ctx) return '';
  if (promptId === 'ai-fortune-detail') {
    if (ctx.scope === 'dayun') return '按逐年列表依次分析这一步大运，先总后分。';
    if (ctx.scope === 'year') return '按流月列表依次分析这一年，先总后分。';
    if (ctx.scope === 'month') return '按流日列表依次分析这个流月，先总后分。';
    return '聚焦这个流日的主题、机会风险和建议。';
  }
  if (promptId === 'ai-fortune-overview') return '聚焦整体节奏、机会、风险和应对。';
  return '';
}

// ─── 快捷按钮配置 ──────────────────────────────────

export const BAZI_AI_PROMPTS = {
  /** 单盘快捷选项 — 仅保留前端 baziSingleShortcutActions 实际引用的 promptId */
  single: [
    {
      id: 'ai-mingge-zonglun',
      prompt:
        '判断日主旺衰、格局层次、用神喜忌，抓2到3个最有辨识度的影响，讲清命局的病与药，并给出调整建议。',
      scene: 'general',
    },
    {
      id: 'ai-recent',
      prompt:
        '结合当前大运、流年、流月与命局主线，判断现阶段最该优先推进的方向、适合主动出手的事项、需要暂缓的风险和更稳妥的行动节奏。',
      scene: 'recent',
    },
    {
      id: 'ai-career',
      prompt:
        '判断命局更适合守成、开拓、技术、管理还是经营，再说明当前阶段的赚钱方式、职业方向和风险点。',
      scene: 'career',
    },
    {
      id: 'ai-job-change',
      prompt:
        '结合当前大运、流年、流月与命局主线，判断现在更适合留在原岗位、试探新机会、直接跳槽还是先蓄力转方向，并说明平台、收入、成长空间和短期风险的取舍重点。',
      scene: 'job-change',
    },
    {
      id: 'ai-startup-partnership',
      prompt:
        '结合当前大运、流年、流月与命局主线，判断现在更适合创业、找人合作、小范围试跑、继续上班积累还是暂缓，并说明方向选择、资源来源、合作分工、现金流压力和现实风险。',
      scene: 'startup-partnership',
    },
    {
      id: 'ai-investment-partnership',
      prompt:
        '围绕财星、官杀、印星、食伤、比劫与当前岁运引动，判断现在更适合独立投资、合作求财、继续观望还是先守财，并说明资金压力、收益模式、合作分工、风险边界和现实代价。',
      scene: 'investment-partnership',
    },
    {
      id: 'ai-wealth-timing',
      prompt: '判断财运应期，说明财更容易在哪些阶段、年份或环境里起来，再指出机会点和破财情形。',
      scene: 'wealth',
    },
    {
      id: 'ai-marriage',
      prompt:
        '围绕配偶星、夫妻宫和相处模式，判断感情优势、隐患与关系节奏，再说明适合的对象、容易推进的阶段和经营建议。',
      scene: 'marriage',
    },
    {
      id: 'ai-relationship-push',
      prompt:
        '围绕配偶星、夫妻宫、桃花与当前岁运引动，判断这段关系现在更适合主动推进、稳定经营、放慢观察还是及时止损，并说明投入价值、风险边界和接下来的判断标准。',
      scene: 'relationship-push',
    },
    {
      id: 'ai-relationship-decision',
      prompt:
        '围绕配偶星、夫妻宫、桃花与当前岁运引动，判断这段关系现在更适合继续投入、放慢观察、重新建立边界还是及时止损，并说明继续投入的条件、止损信号、现实代价和接下来的判断标准。',
      scene: 'relationship-decision',
    },
    {
      id: 'ai-reconciliation-decision',
      prompt:
        '围绕配偶星、夫妻宫、桃花、旧缘信号与当前岁运引动，判断这段旧关系现在更适合争取复合、保持观察、先立边界还是及时放下，并说明复合条件、现实阻力、风险信号和接下来的判断标准。',
      scene: 'reconciliation-decision',
    },
    {
      id: 'ai-children-fate',
      prompt:
        '判断子女缘分深浅、子女性格倾向和教育相处方式，说明更该关注生育时机、子女互动还是教育重点。',
      scene: 'children',
    },
    {
      id: 'ai-health',
      prompt:
        '判断最需要注意的身体倾向与生活习惯问题，说明风险主要落在哪些系统或体质失衡上，再给出饮食、作息、运动建议。',
      scene: 'health',
    },
    {
      id: 'ai-family',
      prompt:
        '围绕父母、兄弟姐妹、家庭责任和亲缘边界做整体分析，说明六亲对命局的助力、牵制、压力来源和更稳妥的相处方式。',
      scene: 'parents',
    },
    {
      id: 'ai-home',
      prompt:
        '围绕原生家庭、安全感来源、家庭边界、居住秩序和现实责任分工做整体分析，说明哪些地方在支持你，哪些地方在消耗你，并给出更稳妥的调整建议。',
      scene: 'family',
    },
    {
      id: 'ai-home-move',
      prompt:
        '围绕搬家、换城市、买房置业与居住调整做整体分析，判断现在更适合行动还是继续观望，并说明居住稳定性、资金压力、家庭牵动、行动时机和风险控制重点。',
      scene: 'home-move',
    },
    {
      id: 'ai-settle-relocate',
      prompt:
        '围绕长期定居、换城市发展与居住根基做整体分析，判断现在更适合留在当前城市、换城发展、两地过渡还是暂缓决定，并说明稳定性、事业机会、家庭牵动、成本压力和行动顺序。',
      scene: 'settle-relocate',
    },
    {
      id: 'ai-social',
      prompt:
        '围绕社交风格、合作关系、贵人来源、沟通短板和人脉策略做整体分析，说明你更适合怎样筛选关系和使用资源。',
      scene: 'social',
    },
    {
      id: 'ai-emotion',
      prompt:
        '围绕情绪触发点、压力来源、安全感需求、内耗模式和修复方式做整体分析，说明当前最值得先调整的状态与节奏。',
      scene: 'emotion',
    },
    {
      id: 'ai-study',
      prompt:
        '围绕印星、食伤、官杀和学业文凭做整体分析，说明学习吸收力、表达输出、考试压力、进修潜力和最适合的提升方式。',
      scene: 'study',
    },
    {
      id: 'ai-study-advance',
      prompt:
        '围绕考证、读研进修、跨领域学习与当前岁运引动做整体分析，判断现在更适合冲刺、长期准备、换赛道学习还是暂缓，并说明投入产出、执行压力和现实代价。',
      scene: 'study-advance',
    },
    {
      id: 'ai-exam-landing',
      prompt:
        '围绕印星、食伤、官杀、文凭考试与当前岁运引动做整体分析，判断这次考试、面试或申请更适合冲刺上岸、稳住发挥、调整目标还是暂缓重来，并说明发挥短板、竞争压力、准备重点和现实风险。',
      scene: 'exam-landing',
    },
    {
      id: 'ai-growth',
      prompt:
        '围绕命局病药、性格卡点、长期成长课题、反复受阻模式和现实突破方向做整体分析，说明最值得优先调整的主线。',
      scene: 'growth',
    },
    {
      id: 'ai-talent',
      prompt:
        '围绕核心天赋、学习吸收、表达输出、组织执行和资源整合能力做整体分析，说明哪些优势最值得长期放大以及如何落地。',
      scene: 'talent',
    },
  ] as AIPromptOption[],
  /** 合盘快捷选项 — 仅保留前端 baziCompatibilityShortcutActions 实际引用的 promptId */
  combined: [
    {
      id: 'ai-compat-marriage',
      prompt:
        '判断两人的婚恋匹配度是互补、互耗还是强吸引强摩擦，再说明相处优势、冲突来源、长期走向和相处建议。',
      scene: 'marriage',
    },
    {
      id: 'ai-compat-career',
      prompt:
        '判断合作是否顺手、谁主导、谁执行、谁控风险，再说明最强互补点、最大利益冲突点和是否适合长期合伙。',
      scene: 'career',
    },
    {
      id: 'ai-compat-friendship',
      prompt:
        '判断两人的相处模式是容易投缘、容易互补还是容易暗中较劲，再说明适合的距离和相处提醒。',
      scene: 'general',
    },
    {
      id: 'ai-compat-children',
      prompt:
        '从双方食伤星、子女宫和桃花配合角度，判断子女缘分的深浅、子女性格倾向和亲子相处重点。',
      scene: 'children',
    },
    {
      id: 'ai-compat-parents',
      prompt:
        '从双方父母星、父母宫和当前岁运切入，判断双方父母健康状况、需要关注的风险方向和赡养建议。',
      scene: 'parents',
    },
    {
      id: 'ai-compat-siblings',
      prompt:
        '从双方比劫关系、命宫和相处模式切入，判断两人之间兄弟朋友关系的亲疏、助力与牵制、相处建议。',
      scene: 'general',
    },
  ] as AIPromptOption[],
};

// ─── 单盘提示词构建（主入口） ──────────────────────

type SinglePromptConfig = (typeof BAZI_AI_PROMPTS.single)[number];

/**
 * 构建单盘八字提示词
 *
 * 主路径：根据 selectedOption 匹配 BAZI_AI_PROMPTS.single 配置，
 *         注入增强分析（病药法/通关法/经典格局/神煞详解等）
 * fallback：配置匹配不到时走基础拼装
 */
export function buildPromptFromConfig(
  questionText: string,
  selectedOption: AIPromptOption,
  chartResult: BaziChartResult | null,
  fortuneSelectionContext: FortuneSelectionContext | null = null,
  questionScene?: string,
  options: { isCustomQuestion?: boolean } = {},
): { system: string; user: string } {
  const isCustomQuestion = Boolean(options.isCustomQuestion);
  const promptConfig: SinglePromptConfig | null = chartResult?.pillars
    ? (BAZI_AI_PROMPTS.single.find((c) => c.id === selectedOption.id) ?? null)
    : null;
  const scene = resolveBaziQuestionScene(questionScene || promptConfig?.scene);
  const normalizedQuestion =
    questionText.trim() || getBaziDefaultQuestion(scene, { isCustomQuestion });

  // ── 主路径 ──
  if (promptConfig) {
    const chartData = chartResult
      ? formatBaziForPrompt(chartResult, selectedOption, resolvePromptScene(promptConfig.id))
      : '无法获取命盘数据。';
    const fortuneSection = formatFortuneSelectionSection(fortuneSelectionContext, {
      includeBreakdown: promptConfig.id === 'ai-fortune-detail',
    });
    const fortuneEvidenceSection = formatFortuneEvidenceSection(fortuneSelectionContext);
    const fortuneAddon = buildFortunePromptAddon(promptConfig.id, fortuneSelectionContext);
    const task = [promptConfig.prompt, fortuneAddon].filter(Boolean).join(' ');

    // 增强分析片段
    let enhancedSection = '';
    if (chartResult && !isCustomQuestion) {
      enhancedSection = generateEnhancedAnalysisSection(chartResult, scene);
    }

    return {
      system: SYSTEM_PROMPT,
      user: joinPromptSections([
        buildPromptSection('当前时间', formatPromptCurrentTime()),
        buildPromptSection('排盘信息', [chartData, enhancedSection].filter(Boolean).join('\n')),
        !isCustomQuestion && !fortuneSection
          ? buildPromptSection('分析对象', buildBaziNatalAnalysisObjectSection())
          : '',
        fortuneSection ? buildPromptSection('分析对象', fortuneSection) : '',
        fortuneEvidenceSection ? buildPromptSection('岁运重点', fortuneEvidenceSection) : '',
        !isCustomQuestion && fortuneSelectionContext
          ? buildPromptSection(
              '解读方法',
              buildBaziFortuneInterpretationRules(fortuneSelectionContext.scope),
            )
          : '',
        isCustomQuestion
          ? ''
          : buildPromptSection('解读范围', buildBaziScopePrioritySection(Boolean(fortuneSection))),
        buildPromptSection('问题', normalizedQuestion),
        isCustomQuestion
          ? ''
          : buildPromptSection(
              '分析思路',
              buildBaziQuestionGuidanceSection(scene, Boolean(fortuneSection)),
            ),
        isCustomQuestion ? '' : buildPromptSection('任务', task || '请直接判断重点。'),
        isCustomQuestion
          ? ''
          : buildPromptSection('输出要求', buildBaziOutputRequirementText('single')),
      ]),
    };
  }

  // ── fallback ──
  const chartData = chartResult?.pillars
    ? formatBaziForPrompt(chartResult, selectedOption, 'general')
    : '命盘数据格式不支持。';

  return {
    system: SYSTEM_PROMPT,
    user: joinPromptSections([
      buildPromptSection('当前时间', formatPromptCurrentTime()),
      buildPromptSection('排盘信息', chartData),
      isCustomQuestion ? '' : buildPromptSection('分析对象', buildBaziNatalAnalysisObjectSection()),
      isCustomQuestion ? '' : buildPromptSection('解读范围', buildBaziScopePrioritySection(false)),
      buildPromptSection('问题', normalizedQuestion),
      isCustomQuestion
        ? ''
        : buildPromptSection('分析思路', buildBaziQuestionGuidanceSection(scene, false)),
      isCustomQuestion ? '' : buildPromptSection('任务', '请直接判断重点。'),
      isCustomQuestion
        ? ''
        : buildPromptSection('输出要求', buildBaziOutputRequirementText('fallback')),
    ]),
  };
}

// ─── 合盘提示词构建（主入口） ──────────────────────

export type CompatType = 'marriage' | 'career' | 'friendship' | 'children' | 'parents' | 'siblings';

function getCompatibilityTask(compatType?: CompatType): string {
  if (compatType === 'career') {
    return '请先判断合作主轴，再说明分工互补、利益风险、沟通成本和长期建议。';
  }
  if (compatType === 'friendship') {
    return '请先判断相处主轴，再说明投缘点、边界风险、相处节奏和建议。';
  }
  if (compatType === 'children') {
    return '请先说明子女议题的主线，再分证据强弱展开重点。';
  }
  if (compatType === 'parents') {
    return '请先说明父母议题主线，再分健康风险、照护压力、关系边界与建议展开。';
  }
  if (compatType === 'siblings') {
    return '请先说明兄弟朋友议题主线，再分亲疏互动、现实助力牵制与边界建议展开。';
  }
  return '请先判断关系主轴，再说明相处模式、互补点、冲突点和建议。';
}

function getCompatibilityOutputRequirement(compatType?: CompatType): string {
  const opening =
    compatType === 'children' || compatType === 'parents' || compatType === 'siblings'
      ? '先直接回答【问题】，再展开最关键的 2 到 4 个重点，并分清证据强弱。'
      : '先直接回答【问题】，再展开最关键的 2 到 4 个重点。';

  return [
    opening,
    '每个重点都要写明双方盘面主证、辅证、反证或限制、触发条件与现实建议；证据不足处单独说明。',
  ].join('\n');
}

/**
 * 构建合盘八字提示词
 *
 * 接受原始 BaziChartResult，内部完成格式化 + 增强分析注入
 */
export function getCompatibilityPrompt(
  questionText: string,
  baziResult1: BaziChartResult | null,
  baziResult2: BaziChartResult | null,
  compatType?: CompatType,
  options: { isCustomQuestion?: boolean } = {},
): { system: string; user: string } {
  const isCustomQuestion = Boolean(options.isCustomQuestion);
  const data1 = baziResult1
    ? demoteEmbeddedPromptSections(formatBaziForPrompt(baziResult1, null, 'compatibility'))
    : '无法获取第一人命盘数据。';
  const data2 = baziResult2
    ? demoteEmbeddedPromptSections(formatBaziForPrompt(baziResult2, null, 'compatibility'))
    : '无法获取第二人命盘数据。';

  const enhancedSection = compatType ? generateCompatibilityEnhancedSection(compatType) : '';

  return {
    system: COMPATIBILITY_SYSTEM_PROMPT,
    user: joinPromptSections([
      buildPromptSection('当前时间', formatPromptCurrentTime()),
      buildPromptSection('第一人排盘信息', data1),
      buildPromptSection('第二人排盘信息', data2),
      !isCustomQuestion && enhancedSection
        ? buildPromptSection('合盘分析思路', enhancedSection)
        : '',
      buildPromptSection(
        '问题',
        questionText.trim() || getBaziCompatibilityDefaultQuestion(compatType),
      ),
      isCustomQuestion ? '' : buildPromptSection('任务', getCompatibilityTask(compatType)),
      isCustomQuestion
        ? ''
        : buildPromptSection('输出要求', getCompatibilityOutputRequirement(compatType)),
    ]),
  };
}
