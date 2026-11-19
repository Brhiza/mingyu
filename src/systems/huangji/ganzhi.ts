const stems = '甲乙丙丁戊己庚辛壬癸';
export const EARTHLY_BRANCHES = [...'子丑寅卯辰巳午未申酉戌亥'];
export const SIXTY_CYCLE = Array.from({ length: 60 }, (_, i) => stems[i % 10] + EARTHLY_BRANCHES[i % 12]);
