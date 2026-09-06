/**
 * @file 西洋占星全息分析器 (Astrolabe Natal Dossier & Aspects Matrix)
 * @description 组织十大星体、四轴点、全量相位网格与四元素形态分布。
 */

import type { AstrolabeData } from '../types/divination';
import type { MingluAstrolabeSectionData } from './types';

export function buildEnhancedAstrolabeSection(data: AstrolabeData): MingluAstrolabeSectionData {
  const points = data.planets.map((p) => ({
    name: p.name,
    label: p.label,
    sign: p.sign,
    house: p.house,
    degree: p.degree,
    minute: p.minute,
    formatted: p.formatted,
    isRetrograde: p.retrograde,
  }));

  const angles = data.angles.map((a) => ({
    name: a.name,
    label: a.label,
    sign: a.sign,
    house: a.house,
    degree: a.degree,
    minute: a.minute,
    formatted: a.formatted,
  }));

  const houses = data.houses.map((h) => ({
    house: h.house,
    sign: h.sign,
    formatted: h.formatted,
    planetsInHouse: data.planets.filter((p) => p.house === h.house).map((p) => p.label),
  }));

  const aspects = data.aspects.map((asp) => {
    const isHarmonious = ['六合', '拱相', '半六合'].includes(asp.type);
    const isChallenging = ['刑相', '冲相', '半刑'].includes(asp.type);
    return {
      body1: asp.body1,
      body2: asp.body2,
      type: asp.type,
      angle: asp.exactAngle ?? asp.actualAngle ?? 0,
      orb: asp.orb,
      closeness: asp.closeness ?? '中等',
      isApplying: asp.applying,
      nature: (isHarmonious ? '和谐' : isChallenging ? '挑战' : '中性') as '和谐' | '挑战' | '中性',
    };
  });

  // 元素/模式摘要只统计参与分布计算的星体集合，比例分母须与分子保持同一集合，
  // 不能使用合并全部交点、莉莉丝与阿拉伯点后的 points.length
  const totalPoints =
    Object.values(data.summary.elements).reduce((sum, list) => sum + list.length, 0) ||
    Object.values(data.summary.modalities).reduce((sum, list) => sum + list.length, 0) ||
    1;
  const elementsRecord: Record<string, { count: number; percentage: number; points: string[] }> = {
    火: { count: 0, percentage: 0, points: [] },
    土: { count: 0, percentage: 0, points: [] },
    风: { count: 0, percentage: 0, points: [] },
    水: { count: 0, percentage: 0, points: [] },
  };

  Object.entries(data.summary.elements).forEach(([elem, list]) => {
    if (elementsRecord[elem]) {
      elementsRecord[elem].count = list.length;
      elementsRecord[elem].percentage = Number(((list.length / totalPoints) * 100).toFixed(1));
      elementsRecord[elem].points = list;
    }
  });

  const modalitiesRecord: Record<string, { count: number; percentage: number; points: string[] }> =
    {
      开创: { count: 0, percentage: 0, points: [] },
      固定: { count: 0, percentage: 0, points: [] },
      变动: { count: 0, percentage: 0, points: [] },
    };

  Object.entries(data.summary.modalities).forEach(([mod, list]) => {
    if (modalitiesRecord[mod]) {
      modalitiesRecord[mod].count = list.length;
      modalitiesRecord[mod].percentage = Number(((list.length / totalPoints) * 100).toFixed(1));
      modalitiesRecord[mod].points = list;
    }
  });

  const isDayTime = data.solarIllumination ? data.solarIllumination.solarAltitudeDegrees > 0 : true;

  return {
    points,
    angles,
    houses,
    aspects,
    distributions: {
      elements: elementsRecord,
      modalities: modalitiesRecord,
    },
    dayNight: {
      isDayChart: isDayTime,
      sunAltitude: data.solarIllumination?.solarAltitudeDegrees,
    },
  };
}
