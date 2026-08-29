export type MetaphysicsTermCategory =
  '六爻' | '八字' | '奇门' | '紫微' | '六壬' | '易理' | '神煞' | '通论' | '塔罗' | '雷诺曼';

export interface TermContextData {
  chartTitle?: string;
  roleInChart: string;
  dynamicTone?: 'lucky' | 'unlucky' | 'neutral';
  pillarOrPalace?: string;
  relationshipSummary?: string;
}

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
