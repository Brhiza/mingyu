import type { ClimateRule } from '../../types';

export const GENG_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-geng-bing-ding-all',
    label: '庚日子月丙丁甲全透极品规则',
    description: '庚金生子月，寒冬金冷，若丙丁甲三者全透，多主富贵极品。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['丙', '丁', '甲'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    traceHints: ['取用层次:丙丁甲三者全透', '成格层次:富贵极品'],
    hint: '庚金子月丙丁甲三者全透，富贵极品',
  },
  {
    id: 'zi-month-geng-bing-first',
    label: '庚日子月先丙后甲丁规则',
    description: '庚金生子月，金寒水冷，传统多以丙火解冻为先、丁火次之、甲木佐助。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金子月，先丙后丁甲',
  },
  {
    id: 'zi-month-geng-bing-ding',
    label: '庚日子月丙丁并用规则',
    description: '庚金生子月，寒极喜暖，丙丁并用。丙丁两透，富贵双全，不宜仍按冬金泛化扶抑。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金子月，丙丁并用，两透则富贵',
  },
];
