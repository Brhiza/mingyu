/** NASA/Espenak–Meeus 分段估算 TT−UT1 秒数。 */
export function estimateDeltaTSeconds(decimalYear: number) {
  if (!Number.isFinite(decimalYear) || decimalYear < 1899 || decimalYear >= 2202) {
    throw new Error('ΔT 估算的 UTC 年份需在 1899-2201 之间。');
  }
  let value: number;
  if (decimalYear < 1900) {
    const t = decimalYear - 1860;
    value =
      7.62 +
      0.5737 * t -
      0.251754 * t ** 2 +
      0.01680668 * t ** 3 -
      0.0004473624 * t ** 4 +
      t ** 5 / 233174;
  } else if (decimalYear < 1920) {
    const t = decimalYear - 1900;
    value = -2.79 + 1.494119 * t - 0.0598939 * t ** 2 + 0.0061966 * t ** 3 - 0.000197 * t ** 4;
  } else if (decimalYear < 1941) {
    const t = decimalYear - 1920;
    value = 21.2 + 0.84493 * t - 0.0761 * t ** 2 + 0.0020936 * t ** 3;
  } else if (decimalYear < 1961) {
    const t = decimalYear - 1950;
    value = 29.07 + 0.407 * t - t ** 2 / 233 + t ** 3 / 2547;
  } else if (decimalYear < 1986) {
    const t = decimalYear - 1975;
    value = 45.45 + 1.067 * t - t ** 2 / 260 - t ** 3 / 718;
  } else if (decimalYear < 2005) {
    const t = decimalYear - 2000;
    value =
      63.86 +
      0.3345 * t -
      0.060374 * t ** 2 +
      0.0017275 * t ** 3 +
      0.000651814 * t ** 4 +
      0.00002373599 * t ** 5;
  } else if (decimalYear < 2050) {
    const t = decimalYear - 2000;
    value = 62.92 + 0.32217 * t + 0.005589 * t ** 2;
  } else if (decimalYear < 2150) {
    value = -20 + 32 * ((decimalYear - 1820) / 100) ** 2 - 0.5628 * (2150 - decimalYear);
  } else {
    const u = (decimalYear - 1820) / 100;
    value = -20 + 32 * u ** 2;
  }
  return Number(value.toFixed(3));
}

