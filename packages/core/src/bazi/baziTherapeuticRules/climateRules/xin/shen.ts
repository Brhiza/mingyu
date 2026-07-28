import type { ClimateRule } from '../../types';

export const XIN_SHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'shen-month-xin-metal-rich-ren-jia-single-wu',
    label: '辛日申月金多壬透一戊见甲富贵规则',
    description:
      '辛金生申月，若四柱金多而得壬水透干泄秀，又止存一位戊土为卫，再有甲木制戊，则金水流通而不致壅滞，较合原文"若一金水，得一戊土，又宜甲制，自然富贵"之意。',
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    minStemTotalCounts: {
      甲: 1,
      壬: 1,
      戊: 1,
    },
    maxStemTotalCounts: {
      癸: 0,
      戊: 1,
    },
    minWuxingCounts: {
      金: 4,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:金多得壬泄秀，一戊为卫', '成格关键:甲木制戊', '成格层次:自然富贵'],
    hint: '辛金申月金多而壬透、一戊得甲制，多主自然富贵',
  },
  {
    id: 'shen-month-xin-ren-in-shen-no-extra-wu',
    label: '辛日申月壬居申中无额外戊清正规则',
    description:
      '辛金生申月，庚令当权而壬水居申，若全局不再另见戊土，止存申中一戊为壬岸，最合原文"为官清正，但不富耳"之旨，不应混入土重有病之局。',
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    forbiddenVisibleStems: ['癸'],
    requiredHiddenStemBranchPairs: [
      {
        branch: '申',
        stem: '壬',
        pillars: ['month'],
      },
    ],
    maxStemTotalCounts: {
      戊: 1,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:壬水居申，戊止申中为岸', '成格层次:为官清正，但不富耳'],
    hint: '辛金申月壬居申中而不另见戊土，多主官清而不富',
  },
  {
    id: 'shen-month-xin-water-rich-wu-supported-longevity',
    label: '辛日申月水多戊重得生福寿规则',
    description:
      '辛金生申月，若干支水多而戊土重见，再得火气生扶戊土，使堤岸有根，较合原文"干支水多，重见戊土，逢生得位，福寿之造"之意，不应与普通土重无甲混作常人格。',
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minStemTotalCounts: {
      戊: 2,
    },
    minWuxingCounts: {
      水: 4,
      火: 1,
    },
    usefulWuxing: '土',
    favorableOrder: ['土', '水'],
    traceHints: ['取用层次:干支水多，重见戊土', '成格关键:戊土得火生扶', '成格层次:福寿之造'],
    hint: '辛金申月干支水多而戊土重见并得火生，多主福寿',
  },
  {
    id: 'shen-month-xin-earth-with-jia',
    label: '辛日申月有土见甲衣衿规则',
    description:
      '辛金生申月，若局中土气再增，便成有病之象；此时得甲木疏土，传统多许衣衿可望，不应仍与无甲常人并断。',
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minStemTotalCounts: {
      甲: 1,
    },
    minTenGodCategoryTotalCounts: {
      印星: 2,
    },
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['取用层次:土重得甲疏通', '成格层次:衣衿可望'],
    hint: '辛金申月局中有土而得甲木疏之，可望衣衿',
  },
  {
    id: 'shen-month-xin-earth-no-jia',
    label: '辛日申月有土无甲常人规则',
    description:
      '辛金生申月，若局中土气再增而甲木不出，则成有病无药，传统只作常人，不应误抬到衣衿或富贵层次。',
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    maxStemTotalCounts: {
      甲: 0,
    },
    minTenGodCategoryTotalCounts: {
      印星: 2,
    },
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['破格因素:土重而无甲疏土', '成格层次:有病无药，常人'],
    hint: '辛金申月局中有土而不见甲木，多作常人',
  },
  {
    id: 'shen-month-xin-gui-only-not-usable',
    label: '辛日申月独癸不可为用规则',
    description:
      '辛金生申月，总纲明言壬水为尊、甲戊酌用，而癸水不可为用。若天干只见癸而不见壬透，则不应仍按秋金喜水的泛化总纲直接先取水，而应退取甲戊。',
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['癸'],
    forbiddenVisibleStems: ['壬'],
    usefulWuxing: '木',
    favorableOrder: ['木', '土', '水'],
    traceHints: [
      '取用总纲:壬水为尊，甲戊酌用',
      '破格因素:独见癸水，不可为用',
      '取用调整:退取甲木与戊土',
    ],
    hint: '辛金申月若只见癸而不见壬，不宜仍先取水，当退取甲戊',
  },
  {
    id: 'shen-month-xin-metal-many-shallow-water-balance',
    label: '辛日申月水浅金多体全规则',
    description:
      '辛金生申月，原文总纲明言"壬不在多，水浅金多，号曰体全之象，壬水为尊，甲戊酌用可也"。因此当局中金气偏多、壬水已透而不过多时，应独立标出此条，不应仍只停留在泛化秋金喜水，亦不可把多壬之局混入此象。',
    months: ['申'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    minWuxingCounts: {
      金: 4,
    },
    maxWuxingCounts: {
      水: 3,
    },
    maxVisibleStemCounts: {
      壬: 1,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '木', '土'],
    traceHints: ['取用总纲:水浅金多，号曰体全之象', '取用层次:壬水为尊，甲戊酌用'],
    hint: '辛金申月金多水浅而壬透不过多，可作体全之象，仍以壬为尊',
  },
];
