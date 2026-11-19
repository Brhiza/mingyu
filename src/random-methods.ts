export const randomDivinationMethods = ['liuyao', 'meihua', 'xiaoliuren', 'jinkoujue', 'qimen', 'liuren', 'taiyi', 'tarot', 'ssgw', 'lenormand'] as const;
export const randomDivinationLabels: Record<typeof randomDivinationMethods[number], string> = {
  liuyao: '六爻', meihua: '梅花易数', xiaoliuren: '小六壬', jinkoujue: '金口诀', qimen: '奇门遁甲',
  liuren: '大六壬', taiyi: '太乙神数', tarot: '塔罗', ssgw: '三山国王灵签', lenormand: '雷诺曼',
};
