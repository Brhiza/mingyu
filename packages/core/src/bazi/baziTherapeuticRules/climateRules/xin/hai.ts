import type { ClimateRule } from '../../types';

export const XIN_HAI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'hai-month-xin-ren-bing-all',
    label: '辛日亥月壬丙两透金榜规则',
    description:
      '辛金生亥月，渐寒而未极，传统明言先用壬水、次取丙火；若壬丙两透，最合"金白水清"之象，多主金榜题名，不应仍按普通冬金泛论。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬', '丙'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    traceHints: ['取用层次:先壬后丙', '成格层次:壬丙两透，金榜题名'],
    hint: '辛金亥月壬丙两透，多主金榜题名',
  },
  {
    id: 'hai-month-xin-bing-visible-ren-hidden',
    label: '辛日亥月丙透壬藏采芹规则',
    description:
      '辛金生亥月，若丙火透干而壬水只藏支内，仍得暖金润金之机；较合原文"丙透壬藏，采芹之造"，层次低于壬丙并透，但不应退回常格。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['丙'],
    requiredHiddenStems: ['壬'],
    forbiddenVisibleStems: ['壬'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    traceHints: ['取用层次:丙火透干，壬水藏支', '成格层次:采芹之造'],
    hint: '辛金亥月丙透壬藏，可作采芹之造',
  },
  {
    id: 'hai-month-xin-ren-visible-bing-hidden',
    label: '辛日亥月壬透丙藏千金规则',
    description:
      '辛金生亥月，若壬水透干而丙火只藏支内，寒金得洗而暗有温气，较合原文"丙藏壬透，富有千金"；此类重在壬为主用，不应误降到普通积蓄之人。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    requiredHiddenStems: ['丙'],
    forbiddenVisibleStems: ['丙'],
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    traceHints: ['取用层次:壬水透干，丙火藏支', '成格层次:富有千金'],
    hint: '辛金亥月壬透丙藏，多主富有千金',
  },
  {
    id: 'hai-month-xin-ren-bing-hidden',
    label: '辛日亥月壬丙在支聪明规则',
    description:
      '辛金生亥月，若壬丙二神皆不透而同在支内，仍有内藏润暖之机；较合原文"壬丙在支，聪明之士"，虽不及透干显达，亦不应混入寒湿偏枯之局。',
    months: ['亥'],
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
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    traceHints: ['取用层次:壬丙皆在支内', '成格层次:聪明之士'],
    hint: '辛金亥月壬丙在支，亦主聪明',
  },
  {
    id: 'hai-month-xin-ren-many-no-wu',
    label: '辛日亥月壬多无戊汪洋贫贱规则',
    description:
      '辛金生亥月，若壬水偏多而全局不见戊土为岸，较合原文"壬多无戊，名辛水汪洋，反成贫贱"；此时水势漫流，不应仍按壬水为尊简单上断。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minStemTotalCounts: {
      壬: 2,
    },
    maxStemTotalCounts: {
      戊: 0,
    },
    usefulWuxing: '土',
    favorableOrder: ['土', '火'],
    traceHints: ['破格因素:壬水偏多而无戊为岸', '成格层次:辛水汪洋，反成贫贱'],
    hint: '辛金亥月壬多无戊，多主汪洋贫贱',
  },
  {
    id: 'hai-month-xin-wu-ren-storage',
    label: '辛日亥月戊壬并存积蓄规则',
    description:
      '辛金生亥月，若戊壬二神并存于柱，既得壬水洗淘，又有戊土节制，较合原文"戊壬存柱，积蓄之人"；此类重在财蓄成局，不应仍按壬多汪洋或两透科名混断。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minStemTotalCounts: {
      戊: 1,
      壬: 1,
    },
    forbiddenVisibleStems: ['丙'],
    usefulWuxing: '土',
    favorableOrder: ['土', '水'],
    traceHints: ['取用层次:戊壬并存于柱', '成格层次:积蓄之人'],
    hint: '辛金亥月戊壬并存，多主积蓄丰厚',
  },
  {
    id: 'hai-month-xin-wu-many-ren-few-fame',
    label: '辛日亥月戊多壬少成名规则',
    description:
      '辛金生亥月，若戊土偏多而壬水偏少，较合原文"戊多壬少，又主成名"；此时堤岸有力而秀气不绝，层次高于单纯戊壬并存的积蓄之人。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minStemTotalCounts: {
      戊: 2,
      壬: 1,
    },
    maxStemTotalCounts: {
      丙: 0,
      壬: 1,
    },
    usefulWuxing: '土',
    favorableOrder: ['土', '水'],
    traceHints: ['取用层次:戊多壬少', '成格层次:又主成名'],
    hint: '辛金亥月戊多壬少，多主成名',
  },
  {
    id: 'hai-month-xin-jia-many-wu-few-art',
    label: '辛日亥月甲多戊少艺术蓄金规则',
    description:
      '辛金生亥月，若甲木偏多而戊土偏少，较合原文"甲多戊少，因艺术而蓄金"；此类重在木气灵动、土不壅塞，多以技艺营财，不应仍混入积蓄或成名格。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minVisibleStemCounts: {
      甲: 2,
    },
    maxStemTotalCounts: {
      戊: 1,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:甲多而戊少', '成格层次:因艺术而蓄金'],
    hint: '辛金亥月甲多戊少，多因艺术技艺而蓄财',
  },
  {
    id: 'hai-month-xin-ji-many-with-wu-honest',
    label: '辛日亥月己多有戊诚实规则',
    description:
      '辛金生亥月，若己土偏多而又见戊土，且壬水尚存，较合原文"己多有戊，壬水被困，金被埋，不过诚实之人"；此类土重埋金，层次不高，不应误抬到成名或积蓄格。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minStemTotalCounts: {
      己: 2,
      戊: 1,
      壬: 1,
    },
    maxStemTotalCounts: {
      丙: 0,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '火'],
    traceHints: ['破格因素:己多有戊，壬水被困，金被埋', '成格层次:不过诚实之人'],
    hint: '辛金亥月己多而又见戊，多主诚实平常',
  },
  {
    id: 'hai-month-xin-water-many-no-wu-bing',
    label: '辛日亥月壬癸多无戊丙劳碌规则',
    description:
      '辛金生亥月，若壬癸偏多而戊丙全无，寒湿泛滥无制无暖，较合原文"壬癸多无戊丙者，劳碌辛苦"；不应仍把见壬见癸简单上提为金白水清。',
    months: ['亥'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minStemTotalCounts: {
      壬: 1,
      癸: 1,
    },
    minWuxingCounts: {
      水: 4,
    },
    maxStemTotalCounts: {
      戊: 0,
      丙: 0,
    },
    usefulWuxing: '火',
    favorableOrder: ['火', '土'],
    traceHints: ['破格因素:壬癸偏多而无戊丙', '成格层次:劳碌辛苦'],
    hint: '辛金亥月壬癸偏多而无戊丙，多主劳碌辛苦',
  },
];
