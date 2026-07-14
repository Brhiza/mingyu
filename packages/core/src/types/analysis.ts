export type ScopeType = 'origin' | 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly' | 'age';

export type MutagenName = '禄' | '权' | '科' | '忌';

export type AnalysisPayloadV1 = {
  payload_version: 'analysis_payload_v1';
  language: 'zh-CN';
  basic_info: BasicInfo;
  active_scope: ActiveScopeInfo;
  palaces: PalaceFact[];
  evidence_pool: EvidenceFact[];
  patterns?: PatternFact[];
};

export type FourPillars = {
  year_pillar: string;
  month_pillar: string;
  day_pillar: string;
  hour_pillar: string;
};

export type HiddenPalaces = {
  body_palace_index?: number;
  body_palace_name?: string;
  original_palace_index?: number;
  original_palace_name?: string;
  anhe_palace_index?: number;
  anhe_palace_name?: string;
};

export type BasicInfo = {
  gender: string;
  solar_date: string;
  lunar_date: string;
  chinese_date: string;
  birth_time_label: string;
  birth_time_range: string;
  zodiac: string;
  sign: string;
  five_elements_class: string;
  soul: string;
  body: string;
  soul_palace_branch: string;
  body_palace_branch: string;
  four_pillars?: FourPillars;
  hidden_palaces?: HiddenPalaces;
};

export type ActiveScopeInfo = {
  scope: ScopeType;
  label: string;
  solar_date: string;
  lunar_date: string;
  nominal_age: number;
  palace_index?: number;
  heavenly_stem?: string;
  earthly_branch?: string;
  mutagen_map: ScopeMutagenItem[];
};

export type ScopeMutagenItem = {
  mutagen: MutagenName;
  star: string;
  palace_index?: number;
  palace_name?: string;
};

export type MutagedPlaceItem = {
  mutagen: MutagenName;
  palace_index?: number;
  palace_name?: string;
};

export type PalaceFact = {
  index: number;
  name: string;
  is_body_palace: boolean;
  is_original_palace: boolean;
  heavenly_stem: string;
  earthly_branch: string;
  major_stars: StarFact[];
  minor_stars: StarFact[];
  other_stars: StarFact[];
  scope_stars: StarFact[];
  changsheng12: string;
  boshi12: string;
  base_jiangqian12: string;
  base_suiqian12: string;
  yearly_jiangqian12?: string;
  yearly_suiqian12?: string;
  decadal_range: [number, number];
  ages: number[];
  dynamic_scope_name?: string;
  scope_hits: string[];
  empty_state: boolean;
  opposite_palace_index: number;
  surrounded_palace_indexes: number[];
  summary_tags: string[];
  mutaged_palaces?: MutagedPlaceItem[];
  self_mutagens?: MutagenName[];
};

export type StarFact = {
  name: string;
  kind: string;
  scope?: string;
  brightness?: string;
  birth_mutagen?: MutagenName;
  horoscope_mutagen?: MutagenName;
  active_scope_mutagen?: MutagenName;
};

export type EvidenceFact = {
  id: string;
  stable_key: string;
  type: string;
  title: string;
  scope: ScopeType;
  palace_indexes: number[];
  palace_names: string[];
  star_names: string[];
  mutagens: string[];
  description: string;
};

export type PatternFact = {
  id: string;
  name: string;
  kind: 'auspicious' | 'inauspicious' | 'neutral';
  description: string;
  palace_indexes: number[];
  palace_names: string[];
  star_names: string[];
};

