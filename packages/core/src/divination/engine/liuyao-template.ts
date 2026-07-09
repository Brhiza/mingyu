import type { LiuyaoTemplateType } from '../../types/divination';

export function buildLiuyaoTemplateText(template: LiuyaoTemplateType) {
  const templateLabelMap: Record<LiuyaoTemplateType, string> = {
    general: '通用断卦',
    ganqing: '感情关系',
    shiye: '事业工作',
    caifu: '财运交易',
    guaishen: '鬼神怪异',
  };

  const safeTemplate = templateLabelMap[template] ? template : 'general';

  const caution =
    safeTemplate === 'guaishen'
      ? '证据不足时只能说“未见明显鬼神主证”或“更偏情绪/环境因素”，不要作惊悚化判断。'
      : '主证不足时说明只是倾向判断，不要强行下绝对结论。';

  return [
    `断卦类型：${templateLabelMap[safeTemplate]}`,
    '断卦类型只作为问题范围；未限定或通用时按通用断卦处理，不额外套用固定事项。',
    '取证顺序：先按世应、用神候选、动爻、变卦、空亡、伏神、月日建等卦内证据判断。',
    '回答口径：先直接回答问题，再列最关键的 2 到 4 条卦内依据、触发条件和现实建议。',
    `证据边界：${caution}`,
  ].join('\n');
}
