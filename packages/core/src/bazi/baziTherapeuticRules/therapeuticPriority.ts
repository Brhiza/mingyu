import type { TherapeuticPriorityRule } from './types';

export const THERAPEUTIC_PRIORITY_RULES: TherapeuticPriorityRule[] = [
  {
    id: 'earth-month-release-output',
    label: '土月疏泄病药规则',
    description: '辰戌丑未月土日主身强而土重壅滞时，优先取食伤以疏泄。',
    months: ['辰', '戌', '丑', '未'],
    strengths: ['身强', '偏强', '极强'],
    dayMasters: ['土'],
    useGeneratedElement: true,
  },
];
