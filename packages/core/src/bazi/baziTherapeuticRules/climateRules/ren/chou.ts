import type { ClimateRule } from '../../types';

export const REN_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-ren-xiaohan-bing-only',
    label: '壬日丑月小寒后专丙规则',
    description: '壬水生丑月，上半月癸辛主事，传统多专用丙火解寒扶阳，不宜提前并提甲木。',
    months: ['丑'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    currentJieqi: ['小寒'],
    usefulWuxing: '火',
    favorableOrder: ['火'],
    hint: '壬水丑月小寒后，专用丙火',
  },
  {
    id: 'chou-month-ren-dahan-bing-jia',
    label: '壬日丑月大寒后丙甲并用规则',
    description: '壬水生丑月，下半月己土主事，传统仍以丙火为主，并取甲木佐助，不宜仍与上半月同断。',
    months: ['丑'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    currentJieqi: ['大寒'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '壬水丑月大寒后，丙火为先，甲木为佐',
  },
];
