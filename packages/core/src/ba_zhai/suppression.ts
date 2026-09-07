/** 八宅星宫生克：按《阳宅大全》星曜五行与《相宅造福全书》星宫关系计算。 */
import { getBaZhaiPalace, getEastWestGroup } from '../direction';
import { isSheng, isKe } from '../wuxing';

export interface BaZhaiSuppressionFact {
  star: string;
  element: '木' | '火' | '土' | '金' | '水';
  counterpart: string;
  suppressionRule: string;
  advice: string;
}

export interface BaZhaiGasRegulationResult {
  suppressionLaws: BaZhaiSuppressionFact[];
  doorMasterSummary: string;
  promptSummary: string;
}

export const NINE_STAR_WUXING: Record<
  string,
  { star: string; element: '木' | '火' | '土' | '金' | '水'; nature: '吉' | '凶' }
> = {
  生气: { star: '贪狼', element: '木', nature: '吉' },
  延年: { star: '武曲', element: '金', nature: '吉' },
  天医: { star: '巨门', element: '土', nature: '吉' },
  伏位: { star: '左辅', element: '木', nature: '吉' },
  绝命: { star: '破军', element: '金', nature: '凶' },
  五鬼: { star: '廉贞', element: '火', nature: '凶' },
  六煞: { star: '文曲', element: '水', nature: '凶' },
  祸害: { star: '禄存', element: '土', nature: '凶' },
};

const PALACE_ELEMENTS: Record<string, '木' | '火' | '土' | '金' | '水'> = {
  坎: '水',
  艮: '土',
  震: '木',
  巽: '木',
  离: '火',
  坤: '土',
  兑: '金',
  乾: '金',
};

function relation(a: string, b: string, aName: string, bName: string): string {
  if (a === b) return `${aName}与${bName}比和`;
  if (isSheng(a, b)) return `${aName}生${bName}`;
  if (isSheng(b, a)) return `${bName}生${aName}`;
  if (isKe(a, b)) return `${aName}克${bName}`;
  return `${bName}克${aName}`;
}

export function evaluateBaZhaiRegulation(params: {
  mingGua: string;
  houseGua: string | null;
  mingGroup: '东四命' | '西四命';
  houseGroup: '东四命' | '西四命' | null;
}): BaZhaiGasRegulationResult {
  const { mingGua, houseGua, mingGroup, houseGroup } = params;
  if (
    getEastWestGroup(mingGua) !== mingGroup ||
    (houseGua === null ? houseGroup !== null : getEastWestGroup(houseGua) !== houseGroup)
  ) {
    throw new Error('命宅分组与卦象不一致。');
  }
  const base = houseGua ?? mingGua;
  const scope = houseGua === null ? '命卦' : '宅卦';
  const suppressionLaws = getBaZhaiPalace(base).map((palace): BaZhaiSuppressionFact => {
    const star = NINE_STAR_WUXING[palace.label];
    const palaceElement = PALACE_ELEMENTS[palace.gua];
    const suppressionRule = relation(star.element, palaceElement, '星', '宫');
    return {
      star: `${palace.label}${star.star}${star.element}`,
      element: star.element,
      counterpart: `${palace.direction}${palace.gua}宫${palaceElement}`,
      suppressionRule,
      advice: `结合${palace.label}本性与${suppressionRule}，核对该方实际门、房位置及用途。`,
    };
  });
  const doorMasterSummary =
    houseGua === null
      ? `${mingGua}命属${mingGroup}，按命卦列八方星宫关系。`
      : `${mingGua}命属${mingGroup}，${houseGua}宅属${houseGroup}；命宅${mingGroup === houseGroup ? '同组' : '异组'}，五行关系为${relation(PALACE_ELEMENTS[mingGua], PALACE_ELEMENTS[houseGua], '命卦', '宅卦')}。`;
  const promptSummary = [
    `命宅关系：${doorMasterSummary}`,
    `${scope}星宫生克（伏位取左辅木）：`,
    ...suppressionLaws.map(
      (fact) => `${fact.counterpart}：${fact.star}，${fact.suppressionRule}。`,
    ),
  ].join('\n');
  return { suppressionLaws, doorMasterSummary, promptSummary };
}
