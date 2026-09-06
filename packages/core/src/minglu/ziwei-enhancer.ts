/**
 * @file 紫微斗数全息分析器 (Ziwei Natal Dossier & Enhanced Calculation)
 * @description 组织十二宫全景图谱、星曜三方四正与经典格局检测。
 */

import type { ZiweiRuntime } from '../ziwei/runtime';
import type { MingluZiweiPalaceData, MingluZiweiSectionData, MingluZiweiStarFact } from './types';
import type { StarFact } from '../types/analysis';

function mapStar(star: StarFact, type: MingluZiweiStarFact['type']): MingluZiweiStarFact {
  return {
    name: star.name,
    type,
    brightness: star.brightness,
    birthMutagen: star.birth_mutagen,
    activeScopeMutagen: star.active_scope_mutagen,
    scopeMutagen: star.horoscope_mutagen,
  };
}

export function buildEnhancedZiweiSection(runtime: ZiweiRuntime): MingluZiweiSectionData {
  const origin = runtime.payloadByScope.origin;
  if (!origin) {
    throw new Error('紫微本命资料不存在');
  }

  // 命宫按宫位名称确定；来因宫标记单独保留，不得混用
  const soulPalace = origin.palaces.find((p) => p.name === '命宫');
  const bodyPalace = origin.palaces.find((p) => p.is_body_palace);

  const palaces: MingluZiweiPalaceData[] = origin.palaces.map((p) => {
    const opposite = origin.palaces.find((item) => item.index === p.opposite_palace_index);
    const surrounded = p.surrounded_palace_indexes
      .map((idx) => origin.palaces.find((item) => item.index === idx)?.name)
      .filter((name): name is string => Boolean(name));

    return {
      index: p.index,
      name: p.name,
      earthlyBranch: p.earthly_branch,
      heavenlyStem: p.heavenly_stem,
      isBodyPalace: Boolean(p.is_body_palace),
      isOriginSoulPalace: p.name === '命宫',
      isLaiYinPalace: Boolean(p.is_original_palace),
      decadalRange: p.decadal_range,
      majorStars: p.major_stars.map((s) => mapStar(s, 'major')),
      minorStars: p.minor_stars.map((s) => mapStar(s, 'minor')),
      maleficStars: p.other_stars
        .filter((s) => ['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'].includes(s.name))
        .map((s) => mapStar(s, 'malefic')),
      otherStars: p.other_stars
        .filter((s) => !['擎羊', '陀罗', '火星', '铃星', '地空', '地劫'].includes(s.name))
        .map((s) => mapStar(s, 'other')),
      changsheng12: p.changsheng12 || '—',
      boshi12: p.boshi12 || '—',
      suiqian12: p.base_suiqian12 || '—',
      jiangqian12: p.base_jiangqian12 || '—',
      oppositePalaceName: opposite?.name || '—',
      surroundedPalaceNames: surrounded,
      selfMutagens: p.self_mutagens || [],
      anchorId: `ziwei-palace-${p.index}`,
    };
  });

  const patterns = (origin.patterns || []).map((pat) => ({
    name: pat.name,
    type: (pat.kind === 'auspicious' ? '吉格' : pat.kind === 'inauspicious' ? '凶格' : '中性格') as
      '吉格' | '凶格' | '中性格',
    matched: true,
    conditions: pat.matched_conditions || [],
    traditionalInterpretation: pat.traditional_interpretation || pat.description,
    // 出处仅在资料确实提供时呈现，不得以默认书名填补；引文身份同样以来源存在为前提
    sourceTitle: pat.source,
    sourceQuote: pat.source ? pat.description : undefined,
  }));

  const mutagens: MingluZiweiSectionData['mutagens'] = [];
  palaces.forEach((pal) => {
    [...pal.majorStars, ...pal.minorStars].forEach((star) => {
      if (star.birthMutagen) {
        mutagens.push({
          mutagen: star.birthMutagen,
          star: star.name,
          palaceName: pal.name,
          significance: `生年化${star.birthMutagen}入${pal.name}，强化该宫位与星曜之能量重心。`,
        });
      }
    });
  });

  return {
    bureau: origin.basic_info.five_elements_class || '五行局',
    soulMaster: origin.basic_info.soul || '—',
    bodyMaster: origin.basic_info.body || '—',
    soulPalaceBranch: soulPalace?.earthly_branch || origin.basic_info.soul_palace_branch || '—',
    bodyPalaceBranch: bodyPalace?.earthly_branch || origin.basic_info.body_palace_branch || '—',
    palaces,
    patterns,
    mutagens,
  };
}
