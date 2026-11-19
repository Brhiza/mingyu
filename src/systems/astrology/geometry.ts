const norm = (value: number) => ((value % 360) + 360) % 360;

/** House cusps are left-closed; snap numerical noise at an exact cusp. */
export function houseAt(longitude: number, cusps: readonly number[]) {
  if (cusps.length !== 12 || !Number.isFinite(longitude) || !cusps.every(Number.isFinite)) throw new Error('宫位计算需要有效的十二宫头与黄经。');
  const boundary = cusps.findIndex((cusp) => Math.abs(norm(longitude - cusp + 180) - 180) < 1e-9);
  if (boundary >= 0) return boundary + 1;
  const index = cusps.findIndex((cusp, i) => norm(longitude - cusp) < norm(cusps[(i + 1) % 12] - cusp));
  if (index < 0) throw new Error('无法确定星体所在宫位。');
  return index + 1;
}
