import type {
  Brightness,
  EarthlyBranch,
  FiveElementsClass,
  HeavenlyStem,
  Mutagen,
  MutagenSchool,
  ScopeName,
  StarType,
  YinYang,
} from './types';

export const HEAVENLY_STEMS: readonly HeavenlyStem[] = [
  '甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸',
];

export const EARTHLY_BRANCHES: readonly EarthlyBranch[] = [
  '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥',
];

export const PALACE_NAMES: readonly string[] = [
  '命宫', '父母', '福德', '田宅', '官禄', '仆役',
  '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟',
];

export const ZODIAC_BY_BRANCH: Record<EarthlyBranch, string> = {
  子: '鼠', 丑: '牛', 寅: '虎', 卯: '兔', 辰: '龙', 巳: '蛇',
  午: '马', 未: '羊', 申: '猴', 酉: '鸡', 戌: '狗', 亥: '猪',
};

export const CHINESE_TIME: readonly string[] = [
  '早子时', '丑时', '寅时', '卯时', '辰时', '巳时',
  '午时', '未时', '申时', '酉时', '戌时', '亥时', '晚子时',
];

export const TIME_RANGE: readonly string[] = [
  '00:00~01:00', '01:00~03:00', '03:00~05:00', '05:00~07:00',
  '07:00~09:00', '09:00~11:00', '11:00~13:00', '13:00~15:00',
  '15:00~17:00', '17:00~19:00', '19:00~21:00', '21:00~23:00', '23:00~00:00',
];

/** 五虎遁：年干起寅首月干 */
export const TIGER_RULE: Record<HeavenlyStem, HeavenlyStem> = {
  甲: '丙', 己: '丙',
  乙: '戊', 庚: '戊',
  丙: '庚', 辛: '庚',
  丁: '壬', 壬: '壬',
  戊: '甲', 癸: '甲',
};

export const FIVE_ELEMENTS_CLASS_VALUE: Record<FiveElementsClass, number> = {
  水二局: 2,
  木三局: 3,
  金四局: 4,
  土五局: 5,
  火六局: 6,
};

export const FIVE_ELEMENTS_CLASS_BY_SUM: readonly FiveElementsClass[] = [
  '木三局', '金四局', '水二局', '火六局', '土五局',
];

export const MUTAGEN_LABELS: readonly Mutagen[] = ['禄', '权', '科', '忌'];

/** 十天干四化表（通行/飞星主流）：禄、权、科、忌 */
export const STEM_MUTAGENS: Record<HeavenlyStem, readonly [string, string, string, string]> = {
  甲: ['廉贞', '破军', '武曲', '太阳'],
  乙: ['天机', '天梁', '紫微', '太阴'],
  丙: ['天同', '天机', '文昌', '廉贞'],
  丁: ['太阴', '天同', '天机', '巨门'],
  戊: ['贪狼', '太阴', '右弼', '天机'],
  己: ['武曲', '贪狼', '天梁', '文曲'],
  庚: ['太阳', '武曲', '太阴', '天同'],
  辛: ['巨门', '太阳', '文曲', '文昌'],
  壬: ['天梁', '紫微', '左辅', '武曲'],
  癸: ['破军', '巨门', '太阴', '贪狼'],
};

/** 多流派十天干四化对照表 */
export const STEM_MUTAGENS_BY_SCHOOL: Record<
  MutagenSchool,
  Record<HeavenlyStem, readonly [string, string, string, string]>
> = {
  default: STEM_MUTAGENS,
  zhongzhou: {
    ...STEM_MUTAGENS,
    庚: ['太阳', '武曲', '天同', '天相'],
  },
  quanshu: {
    ...STEM_MUTAGENS,
    戊: ['贪狼', '太阴', '太阳', '天机'],
    庚: ['太阳', '武曲', '天同', '太阴'],
    壬: ['天梁', '紫微', '天府', '武曲'],
  },
  tianfu: {
    ...STEM_MUTAGENS,
    庚: ['太阳', '武曲', '天府', '天同'],
    壬: ['天梁', '紫微', '天府', '武曲'],
  },
};

