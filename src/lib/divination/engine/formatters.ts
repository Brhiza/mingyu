import type { DivinationData, SupplementaryInfo } from '../../../types/divination';
import type { DivinationMethodId } from 'mingyu-core/divination/config';
import {
  formatEnhancedDivinationInfo,
  formatAstrolabeInfo,
  formatGanzhi,
  formatSupplementaryInfoSection,
  formatTaiyiInfo,
  buildSection,
  buildSolarTimeInfoText,
  buildTimeInfoText,
} from 'mingyu-core/prompt';

export {
  formatAstrolabeInfo,
  formatGanzhi,
  formatSupplementaryInfoSection,
  formatTaiyiInfo,
  buildSection,
  buildSolarTimeInfoText,
  buildTimeInfoText,
};

/**
 * 前端历史入口的兼容适配层。
 *
 * 占法资料格式化属于核心能力，实际实现统一由 mingyu-core 提供；这里保留旧参数
 * 形状，避免页面和已有调用方必须同步迁移。
 */
export function formatDivinationInfo(
  method: Exclude<DivinationMethodId, 'random'>,
  data: DivinationData,
  question = '',
  supplementaryInfo?: SupplementaryInfo,
  options?: { liuyaoTemplate?: 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen' },
) {
  return formatEnhancedDivinationInfo(method, data, question, supplementaryInfo, options);
}
