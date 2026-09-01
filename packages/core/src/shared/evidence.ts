/**
 * TempoSoul·命律 — 证据链穿透契约（Evidence Chain Contract）
 *
 * 每个计算结果必须附带可追溯的证据四字段：
 *   1. computation_chain — 计算链（用到了哪些公式/算法/中间值）
 *   2. source            — 出处（典籍/文献/算法来源）
 *   3. boundary          — 边界（适用范围、不适用场景、精度限制）
 *   4. counter_evidence  — 反证（可能推翻此结论的条件或替代解释）
 *
 * 附加：confidence 置信度、depth 证据链深度（前端展示 ≤4 层）
 *
 * 本文件为引擎所有计算模块的统一证据契约，任何计算结果都应通过
 * attachEvidence() 附加证据，或在结果类型中包含 evidenceTrail。
 */

// ---------------------------------------------------------------------------
// 置信度
// ---------------------------------------------------------------------------

export type EvidenceConfidence = 'high' | 'medium' | 'low';

export const CONFIDENCE_SCORE: Record<EvidenceConfidence, number> = {
  high: 0.9,
  medium: 0.6,
  low: 0.3,
};

// ---------------------------------------------------------------------------
// 证据四字段
// ---------------------------------------------------------------------------

/** 计算链节点：描述一次中间计算用到的公式/算法/输入值 */
export interface ComputationStep {
  /** 步骤名称，如 "真太阳时校正"、"五虎遁月干" */
  name: string;
  /** 公式或算法描述 */
  formula?: string;
  /** 输入值（可序列化） */
  inputs?: Record<string, unknown>;
  /** 输出值 */
  output?: unknown;
  /** 引用的子模块或函数 */
  reference?: string;
}

/** 出处：典籍/文献/算法来源 */
export interface EvidenceSource {
  /** 来源类型 */
  type: 'classical' | 'modern' | 'algorithm' | 'empirical' | 'derived';
  /** 来源名称，如 "《渊海子平》"、"Meeus Astronomical Algorithms" */
  name: string;
  /** 章节/页码/公式编号 */
  location?: string;
  /** 原文引用（可选） */
  quote?: string;
}

/** 边界：适用范围与限制 */
export interface EvidenceBoundary {
  /** 适用条件 */
  applicableWhen?: string[];
  /** 不适用或需谨慎的条件 */
  cautionWhen?: string[];
  /** 精度限制（如真太阳时 ±1 分钟） */
  precision?: string;
  /** 时区/地域限制 */
  region?: string;
}

/** 反证：可能推翻结论的条件或替代解释 */
export interface CounterEvidence {
  /** 反证描述 */
  description: string;
  /** 触发反证的条件 */
  condition?: string;
  /** 严重程度：可能改变结论 / 仅作补充说明 */
  severity: 'overturn' | 'alternative' | 'minor';
}

// ---------------------------------------------------------------------------
// 证据条目（四字段 + 置信度）
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  /** 证据标题（一句话结论） */
  title: string;
  /** 计算链 */
  computationChain: ComputationStep[];
  /** 出处 */
  source: EvidenceSource;
  /** 边界 */
  boundary: EvidenceBoundary;
  /** 反证 */
  counterEvidence?: CounterEvidence[];
  /** 置信度 */
  confidence: EvidenceConfidence;
  /** 证据层级（0=主证，1=辅证，2=衍生，3=参考，≤4） */
  depth: number;
  /** 关联的命理学体系，如 "bazi"、"ziwei"、"true-solar-time" */
  system?: string;
  /** 标签（用于前端筛选） */
  tags?: string[];
}

// ---------------------------------------------------------------------------
// 证据链（一组证据，深度受限）
// ---------------------------------------------------------------------------

export const MAX_EVIDENCE_DEPTH = 4;

export interface EvidenceTrail {
  /** 证据链中的所有证据（按 depth 排序） */
  items: EvidenceItem[];
  /** 整体置信度（取最低或加权） */
  overallConfidence: EvidenceConfidence;
  /** 证据链摘要（前端首屏展示） */
  summary: string;
  /** 生成时间 */
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// 运行时守卫（防止非法证据进入结果）
// ---------------------------------------------------------------------------

/** 验证证据条目是否符合契约，返回错误信息数组（空数组=通过） */
export function validateEvidenceItem(item: unknown): string[] {
  const errors: string[] = [];
  if (item === null || typeof item !== 'object') {
    return ['evidence item must be an object'];
  }
  const e = item as Record<string, unknown>;
  if (typeof e.title !== 'string' || !e.title.trim()) {
    errors.push('evidence.title is required');
  }
  if (!Array.isArray(e.computationChain)) {
    errors.push('evidence.computationChain must be an array');
  }
  if (e.source === null || typeof e.source !== 'object') {
    errors.push('evidence.source is required');
  }
  if (e.boundary === null || typeof e.boundary !== 'object') {
    errors.push('evidence.boundary is required');
  }
  if (!['high', 'medium', 'low'].includes(e.confidence as string)) {
    errors.push('evidence.confidence must be high|medium|low');
  }
  if (typeof e.depth !== 'number' || e.depth < 0 || e.depth > MAX_EVIDENCE_DEPTH) {
    errors.push(`evidence.depth must be 0-${MAX_EVIDENCE_DEPTH}`);
  }
  return errors;
}

/** 断言证据条目合法（不合法时抛错） */
export function assertEvidenceItem(item: unknown): asserts item is EvidenceItem {
  const errors = validateEvidenceItem(item);
  if (errors.length > 0) {
    throw new Error(`Invalid evidence item: ${errors.join('; ')}`);
  }
}

/** 构建证据链，自动限制深度并计算整体置信度 */
export function buildEvidenceTrail(
  items: EvidenceItem[],
  summary: string,
): EvidenceTrail {
  // 深度限制：超过 MAX_EVIDENCE_DEPTH 的证据被截断
  const filtered = items
    .filter((item) => item.depth <= MAX_EVIDENCE_DEPTH)
    .sort((a, b) => a.depth - b.depth);

  // 整体置信度：取最低置信度（短板效应）
  const confidenceOrder: EvidenceConfidence[] = ['low', 'medium', 'high'];
  const overallConfidence = filtered.reduce<EvidenceConfidence>((min, item) => {
    return confidenceOrder.indexOf(item.confidence) < confidenceOrder.indexOf(min)
      ? item.confidence
      : min;
  }, 'high');

  return {
    items: filtered,
    overallConfidence,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

/** 给结果附加证据链 */
export function attachEvidence<T extends object>(
  result: T,
  trail: EvidenceTrail,
): T & { evidenceTrail: EvidenceTrail } {
  return { ...result, evidenceTrail: trail };
}

/** 创建一个简单的高置信度证据（常用快捷方式） */
export function createHighConfidenceEvidence(
  title: string,
  system: string,
  source: EvidenceSource,
  computationChain: ComputationStep[] = [],
  boundary: EvidenceBoundary = {},
): EvidenceItem {
  return {
    title,
    system,
    computationChain,
    source,
    boundary,
    confidence: 'high',
    depth: 0,
  };
}
