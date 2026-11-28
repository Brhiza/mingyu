/**
 * 本地离线 Agent 小模型统一编排引擎（零在线 API 依赖）
 *
 * 合并分散的语义规则，提供四大本地智能能力：
 * 1. analyzeUserQuery       — 统一意图解析（领域/主题/合盘关系/时间窗/生辰提取/解读框架）
 * 2. inspectQuestionQuality — 提问质量体检与一键补全胶囊
 * 3. generateChartFollowUps — 基于真实盘面事实生成定制智能追问
 * 4. runLocalAgentPlan      — 按需懒加载分类器权重，输出完整本地 Agent 选盘与填表计划
 */

import type { Method } from '../core';
import {
  parseQuestionContext,
  type ParsedQuestionContext,
} from '../systems/question-context';
import type { SynastryRelationship } from '../systems/focus-presets';
import {
  extractBirthProfiles,
  type ExtractedBirthResult,
} from './birth-extractor';
import {
  inferFortuneScope,
  type FortuneScope,
} from './fortune-scope';
import {
  PROMPT_FRAMEWORKS,
  detectDomain,
  selectPromptFramework,
  type DetectedDomainResult,
  type FrameworkId,
  type RecommendedFrameworkResult,
} from './frameworks';
import type { MethodId, RouterInput, RouterResult } from './index';

export {
  formatFrameworkPromptBlock,
  generateChartFollowUps,
  type ChartFollowUpSuggestion,
} from './chart-assistant';

export interface UnifiedQueryAnalysis {
  questionContext: ParsedQuestionContext;
  domain: DetectedDomainResult;
  fortuneScope: FortuneScope;
  extractedBirth: ExtractedBirthResult;
  recommendedFramework: RecommendedFrameworkResult;
}

export interface QuestionQuickFix {
  id: string;
  label: string;
  /** 点击后追加或补全的简短上下文短语 */
  appendText: string;
  /** 可选同步更新补充信息字段 */
  patch?: {
    lifeStageContext?: string;
    timeHorizon?: '近期几天' | '一三个月' | '半年一年' | '长期走向';
  };
}

export interface QuestionQualityReport {
  /** 清晰度评分 0..100 */
  score: number;
  level: 'brief' | 'good' | 'rich';
  hint?: string;
  quickFixes: QuestionQuickFix[];
}

export interface LocalAgentPlan {
  query: string;
  routing: RouterResult;
  analysis: UnifiedQueryAnalysis;
  quality: QuestionQualityReport;
}

/**
 * 统一语义解析：一次调用输出领域、主题、合盘关系、岁运时间窗、生辰提取与推荐解读框架。
 */
export function analyzeUserQuery(
  rawQuery: string,
  options?: {
    method?: Method | MethodId;
    referenceYear?: number;
    birthYear?: number;
    partnerBirthYear?: number;
  },
): UnifiedQueryAnalysis {
  const query = rawQuery.trim();
  const questionContext = parseQuestionContext(query);
  const extractedBirth = extractBirthProfiles(query);
  const refYear = options?.referenceYear ?? new Date().getFullYear();

  // 若提问中含双人年龄表达且传了伴侣出生年，优先取用户出生年，必要时补伴侣出生年
  const effectiveBirthYear =
    options?.birthYear ??
    questionContext.birthYear ??
    extractedBirth.profiles[0]?.year ??
    options?.partnerBirthYear ??
    extractedBirth.profiles[1]?.year;

  const fortuneScope = inferFortuneScope(query, refYear, undefined, effectiveBirthYear);

  const methodForFramework = (options?.method ??
    (extractedBirth.isTwoPerson ? 'bazi-synastry' : 'bazi')) as MethodId;
  const domain = detectDomain(query, methodForFramework);
  const recommendedFramework = selectPromptFramework({ query }, methodForFramework, domain);

  return {
    questionContext,
    domain,
    fortuneScope,
    extractedBirth,
    recommendedFramework,
  };
}

/**
 * 提问质量体检：判断问题是否过于笼统，并给出 2~4 个一键补全背景胶囊。
 */
