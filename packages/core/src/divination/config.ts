import type {
  AlmanacTopic,
  DivinationType,
  JinkoujueDivinationMethod,
  LenormandSpreadType,
  LiuyaoTemplateType,
  LiurenTemplateType,
  MeihuaDivinationMethod,
  TarotSpreadType,
  XiaoliurenDivinationMethod,
} from '../types/divination';

export type DivinationMethodId =
  | 'random'
  | Extract<
      DivinationType,
      | 'liuyao'
      | 'meihua'
      | 'xiaoliuren'
      | 'jinkoujue'
      | 'qimen'
      | 'liuren'
      | 'tarot'
      | 'ssgw'
      | 'almanac'
      | 'lenormand'
      | 'astrolabe'
      | 'taiyi'
    >;

export const DIVINATION_METHOD_OPTIONS: Array<{
  value: DivinationMethodId;
  label: string;
  description: string;
}> = [
  {
    value: 'random',
    label: '随机',
    description: '随机选择一种占卜类型，适合没有明确偏好时快速起卦。',
  },
  {
    value: 'liuyao',
    label: '六爻',
    description: '适合判断能不能、会不会、该不该，重在事态变化。',
  },
  {
    value: 'meihua',
    label: '梅花易数',
    description: '适合快速起卦，兼顾体用、过程与结果。',
  },
  {
    value: 'qimen',
    label: '奇门遁甲',
    description: '适合看时机、策略和局势走向。',
  },
  {
    value: 'liuren',
    label: '大六壬',
    description: '适合看事情如何演变、卡点在哪以及该先处理什么。',
  },
  {
    value: 'xiaoliuren',
    label: '小六壬',
    description: '适合快速判断眼前事情的走势、阻力与行动节奏。',
  },
  {
    value: 'jinkoujue',
    label: '金口诀',
    description: '以地分、将神、贵神、人元四位一体判断事情主客、人情与落点。',
  },
  {
    value: 'taiyi',
    label: '太乙神数',
    description: '以年家七十二局观察年度气运、动静、攻守与时宜。',
  },
  {
    value: 'ssgw',
    label: '三山国王灵签',
    description: '随机求签，适合快速获得方向提示。',
  },
  {
    value: 'tarot',
    label: '塔罗',
    description: '适合感受关系、能量状态与牌面指引。',
  },
  {
    value: 'lenormand',
    label: '雷诺曼',
    description: '偏现实事件判断，适合看关系互动、消息走向和具体选择。',
  },
  {
    value: 'almanac',
    label: '黄历择日',
    description: '按事项、日期范围和参与人八字，筛选更合适的行动日。',
  },
  {
    value: 'astrolabe',
    label: '星盘',
    description: '生成星体、宫位与相位，并提供可视星盘作为解读依据。',
  },
];

export const GENERAL_DIVINATION_METHOD_OPTIONS = DIVINATION_METHOD_OPTIONS.filter(
  (item) => item.value !== 'almanac' && item.value !== 'astrolabe',
);

export const MEIHUA_METHOD_OPTIONS: Array<{
  value: Extract<MeihuaDivinationMethod, 'time' | 'number' | 'random'>;
  label: string;
}> = [
  { value: 'time', label: '时间起卦' },
  { value: 'number', label: '数字起卦' },
  { value: 'random', label: '随机起卦' },
];

export const XIAOLIUREN_METHOD_OPTIONS: Array<{
  value: XiaoliurenDivinationMethod;
  label: string;
}> = [{ value: 'time', label: '时间起课' }];

export const JINKOUJUE_METHOD_OPTIONS: Array<{
  value: JinkoujueDivinationMethod;
  label: string;
}> = [
  { value: 'time', label: '时间起课' },
  { value: 'number', label: '数字起课' },
  { value: 'random', label: '随机起课' },
];

export const LIUYAO_TEMPLATE_OPTIONS: Array<{
  value: LiuyaoTemplateType;
  label: string;
}> = [
  { value: 'general', label: '通用断卦' },
  { value: 'ganqing', label: '感情关系' },
  { value: 'shiye', label: '事业工作' },
  { value: 'caifu', label: '财运交易' },
  { value: 'guaishen', label: '鬼神怪异' },
];

export const TAROT_SPREAD_OPTIONS: Array<{
  value: TarotSpreadType;
  label: string;
}> = [
  { value: 'single', label: '单牌指引' },
  { value: 'three', label: '时间流牌阵' },
  { value: 'love', label: '爱情牌阵' },
  { value: 'career', label: '事业牌阵' },
  { value: 'decision', label: '选择牌阵' },
  { value: 'celtic', label: '凯尔特十字' },
  { value: 'chakra', label: '七脉轮牌阵' },
  { value: 'year', label: '年运牌阵' },
  { value: 'mindBodySpirit', label: '身心灵牌阵' },
  { value: 'horseshoe', label: '马蹄铁牌阵' },
];

export const LIUREN_TEMPLATE_OPTIONS: Array<{
  value: LiurenTemplateType;
  label: string;
}> = [
  { value: 'general', label: '通用断课' },
  { value: 'ganqing', label: '感情断课' },
  { value: 'shiye', label: '事业断课' },
  { value: 'caifu', label: '财富断课' },
];

export const ALMANAC_TOPIC_OPTIONS: Array<{
  value: AlmanacTopic;
  label: string;
}> = [
  { value: 'move', label: '搬家入宅' },
  { value: 'marriage', label: '订婚结婚' },
  { value: 'opening', label: '开业启动' },
  { value: 'contract', label: '签约合作' },
  { value: 'travel', label: '出行赴任' },
  { value: 'medical', label: '就医手术' },
  { value: 'study', label: '考试学习' },
  { value: 'burial', label: '安葬修坟' },
  { value: 'renovation', label: '修造动土' },
  { value: 'custom', label: '自定义事项' },
];

export const LENORMAND_SPREAD_OPTIONS: Array<{
  value: LenormandSpreadType;
  label: string;
}> = [
  { value: 'single', label: '单牌线索' },
  { value: 'three', label: '三牌事件线' },
  { value: 'relationship', label: '关系牌阵' },
  { value: 'decision', label: '选择牌阵' },
  { value: 'nine', label: '九宫牌阵' },
];
