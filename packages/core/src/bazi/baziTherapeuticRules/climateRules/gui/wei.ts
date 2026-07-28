import type { ClimateRule } from '../../types';

export const GUI_WEI_CLIMATE_RULES: ClimateRule[] = [
  {
    id: 'wei-month-gui-xiaoshu-metal-water-rich',
    label: '癸日未月小暑后庚辛比劫同扶规则',
    description:
      '癸水生未月上半月，小暑后庚辛休囚，传统谓必须庚辛透干，又得比劫扶身，方可言富贵；不应仍与下半月庚辛有气同断。',
    months: ['未'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    currentJieqi: ['小暑'],
    minTenGodCategoryVisibleCounts: { 印星: 1 },
    minTenGodCategoryTotalCounts: { 比劫: 1 },
    maxStemTotalCounts: { 丁: 0 },
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    traceHints: ['取用层次:小暑后庚辛休囚，须比劫助身', '成格层次:可云富贵'],
    hint: '癸水未月小暑后庚辛透干且比劫扶身，可作富贵看',
  },
  {
    id: 'wei-month-gui-dashu-metal-rich',
    label: '癸日未月大暑后庚辛有气规则',
    description:
      '癸水生未月下半月，大暑后庚辛有气，传统谓即无比劫亦可；只要庚辛得用而无丁火破局，便不应仍拘于上半月必须比劫同扶的条件。',
    months: ['未'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    currentJieqi: ['大暑'],
    minTenGodCategoryVisibleCounts: { 印星: 1 },
    maxStemTotalCounts: { 丁: 0 },
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    traceHints: ['取用层次:大暑后庚辛有气，即无比劫亦可', '成格层次:可云富贵'],
    hint: '癸水未月大暑后庚辛有气，即无比劫亦可论富贵',
  },
  {
    id: 'wei-month-gui-ding-break-metal',
    label: '癸日未月丁火破金不吉规则',
    description:
      '癸水生未月，无论上半月或下半月，传统都忌丁火透出；即便丁火藏支亦不吉。若庚辛本可为用而又见丁，则不应仍按金水会夏天或庚辛有气上断。',
    months: ['未'],
    dayMasters: ['水'],
    dayStems: ['癸'],
    minTenGodCategoryVisibleCounts: { 印星: 1 },
    minStemTotalCounts: { 丁: 1 },
    usefulWuxing: '金',
    favorableOrder: ['金', '水'],
    traceHints: ['破格因素:丁火出现，破伤庚辛', '成格层次:丁在干支，均属不吉'],
    hint: '癸水未月庚辛为用而见丁火，多主破局不吉',
  },
];
