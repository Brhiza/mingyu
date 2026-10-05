import type { ClimateRule } from '../../types';

export const REN_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-ren-jia-bing-first',
    label: '壬日戌月先甲后丙规则',
    description: '壬水生戌月，原文专用甲木制戌中戊土，丙火次之。',
    priority: 120,
    months: ['戌'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '木',
    favorableOrder: ['木', '火'],
    hint: '壬水戌月，先甲后丙',
  },
  {
    id: 'xu-month-ren-jia-bing',
    label: '壬日戌月甲丙并用规则',
    description:
      '壬水生戌月，甲木为先、丙火次之；原文的清贵格另须水势、戊土出干等条件，甲丙两透仅作取用资料。',
    priority: 118,
    months: ['戌'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '木',
    favorableOrder: ['木', '火'],
    hint: '壬水戌月甲丙并见，按甲先丙后核对作用',
  },
];
