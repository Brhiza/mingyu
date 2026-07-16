import type { LiuyaoTemplateType } from '../../types/divination';

export function buildLiuyaoTemplateText(template: LiuyaoTemplateType) {
  const templateLabelMap: Record<LiuyaoTemplateType, string> = {
    general: '通用',
    ganqing: '感情关系',
    shiye: '事业工作',
    caifu: '财运交易',
    guaishen: '鬼神怪异',
  };

  const safeTemplate = templateLabelMap[template] ? template : 'general';

  return templateLabelMap[safeTemplate];
}
