// 爻线从初爻到三爻，自下而上。
export const trigrams: Record<number, { name: string; symbol: string; nature: string; element: string; lines: number[] }> = {
  1: { name: '乾', symbol: '☰', nature: '天', element: '金', lines: [1, 1, 1] },
  2: { name: '兑', symbol: '☱', nature: '泽', element: '金', lines: [1, 1, 0] },
  3: { name: '离', symbol: '☲', nature: '火', element: '火', lines: [1, 0, 1] },
  4: { name: '震', symbol: '☳', nature: '雷', element: '木', lines: [1, 0, 0] },
  5: { name: '巽', symbol: '☴', nature: '风', element: '木', lines: [0, 1, 1] },
  6: { name: '坎', symbol: '☵', nature: '水', element: '水', lines: [0, 1, 0] },
  7: { name: '艮', symbol: '☶', nature: '山', element: '土', lines: [0, 0, 1] },
  8: { name: '坤', symbol: '☷', nature: '地', element: '土', lines: [0, 0, 0] },
};
