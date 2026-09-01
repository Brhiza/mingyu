export { ASTROLABE_PROMPT_TOPICS, type AstrolabePromptTopic } from '@temposoul/core/prompt';
export { ASTROLABE_PROMPT_SHORTCUTS as ASTROLABE_SHORTCUT_ACTIONS } from '@temposoul/core/prompt';

export function getAstrolabeDefaultQuestion(
  _topic?: string,
  _options: { isCustomQuestion?: boolean } = {},
) {
  return '';
}

export function buildAstrolabeTopicTask(_topic?: string) {
  return '请依据星体、宫位和相位完成解读。';
}
