// The 60 valid stem-branch pairs and five-element relations used by this model.
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
export const SIXTY_CYCLE = Array.from({ length: 60 }, (_, i) => stems[i % 10] + branches[i % 12]);
export function assertValidGanZhi(value: unknown, label = '干支'): asserts value is string {
  if (typeof value !== 'string' || !SIXTY_CYCLE.includes(value)) throw new Error(`${label}组合无效：${String(value)}`);
}
const order = '木火土金水';
export function isSheng(source: string, target: string) {
  return order.includes(source) && order.includes(target) && order[(order.indexOf(source) + 1) % 5] === target;
}
export function isKe(source: string, target: string) {
  return order.includes(source) && order.includes(target) && order[(order.indexOf(source) + 2) % 5] === target;
}
