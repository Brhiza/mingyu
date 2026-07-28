import type { ClimateRule } from '../../types';

export const GENG_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-geng-ding-jia-first',
    label: '庚日戌月先丁后甲壬规则',
    description: '庚金生戌月，秋深气寒，需丁火温暖、甲木裁抑、壬水洗涤，方能成器。',
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木', '水'],
    hint: '庚金戌月，先丁后甲壬',
  },
  {
    id: 'xu-month-geng-jia-ren',
    label: '庚日戌月甲壬并用规则',
    description:
      '庚金生戌月，土厚金埋，甲木疏土为先，壬水洗金为后。甲壬两透，科甲可期，不宜仍按秋金泛断。',
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    hint: '庚金戌月，甲先壬后，甲壬两透科甲',
  },
];
