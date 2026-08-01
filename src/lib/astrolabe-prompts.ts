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

const ASTROLABE_GENERAL_DEFAULT_QUESTION =
  '请核对这张星盘已经计算的出生资料、天体位置、宫位、相位与时间资料。';

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

export function buildAstrolabeTopicTask(_topic?: string) {
  return '核对【占卜信息】中的出生资料、天体位置、宫位、宫头、相位及所选作用域的计算事实；【问题】和主题入口只限定核对范围。';
}
