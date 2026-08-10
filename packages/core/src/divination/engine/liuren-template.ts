import type { LiurenData, LiurenTemplateType } from '../../types/divination';

export function getLiurenPatternHint(pattern?: LiurenData['transmissionPattern']) {
  if (pattern === '伏吟') {
    return '传态伏吟：旧因反复。';
  }
  if (pattern === '反吟') {
    return '传态反吟：冲动与反复并存。';
  }
  if (pattern === '回环') {
    return '传态回环：问题会回到原点。';
  }
  if (pattern === '递传') {
    return '传态递传：按阶段推进。';
  }

  return '传态未标注。';
}

export function buildLiurenTemplateText(template: LiurenTemplateType, _data: LiurenData) {
  const templateLabelMap: Record<LiurenTemplateType, string> = {
    general: '通用',
    ganqing: '感情关系',
    shiye: '事业工作',
    caifu: '财富财运',
  };
  const mainLineMap: Record<LiurenTemplateType, string> = {
    general: '类神：日干为我、日支为事；三传看发端、转折和归结',
    ganqing: '类神：感情看天后、六合、青龙；日干为我、日支为关系',
    shiye: '类神：事业看贵人、朱雀、青龙；日干为我、日支为事务',
    caifu: '类神：财运看青龙、太常、天空；日干为我、日支为财源或交易',
  };
  const safeTemplate = templateLabelMap[template] ? template : 'general';

  return `${templateLabelMap[safeTemplate]}；${mainLineMap[safeTemplate]}`;
}
