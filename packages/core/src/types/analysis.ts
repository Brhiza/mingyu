export type ScopeType = 'origin' | 'decadal' | 'yearly' | 'monthly' | 'daily' | 'hourly' | 'age';

export type MutagenName = '禄' | '权' | '科' | '忌';

export type AnalysisPayloadV1 = {
  payload_version: 'analysis_payload_v1';
  language: 'zh-CN';
  calculation_config: ZiweiCalculationConfig;
  basic_info: BasicInfo;
  active_scope: ActiveScopeInfo;
  palaces: PalaceFact[];
  evidence_pool: EvidenceFact[];
  evidence_analysis?: ZiweiEvidenceAnalysis;
  patterns?: PatternFact[];
  pattern_analysis?: ZiweiPatternAnalysis;
};

export type ZiweiCalculationConfig = {
  engine: 'iztro';
  algorithm: 'default' | 'zhongzhou';
  algorithm_basis: string;
  fix_leap: boolean;
  leap_month_rule: string;
  year_divide: 'normal' | 'exact';
  year_divide_rule: string;
  horoscope_divide: 'normal' | 'exact';
  horoscope_divide_rule: string;
  age_divide: 'normal' | 'birthday';
  age_divide_rule: string;
  day_divide: 'current' | 'forward';
  late_zi_rule: string;
  limitation: string;
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
  palace_name?: string;
  heavenly_stem?: string;
  earthly_branch?: string;
  mutagen_map: ScopeMutagenItem[];
};

export type ScopeMutagenItem = {
  mutagen: MutagenName;
  star: string;
  palace_index?: number;
  palace_name?: string;
  dynamic_palace_name?: string;
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
  /** 统一稳定键；保留 stable_key 兼容旧调用。 */
  key?: string;
  status?: '已记录' | '资料缺口';
  type: string;
  title: string;
  scope: ScopeType;
  palace_indexes: number[];
  palace_names: string[];
  star_names: string[];
  mutagens: string[];
  description: string;
  level?: '主证' | '辅证' | '反证';
  source?: string;
  sources?: string[];
  calculation?: string;
  calculationStepKey?: string;
  dependsOnStepKeys?: string[];
  promptText?: string;
  limitation?: string;
  limitations?: string[];
};

export type ZiweiEvidenceCalculationStep = {
  key: string;
  stage: '十二宫输入校验' | '本命证据采集' | '运限证据采集' | '证据汇总';
  status: '已计算' | '不适用' | '存在资料缺口';
  dependsOnStepKeys: string[];
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  promptText: string;
  sources: string[];
  limitation: '紫微证据步骤只证明十二宫、星曜、四化与所选运限如何形成当前证据池；不得把证据数量解释为吉凶分数、匹配率、事件概率或固定应期';
};

export type ZiweiEvidenceCounterEvidenceFact = {
  key: string;
  type: '十二宫资料覆盖' | '运限资料覆盖' | '四化定位覆盖';
  status: '有可用证据' | '资料不足' | '存在未定位' | '不适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '紫微反证事实只记录宫位、运限与四化资料是否足以形成当前线索；未命中或未定位不等于现实有利、不利或没有其他传统关系';
};

export type ZiweiEvidenceSummaryFact = {
  key: 'ziwei:evidence-summary';
  status: '证据链完整' | '证据链有缺口' | '未生成';
  factKeys: string[];
  evidenceFactCount: number;
  natalFactCount: number;
  scopeFactCount: number;
  primaryFactCount: number;
  supportingFactCount: number;
  missingFactCount: number;
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '紫微证据汇总只统计本命宫星、四化、三方四正、运限落宫、运限四化、资料缺口、反证与限制覆盖；不得按数量生成命盘总分、吉凶概率、事件概率或唯一应期';
};

export type ZiweiEvidenceLimitationFact = {
  key: string;
  type: '传统结构边界' | '本命应期边界' | '运限层级边界' | '资料缺口边界' | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '紫微限制事实用于约束宫位、星曜、四化与运限证据可以支持的解释范围，不得被反向当作现实因果、人物意图、吉凶概率或保证有效建议的证据';
};

export type ZiweiEvidenceAnalysis = {
  key: 'ziwei:evidence';
  status: '已计算' | '存在资料缺口' | '未生成';
  calculationSteps: ZiweiEvidenceCalculationStep[];
  calculationChain: string[];
  counterEvidence: string[];
  counterEvidenceFacts: ZiweiEvidenceCounterEvidenceFact[];
  summaryFact: ZiweiEvidenceSummaryFact;
  limitations: string[];
  limitationFacts: ZiweiEvidenceLimitationFact[];
  promptText: string;
  methodology: { notes: string[] };
};

