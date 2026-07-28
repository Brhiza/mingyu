import type { ClimateRule } from '../../types';

export const WU_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-wu-gui-bing-first',
    label: '戊日巳月先壬后甲规则',
    description:
      '戊土生巳月，夏燥土焦，《穷通宝鉴》以壬水润燥为先、甲木疏土为佐，戊土高燥喜壬不喜癸。',
    months: ['巳'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    hint: '戊土巳月，先壬后甲',
  },
  {
    id: 'si-month-wu-gui-bing-xin-all',
    label: '戊日巳月壬甲齐透鼎甲可期规则',
    description: '戊土生巳月，壬水润燥与甲木疏土齐透，壬甲相辅成格，主鼎甲可期。',
    months: ['巳'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    requiredVisibleStems: ['壬', '甲'],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:壬甲齐透', '成格层次:鼎甲可期'],
    hint: '戊土巳月壬甲齐透，鼎甲可期',
  },
];
