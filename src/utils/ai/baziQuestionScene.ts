export const BAZI_QUESTION_SCENES = [
  'general',
  'recent',
  'career',
  'job-change',
  'startup-partnership',
  'investment-partnership',
  'wealth',
  'marriage',
  'relationship-push',
  'relationship-decision',
  'reconciliation-decision',
  'children',
  'family',
  'home-move',
  'settle-relocate',
  'social',
  'emotion',
  'health',
  'parents',
  'study',
  'study-advance',
  'exam-landing',
  'growth',
  'talent',
] as const;

export type BaziQuestionScene = (typeof BAZI_QUESTION_SCENES)[number];

export function resolveBaziQuestionScene(selectedScene: string | undefined): BaziQuestionScene {
  if (selectedScene && BAZI_QUESTION_SCENES.includes(selectedScene as BaziQuestionScene)) {
    return selectedScene as BaziQuestionScene;
  }
  return 'general';
}

export function buildBaziQuestionGuidanceSection(
  _scene: string,
  hasFortuneSelection: boolean,
): string {
  const lines = [
    '先围绕【问题】展开，不要只做命格总论。',
    '用户没有选择具体分类时按通用八字口径处理；用户选择了分类时只把分类作为问题范围，不补充本地固定话术。',
    '先按传统八字次序立论：月令旺衰、格局成败、调候寒暖燥湿、用神忌神，再看十神、宫位、刑冲合害和神煞辅助。',
    '每个关键结论都要区分主证、辅证、反证或限制，并对应到命盘证据、岁运证据或现实建议；证据不足时说“倾向”或“需要补充信息”。',
    '区分“本命长期倾向”和“当前/指定岁运触发”，不要把一时运势说成一生命定。',
    '神煞、纳音、桃花、驿马、空亡等只能作为旁证，不得越过格局、用神和岁运主线直接定吉凶。',
  ];

  lines.push(
    hasFortuneSelection
      ? '若已提供【分析对象】，优先围绕对应的大运、流年、流月或流日作答，并说明本命底色如何被该年限触发。'
      : '若没有提供【分析对象】，不得自行展开具体年份、月份或日期的岁运证据，只能做本命结构、长期趋势或当前资料范围内的判断。',
  );

  return lines.map((line) => `- ${line}`).join('\n');
}
