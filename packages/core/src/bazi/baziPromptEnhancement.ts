/**
 * AI 提示词增强模块
 * 整合病药法、通关法、经典格局与可由盘面证明的传统旁证。
 */

import type { BaziChartResult } from './baziTypes';
import { BASIC_MAPPINGS, SAN_HE_MAP, SAN_HUI_MAP } from './baziMappingsData';
import {
  identifyClassicPattern,
  getPeachBlossomDetail,
  generateAnalysisDimensionHints,
  detectDiseaseMedicine,
  detectTongguanNeed,
} from './baziEnhancement';
import { assessAllHarmonyTransforms } from './harmonyTransform';

type PillarKey = 'year' | 'month' | 'day' | 'hour';

const PILLAR_KEYS: PillarKey[] = ['year', 'month', 'day', 'hour'];
const PILLAR_LABELS: Record<PillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

function extractWuxingTokens(text: string | undefined): string[] {
  if (!text) return [];
  return Array.from(new Set(text.match(/[木火土金水]/g) || []));
}

function extractMedicineWuxingCandidates(medicine: string): string[] {
  const directionalMatches = Array.from(
    medicine.matchAll(/([木火土金水])(?:克|泄|调|润|暖|通)/g),
    (match) => match[1],
  );
  if (directionalMatches.length > 0) {
    return Array.from(new Set(directionalMatches));
  }
  return extractWuxingTokens(medicine);
}

function shouldIncludeDiseaseMedicineSection(
  medicine: string,
  unfavorableWuxing: string[],
): boolean {
  const medicineWuxings = extractMedicineWuxingCandidates(medicine);
  if (!medicineWuxings.length) return true;

  return !medicineWuxings.some((wuxing) => unfavorableWuxing.includes(wuxing));
}

function shouldIncludeTongguanSection(tongguan: string, unfavorableWuxing: string[]): boolean {
  const tongguanWuxings = extractWuxingTokens(tongguan);
  if (!tongguanWuxings.length) return true;
  return !tongguanWuxings.some((wuxing) => unfavorableWuxing.includes(wuxing));
}

function stripSectionTitle(text: string): string {
  return text.replace(/^【[^】]+】/, '').trim();
}

function buildEvidenceDrivenHintSection(title: string, evidence: string, baseHint: string): string {
  return `【${title}】${evidence}。${stripSectionTitle(baseHint)}`;
}

function formatClassicPatternMainClaim(claim: string): string {
  const normalized = claim.replace(/^人/, '');
  return `传统多取象为${normalized}，仍需结合原局成败与岁运同看。`;
}

function toClassicPatternPromptDescription(description: string): string {
  return description
    .replace(/主大富大贵。?/g, '传统多视为层次较高，仍需结合原局成败与岁运同看。')
    .replace(/主大贵。?/g, '传统多视为层次较高，仍需结合原局成败与岁运同看。')
    .replace(/主清贵富足。?/g, '传统多视为较有清气与发展空间，仍需结合原局成败与岁运同看。')
    .replace(/主清贵。?/g, '传统多视为较有清气与发展空间，仍需结合原局成败与岁运同看。')
    .replace(/主名利双收。?/g, '传统多视为较易兼顾名与利，仍需结合原局成败与岁运同看。')
    .replace(/主异路功名。?/g, '传统多视为发展路径有别于常规，仍需结合原局成败与岁运同看。')
    .replace(/因祸得福。?/g, '传统多视为在冲动与转折中仍可能藏有转机。')
    .replace(/财富丰厚。?/g, '传统多视为物质积累倾向较明显。')
    .replace(/多主([^。；]+)[。；]?/g, (_match, claim: string) =>
      formatClassicPatternMainClaim(claim),
    )
    .replace(
      /(^|[^日])主([^。；]+)[。；]?/g,
      (_match, prefix: string, claim: string) => `${prefix}${formatClassicPatternMainClaim(claim)}`,
    );
}

