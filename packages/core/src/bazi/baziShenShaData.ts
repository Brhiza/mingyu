/**
 * 神煞名称只表示传统规则的结构化命中，不自动转换成吉凶、事项或现实领域。
 *
 * 旧版分类会把单个名称直接归入“吉神”“凶神”“权力”“姻缘”等类别，
 * 但这些判断仍依赖整局、旺衰、刑冲与具体问题，不能由底层可靠闭合。
 * 为兼容既有导出保留同名入口，所有名称统一按中性传统旁证处理。
 */
export const shenShaTypes: { lucky: string[]; unlucky: string[]; neutral: string[] } = {
  lucky: [],
  unlucky: [],
  neutral: [],
};

export const getShenShaCategory = (shensha: string): string =>
  shensha.trim() ? '传统神煞' : '其他';
