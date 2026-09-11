import { LIUCHONG_MAP } from 'mingyu-core/ganzhi';
import type { ReadingResource } from './reading-workflow';

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const GODS = '比肩|劫财|食神|伤官|偏财|正财|七杀|正官|偏印|正印';
const compact = (text: string) => text.replace(/[\s*`_]/gu, '');

/** 只检查可与单盘原文直接对应的事实；象意与趋势保留为解读。 */
export function verifyReadingAnswer(
  original: string,
  answer: string,
  resources: ReadingResource[] = [],
): string[] {
  const text = compact(answer);
  const issues = new Set<string>();
  const isNegated = (index: number, length: number) =>
    /不成立|不存在|并非|不是|不构成|不相冲|无此/u.test(
      text.slice(Math.max(0, index - 8), index + length + 8),
    );
  for (const match of text.matchAll(
    new RegExp(`([${BRANCHES}])(?:与)?冲(?:原局)?(?:[年月日时]支)?([${BRANCHES}])`, 'gu'),
  )) {
    if (!isNegated(match.index!, match[0].length) && LIUCHONG_MAP[match[1]] !== match[2])
      issues.add(
        `${match[1]}与${match[2]}并非六冲，六冲对应为${match[1]}${LIUCHONG_MAP[match[1]]}。`,
      );
  }
  const pillars = [
    ...original.matchAll(new RegExp(`([年月日时])柱[:：]\\s*([${STEMS}])([${BRANCHES}])`, 'gu')),
  ];
  if (pillars.length === 4 && new Set(pillars.map((item) => item[1])).size === 4) {
    const known = new Map(pillars.map((item) => [item[1], [item[2], item[3]]]));
    for (const match of text.matchAll(
      new RegExp(`([年月日时])(?:柱)?(?:天|地)?(干|支)(?:为|是|：)?([${STEMS}${BRANCHES}])`, 'gu'),
    )) {
      const preceding = text.slice(Math.max(0, match.index! - 50), match.index);
      if (
        /(?:流年|大运|今年|明年|\d{4}年)[^。；]{0,40}$/u.test(preceding) &&
        !/(?:原局|本命|出生)[^。；]{0,20}$/u.test(preceding)
      )
        continue;
      const expected = known.get(match[1])?.[match[2] === '干' ? 0 : 1];
      if (expected && expected !== match[3] && !isNegated(match.index!, match[0].length))
        issues.add(`原局${match[1]}${match[2]}为${expected}，回答写为${match[3]}。`);
    }
    const gods = new Map<string, string>();
    for (const match of original.matchAll(new RegExp(`([${STEMS}])\\[(${GODS})\\]`, 'gu')))
      gods.set(match[1], match[2]);
    for (const match of original.matchAll(
      new RegExp(`(?:干|支)([${STEMS}${BRANCHES}]):(${GODS})`, 'gu'),
    ))
      gods.set(match[1], match[2]);
    for (const match of text.matchAll(
      new RegExp(`(?<![${STEMS}])([${STEMS}${BRANCHES}])(?:为|是)?[（(]?(${GODS})`, 'gu'),
    )) {
      const expected = gods.get(match[1]);
      if (expected && expected !== match[2] && !isNegated(match.index!, match[0].length))
        issues.add(`本盘${match[1]}对应${expected}，回答写为${match[2]}。`);
    }
  }
  const quotes = resources
    .filter((item) => item.usable && item.title.startsWith('传统条文'))
    .flatMap((item) =>
      [...item.text.matchAll(/^原文：(.+)$/gmu)].map((match) => compact(match[1])),
    );
  {
    for (const match of text.matchAll(/原文[：:]?[「“『]([^」”』]+)[」”』]/gu)) {
      if (
        !compact(original).includes(match[1]) &&
        !quotes.some((quote) => quote.includes(match[1]))
      )
        issues.add('所标原文与本次查得条文不一致，请引用已有原句或改用释义。');
    }
  }
  return [...issues].slice(0, 8);
}
