import type { ClimateRule } from '../../types';

export const GENG_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-geng-ding-bing-jia',
    label: '庚日亥月丁造丙暖规则',
    description: '庚金生亥月，原文以丁火造庚、丙火温金；甲木与丁同透且地支不成水局时另论。',
    priority: 121,
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金亥月，丁火造庚、丙火照暖，甲木配丁另核',
  },
  {
    id: 'hai-month-geng-ding-jia-visible-no-water-formation',
    label: '庚日亥月丁甲透而无水局规则',
    description: '庚金生亥月，丁甲两透且地支不成水局，较合原文可许一榜的条件；科名属于古籍取象。',
    priority: 122,
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['丁', '甲'],
    forbiddenFormationWuxings: ['水'],
    usefulWuxing: '火',
    favorableOrder: ['火', '木'],
    hint: '庚金亥月丁甲两透且支无水局，可参古籍一榜之象',
  },
];
