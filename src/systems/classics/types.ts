/**
 * @file types.ts
 * Shared classical text excerpt types for v2-next systems.
 */

export interface ClassicExcerpt {
  book: string;
  chapter?: string;
  title: string;
  quote: string;
  explanation?: string;
  condition?: string;
}

/**
 * Deduplicate classic excerpts while preserving insertion order.
 */
export function dedupeExcerpts(excerpts: ClassicExcerpt[]): ClassicExcerpt[] {
  const seen = new Set<string>();
  const result: ClassicExcerpt[] = [];
  for (const item of excerpts) {
    const key = `${item.book}::${item.chapter ?? ''}::${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

/**
 * 将典籍片段列表格式化为可直接嵌入提示词或报告的文本块。
 */
export function formatClassicExcerpts(
  excerpts: readonly ClassicExcerpt[],
  heading?: string,
): string {
  if (excerpts.length === 0) {
    return '';
  }

  const title = heading ?? '典籍片段';
  const lines = excerpts.map((excerpt) => {
    const source = excerpt.chapter
      ? `《${excerpt.book}·${excerpt.chapter}》`
      : `《${excerpt.book}》`;
    const parts = [`- ${source}${excerpt.title}：「${excerpt.quote}」`];
    if (excerpt.explanation) {
      parts.push(`释义：${excerpt.explanation}`);
    }
    if (excerpt.condition) {
      parts.push(`适用：${excerpt.condition}`);
    }
    return parts.join(' ');
  });

  return `【${title}】\n${lines.join('\n')}`;
}
