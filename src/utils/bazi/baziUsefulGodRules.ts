export type UsefulGodWuxingBundle =
  | 'resource_companion_output'
  | 'wealth_officer'
  | 'output_wealth_officer'
  | 'resource_companion'

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
    id: 'follow-special-strong',
    label: '专旺格顺势规则',
    description: '专旺格以顺势为主，喜印比及顺气之神。',
    priority: 100,
    patterns: ['专旺格'],
    favorable: 'resource_companion_output',
    unfavorable: 'wealth_officer',
    trace: '专旺格顺势取用',
    primaryReason: '顺势'
  },
  {
    id: 'follow-special-weak',
    label: '从格从势规则',
    description: '从格以从势为主，喜顺从克泄耗之气。',
    priority: 100,
    patterns: ['从格'],
    favorable: 'output_wealth_officer',
    unfavorable: 'resource_companion',
    trace: '从格从势取用',
    primaryReason: '从势'
  },
  {
    id: 'balance-strong',
    label: '身强扶抑规则',
    description: '普通身强命局以泄耗克为先，抑其太过。',
    priority: 50,
    strengths: ['身强', '极强'],
    favorable: 'output_wealth_officer',
    unfavorable: 'resource_companion',
    trace: '身强取泄耗克',
    primaryReason: '扶抑'
  },
  {
    id: 'balance-weak',
    label: '身弱扶抑规则',
    description: '普通身弱命局以印比扶助为先，培元固本。',
    priority: 50,
    strengths: ['身弱', '极弱'],
    favorable: 'resource_companion',
    unfavorable: 'output_wealth_officer',
    trace: '身弱取印比',
    primaryReason: '扶抑'
  }
]
