import type { ClimateRule } from '../../types';

export const YI_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-yi-bing-gui-first',
    label: '乙日巳月先癸后丙规则',
    description:
      '乙木生巳月，火旺木焚，《穷通宝鉴》夏木专用癸水，以癸水滋木为先、丙火为次，先润后照。',
    months: ['巳'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    hint: '乙木巳月，先癸后丙',
  },
  {
    id: 'si-month-yi-bing-gui-geng-all',
    label: '乙日巳月癸丙庚全透极品规则',
    description: '乙木生巳月，癸丙庚三者全透，癸水为君、丙火为臣、庚金发源，主鼎甲可期。',
    months: ['巳'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    requiredVisibleStems: ['癸', '丙', '庚'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火', '金'],
    traceHints: ['取用层次:癸丙庚三者全透', '成格层次:鼎甲可期'],
    hint: '乙木巳月癸丙庚三者全透，鼎甲可期',
  },
  {
    id: 'si-month-yi-bing-gui-second',
    label: '乙日巳月癸水为先丙火为次规则',
    description: '乙木生巳月，夏木专用癸水滋培，以癸水为君、丙火为臣，较夏木泛化更细。',
    months: ['巳'],
    dayMasters: ['木'],
    dayStems: ['乙'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    hint: '乙木巳月，癸水为先，丙火为次',
  },
];
