import type { ClimateRule } from '../../types';

export const REN_YOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'you-month-ren-jia-drain-soil',
    label: '壬日酉月甲木为先规则',
    description:
      '壬水生酉月，原文专用甲木制戊土，庚金次之；庚金若破甲，甲木作用须另核。无甲时另用金发水源。',
    priority: 118,
    months: ['酉'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '木',
    favorableOrder: ['木', '金'],
    hint: '壬水酉月，专取甲木制土，庚金次之；无甲另用金',
  },
  {
    id: 'you-month-ren-no-jia-gold-source',
    label: '壬日酉月无甲用金发源规则',
    description: '壬水生酉月，原文以甲木为专用；无甲时另以金发水源。',
    priority: 119,
    months: ['酉'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    maxStemTotalCounts: { 甲: 0 },
    usefulWuxing: '金',
    favorableOrder: ['金'],
    hint: '壬水酉月无甲时，可参金发水源',
  },
  {
    id: 'you-month-ren-jia-wu',
    label: '壬日酉月戊病甲制规则',
    description: '壬水生酉月，戊土为病、甲木制戊；甲透且未受庚破时，原文另有清贵取象。',
    priority: 120,
    months: ['酉'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['甲', '戊'],
    maxStemTotalCounts: { 庚: 0 },
    usefulWuxing: '木',
    favorableOrder: ['木'],
    hint: '壬水酉月戊土为病、甲透制戊且无庚破，参古籍清贵之象',
  },
];
