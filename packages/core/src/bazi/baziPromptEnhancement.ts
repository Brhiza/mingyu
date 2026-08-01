/**
 * AI 提示词增强模块
 * 整合经典外格与可由盘面证明的传统旁证。
 */

import type { BaziChartResult } from './baziTypes';
import { BASIC_MAPPINGS, SAN_HE_MAP, SAN_HUI_MAP } from './baziMappingsData';
import { findCompleteSanxingGroups } from '../ganzhi/relations';
import { identifyClassicPattern } from './baziEnhancement/classicPatterns';
import { assessAllHarmonyTransforms, formatHarmonyTransformProfile } from './harmonyTransform';

type PillarKey = 'year' | 'month' | 'day' | 'hour';

const PILLAR_KEYS: PillarKey[] = ['year', 'month', 'day', 'hour'];
const PILLAR_LABELS: Record<PillarKey, string> = {
  year: '年柱',
  month: '月柱',
  day: '日柱',
  hour: '时柱',
};

function buildEvidenceDrivenHintSection(title: string, evidence: string): string {
  return `【${title}】${evidence}。`;
}

export function conditionBaziClassicPatternText(description: string): string {
  if (
    /主(?:大富大贵|大贵|清贵|名利双收|异路功名)|多主|因祸得福|财富丰厚|必(?:富|贵|贫|败)|定主|可期|堪图|可许/.test(
      description,
    )
  ) {
    return '未采用传统断语；当前只保留已校勘格名、命中条件与来源，待明确底本版本和适用口径后继续推算。';
  }
  return description;
}

function getKongWangEvidence(chartResult: BaziChartResult): string[] {
  const dayKongWangBranches = chartResult.kongWang?.day || [];
  if (!dayKongWangBranches.length || !chartResult.pillars) return [];

  // 提示词只把日柱旬空作为主证，避免把神煞列表中的年空宽松口径写成强证据。
  return PILLAR_KEYS.filter((pillar) =>
    dayKongWangBranches.includes(chartResult.pillars[pillar].zhi),
  ).map((pillar) => PILLAR_LABELS[pillar]);
}

export interface BaziPillarRelations {
  fuxin: string[];
  fanyin: string[];
  xingChong: string[];
}

export function analyzePillarRelations(
  chartResult: Pick<BaziChartResult, 'pillars'>,
): BaziPillarRelations {
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
      if (BASIC_MAPPINGS.DI_ZHI_HAI[left.zhi] === right.zhi) {
        xingChong.add(`${leftLabel}${left.zhi}与${rightLabel}${right.zhi}害`);
      }
      if (BASIC_MAPPINGS.DI_ZHI_PO[left.zhi] === right.zhi) {
        xingChong.add(`${leftLabel}${left.zhi}与${rightLabel}${right.zhi}破`);
      }
    }
  }

  const allBranches = PILLAR_KEYS.map((pillar) => pillars[pillar].zhi);
  const ziMaoPillars = PILLAR_KEYS.filter(
    (pillar) => pillars[pillar].zhi === '子' || pillars[pillar].zhi === '卯',
  );
  if (allBranches.includes('子') && allBranches.includes('卯')) {
    xingChong.add(
      `${ziMaoPillars.map((pillar) => `${PILLAR_LABELS[pillar]}${pillars[pillar].zhi}`).join('、')}构成子卯相刑固定支对`,
    );
  }
  for (const branch of ['辰', '午', '酉', '亥']) {
    const positions = PILLAR_KEYS.filter((pillar) => pillars[pillar].zhi === branch);
    if (positions.length < 2) continue;
    xingChong.add(
      `${positions.map((pillar) => `${PILLAR_LABELS[pillar]}${branch}`).join('、')}构成${branch}${branch}自刑固定结构`,
    );
  }
  for (const punishment of findCompleteSanxingGroups(allBranches)) {
    xingChong.add(
      `${punishment.members.join('、')}三支齐见，为${punishment.name}完整成员结构（不把任意两支自动命名相刑）`,
    );
  }
  for (const [name, branches] of Object.entries(SAN_HE_MAP)) {
    if (branches.every((branch) => allBranches.includes(branch))) {
      xingChong.add(`地支${branches.join('、')}为${name}三合所需三支齐见（不等于已经成局或合化）`);
    }
  }
  for (const [name, branches] of Object.entries(SAN_HUI_MAP)) {
    if (branches.every((branch) => allBranches.includes(branch))) {
      xingChong.add(`地支${branches.join('、')}为${name}三会所需三支齐见（不等于已经成局）`);
    }
  }

  return {
    fuxin: Array.from(fuxin),
    fanyin: Array.from(fanyin),
    xingChong: Array.from(xingChong),
  };
}

