import type { ClimateRule } from '../../types';

export const GUI_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-gui-xin-source',
    label: '癸日巳月辛金发源规则',
    description:
      '《穷通宝鉴·三夏癸水》四月以辛金为用，无辛用庚；火土偏盛时还需核对金能否生水及比劫救应。',
    priority: 120,
    months: ['巳'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    policy: {
      mode: 'within-balance',
      source: {
        title: '穷通宝鉴',
        section: '三夏癸水',
        excerpt: '四月癸水，喜辛金为用，无辛用庚。',
        url: 'https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674',
      },
      effects: [
        { stem: '辛', wuxing: '金', role: '发源', targetStems: ['癸'], rank: 'primary' },
        { stem: '庚', wuxing: '金', role: '发源', targetStems: ['癸'], rank: 'secondary' },
      ],
    },
    hint: '癸水巳月，辛金发源，无辛用庚，火土偏盛时核对壬水救应',
  },
  {
    id: 'si-month-gui-geng-ren-support',
    label: '癸日巳月庚壬泄制火土规则',
    description:
      '《穷通宝鉴·三夏癸水》论庚壬两透泄制火土，并列丁火破庚的限制；透干条件成立后仍需核对庚壬的根气与作用路径。',
    priority: 126,
    months: ['巳'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    requiredVisibleStems: ['庚', '壬'],
    forbiddenVisibleStems: ['丁'],
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    policy: {
      mode: 'within-balance',
      source: {
        title: '穷通宝鉴',
        section: '三夏癸水',
        excerpt: '若庚壬两透，泄制火土，名劫印化晋。',
        url: 'https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674',
      },
      effects: [
        { stem: '庚', wuxing: '金', role: '生水', targetStems: ['癸'], rank: 'primary' },
        { stem: '壬', wuxing: '水', role: '制火', targetStems: ['丙', '丁'], rank: 'secondary' },
      ],
    },
    hint: '癸水巳月庚壬两透、丁火未透，可核对庚金生水与壬水制火的救应路径',
  },
];
