import { EARTHLY_BRANCHES, getLifeStage } from '../ganzhi-foundation';
import type { BaziPillar, PillarName } from './pillars';

type Pillars = Record<PillarName, BaziPillar>;
type Basis = { pillar: PillarName; kind: '干' | '支' | '柱' | '纳音'; value: string; target: string };
const positions: PillarName[] = ['year', 'month', 'day', 'hour'];
const branches = '子丑寅卯辰巳午未申酉戌亥';
const stems = '甲乙丙丁戊己庚辛壬癸';
const tianyi: Record<string, string> = { 甲: '丑未', 戊: '丑未', 庚: '丑未', 乙: '子申', 己: '子申', 丙: '亥酉', 丁: '亥酉', 壬: '卯巳', 癸: '卯巳', 辛: '寅午' };
const taiji: Record<string, string> = { 甲: '子午', 乙: '子午', 丙: '卯酉', 丁: '卯酉', 戊: '辰戌丑未', 己: '辰戌丑未', 庚: '寅亥', 辛: '寅亥', 壬: '巳申', 癸: '巳申' };
const wenchang: Record<string, string> = { 甲: '巳', 乙: '午', 丙: '申', 丁: '酉', 戊: '申', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };
const lu: Record<string, string> = { 甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳', 己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子' };
const fuxing: Record<string, string> = { 甲: '寅子', 丙: '寅子', 乙: '卯丑', 癸: '卯丑', 戊: '申', 己: '未', 丁: '亥', 庚: '午', 辛: '巳', 壬: '辰' };
const guoyin: Record<string, string> = { 甲: '戌', 乙: '亥', 丙: '丑', 丁: '寅', 戊: '丑', 己: '寅', 庚: '辰', 辛: '巳', 壬: '未', 癸: '申' };
const jinyu: Record<string, string> = { 甲: '辰', 乙: '巳', 丙: '未', 丁: '申', 戊: '未', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' };
const tianchu: Record<string, string> = Object.fromEntries([...stems].map((stem, index) => [stem, lu[stems[(index + 2) % 10]]]));
const liuxia: Record<string, string> = { 甲: '酉', 乙: '戌', 丙: '未', 丁: '申', 戊: '巳', 己: '午', 庚: '辰', 辛: '卯', 壬: '亥', 癸: '寅' };
const xueren: Record<string, string> = { 寅: '丑', 卯: '未', 辰: '寅', 巳: '申', 午: '卯', 未: '酉', 申: '辰', 酉: '戌', 戌: '巳', 亥: '亥', 子: '午', 丑: '子' };
const tiande: Record<string, string> = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' };
const tiandehe: Record<string, string> = { 寅: '壬', 卯: '巳', 辰: '丁', 巳: '丙', 午: '寅', 未: '己', 申: '戊', 酉: '亥', 戌: '辛', 亥: '庚', 子: '申', 丑: '乙' };
const combinations: Record<string, string> = { 甲: '己', 乙: '庚', 丙: '辛', 丁: '壬', 戊: '癸', 己: '甲', 庚: '乙', 辛: '丙', 壬: '丁', 癸: '戊' };
const trines = [
  { members: '申子辰', yima: '寅', taohua: '酉', jiangxing: '子', huagai: '辰', wangshen: '亥', jiesha: '巳', zaisha: '午', yuede: '壬' },
  { members: '亥卯未', yima: '巳', taohua: '子', jiangxing: '卯', huagai: '未', wangshen: '申', jiesha: '寅', zaisha: '酉', yuede: '甲' },
  { members: '寅午戌', yima: '申', taohua: '卯', jiangxing: '午', huagai: '戌', wangshen: '巳', jiesha: '亥', zaisha: '子', yuede: '丙' },
  { members: '巳酉丑', yima: '亥', taohua: '午', jiangxing: '酉', huagai: '丑', wangshen: '寅', jiesha: '申', zaisha: '卯', yuede: '庚' },
] as const;
const dayRules = {
  魁罡: '庚辰 壬辰 戊戌 庚戌', 阴差阳错: '丙子 丁丑 戊寅 辛卯 壬辰 癸巳 丙午 丁未 戊申 辛酉 壬戌 癸亥',
  孤鸾煞: '甲寅 乙巳 丙午 丁巳 戊午 戊申 辛亥 壬子', 十灵日: '甲辰 乙亥 丙辰 丁酉 戊午 庚寅 庚戌 辛亥 壬寅 癸未',
  六秀日: '丙午 丁未 戊子 戊午 己丑 己未', 八专: '甲寅 乙卯 丁未 戊戌 己未 庚申 辛酉 癸丑',
  九丑: '丁酉 戊子 戊午 己卯 己酉 辛卯 辛酉 壬子 壬午', 十恶大败: '甲辰 乙巳 丙申 丁亥 戊戌 己丑 庚辰 辛巳 壬申 癸亥',
} as const;
const seasonalRules = {
  天赦日: ['戊寅', '甲午', '戊申', '甲子'], 四废日: ['庚申 辛酉', '壬子 癸亥', '甲寅 乙卯', '丙午 丁巳'],
  天转: ['乙卯', '丙午', '辛酉', '壬子'], 地转: ['辛卯', '戊午', '癸酉', '丙子'],
} as const;
const names = ['天乙贵人', '太极贵人', '文昌贵人', '福星贵人', '国印贵人', '金舆', '天厨贵人', '禄神', '羊刃', '飞刃', '流霞',
  '驿马', '桃花', '将星', '华盖', '亡神', '劫煞', '灾煞', '红鸾', '天喜', '孤辰', '寡宿', '丧门', '吊客', '披麻',
  '天德贵人', '天德合', '月德贵人', '月德合', '天医', '血刃', '空亡', '学堂', '词馆', '德秀贵人', '红艳煞', '勾绞煞', '天罗地网', '童子煞', ...Object.keys(dayRules), ...Object.keys(seasonalRules), '金神', '三奇贵人', '拱禄', '元辰'] as const;

type Name = typeof names[number];
export type BaziYangRenMode = 'all-stems' | 'yang-only' | 'all-stems-guandai';
const guandaiYangRen: Record<string, string> = {
  甲: '卯', 乙: '辰', 丙: '午', 丁: '未', 戊: '午', 己: '未', 庚: '酉', 辛: '戌', 壬: '子', 癸: '丑',
};
export interface BaziShenshaOptions {
  yangRenMode?: BaziYangRenMode;
  kongWangMode?: 'day' | 'day-and-year';
}
/** 只列已迁移的查法，并保留命中位置、目标干支和起例。 */
export function calculateBaziShensha(pillars: Pillars, gender?: 'male' | 'female', target?: BaziPillar, options?: BaziShenshaOptions) {
  const entries: Array<{ name: Name; position: PillarName; branch: string; targetKind: '干' | '支' | '柱'; target: string; basis: Basis[] }> = [];
  const defaultWang = EARTHLY_BRANCHES.find((branch) => getLifeStage(pillars.day.gan, branch) === '帝旺');
  if (!defaultWang) throw new Error('日干帝旺地支不可用。');
  const yangRenMode = options?.yangRenMode ?? 'all-stems';
  const isYangDay = stems.indexOf(pillars.day.gan) % 2 === 0;
  const wang = yangRenMode === 'yang-only'
    ? (isYangDay ? defaultWang : undefined)
    : yangRenMode === 'all-stems-guandai'
      ? guandaiYangRen[pillars.day.gan]
      : defaultWang;
  const kongWangPillars = options?.kongWangMode === 'day' ? (['day'] as const) : (['year', 'day'] as const);
  const offset = (branch: string, amount: number) => branches[(branches.indexOf(branch) + amount + 12) % 12];
  const group = (branch: string) => {
    const value = trines.find((item) => item.members.includes(branch));
    if (!value) throw new Error('神煞起例地支无效。');
    return value;
  };
  const season = ['寅卯辰', '巳午未', '申酉戌', '亥子丑'].findIndex((item) => item.includes(pillars.month.zhi));
  if (season < 0) throw new Error('神煞月令地支无效。');
  for (const position of target ? ['hour' as const] : positions) {
    const { zhi: branch, gan, ganZhi } = target ?? pillars[position];
    const add = (name: Name, targetKind: '干' | '支' | '柱', basis: Basis[]) => {
      if (basis.length) entries.push({ name, position, branch, targetKind, target: targetKind === '干' ? gan : targetKind === '支' ? branch : ganZhi, basis });
    };
    const byStem = (table: Record<string, string>): Basis[] => (['year', 'day'] as const).flatMap((pillar) => table[pillars[pillar].gan]?.includes(branch) ? [{ pillar, kind: '干' as const, value: pillars[pillar].gan, target: branch }] : []);
    const dayStem = (target: string): Basis[] => target === branch ? [{ pillar: 'day', kind: '干', value: pillars.day.gan, target }] : [];
    const byBranch = (key: 'yima' | 'taohua' | 'jiangxing' | 'huagai' | 'wangshen' | 'jiesha', excludeSelf = false): Basis[] => (['year', 'day'] as const).flatMap((pillar) => (!excludeSelf || pillar !== position) && group(pillars[pillar].zhi)[key] === branch ? [{ pillar, kind: '支' as const, value: pillars[pillar].zhi, target: branch }] : []);
    const yearBranch = (target: string, excludeYear = false): Basis[] => (!excludeYear || position !== 'year') && target === branch ? [{ pillar: 'year', kind: '支', value: pillars.year.zhi, target }] : [];
    const monthBranch = (target: string, targetKind: '干' | '支' | '柱'): Basis[] => (targetKind === '干' ? gan : targetKind === '支' ? branch : ganZhi) === target ? [{ pillar: 'month', kind: '支', value: pillars.month.zhi, target }] : [];
    for (const [name, table] of [['天乙贵人', tianyi], ['太极贵人', taiji], ['文昌贵人', wenchang], ['福星贵人', fuxing], ['国印贵人', guoyin], ['金舆', jinyu], ['天厨贵人', tianchu]] as const) add(name, '支', byStem(table));
    add('禄神', '支', dayStem(lu[pillars.day.gan]));
    if (wang) {
      add('羊刃', '支', dayStem(wang));
      add('飞刃', '支', dayStem(offset(wang, 6)));
    }
    add('流霞', '支', dayStem(liuxia[pillars.day.gan]));
    for (const [name, key, exclude] of [['驿马', 'yima', false], ['桃花', 'taohua', false], ['将星', 'jiangxing', true], ['华盖', 'huagai', true], ['亡神', 'wangshen', false], ['劫煞', 'jiesha', false]] as const) add(name, '支', byBranch(key, exclude));
    add('灾煞', '支', yearBranch(group(pillars.year.zhi).zaisha, true));
    const y = branches.indexOf(pillars.year.zhi);
    add('红鸾', '支', yearBranch(branches[(3 - y + 12) % 12], true)); add('天喜', '支', yearBranch(branches[(9 - y + 12) % 12], true));
    const seasons = ['亥子丑', '寅卯辰', '巳午未', '申酉戌'];
    const yearSeason = seasons.findIndex((value) => value.includes(pillars.year.zhi));
    add('孤辰', '支', yearBranch(['寅', '巳', '申', '亥'][yearSeason])); add('寡宿', '支', yearBranch(['戌', '丑', '辰', '未'][yearSeason]));
    add('丧门', '支', yearBranch(offset(pillars.year.zhi, 2))); add('吊客', '支', yearBranch(offset(pillars.year.zhi, -2))); add('披麻', '支', yearBranch(offset(pillars.year.zhi, -3)));
    for (const [name, target] of [['天德贵人', tiande[pillars.month.zhi]], ['天德合', tiandehe[pillars.month.zhi]], ['月德贵人', group(pillars.month.zhi).yuede], ['月德合', combinations[group(pillars.month.zhi).yuede]]] as const) {
      const kind = stems.includes(target) ? '干' as const : '支' as const;
      add(name, kind, monthBranch(target, kind));
    }
    add('天医', '支', monthBranch(offset(pillars.month.zhi, -1), '支')); add('血刃', '支', monthBranch(xueren[pillars.month.zhi], '支'));
    add('空亡', '支', kongWangPillars.flatMap((pillar) => pillars[pillar].voidBranches.includes(branch) ? [{ pillar, kind: '柱' as const, value: pillars[pillar].ganZhi, target: branch }] : []));
    const nayinElement = pillars.year.naYin.slice(-1);
    const school: Record<string, string> = { 金: '巳', 木: '亥', 水: '申', 土: '申', 火: '寅' };
    const academy: Record<string, string> = { 金: '申', 木: '寅', 水: '亥', 土: '亥', 火: '巳' };
    const nayinBasis = (target: string): Basis[] => position !== 'year' && target === branch ? [{ pillar: 'year', kind: '纳音', value: pillars.year.naYin, target }] : [];
    add('学堂', '支', nayinBasis(school[nayinElement])); add('词馆', '支', nayinBasis(academy[nayinElement]));
    const deXiu = ['丙丁戊癸', '庚辛乙', '壬癸戊己丙辛甲', '甲乙丁壬'][['寅午戌', '巳酉丑', '申子辰', '亥卯未'].findIndex((item) => item.includes(pillars.month.zhi))];
    add('德秀贵人', '干', deXiu.includes(gan) ? [{ pillar: 'month', kind: '支', value: pillars.month.zhi, target: gan }] : []);
    const hongyan: Record<string, string> = { 甲: '午', 乙: '午', 丙: '寅', 丁: '未', 戊: '辰', 己: '辰', 庚: '戌', 辛: '酉', 壬: '子', 癸: '申' };
    add('红艳煞', '支', dayStem(hongyan[pillars.day.gan]));
    add('勾绞煞', '支', [...yearBranch(offset(pillars.year.zhi, 3)), ...yearBranch(offset(pillars.year.zhi, -3))]);
    if (gender) {
      const yangYear = stems.indexOf(pillars.year.gan) % 2 === 0;
      const direction = (yangYear && gender === 'male') || (!yangYear && gender === 'female') ? 5 : 7;
      add('元辰', '支', yearBranch(offset(pillars.year.zhi, direction)));
    }
    const net: Record<string, string> = { 戌: '亥', 亥: '戌', 辰: '巳', 巳: '辰' };
    add('天罗地网', '支', (['year', 'day'] as const).flatMap((pillar) => pillar !== position && net[pillars[pillar].zhi] === branch ? [{ pillar, kind: '支' as const, value: pillars[pillar].zhi, target: branch }] : []));
    if (position === 'day' || position === 'hour') {
      const seasonal = season % 2 === 0 ? '寅子' : '卯未辰';
      const nayin = nayinElement === '金' || nayinElement === '木' ? '午卯' : nayinElement === '水' || nayinElement === '火' ? '酉戌' : nayinElement === '土' ? '辰巳' : '';
      add('童子煞', '支', [
        ...(seasonal.includes(branch) ? [{ pillar: 'month' as const, kind: '支' as const, value: pillars.month.zhi, target: branch }] : []),
        ...(nayin.includes(branch) ? [{ pillar: 'year' as const, kind: '纳音' as const, value: pillars.year.naYin, target: branch }] : []),
      ]);
    }

    if (position === 'day') {
      for (const [name, list] of Object.entries(dayRules)) if (list.split(' ').includes(ganZhi)) add(name, '柱', [{ pillar: 'day', kind: '柱', value: ganZhi, target: ganZhi }]);
      for (const [name, list] of Object.entries(seasonalRules)) if (list[season].split(' ').includes(ganZhi)) add(name, '柱', monthBranch(ganZhi, '柱'));
    }
    if ((position === 'day' || position === 'hour') && ['乙丑', '己巳', '癸酉'].includes(ganZhi)) add('金神', '柱', [{ pillar: position, kind: '柱', value: ganZhi, target: ganZhi }]);
  }
  const global: Array<{ name: '三奇贵人' | '拱禄'; basis: Basis[] }> = [];
  if (!target) {
    const heavenly = positions.map((position) => pillars[position].gan).join('');
    for (const sequence of ['甲戊庚', '乙丙丁', '壬癸辛']) {
      const index = heavenly.indexOf(sequence);
      if (index >= 0) {
        global.push({ name: '三奇贵人', basis: positions.slice(index, index + 3).map((pillar) => ({ pillar, kind: '干', value: pillars[pillar].gan, target: sequence })) });
        break;
      }
    }
    const pairs = ['癸亥 癸丑', '癸丑 癸亥', '丁巳 丁未', '己未 己巳', '戊辰 戊午'];
    if (pairs.includes(`${pillars.day.ganZhi} ${pillars.hour.ganZhi}`)) global.push({ name: '拱禄', basis: (['day', 'hour'] as const).map((pillar) => ({ pillar, kind: '柱', value: pillars[pillar].ganZhi, target: pillars[pillar].ganZhi })) });
  }
  const included = gender ? [...names] : names.filter((name) => name !== '元辰');
  const unavailable = gender ? [] : [{ name: '元辰', reason: '该查法需要性别，未提供时不推测。' }];
  const yangRenRuleText = yangRenMode === 'yang-only'
    ? '羊刃仅取五阳干（阴干不取羊刃飞刃）'
    : yangRenMode === 'all-stems-guandai'
      ? '羊刃阳干取帝旺、阴干顺取冠带位'
      : '羊刃兼取阴干';
  const kongWangRuleText = options?.kongWangMode === 'day' ? '空亡仅采用日柱旬空' : '空亡同时采用年柱与日柱旬空';
  return { included, unavailable, entries, global, rule: `按列出的年干、日干、年支、日支、月支、年纳音或日柱查找；三奇与拱禄单列为整局组合；将星华盖排除相同起例柱，红鸾天喜及灾煞排除年柱，${yangRenRuleText}；${kongWangRuleText}；元辰按年干阴阳及性别查年支顺数五位或七位。`,
    limitation: `仅列${included.length}项本命神煞${gender ? '' : '（元辰因未提供性别未计算）'}，不含其他流派口径或岁运神煞；神煞为传统旁证，不可单凭命中推断现实结果。` };
}
export function formatBaziShenshaHits(value: ReturnType<typeof calculateBaziShensha>, includeBasis = false, emptyText = '所列查法均未命中。') {
  const labels: Record<PillarName, string> = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };
  const basisText = (basis: Basis[], showTarget: boolean) => basis.map((item) => `${labels[item.pillar]}${item.kind}${item.value}${showTarget ? `查${item.target}` : ''}`).join('、');
  const entries = value.entries.map((item) => `${labels[item.position]}${item.target}：${item.name}${includeBasis ? `（${basisText(item.basis, true)}）` : ''}`);
  const global = value.global.map((item) => `整局：${item.name}${includeBasis ? `（${basisText(item.basis, false)}）` : ''}`);
  return [...entries, ...global].join('；') || emptyText;
}
/** 仅合并起例、目标和柱位完全相同的命中项，不合并看似相同但来源不同的结果。 */
export function partitionBaziShensha(values: ReturnType<typeof calculateBaziShensha>[]) {
  if (!values.length) throw new Error('神煞候选不能为空。');
  const sharedKeys = (field: 'entries' | 'global') => {
    const rest = values.slice(1).map((value) => new Set(value[field].map((item) => JSON.stringify(item))));
    return new Set(values[0][field].map((item) => JSON.stringify(item)).filter((key) => rest.every((set) => set.has(key))));
  };
  const entries = sharedKeys('entries'), global = sharedKeys('global');
  const pick = (value: typeof values[number], common: boolean) => ({ ...value,
    entries: value.entries.filter((item) => entries.has(JSON.stringify(item)) === common),
    global: value.global.filter((item) => global.has(JSON.stringify(item)) === common),
  });
  return { common: pick(values[0], true), differences: values.map((value) => pick(value, false)) };
}
export function formatBaziShensha(value: ReturnType<typeof calculateBaziShensha>) {
  return `${formatBaziShenshaHits(value, true)}\n${value.rule}\n${value.limitation}`;
}
