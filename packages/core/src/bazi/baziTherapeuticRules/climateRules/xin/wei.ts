import type { ClimateRule } from '../../types';

export const XIN_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wei-month-xin-ding-yi-with-ren-geng',
    label: '辛日未月丁乙出干兼见庚壬显贵规则',
    description:
      '辛金生未月，若丁乙透干而庚壬两字并见，既可制土护金，又能引水发源，传统多主显贵，不应只按普通未月辛金论。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['丁', '乙'],
    distinctStemGroupCounts: [
      {
        stems: ['庚', '壬'],
        minDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['庚', '壬'],
        minDistinctCount: 2,
        scope: 'total',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '金', '木'],
    traceHints: ['取用层次:丁乙出干，庚壬并见', '成格层次:显贵'],
    hint: '辛金未月丁乙透干兼见庚壬，可主显贵',
  },
  {
    id: 'wei-month-xin-ding-yi-no-ren-fails',
    label: '辛日未月丁乙出干无壬不成规则',
    description:
      '辛金生未月，丁乙虽能制土通关，但原文紧接明言"无壬者，否"。若丁乙透干而全局无壬，则润泽之源终缺，不应仍按显贵或普通吉格宽论。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['丁', '乙'],
    maxStemTotalCounts: {
      壬: 0,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '金', '木'],
    traceHints: ['破格因素:丁乙虽透，而无壬润泽', '成格层次:无壬者，否'],
    hint: '辛金未月丁乙虽透，但无壬润泽，终难成局',
  },
  {
    id: 'wei-month-xin-zi-ren-jia-ordinary',
    label: '辛日未月子壬湿泥见甲平人规则',
    description:
      '辛金生未月，若局中只有未中一己，而又见子支并有壬水，土随水湿，传统谓之湿泥，不可再见甲木；若甲出，则反损格局，只作平人，不应仍按壬庚两透或得甲制戊方吉论。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬', '甲'],
    requiredBranchPillarPairs: [
      {
        branch: '子',
      },
    ],
    minStemTotalCounts: {
      己: 1,
      壬: 1,
    },
    maxStemTotalCounts: {
      戊: 0,
      己: 1,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['破格因素:见子壬水，湿泥不能任甲', '成格层次:甲出反作平人'],
    hint: '辛金未月只有未中一己而见子壬水，若甲木再出，只作平人',
  },
  {
    id: 'wei-month-xin-single-ren-single-ji-geng-no-jia',
    label: '辛日未月一壬一己见庚无甲方妙规则',
    description:
      '辛金生未月，若壬水只一位，而己土只存未中一己，不再另透另藏，又见庚金发源且局中无甲牵制，最合原文"总以一壬一己，见庚无甲，方妙"之旨，不应仍停留在泛化壬庚两透层面。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬', '庚'],
    forbiddenVisibleStems: ['甲', '戊', '己'],
    requiredHiddenStemBranchPairs: [
      {
        branch: '未',
        stem: '己',
        pillars: ['month'],
      },
    ],
    minStemTotalCounts: {
      壬: 1,
      己: 1,
    },
    maxStemTotalCounts: {
      戊: 0,
      壬: 1,
      己: 1,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['取用层次:一壬一己，见庚无甲', '成格层次:方妙'],
    hint: '辛金未月一壬一己而见庚无甲，最为方妙',
  },
  {
    id: 'wei-month-xin-ren-geng-no-wu',
    label: '辛日未月壬庚两透无戊科甲规则',
    description:
      '辛金生未月，己土当权，传统先壬后庚；若壬庚两透而戊不出干，较合原文科甲功名之象，不应仍与戊出破局同断。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    forbiddenVisibleStems: ['戊'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '庚'],
        minDistinctCount: 2,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['取用层次:壬庚两透', '成格层次:科甲功名'],
    hint: '辛金未月壬庚两透而无戊，可主科甲功名',
  },
  {
    id: 'wei-month-xin-wu-visible-no-jia-break',
    label: '辛日未月戊出无甲制破局规则',
    description:
      '辛金生未月，原文明言"忌戊出，得甲制之，方吉"。若戊土出干而甲木全无，即使局中尚存壬庚，也难去浊护水，不应仍按壬庚得用或方吉类规则抬断。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['戊'],
    maxStemTotalCounts: {
      甲: 0,
    },
    minStemTotalCounts: {
      壬: 1,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:戊土出干而无甲制伏', '成格关键:土重掩金，壬水受壅'],
    hint: '辛金未月戊土出干而无甲木制伏，多作破局看待',
  },
  {
    id: 'wei-month-xin-wu-jia-geng-break',
    label: '辛日未月庚出制甲破局规则',
    description:
      '辛金生未月，戊土出干本赖甲木制之；若庚金再出反制甲木，则甲不得力，戊土无从节制，传统以此为忌，不应仍按甲隔位制戊方吉处理。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['戊', '甲', '庚'],
    minStemTotalCounts: {
      壬: 1,
      己: 1,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:庚金出干，反制甲木', '成格关键:甲木受伤，难制戊土'],
    hint: '辛金未月戊出虽有甲木，但庚又出干制甲，难成方吉',
  },
  {
    id: 'wei-month-xin-wu-jia-adjacent-ji',
    label: '辛日未月甲贴己贪合下贱规则',
    description:
      '辛金生未月，若戊土出干而局中又有壬水可用，本可借甲木制戊；但甲若与己相贴，反生贪合，难以去土护水，传统多作下贱之格，不应仍按得甲制戊方吉看待。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['戊', '甲', '己'],
    forbiddenVisibleStems: ['庚'],
    minStemTotalCounts: {
      壬: 1,
    },
    requiredVisibleStemDistancePairs: [
      {
        stems: ['甲', '己'],
        maxDistance: 1,
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:甲木贴己，反成贪合', '成格层次:下贱之格'],
    hint: '辛金未月戊出而甲己相贴，贪合反掩金光，多主下贱',
  },
  {
    id: 'wei-month-xin-wu-jia-separated',
    label: '辛日未月戊出甲隔位制土方吉规则',
    description:
      '辛金生未月，若戊土出干而局中又有壬水可用，得甲木制戊方吉；但甲须隔位，不可近己贪合，且不宜庚出制甲。此类重在甲木隔位护水制土，层次虽不及壬庚两透无戊，仍可作方吉看待。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['戊', '甲', '己'],
    forbiddenVisibleStems: ['庚'],
    minStemTotalCounts: {
      壬: 1,
    },
    requiredVisibleStemDistancePairs: [
      {
        stems: ['甲', '己'],
        minDistance: 2,
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:戊出而得甲制', '成格关键:甲木隔位，不与己合', '成格层次:方吉'],
    hint: '辛金未月戊出而得甲隔位制土，方可言吉',
  },
  {
    id: 'wei-month-xin-ren-geng-hidden-glory',
    label: '辛日未月壬庚藏支得所荣华规则',
    description:
      '辛金生未月，壬庚即不出干而能同藏得所，传统亦许荣华；此层次虽不及两透科甲，但明显高于普通土厚金埋之局。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '庚'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '庚'],
        minDistinctCount: 2,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['取用层次:壬庚不透，藏支得所', '成格层次:亦有荣华'],
    hint: '辛金未月壬庚虽不透而藏支得所，亦有荣华',
  },
  {
    id: 'wei-month-xin-wood-formation-ren-visible-geng-total',
    label: '辛日未月木局壬透见庚富贵规则',
    description:
      '辛金生未月，若地支成木局而壬水透干，又有庚金发源，最合原文富贵层次，不应仍按普通土厚金埋概论。',
    months: ['未'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['木'],
    requiredVisibleStems: ['壬'],
    minStemTotalCounts: {
      庚: 1,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '金', '木'],
    traceHints: ['取用层次:木局成势，壬透庚发源', '成格层次:可云富贵'],
    hint: '辛金未月支成木局而壬透见庚，可云富贵',
  },
];
