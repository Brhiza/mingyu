import type { ClimateRule } from '../../types';

export const XIN_XU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'xu-month-xin-ren-jia-all',
    label: '辛日戌月壬甲两透桃洞规则',
    description:
      '辛金生戌月，土厚金埋，传统先壬后甲；若壬甲两透，正合洗金疏土之法，多主清贵上达，不应仍按普通秋金论。',
    months: ['戌'],
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
    traceHints: ['取用层次:先壬后甲', '成格层次:壬甲两透，桃洞之仙'],
    hint: '辛金戌月壬甲两透，多主清贵上达',
  },
  {
    id: 'xu-month-xin-jia-visible-ren-hidden',
    label: '辛日戌月甲透壬藏异途规则',
    description:
      '辛金生戌月，若甲木透干、壬水藏支，传统多许异途之仕；此仍属壬甲有情，不应误作壬甲两无。',
    months: ['戌'],
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
    traceHints: ['取用层次:甲木透干，壬水藏支', '成格层次:异途之仕'],
    hint: '辛金戌月甲透壬藏，可作异途之仕',
  },
  {
    id: 'xu-month-xin-ren-visible-jia-hidden-with-wu',
    label: '辛日戌月壬透甲藏又见戊平人规则',
    description:
      '辛金生戌月，若壬水透干、甲木只藏支内，而戊土又出天干，较合核校后原文"壬透甲藏，又见戊者，平人"；此时壬虽能洗金，终被戊土壅塞，不能仍按桃洞或异途之仕高断。',
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬', '戊'],
    requiredHiddenStems: ['甲'],
    forbiddenVisibleStems: ['甲'],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:壬透甲藏而又见戊', '成格层次:只作平人'],
    hint: '辛金戌月壬透甲藏而又见戊，只作平人',
  },
  {
    id: 'xu-month-xin-heavy-earth-ren-visible-jia-hidden-rich',
    label: '辛日戌月土厚甲不透壬出富可求规则',
    description:
      '辛金生戌月，若土势偏厚，甲木不出而只藏支内，壬水一透洗土助甲，较合原文"土太多，甲不出干，一壬出，虽不发达，富而可求"；此类不应误混入桃洞或平人之断。',
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    requiredHiddenStems: ['甲'],
    forbiddenVisibleStems: ['甲'],
    minWuxingCounts: {
      土: 4,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:土厚而甲不出干，得壬洗土助甲', '成格层次:虽不发达，富而可求'],
    hint: '辛金戌月土厚而甲不透，若壬水出干，多主富而可求',
  },
  {
    id: 'xu-month-xin-wood-many-earth-thick-no-water-ordinary',
    label: '辛日戌月木多土厚无水常人规则',
    description:
      '辛金生戌月，若木多而土亦厚，却全无壬癸润洗，较合原文"木多土厚，无水者常人"；此类不应仍按木土两旺便许富贵。',
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minWuxingCounts: {
      木: 3,
      土: 3,
    },
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
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['破格因素:木多土厚，而全无壬癸', '成格层次:常人'],
    hint: '辛金戌月木多土厚而无壬癸，多作常人',
  },
  {
    id: 'xu-month-xin-wood-earth-double-gui-rich-hardship',
    label: '辛日戌月木土厚重癸重见富而辛苦规则',
    description:
      '辛金生戌月，若木多土厚，本非上格；但天干重见癸水，虽无壬水淘洗之功，仍有清金之用，较合原文"干上重见癸水，此命主富，辛苦"，不应仍按无水常人处理。',
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minWuxingCounts: {
      木: 3,
      土: 3,
    },
    minVisibleStemCounts: {
      癸: 2,
    },
    maxStemTotalCounts: {
      壬: 0,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:木多土厚，而干上重见癸水', '成格层次:主富，辛苦'],
    hint: '辛金戌月木土厚重而癸水重见，多主富而辛苦',
  },
  {
    id: 'xu-month-xin-ji-visible-gui-no-ren-scholarly',
    label: '辛日戌月己透无壬有癸衣衿规则',
    description:
      '辛金生戌月，若己土透干而无壬、有癸，较合原文"己透无壬有癸，亦能滋生金力，衣衿之贵"；此类属于癸水权代，不应仍按无水常人论。',
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['己', '癸'],
    forbiddenVisibleStems: ['壬'],
    maxStemTotalCounts: {
      己: 1,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['取用层次:己土透干，无壬而有癸', '成格层次:衣衿之贵'],
    hint: '辛金戌月己透而无壬有癸，可许衣衿之贵',
  },
  {
    id: 'xu-month-xin-many-ji-gui-no-ren-cloudy-rich',
    label: '辛日戌月己多无壬有癸浊富规则',
    description:
      '辛金生戌月，若己土偏多而壬水不见，仅赖癸水权代，较合原文"但恐己多，不免浊富"；此类应低于衣衿之贵，高于无水常人。',
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['癸'],
    forbiddenVisibleStems: ['壬'],
    minStemTotalCounts: {
      己: 2,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '土'],
    traceHints: ['破格因素:己土偏多，而无壬仅赖癸水', '成格层次:不免浊富'],
    hint: '辛金戌月己多无壬而有癸，多主浊富',
  },
  {
    id: 'xu-month-xin-no-ren-jia-bing-xin-slight-noble',
    label: '辛日戌月土多无壬甲丙辛略贵规则',
    description:
      '辛金生戌月，若土势偏厚而壬甲全无，但月时又多透丙辛，较合原文"土多无壬甲，时月多透丙辛者，略贵"；此类虽非上格，却高于纯粹土厚埋金之常局。',
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStemPillarPairs: [
      {
        stem: '丙',
        pillars: ['month', 'hour'],
      },
      {
        stem: '辛',
        pillars: ['month', 'hour'],
      },
    ],
    maxStemTotalCounts: {
      壬: 0,
      甲: 0,
    },
    minWuxingCounts: {
      土: 3,
    },
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '木'],
    traceHints: ['取用层次:土多无壬甲，而时月多透丙辛', '成格层次:略贵'],
    hint: '辛金戌月土多而壬甲俱无，若时月多透丙辛，亦可略贵',
  },
  {
    id: 'xu-month-xin-no-ren-jia-bing-xin-with-chen-glory',
    label: '辛日戌月土多无壬甲丙辛见辰荣显规则',
    description:
      '辛金生戌月，承上式若再见辰字在支，较合原文"加以辰字在支，则荣显莫及"；此条应高于仅作略贵之断，不可仍与前式并论。',
    months: ['戌'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStemPillarPairs: [
      {
        stem: '丙',
        pillars: ['month', 'hour'],
      },
      {
        stem: '辛',
        pillars: ['month', 'hour'],
      },
    ],
    requiredBranchPillarPairs: [
      {
        branch: '辰',
      },
    ],
    maxStemTotalCounts: {
      壬: 0,
      甲: 0,
    },
    minWuxingCounts: {
      土: 3,
    },
    usefulWuxing: '火',
    favorableOrder: ['火', '水', '木'],
    traceHints: ['取用层次:土多无壬甲，而时月多透丙辛', '成格关键:支再见辰', '成格层次:荣显莫及'],
    hint: '辛金戌月土多无壬甲，若时月多透丙辛而支见辰，多主荣显',
  },
];
