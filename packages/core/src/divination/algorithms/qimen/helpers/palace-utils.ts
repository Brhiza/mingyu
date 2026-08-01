import { jiazi } from '../../../../divination/divination-data';

/** 六甲旬首所遁六仪；值符定位、布局寻干与日干上下文格共用同一份映射。 */
export const SIX_JIA_DUN_STEMS: Readonly<Record<string, string>> = Object.freeze({
  甲子: '戊',
  甲戌: '己',
  甲申: '庚',
  甲午: '辛',
  甲辰: '壬',
  甲寅: '癸',
});

type TianPanPalace = {
  tianPan: {
    star: string;
    stem?: string;
    companionStar?: string;
    companionStem?: string;
  };
};

export function hasTianPanStar(palace: TianPanPalace, star: string): boolean {
  return palace.tianPan.star === star || palace.tianPan.companionStar === star;
}

export function getTianPanStemForStar(palace: TianPanPalace, star: string): string | undefined {
  if (palace.tianPan.star === star) return palace.tianPan.stem;
  if (palace.tianPan.companionStar === star) return palace.tianPan.companionStem;
  return undefined;
}

export function hasTianPanStem(palace: TianPanPalace, stem: string): boolean {
  return palace.tianPan.stem === stem || palace.tianPan.companionStem === stem;
}

export function getTianPanStars(palace: TianPanPalace): string[] {
  return [palace.tianPan.star, palace.tianPan.companionStar].filter((star): star is string =>
    Boolean(star),
  );
}

export function getTianPanStems(palace: TianPanPalace): string[] {
  return [palace.tianPan.stem, palace.tianPan.companionStem].filter((stem): stem is string =>
    Boolean(stem),
  );
}

export function getTianPanPairs(palace: TianPanPalace): Array<{ star: string; stem: string }> {
  const pairs: Array<{ star: string; stem: string }> = [];
  if (palace.tianPan.star && palace.tianPan.stem) {
    pairs.push({ star: palace.tianPan.star, stem: palace.tianPan.stem });
  }
  if (palace.tianPan.companionStar && palace.tianPan.companionStem) {
    pairs.push({ star: palace.tianPan.companionStar, stem: palace.tianPan.companionStem });
  }
  return pairs;
}

export function formatTianPanStars(palace: TianPanPalace): string {
  return [palace.tianPan.star, palace.tianPan.companionStar].filter(Boolean).join('、');
}

export function formatTianPanStems(palace: TianPanPalace): string {
  return [palace.tianPan.stem, palace.tianPan.companionStem].filter(Boolean).join('、');
}

/** 将合法六十甲子转换为盘上所用天干；六甲按旬首遁于六仪，其余返回本干。 */
export function getDunJiaStem(ganZhi: string): string {
  if (!jiazi.includes(ganZhi)) {
    throw new Error(`无法识别干支 "${ganZhi}" 的遁甲天干。`);
  }

  if (!ganZhi.startsWith('甲')) {
    return ganZhi.charAt(0);
  }

  const dunStem = SIX_JIA_DUN_STEMS[ganZhi];
  if (!dunStem) {
    throw new Error(`无法识别六甲干支 "${ganZhi}" 的遁甲天干。`);
  }
  return dunStem;
}

export function getOppositePalace(palace: number): number | null {
  const oppositeMap: Record<number, number> = {
    1: 9,
    2: 8,
    3: 7,
    4: 6,
    6: 4,
    7: 3,
    8: 2,
    9: 1,
  };

  return oppositeMap[palace] || null;
}

export function getDoorElement(door: string): string {
  const doorElementMap: Record<string, string> = {
    休门: '水',
    生门: '土',
    伤门: '木',
    杜门: '木',
    景门: '火',
    死门: '土',
    惊门: '金',
    开门: '金',
  };

  const element = doorElementMap[door];
  if (!element) {
    throw new Error(`八门 "${door}" 无法识别。`);
  }
  return element;
}
