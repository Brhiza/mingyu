import type { LiuyaoTemplateType } from '../../types/divination';

export function buildLiuyaoTemplateText(template: LiuyaoTemplateType, question: string) {
  const templateLabelMap: Record<LiuyaoTemplateType, string> = {
    general: '通用断卦',
    ganqing: '感情关系',
    shiye: '事业工作',
    caifu: '财运交易',
    guaishen: '鬼神怪异',
  };

  const focusMap: Record<LiuyaoTemplateType, string> = {
    general: '用神主轴、世应关系、动变趋势、空亡伏神与现实行动建议。',
    ganqing: '对象意向、关系推进阻力、复合或止损节奏、沟通窗口。',
    shiye: '岗位机会、领导规则压力、跳槽窗口、推进与观望节奏。',
    caifu: '财源兑现、合作交易风险、守财能力、进退节奏。',
    guaishen: '官鬼与子孙制鬼、世应受冲、玄武螣蛇白虎勾陈、空破入墓与家宅怪异线索。',
  };

  const evidenceMap: Record<LiuyaoTemplateType, string> = {
    general: '优先看世应、动爻、用神、变卦与空亡，再用伏神与六神做辅助印证。',
    ganqing: '优先按性别与问题取官鬼或妻财为候选用神，再看世应、动变与关系阻力。',
    shiye: '优先看官鬼、父母与世应，再看动爻、变卦、空亡与外部规则压力。',
    caifu: '优先看妻财、兄弟、子孙与世应，再看动变、空亡与是否有耗财分财迹象。',
    guaishen:
      '优先看官鬼是否旺动贴世，再看子孙能否制鬼，并结合玄武、螣蛇、白虎、勾陈与家宅疾病语义判断。',
  };

  const actionMap: Record<LiuyaoTemplateType, string> = {
    general: '先回答成不成、要不要动，再给一条最值得立即执行的动作。',
    ganqing: '明确更适合主动、观望、沟通还是止损，不要只说有缘无缘。',
    shiye: '明确更适合推进、调整、暂缓还是换方向，并给出现实抓手。',
    caifu: '明确更适合进攻、防守、回撤还是暂不出手，并写清风险点。',
    guaishen:
      '明确更像心理压力、现实扰动，还是民俗意义上的冲犯征象；建议以稳妥、现实、不过度渲染的口径作答。',
  };
  const safeTemplate = templateLabelMap[template] ? template : 'general';

  const caution =
    safeTemplate === 'guaishen'
      ? '若卦中证据不足，只能说“未见明显鬼神主证”或“更偏情绪/环境因素”，不要故作惊悚判断。'
      : '若主证不足，要明确说明只是倾向判断，不要强行下绝对结论。';

  return [
    `断卦类型：${templateLabelMap[safeTemplate]}`,
    `断卦重点：${focusMap[safeTemplate]}`,
    `取证顺序：${evidenceMap[safeTemplate]}`,
    `问题聚焦：${question || '请围绕当前问题落到现实决策。'} `,
    '建议展开顺序：',
    '1. 主判断：先说明这件事当前整体是顺、卡、反复，还是需要止损。',
    '2. 主证据：点明世应、用神、动爻、变卦、空亡、伏神里最关键的证据。',
    '3. 过程变化：说明事情为何这样发展，中间会卡在哪、会怎么变。',
    `4. 行动建议：${actionMap[safeTemplate]}`,
    `5. 风险提醒：${caution}`,
  ].join('\n');
}
