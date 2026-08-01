export function getBaziDefaultQuestion(
  _scene?: string,
  _options: { isCustomQuestion?: boolean } = {},
) {
  return '请先做整体解读。';
}

export function getBaziCompatibilityDefaultQuestion(_compatType?: string) {
  return '请先做整体合盘解读。';
}

export function getZiweiDefaultQuestion(
  _topic?: string,
  _options: { isCustomQuestion?: boolean } = {},
) {
  return '请核对十二宫、星曜、四化、运限与已校验格局等已计算事实。';
}

export function getZiweiCompatibilityDefaultQuestion(_topic?: string) {
  return '请核对双方十二宫同支映射与跨盘四化定位事实。';
}
