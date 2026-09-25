export type UsefulGodWuxingBundle =
  | 'none'
  | 'resource_companion_output'
  | 'wealth_officer'
  | 'officer_wealth'
  | 'output_wealth_officer'
  | 'output_resource_companion'
  | 'resource_companion'
  | 'wealth_output'
  | 'resource_officer'
  | 'officer';

export interface BaseUsefulGodRule {
  id: string;
  label: string;
  description: string;
  priority?: number;
  patterns?: string[];
  strengths?: string[];
  favorable: UsefulGodWuxingBundle;
  unfavorable: UsefulGodWuxingBundle;
  trace: string;
  primaryReason: string;
}

export const BASE_USEFUL_GOD_RULES: BaseUsefulGodRule[] = [
  {
    id: 'quzhi-follow-wood',
    label: '曲直格顺势泄秀规则',
    description:
      '曲直格以水木顺势、火泄木秀，金为制破；土财只按实际作用另论，不因出现便列为破格或固定忌神。',
    priority: 110,
    patterns: ['曲直格'],
    favorable: 'resource_companion_output',
    unfavorable: 'officer',
    trace: '曲直格取水木顺势、火泄秀，土财另核作用',
    primaryReason: '曲直顺势泄秀',
  },
  {
    id: 'follow-special-strong',
    label: '专旺格顺势规则',
    description:
      '通用专旺格以印比顺势为确定取向；食伤须原局印轻且泄秀作用成立时方可纳入喜用，若已有印食具体冲克则按实际作用干限制。',
    priority: 100,
    patterns: ['专旺格'],
    favorable: 'resource_companion',
    unfavorable: 'wealth_officer',
    trace: '专旺格以印比顺势，食伤另核印轻与实际作用',
    primaryReason: '顺势',
  },
  {
    id: 'follow-conger',
    label: '从儿格顺局规则',
    description:
      '《滴天髓阐微·顺局》从儿以食伤生财为喜，印星制食伤为首忌，官杀耗财逆局次忌；比劫须按生食伤或争财的实际作用另论。',
    priority: 105,
    patterns: ['从儿格'],
    favorable: 'wealth_output',
    unfavorable: 'resource_officer',
    trace: '从儿格取财星、食伤顺局，忌印星、官杀逆局，比劫另核实际作用',
    primaryReason: '从儿顺局',
  },
  {
    id: 'follow-kill',
    label: '从杀格顺杀规则',
    description: '从杀格以官杀顺势为主，财星生杀为辅；食伤制杀、印比扶身逆势。',
    priority: 105,
    patterns: ['从杀格'],
    favorable: 'officer_wealth',
    unfavorable: 'output_resource_companion',
    trace: '从杀格取官杀顺势、财星生杀，忌食伤制杀与印比扶身',
    primaryReason: '从杀顺势',
  },
  {
    id: 'follow-wealth',
    label: '从财格顺财规则',
    description: '从财格以财星为主，食伤生财为辅；印比扶身逆势。',
    priority: 105,
    patterns: ['从财格'],
    favorable: 'wealth_output',
    unfavorable: 'resource_companion',
    trace: '从财格取财星顺势、食伤生财，忌印比扶身',
    primaryReason: '从财顺势',
  },
  {
    id: 'follow-special-weak',
    label: '从格从势规则',
    description: '混杂从势格保留食伤、财星与官杀多种异党取向，具体作用仍按原局核验。',
    priority: 100,
    patterns: ['从格', '从势格'],
    favorable: 'output_wealth_officer',
    unfavorable: 'resource_companion',
    trace: '从格从势取用',
    primaryReason: '从势',
  },
  {
    id: 'balance-strong',
    label: '身强扶抑规则',
    description: '普通身强命局以泄耗克为先，抑其太过。',
    priority: 50,
    strengths: ['身强', '偏强', '极强'],
    favorable: 'output_wealth_officer',
    unfavorable: 'resource_companion',
    trace: '身强取泄耗克',
    primaryReason: '扶抑',
  },
  {
    id: 'balance-weak',
    label: '身弱扶抑规则',
    description: '普通身弱命局以印比扶助为先，培元固本。',
    priority: 50,
    strengths: ['身弱', '偏弱', '极弱'],
    favorable: 'resource_companion',
    unfavorable: 'output_wealth_officer',
    trace: '身弱取印比',
    primaryReason: '扶抑',
  },
  {
    id: 'balance-neutral',
    label: '中和基础取用规则',
    description: '中和不预设整五行喜忌；原局格局作用、调候与具体干条件分别核验。',
    priority: 50,
    strengths: ['中和'],
    favorable: 'none',
    unfavorable: 'none',
    trace: '中和不预设增补五行喜忌，按调候与具体作用另判',
    primaryReason: '中和待判',
  },
];
