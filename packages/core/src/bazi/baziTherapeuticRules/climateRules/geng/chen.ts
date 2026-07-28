import type { ClimateRule } from '../../types';

export const GENG_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-geng-jia-bing',
    label: '庚日辰月甲先丙后规则',
    description:
      '庚金生辰月，土旺金相，甲先疏土、丙后暖金。甲丙两透，科甲可期，不宜仍按春金一概先火。',
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    usefulWuxing: '木',
    favorableOrder: ['木', '火'],
    hint: '庚金辰月，先甲疏土，后丙暖金，甲丙两透科甲',
  },
  {
    id: 'chen-month-geng-jia-no-bing',
    label: '庚日辰月有甲无丙异路规则',
    description:
      '庚金生辰月，甲木疏土为急；若甲透而丙不出，较合原文"有甲无丙，异路功名"；不应仍按甲丙两透科甲论。',
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredVisibleStems: ['甲'],
    maxStemTotalCounts: { 丙: 0 },
    usefulWuxing: '木',
    favorableOrder: ['木', '火'],
    traceHints: ['取用层次:有甲无丙', '成格层次:异路功名'],
    hint: '庚金辰月甲透而丙不出，多主异路功名',
  },
  {
    id: 'chen-month-geng-no-jia-bing',
    label: '庚日辰月无甲丙常人规则',
    description:
      '庚金生辰月，土厚金埋，甲疏丙暖缺一不可；若甲丙俱无，较合原文"甲丙俱无，常人"；不应仍泛以土旺扶抑概之。',
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    maxStemTotalCounts: { 甲: 0, 丙: 0 },
    usefulWuxing: '木',
    favorableOrder: ['木', '火'],
    traceHints: ['破格因素:甲丙俱无', '成格层次:常人'],
    hint: '庚金辰月甲丙俱无，多作常人',
  },
  {
    id: 'chen-month-geng-water-formation-wu',
    label: '庚日辰月水局见戊清贵规则',
    description:
      '庚金生辰月，若地支成水局而戊土出干制水，金水得以清平，较合原文"支成水局，得戊制水，清贵"。',
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['庚'],
    requiredFormationWuxings: ['水'],
    requiredVisibleStems: ['戊'],
    usefulWuxing: '土',
    favorableOrder: ['土', '金'],
    traceHints: ['取用层次:支成水局，得戊制水', '成格层次:清贵'],
    hint: '庚金辰月水局成势而戊透制水，多主清贵',
  },
];