export interface DayRootItem {
  pillar: string;
  branch: string;
  stem: string;
  tenGod: string;
  strength: '本气' | '中气' | '余气';
}
export interface DayRootProfile {
  status: '有根' | '弱根' | '无根';
  items: DayRootItem[];
  summary: string;
}
export interface StemRootItem {
  pillar: string;
  branch: string;
  stem: string;
  tenGod: string;
  strength: '本气' | '中气' | '余气';
}
export interface VisibleStemRootItem {
  pillar: string;
  stem: string;
  tenGod: string;
  status: '有本根' | '有同气根' | '无根';
  summary: string;
}
export interface StemRootProfile {
  items: VisibleStemRootItem[];
  rootedCount: number;
  summary: string;
}
export interface ExposedStemItem {
  pillar: string;
  stem: string;
  tenGod: string;
  seasonStatus: string;
  commandStatus: string;
  rootStatus: string;
  summary: string;
}
export interface ExposedStemProfile {
  items: ExposedStemItem[];
  summary: string;
}
export interface TenGodDistributionItem {
  tenGod: string;
  visibleCount: number;
  hiddenCount: number;
  totalCount: number;
  status: string;
}
export interface TenGodStructureProfile {
  distributions: TenGodDistributionItem[];
  familyDistributions: Array<{ family: string; totalCount: number; status: string }>;
  summary: string;
}
export interface TenGodFlowItem {
  name: string;
  description: string;
  caution: string;
}
export interface TenGodFlowProfile {
  items: TenGodFlowItem[];
  summary: string;
}
export interface MonthQiElementItem {
  element: string;
  seasonStatus: string;
  /** 传统月令状态与司令规则的归一化构成占比，不是概率或吉凶比例。 */
  weightSharePercent: number;
  count: number;
  commanderApplied: boolean;
  ruleBasis: string[];
  summary: string;
}
export interface MonthQiProfile {
  commanderStem: string;
  leadingElements: string[];
  items: MonthQiElementItem[];
  summary: string;
}
export interface RelationStructureItem {
  category: string;
  name: string;
  element?: string;
  pillars: string[];
  values: string[];
  evidence: string;
}
export interface RelationStructureProfile {
  items: RelationStructureItem[];
  summary: string;
}
export type HarmonyTransformLevel = '完全合化' | '大部分化' | '半化半绊' | '合而不化' | '纯粹牵绊';
export type HarmonyTransformType = '天干五合' | '地支六合';
export type HarmonyTransformDirection = '向化' | '合绊' | '合去';
export interface HarmonyTransformProfile {
  type: HarmonyTransformType;
  participants: string[];
  transformElement: string;
  transformStem?: string;
  level: HarmonyTransformLevel;
  direction: HarmonyTransformDirection;
  monthSupported: boolean;
  transformStemVisible: boolean;
  transformRooted: boolean;
  hasClashBreak: boolean;
  hasControllingElement: boolean;
  hasCompetition: boolean;
  evidence: string[];
  isTransformed: boolean;
  consequences: string[];
}
export interface UsefulGodPlacementItem {
  pillar: string;
  branch?: string;
  stem: string;
  tenGod: string;
  status: '喜神得力' | '喜神受制' | '忌神受制' | '忌神猖獗' | '中性';
  evidence: string;
}
export interface UsefulGodPlacementProfile {
  items: UsefulGodPlacementItem[];
  favorableCount: number;
  unfavorableCount: number;
  summary: string;
}
export interface TenGodLifeStageItem {
  stem: string;
  tenGod: string;
  strongCount: number;
  lowCount: number;
  summary: string;
}
export interface TenGodLifeStageProfile {
  items: TenGodLifeStageItem[];
  summary: string;
}
export interface TombStorageItem {
  branch: string;
  storageElement: string;
  storageStem: string;
  storageTenGod: string;
  isDayMasterTomb: boolean;
}
export interface TombStorageProfile {
  items: TombStorageItem[];
  summary: string;
}
export interface KongWangFillableItem {
  fillType: string;
  condition: string;
}
export interface KongWangProfile {
  items: Array<{
    pillar: string;
    emptyBranches: string[];
    isEmpty: boolean;
    fillableItems?: KongWangFillableItem[];
  }>;
  summary: string;
}
export interface NayinItem {
  pillar: string;
  ganZhi: string;
  nayin: string;
  element: string;
}
export interface NayinProfile {
  items: NayinItem[];
  summary: string;
}
export interface MingGuaProfile {
  number: number;
  gua: string;
  star: string;
  element: string;
  eastWest: '东四命' | '西四命';
}
export interface XiaoYunItem {
  age: number;
  year: number;
  ganZhi: string;
  tenGod: string;
}
export interface XiaoYunProfile {
  startAge: number;
  startGanZhi: string;
  firstLuckAge: number;
  items: XiaoYunItem[];
  summary: string;
}
export interface LuckDirectionProfile {
  direction: '顺行' | '逆行';
  summary: string;
}
