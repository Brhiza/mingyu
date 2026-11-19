import { mountains, mountainTrigram, trigrams } from '../compass';
import { flyStars } from './foundation';

const gongRing = [1, 8, 3, 4, 9, 2, 7, 6] as const;
const forwardMountains = '壬甲丙庚艮寅巽巳坤申乾亥';

/** 仅计算盘面旺星到位；实际城门是否可用仍须核对实地形势。 */
export function castleGate(yun: number, facingMountain: string) {
  const index = mountains.indexOf(facingMountain);
  if (index < 0) throw new Error('城门朝向须为有效的二十四山。');
  const plate = flyStars(yun, '顺飞'), yuan = (index + 1) % 3;
  const facingRingIndex = trigrams.indexOf(mountainTrigram(facingMountain));
  const facingGong = gongRing[facingRingIndex];
  const candidates = [-1, 1].map((step) => {
    const ringIndex = (facingRingIndex + step + 8) % 8, gong = gongRing[ringIndex], gongName = trigrams[ringIndex];
    const mountain = mountains.find((m, i) => mountainTrigram(m) === gongName && (i + 1) % 3 === yuan)!;
    const yunStar = plate[gong - 1], referenceGong = yunStar === 5 ? yun : yunStar;
    const referenceMountain = mountains.find((m, i) => gongRing[trigrams.indexOf(mountainTrigram(m))] === referenceGong && (i + 1) % 3 === yuan)!;
    const flyDirection = forwardMountains.includes(referenceMountain) ? '顺飞' as const : '逆飞' as const;
    const arrivalStar = flyStars(yunStar, flyDirection)[gong - 1];
    return { gong, gongName, mountain, role: Math.abs(facingGong - gong) === 5 ? '正城门' as const : '副城门' as const,
      yunStar, flyDirection, arrivalStar, status: arrivalStar === yun ? '旺星到位' as const : '旺星未到位' as const };
  });
  return { hasWangStarGate: candidates.some((candidate) => candidate.status === '旺星到位'), candidates,
    limitation: '仅按运盘计算旺星是否到位；实际可用性须结合水口、门路与实地形势核对。' };
}
