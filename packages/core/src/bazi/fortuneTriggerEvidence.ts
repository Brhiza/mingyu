import { BASIC_MAPPINGS } from './baziMappingsData';
import type { BaziChartResult } from './baziTypes';
import { assertGanZhiPair } from './baziUtils';
import { formatPromptEvidenceBundle } from '../prompt-evidence/format';
import type { PromptEvidenceBundle, PromptEvidenceItem } from '../prompt-evidence/types';

export type FortuneLayerType = 'natal' | 'dayun' | 'year' | 'month' | 'day' | 'hour';
export type FortuneTriggerRelationType =
  | 'stem-same'
  | 'stem-combine'
  | 'stem-clash'
  | 'branch-same'
  | 'branch-combine'
  | 'branch-clash'
  | 'branch-punishment'
  | 'branch-harm'
  | 'branch-break'
  | 'pillar-fuyin'
  | 'tianke-dichong'
  | 'suiyun-binglin';

export interface FortuneTriggerLayer {
  id: string;
  type: FortuneLayerType;
  label: string;
  ganZhi: string;
  pillar?: 'year' | 'month' | 'day' | 'hour';
  timeRange?: string;
}

export interface FortuneTriggerRelation {
  type: FortuneTriggerRelationType;
  label: string;
  source: FortuneTriggerLayer;
  target: FortuneTriggerLayer;
  stemRelation?: 'same' | 'combine' | 'clash';
  branchRelation?: 'same' | 'combine' | 'clash' | 'punishment' | 'harm' | 'break';
  rule: string;
  interpretationLimit: string;
}

export interface FortuneTriggerEvidenceResult {
  layers: FortuneTriggerLayer[];
  relations: FortuneTriggerRelation[];
  evidence: PromptEvidenceBundle;
  promptText: string;
  methodology: { notes: string[] };
}

const PILLAR_LABELS = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' } as const;

function splitGanZhi(ganZhi: string) {
  if (ganZhi.length !== 2) throw new Error(`岁运干支必须是两个字符：${ganZhi}`);
  assertGanZhiPair(ganZhi[0], ganZhi[1], '岁运干支');
  return { gan: ganZhi[0], zhi: ganZhi[1] };
}

function relation(
  type: FortuneTriggerRelationType,
  label: string,
  source: FortuneTriggerLayer,
  target: FortuneTriggerLayer,
  rule: string,
  extras: Pick<FortuneTriggerRelation, 'stemRelation' | 'branchRelation'> = {},
): FortuneTriggerRelation {
  return {
    type,
    label,
    source,
    target,
    rule,
    interpretationLimit: '只表示干支关系成立及其所在时间层级，不单独决定吉凶或具体事件。',
    ...extras,
  };
}

function compareLayers(source: FortuneTriggerLayer, target: FortuneTriggerLayer) {
  const sourceParts = splitGanZhi(source.ganZhi);
  const targetParts = splitGanZhi(target.ganZhi);
  const items: FortuneTriggerRelation[] = [];
  const prefix = `${source.label}${source.ganZhi}与${target.label}${target.ganZhi}`;
  const stemSame = sourceParts.gan === targetParts.gan;
  const stemClash = BASIC_MAPPINGS.TIAN_GAN_CHONG[sourceParts.gan] === targetParts.gan;
  const branchSame = sourceParts.zhi === targetParts.zhi;
  const branchClash = BASIC_MAPPINGS.DI_ZHI_CHONG[sourceParts.zhi] === targetParts.zhi;

  if (source.ganZhi === target.ganZhi) {
    items.push(relation('pillar-fuyin', `${prefix}同柱伏吟`, source, target, '两层干支完全相同'));
    if (
      (source.type === 'dayun' && target.type === 'year') ||
      (source.type === 'year' && target.type === 'dayun')
    ) {
      items.push(
        relation(
          'suiyun-binglin',
          `${prefix}构成岁运并临`,
          source,
          target,
          '大运干支与流年干支完全相同',
        ),
      );
    }
  }
  if (stemClash && branchClash) {
    items.push(
      relation(
        'tianke-dichong',
        `${prefix}构成天克地冲`,
        source,
        target,
        '两层天干相冲且地支相冲',
        { stemRelation: 'clash', branchRelation: 'clash' },
      ),
    );
  }
  if (stemSame) {
    items.push(
      relation('stem-same', `${prefix}天干同干`, source, target, '两层天干相同', {
        stemRelation: 'same',
      }),
    );
  }
  if (BASIC_MAPPINGS.TIAN_GAN_WU_HE[sourceParts.gan] === targetParts.gan) {
    items.push(
      relation('stem-combine', `${prefix}天干五合`, source, target, '天干五合配对成立', {
        stemRelation: 'combine',
      }),
    );
  }
  if (stemClash) {
    items.push(
      relation('stem-clash', `${prefix}天干相冲`, source, target, '天干相冲配对成立', {
        stemRelation: 'clash',
      }),
    );
  }
  if (branchSame) {
    items.push(
      relation('branch-same', `${prefix}地支伏吟`, source, target, '两层地支相同', {
        branchRelation: 'same',
      }),
    );
  }
  if (BASIC_MAPPINGS.DI_ZHI_LIU_HE[sourceParts.zhi] === targetParts.zhi) {
    items.push(
      relation('branch-combine', `${prefix}地支六合`, source, target, '地支六合配对成立', {
        branchRelation: 'combine',
      }),
    );
  }
  if (branchClash) {
    items.push(
      relation('branch-clash', `${prefix}地支相冲`, source, target, '地支六冲配对成立', {
        branchRelation: 'clash',
      }),
    );
  }
  if (BASIC_MAPPINGS.DI_ZHI_XING[sourceParts.zhi]?.includes(targetParts.zhi)) {
    items.push(
      relation('branch-punishment', `${prefix}地支相刑`, source, target, '地支刑关系成立', {
        branchRelation: 'punishment',
      }),
    );
  }
  if (BASIC_MAPPINGS.DI_ZHI_HAI[sourceParts.zhi] === targetParts.zhi) {
    items.push(
      relation('branch-harm', `${prefix}地支相害`, source, target, '地支六害配对成立', {
        branchRelation: 'harm',
      }),
    );
  }
  if (BASIC_MAPPINGS.DI_ZHI_PO[sourceParts.zhi] === targetParts.zhi) {
    items.push(
      relation('branch-break', `${prefix}地支相破`, source, target, '地支六破配对成立', {
        branchRelation: 'break',
      }),
    );
  }
  return items;
}

