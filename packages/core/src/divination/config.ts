import type {
  AlmanacTopic,
  DivinationType,
  LenormandSpreadType,
  LiuyaoTemplateType,
  LiurenTemplateType,
  MeihuaDivinationMethod,
  TarotSpreadType,
  XiaoliurenDivinationMethod,
  JinkoujueDivinationMethod,
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
    description: '随机选择一种当前可用的起卦或抽取方式。',
  },
  {
    value: 'liuyao',
    label: '六爻',
    description: '生成卦象、纳甲、世应、动变及已校勘结构资料。',
  },
  {
    value: 'meihua',
    label: '梅花易数',
    description: '生成主卦、互卦、变卦、体用及已校勘盘内关系资料。',
  },
  {
    value: 'qimen',
    label: '奇门遁甲',
    description: '生成局式、九宫门星神干及已校勘位置结构。',
  },
  {
    value: 'liuren',
    label: '大六壬',
    description: '生成天地盘、四课三传、天将及已校勘课传结构。',
  },
  {
    value: 'taiyi',
    label: '太乙神数',
    description: '生成年计积数、七十二局、核心落宫、算数和十六神位置。',
  },
  {
    value: 'xiaoliuren',
    label: '小六壬',
    description: '记录起课时间和历法事实；未校落宫与歌诀保持关闭。',
  },
  {
    value: 'jinkoujue',
    label: '金口诀',
    description: '记录金口诀起课时间、四柱、原始数字或随机轨迹，规则版本明确后再继续推算。',
  },
  {
    value: 'ssgw',
    label: '三山国王灵签',
    description: '记录签号、签文与随机轨迹；签义须按完整资料继续核对。',
  },
  {
    value: 'tarot',
    label: '塔罗',
    description: '记录牌号、牌名、牌位、正逆位、抽取顺序与随机轨迹。',
  },
  {
    value: 'almanac',
    label: '黄历择日',
    description: '按日期范围整理历书原始宜忌、参与人固定关系及时段资料。',
  },
  {
    value: 'lenormand',
    label: '雷诺曼',
    description: '记录牌号、牌名、牌位、抽取顺序与版面位置关系。',
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
