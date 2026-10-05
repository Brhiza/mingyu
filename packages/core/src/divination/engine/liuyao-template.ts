import type { LiuyaoTemplateType } from '../../types/divination';

export function buildLiuyaoTemplateText(template: LiuyaoTemplateType) {
  const templateLabelMap: Record<LiuyaoTemplateType, string> = {
    general: '通用',
    ganqing: '感情关系',
    shiye: '事业工作',
    caifu: '财运交易',
    guaishen: '鬼神怪异',
  };

  const templateGuidanceMap: Record<LiuyaoTemplateType, string> = {
    general: '',
    ganqing:
      '；主题取用：以世爻标记求测者，以应爻和问题所指对象作为关系候选；再列出盘面妻财、官鬼等六亲候选，按爻位、动静、旺衰、空破及世应关系逐项核对主次',
    shiye:
      '；主题取用：以世爻标记求测者，官鬼可作职位或约束候选，父母可作文书或制度候选；逐项核对实际爻位及动静、旺衰、空破，再联系世应确定主线',
    caifu:
      '；主题取用：以妻财作财物或收益候选，兄弟作分夺或支出候选，父母作契约或凭据候选；按实际爻位、动静、旺衰、空破与世应关系比较主次',
    guaishen:
      '；主题取用：以世爻和问题中的现实主体为主轴，鬼神、冲犯及异常感受列为盘面候选；逐项核对对应爻位、动静、旺衰、空破，并把环境、身心与现实线索作为并行条件',
  };

  const safeTemplate = Object.hasOwn(templateLabelMap, template) ? template : 'general';

  return `${templateLabelMap[safeTemplate]}${templateGuidanceMap[safeTemplate]}`;
}
