import type { ClimateRule } from '../../types';

export const REN_MAO_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'mao-month-ren-wu-xin-visible',
    label: '壬日卯月戊辛两透题名规则',
    description: '壬水生卯月，先取戊土，次取辛金；戊辛两透，雁塔题名。',
    priority: 123,
    months: ['卯'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['戊', '辛'],
    usefulWuxing: '土',
    favorableOrder: ['土', '金'],
    traceHints: ['取用层次:戊辛两透', '成格层次:雁塔题名'],
    hint: '壬水卯月戊辛两透，雁塔题名',
  },
  {
    id: 'mao-month-ren-wu-xin-first',
    label: '壬日卯月先戊后辛规则',
    description: '壬水生卯月，寒气初除，专取戊土辛金，先戊后辛，庚金次之。',
    priority: 118,
    months: ['卯'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '土',
    favorableOrder: ['土', '金'],
    hint: '壬水卯月，先戊后辛，庚金次之',
  },
];
