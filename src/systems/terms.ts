import rawTerms from '../data/terms.json';

export type MetaphysicsTermCategory =
  | '六爻'
  | '八字'
  | '奇门'
  | '紫微'
  | '六壬'
  | '易理'
  | '神煞'
  | '通论'
  | '塔罗'
  | '雷诺曼';

export interface MetaphysicsTerm {
  term: string;
  category: MetaphysicsTermCategory;
  pinyin?: string;
  summary: string;
  positive?: string;
  negative?: string;
  advice?: string;
  detail: string;
  classicRef?: string;
  aliases?: string[];
  tags?: string[];
}

export const METAPHYSICS_TERMS: readonly MetaphysicsTerm[] = rawTerms as MetaphysicsTerm[];

export const TERM_CATEGORIES: readonly MetaphysicsTermCategory[] = [
  '六爻',
  '八字',
  '奇门',
  '紫微',
  '六壬',
  '易理',
  '神煞',
  '通论',
  '塔罗',
  '雷诺曼',
];

const STEM_MAP: Record<string, string> = {
  甲: '甲木',
  乙: '乙木',
  丙: '丙火',
  丁: '丁火',
  戊: '戊土',
  己: '己土',
  庚: '庚金',
  辛: '辛金',
  壬: '壬水',
  癸: '癸水',
};

const BRANCH_MAP: Record<string, string> = {
  子: '子水',
  丑: '丑土',
  寅: '寅木',
  卯: '卯木',
  辰: '辰土',
  巳: '巳火',
  午: '午火',
  未: '未土',
  申: '申金',
  酉: '酉金',
  戌: '戌土',
  亥: '亥水',
};

/**
 * 按术语名或别名精确/模糊查询术数术语百科条目。
 */
export function lookupMetaphysicsTerm(query: string): MetaphysicsTerm | undefined {
  if (!query || typeof query !== 'string') return undefined;

  const cleaned = query
    .trim()
    .replace(/[[\]【】()（）:：\s]/g, '')
    .replace(/^(伏|身|主|副|见|缺)/, '');

  if (!cleaned) return undefined;

  // 1. 精确干支优先映射（防止单字 '甲' 或 '子' 误匹配到纳音）
  const stemOrBranch = STEM_MAP[cleaned] ?? BRANCH_MAP[cleaned];
  if (stemOrBranch) {
    const found = METAPHYSICS_TERMS.find((t) => t.term === stemOrBranch || t.term === cleaned);
    if (found) return found;
  }

  // 2. 精确命中术语名或别名（含英文大小写无关）
  const lower = cleaned.toLowerCase();
  const exact = METAPHYSICS_TERMS.find(
    (t) =>
      t.term === cleaned ||
      t.aliases?.some((alias) => alias === cleaned || alias.toLowerCase() === lower),
  );
  if (exact) return exact;

  // 3. 去除前后缀模糊命中
  const simplified = cleaned
    .replace(/(星|宫|神|将|门|运|限|卦|爻|座|牌)$/, '')
    .replace(/^(生年|大限|流年|流月|流日|大运)/, '');
  if (simplified.length >= 1) {
    const fuzzy = METAPHYSICS_TERMS.find(
      (t) =>
        t.term === simplified ||
        t.term.startsWith(simplified) ||
        t.aliases?.some((alias) => alias.includes(simplified)),
    );
    if (fuzzy) return fuzzy;
  }

  // 4. 包含关系模糊匹配
  return METAPHYSICS_TERMS.find(
    (t) =>
      t.term.includes(cleaned) ||
      cleaned.includes(t.term) ||
      t.aliases?.some((alias) => alias.includes(cleaned) || cleaned.includes(alias)),
  );
}

/**
 * 按分类列出术语百科条目。
 */
export function listTermsByCategory(category: MetaphysicsTermCategory): MetaphysicsTerm[] {
  return METAPHYSICS_TERMS.filter((item) => item.category === category);
}

/**
 * 按关键词（匹配术语、别名、标签、摘要与详述）检索术语百科。
 */
export function searchMetaphysicsTerms(
  keyword: string,
  options: { category?: MetaphysicsTermCategory; limit?: number } = {},
): MetaphysicsTerm[] {
  const q = keyword.trim().toLowerCase();
  if (!q) {
    const base = options.category ? listTermsByCategory(options.category) : [...METAPHYSICS_TERMS];
    return options.limit !== undefined ? base.slice(0, Math.max(0, options.limit)) : base;
  }

  const matched = METAPHYSICS_TERMS.filter((item) => {
    if (options.category && item.category !== options.category) return false;
    return (
      item.term.toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      item.detail.toLowerCase().includes(q) ||
      item.classicRef?.toLowerCase().includes(q) ||
      item.aliases?.some((alias) => alias.toLowerCase().includes(q)) ||
      item.tags?.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  return options.limit !== undefined ? matched.slice(0, Math.max(0, options.limit)) : matched;
}
