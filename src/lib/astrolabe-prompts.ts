export const ASTROLABE_PROMPT_TOPICS = [
  'life',
  'career',
  'job-change',
  'startup-partnership',
  'investment-partnership',
  'wealth',
  'relationship',
  'relationship-push',
  'relationship-decision',
  'reconciliation-decision',
  'marriage',
  'children',
  'family',
  'home-move',
  'settle-relocate',
  'social',
  'emotion',
  'growth',
  'talent',
  'health',
  'study',
  'study-advance',
  'exam-landing',
  'recent',
  'chat',
] as const;

export type AstrolabePromptTopic = (typeof ASTROLABE_PROMPT_TOPICS)[number];

const ASTROLABE_GENERAL_DEFAULT_QUESTION = '请先根据这张星盘回答当前最值得关注的重点。';

export const ASTROLABE_SHORTCUT_ACTIONS = [
  { label: '综合', topic: 'life' },
  { label: '事业', topic: 'career' },
  { label: '换工作', topic: 'job-change' },
  { label: '创业合作', topic: 'startup-partnership' },
  { label: '投资合作', topic: 'investment-partnership' },
  { label: '财富', topic: 'wealth' },
  { label: '感情', topic: 'relationship' },
  { label: '关系推进', topic: 'relationship-push' },
  { label: '关系去留', topic: 'relationship-decision' },
  { label: '复合判断', topic: 'reconciliation-decision' },
  { label: '婚姻', topic: 'marriage' },
  { label: '子女', topic: 'children' },
  { label: '家庭', topic: 'family' },
  { label: '搬家置业', topic: 'home-move' },
  { label: '定居换城', topic: 'settle-relocate' },
  { label: '人际', topic: 'social' },
  { label: '情绪', topic: 'emotion' },
  { label: '成长', topic: 'growth' },
  { label: '天赋', topic: 'talent' },
  { label: '健康', topic: 'health' },
  { label: '学业', topic: 'study' },
  { label: '考证进修', topic: 'study-advance' },
  { label: '考试上岸', topic: 'exam-landing' },
  { label: '近期', topic: 'recent' },
] as const;

export function getAstrolabeDefaultQuestion(
  _topic?: string,
  _options: { isCustomQuestion?: boolean } = {},
) {
  return ASTROLABE_GENERAL_DEFAULT_QUESTION;
}

export function buildAstrolabeTopicGuidanceSection(_topic?: string) {
  return [
    '先围绕【问题】判断最相关的星体、宫位、守护星和相位，再组织答案，不要平均复述全盘。',
    '用户没有选择具体主题时按通用星盘口径处理；用户选择主题时只把主题作为回答范围，不补充本地预设模板。',
    '不得编造已提供资料没有给出的新盘面事实；允许基于盘面做占星推理，但必须标明来自星体、宫位、守护星、相位或现实补充信息。',
    '涉及风险、健康、家庭压力或重大决策时保守表达，只给趋势、边界和建议。',
  ]
    .map((line) => `- ${line}`)
    .join('\n');
}

export function buildAstrolabeTopicTask(_topic?: string) {
  return '请围绕用户问题最相关的星体、宫位、守护星和相位作答，提炼关键判断、盘面依据、现实边界与可执行建议。';
}

export function buildAstrolabeTopicOutputRequirement(_topic?: string) {
  return '先直接回答【问题】，再写清主要盘面证据、判断条件和现实建议；证据不足时直接说明。';
}
