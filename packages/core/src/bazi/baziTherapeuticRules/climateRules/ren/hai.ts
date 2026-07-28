import type { ClimateRule } from '../../types';

export const REN_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-ren-wu-bing',
    label: '壬日亥月戊丙并用规则',
    description:
      '壬水生亥月，水旺需堤，戊土为岸为先，丙火佐暖为后。戊丙两透，富贵可期，不宜仍按冬水泛取火概之。',
    months: ['亥'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    usefulWuxing: '土',
    favorableOrder: ['土', '火'],
    hint: '壬水亥月，戊土为堤，丙火佐暖，戊丙两透富贵',
  },
  {
    id: 'hai-month-ren-wu-no-bing',
    label: '壬日亥月有戊无丙异路规则',
    description:
      '壬水生亥月，若戊透而丙不出，虽能止流却不能暖局，较合原文"有戊无丙，异路功名"；不应仍按戊丙两透富贵上断。',
    months: ['亥'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredVisibleStems: ['戊'],
    maxStemTotalCounts: { 丙: 0 },
    usefulWuxing: '土',
    favorableOrder: ['土', '火'],
    traceHints: ['取用层次:有戊无丙', '成格层次:异路功名'],
    hint: '壬水亥月戊透而丙不出，多主异路功名',
  },
  {
    id: 'hai-month-ren-no-wu-bing',
    label: '壬日亥月戊丙俱无奔流规则',
    description:
      '壬水生亥月，水旺无堤无暖，泛滥奔流，较合原文"戊丙俱无，奔流下贱"；不应仍按冬水泛取火概之。',
    months: ['亥'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    maxStemTotalCounts: { 戊: 0, 丙: 0 },
    usefulWuxing: '土',
    favorableOrder: ['土', '火'],
    traceHints: ['破格因素:戊丙俱无', '成格层次:奔流下贱'],
    hint: '壬水亥月戊丙俱无，多作奔流之命',
  },
  {
    id: 'hai-month-ren-wood-formation-wu',
    label: '壬日亥月木局戊透衣禄规则',
    description:
      '壬水生亥月，若地支成木局，泄水太过；得戊土出干止流，较合原文"支成木局，有戊制之，衣禄可求"。',
    months: ['亥'],
    dayMasters: ['水'],
    dayStems: ['壬'],
    requiredFormationWuxings: ['木'],
    requiredVisibleStems: ['戊'],
    usefulWuxing: '土',
    favorableOrder: ['土', '火'],
    traceHints: ['取用层次:支成木局而戊土出干', '成格层次:衣禄可求'],
    hint: '壬水亥月木局成势而戊透，衣禄可求',
  },
];