function getKongWangEvidence(chartResult: BaziChartResult): string[] {
  const dayKongWangBranches = chartResult.kongWang?.day || [];
  if (!dayKongWangBranches.length || !chartResult.pillars) return [];

  // 提示词只把日柱旬空作为主证，避免把神煞列表中的年空宽松口径写成强证据。
  return PILLAR_KEYS.filter((pillar) =>
    dayKongWangBranches.includes(chartResult.pillars[pillar].zhi),
  ).map((pillar) => PILLAR_LABELS[pillar]);
}

function analyzePillarRelations(chartResult: BaziChartResult): {
  fuxin: string[];
  fanyin: string[];
  xingChong: string[];
} {
  const fuxin = new Set<string>();
  const fanyin = new Set<string>();
  const xingChong = new Set<string>();
  const { pillars } = chartResult;

  if (!pillars) {
    return { fuxin: [], fanyin: [], xingChong: [] };
  }

  for (let i = 0; i < PILLAR_KEYS.length; i += 1) {
    for (let j = i + 1; j < PILLAR_KEYS.length; j += 1) {
      const leftKey = PILLAR_KEYS[i];
      const rightKey = PILLAR_KEYS[j];
      const left = pillars[leftKey];
      const right = pillars[rightKey];
      const leftLabel = PILLAR_LABELS[leftKey];
      const rightLabel = PILLAR_LABELS[rightKey];

      if (left.gan === right.gan && left.zhi === right.zhi) {
        fuxin.add(`${leftLabel}与${rightLabel}干支同为${left.ganZhi}`);
      } else {
        if (left.gan === right.gan) {
          fuxin.add(`${leftLabel}与${rightLabel}天干同为${left.gan}`);
        }
        if (left.zhi === right.zhi) {
          fuxin.add(`${leftLabel}与${rightLabel}地支同为${left.zhi}`);
        }
      }

      const stemChong = BASIC_MAPPINGS.TIAN_GAN_CHONG[left.gan] === right.gan;
      const branchChong = BASIC_MAPPINGS.DI_ZHI_CHONG[left.zhi] === right.zhi;

      if (stemChong && branchChong) {
        fanyin.add(`${leftLabel}${left.ganZhi}与${rightLabel}${right.ganZhi}成天克地冲`);
      }

      if (BASIC_MAPPINGS.TIAN_GAN_WU_HE[left.gan] === right.gan) {
        xingChong.add(`${leftLabel}${left.gan}与${rightLabel}${right.gan}合`);
      }
      if (stemChong) {
        xingChong.add(`${leftLabel}${left.gan}与${rightLabel}${right.gan}冲`);
      }
      if (BASIC_MAPPINGS.DI_ZHI_LIU_HE[left.zhi] === right.zhi) {
        xingChong.add(`${leftLabel}${left.zhi}与${rightLabel}${right.zhi}六合`);
      }
      if (branchChong) {
        xingChong.add(`${leftLabel}${left.zhi}与${rightLabel}${right.zhi}冲`);
      }
      if (BASIC_MAPPINGS.DI_ZHI_XING[left.zhi]?.includes(right.zhi)) {
        xingChong.add(`${leftLabel}${left.zhi}与${rightLabel}${right.zhi}刑`);
      }
      if (BASIC_MAPPINGS.DI_ZHI_HAI[left.zhi] === right.zhi) {
        xingChong.add(`${leftLabel}${left.zhi}与${rightLabel}${right.zhi}害`);
      }
      if (BASIC_MAPPINGS.DI_ZHI_PO[left.zhi] === right.zhi) {
        xingChong.add(`${leftLabel}${left.zhi}与${rightLabel}${right.zhi}破`);
      }
    }
  }

  const allBranches = PILLAR_KEYS.map((pillar) => pillars[pillar].zhi);
  for (const [name, branches] of Object.entries(SAN_HE_MAP)) {
    if (branches.every((branch) => allBranches.includes(branch))) {
      xingChong.add(`地支成${name}三合`);
    }
  }
  for (const [name, branches] of Object.entries(SAN_HUI_MAP)) {
    if (branches.every((branch) => allBranches.includes(branch))) {
      xingChong.add(`地支成${name}三会`);
    }
  }

  return {
    fuxin: Array.from(fuxin),
    fanyin: Array.from(fanyin),
    xingChong: Array.from(xingChong),
  };
}