export function inspectQuestionQuality(
  rawQuestion: string,
  options?: {
    method?: Method | MethodId;
    mode?: 'personal' | 'compatibility' | 'divination';
    relationship?: SynastryRelationship;
    hasLifeStage?: boolean;
    hasTimeHorizon?: boolean;
  },
): QuestionQualityReport {
  const q = rawQuestion.trim();
  const mode = options?.mode ?? 'personal';
  const targetMethod = options?.method;
  const ctx = parseQuestionContext(q);
  const scope = inferFortuneScope(q);
  const fixes: QuestionQuickFix[] = [];

  if (!q || q.length < 6) {
    if (mode === 'compatibility') {
      return {
        score: 35,
        level: 'brief',
        hint: '补充你们当前的关系阶段或关注年份，AI 给出的合盘建议会更精准',
        quickFixes: [
          {
            id: 'compat-stage-dating',
            label: '+ 正在恋爱/暧昧',
            appendText: '目前正在恋爱磨合阶段，想看长期稳定性与相处注意事项',
            patch: { lifeStageContext: '恋爱磨合期' },
          },
          {
            id: 'compat-stage-marriage',
            label: '+ 计划谈婚论嫁',
            appendText: '计划近期谈婚论嫁，想看领证结婚时机与婚后磨合重点',
            patch: { lifeStageContext: '谈婚论嫁' },
          },
          {
            id: 'compat-horizon-3y',
            label: '+ 看未来三年走势',
            appendText: '重点对比未来三年双方大运流年同步性与关键节点',
            patch: { timeHorizon: '长期走向' },
          },
        ],
      };
    }

    if (
      targetMethod === 'bazhai' ||
      targetMethod === 'xuankong' ||
      targetMethod === 'residential'
    ) {
      return {
        score: 38,
        level: 'brief',
        hint: '点选下方胶囊可一键补充宅居关注点，让布局建议更贴近实际居住需求',
        quickFixes: [
          {
            id: 'quick-fengshui-layout',
            label: '+ 居家布局调整',
            appendText: '重点结合命宅相配给出客厅、卧室与入户门的布局调整建议',
          },
          {
            id: 'quick-fengshui-wealth',
            label: '+ 催旺财位文昌',
            appendText: '重点指出这套住宅适合布置财位、书房或办公位的吉方',
          },
          {
            id: 'quick-fengshui-avoid',
            label: '+ 化煞避忌要点',
            appendText: '重点说明需避开的凶位、冲煞与日常稳妥化解要点',
          },
        ],
      };
    }

    return {
      score: 35,
      level: 'brief',
      hint: '问题较简短，点选下方胶囊可一键补全背景，显著提升 AI 解读深度',
      quickFixes: [
        {
          id: 'quick-career',
          label: '+ 事业与跳槽时机',
          appendText: '重点分析近期事业发展、是否适合跳槽变动及关键推进窗口',
          patch: { lifeStageContext: '在职观望' },
        },
        {
          id: 'quick-love',
          label: '+ 感情与正缘节奏',
          appendText: '重点分析感情走势、正缘/伴侣相处模式与需要注意的年份',
          patch: { lifeStageContext: '关注感情' },
        },
        {
          id: 'quick-wealth',
          label: '+ 财运与稳健策略',
          appendText: '重点分析正偏财格局、进财机会与需要防守破耗的节点',
          patch: { timeHorizon: '半年一年' },
        },
      ],
    };
  }

  let score = 60;
  if (q.length >= 16) score += 15;
  const hasExplicitStage =
    Boolean(options?.hasLifeStage) ||
    Boolean(ctx.lifeStageContext) ||
    /(单身|恋爱|已婚|分手|暧昧|在职|离职|待业|创业|学生|备考|谈婚论嫁|合伙)/.test(q);
  const hasExplicitTime =
    Boolean(options?.hasTimeHorizon) ||
    Boolean(ctx.timeHorizon) ||
    scope.focus !== 'default';

  if (hasExplicitStage) score += 15;
  if (hasExplicitTime) score += 10;

  // 针对不同主题给出缺漏补全建议
  if (!hasExplicitStage) {
    if (mode === 'compatibility') {
      const rel = options?.relationship ?? ctx.synastryRelationship ?? 'marriage';
      if (rel === 'career') {
        fixes.push({
          id: 'fix-partner-role',
          label: '+ 明确分工与利益边界',
          appendText: '目前准备合伙共事，请重点分析双方分工互补与利益风险边界',
          patch: { lifeStageContext: '准备合伙' },
        });
      } else {
        fixes.push({
          id: 'fix-compat-dating',
          label: '+ 补充：恋爱磨合期',
          appendText: '目前处于恋爱磨合阶段，想看感情升温节点与冲突化解方式',
          patch: { lifeStageContext: '恋爱磨合期' },
        });
        fixes.push({
          id: 'fix-compat-married',
          label: '+ 补充：已婚/长期伴侣',
          appendText: '目前为已婚/长期伴侣，想看家庭财务、沟通节奏与未来稳固度',
          patch: { lifeStageContext: '已婚伴侣' },
        });
      }
    } else if (ctx.inferredTopic === 'ganqing') {
      fixes.push(
        {
          id: 'fix-love-single',
          label: '+ 补充：目前单身',
          appendText: '目前单身，重点看脱单与正缘出现的时间窗口',
          patch: { lifeStageContext: '单身寻缘' },
        },
        {
          id: 'fix-love-in',
          label: '+ 补充：恋爱/已婚中',
          appendText: '目前有伴侣，重点看关系稳定度与磨合建议',
          patch: { lifeStageContext: '恋爱/已婚中' },
        },
      );
    } else if (ctx.inferredTopic === 'shiye') {
      fixes.push(
        {
          id: 'fix-career-job',
          label: '+ 补充：在职考虑跳槽',
          appendText: '目前在职考虑跳槽，请对比留任与换工作的利弊时机',
          patch: { lifeStageContext: '在职想跳槽' },
        },
        {
          id: 'fix-career-biz',
          label: '+ 补充：创业/副业评估',
          appendText: '考虑创业或副业，请评估抗风险能力与启动窗口',
          patch: { lifeStageContext: '筹备创业/副业' },
        },
      );
    } else if (ctx.inferredTopic === 'caifu') {
      fixes.push({
        id: 'fix-wealth-type',
        label: '+ 区分正财与投资风险',
        appendText: '请区分主业正财与理财/投资偏财机会，标出需谨慎避坑的阶段',
        patch: { lifeStageContext: '关注财务规划' },
      });
    }
  }

  if (!hasExplicitTime) {
    fixes.push({
      id: 'fix-time-recent',
      label: '+ 聚焦近半年至一年',
      appendText: '时间上重点聚焦近半年到一年内的关键节点与行动建议',
      patch: { timeHorizon: '半年一年' },
    });
    if (mode === 'compatibility' || mode === 'personal') {
      fixes.push({
        id: 'fix-time-3y',
        label: '+ 看未来三年流年趋势',
        appendText: '并结合未来三年流年大运节奏给出阶段性规划',
        patch: { timeHorizon: '长期走向' },
      });
    }
  }

  const finalScore = Math.min(100, score);
  const level: QuestionQualityReport['level'] =
    finalScore >= 85 ? 'rich' : finalScore >= 65 ? 'good' : 'brief';
  const hint =
    fixes.length > 0
      ? '本地助手检测到可补充背景，点选下方胶囊可让 AI 回复更切中你的现状'
      : undefined;

  return {
    score: finalScore,
    level,
    hint,
    quickFixes: fixes.slice(0, 3),
  };
}

