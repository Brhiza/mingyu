import type { PromptSourceKey, QueryPromptState } from './query-state';
import {
  getBaziPromptPreset,
  normalizeThematicTopic,
  requirePromptSelection,
  resolvePromptSelection,
} from 'mingyu-core/prompt';

export function resolveBaziSelection(promptId: string, mode: string) {
  const compatibilityTopicByPromptId: Record<string, string> = {
    'ai-compat-marriage': 'relationship',
    'ai-compat-career': 'career',
    'ai-compat-friendship': 'relationship',
    'ai-compat-children': 'family',
    'ai-compat-parents': 'family',
    'ai-compat-siblings': 'family',
  };
  const compatibilityTopic = compatibilityTopicByPromptId[promptId];
  if (compatibilityTopic) return { topicId: compatibilityTopic, subtopicId: '' };
  const preset = getBaziPromptPreset(promptId);
  return resolveZiweiSelection(
    preset?.topic === 'general' && mode ? '' : (preset?.topic ?? ''),
    mode,
  );
}

export function resolveZiweiSelection(topic: string, mode: string) {
  const topicByLegacyId: Record<string, string> = {
    life: 'general',
    destiny: 'general',
    general: 'general',
    career: 'career',
    wealth: 'wealth',
    marriage: 'relationship',
    recent: 'timing',
    relationship: 'relationship',
    'relationship-push': 'relationship',
    'relationship-decision': 'relationship',
    'reconciliation-decision': 'relationship',
    children: 'family',
    family: 'family',
    'career-wealth': 'career',
    'job-change': 'career',
    'startup-partnership': 'career',
    'investment-partnership': 'wealth',
    'home-move': 'family',
    'settle-relocate': 'family',
    social: 'relationship',
    emotion: 'health',
    health: 'health',
    study: 'academic',
    'study-advance': 'academic',
    'exam-landing': 'academic',
    growth: 'general',
    talent: 'general',
    chat: 'general',
  };
  const subtopicByLegacyId: Record<string, string> = {
    'relationship-push': 'partner',
    'relationship-decision': 'reconciliation',
    'reconciliation-decision': 'reconciliation',
    'job-change': 'job-change',
    'startup-partnership': 'startup',
    'investment-partnership': 'investment',
    'study-advance': 'advanced-study',
    'exam-landing': 'exam',
    'home-move': 'home',
    'settle-relocate': 'home',
  };
  return {
    topicId: topicByLegacyId[topic] ?? normalizeThematicTopic(mode),
    subtopicId: subtopicByLegacyId[topic] ?? '',
  };
}

/** 合参内部以八字侧主题为准；紫微旧字段仅在读取/切换边界选作输入。 */
export function synchronizeCombinedPromptTheme(
  prompt: QueryPromptState,
  source: 'bazi' | 'ziwei' = 'bazi',
): QueryPromptState {
  if (prompt.promptSource !== 'bazi-ziwei') return prompt;
  const topicId = source === 'bazi' ? prompt.baziTopicId : prompt.ziweiTopicId;
  const subtopicId = source === 'bazi' ? prompt.baziSubtopicId : prompt.ziweiSubtopicId;
  const mode = source === 'bazi' ? prompt.baziShortcutMode : prompt.ziweiShortcutMode;
  const legacy =
    mode === '自定义' || mode === '问题灵感'
      ? { topicId: '', subtopicId: '' }
      : source === 'bazi'
        ? resolveBaziSelection(prompt.baziPresetId, mode)
        : resolveZiweiSelection(prompt.ziweiTopic, mode);
  const resolved = resolvePromptSelection({
    methodId: 'bazi-ziwei',
    topicId: topicId || legacy.topicId || undefined,
    subtopicId: topicId ? subtopicId || undefined : legacy.subtopicId || undefined,
  });
  const theme = resolved.ok && (topicId || legacy.topicId) ? resolved.selection : undefined;
  const shortcutMode =
    source === 'ziwei' && mode !== '自定义' && mode !== '问题灵感'
      ? {
          general: '综合',
          relationship: '婚恋',
          career: '事业',
          wealth: '财运',
          health: '健康',
          family: '家庭',
          academic: '学业',
          timing: '近期',
        }[theme?.topicId ?? 'general']
      : mode;
  return {
    ...prompt,
    baziTopicId: theme?.topicId ?? '',
    baziSubtopicId: theme?.subtopicId ?? '',
    ziweiTopicId: theme?.topicId ?? '',
    ziweiSubtopicId: theme?.subtopicId ?? '',
    baziShortcutMode: shortcutMode,
    ziweiShortcutMode: shortcutMode,
    ziweiTopic:
      shortcutMode === '自定义' || shortcutMode === '问题灵感'
        ? 'chat'
        : ({
            general: 'life',
            relationship: 'relationship',
            career: 'career-wealth',
            wealth: 'career-wealth',
            health: 'health',
            family: 'family',
            academic: 'study',
            timing: 'recent',
          }[theme?.topicId ?? 'general'] ?? 'life'),
  };
}

/** 页面动作一次同步完整主题，清空也是显式写入，不能再回退到另一侧旧值。 */
export function applyPromptStatePatch(
  prompt: QueryPromptState,
  patch: Partial<QueryPromptState>,
): QueryPromptState {
  const source =
    ('ziweiTopicId' in patch && !('baziTopicId' in patch)) ||
    (patch.promptSource === 'bazi-ziwei' && prompt.promptSource === 'ziwei')
      ? 'ziwei'
      : 'bazi';
  return synchronizeCombinedPromptTheme({ ...prompt, ...patch }, source);
}

export function getCombinedResultPromptSelection(prompt: QueryPromptState, compatibility = false) {
  return prompt.promptSource === 'bazi-ziwei'
    ? getResultPromptSelection(prompt, 'bazi-ziwei', compatibility)
    : undefined;
}

export function getResultPromptSelection(
  prompt: QueryPromptState,
  source: 'bazi' | 'bazi-ziwei' | 'ziwei' = 'bazi-ziwei',
  compatibility = false,
) {
  const baziScope = {
    natal: 'natal',
    full: 'full',
    dayun: 'decadal',
    year: 'yearly',
    month: 'monthly',
    day: 'daily',
  }[prompt.baziFortuneScope];
  const ziweiScope = prompt.ziweiScope === 'origin' ? 'natal' : prompt.ziweiScope;
  return requirePromptSelection({
    methodId: source,
    topicId: (source === 'ziwei' ? prompt.ziweiTopicId : prompt.baziTopicId) || undefined,
    subtopicId: (source === 'ziwei' ? prompt.ziweiSubtopicId : prompt.baziSubtopicId) || undefined,
    scope: compatibility
      ? 'natal'
      : source === 'ziwei'
        ? ziweiScope
        : source === 'bazi-ziwei' && baziScope === 'natal'
          ? ziweiScope
          : baziScope,
  });
}

export function buildBaziCustomPromptPatch(source?: PromptSourceKey) {
  return {
    baziShortcutMode: '自定义',
    baziPresetId: 'ai-mingge-zonglun',
    baziTopicId: '',
    baziSubtopicId: '',
    baziQuickQuestion: '',
    ...(source === 'bazi-ziwei' ? buildZiweiCustomPromptPatch() : {}),
  };
}

export function buildZiweiCustomPromptPatch() {
  return {
    ziweiShortcutMode: '自定义',
    ziweiTopic: 'chat',
    ziweiTopicId: '',
    ziweiSubtopicId: '',
    ziweiQuickQuestion: '',
  };
}
