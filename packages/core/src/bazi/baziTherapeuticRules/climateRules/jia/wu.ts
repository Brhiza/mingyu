import type { ClimateRule } from '../../types';

export const JIA_WU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wu-month-jia-gui-ding-geng',
    label: '甲日午月先癸后丁规则',
    description:
      '甲木生午月，木性虚焦，传统多先取癸水，次取丁火，庚金再辅，较夏木一概润燥更符合原法先后。',
    months: ['午'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火', '金'],
    hint: '甲木午月，先癸后丁，庚金次辅',
  },
  {
    id: 'wu-month-jia-no-gui-use-ding',
    label: '甲日午月无癸用丁规则',
    description: '甲木生午月，若原局不见癸水透干，传统许以丁火权代为先，不应仍机械固守先癸。',
    months: ['午'],
    dayMasters: ['木'],
    dayStems: ['甲'],
    forbiddenVisibleStems: ['癸'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金', '水'],
    hint: '甲木午月无癸透，可先用丁火，再酌庚金',
  },
];
