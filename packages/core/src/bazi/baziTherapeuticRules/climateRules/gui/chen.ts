import type { ClimateRule } from '../../types';

export const GUI_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-gui-qingming-bing-only',
    label: '癸日辰月清明后专丙规则',
    description: '癸水生辰月，清明后火气未炽，传统多专用丙火调和阴阳，不宜提前把辛甲并列为先。',
    months: ['辰'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    currentJieqi: ['清明'],
    usefulWuxing: '火',
    favorableOrder: ['火'],
    hint: '癸水辰月清明后，专用丙火调和',
  },
  {
    id: 'chen-month-gui-guyu-bing-xin-jia',
    label: '癸日辰月谷雨后丙辛甲并参规则',
    description:
      '癸水生辰月，谷雨后土气转重，传统仍以丙火为主，但需辛金、甲木参用，不宜仍按清明后单取丙火。',
    months: ['辰'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    currentJieqi: ['谷雨'],
    usefulWuxing: '火',
    favorableOrder: ['火', '金', '木'],
    hint: '癸水辰月谷雨后，丙火为主，辛甲佐之',
  },
];
