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

export interface ChartFollowUpSuggestion {
  id: string;
  label: string;
  question: string;
  /** 可选附带的目标流年（合盘/单盘点击后可联动切换流年） */
  targetYear?: number;
  /** 可选附带的多年同步预设 */
  syncYearsPreset?: 'next3' | 'next5';
  reason: string;
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
    mode?: 'personal' | 'compatibility' | 'divination';
    relationship?: SynastryRelationship;
    hasLifeStage?: boolean;
    hasTimeHorizon?: boolean;
  },
): QuestionQualityReport {
  const q = rawQuestion.trim();
  const mode = options?.mode ?? 'personal';
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

type UnknownRecord = Record<string, unknown>;
function asRec(v: unknown): UnknownRecord | undefined {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as UnknownRecord) : undefined;
}
function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asStr(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}
function asNum(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/**
 * 基于已排出的真实盘面数据，纯本地生成 3~4 个高度定制的智能追问建议。
 */
export function generateChartFollowUps(
  method: Method,
  result: { data?: unknown; summary?: unknown } | null | undefined,
  options?: {
    relationship?: SynastryRelationship;
    currentYear?: number;
  },
): ChartFollowUpSuggestion[] {
  const data = asRec(result?.data);
  if (!data) return [];
  const currentYear = options?.currentYear ?? new Date().getFullYear();
  const out: ChartFollowUpSuggestion[] = [];

  if (method === 'bazi-synastry') {
    const input = asRec(data.input);
    const p1Name = asStr(asRec(input?.person1)?.name) ?? '命主一';
    const p2Name = asStr(asRec(input?.person2)?.name) ?? '命主二';
    const compat = asRec(data.compatibility);
    const spouseDeep = asRec(compat?.spousePalaceDeep);
    const balance = asRec(compat?.synastryBalance);
    const fc = asRec(compat?.fortuneComparison);
    const annualSync = asRec(compat?.annualSync);
    const syncYears = asArr(annualSync?.years)
      .map(asRec)
      .filter((x): x is UnknownRecord => Boolean(x));

    // 1. 若多年同步中存在“同步承压”或“同向顺遂”的具体年份，优先生成精确年份追问
    const pressureYear = syncYears.find((y) => asStr(y.syncAssessment) === '同步承压');
    const smoothYear = syncYears.find((y) => asStr(y.syncAssessment) === '同向顺遂');
    if (pressureYear && asNum(pressureYear.year)) {
      const yr = asNum(pressureYear.year)!;
      const gz = asStr(pressureYear.yearGanZhi) ?? '';
      out.push({
        id: `bazi-syn-pressure-${yr}`,
        label: `${yr} ${gz}年同步承压怎么避坑？`,
        question: `盘面显示 ${yr} ${gz}年双方流年同步承压，请具体分析这一年最容易爆发的矛盾点与提前化解策略。`,
        targetYear: yr,
        reason: '基于多年流年同步中识别到的承压年份',
      });
    }
    if (smoothYear && asNum(smoothYear.year)) {
      const yr = asNum(smoothYear.year)!;
      const gz = asStr(smoothYear.yearGanZhi) ?? '';
      out.push({
        id: `bazi-syn-smooth-${yr}`,
        label: `${yr} ${gz}年顺遂窗口适合推进什么？`,
        question: `${yr} ${gz}年双方流年同向顺遂，这一年最适合推进哪些重要决定（如订婚结婚、共同置业或深化合作）？`,
        targetYear: yr,
        reason: '基于多年流年同步中识别到的同频上升年份',
      });
    }

    // 2. 用神互补方向追问
    const usefulDir = asStr(balance?.usefulDirection);
    if (usefulDir) {
      out.push({
        id: 'bazi-syn-useful',
        label: `细看「${usefulDir}」的日常互补`,
        question: `结合双方八字「${usefulDir}」的喜用神格局，具体说明 ${p1Name} 与 ${p2Name} 在日常相处、财务与情绪上谁更滋养谁，如何放大彼此优势？`,
        reason: '基于双方用神互补评估',
      });
    }

    // 3. 夫妻宫深层互动
    const spouseTag = asStr(spouseDeep?.level) ?? asStr(spouseDeep?.summary);
    if (spouseTag) {
      out.push({
        id: 'bazi-syn-spouse',
        label: '夫妻宫合冲与磨合底线',
        question: `请结合双方日柱夫妻宫的合冲刑害特征，指出两人最容易踩雷的沟通盲区以及可落地的相处底线。`,
        reason: '基于日柱夫妻宫深层关系',
      });
    }

    // 4. 若尚未开启多年同步，引导一键开启未来 5 年流年同步
    if (syncYears.length === 0) {
      out.push({
        id: 'bazi-syn-open-5y',
        label: `对比未来 5 年（${currentYear}–${currentYear + 4}）流年同步`,
        question: `请逐年对比 ${p1Name} 与 ${p2Name} 在 ${currentYear} 至 ${currentYear + 4} 年的大运流年同步性，标出关系升温年与需要谨慎沟通的年份。`,
        syncYearsPreset: 'next5',
        reason: '快速展开双人多年流年同步走势',
      });
    } else if (fc) {
      out.push({
        id: 'bazi-syn-dayun-cross',
        label: '当前大运步调是否同频？',
        question: `结合双方当前大运干支及跨盘互动关系，分析未来几年两人的人生重心与成长步调是否同步。`,
        reason: '基于当前大运交互分析',
      });
    }

    return out.slice(0, 4);
  }

  if (method === 'ziwei-synastry') {
    const selected = asRec(data.selected);
    const evidence = asRec(selected?.evidence);
    const crossMutagens = asArr(evidence?.crossMutagens).map(asRec).filter((x): x is UnknownRecord => Boolean(x));
    const annualSync = asRec(data.annualSync);
    const syncYears = asArr(annualSync?.years).map(asRec).filter((x): x is UnknownRecord => Boolean(x));

    const jiHit = crossMutagens.find((m) => asStr(m.mutagen) === '忌');
    if (jiHit) {
      out.push({
        id: 'zw-syn-ji',
        label: `化解${asStr(jiHit.star) ?? ''}化忌入${asStr(jiHit.targetPalace) ?? ''}`,
        question: `盘面中出现${asStr(jiHit.star) ?? ''}化忌飞入对方${asStr(jiHit.targetPalace) ?? ''}，请具体拆解这在现实相处中会表现为怎样的执念或摩擦，如何温和化解？`,
        reason: '基于跨盘化忌落宫事实',
      });
    }

    const luHit = crossMutagens.find((m) => asStr(m.mutagen) === '禄');
    if (luHit) {
      out.push({
        id: 'zw-syn-lu',
        label: `放大${asStr(luHit.star) ?? ''}化禄的加分项`,
        question: `结合${asStr(luHit.star) ?? ''}化禄入对方${asStr(luHit.targetPalace) ?? ''}的跨盘助力，分析双方最容易互相成就的领域和相处方式。`,
        reason: '基于跨盘化禄落宫事实',
      });
    }

    const sameBranchYr = syncYears.find((y) => Boolean(asRec(y.yearlyOverlap)?.sameBranch));
    if (sameBranchYr && asNum(sameBranchYr.year)) {
      const yr = asNum(sameBranchYr.year)!;
      out.push({
        id: `zw-syn-overlap-${yr}`,
        label: `${yr}年流年同支有什么重要契机？`,
        question: `${yr}年双方紫微流年落于同支宫位，这一年在感情/合作上会有哪些重要转折或共振事件？`,
        targetYear: yr,
        reason: '基于多年大限流年同步中的流年同支年份',
      });
    } else if (syncYears.length === 0) {
      out.push({
        id: 'zw-syn-open-5y',
        label: `看未来 5 年（${currentYear}–${currentYear + 4}）大限流年`,
        question: `请结合 ${currentYear} 至 ${currentYear + 4} 年双方大限与流年四化走势，分析这段时间的关系起伏与关键节点。`,
        syncYearsPreset: 'next5',
        reason: '快速展开紫微多年大限流年同步',
      });
    }

    return out.slice(0, 4);
  }

  if (method === 'astrolabe-synastry') {
    const aspects = asArr(data.aspects).map(asRec).filter((x): x is UnknownRecord => Boolean(x));
    const hardAspect = aspects.find((a) => asStr(a.type) === 'square' || asStr(a.type) === 'opposition');
    const softAspect = aspects.find((a) => asStr(a.type) === 'conjunction' || asStr(a.type) === 'trine');
    const annualSync = asRec(data.annualSync);
    const syncYears = asArr(annualSync?.years).map(asRec).filter((x): x is UnknownRecord => Boolean(x));

    if (softAspect) {
      out.push({
        id: 'astro-syn-soft',
        label: `解读${asStr(softAspect.person1Name) ?? ''}${asStr(softAspect.label) ?? ''}${asStr(softAspect.person2Name) ?? ''}`,
        question: `请深入解读跨盘中的「${asStr(softAspect.person1Name) ?? ''}${asStr(softAspect.label) ?? ''}${asStr(softAspect.person2Name) ?? ''}」相位，它给两人带来了怎样的吸引力与默契？`,
        reason: '基于跨盘核心和谐/合相相位',
      });
    }
    if (hardAspect) {
      out.push({
        id: 'astro-syn-hard',
        label: `化解${asStr(hardAspect.person1Name) ?? ''}${asStr(hardAspect.label) ?? ''}${asStr(hardAspect.person2Name) ?? ''}`,
        question: `跨盘中存在「${asStr(hardAspect.person1Name) ?? ''}${asStr(hardAspect.label) ?? ''}${asStr(hardAspect.person2Name) ?? ''}」紧张相位，日常沟通中最容易在什么场景起冲突？如何转化？`,
        reason: '基于跨盘紧张刑冲相位',
      });
    }
    if (asRec(data.composite)) {
      out.push({
        id: 'astro-syn-composite',
        label: '中点组合盘看长期关系本质',
        question: `结合双方的中点组合盘，分析这段关系对外呈现的气质、长期共同目标以及最需要经营的课题。`,
        reason: '基于中点组合盘数据',
      });
    }
    if (syncYears.length === 0) {
      out.push({
        id: 'astro-syn-open-5y',
        label: `看未来 5 年（${currentYear}–${currentYear + 4}）外行星行运`,
        question: `请结合 ${currentYear} 至 ${currentYear + 4} 年外行星对双方本命盘的同步行运引动，指出关系最关键的考验期与升温期。`,
        syncYearsPreset: 'next5',
        reason: '快速展开双人多年外行星行运同步',
      });
    }
    return out.slice(0, 4);
  }

  if (method === 'bazi' || method === 'bazi-ziwei') {
    const chart = asRec(data.chart) ?? asRec(asRec(data.charts)?.bazi);
    const usefulGod = asRec(chart?.usefulGod);
    const fav = asArr(usefulGod?.favorableWuxing).map(asStr).filter(Boolean);
    const located = asRec(data.located);
    const flowYear = asNum(located?.flowYear) ?? currentYear;
    const cycle = asRec(located?.cycle);

    if (fav.length > 0) {
      out.push({
        id: 'bazi-useful',
        label: `喜用「${fav.join('、')}」怎么在生活中落地？`,
        question: `我的八字喜用神偏重「${fav.join('、')}」，请从行业赛道选择、发展方位与日常决策习惯上给出具体可落地的建议。`,
        reason: '基于原局裁定喜用五行',
      });
    }
    if (asStr(cycle?.ganZhi)) {
      out.push({
        id: 'bazi-dayun',
        label: `深挖当前「${asStr(cycle?.ganZhi)}」大运主线`,
        question: `请重点拆解我当前所处的「${asStr(cycle?.ganZhi)}」十年大运，这十年最适合主攻事业、攒钱还是稳守沉淀？`,
        reason: '基于当前所处大运干支',
      });
    }
    out.push(
      {
        id: `bazi-year-${flowYear}`,
        label: `${flowYear}年流年机会与避坑月份`,
        question: `请结合 ${flowYear} 年流年干支与原局的刑冲合害，指出今年最适合发力的季度/月份，以及需要重点防守的风险。`,
        targetYear: flowYear,
        reason: '基于当前参考流年',
      },
      {
        id: `bazi-next-year-${flowYear + 1}`,
        label: `提前看 ${flowYear + 1} 年走势变化`,
        question: `对比 ${flowYear} 年与 ${flowYear + 1} 年的流年切换，明年在事业、财务与感情上会有哪些明显转折？`,
        targetYear: flowYear + 1,
        reason: '前瞻下一年流年节奏',
      },
    );
    return out.slice(0, 4);
  }

  if (method === 'ziwei') {
    out.push(
      {
        id: 'zw-sanfang',
        label: '命宫三方四正与核心天赋',
        question: '请结合命宫、财帛、官禄与迁移宫的三方四正星曜组合，总结我最核心的竞争优势与容易内耗的短板。',
        reason: '紫微本命核心架构',
      },
      {
        id: 'zw-sihua',
        label: '生年四化与宫干飞星落点',
        question: '重点拆解我盘面的生年四化（禄权科忌）以及流年四化飞入，指出今年最值得把握的机遇宫位与需防化忌的领域。',
        reason: '紫微四化动态引动',
      },
      {
        id: 'zw-decadal',
        label: '当前大限十年重心规划',
        question: '结合当前大限命宫及三方四正变化，说明这十年的人生主线与最适合发力的方向。',
        reason: '紫微大限运势规划',
      },
    );
    return out;
  }

  if (method === 'liuyao' || method === 'meihua' || method === 'qimen' || method === 'liuren') {
    out.push(
      {
        id: 'div-timing',
        label: '这件事的关键应期在什么时候？',
        question: '请结合盘面的旺衰、动变与空亡/旬空，明确推演这件事最可能见分晓或出现转机的具体时间节点（应期）。',
        reason: '占卜核心应期定位',
      },
      {
        id: 'div-action',
        label: '我当下最稳妥的行动策略是什么？',
        question: '针对目前盘面显示的阻力与助力，我接下来应该主动推进、以静制动还是调整方案？请给出 3 条可执行建议。',
        reason: '从卦象落到现实行动',
      },
      {
        id: 'div-risk',
        label: '最需要防范的隐藏变量是什么？',
        question: '盘面中是否存在容易被忽视的暗动、忌神或第三方干扰因素？我该如何提前规避？',
        reason: '排查盘面潜在风险',
      },
    );
    return out;
  }

  return [];
}

/**
 * 格式化指定解读框架为可直接附加到提示词的中文结构要求。
 */
export function formatFrameworkPromptBlock(frameworkId: FrameworkId): string {
  const fw = PROMPT_FRAMEWORKS[frameworkId];
  if (!fw) return '';
  return `【指定解读框架：${fw.name}】\n${fw.template}`;
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
