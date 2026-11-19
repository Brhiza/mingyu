export type TaiyiScope = 'year' | 'month' | 'day' | 'hour';

export interface TaiyiModelInfo {
  id: string;
  name: string;
  supportedScopes: TaiyiScope[];
  precision: string;
  sources: { title: string; url: string; evidence: string }[];
}

export interface TaiyiResult {
  scope: TaiyiScope;
  ganZhi: string;
  dateTime: string;
  /** 真太阳时起局时，用于节气与年月干支的实际占时。 */
  termReferenceDateTime?: string;
  accumulatedValue: number;
  accumulatedLabel: '积年' | '积月' | '积日' | '积时';
  entryYears: number;
  yinYang: '阳遁' | '阴遁';
  bureau: number;
  taiyiPosition: string;
  taiyiPalace: number;
  taiyiGua: string;
  taiyiDir: string;
  wenChangPosition: string;
  wenChangPalace: number;
  shiJiPosition: string;
  shiJiPalace: number;
  jiShenPosition: string;
  jiShenPalace: number;
  lordCount: number;
  guestCount: number;
  setCount: number;
  /** 主客定算策数定性（和数、纯阴、纯阳、杂阴阳等） */
  countNatures?: {
    lord?: string;
    guest?: string;
    set?: string;
  };
  /** 大局攻守与策数博弈定性 */
  tacticGuidance?: string;
  lordGeneral: number;
  lordAssistant: number;
  guestGeneral: number;
  guestAssistant: number;
  setGeneral: number;
  setAssistant: number;
  sixteenGods: { branch: string; god: string }[];
  /** 三门、五将与阴阳和的盘面条件；只记录可复算关系，不生成成败分数。 */
  conditions: import('./conditions').TaiyiRuleConditions;
  judgments: string[];
  model: TaiyiModelInfo;
  evidenceAnalysis: import('./evidence').TaiyiEvidenceAnalysis;
  prompt: string;
}