/**
 * 生成经典格局分析片段
 */
function generateClassicPatternSection(chartResult: BaziChartResult): string {
  if (!chartResult.pillars) return '';

  const dayStem = chartResult.pillars.day.gan;
  const monthBranch = chartResult.pillars.month.zhi;

  const classicPattern = identifyClassicPattern(
    dayStem,
    monthBranch,
    chartResult.pillars,
    chartResult.hiddenStems,
    chartResult.analysis?.mingGe?.pattern,
  );

  if (!classicPattern) return '';

  return `【经典格局】${classicPattern.name}（传统等级参考：${classicPattern.level}，需复核成败） | ${toClassicPatternPromptDescription(classicPattern.description)}`;
}

/**
 * 生成桃花详解片段
 */
function generatePeachBlossomDetailSection(chartResult: BaziChartResult): string {
  const globalTaohua = chartResult.shensha?.global?.filter((s) => s.includes('桃花')) || [];
  const taohuaPillars = PILLAR_KEYS.filter((pillar) =>
    chartResult.shensha?.[pillar]?.some((s) => s.includes('桃花')),
  );

  if (!globalTaohua.length && !taohuaPillars.length) return '';

  const overview = globalTaohua.length
    ? globalTaohua.join('、')
    : taohuaPillars.map((pillar) => PILLAR_LABELS[pillar]).join('、');
  const lines = [`【桃花详解】命盘见桃花：${overview}`];

  for (const pillar of PILLAR_KEYS) {
    const pillarTaohua = chartResult.shensha?.[pillar]?.find((s) => s.includes('桃花'));
    if (pillarTaohua) {
      const d = getPeachBlossomDetail(pillar);
      lines.push(
        `${PILLAR_LABELS[pillar]}:${d.type} | ${d.description} | 提示:${d.favorable} | 留意:${d.unfavorable}`,
      );
    }
  }

  return lines.join('\n');
}

function generateFuxinSection(chartResult: BaziChartResult): string {
  const relations = analyzePillarRelations(chartResult);
  const evidences =
    relations.fuxin.length && relations.fanyin.length
      ? [...relations.fuxin, ...relations.fanyin]
      : relations.fuxin.length
        ? relations.fuxin
        : relations.fanyin;

  if (!evidences.length) return '';

  const evidenceLabel =
    relations.fuxin.length && relations.fanyin.length
      ? '命盘见伏吟、反吟'
      : relations.fuxin.length
        ? '命盘见伏吟'
        : '命盘见反吟';

  return buildEvidenceDrivenHintSection(
    '伏吟反吟',
    `${evidenceLabel}：${evidences.join('；')}`,
    generateAnalysisDimensionHints('fuxin'),
  );
}

function generateKongWangSection(chartResult: BaziChartResult): string {
  const kongWangPillars = getKongWangEvidence(chartResult);
  if (!kongWangPillars.length) return '';

  return buildEvidenceDrivenHintSection(
    '空亡详解',
    `命盘见空亡：${kongWangPillars.join('、')}`,
    generateAnalysisDimensionHints('kongwang'),
  );
}

function generateXingChongSection(chartResult: BaziChartResult): string {
  const relations = analyzePillarRelations(chartResult);
  if (!relations.xingChong.length) return '';

  return buildEvidenceDrivenHintSection(
    '刑冲合会破',
    `命盘见：${relations.xingChong.join('；')}`,
    generateAnalysisDimensionHints('xingchong'),
  );
}

