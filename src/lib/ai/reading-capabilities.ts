export const READING_CLASSIC_TABLES: Record<string, string[]> = {
  bazi: ['BAZI_DITIANSUI_TABLE', 'BAZI_QIONGTONG_TABLE', 'BAZI_ZIPING_PATTERNS'],
  ziwei: ['ZIWEI_STAR_CLASSICS', 'ZIWEI_FU_CLASSICS'],
  liuyao: [
    'LIUYAO_MOVEMENT_RULES',
    'LIUYAO_CHISHI_TABLE',
    'LIUYAO_CATEGORY_CHAPTERS',
    'ZHOUYI_HEXAGRAMS_TEXT',
  ],
  meihua: ['MEIHUA_RELATION_JUDGEMENTS', 'MEIHUA_TRIGRAM_CLASSICS', 'ZHOUYI_HEXAGRAMS_TEXT'],
  qimen: [
    'QIMEN_STEM_PATTERNS',
    'QIMEN_STAR_CLASSICS',
    'QIMEN_DOOR_CLASSICS',
    'QIMEN_DEITY_CLASSICS',
    'QIMEN_YANBO_CLASSICS',
  ],
  'qimen-lifetime': [
    'QIMEN_STEM_PATTERNS',
    'QIMEN_STAR_CLASSICS',
    'QIMEN_DOOR_CLASSICS',
    'QIMEN_DEITY_CLASSICS',
    'QIMEN_YANBO_CLASSICS',
  ],
  liuren: [
    'LIUREN_TRANSMISSION_CLASSICS',
    'LIUREN_LESSON_PATTERN_CLASSICS',
    'LIUREN_GENERAL_CLASSICS',
    'LIUREN_BIFA_CLASSICS',
  ],
  jinkoujue: ['JINKOUJUE_MOVEMENT_CLASSICS'],
  xiaoliuren: ['XIAOLIUREN_CLASSICS'],
  fengshui: ['BAZHAI_STAR_CLASSICS', 'XUANKONG_STAR_CLASSICS'],
  taiyi: ['TAIYI_GENERAL_CLASSICS'],
  huangji: ['HUANGJI_CYCLE_CLASSICS'],
  qizheng: ['QIZHENG_STAR_CLASSICS'],
  wuyun: ['WUYUN_LIUQI_CLASSICS'],
  almanac: ['ALMANAC_OFFICER_CLASSICS'],
};

export const READING_CALCULATION_ROUTES: Record<string, string> = {
  bazi: '/bazi/prompt',
  ziwei: '/ziwei/prompt',
  astrolabe: '/divination/astrolabe/prompt',
  'qi-zheng': '/metaphysics/qizheng/prompt',
  'qimen-lifetime': '/divination/qimen/lifetime/prompt',
  fengshui: '/metaphysics/residential/prompt',
};
