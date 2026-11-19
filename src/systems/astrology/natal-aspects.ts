/** Native natal aspect rules; the 30% strength cutoff is applied separately. */
export const natalAspectRules = [
  ['conjunction', '合相', 0, 8], ['sextile', '六合', 60, 6], ['square', '刑相', 90, 7],
  ['trine', '拱相', 120, 8], ['opposition', '冲相', 180, 8], ['semi-sextile', '半六合', 30, 2],
  ['semi-square', '半刑', 45, 2], ['quintile', '五分相', 72, 2], ['sesquiquadrate', '补八分相', 135, 2],
  ['biquintile', '双五分相', 144, 2], ['quincunx', '梅花相', 150, 3],
] as const;