/**
 * 生成经典外格分析片段
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

  const title =
    classicPattern.sourceRole === '《子平真诠》杂格候选'
      ? '《子平真诠》杂格候选'
      : '其他古籍外格名目参考';
  const eligibilityBoundary =
    classicPattern.sourceRole === '《子平真诠》杂格候选'
      ? '共同边界：干头见官杀即不取；财透两位或单财有根时以财为重，只有单一无根财透不直接阻断；月令另有透干或会支之用仍须优先复核'
      : '来源边界：只按所引古籍保留结构名目，并服从月令无用、干头无财官杀的严格外格前提；不得冒充《子平真诠》本章认可的正式杂格';

  return `【${title}】${classicPattern.name} | 来源：${classicPattern.source.title} | ${eligibilityBoundary} | ${conditionBaziClassicPatternText(classicPattern.description)}`;
}

function generateShenshaFactSection(chartResult: BaziChartResult): string {
  const lines: string[] = [];
  for (const pillar of PILLAR_KEYS) {
    const names = Array.from(new Set(chartResult.shensha?.[pillar] ?? []));
    if (names.length) lines.push(`${PILLAR_LABELS[pillar]}：${names.join('、')}`);
  }
  const globalNames = Array.from(new Set(chartResult.shensha?.global ?? []));
  if (globalNames.length) lines.push(`全局：${globalNames.join('、')}`);
  if (!lines.length) return '';

  return [
    '【神煞命中事实】',
    ...lines,
    '资料边界：以上只记录既定神煞规则在各柱的命中位置，不据名称自动生成现实人物、关系、吉凶、应期或行动建议。',
  ].join('\n');
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

  return buildEvidenceDrivenHintSection('伏吟反吟', `${evidenceLabel}：${evidences.join('；')}`);
}

function generateKongWangSection(chartResult: BaziChartResult): string {
  const kongWangPillars = getKongWangEvidence(chartResult);
  if (!kongWangPillars.length) return '';

  return buildEvidenceDrivenHintSection('空亡详解', `命盘见空亡：${kongWangPillars.join('、')}`);
}

function generateXingChongSection(chartResult: BaziChartResult): string {
  const relations = analyzePillarRelations(chartResult);
  if (!relations.xingChong.length) return '';

  return buildEvidenceDrivenHintSection('刑冲合会破', `命盘见：${relations.xingChong.join('；')}`);
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

  const evidence = profiles.flatMap(formatHarmonyTransformProfile).join('；');

  return buildEvidenceDrivenHintSection('干支相合条件', `命盘见相合结构：${evidence}`);
}

/**
 * 生成增强分析片段。
 * 用户选择的主题只限定回答范围，不再决定本地资料包塞哪些专项模板。
 */
export function generateEnhancedAnalysisSection(
  chartResult: BaziChartResult,
  _topic: string = 'general',
): string {
  const sections: string[] = [];

  const wuxingEvidence = chartResult.wuxingStrength;
  if (wuxingEvidence) {
    sections.push(
      `【五行结构】出现：${wuxingEvidence.present.join('、') || '无'}；缺失：${wuxingEvidence.missing.join('、') || '无'}。`,
    );
  }
  const classicSection = generateClassicPatternSection(chartResult);
  if (classicSection) sections.push(classicSection);

  const shenshaSection = generateShenshaFactSection(chartResult);
  if (shenshaSection) sections.push(shenshaSection);

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
