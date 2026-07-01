export type EvidenceLevel = '主证' | '辅证' | '反证' | '限制' | '应期';

export interface PromptEvidenceItem {
  level: EvidenceLevel;
  title: string;
  detail?: string;
  source?: string;
  weight?: number;
  tags?: string[];
}

export interface PromptEvidenceBundle {
  title?: string;
  items: PromptEvidenceItem[];
  emptyText?: string;
}