export type ZiweiPatternCalculationStep = {
  key: string;
  stage: '十二宫输入校验' | '格局规则评估' | '命中事实登记' | '格局覆盖汇总';
  status: '已计算' | '未生成' | '资料不足';
  dependsOnStepKeys: string[];
  inputs: Record<string, string | number | boolean | string[]>;
  result: Record<string, string | number | boolean | string[]>;
  promptText: string;
  sources: string[];
  limitation: '紫微格局计算步骤只证明登记规则如何核对当前十二宫、星曜、亮度、四化与宫位关系；不得把命中数量解释为命盘分数、现实概率或必然事件';
};

export type ZiweiPatternCounterEvidenceFact = {
  key: string;
  type: '十二宫资料覆盖' | '登记规则覆盖' | '未命中规则边界';
  status: '有可用证据' | '未命中' | '资料不足' | '未生成';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '紫微格局反证只记录十二宫资料、登记规则与未命中数量的覆盖状态；未命中不等于没有其他传统格局，也不证明现实有利或不利';
};

export type ZiweiPatternSummaryFact = {
  key: 'ziwei:pattern-summary';
  status: '已完成' | '未命中' | '资料不足' | '未生成';
  factKeys: string[];
  registeredRuleCount: number;
  evaluatedRuleCount: number;
  unevaluatedRuleCount: number;
  matchedPatternCount: number;
  unmatchedRuleCount: number;
  auspiciousPatternCount: number;
  inauspiciousPatternCount: number;
  neutralPatternCount: number;
  counterEvidenceCount: number;
  limitationFactCount: number;
  promptText: string;
  sources: string[];
  limitation: '紫微格局汇总只统计当前登记规则的评估覆盖和命中分类；不得按吉格、凶格、中性格或命中数量生成综合吉凶、权重、概率与固定应期';
};

export type ZiweiPatternLimitationFact = {
  key: string;
  type: '传统分类边界' | '规则覆盖边界' | '现实因果边界' | '高风险输出边界';
  status: '适用';
  ownerFactKeys: string[];
  promptText: string;
  sources: string[];
  limitation: '紫微格局限制事实用于约束规则命中可以支持的解释范围，不得被反向当作现实因果、人物命运、吉凶概率或保证有效建议的证据';
};

export type ZiweiPatternAnalysis = {
  key: 'ziwei:patterns';
  status: '已计算' | '未命中' | '资料不足' | '未生成';
  calculationSteps: ZiweiPatternCalculationStep[];
  calculationChain: string[];
  counterEvidence: string[];
  counterEvidenceFacts: ZiweiPatternCounterEvidenceFact[];
  summaryFact: ZiweiPatternSummaryFact;
  limitations: string[];
  limitationFacts: ZiweiPatternLimitationFact[];
  promptText: string;
  methodology: { notes: string[] };
};

export type PatternFact = {
  id: string;
  stable_key?: string;
  key?: string;
  status?: '已命中';
  name: string;
  kind: 'auspicious' | 'inauspicious' | 'neutral';
  description: string;
  palace_indexes: number[];
  palace_names: string[];
  star_names: string[];
  matched_conditions?: string[];
  traditional_interpretation?: string;
  source?: string;
  sources?: string[];
  calculation?: string;
  calculationStepKey?: string;
  dependsOnStepKeys?: string[];
  promptText?: string;
  limitation?: string;
  limitations?: string[];
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
export type TenGodPresenceStatus = '缺位' | '仅藏' | '透出' | '透藏并见';

export interface TenGodDistributionItem {
  tenGod: string;
  visibleCount: number;
  hiddenCount: number;
  totalCount: number;
  status: TenGodPresenceStatus;
}

export interface TenGodFamilyDistribution {
  family: string;
  visibleCount: number;
  hiddenCount: number;
  totalCount: number;
  status: TenGodPresenceStatus;
}
export interface TenGodStructureProfile {
  distributions: TenGodDistributionItem[];
  familyDistributions: TenGodFamilyDistribution[];
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
  /** 月令状态与司令两项事实的登记数量，不表示力量比例。 */
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
export type HarmonyTransformLevel = '成化' | '合而不化' | '争合不专' | '逢冲破合' | '隔位不合';
export type HarmonyTransformType = '天干五合' | '地支六合';
export type HarmonyTransformDirection = '向化' | '合绊' | '破合' | '不合';
export interface HarmonyTransformProfile {
  type: HarmonyTransformType;
  participants: string[];
  transformElement: string;
  transformStem?: string;
  level: HarmonyTransformLevel;
  direction: HarmonyTransformDirection;
  dayStemInvolved?: boolean;
  participantsAdjacent: boolean;
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