function generateHarmonyTransformSection(chartResult: BaziChartResult): string {
  if (!chartResult.pillars) return '';

  const pillars = PILLAR_KEYS.map((pillar) => ({
    label: PILLAR_LABELS[pillar],
    gan: chartResult.pillars[pillar].gan,
    zhi: chartResult.pillars[pillar].zhi,
    hiddenStems: chartResult.hiddenStems?.[pillar] || [],
  }));
  const profiles = assessAllHarmonyTransforms(pillars, chartResult.pillars.month.zhi);

  if (!profiles.length) return '';

  const strongestProfiles = profiles
    .sort((a, b) => {
      if (a.isTransformed !== b.isTransformed) return a.isTransformed ? -1 : 1;
      return b.score - a.score;
    })
    .slice(0, 2);
  const evidence = strongestProfiles
    .map((profile) => {
      const scoreParts = [
        `月令${profile.monthSupport}`,
        `透干${profile.stemScore}`,
        `根气${profile.rootScore}`,
        profile.clashPenalty ? `冲破${profile.clashPenalty}` : '',
        profile.competitionPenalty ? `争合${profile.competitionPenalty}` : '',
      ].filter(Boolean);
      return `${profile.type}${profile.participants.join('与')}化${profile.transformElement}：${profile.level}${profile.score}分，方向${profile.direction}（${scoreParts.join('、')}）`;
    })
    .join('；');

  return buildEvidenceDrivenHintSection(
    '合化程度',
    `命盘见合化候选：${evidence}`,
    '【合化程度】合化评分只用于复核“合而能否化”的强弱，不替代日主旺衰、格局调候和正式喜忌。80分以下不得直接按成化处理，80分以上也要回扣月令、透干、根气、清杂、冲破和岁运触发。',
  );
}

/**
 * 生成增强分析片段。
 * 用户选择的分类只限定回答范围，不再决定本地资料包塞哪些专项模板。
 */
export function generateEnhancedAnalysisSection(
  chartResult: BaziChartResult,
  _topic: string = 'general',
): string {
  const sections: string[] = [];

  const wuxingCounts = chartResult.wuxingStrength?.percentages;
  if (wuxingCounts && chartResult.analysis?.mingGe) {
    const dm = detectDiseaseMedicine(
      wuxingCounts,
      chartResult.analysis.mingGe,
      chartResult.analysis.dayMasterStrength.status,
    );
    const unfavorableWuxing = chartResult.analysis?.usefulGod?.unfavorableWuxing || [];
    if (
      dm.hasDisease &&
      dm.medicine &&
      shouldIncludeDiseaseMedicineSection(dm.medicine, unfavorableWuxing)
    ) {
      sections.push(`【病药法】病:${dm.disease} | 药:${dm.medicine}`);
    }
  }

  const favorableWuxing = chartResult.analysis?.usefulGod?.favorableWuxing || [];
  const unfavorableWuxing = chartResult.analysis?.usefulGod?.unfavorableWuxing || [];
  if (wuxingCounts && favorableWuxing.length > 0) {
    const tg = detectTongguanNeed(wuxingCounts, favorableWuxing, unfavorableWuxing);
    if (
      tg.need &&
      tg.conflict &&
      tg.tongguan &&
      shouldIncludeTongguanSection(tg.tongguan, unfavorableWuxing)
    ) {
      sections.push(
        `【通关法】${tg.conflict[0]}与${tg.conflict[1]}相战，以${tg.tongguan}通关调和`,
      );
    }
  }

  const classicSection = generateClassicPatternSection(chartResult);
  if (classicSection) sections.push(classicSection);

  const taohuaSection = generatePeachBlossomDetailSection(chartResult);
  if (taohuaSection) sections.push(taohuaSection);

  const fuxinSection = generateFuxinSection(chartResult);
  if (fuxinSection) sections.push(fuxinSection);

  const kongWangSection = generateKongWangSection(chartResult);
  if (kongWangSection) sections.push(kongWangSection);

  const xingChongSection = generateXingChongSection(chartResult);
  if (xingChongSection) sections.push(xingChongSection);

  const harmonyTransformSection = generateHarmonyTransformSection(chartResult);
  if (harmonyTransformSection) sections.push(harmonyTransformSection);

  return sections.join('\n\n');
}