function buildNatalLayers(result: BaziChartResult): FortuneTriggerLayer[] {
  if (!result.pillars) return [];
  return (Object.keys(PILLAR_LABELS) as Array<keyof typeof PILLAR_LABELS>).map((pillar) => ({
    id: `natal-${pillar}`,
    type: 'natal',
    pillar,
    label: `原局${PILLAR_LABELS[pillar]}`,
    ganZhi: result.pillars[pillar].ganZhi,
  }));
}

function buildEvidence(relations: FortuneTriggerRelation[]): PromptEvidenceBundle {
  const specialTypes = new Set<FortuneTriggerRelationType>([
    'suiyun-binglin',
    'tianke-dichong',
    'pillar-fuyin',
  ]);
  const items: PromptEvidenceItem[] = relations.map((item) => ({
    level: specialTypes.has(item.type) ? '主证' : '辅证',
    title: item.label,
    detail: `规则：${item.rule}。${item.interpretationLimit}`,
    source: `${item.source.label}与${item.target.label}干支逐项比对`,
    weight: specialTypes.has(item.type) ? 82 : 66,
    tags: ['八字岁运', item.source.type, item.target.type, item.type],
  }));
  items.push({
    level: '限制',
    title: '岁运触发解释边界',
    detail:
      '合、冲、刑、害、破、伏吟、岁运并临与天克地冲只记录结构和时间层级；必须结合原局喜忌、十神、旺衰及现实问题解释，不代表必然吉凶或事件必然发生。',
    source: '结构化证据解释规则',
    weight: -100,
    tags: ['解释边界'],
  });
  return { title: '八字岁运触发结构化证据', items };
}

export function analyzeFortuneTriggers(
  result: BaziChartResult,
  activeLayers: FortuneTriggerLayer[],
): FortuneTriggerEvidenceResult {
  const natalLayers = buildNatalLayers(result);
  const layers = [...natalLayers, ...activeLayers];
  layers.forEach((layer) => splitGanZhi(layer.ganZhi));
  const relations: FortuneTriggerRelation[] = [];
  activeLayers.forEach((source, sourceIndex) => {
    natalLayers.forEach((target) => relations.push(...compareLayers(source, target)));
    activeLayers
      .slice(0, sourceIndex)
      .forEach((target) => relations.push(...compareLayers(source, target)));
  });
  const evidence = buildEvidence(relations);
  return {
    layers,
    relations,
    evidence,
    promptText: ['【八字岁运触发结构化证据】', ...formatPromptEvidenceBundle(evidence)].join('\n'),
    methodology: {
      notes: [
        '原局四柱与所选大运、流年、流月、流日逐层比对天干同干、五合、相冲及地支同支、六合、六冲、刑、害、破。',
        '大运与流年干支完全相同时单列岁运并临；两层天干相冲且地支相冲时单列天克地冲。',
        '关系成立与吉凶解释分离，不对不同关系设置命运总分，也不从单条关系直接推断事件。',
      ],
    },
  };
}
