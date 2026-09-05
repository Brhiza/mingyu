import type { WuyunElement, WuyunStrength, LiuqiName, LiuqiProfile } from './index';

export const STEM_MOVEMENT: Record<
  string,
  { element: WuyunElement; yinYang: '阳' | '阴'; strength: WuyunStrength }
> = {
  甲: { element: '土', yinYang: '阳', strength: '太过' },
  乙: { element: '金', yinYang: '阴', strength: '不及' },
  丙: { element: '水', yinYang: '阳', strength: '太过' },
  丁: { element: '木', yinYang: '阴', strength: '不及' },
  戊: { element: '火', yinYang: '阳', strength: '太过' },
  己: { element: '土', yinYang: '阴', strength: '不及' },
  庚: { element: '金', yinYang: '阳', strength: '太过' },
  辛: { element: '水', yinYang: '阴', strength: '不及' },
  壬: { element: '木', yinYang: '阳', strength: '太过' },
  癸: { element: '火', yinYang: '阴', strength: '不及' },
};

export const QI_PROFILES: Record<LiuqiName, LiuqiProfile> = {
  厥阴风木: { name: '厥阴风木', phase: '厥阴', qi: '风', element: '木' },
  少阴君火: { name: '少阴君火', phase: '少阴', qi: '君火', element: '火' },
  少阳相火: { name: '少阳相火', phase: '少阳', qi: '相火', element: '火' },
  太阴湿土: { name: '太阴湿土', phase: '太阴', qi: '湿', element: '土' },
  阳明燥金: { name: '阳明燥金', phase: '阳明', qi: '燥', element: '金' },
  太阳寒水: { name: '太阳寒水', phase: '太阳', qi: '寒', element: '水' },
};

export const BRANCH_SITIAN_ZAIQUAN: Record<string, readonly [LiuqiName, LiuqiName]> = {
  子: ['少阴君火', '阳明燥金'],
  午: ['少阴君火', '阳明燥金'],
  丑: ['太阴湿土', '太阳寒水'],
  未: ['太阴湿土', '太阳寒水'],
  寅: ['少阳相火', '厥阴风木'],
  申: ['少阳相火', '厥阴风木'],
  卯: ['阳明燥金', '少阴君火'],
  酉: ['阳明燥金', '少阴君火'],
  辰: ['太阳寒水', '太阴湿土'],
  戌: ['太阳寒水', '太阴湿土'],
  巳: ['厥阴风木', '少阳相火'],
  亥: ['厥阴风木', '少阳相火'],
};

export const SUIHUI_BRANCH_ELEMENT: Partial<Record<string, WuyunElement>> = {
  卯: '木',
  午: '火',
  辰: '土',
  戌: '土',
  丑: '土',
  未: '土',
  酉: '金',
  子: '水',
};
