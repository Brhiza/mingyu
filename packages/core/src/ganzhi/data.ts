/**
 * @file 干支基础数据（地基层）
 * @description 天干、地支、生肖、纳音、十二长生等最基础的数据表。
 * 这些数据是八字、紫微、奇门、六壬、择日等所有术数共同依赖的底层常量，
 * 集中在此以便各系统复用、避免重复定义导致分叉。
 */

/** 十天干（顺序） */
export const HEAVENLY_STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export type HeavenlyStem = (typeof HEAVENLY_STEMS)[number];

/** 十二地支（顺序） */
export const EARTHLY_BRANCHES = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
] as const;
export type EarthlyBranch = (typeof EARTHLY_BRANCHES)[number];

/** 十二生肖（与地支一一对应） */
export const ZODIACS = [
  '鼠',
  '牛',
  '虎',
  '兔',
  '龙',
  '蛇',
  '马',
  '羊',
  '猴',
  '鸡',
  '狗',
  '猪',
] as const;

/** 六十甲子（甲子起，癸亥止）。 */
export const SIXTY_CYCLE: readonly string[] = Array.from(
  { length: 60 },
  (_, index) => `${HEAVENLY_STEMS[index % 10]}${EARTHLY_BRANCHES[index % 12]}`,
);

/** 六旬旬首（每旬第一个甲日/甲时）。 */
export const SIX_XUN_HEADS: readonly string[] = SIXTY_CYCLE.filter((_, index) => index % 10 === 0);

/** 天干五行 */
export const STEM_WUXING: Record<string, string> = {
  甲: '木',
  乙: '木',
  丙: '火',
  丁: '火',
  戊: '土',
  己: '土',
  庚: '金',
  辛: '金',
  壬: '水',
  癸: '水',
};

/** 天干阴阳（阳干：甲丙戊庚壬；阴干：乙丁己辛癸） */
export const STEM_YINYANG: Record<string, '阳' | '阴'> = {
  甲: '阳',
  乙: '阴',
  丙: '阳',
  丁: '阴',
  戊: '阳',
  己: '阴',
  庚: '阳',
  辛: '阴',
  壬: '阳',
  癸: '阴',
};

/** 地支阴阳（阳支：子寅辰午申戌；阴支：丑卯巳未酉亥） */
export const BRANCH_YINYANG: Record<string, '阳' | '阴'> = {
  子: '阳',
  丑: '阴',
  寅: '阳',
  卯: '阴',
  辰: '阳',
  巳: '阴',
  午: '阳',
  未: '阴',
  申: '阳',
  酉: '阴',
  戌: '阳',
  亥: '阴',
};

/**
 * 纳音五行表（六十甲子纳音）
 * 古籍依据：《三命通会》《类经图翼》
 */
export const NAYIN_MAP: Record<string, string> = {
  甲子: '海中金',
  乙丑: '海中金',
  丙寅: '炉中火',
  丁卯: '炉中火',
  戊辰: '大林木',
  己巳: '大林木',
  庚午: '路旁土',
  辛未: '路旁土',
  壬申: '剑锋金',
  癸酉: '剑锋金',
  甲戌: '山头火',
  乙亥: '山头火',
  丙子: '涧下水',
  丁丑: '涧下水',
  戊寅: '城头土',
  己卯: '城头土',
  庚辰: '白蜡金',
  辛巳: '白蜡金',
  壬午: '杨柳木',
  癸未: '杨柳木',
  甲申: '泉中水',
  乙酉: '泉中水',
  丙戌: '屋上土',
  丁亥: '屋上土',
  戊子: '霹雳火',
  己丑: '霹雳火',
  庚寅: '松柏木',
  辛卯: '松柏木',
  壬辰: '长流水',
  癸巳: '长流水',
  甲午: '沙中金',
  乙未: '沙中金',
  丙申: '山下火',
  丁酉: '山下火',
  戊戌: '平地木',
  己亥: '平地木',
  庚子: '壁上土',
  辛丑: '壁上土',
  壬寅: '金箔金',
  癸卯: '金箔金',
  甲辰: '覆灯火',
  乙巳: '覆灯火',
  丙午: '天河水',
  丁未: '天河水',
  戊申: '大驿土',
  己酉: '大驿土',
  庚戌: '钗钏金',
  辛亥: '钗钏金',
  壬子: '桑柘木',
  癸丑: '桑柘木',
  甲寅: '大溪水',
  乙卯: '大溪水',
  丙辰: '沙中土',
  丁巳: '沙中土',
  戊午: '天上火',
  己未: '天上火',
  庚申: '石榴木',
  辛酉: '石榴木',
  壬戌: '大海水',
  癸亥: '大海水',
};

/** 纳音五行 → 五行属性（取纳音名首字对应的五行） */
export const NAYIN_WUXING: Record<string, string> = {
  金: '金',
  木: '木',
  水: '水',
  火: '火',
  土: '土',
};

/** 十二长生次序 */
export const CHANGSHENG_ORDER = [
  '长生',
  '沐浴',
  '冠带',
  '临官',
  '帝旺',
  '衰',
  '病',
  '死',
  '墓',
  '绝',
  '胎',
  '养',
] as const;
export type ChangShengState = (typeof CHANGSHENG_ORDER)[number];

/** 五行长生起地支（火土同宫，土长生在寅） */
export const WUXING_CHANGSHENG_START: Record<string, string> = {
  木: '亥',
  火: '寅',
  金: '巳',
  水: '申',
  土: '寅',
};