/**
 * 本地 Agent 完整规划入口（异步动态懒加载 395KB 分类器权重，不阻塞首屏打包）。
 */
export async function runLocalAgentPlan(
  query: string,
  options?: Omit<RouterInput, 'query'> & { referenceYear?: number },
): Promise<LocalAgentPlan> {
  const cleanQuery = query.trim();
  const extracted = extractBirthProfiles(cleanQuery);
  const effectiveQuestion = extracted.question ?? cleanQuery;

  // 自动根据提取到的生辰信息补全 birthTimeStatus，提高路由准确度
  const inferredBirthTimeStatus: RouterInput['birthTimeStatus'] =
    options?.birthTimeStatus ??
    (extracted.profiles.length > 0
      ? extracted.profiles.every((p) => p.timeIndex !== 'unknown')
        ? 'exact'
        : 'unknown'
      : undefined);

  // 动态按需加载权重和推理引擎，避免打入首屏主包
  const [
    { METHOD_LABELS, recommendMethods },
    { detectExplicitDivinationIntent },
    { EXCLUDED_ROUTER_METHODS, loadLocalRouterDefaults, loadLocalRouterDisabledMethods },
  ] = await Promise.all([
    import('./index'),
    import('./features'),
    import('./local-preferences'),
  ]);
  const storedDefaults = loadLocalRouterDefaults();
  const preferredChart =
    options?.preferredChart !== undefined ? options.preferredChart : storedDefaults.preferredChart;
  const preferredDivination =
    options?.preferredDivination !== undefined
      ? options.preferredDivination
      : storedDefaults.preferredDivination;
  const disabledMethods = [
    ...new Set<MethodId>([
      ...EXCLUDED_ROUTER_METHODS,
      ...(options?.disabledMethods !== undefined
        ? options.disabledMethods
        : loadLocalRouterDisabledMethods()),
    ]),
  ];
  const disabledSet = new Set<MethodId>(disabledMethods);
  const routingInputQuery =
    extracted.profiles.length > 0 && extracted.question
      ? `${extracted.profiles.map((p) => p.summary).join('；')}。${extracted.question}`
      : cleanQuery;

  const rawRouting = recommendMethods({
    query: routingInputQuery,
    birthTimeStatus: inferredBirthTimeStatus,
    depthPref: options?.depthPref,
    traditionPref: options?.traditionPref,
    preferredChart,
    preferredDivination,
    disabledMethods,
  });

  const promoteMethod = (
    list: RouterResult['recommendations'],
    target: MethodId,
    reason: string,
  ): RouterResult['recommendations'] => {
    const existing = list.find((r) => r.method === target);
    const promoted = existing ?? {
      method: target,
      label: METHOD_LABELS[target] ?? target,
      confidence: 0.92,
      reason,
      missingInfoHint: '',
      calibrationSuggested: false,
    };
    return [promoted, ...list.filter((r) => r.method !== target)].slice(0, 3);
  };

  let recommendations = rawRouting.recommendations;
  const st = extracted.structured;

  // 纠偏 1：若没有四柱干支也未点名「四柱反推」，禁止误推 bazi-reverse
  if (
    recommendations[0]?.method === 'bazi-reverse' &&
    !st.hasFourPillarsGanzhi &&
    st.explicitMethod !== 'bazi-reverse'
  ) {
    recommendations = recommendations.filter((r) => r.method !== 'bazi-reverse');
  }

  // 纠偏 2：用户明确点名了某个术数（如「紫微斗数」「西洋星盘」「六爻」「塔罗」「太乙神数」），即使在自动路由中关闭，点名时仍 100% 尊重（已永久移除项除外）
  if (st.explicitMethod && !EXCLUDED_ROUTER_METHODS.includes(st.explicitMethod)) {
    recommendations = promoteMethod(
      recommendations,
      st.explicitMethod,
      `已按你明确指定的「${METHOD_LABELS[st.explicitMethod] ?? st.explicitMethod}」定位。`,
    );
  }
  // 纠偏 3：提取出双人生辰，优先合盘
  else if (extracted.profiles.length >= 2) {
    const first = recommendations[0]?.method;
    if (first !== 'bazi-synastry' && first !== 'ziwei-synastry' && first !== 'astrolabe-synastry') {
      const targetSynastry = (
        ['bazi-synastry', 'ziwei-synastry', 'astrolabe-synastry'] as MethodId[]
      ).find((m) => !disabledSet.has(m));
      if (targetSynastry) {
        recommendations = promoteMethod(
          recommendations,
          targetSynastry,
          `已识别双方完整生辰资料，优先使用「${METHOD_LABELS[targetSynastry] ?? targetSynastry}」对比契合度与流年。`,
        );
      }
    }
  }
  // 纠偏 4：提取出手机号 / 车牌号且无生辰信息，优先数字能量
  else if (st.numberEnergy && extracted.profiles.length === 0 && !disabledSet.has('number-energy')) {
    recommendations = promoteMethod(
      recommendations,
      'number-energy',
      `已识别号码「${st.numberEnergy}」，直接进入数字能量磁场推演。`,
    );
  }
  // 纠偏 5：提取出单人明确生辰且未问起名/测名/明确起卦占卜，优先用户设定的默认排盘（未设则尊重命盘排序）
  else if (
    extracted.profiles.length === 1 &&
    !extracted.isTwoPerson &&
    !detectExplicitDivinationIntent(cleanQuery) &&
    !/(?:四柱反推|反推日期|起名|取名|测名|改名)/.test(effectiveQuestion)
  ) {
    const first = recommendations[0]?.method;
    const natalCandidates: MethodId[] = [
      'bazi',
      'ziwei',
      'bazi-ziwei',
      'astrolabe',
      'qizheng',
      'minglu',
      'qimen-lifetime',
    ];
    const isNatal = first !== undefined && natalCandidates.includes(first);
    const activePreferredChart =
      preferredChart && !disabledSet.has(preferredChart) ? preferredChart : null;
    const targetNatal =
      activePreferredChart ?? natalCandidates.find((m) => !disabledSet.has(m)) ?? null;
    if (targetNatal && (!isNatal || (activePreferredChart && first !== activePreferredChart))) {
      recommendations = promoteMethod(
        recommendations,
        targetNatal,
        `已识别完整生辰资料，优先使用「${METHOD_LABELS[targetNatal] ?? targetNatal}」。`,
      );
    }
  }

  const routing: RouterResult = { ...rawRouting, recommendations };

  const primaryMethod = routing.recommendations[0]?.method;
  const analysis = analyzeUserQuery(effectiveQuestion, {
    method: primaryMethod,
    referenceYear: options?.referenceYear,
    birthYear: extracted.profiles[0]?.year,
    partnerBirthYear: extracted.profiles[1]?.year,
  });
  analysis.extractedBirth = extracted;

  const mode = extracted.isTwoPerson
    ? 'compatibility'
    : primaryMethod &&
        ['bazi-synastry', 'ziwei-synastry', 'astrolabe-synastry'].includes(primaryMethod)
      ? 'compatibility'
      : 'personal';

  const quality = inspectQuestionQuality(effectiveQuestion, {
    method: primaryMethod,
    mode,
    relationship: extracted.relationship,
  });

  return {
    query: effectiveQuestion,
    routing,
    analysis,
    quality,
  };
}
