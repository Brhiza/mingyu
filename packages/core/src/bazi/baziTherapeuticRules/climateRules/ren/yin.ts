import type { ClimateRule } from '../../types';

export const REN_YIN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'yin-month-ren-geng-bing-wu',
    label: '壬日寅月庚丙戊次第规则',
    description:
      '壬水生寅月，失令而寒，传统多先取庚金发源，次取丙火除寒，再取戊土止流，较单用金水更完整。',
    months: ['寅'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '金',
    favorableOrder: ['金', '火', '土'],
    hint: '壬水寅月，先庚次丙，再酌戊土',
  },
  {
    id: 'yin-month-ren-geng-bing-first',
    label: '壬日寅月先庚次丙规则',
    description: '壬水生寅月，失令而寒，传统多先取庚金发源，次取丙火除寒，较单用金水更完整。',
    months: ['寅'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '金',
    favorableOrder: ['金', '火'],
    hint: '壬水寅月，先庚次丙',
  },
  {
    id: 'yin-month-ren-bing-geng-jia',
    label: '壬日寅月丙庚甲全透显达规则',
    description:
      '壬水生寅月，若丙庚甲三者全透，较合原文"身强才旺有根，丙庚甲三者全透，定主雁塔有名"。',
    months: ['寅'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['丙', '庚', '甲'],
    usefulWuxing: '金',
    favorableOrder: ['金', '火', '木'],
    traceHints: ['取用层次:丙庚甲三者全透', '成格层次:雁塔有名'],
    hint: '壬水寅月丙庚甲三者全透，多主雁塔有名',
  },
  {
    id: 'yin-month-ren-geng-first-bing-assist',
    label: '壬日寅月庚金为先丙火为佐规则',
    description: '壬水生寅月，庚金发源为主，丙火除寒为佐，较简单金水扶抑更贴合原法。',
    months: ['寅'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '金',
    favorableOrder: ['金', '火'],
    hint: '壬水寅月，庚金为先，丙火为佐',
  },
];
