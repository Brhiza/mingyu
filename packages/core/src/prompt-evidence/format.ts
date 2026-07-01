import type { EvidenceLevel, PromptEvidenceBundle, PromptEvidenceItem } from './types';

const LEVEL_ORDER: Record<EvidenceLevel, number> = {
  主证: 0,
  辅证: 1,
  反证: 2,
  限制: 3,
  应期: 4,
};

function cleanText(value: string | undefined) {
  return value?.trim().replace(/\s+/g, ' ');
}

function buildEvidenceKey(item: PromptEvidenceItem) {
  return [item.level, item.title, item.detail, item.source]
    .map((value) => cleanText(value) ?? '')
    .join('|');
}

export function normalizePromptEvidenceItems(items: PromptEvidenceItem[]): PromptEvidenceItem[] {
  const seen = new Set<string>();

  return items
    .map((item) => ({
      ...item,
      title: cleanText(item.title) ?? '',
      detail: cleanText(item.detail),
      source: cleanText(item.source),
      tags: item.tags?.map(cleanText).filter((tag): tag is string => Boolean(tag)),
    }))
    .filter((item) => item.title)
    .sort(
      (left, right) =>
        (right.weight ?? 0) - (left.weight ?? 0) ||
        LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level] ||
        left.title.localeCompare(right.title, 'zh-CN'),
    )
    .filter((item) => {
      const key = buildEvidenceKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function formatPromptEvidenceItem(item: PromptEvidenceItem) {
  const segments = [
    `【${item.level}】${item.title}`,
    item.detail,
    item.source ? `来源：${item.source}` : '',
    item.tags?.length ? `标签：${item.tags.join('、')}` : '',
  ].filter(Boolean);

  return segments.join('｜');
}

export function formatPromptEvidenceBundle(bundle: PromptEvidenceBundle): string[] {
  const lines = normalizePromptEvidenceItems(bundle.items).map(formatPromptEvidenceItem);
  if (lines.length > 0) {
    return lines;
  }

  const emptyText = cleanText(bundle.emptyText);
  return emptyText ? [emptyText] : [];
}
