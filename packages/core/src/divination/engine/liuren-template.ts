import type { LiurenData, LiurenTemplateType } from '../../types/divination';

export function getLiurenPatternHint(pattern?: LiurenData['transmissionPattern']) {
  if (pattern === '伏吟') {
    return '传态伏吟：旧因反复，先稳局再推进。';
  }
  if (pattern === '反吟') {
    return '传态反吟：冲动与反复并存，先定底线和止损。';
  }
  if (pattern === '回环') {
    return '传态回环：问题会回到原点，要先切断循环触发点。';
  }
  if (pattern === '递传') {
    return '传态递传：宜分阶段推进，按节奏逐步落地。';
  }

  return '传态未标注：优先按初传-中传-末传的顺序说明。';
}

export function buildLiurenTemplateText(template: LiurenTemplateType, _data: LiurenData) {
  const templateLabelMap: Record<LiurenTemplateType, string> = {
    general: '通用',
    ganqing: '感情关系',
    shiye: '事业工作',
    caifu: '财富财运',
  };
  const mainLineMap: Record<LiurenTemplateType, string> = {
    general: '类神主线：以初传发用为主轴，日干为我、日支为事，三传看发端—转折—归结',
    ganqing: '类神主线：以初传与天后/六合/青龙等感情类象优先，日干为我、日支为对方或关系场',
    shiye: '类神主线：以初传与贵人/朱雀/青龙等事业文书类象优先，日干为我、日支为职场或事务场',
    caifu: '类神主线：以初传与青龙/太常/天空等财帛类象优先，日干为我、日支为财源或交易场',
  };
  const safeTemplate = templateLabelMap[template] ? template : 'general';

  return `${templateLabelMap[safeTemplate]}；${mainLineMap[safeTemplate]}`;
}
