import type { ClimateRule } from '../../types';

export const XIN_ZI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'zi-month-xin-ren-bing-all-no-wu-gui',
    label: '辛日子月壬丙两透不见戊癸衣锦规则',
    description:
      '辛金生子月，寒冬雨露，传统强调须丙温暖；若壬丙两透，而天干不杂戊癸，较合原文"壬丙两透，不见戊癸，衣锦腰金"，不应仍按普通冬辛喜火喜水泛断。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬', '丙'],
    forbiddenVisibleStems: ['戊', '癸'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: ['取用层次:壬丙两透，不见戊癸', '成格层次:衣锦腰金'],
    hint: '辛金子月壬丙两透而不见戊癸，多主衣锦腰金',
  },
  {
    id: 'zi-month-xin-ren-hidden-bing-visible',
    label: '辛日子月壬藏丙透一榜规则',
    description:
      '辛金生子月，若壬水不透只藏支内，而丙火明透解寒，较合原文"即壬藏丙透，一榜堪图"；此类虽不及壬丙并透，仍不应退回常格。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['丙'],
    requiredHiddenStems: ['壬'],
    forbiddenVisibleStems: ['壬', '戊', '癸'],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: ['取用层次:壬藏而丙透', '成格层次:一榜堪图'],
    hint: '辛金子月壬藏丙透，亦可一榜堪图',
  },
  {
    id: 'zi-month-xin-gui-visible-bing-visible-no-ren',
    label: '辛日子月癸出困丙规则',
    description:
      '辛金生子月，若癸水透出而丙火亦透、却无壬水统摄，较合原文"切忌癸出冻金，而困丙火"；此类寒湿上凌，丙火受困，不应仍按壬丙并透或壬藏丙透高断。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['癸', '丙'],
    maxStemTotalCounts: {
      壬: 0,
    },
    usefulWuxing: '火',
    favorableOrder: ['火', '土'],
    traceHints: ['破格因素:癸水出干，冻金困丙', '成格关键:丙火受困，不宜高断'],
    hint: '辛金子月癸出而丙透、却无壬统摄，多主冻金困火',
  },
  {
    id: 'zi-month-xin-ren-many-with-wu-bing-jia',
    label: '辛日子月壬多有戊丙甲出干青云规则',
    description:
      '辛金生子月，若壬水偏多而有戊土为堤，天干又见丙甲并透，既得温暖又得疏导，较合原文"壬多有戊，丙甲出干者，青云之客"；不应仍按壬多寒儒一概下断。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['丙', '甲'],
    minStemTotalCounts: {
      壬: 2,
      戊: 1,
    },
    usefulWuxing: '火',
    favorableOrder: ['火', '木', '土'],
    traceHints: ['取用层次:壬多有戊，丙甲出干', '成格层次:青云之客'],
    hint: '辛金子月壬多有戊而丙甲出干，多主青云直上',
  },
  {
    id: 'zi-month-xin-ren-many-no-wu-bing',
    label: '辛日子月壬多无戊丙寒儒规则',
    description:
      '辛金生子月，若壬水偏多而戊丙皆无，寒湿太过，较合原文"壬多无戊丙者，泄金太过，定主寒儒"；此时不应仍把多壬简单当成有源有用。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minStemTotalCounts: {
      壬: 2,
    },
    maxStemTotalCounts: {
      戊: 0,
      丙: 0,
    },
    usefulWuxing: '火',
    favorableOrder: ['火', '土'],
    traceHints: ['破格因素:壬多而无戊丙', '成格层次:泄金太过，定主寒儒'],
    hint: '辛金子月壬多而无戊丙，多主寒儒',
  },
  {
    id: 'zi-month-xin-ren-many-jia-yi-heavy-no-bing',
    label: '辛日子月壬多甲乙重无丙贫寒规则',
    description:
      '辛金生子月，若壬水偏多，甲乙并重而又无丙火温暖，较合原文"壬多，甲乙重重，无丙火者，贫寒"；此类较寒儒更带木泄之病，不应仍与青云或润下同断。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['甲', '乙'],
    minStemTotalCounts: {
      壬: 2,
    },
    minWuxingCounts: {
      木: 3,
    },
    forbiddenBranchPillarPairs: [
      {
        branch: '丑',
      },
    ],
    maxStemTotalCounts: {
      丙: 0,
    },
    usefulWuxing: '火',
    favorableOrder: ['火', '土'],
    traceHints: ['破格因素:壬多而甲乙重重，无丙火温暖', '成格层次:多主贫寒'],
    hint: '辛金子月壬多而甲乙重重、又无丙火，多主贫寒',
  },
  {
    id: 'zi-month-xin-water-formation-gui-two-wu',
    label: '辛日子月水局癸透二戊制富贵规则',
    description:
      '辛金生子月，若地支水局已成而癸水透干，再得二戊制水，较合原文"支成水局，癸水出干，有二戊制者，富贵恩荣"；此类不应仍按一般冬水过旺轻断。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['水'],
    requiredVisibleStems: ['癸'],
    minStemTotalCounts: {
      戊: 2,
    },
    usefulWuxing: '土',
    favorableOrder: ['土', '火'],
    traceHints: ['取用层次:支成水局，癸水出干，二戊制之', '成格层次:富贵恩荣'],
    hint: '辛金子月水局成势而癸透，若再得二戊制水，多主富贵恩荣',
  },
  {
    id: 'zi-month-xin-water-formation-gui-no-wu',
    label: '辛日子月水局癸透无戊常人规则',
    description:
      '辛金生子月，若地支水局成势而癸水透干，却不见戊土制流，较合原文"无戊者常人"；此类虽有水势，却非高格，不应误抬到恩荣层次。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['水'],
    requiredVisibleStems: ['癸'],
    maxStemTotalCounts: {
      戊: 0,
    },
    usefulWuxing: '土',
    favorableOrder: ['土', '火'],
    traceHints: ['破格因素:支成水局而无戊制水', '成格层次:只作常人'],
    hint: '辛金子月水局成势而癸透，若无戊制水，只作常人',
  },
  {
    id: 'zi-month-xin-run-down-prosper',
    label: '辛日子月亥子丑全比劫透润下规则',
    description:
      '辛金生子月，若地支全见亥子丑，天干又有庚辛比劫透出，且不见丙火，较合原文"名润下格，富贵双全"；此类是从水趋势，不应仍按普通寒儒或水局癸透处理。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredBranchPillarPairs: [
      {
        branch: '亥',
      },
      {
        branch: '丑',
      },
    ],
    minCompanionVisibleCount: 1,
    maxStemTotalCounts: {
      丙: 0,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: [
      '取用层次:支见亥子丑，干出比劫，无丙',
      '成格层次:润下格，富贵双全',
      '运势警语:运喜西北',
    ],
    hint: '辛金子月亥子丑全而比劫透出、又无丙火，可按润下格论',
  },
  {
    id: 'zi-month-xin-run-down-no-metal-monastic',
    label: '辛日子月亥子丑全无庚辛见甲乙僧道规则',
    description:
      '辛金生子月，若地支全见亥子丑，而天干不见庚辛比劫，反见甲乙，又无戊丙挽救，较合原文"若无庚辛，又出甲乙，无戊丙者，必主僧道"；此类不应误按润下格富贵处理。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredBranchPillarPairs: [
      {
        branch: '亥',
      },
      {
        branch: '丑',
      },
    ],
    distinctStemGroupCounts: [
      {
        stems: ['甲', '乙'],
        minDistinctCount: 1,
        scope: 'visible',
      },
    ],
    maxCompanionVisibleCount: 0,
    maxStemTotalCounts: {
      庚: 0,
      戊: 0,
      丙: 0,
    },
    usefulWuxing: '金',
    favorableOrder: ['金', '火'],
    traceHints: ['破格因素:亥子丑全而无庚辛，反见甲乙', '成格层次:必主僧道'],
    hint: '辛金子月亥子丑全而无庚辛、又见甲乙且无戊丙，多主僧道',
  },
  {
    id: 'zi-month-xin-wood-formation-ding-wu-merit',
    label: '辛日子月木局丁戊同见功名规则',
    description:
      '辛金生子月，若地支成木局，而丁火透干并见戊土，既得温金又得培根，较合原文"支成木局，有丁出干，又见戊者，功名特达"；不应仍按冬金木旺受克下断。',
    months: ['子'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['木'],
    requiredVisibleStems: ['丁', '戊'],
    usefulWuxing: '火',
    favorableOrder: ['火', '土'],
    traceHints: ['取用层次:支成木局，丁火出干，又见戊土', '成格层次:功名特达'],
    hint: '辛金子月木局成势而丁戊并见，多主功名特达',
  },
];
