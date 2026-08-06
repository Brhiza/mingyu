import type { AstrolabePromptTopic } from './astrolabe';
import type { BaziCompatibilityType, BaziPromptTopic } from './bazi';

export interface BaziPromptPreset {
  id: string;
  prompt: string;
  scopeLabel: string;
  topic: BaziPromptTopic;
}

export interface BaziCompatibilityPromptPreset {
  id: string;
  prompt: string;
  scopeLabel: string;
  compatibilityType: BaziCompatibilityType;
}

const BAZI_TASK = '请依据八字排盘资料完成解读。';
const BAZI_COMPATIBILITY_TASK = '请依据双方盘面回答【问题】。';

const BAZI_PRESET_DEFINITIONS: Array<[string, string, BaziPromptTopic, string]> = [
  ['ai-mingge-zonglun', '通用', 'general', '通用'],
  ['ai-recent', '近期', 'recent', '近期'],
  ['ai-career', '事业', 'career', '事业'],
  ['ai-job-change', '换工作', 'job-change', '换工作'],
  ['ai-startup-partnership', '创业合作', 'startup-partnership', '创业合作'],
  ['ai-investment-partnership', '投资合作', 'investment-partnership', '投资合作'],
  ['ai-wealth-timing', '财运', 'wealth', '财运'],
  ['ai-marriage', '婚恋', 'marriage', '婚恋'],
  ['ai-relationship-push', '关系推进', 'relationship-push', '关系推进'],
  ['ai-relationship-decision', '关系去留', 'relationship-decision', '关系去留'],
  ['ai-reconciliation-decision', '复合判断', 'reconciliation-decision', '复合判断'],
  ['ai-children-fate', '子女', 'children', '子女'],
  ['ai-health', '健康', 'health', '健康'],
  ['ai-family', '六亲', 'family', '六亲'],
  ['ai-home', '家庭', 'family', '家庭'],
  ['ai-home-move', '搬家置业', 'home-move', '搬家置业'],
  ['ai-settle-relocate', '定居换城', 'settle-relocate', '定居换城'],
  ['ai-social', '人际', 'social', '人际'],
  ['ai-emotion', '情绪', 'emotion', '情绪'],
  ['ai-study', '学业', 'study', '学业'],
  ['ai-study-advance', '考证进修', 'study-advance', '考证进修'],
  ['ai-exam-landing', '考试上岸', 'exam-landing', '考试上岸'],
  ['ai-growth', '成长', 'growth', '成长'],
  ['ai-talent', '天赋', 'talent', '天赋'],
];

export const BAZI_PROMPT_PRESETS: readonly BaziPromptPreset[] = BAZI_PRESET_DEFINITIONS.map(
  ([id, scopeLabel, topic, _label]) => ({
    id,
    prompt: BAZI_TASK,
    scopeLabel,
    topic,
  }),
);

const BAZI_COMPATIBILITY_DEFINITIONS: Array<[string, string, BaziCompatibilityType]> = [
  ['ai-compat-marriage', '合婚', 'marriage'],
  ['ai-compat-career', '合伙', 'career'],
  ['ai-compat-friendship', '友情', 'friendship'],
  ['ai-compat-children', '子女', 'children'],
  ['ai-compat-parents', '父母', 'parents'],
  ['ai-compat-siblings', '兄弟', 'siblings'],
];

export const BAZI_COMPATIBILITY_PROMPT_PRESETS: readonly BaziCompatibilityPromptPreset[] =
  BAZI_COMPATIBILITY_DEFINITIONS.map(([id, scopeLabel, compatibilityType]) => ({
    id,
    prompt: BAZI_COMPATIBILITY_TASK,
    scopeLabel,
    compatibilityType,
  }));

export interface AstrolabePromptShortcut {
  label: string;
  topic: AstrolabePromptTopic;
}

export const ASTROLABE_PROMPT_SHORTCUTS: readonly AstrolabePromptShortcut[] = [
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
];

export function getBaziPromptPreset(id: string) {
  return BAZI_PROMPT_PRESETS.find((item) => item.id === id);
}

export function getBaziCompatibilityPromptPreset(id: string) {
  return BAZI_COMPATIBILITY_PROMPT_PRESETS.find((item) => item.id === id);
}

export function getAstrolabePromptShortcut(label: string) {
  return ASTROLABE_PROMPT_SHORTCUTS.find((item) => item.label === label);
}
