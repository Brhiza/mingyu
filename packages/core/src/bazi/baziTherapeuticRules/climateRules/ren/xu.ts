import type { ClimateRule } from '../../types';

export const REN_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-ren-bing-jia-first',
    label: '壬日戌月先丙后甲规则',
    description: '壬水生戌月，秋深金衰，传统多以丙火调候、甲木疏通，较秋水泛化更合原法。',
    months: ['戌'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '壬水戌月，先丙后甲',
  },
  {
    id: 'xu-month-ren-bing-jia-xin-all',
    label: '壬日戌月丙甲辛全透极品规则',
    description: '壬水生戌月，丙甲辛三者全透，较合原文"壬水生戌月，三者全透，鼎甲可期"。',
    months: ['戌'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['丙', '甲', '辛'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木', '金'],
    traceHints: ['取用层次:丙甲辛三者全透', '成格层次:鼎甲可期'],
    hint: '壬水戌月丙甲辛三者全透，鼎甲可期',
  },
  {
    id: 'xu-month-ren-jia-bing',
    label: '壬日戌月甲丙并用规则',
    description:
      '壬水生戌月，土厚水弱，甲木疏土为先，丙火暖局为后。甲丙两透，富贵可期，不宜仍按秋水泛断。',
    months: ['戌'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '木',
    favorableOrder: ['木', '火'],
    hint: '壬水戌月，甲先丙后，甲丙两透富贵',
  },
];