export const BRANCH_META: Record<EarthlyBranch, { yinYang: YinYang; soul: string; body: string }> = {
  子: { yinYang: '阳', soul: '贪狼', body: '火星' },
  丑: { yinYang: '阴', soul: '巨门', body: '天相' },
  寅: { yinYang: '阳', soul: '禄存', body: '天梁' },
  卯: { yinYang: '阴', soul: '文曲', body: '天同' },
  辰: { yinYang: '阳', soul: '廉贞', body: '文昌' },
  巳: { yinYang: '阴', soul: '武曲', body: '天机' },
  午: { yinYang: '阳', soul: '破军', body: '火星' },
  未: { yinYang: '阴', soul: '武曲', body: '天相' },
  申: { yinYang: '阳', soul: '廉贞', body: '天梁' },
  酉: { yinYang: '阴', soul: '文曲', body: '天同' },
  戌: { yinYang: '阳', soul: '禄存', body: '文昌' },
  亥: { yinYang: '阴', soul: '巨门', body: '天机' },
};

/** 十四主星及六吉六煞亮度表（按宫位从寅宫 0 开始至丑宫 11） */
export const STAR_BRIGHTNESS: Record<string, readonly Brightness[]> = {
  紫微: ['旺', '旺', '得', '旺', '庙', '庙', '旺', '旺', '得', '旺', '平', '庙'],
  天机: ['得', '旺', '利', '平', '庙', '陷', '得', '旺', '利', '平', '庙', '陷'],
  太阳: ['旺', '庙', '旺', '旺', '旺', '得', '得', '陷', '不', '陷', '陷', '不'],
  武曲: ['得', '利', '庙', '平', '旺', '庙', '得', '利', '庙', '平', '旺', '庙'],
  天同: ['利', '平', '平', '庙', '陷', '不', '旺', '平', '平', '庙', '旺', '不'],
  廉贞: ['庙', '平', '利', '陷', '平', '利', '庙', '平', '利', '陷', '平', '利'],
  天府: ['庙', '得', '庙', '得', '旺', '庙', '得', '旺', '庙', '得', '庙', '庙'],
  太阴: ['旺', '陷', '陷', '陷', '不', '不', '利', '不', '旺', '庙', '庙', '庙'],
  贪狼: ['平', '利', '庙', '陷', '旺', '庙', '平', '利', '庙', '陷', '旺', '庙'],
  巨门: ['庙', '庙', '陷', '旺', '旺', '不', '庙', '庙', '陷', '旺', '旺', '不'],
  天相: ['庙', '陷', '得', '得', '庙', '得', '庙', '陷', '得', '得', '庙', '庙'],
  天梁: ['庙', '庙', '庙', '陷', '庙', '旺', '陷', '得', '庙', '陷', '庙', '旺'],
  七杀: ['庙', '旺', '庙', '平', '旺', '庙', '庙', '庙', '庙', '平', '旺', '庙'],
  破军: ['得', '陷', '旺', '平', '庙', '旺', '得', '陷', '旺', '平', '庙', '旺'],
  文昌: ['陷', '利', '得', '庙', '陷', '利', '得', '庙', '陷', '利', '得', '庙'],
  文曲: ['平', '旺', '得', '庙', '陷', '旺', '得', '庙', '陷', '旺', '得', '庙'],
  火星: ['庙', '利', '陷', '得', '庙', '利', '陷', '得', '庙', '利', '陷', '得'],
  铃星: ['庙', '利', '陷', '得', '庙', '利', '陷', '得', '庙', '利', '陷', '得'],
  擎羊: ['', '陷', '庙', '', '陷', '庙', '', '陷', '庙', '', '陷', '庙'],
  陀罗: ['陷', '', '庙', '陷', '', '庙', '陷', '', '庙', '陷', '', '庙'],
};

export const CHANGSHENG_12_STARS: readonly string[] = [
  '长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养',
];

export const BOSHI_12_STARS: readonly string[] = [
  '博士', '力士', '青龙', '小耗', '将军', '奏书', '飞廉', '喜神', '病符', '大耗', '伏兵', '官府',
];

