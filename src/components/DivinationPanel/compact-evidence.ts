import type { DivinationSummaryBlocks } from '@/lib/divination/summary';

const MAX_VISIBLE_TAGS = 4;
const MAX_VISIBLE_LINES = 4;
const DEFERRED_LINE_PREFIXES = [
  '干支：',
  '节气：',
  '定局节气：',
  '时辰：',
  '历法口径：',
  '起卦法：',
  '过程：',
];

function uniqueNonEmpty(items: string[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

function isExpandedEvidenceDump(line: string) {
  return line.startsWith('证据：') || (line.length > 240 && line.includes('\n'));
}

export function getCompactDivinationSummary(summary: DivinationSummaryBlocks) {
  const lines = uniqueNonEmpty(summary.lines).filter((line) => !isExpandedEvidenceDump(line));
  const mainLines = lines.filter((line) => line.startsWith('主轴：'));
  const supportingLines = lines.filter(
    (line) =>
      !line.startsWith('主轴：') &&
      !DEFERRED_LINE_PREFIXES.some((prefix) => line.startsWith(prefix)),
  );
  const deferredLines = lines.filter((line) =>
    DEFERRED_LINE_PREFIXES.some((prefix) => line.startsWith(prefix)),
  );

  return {
    tags: uniqueNonEmpty(summary.tags).slice(0, MAX_VISIBLE_TAGS),
    lines: [...mainLines, ...supportingLines, ...deferredLines].slice(0, MAX_VISIBLE_LINES),
  };
}
