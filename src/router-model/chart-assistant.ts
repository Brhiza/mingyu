import type { Method } from '../method-meta';
import type { SynastryRelationship } from '../systems/focus-presets';
import {
  PROMPT_FRAMEWORKS,
  detectDomain,
  selectPromptFramework,
  type FrameworkId,
} from './frameworks';
import type { MethodId } from './index';

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
 * 基于已知术数方法与问题文本轻量推荐解读框架（不触发城市表或生辰提取解析）。
 */
export function recommendFrameworkForMethod(
  rawQuery: string,
  method: Method | MethodId,
): FrameworkId {
  const query = rawQuery.trim();
  const targetMethod = method as MethodId;
  const domain = detectDomain(query, targetMethod);
  return selectPromptFramework({ query }, targetMethod, domain).id;
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
    if (method === 'bazi-ziwei' && asStr(data.kind) === 'multi-hecan') {
      const computedSystems = asArr(data.computedSystems)
        .map(asStr)
        .filter((x): x is string => Boolean(x));
      const chartsObj = asRec(data.charts);
      const systemLabelMap: Record<string, string> = {
        bazi: '八字',
        ziwei: '紫微',
        astrolabe: '星盘',
        qizheng: '七政',
        'qimen-lifetime': '奇门终身',
        bazhai: '八宅',
      };
      const selectedLabelText = computedSystems.map((id) => systemLabelMap[id] ?? id).join('、');

      if (computedSystems.length >= 2) {
        out.push({
          id: 'hecan-resonance',
          label: '对比各体系的强共振与分歧点',
          question: `请结合本次纳入的「${selectedLabelText}」多套盘面，先提炼跨体系一致指向的核心优势与性格底色，再重点拆解互相矛盾或需要现实核验的张力点。`,
          reason: '多术数合参核心互证',
        });
      }

      if (computedSystems.includes('bazi')) {
        const baziEntry = asRec(chartsObj?.bazi);
        const baziChart = asRec(baziEntry?.chart) ?? baziEntry;
        const usefulGod = asRec(baziChart?.usefulGod);
        const fav = asArr(usefulGod?.favorableWuxing).map(asStr).filter(Boolean);
        const located = asRec(baziEntry?.located);
        const flowYear = asNum(data.flowYear) ?? asNum(located?.flowYear) ?? currentYear;
        if (fav.length > 0) {
          out.push({
            id: 'hecan-bazi-useful',
            label: `喜用「${fav.join('、')}」怎么在生活中落地？`,
            question: `结合八字喜用神「${fav.join('、')}」与其他已选术数的倾向，给出行业选择、发展方位与日常决策的具体落地建议。`,
            reason: '结合八字喜用神与多盘合参',
          });
        }
        out.push({
          id: `hecan-year-${flowYear}`,
          label: `${flowYear}年多体系流年节奏对照`,
          question: `请合参 ${flowYear} 年的流年岁运与行限引动，说明今年事业、财务与感情上最适合发力的窗口与避坑重点。`,
          targetYear: flowYear,
          reason: '多体系流年节点对照',
        });
      }

      if (computedSystems.includes('ziwei')) {
        out.push({
          id: 'hecan-ziwei-sihua',
          label: '紫微四化与其他体系如何互相印证？',
          question: '请重点拆解紫微生年四化与宫干飞星的吉凶落点，并与其余已选术数中的事业/财帛/感情主线对照印证。',
          reason: '紫微四化跨盘对照',
        });
      }

      if (computedSystems.includes('astrolabe') || computedSystems.includes('qizheng')) {
        out.push({
          id: 'hecan-astro-phases',
          label: '星盘/七政的相位与星度补充了什么？',
          question: '西洋星盘或七政四余在心理动机、人际互动与阶段行运上，补充了哪些东方命理未明说的新视角？',
          reason: '星象与命理交叉验证',
        });
      }

      if (computedSystems.includes('qimen-lifetime')) {
        out.push({
          id: 'hecan-qimen-stage',
          label: '奇门终身局的阶段节奏与用神落宫',
          question: '请结合奇门终身局的值符值使与用神落宫，补充分析当前人生阶段的主导态势与进退策略。',
          reason: '奇门终身局阶段补全',
        });
      }

      if (computedSystems.includes('bazhai')) {
        out.push({
          id: 'hecan-bazhai-dir',
          label: '八宅命卦方位怎么配合命局喜用？',
          question: '请结合八宅命卦的生气/延年/天医吉方，以及其余已选术数的五行能量倾向，给出居家工位与床位朝向的实用建议。',
          reason: '八宅空间方位落地',
        });
      }

      return out.slice(0, 4);
    }

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
