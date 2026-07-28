import type { ClimateRule } from '../../types';

export const BING_MAO_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'mao-month-bing-no-ren-ji-temporary',
    label: '丙日卯月无壬己土姑用规则',
    description:
      '丙火生卯月，原法端用壬水；若壬水不透而己土透，可姑取己土调剂，但仅主才学衣食，难言成名。',
    months: ['卯'],
    dayMasters: ['火'],
    dayStems: ['丙'],
    requiredVisibleStems: ['己'],
    forbiddenVisibleStems: ['壬'],
    usefulWuxing: '土',
    favorableOrder: ['土', '水'],
    traceHints: ['取用层次:己土姑用', '成格层次:有才学但难成名'],
    hint: '丙火卯月无壬透，可姑用己土',
  },
];
