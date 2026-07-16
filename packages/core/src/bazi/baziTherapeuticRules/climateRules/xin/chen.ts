import type { ClimateRule } from '../../types';

export const XIN_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-xin-ren-jia-all',
    label: '辛日辰月壬甲两透富贵规则',
    description:
      '辛金生辰月，土旺金相，传统先壬后甲；若壬甲两透，最合洗金疏土之法，多主富贵，不应仍按普通春金泛断。',
    priority: 123,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '甲'],
        minDistinctCount: 2,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:先壬后甲', '传统成格原文:壬甲两透，古法视为富贵格候选'],
    hint: '辛金辰月壬甲两透，多主富贵',
  },
  {
    id: 'chen-month-xin-ren-visible-jia-hidden',
    label: '辛日辰月壬透甲藏廪贡规则',
    description:
      '辛金生辰月，若壬水透干、甲木藏支，亦合先壬后甲之序，但层次低于壬甲并透，传统多主廪贡不失。',
    priority: 122,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    requiredHiddenStems: ['甲'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '甲'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:壬水透干，甲木藏支', '成格层次:廪贡不失'],
    hint: '辛金辰月壬透甲藏，可许廪贡',
  },
  {
    id: 'chen-month-xin-jia-visible-ren-hidden',
    label: '辛日辰月甲透壬藏富贵可云规则',
    description:
      '辛金生辰月，若甲木透干、壬水藏支，虽不及壬甲并透得力，传统仍许富贵可云，不宜误落到平常格。',
    priority: 121,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['甲'],
    requiredHiddenStems: ['壬'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '甲'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['取用层次:甲木透干，壬水藏支', '成格层次:富贵可云'],
    hint: '辛金辰月甲透壬藏，亦可云富贵',
  },
  {
    id: 'chen-month-xin-no-ren-no-jia',
    label: '辛日辰月壬甲皆无平常规则',
    description:
      '辛金生辰月，若壬甲皆无，则洗金疏土之药两失，传统只作平常之格，不宜抬高到壬甲得用层次。',
    priority: 120,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '甲'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '甲'],
        maxDistinctCount: 0,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:壬甲皆无', '成格层次:平常之格'],
    hint: '辛金辰月壬甲皆无，只作平常之格',
  },
  {
    id: 'chen-month-xin-double-bing-with-gui-scholarly',
    label: '辛日辰月月时皆丙得癸制丙采芹规则',
    description:
      '辛金生辰月，若月时两透丙火，本属争合；但若癸水出干制丙，较合原文"若癸出干制丙，可许采芹"，层次高于单纯争合风流。',
    priority: 126,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStemPillarPairs: [
      {
        stem: '丙',
        pillars: ['month'],
      },
      {
        stem: '丙',
        pillars: ['hour'],
      },
    ],
    requiredVisibleStems: ['癸'],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:月时皆丙，而得癸水制丙', '成格层次:可许采芹'],
    hint: '辛金辰月月时皆丙，若得癸水出干制丙，可许采芹',
  },
  {
    id: 'chen-month-xin-double-bing-argue-combine',
    label: '辛日辰月月时皆丙争合风流规则',
    description:
      '辛金生辰月，若月时皆透丙火，较合原文"如月时皆丙，名为争合，主慷慨风流，交四海"；此类不应误作壬甲得用之贵格。',
    priority: 125,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStemPillarPairs: [
      {
        stem: '丙',
        pillars: ['month'],
      },
      {
        stem: '丙',
        pillars: ['hour'],
      },
    ],
    forbiddenVisibleStems: ['癸'],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:月时皆丙，争合辛金', '成格层次:慷慨风流，交四海'],
    hint: '辛金辰月月时皆丙，多主争合风流',
  },
  {
    id: 'chen-month-xin-hai-zi-land-with-shen-rank',
    label: '辛日辰月支坐亥子之乡又见申高禄规则',
    description:
      '辛金生辰月，若地支得亥子水乡，又见申金发源，较合原文"支坐亥子之乡，支又见申，即非玉堂，亦必高增禄位"；此类不应退回平常格。',
    priority: 124,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredBranchPillarPairs: [
      {
        branch: '申',
      },
    ],
    optionalBranchPillarPairs: [
      {
        branch: '亥',
      },
      {
        branch: '子',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['取用层次:支坐亥子之乡，支又见申', '成格层次:高增禄位'],
    hint: '辛金辰月若支得亥子之乡而又见申，多主高增禄位',
  },
  {
    id: 'chen-month-xin-wu-control-water-no-jia-yi-leisure',
    label: '辛日辰月戊出制水不见甲乙清闲规则',
    description:
      '辛金生辰月，若戊土出干制水，而甲乙不出疏土，较合原文"若戊出干制水，不见甲乙，清闲之人"；此类不应误抬到富贵层次。',
    priority: 124,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['戊'],
    forbiddenVisibleStems: ['甲', '乙'],
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        scope: 'total',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['破格因素:戊土出干制水，不见甲乙', '成格层次:清闲之人'],
    hint: '辛金辰月戊土出而制水，若不见甲乙，多作清闲之人',
  },
  {
    id: 'chen-month-xin-four-storage-no-jia-dull',
    label: '辛日辰月支见四库无甲愚顽规则',
    description:
      '辛金生辰月，若四支皆见辰戌丑未四库，而甲木不出制土，较合原文"支见四库，名土厚埋金，不见甲制，愚顽之辈"；此类应高于普通辰月平常格。',
    priority: 125,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredBranchPillarPairs: [
      {
        branch: '辰',
      },
      {
        branch: '戌',
      },
      {
        branch: '丑',
      },
      {
        branch: '未',
      },
    ],
    forbiddenVisibleStems: ['甲'],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['破格因素:支见四库，土厚埋金', '成格层次:愚顽之辈'],
    hint: '辛金辰月若四支见四库而不见甲，多主愚顽',
  },
  {
    id: 'chen-month-xin-fire-many-with-gui-relief',
    label: '辛日辰月火多得癸可解规则',
    description:
      '辛金生辰月，若四柱火多，本属火土杂乱；但若癸水出干，较合原文"见癸可解"，不应仍按缁衣之格直断。',
    priority: 126,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minWuxingCounts: {
      火: 3,
    },
    requiredVisibleStems: ['癸'],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:四柱火多，而得癸水制火', '成格关键:见癸可解'],
    hint: '辛金辰月火多而得癸水出干，可作有救之局',
  },
  {
    id: 'chen-month-xin-fire-many-no-water-monastic',
    label: '辛日辰月火多无水缁衣规则',
    description:
      '辛金生辰月，若四柱火多而无壬癸透制，较合原文"火土杂乱，主作缁衣"；此类不应仍按一般春金取水收束。',
    priority: 125,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minWuxingCounts: {
      火: 3,
    },
    forbiddenVisibleStems: ['壬', '癸'],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:四柱火多，无水制伏', '成格层次:主作缁衣'],
    hint: '辛金辰月火多而无壬癸制伏，多主缁衣',
  },
  {
    id: 'chen-month-xin-companions-heavy-water-weak-jia-noble',
    label: '辛日辰月比劫重重甲出无庚贵规则',
    description:
      '辛金生辰月，若比劫重重、壬癸浅弱，本有夭折之忧；但甲木透干而不见庚制，较合原文"有甲出干，则贵，然无庚制方妙"，应高于主夭之断。',
    priority: 126,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minCompanionVisibleCount: 2,
    requiredVisibleStems: ['甲'],
    forbiddenVisibleStems: ['庚'],
    maxWuxingCounts: {
      水: 2,
    },
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['取用层次:比劫重重，而甲木出干', '成格关键:无庚制甲方妙', '成格层次:则贵'],
    hint: '辛金辰月比劫重重而得甲出、不见庚，多可言贵',
  },
  {
    id: 'chen-month-xin-companions-heavy-water-weak-early-loss',
    label: '辛日辰月比劫重重壬癸浅弱主夭规则',
    description:
      '辛金生辰月，若比劫重重而壬癸浅弱，较合原文"主夭"；此类应与一般辰月平常格分开，不可因日主有根而轻忽。',
    priority: 125,
    months: ['辰'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minCompanionVisibleCount: 2,
    forbiddenVisibleStems: ['甲'],
    maxWuxingCounts: {
      水: 2,
    },
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['破格因素:比劫重重，壬癸浅弱', '成格层次:主夭'],
    hint: '辛金辰月比劫重重而壬癸浅弱，多主夭折之忧',
  },
];
