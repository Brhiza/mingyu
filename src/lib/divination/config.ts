import type { DivinationType, LiurenTemplateType, MeihuaDivinationMethod, TarotSpreadType } from '@/types';

export type DivinationMethodId =
  | 'random'
  | Extract<DivinationType, 'liuyao' | 'meihua' | 'qimen' | 'liuren' | 'tarot' | 'ssgw'>;

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
    value: 'tarot',
    label: '塔罗',
    description: '适合感受关系、能量状态与行动建议。',
  },
  {
    value: 'ssgw',
    label: '三山国王灵签',
    description: '随机求签，适合快速获得方向提示。',
  },
];

export const DIVINATION_EXAMPLES: Record<DivinationMethodId, string[]> = {
  random: [
    '我现在最该注意的方向是什么？',
    '这件事接下来更适合主动还是等待？',
    '我眼下这一步怎么做更稳妥？',
  ],
  liuyao: [
    '我近期适合换工作吗？',
    '这段关系还有继续推进的必要吗？',
    '这个合作项目能成吗？',
  ],
  meihua: [
    '我现在该主动推进，还是先观察？',
    '这次沟通能不能顺利解决问题？',
    '我最近财务决策的重点是什么？',
  ],
  qimen: [
    '这个月我该把重点放在稳住还是突破？',
    '我目前更适合谈合作还是先独自推进？',
    '这件事最合适的发力点在哪里？',
  ],
  liuren: [
    '这件事接下来会怎么发展？',
    '我现在最该先处理哪个关键卡点？',
    '这次推进最后会落到什么结果？',
  ],
  tarot: [
    '我和对方接下来的关系会怎么发展？',
    '我现在最需要被提醒的事情是什么？',
    '未来三个月的整体趋势如何？',
  ],
  ssgw: [
    '我现在最需要注意的方向是什么？',
    '这件事继续推进是否顺势？',
    '眼下的困局该怎么面对？',
  ],
};

export const MEIHUA_METHOD_OPTIONS: Array<{
  value: Extract<MeihuaDivinationMethod, 'time' | 'number' | 'random'>;
  label: string;
}> = [
  { value: 'time', label: '时间起卦' },
  { value: 'number', label: '数字起卦' },
  { value: 'random', label: '随机起卦' },
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
