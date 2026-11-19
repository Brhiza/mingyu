export const cardDrawMethods = {
  random: 'Fisher-Yates 洗牌后依牌位顺序取顶牌',
  manual: '用户按牌位手工录入',
  interactive: '用户逐张抽取牌面',
} as const;

/** 来源由结果持有者提供；只能说明记录的方式，不能证明线下过程。 */
export function cardDrawDescription(method: unknown) {
  if (method === cardDrawMethods.random) return '结果标记为程序随机洗牌抽取；原抽取方式由调用方保存，服务无法验证来源。';
  if (method === cardDrawMethods.manual) return '结果标记为调用方按牌位提交牌面；服务无法验证牌面在线下如何取得。';
  if (method === cardDrawMethods.interactive) return '结果标记为调用方逐张选择并提交牌面；服务无法验证原始选择过程。';
  throw new Error('牌面结果缺少有效的选牌方式。');
}
