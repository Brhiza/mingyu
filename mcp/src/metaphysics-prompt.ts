export function buildMetaphysicsPrompt(basePrompt: string, question?: string): string {
  const normalizedQuestion = question?.trim() || '请综合解读本次排盘的重点、风险与行动建议。';
  return [
    basePrompt,
    '',
    '【问题】',
    normalizedQuestion,
    '',
    '【任务】',
    '只依据上方排盘信息进行分析，先给结论，再说明依据、限制与建议。',
    '',
    '【输出要求】',
    '使用简体中文；不要编造盘面没有提供的信息；资料不足时明确说明不确定性。',
  ].join('\n');
}
