import type { ClimateRule } from '../../types';

export const WU_CHEN_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'chen-month-wu-officer-party-geng',
    label: '戊日辰月官杀会党得庚规则',
    description:
      '戊土生辰月，若地支木局已成，天干又甲乙并透，属于官杀会党；此时得庚金出干扫除官杀，传统多主富贵，不应仍按普通春土或从杀泛断。',
    months: ['辰'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    requiredFormationWuxings: ['木'],
    requiredFormationTenGodCategories: ['官杀'],
    requiredVisibleStems: ['庚'],
    distinctStemGroupCounts: [
      {
        stems: ['甲', '乙'],
        minDistinctCount: 2,
        scope: 'total',
      },
    ],
    usefulWuxing: '金',
    favorableOrder: ['金', '火'],
    traceHints: ['取用层次:官杀会党，庚金扫杀', '成格层次:得庚透，亦主富贵'],
    hint: '戊土辰月支成木局且甲乙并透，得庚可扫官杀而主富贵',
  },
  {
    id: 'chen-month-wu-officer-party-no-geng',
    label: '戊日辰月官杀会党无庚浅薄规则',
    description:
      '戊土生辰月，若地支木局已成且甲乙并透，而庚金不出，则官杀会党无去留之义，传统多断浅薄之人，不宜仍按得庚扫杀之富贵格看待。',
    months: ['辰'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    requiredFormationWuxings: ['木'],
    requiredFormationTenGodCategories: ['官杀'],
    forbiddenVisibleStems: ['庚'],
    distinctStemGroupCounts: [
      {
        stems: ['甲', '乙'],
        minDistinctCount: 2,
        scope: 'total',
      },
    ],
    usefulWuxing: '火',
    favorableOrder: ['火', '金'],
    traceHints: ['破格因素:官杀会党无庚', '成格层次:无庚乃浅薄之人'],
    hint: '戊土辰月支成木局而甲乙并透，若无庚多主浅薄',
  },
  {
    id: 'chen-month-wu-follow-kill',
    label: '戊日辰月木多无比印从杀规则',
    description:
      '戊土生辰月，若官杀木气成势，天干又无比劫、印星透出牵制，传统多可按从杀论，层次反主富贵，不应仍拘于春土暖燥之常法。',
    months: ['辰'],
    dayMasters: ['土'],
    dayStems: ['戊'],
    forbiddenVisibleStems: ['庚'],
    minWuxingCounts: { 木: 4 },
    minTenGodCategoryVisibleCounts: { 官杀: 2 },
    maxTenGodCategoryVisibleCounts: { 比劫: 0, 印星: 0 },
    usefulWuxing: '木',
    favorableOrder: ['木', '水'],
    traceHints: ['取用层次:官杀成势，无比印透', '成格层次:作从杀而论，亦主富贵'],
    hint: '戊土辰月木多而无比印透，可按从杀格看',
  },
];
