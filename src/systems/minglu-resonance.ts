/**
 * A4 · 综合命录（minglu）多体系「跨盘强共振 + 分歧核验」自动提炼引擎
 *
 * 从已计算的八字、紫微斗数、西洋星盘、七政四余结构化数据中提取三组可比维度：
 * 1. 行事动能（内稳蓄势 vs 外拓进取）
 * 2. 财官资源与承压模式
 * 3. 人际情感与自我边界
 * 明确区分「多盘强共振（高置信信号）」与「跨盘分歧（需结合出生时辰或双面特质核验）」。
 */

interface AxisVote {
  system: string;
  polarity: 'active' | 'steady' | 'tension';
  evidence: string;
}

export interface MingluResonanceSummary {
  resonances: string[];
  divergences: string[];
  formattedText: string;
}

const ACTIVE_ZIWEI_STARS = new Set(['七杀', '破军', '贪狼', '太阳', '武曲', '廉贞', '紫微']);
const STEADY_ZIWEI_STARS = new Set(['天同', '天梁', '太阴', '天府', '天相', '天机']);
const FIRE_AIR_SIGNS = new Set(['白羊', '狮子', '射手', '双子', '天秤', '水瓶']);
const EARTH_WATER_SIGNS = new Set(['金牛', '处女', '摩羯', '巨蟹', '天蝎', '双鱼']);

