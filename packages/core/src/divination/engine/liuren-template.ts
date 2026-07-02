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

export function buildLiurenTemplateText(template: LiurenTemplateType, data: LiurenData) {
  const templateLabelMap: Record<LiurenTemplateType, string> = {
    general: '通用断课',
    ganqing: '感情断课',
    shiye: '事业断课',
    caifu: '财富断课',
  };
  const templateFocusMap: Record<LiurenTemplateType, string> = {
    ganqing: '关系定位、沟通边界、推进节奏（继续/观望/止损）。',
    shiye: '岗位路径、协作阻力、窗口时机（推进/调整/暂缓）。',
    caifu: '现金流稳定性、风险敞口、操作节奏（进攻/防守/回撤）。',
    general: '核心目标、现实阻力、下一步动作（先做什么）。',
  };
  const chu = data.threeTransmissions[0];
  const classicalRule = data.classicalRules?.[0];
  const safeTemplate = templateLabelMap[template] ? template : 'general';

  return [
    `分析类型：${templateLabelMap[safeTemplate]}`,
    `关注重点：${templateFocusMap[safeTemplate]}`,
    getLiurenPatternHint(data.transmissionPattern),
    `取证顺序：先按${classicalRule?.rule || '取传法'}看发用${chu ? `${chu.branch}乘${chu.god}` : '初传'}，再看三传推进，四课看背景，课体神煞只作辅证。`,
    '回答格式：先给结论，再列 2 到 4 条关键依据和建议；不要复述完整课盘。',
  ].join('\n');
}
