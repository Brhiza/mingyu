export type ShenShaScope = 'common' | 'all';

export const COMMON_BAZI_SHENSHA_NAMES = [
  '天乙贵人',
  '天德贵人',
  '月德贵人',
  '天德合',
  '月德合',
  '天赦日',
  '禄神',
  '驿马',
  '太极贵人',
  '将星',
  '学堂',
  '词馆',
  '国印贵人',
  '三奇贵人',
  '文昌贵人',
  '华盖',
  '天医',
  '金舆',
  '空亡',
  '灾煞',
  '劫煞',
  '亡神',
  '羊刃',
  '飞刃',
  '血刃',
  '流霞',
  '四废日',
  '天罗地网',
  '桃花',
  '孤辰',
  '寡宿',
  '阴差阳错',
  '魁罡',
  '孤鸾煞',
  '红鸾',
  '天喜',
  '勾绞煞',
  '红艳煞',
  '十恶大败',
  '元辰',
  '金神',
  '天转',
  '地转',
  '丧门',
  '吊客',
  '披麻',
  '十灵日',
  '六秀日',
  '八专',
  '九丑',
  '童子煞',
  '天厨贵人',
  '福星贵人',
  '德秀贵人',
  '拱禄',
] as const;

const COMMON_BAZI_SHENSHA_NAME_SET = new Set<string>(COMMON_BAZI_SHENSHA_NAMES);

const COMMON_BAZI_SHENSHA_ALIASES: Readonly<Record<string, string>> = {
  天乙: '天乙贵人',
  天德: '天德贵人',
  月德: '月德贵人',
  太极: '太极贵人',
  国印: '国印贵人',
  文昌: '文昌贵人',
  天厨: '天厨贵人',
  福星: '福星贵人',
  德秀: '德秀贵人',
  天罗: '天罗地网',
  地网: '天罗地网',
  孤鸾: '孤鸾煞',
  勾绞: '勾绞煞',
  红艳: '红艳煞',
  童子: '童子煞',
};

/** 将神煞列表收敛为默认常用项，并统一完整名称。 */
export function filterCommonBaziShenSha(items: readonly string[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  items.forEach((item) => {
    const trimmed = item.trim();
    const displayName = COMMON_BAZI_SHENSHA_ALIASES[trimmed] ?? trimmed;
    if (!COMMON_BAZI_SHENSHA_NAME_SET.has(displayName) || seen.has(displayName)) return;
    seen.add(displayName);
    result.push(displayName);
  });

  return result;
}
