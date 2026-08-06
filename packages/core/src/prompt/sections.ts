import type { PromptDocument } from './types';

export function buildPromptSection(title: string, content: string) {
  const normalized = content.trim();
  return normalized ? `【${title}】\n${normalized}` : '';
}

export function joinPromptSections(sections: Array<string | null | undefined>) {
  return sections
    .map((section) => section?.trim())
    .filter((section): section is string => Boolean(section))
    .join('\n\n');
}

export function buildPromptDocument(user: string, system = ''): PromptDocument {
  const normalizedUser = user.trim();
  const normalizedSystem = system.trim();
  return {
    system: normalizedSystem,
    user: normalizedUser,
    text: [normalizedSystem, normalizedUser].filter(Boolean).join('\n\n'),
  };
}

export function formatStringList(values: readonly string[] | undefined, fallback = '未记录') {
  return values?.length ? values.join('、') : fallback;
}

export function formatEvidencePromptText(data: unknown) {
  if (!data || typeof data !== 'object') return '';
  const evidence = (data as { evidenceAnalysis?: { promptText?: unknown } }).evidenceAnalysis;
  return typeof evidence?.promptText === 'string' ? evidence.promptText.trim() : '';
}
