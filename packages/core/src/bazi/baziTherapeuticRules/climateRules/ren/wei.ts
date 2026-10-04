import type { ClimateRule } from '../../types';

export const REN_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wei-month-ren-xin-jia-gui',
    label: '壬日未月先辛后甲规则',
    description: '壬水生未月，己土当权，原文先取辛金发源，再取甲木劈土，癸水随局参用。',
    priority: 120,
    months: ['未'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木', '水'],
    hint: '壬水未月，先辛后甲，癸水次辅',
  },
  {
    id: 'wei-month-ren-xin-jia-visible',
    label: '壬日未月辛甲两透规则',
    description:
      '壬水生未月，辛甲两透时，原文作富贵清高的传统格局取象；取用仍以辛金为先、甲木随后。',
    priority: 122,
    months: ['未'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['辛', '甲'],
    usefulWuxing: '金',
    favorableOrder: ['金', '木'],
    traceHints: ['取用层次:辛甲两透', '古籍取象:富贵清高'],
    hint: '壬水未月辛甲两透，可参古籍富贵清高之象',
  },
  {
    id: 'wei-month-ren-xin-hidden-jia-visible',
    label: '壬日未月辛藏甲透异途武职规则',
    description:
      '壬水生未月，原文以辛藏甲透为异途武职的传统取象；须有辛藏支，不能把全无辛金误列此象。',
    priority: 121,
    months: ['未'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['甲'],
    requiredHiddenStems: ['辛'],
    forbiddenVisibleStems: ['辛'],
    usefulWuxing: '木',
    favorableOrder: ['木'],
    traceHints: ['取用层次:辛藏甲透', '古籍取象:异途武职'],
    hint: '壬水未月辛藏甲透，可参古籍异途武职之象',
  },
];