export const SUIQIAN_12_STARS_DEFAULT: readonly string[] = [
  '岁建', '晦气', '丧门', '贯索', '官符', '小耗', '大耗', '龙德', '白虎', '天德', '吊客', '病符',
];

export const SUIQIAN_12_STARS_ZHONGZHOU: readonly string[] = [
  '岁建', '晦气', '丧门', '贯索', '官符', '小耗', '岁破', '龙德', '白虎', '天德', '吊客', '病符',
];

export const JIANGQIAN_12_STARS: readonly string[] = [
  '将星', '攀鞍', '岁驿', '息神', '华盖', '劫煞', '灾煞', '天煞', '指背', '咸池', '月煞', '亡神',
];

export type HoroscopeStarKey =
  | 'tiankui' | 'tianyue' | 'wenchang' | 'wenqu' | 'lucun'
  | 'qingyang' | 'tuoluo' | 'tianma' | 'hongluan' | 'tianxi';

export const HOROSCOPE_STAR_META: Record<
  Exclude<ScopeName, 'origin'>,
  Record<HoroscopeStarKey, { name: string; type: StarType }>
> = {
  decadal: {
    tiankui: { name: '运魁', type: 'soft' },
    tianyue: { name: '运钺', type: 'soft' },
    wenchang: { name: '运昌', type: 'soft' },
    wenqu: { name: '运曲', type: 'soft' },
    lucun: { name: '运禄', type: 'lucun' },
    qingyang: { name: '运羊', type: 'tough' },
    tuoluo: { name: '运陀', type: 'tough' },
    tianma: { name: '运马', type: 'tianma' },
    hongluan: { name: '运鸾', type: 'flower' },
    tianxi: { name: '运喜', type: 'flower' },
  },
  yearly: {
    tiankui: { name: '流魁', type: 'soft' },
    tianyue: { name: '流钺', type: 'soft' },
    wenchang: { name: '流昌', type: 'soft' },
    wenqu: { name: '流曲', type: 'soft' },
    lucun: { name: '流禄', type: 'lucun' },
    qingyang: { name: '流羊', type: 'tough' },
    tuoluo: { name: '流陀', type: 'tough' },
    tianma: { name: '流马', type: 'tianma' },
    hongluan: { name: '流鸾', type: 'flower' },
    tianxi: { name: '流喜', type: 'flower' },
  },
  monthly: {
    tiankui: { name: '月魁', type: 'soft' },
    tianyue: { name: '月钺', type: 'soft' },
    wenchang: { name: '月昌', type: 'soft' },
    wenqu: { name: '月曲', type: 'soft' },
    lucun: { name: '月禄', type: 'lucun' },
    qingyang: { name: '月羊', type: 'tough' },
    tuoluo: { name: '月陀', type: 'tough' },
    tianma: { name: '月马', type: 'tianma' },
    hongluan: { name: '月鸾', type: 'flower' },
    tianxi: { name: '月喜', type: 'flower' },
  },
  daily: {
    tiankui: { name: '日魁', type: 'soft' },
    tianyue: { name: '日钺', type: 'soft' },
    wenchang: { name: '日昌', type: 'soft' },
    wenqu: { name: '日曲', type: 'soft' },
    lucun: { name: '日禄', type: 'lucun' },
    qingyang: { name: '日羊', type: 'tough' },
    tuoluo: { name: '日陀', type: 'tough' },
    tianma: { name: '日马', type: 'tianma' },
    hongluan: { name: '日鸾', type: 'flower' },
    tianxi: { name: '日喜', type: 'flower' },
  },
  hourly: {
    tiankui: { name: '时魁', type: 'soft' },
    tianyue: { name: '时钺', type: 'soft' },
    wenchang: { name: '时昌', type: 'soft' },
    wenqu: { name: '时曲', type: 'soft' },
    lucun: { name: '时禄', type: 'lucun' },
    qingyang: { name: '时羊', type: 'tough' },
    tuoluo: { name: '时陀', type: 'tough' },
    tianma: { name: '时马', type: 'tianma' },
    hongluan: { name: '时鸾', type: 'flower' },
    tianxi: { name: '时喜', type: 'flower' },
  },
};
