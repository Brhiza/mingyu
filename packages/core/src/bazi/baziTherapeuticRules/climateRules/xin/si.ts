import type { ClimateRule } from '../../types';

export const XIN_SI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'si-month-xin-metal-formation-water-wood-clarity',
    label: '辛日巳月金局水透木制戊科甲规则',
    description:
      '辛金生巳月，若地支成金局，水气透干洗淘，又得木来制戊，较合原文"支成金局，水透出干，有木制戊，名一清澈底，科甲功名"；此类应高于一般夏辛喜水的泛化总纲。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['金'],
    minStemTotalCounts: {
      戊: 1,
    },
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['甲', '乙'],
        minDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:支成金局，水透出干，木来制戊', '成格层次:一清澈底，科甲功名'],
    hint: '辛金巳月支成金局而水透木制戊，多主科甲功名',
  },
  {
    id: 'si-month-xin-ren-hai-hidden-no-wu',
    label: '辛日巳月壬藏亥中无戊上达规则',
    description:
      '辛金生巳月，若壬水只藏亥支而不透，且戊土不出天干，仍得暗中淘洗之机，传统多许上达，不应混入壬癸全无之局。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    forbiddenVisibleStems: ['甲'],
    requiredHiddenStemBranchPairs: [
      {
        branch: '亥',
        stem: '壬',
      },
    ],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'hidden',
      },
      {
        stems: ['戊'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:壬水藏亥，戊不出干', '成格层次:亦主上达'],
    hint: '辛金巳月壬水藏亥而戊不透，亦主上达',
  },
  {
    id: 'si-month-xin-gui-visible-ren-hidden',
    label: '辛日巳月癸透壬藏富真贵假规则',
    description:
      '辛金生巳月，畏火喜水；若癸水透干、壬水藏支，既得洗淘又未成澄澈，传统多断富真贵假，不应与壬水高透科甲同论。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['癸'],
    requiredHiddenStems: ['壬'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:癸透壬藏', '成格层次:富真贵假'],
    hint: '辛金巳月癸透壬藏，多主富真贵假',
  },
  {
    id: 'si-month-xin-ren-hai-hidden-with-wu',
    label: '辛日巳月壬藏亥中见戊常人规则',
    description:
      '辛金生巳月，若壬水虽藏亥支而戊土透干，则暗水受遏，传统只作常人格局，不宜仍许上达。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['戊'],
    forbiddenVisibleStems: ['甲'],
    requiredHiddenStemBranchPairs: [
      {
        branch: '亥',
        stem: '壬',
      },
    ],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:壬水藏亥而戊出', '成格层次:只作常人'],
    hint: '辛金巳月壬水藏亥而戊透，只作常人格局',
  },
  {
    id: 'si-month-xin-ren-hai-jia-visible',
    label: '辛日巳月壬藏亥中甲透衣禄规则',
    description:
      '辛金生巳月，若壬水藏亥而再得一甲透，能疏土护水，传统多许衣禄可求；此时不论戊是否透出，都不应仍混入上达或常人的宽泛写法。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['甲'],
    requiredHiddenStemBranchPairs: [
      {
        branch: '亥',
        stem: '壬',
      },
    ],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['取用层次:壬藏亥中，甲木透干', '成格层次:衣禄可求'],
    hint: '辛金巳月壬藏亥中而甲木透干，衣禄可求',
  },
  {
    id: 'si-month-xin-ren-gui-hidden-wu-ji-hidden',
    label: '辛日巳月壬癸戊己皆藏略富规则',
    description:
      '辛金生巳月，若壬癸皆藏而不透，戊己亦俱藏不出，既有暗水洗淘，又未遭燥土显遏，传统多许略富，不应混入壬癸全无或火透鳏独之局。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    forbiddenVisibleStems: ['甲'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['戊', '己'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        minDistinctCount: 2,
        scope: 'hidden',
      },
      {
        stems: ['戊', '己'],
        minDistinctCount: 2,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:壬癸皆藏，戊己亦藏', '成格层次:略富'],
    hint: '辛金巳月壬癸皆藏、戊己亦藏，多主略富',
  },
  {
    id: 'si-month-xin-fire-formation-water-control',
    label: '辛日巳月火局得水制吉规则',
    description:
      '辛金生巳月，若地支成火局而复得水制，火势虽炽而尚可节，传统谓有制者吉，不应仍混作纯火无制之凶局。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['火'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        scope: 'total',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['取用层次:支成火局，得水制火', '成格层次:有制则吉'],
    hint: '辛金巳月支成火局而得水制，方可言吉',
  },
  {
    id: 'si-month-xin-fire-formation-no-water-earth',
    label: '辛日巳月火局无水取土规则',
    description:
      '辛金生巳月，若地支成火局而全无壬癸，火势无制，传统即谓凶；病药上则退而取土泄火，不应仍只按一般见火处理。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['火'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '土',
    favorableOrder: ['土', '水'],
    traceHints: ['破格因素:支成火局而无水制火', '取用层次:火旺无水，取土泄之'],
    hint: '辛金巳月支成火局而无水，宜取土泄火',
  },
  {
    id: 'si-month-xin-no-ren-gui-fire-lonely',
    label: '辛日巳月壬癸俱无见火鳏独规则',
    description:
      '辛金生巳月，若壬癸俱无而反见火透，洗淘既失又遭火烈，传统多断鳏独，不宜仍按普通夏金扶抑轻轻带过。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'hidden',
      },
      {
        stems: ['丙', '丁'],
        minDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:壬癸俱无而火出', '成格层次:必主鳏独'],
    hint: '辛金巳月壬癸俱无而火透，多主鳏独',
  },
  {
    id: 'si-month-xin-jia-no-ren-gui',
    label: '辛日巳月有甲无壬癸虚浮规则',
    description:
      '辛金生巳月，若甲木透干而壬癸全无，虽似有药，实则无水洗金，传统多断富贵虚浮，不应误提到真贵层次。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['甲'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['破格因素:有甲无壬癸', '成格层次:富贵虚浮'],
    hint: '辛金巳月有甲而无壬癸，多主富贵虚浮',
  },
  {
    id: 'si-month-xin-no-ren-gui-jia',
    label: '辛日巳月壬癸甲全无下品规则',
    description:
      '辛金生巳月，壬癸甲三者全无，则淘洗、润泽、疏通之药俱失；传统于普通格中多断下品，不应再抬到衣禄或富贵层次。',
    months: ['巳'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸', '甲'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸', '甲'],
        maxDistinctCount: 0,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:壬癸甲三者全无', '成格层次:下品之格'],
    hint: '辛金巳月壬癸甲三者全无，只作下品',
  },
];