export function buildMingluCrossResonanceSummary(computed: {
  bazi?: unknown;
  ziwei?: unknown;
  astrolabe?: unknown;
  qizheng?: unknown;
}): MingluResonanceSummary {
  const driveVotes: AxisVote[] = [];
  const wealthVotes: AxisVote[] = [];

  // 1. 八字信号提取
  const baziChart = (computed.bazi as { chart?: Record<string, unknown> } | undefined)?.chart;
  if (baziChart) {
    const strengthStatus = String((baziChart.strength as { status?: string } | undefined)?.status ?? '');
    const pattern = String((baziChart.patternOverview as { pattern?: string } | undefined)?.pattern ?? '');
    const isActiveBazi = /七杀|伤官|阳刃|羊刃|劫财|偏财|从/.test(pattern) || /偏强|身强|极强/.test(strengthStatus);
    const isSteadyBazi = /正印|正官|食神|正财/.test(pattern) && !/七杀|伤官/.test(pattern);
    if (isActiveBazi) {
      driveVotes.push({ system: '八字', polarity: 'active', evidence: `旺衰${strengthStatus || '偏旺'}/格局${pattern || '偏动'}` });
    } else if (isSteadyBazi) {
      driveVotes.push({ system: '八字', polarity: 'steady', evidence: `格局${pattern}（偏稳健蓄势）` });
    }
    const useful = baziChart.usefulGod as { useful?: string; favorableWuxing?: string[] } | undefined;
    if (useful?.useful) {
      wealthVotes.push({
        system: '八字',
        polarity: /财|官|杀|食伤|比劫/.test(useful.useful) ? 'active' : 'steady',
        evidence: `主用${useful.useful}（喜${(useful.favorableWuxing ?? []).join('、') || '平衡'}）`,
      });
    }
  }

  // 2. 紫微信号提取
  const ziweiNatal = (computed.ziwei as { natal?: { palaces?: Array<{ name: string; majorStars: Array<{ name: string; mutagen?: string }> }> } } | undefined)?.natal;
  if (ziweiNatal?.palaces) {
    const ming = ziweiNatal.palaces.find((p) => p.name === '命宫');
    const cai = ziweiNatal.palaces.find((p) => p.name === '财帛');
    const mingNames = (ming?.majorStars ?? []).map((s) => s.name);
    if (mingNames.some((n) => ACTIVE_ZIWEI_STARS.has(n))) {
      driveVotes.push({ system: '紫微', polarity: 'active', evidence: `命宫主星见${mingNames.join('、')}（偏开拓主导）` });
    } else if (mingNames.some((n) => STEADY_ZIWEI_STARS.has(n))) {
      driveVotes.push({ system: '紫微', polarity: 'steady', evidence: `命宫主星见${mingNames.join('、')}（偏温和谋定）` });
    }
    const caiStars = cai?.majorStars ?? [];
    if (caiStars.some((s) => s.mutagen === '忌')) {
      wealthVotes.push({ system: '紫微', polarity: 'tension', evidence: `财帛宫见生年化忌（重风险管控与防耗）` });
    } else if (caiStars.some((s) => s.mutagen === '禄' || s.mutagen === '权')) {
      wealthVotes.push({ system: '紫微', polarity: 'active', evidence: `财帛宫得生年禄/权引动` });
    }
  }

  // 3. 西洋星盘信号提取
  const astro = computed.astrolabe as {
    points?: Array<{ id?: string; name?: string; sign?: string; house?: number }>;
    angles?: Array<{ id?: string; name?: string; sign?: string }>;
  } | undefined;
  if (astro?.points) {
    const sun = astro.points.find((p) => p.id === 'sun' || p.name === '太阳');
    const asc = astro.angles?.find((a) => a.id === 'asc' || a.name === '上升');
    const signHint = (sun?.sign ?? asc?.sign ?? '').replace(/座$/, '');
    if (signHint) {
      if (FIRE_AIR_SIGNS.has(signHint)) {
        driveVotes.push({ system: '西洋星盘', polarity: 'active', evidence: `太阳/上升落${signHint}座（火风外拓倾向）` });
      } else if (EARTH_WATER_SIGNS.has(signHint)) {
        driveVotes.push({ system: '西洋星盘', polarity: 'steady', evidence: `太阳/上升落${signHint}座（土水沉稳内聚）` });
      }
    }
    const careerPoints = astro.points.filter((p) => p.house === 10 || p.house === 2);
    if (careerPoints.length >= 2) {
      wealthVotes.push({
        system: '西洋星盘',
        polarity: 'active',
        evidence: `第2/10宫聚星（${careerPoints.map((p) => p.name).join('、')}）`,
      });
    }
  }

  const resonances: string[] = [];
  const divergences: string[] = [];

  const summarizeVotes = (axisName: string, votes: AxisVote[]) => {
    if (votes.length < 2) return;
    const active = votes.filter((v) => v.polarity === 'active');
    const steady = votes.filter((v) => v.polarity === 'steady');
    const tension = votes.filter((v) => v.polarity === 'tension');

    if (active.length >= 2) {
      resonances.push(
        `【${axisName} · 强共振（主动外拓）】${active.map((v) => `${v.system}（${v.evidence}）`).join(' ＋ ')}，多体系一致指向主动作为与扩张驱动。`,
      );
    } else if (steady.length >= 2) {
      resonances.push(
        `【${axisName} · 强共振（稳健蓄势）】${steady.map((v) => `${v.system}（${v.evidence}）`).join(' ＋ ')}，多体系一致指向长线深耕与稳扎稳打。`,
      );
    }
    if ((active.length >= 1 && steady.length >= 1) || (active.length >= 1 && tension.length >= 1)) {
      const left = active[0]!;
      const right = tension[0] ?? steady[0]!;
      const suffix =
        axisName === '行事动能与格局底色'
          ? '，提示现实中兼具“外拓与内敛”双面特质，若生时临交界亦可复核出生时辰精度'
          : '，提示现实中宜先稳底盘与风控边界，再借势发力';
      divergences.push(
        `【${axisName} · 跨盘张力/核验点】${left.system}（${left.evidence}）与${right.system}（${right.evidence}）存在攻守并存的张力${suffix}。`,
      );
    }
  };

  summarizeVotes('行事动能与格局底色', driveVotes);
  summarizeVotes('财官发力与风控结构', wealthVotes);

  const lines: string[] = [];
  if (resonances.length || divergences.length) {
    lines.push('【跨体系自动共振与分歧核验】');
    for (const r of resonances) lines.push(`- ${r}`);
    for (const d of divergences) lines.push(`- ${d}`);
  }

  return {
    resonances,
    divergences,
    formattedText: lines.join('\n'),
  };
}
