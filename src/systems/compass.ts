/** 正北 0°、顺时针的二十四山；各山中心间隔 15°。 */
export const mountains = [...'子癸丑艮寅甲卯乙辰巽巳丙午丁未坤申庚酉辛戌乾亥壬'] as readonly string[];
export const trigrams = [...'坎艮震巽离坤兑乾'] as readonly string[];
const normalize = (degree: number) => ((degree % 360) + 360) % 360;
const distance = (a: number, b: number) => Math.min(normalize(a - b), normalize(b - a));

export function mountainTrigram(mountain: string) {
  const index = mountains.indexOf(mountain);
  if (index < 0) throw new Error('坐山须为二十四山之一。');
  return trigrams[Math.floor(((index + 1) % 24) / 3)];
}
export function mountainAt(degree: number) {
  if (!Number.isFinite(degree) || degree < 0 || degree > 360) throw new Error('罗盘度数须在 0 至 360 度之间。');
  const normalized = normalize(degree), index = Math.floor(normalize(normalized + 7.5) / 15);
  const isBoundary = Math.abs(normalize(normalized - 7.5) % 15) < 1e-10;
  return { degree: normalized, mountain: mountains[index], index, centerDegree: index * 15,
    startDegree: normalize(index * 15 - 7.5), endDegree: normalize(index * 15 + 7.5), isBoundary,
    ...(isBoundary ? { boundaryMountains: [mountains[(index + 23) % 24], mountains[index]] } : {}) };
}

/** 角度以坐山方向输入；测量误差范围含端点，恰在分界时保留两侧。 */
export function measureSitDirection(input: { degree: number; northReference?: 'unspecified' | 'true' | 'magnetic'; magneticDeclinationDegrees?: number; uncertaintyDegrees?: number }) {
  const { degree } = input, reference = input.northReference ?? 'unspecified', declination = input.magneticDeclinationDegrees, uncertainty = input.uncertaintyDegrees ?? 0;
  if (!Number.isFinite(degree) || degree < 0 || degree > 360) throw new Error('罗盘度数须在 0 至 360 度之间。');
  if (!['unspecified', 'true', 'magnetic'].includes(reference)) throw new Error('北向基准无效。');
  if (!Number.isFinite(uncertainty) || uncertainty < 0 || uncertainty > 45) throw new Error('测量误差须在 0 至 45 度之间。');
  if (reference === 'magnetic' ? declination === undefined || !Number.isFinite(declination) || Math.abs(declination) > 30 : declination !== undefined) throw new Error('仅磁北读数须提供 -30 至 30 度的磁偏角。');
  const corrected = normalize(degree + (declination ?? 0));
  const candidates = mountains.flatMap((sitMountain, index) => distance(corrected, index * 15) <= uncertainty + 7.5 + 1e-10 ? [{ sitMountain, facingMountain: mountains[(index + 12) % 24], houseGua: mountainTrigram(sitMountain) }] : []);
  const houseGuas = [...new Set(candidates.map((item) => item.houseGua))];
  return { input: { degree, northReference: reference, magneticDeclinationDegrees: declination ?? null, uncertaintyDegrees: uncertainty },
    correctedDegree: corrected, primary: mountainAt(corrected), candidates, houseGuas,
    stability: houseGuas.length > 1 ? '宅卦不稳定' : candidates.length > 1 ? '山向边界敏感' : '稳定',
    warnings: [...(reference === 'unspecified' ? ['北向基准未声明，须核对是否需要磁偏角修正。'] : []), ...(candidates.length > 1 ? ['测量范围涉及多个坐山，应并列核对。'] : [])] };
}
