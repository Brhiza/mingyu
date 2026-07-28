import type { ClimateRule } from '../../types';

export const XIN_YOU_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'you-month-xin-pure-xin-single-ren',
    label: '辛日酉月一派辛金一壬无庚富贵规则',
    description:
      '辛金生酉月，若天干纯见辛金而只得一位壬水，且不杂庚与他神，最合淘洗群金之法，传统多主富中取贵。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    minVisibleStemCounts: {
      辛: 3,
    },
    maxVisibleStemCounts: {
      壬: 1,
    },
    distinctStemGroupCounts: [
      {
        stems: ['庚', '辛'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    maxTenGodCategoryVisibleDistinctCounts: {
      财星: 0,
      官杀: 0,
      印星: 0,
    },
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:一派辛金，一位壬水', '成格层次:富中取贵'],
    hint: '辛金酉月一派辛金而只见一壬、无庚杂乱，多主富中取贵',
  },
  {
    id: 'you-month-xin-ren-jia-single-no-geng',
    label: '辛日酉月壬甲各一无庚恩荣规则',
    description:
      '辛金生酉月，若比肩一二、壬甲各一而庚不出干，传统亦许恩荣；此类重在壬甲适度而不杂庚，不应误作土厚埋金或壬水无力之格。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬', '甲'],
    minVisibleStemCounts: { 辛: 2 },
    maxVisibleStemCounts: { 辛: 3, 壬: 1, 甲: 1 },
    distinctStemGroupCounts: [
      {
        stems: ['庚', '辛'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '木'],
    traceHints: ['取用层次:壬甲皆一，比肩相随', '成格层次:亦有恩荣'],
    hint: '辛金酉月比肩一二而壬甲各一、无庚杂乱，亦有恩荣',
  },
  {
    id: 'you-month-xin-ren-many-jia-no-geng',
    label: '辛日酉月一壬甲多无庚奸诈规则',
    description:
      '辛金生酉月，若只一壬透而甲木偏多，水被群甲泄去，用神无力；又不见庚金制甲，传统多断奸诈之徒，不应仍按壬甲适度的恩荣层次看待。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    maxVisibleStemCounts: {
      壬: 1,
    },
    minStemTotalCounts: {
      甲: 2,
    },
    maxStemTotalCounts: {
      庚: 0,
    },
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    traceHints: ['破格因素:一壬被群甲泄气', '成格关键:无庚制甲', '成格层次:奸诈之徒'],
    hint: '辛金酉月一壬而甲多、又无庚制甲，多主奸诈',
  },
  {
    id: 'you-month-xin-ren-many-jia-with-geng',
    label: '辛日酉月一壬甲多得庚仁义规则',
    description:
      '辛金生酉月，若一壬透而甲木偏多，本有泄水之患；但再得庚金制甲，则可挽回用神无力之弊，传统多主仁义，不应仍按奸诈之徒下断。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    maxVisibleStemCounts: {
      壬: 1,
    },
    minStemTotalCounts: {
      甲: 2,
      庚: 1,
    },
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    traceHints: ['取用层次:一壬甲多而得庚制甲', '成格关键:庚金护壬', '成格层次:反主仁义'],
    hint: '辛金酉月一壬而甲多，若得庚制甲，反主仁义',
  },
  {
    id: 'you-month-xin-three-xin-single-ren-many-jia-geng-rich',
    label: '辛日酉月三辛一壬甲多庚透大富贵规则',
    description:
      '辛金生酉月，若辛金总见三重以上、一壬明透、甲木偏多而再得庚金透出制甲，较"得庚制甲反主仁义"更进一步，对应原文"三点辛金，一重壬水，多见甲木，有庚透者，主大富贵"；这里将"三点辛金"落为辛金总量三重以上，以免与"庚透"在四柱明干上发生结构冲突。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬', '庚'],
    maxVisibleStemCounts: {
      壬: 1,
    },
    minStemTotalCounts: {
      辛: 3,
      甲: 2,
    },
    maxStemTotalCounts: {
      丁: 0,
    },
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    traceHints: ['取用层次:三辛一壬，甲多得庚', '成格关键:庚透制甲而护壬', '成格层次:主大富贵'],
    hint: '辛金酉月三辛一壬、甲多而庚透制甲，不见丁者，主大富贵',
  },
  {
    id: 'you-month-xin-three-xin-single-ren-many-jia-geng-ding-refined',
    label: '辛日酉月三辛一壬甲多庚透见丁降格规则',
    description:
      '辛金生酉月，若已成三辛一壬、甲多得庚之局，但再见一丁，则不复按"大富贵"取象，应依原文降为"风雅清高，衣食饶裕而已"；这里将"见丁"按总见丁火处理，不限于明透，以贴近传统"见"字口径。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬', '庚'],
    maxVisibleStemCounts: {
      壬: 1,
    },
    minStemTotalCounts: {
      辛: 3,
      甲: 2,
      丁: 1,
    },
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    traceHints: [
      '取用层次:三辛一壬，甲多得庚',
      '破格因素:见丁火改变原取用条件',
      '成格层次:风雅清高，衣食饶裕',
    ],
    hint: '辛金酉月三辛一壬、甲多而庚透，若再见丁火，则多主风雅清高，衣食饶裕',
  },
  {
    id: 'you-month-xin-soil-bury-metal-no-jia',
    label: '辛日酉月土厚埋金愚懦规则',
    description:
      '辛金生酉月，若辛金根气已成、总见二重以上而只一壬水，复见戊土偏多，则成土厚埋金之象；若又不见甲木疏土，传统多主愚懦，不应仍按壬甲恩荣或富中取贵论。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬'],
    maxStemTotalCounts: {
      壬: 1,
      甲: 0,
    },
    minStemTotalCounts: {
      辛: 2,
      戊: 2,
    },
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['破格因素:土厚埋金，一壬难润', '成格层次:此人愚懦'],
    hint: '辛金酉月比肩并见而一壬、戊土多见又无甲，多主愚懦',
  },
  {
    id: 'you-month-xin-soil-bury-metal-with-jia',
    label: '辛日酉月土厚埋金见甲创立规则',
    description:
      '辛金生酉月，若辛金根气已成、总见二重以上，一壬而戊土多见，本为土厚埋金；但若甲木透出疏土，则格局转活，传统多主创立有为，不应仍按愚懦层次处理。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['壬', '甲'],
    maxStemTotalCounts: {
      壬: 1,
    },
    minStemTotalCounts: {
      辛: 2,
      戊: 2,
    },
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['取用层次:土厚埋金而甲木透出', '成格关键:甲木疏土', '成格层次:必为创立之人'],
    hint: '辛金酉月土厚埋金，若得甲木透出疏土，多主创立有为',
  },
  {
    id: 'you-month-xin-metal-formation-no-ren-with-ding',
    label: '辛日酉月金局无壬见丁锻炼规则',
    description:
      '辛金生酉月，若支成金局而无壬淘洗，传统总纲先改以丁火为先；若柱中又已见丁火锻炼，则局不至落入凶顽无赖，此时重在得丁为药，不应再与无丁同断。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['金'],
    minVisibleStemCounts: {
      辛: 2,
    },
    minStemTotalCounts: {
      丁: 1,
    },
    distinctStemGroupCounts: [
      {
        stems: ['壬'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬'],
        maxDistinctCount: 0,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: ['取用层次:支成金局，无壬淘洗', '用神转换:此宜用丁', '成格关键:得丁锻炼'],
    hint: '辛金酉月支成金局而无壬淘洗，已见丁火锻炼',
  },
  {
    id: 'you-month-xin-metal-formation-no-ren-no-ding',
    label: '辛日酉月金局无壬无丁凶顽规则',
    description:
      '辛金生酉月，若支成金局、干见比肩而壬水不透不藏，传统总纲先改以丁火为先；若又无丁火锻炼，则直断凶顽无赖，不应只停留在抽象宜丁层面。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['金'],
    minVisibleStemCounts: {
      辛: 2,
    },
    forbiddenVisibleStems: ['丁'],
    forbiddenHiddenStems: ['丁'],
    distinctStemGroupCounts: [
      {
        stems: ['壬'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬'],
        maxDistinctCount: 0,
        scope: 'hidden',
      },
    ],
    usefulWuxing: '火',
    favorableOrder: ['火', '水'],
    traceHints: [
      '取用层次:支成金局，无壬淘洗',
      '用神转换:此宜用丁',
      '破格因素:金局无壬且无丁',
      '成格层次:凶顽无赖',
    ],
    hint: '辛金酉月支成金局而无壬无丁，多主凶顽无赖',
  },
  {
    id: 'you-month-xin-metal-formation-ren-high',
    label: '辛日酉月金局壬高透一清到底规则',
    description:
      '辛金生酉月，若地支成金局而壬水高透，可泄群金成一清到底之象，传统多主清贵，不应仍按无壬金局用丁论。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['金'],
    requiredVisibleStems: ['壬'],
    minVisibleStemCounts: {
      辛: 2,
    },
    maxVisibleStemCounts: {
      辛: 4,
      壬: 1,
    },
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
    traceHints: ['取用层次:支成金局，壬水高透', '成格层次:一清到底'],
    hint: '辛金酉月支成金局而壬水高透，可成一清到底之象',
  },
  {
    id: 'you-month-xin-white-tiger',
    label: '辛日酉月金局土透壬透无火白虎规则',
    description:
      '辛金生酉月，若地支成金局，戊己透干而壬亦透、又无丙丁火破局，传统称白虎格，多主西北发显，不应与平常土重同断。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['金'],
    requiredVisibleStems: ['壬'],
    forbiddenVisibleStems: ['丙', '丁'],
    distinctStemGroupCounts: [
      {
        stems: ['戊', '己'],
        minDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['取用层次:金局土透，壬透无火', '成格层次:白虎格'],
    hint: '辛金酉月支成金局而戊己透、壬透无火，可作白虎格',
  },
  {
    id: 'you-month-xin-white-tiger-with-fire-ordinary',
    label: '辛日酉月白虎格见丙火平庸规则',
    description:
      '辛金生酉月，白虎格最忌丙火破局；若金局土透而壬透，又见丙火，传统即降为平庸，不应仍按白虎格高断。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredFormationWuxings: ['金'],
    requiredVisibleStems: ['壬', '丙'],
    distinctStemGroupCounts: [
      {
        stems: ['戊', '己'],
        minDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '水',
    favorableOrder: ['水', '金'],
    traceHints: ['破格因素:白虎格见丙火', '成格层次:亦属平庸'],
    hint: '辛金酉月白虎格若透丙火，虽有壬出，亦属平庸',
  },
  {
    id: 'you-month-xin-pure-ji-monastic',
    label: '辛日酉月一派己土僧道规则',
    description:
      '辛金生酉月，若天干只见一二辛金而余皆己土，不杂庚戊与木火水神，正合原文"一二辛金，一派己土"，传统多断僧道，不应仍退回秋金泛取壬水。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minVisibleStemCounts: {
      辛: 1,
      己: 2,
    },
    maxVisibleStemCounts: {
      辛: 2,
    },
    distinctStemGroupCounts: [
      {
        stems: ['庚', '辛'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['戊', '己'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['甲', '乙'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['丙', '丁'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['破格因素:一派己土，壅金埋光', '成格层次:定为僧道'],
    hint: '辛金酉月一二辛金而一派己土，多主僧道',
  },
  {
    id: 'you-month-xin-ji-with-geng-jia-hidden-leisure',
    label: '辛日酉月己透支见庚甲安闲规则',
    description:
      '辛金生酉月，若己土透干而地支又见庚甲，较前式纯土壅金之局稍有转机，传统多主一生安闲，不应仍按僧道或普通秋金泛论。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['己'],
    requiredHiddenStems: ['庚', '甲'],
    distinctStemGroupCounts: [
      {
        stems: ['戊', '己'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
    ],
    usefulWuxing: '木',
    favorableOrder: ['木', '金', '水'],
    traceHints: ['取用层次:己土透干，支见庚甲', '成格层次:一生安闲'],
    hint: '辛金酉月己土透干而地支又见庚甲，多主一生安闲',
  },
  {
    id: 'you-month-xin-water-flood-no-wu',
    label: '辛日酉月壬水成派无戊奔波规则',
    description:
      '辛金生酉月，若天干一派壬水泄金而无戊土出制或藏支止流，正合原文"沙水同流"之象，传统多主奔波贫苦，不应仍按秋金泛取水上断。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minVisibleStemCounts: {
      辛: 1,
      壬: 3,
    },
    maxVisibleStemCounts: {
      辛: 1,
    },
    maxStemTotalCounts: {
      戊: 0,
    },
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['庚', '辛'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['甲', '乙', '丙', '丁', '戊', '己'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
    ],
    usefulWuxing: '土',
    favorableOrder: ['土', '金'],
    traceHints: ['破格因素:壬水成派，无戊止流', '成格层次:沙水同流，奔波贫苦'],
    hint: '辛金酉月一派壬水泄金而无戊止流，多主奔波贫苦',
  },
  {
    id: 'you-month-xin-water-flood-hidden-wu-artistry',
    label: '辛日酉月壬水成派支见一戊才略规则',
    description:
      '辛金生酉月，若天干壬水成派泄金，本有沙水同流之患；但若地支独见一戊止流，则较合原文"支见一戊止流"，传统多主才略与艺术，不应仍按奔波贫苦处理。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minVisibleStemCounts: {
      辛: 1,
      壬: 3,
    },
    maxVisibleStemCounts: {
      辛: 1,
      戊: 0,
    },
    requiredHiddenStems: ['戊'],
    maxStemTotalCounts: {
      戊: 1,
    },
    distinctStemGroupCounts: [
      {
        stems: ['壬', '癸'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['庚', '辛'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['甲', '乙', '丙', '丁', '己'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
    ],
    usefulWuxing: '土',
    favorableOrder: ['土', '金', '水'],
    traceHints: ['取用层次:壬水成派，支见一戊止流', '成格层次:颇有才略，艺术过人'],
    hint: '辛金酉月一派壬水而地支独见一戊止流，多主才略与艺术',
  },
  {
    id: 'you-month-xin-yi-wood-no-geng-ren',
    label: '辛日酉月一派乙木无庚壬才多身弱规则',
    description:
      '辛金生酉月，若天干乙木成派而不见庚壬，正合原文"一派乙木，不见庚壬"，传统多断才多身弱，不应仍按秋金泛取壬水或误提到富贵层次。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    minVisibleStemCounts: {
      辛: 1,
      乙: 3,
    },
    maxVisibleStemCounts: {
      辛: 1,
    },
    distinctStemGroupCounts: [
      {
        stems: ['甲', '乙'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['庚', '辛'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['丙', '丁', '戊', '己'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
    ],
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    traceHints: ['破格因素:一派乙木，不见庚壬', '成格层次:才多身弱'],
    hint: '辛金酉月一派乙木而不见庚壬，多主才多身弱',
  },
  {
    id: 'you-month-xin-yi-wood-with-geng',
    label: '辛日酉月一派乙木见庚富贵规则',
    description:
      '辛金生酉月，若乙木成派，本有财多身弱之患；但一见庚金制乙，则较合原文"一见庚制，富贵可期"，不应仍按才多身弱处理。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    requiredVisibleStems: ['庚'],
    minVisibleStemCounts: {
      辛: 1,
      乙: 2,
    },
    maxVisibleStemCounts: {
      辛: 1,
    },
    distinctStemGroupCounts: [
      {
        stems: ['甲', '乙'],
        minDistinctCount: 1,
        maxDistinctCount: 1,
        scope: 'visible',
      },
      {
        stems: ['壬', '癸'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
      {
        stems: ['丙', '丁', '戊', '己'],
        maxDistinctCount: 0,
        scope: 'visible',
      },
    ],
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    traceHints: ['取用层次:一派乙木，得庚金裁制', '成格层次:富贵可期'],
    hint: '辛金酉月乙木成派而得庚金裁制，富贵可期',
  },
  {
    id: 'you-month-xin-wuzi-chaoyang-authority',
    label: '辛日酉月戊子时巳酉丑全位重权高规则',
    description:
      '辛金生酉月，若辛日而时上戊子成六阴朝阳，又见巳酉丑金局全、庚辛并见，则较单纯朝阳更进一层，对应原文"庚辛局全巳酉丑，位重权高"；这里将"局全"落为支见巳酉丑全备，并保留庚辛同见作为成局标志。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    hourBranches: ['子'],
    requiredVisibleStemPillarPairs: [
      {
        stem: '戊',
        pillars: ['hour'],
      },
    ],
    requiredBranchPillarPairs: [
      {
        branch: '巳',
      },
      {
        branch: '丑',
      },
    ],
    forbiddenVisibleStems: ['丙', '丁'],
    distinctStemGroupCounts: [
      {
        stems: ['庚', '辛'],
        minDistinctCount: 2,
        scope: 'total',
      },
    ],
    usefulWuxing: '土',
    favorableOrder: ['土', '金', '水'],
    traceHints: ['取象依据:六阴朝阳', '成格关键:庚辛并见，巳酉丑全', '成格层次:位重权高'],
    hint: '辛金酉月戊子时而巳酉丑金局全、庚辛并见，多主位重权高',
  },
  {
    id: 'you-month-xin-wuzi-chaoyang',
    label: '辛日酉月戊子时六阴朝阳规则',
    description:
      '辛金生酉月，若辛日时上戊子而不见丙丁离位，合乎原文"六辛日透戊子时，运喜西方，阴若朝阳"；该条属于更窄的时柱格象，应高于一般酉月辛金常规格局。',
    months: ['酉'],
    dayMasters: ['金'],
    dayStems: ['辛'],
    hourBranches: ['子'],
    requiredVisibleStemPillarPairs: [
      {
        stem: '戊',
        pillars: ['hour'],
      },
    ],
    forbiddenVisibleStems: ['丙', '丁'],
    usefulWuxing: '土',
    favorableOrder: ['土', '金', '水'],
    traceHints: ['取象依据:六阴朝阳', '成格关键:时上戊子而不见丙丁', '成格层次:阴若朝阳'],
    hint: '辛金酉月辛日得戊子时而不见丙丁离位，多成六阴朝阳',
  },
];
