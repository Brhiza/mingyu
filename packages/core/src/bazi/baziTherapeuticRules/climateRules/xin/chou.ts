import type { ClimateRule } from '../../types';

export const XIN_CHOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chou-month-xin-bing-ren-all',
    label: '辛日丑月丙壬两透金马玉堂规则',
    description:
      '辛金生丑月，寒冻之极，传统明言先丙后壬；若丙壬两透，既能解冻又能洗淘，最合"金马玉堂之客"层次，不应仍按普通冬辛扶抑粗断。',
    months: ['丑'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['丙', '壬'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: ['取用层次:先丙后壬', '成格层次:丙壬两透，金马玉堂'],
    hint: '辛金丑月丙壬两透，可作金马玉堂之客',
  },
  {
    id: 'chou-month-xin-bing-ren-hidden',
    label: '辛日丑月壬丙俱藏游庠规则',
    description:
      '辛金生丑月，若丙壬皆不透而俱藏支内，虽不及两透显发，仍较合原文"壬丙俱藏，游庠食廪之人"；此类不应误作纯寒无药之局。',
    months: ['丑'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredHiddenStems: ['壬', '丙'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '丙'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '丙'],
        minDistinctCount: 2,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: ['取用层次:壬丙俱藏', '成格层次:游庠食廪'],
    hint: '辛金丑月壬丙俱藏，亦主游庠食廪',
  },
  {
    id: 'chou-month-xin-bing-only-no-ren',
    label: '辛日丑月有丙无壬富真贵假规则',
    description:
      '辛金生丑月，若丙火透干而壬水全无，虽能解冻却不能洗淘，较合原文"有丙无壬，富真贵假"；此类只可许富，不应误提到金马玉堂。',
    months: ['丑'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['丙'],
    maxStemTotalCounts: {
      壬: 0,
    },
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: ['取用层次:有丙无壬', '成格层次:富真贵假'],
    hint: '辛金丑月有丙无壬，多主富真贵假',
  },
  {
    id: 'chou-month-xin-ren-only-no-bing',
    label: '辛日丑月有壬乏丙贫贱规则',
    description:
      '辛金生丑月，若壬水透出而丙火全无，寒金愈洗愈冷，较合原文"有壬乏丙，贱而且贫"；此时不能仍把见壬当作得用。',
    months: ['丑'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    maxStemTotalCounts: {
      丙: 0,
    },
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: ['破格因素:有壬而乏丙火', '成格层次:贱而且贫'],
    hint: '辛金丑月有壬而无丙，多主贫贱',
  },
  {
    id: 'chou-month-xin-many-bing-no-ren-gui-trade',
    label: '辛日丑月丙多无壬有癸贸易规则',
    description:
      '辛金生丑月，若丙火偏多而壬水不见，另有癸水点缀，较合原文"丙多，无壬，有癸，市中贸易之流"；此类多主商贸营生，不应误抬到富真贵假或金马玉堂层次。',
    months: ['丑'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minStemTotalCounts: {
      丙: 2,
      癸: 1,
    },
    maxStemTotalCounts: {
      壬: 0,
    },
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: ['取用层次:丙多无壬而有癸', '成格层次:市中贸易之流'],
    hint: '辛金丑月丙多而无壬、有癸，多主市中贸易',
  },
  {
    id: 'chou-month-xin-water-many-earth-fire-peace',
    label: '辛日丑月水多见戊己丙丁安乐规则',
    description:
      '辛金生丑月，若水势偏多，而戊己出干、丙丁亦见，既能制水培金，又能温暖解冻，较合原文"水多，有戊己出干，又有丙丁，必主衣食充盈，一生安乐"；不应仍按寒湿偏枯下断。',
    months: ['丑'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minWuxingCounts: {
      水: 3,
    },
    distinctStemGroupCounts: [
      {
        stems: ['戊', '己'],
        minDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['丙', '丁'],
        minDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '火',
    favorableOrder: ['火', '土'],
    traceHints: ['取用层次:水多而戊己出干，又见丙丁', '成格层次:衣食充盈，一生安乐'],
    hint: '辛金丑月水多而戊己、丙丁并见，多主衣食充盈、一生安乐',
  },
];
