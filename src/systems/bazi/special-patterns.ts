/**
 * 八字外格与日时特象核验（已合并入格局关系引擎，不再单独成块）
 *
 * 严格遵循《三命通会》《渊海子平》《子平真诠》《滴天髓》成格与破格条件，
 * 覆盖普通月令正格之外的高频外象：
 * 1. 两神成象格（木火通明 / 金水相涵 / 水木清华 / 火土炎燥 / 土金毓秀 / 水火既济等）
 * 2. 日时外象：魁罡、金神、日德、日贵、日禄归时
 * 3. 暗拱暗冲：拱禄、拱贵、六阴朝阳、井栏叉、壬骑龙背
 * （注：月令建禄格/月刃格已由普通格局与路径引擎原生处理，不在此重复）
 *
 * 原则：未命中不输出噪声；命中必同时给出「成立依据」与「破格/反证核查」，绝不乱扣大格帽子。
 */
import { KE_MAP, SHENG_MAP } from '../ganzhi-foundation';
import { branchesClash } from './natal-facts';
import type { BaziPillar, PillarName } from './pillars';
import type { buildDayMasterStrength } from './strength';

type Pillars = Record<PillarName, BaziPillar>;

export interface SpecialPatternMatch {
  id: string;
  name: string;
  category: '象法格' | '日时外格' | '暗拱暗冲格';
  status: '条件成立' | '成中有破' | '候补参考';
  basis: string;
  breakingFactors: string[];
  guidance: string;
}

const POSITIONS: readonly PillarName[] = ['year', 'month', 'day', 'hour'];
const LU_BRANCH: Record<string, string> = {
  甲: '寅', 乙: '卯', 丙: '巳', 丁: '午', 戊: '巳',
  己: '午', 庚: '申', 辛: '酉', 壬: '亥', 癸: '子',
};

const TWO_GOD_LABELS: Record<string, string> = {
  '木火': '木火通明（相生两神）',
  '火土': '火土炎燥/相生两神',
  '土金': '土金毓秀（相生两神）',
  '金水': '金水相涵（相生两神）',
  '水木': '水木清华（相生两神）',
  '木土': '木土相制（相克两神）',
  '土水': '土水相激（相克两神）',
  '水火': '水火既济（相克两神）',
  '火金': '火金相炼（相克两神）',
  '金木': '金木交战（相克两神）',
};

const KUI_GANG_PILLARS = new Set(['庚辰', '庚戌', '壬辰', '戊戌']);
const JIN_SHEN_HOURS = new Set(['乙丑', '己巳', '癸酉']);
const RI_DE_PILLARS = new Set(['甲寅', '丙辰', '戊辰', '庚辰', '壬戌']);
const RI_GUI_PILLARS = new Set(['丁酉', '丁亥', '癸卯', '癸巳']);

const GONG_LU_RULES: ReadonlyArray<{ day: string; hour: string; arched: string }> = [
  { day: '癸亥', hour: '癸丑', arched: '子' },
  { day: '癸丑', hour: '癸亥', arched: '子' },
  { day: '丁巳', hour: '丁未', arched: '午' },
  { day: '己未', hour: '己巳', arched: '午' },
  { day: '戊辰', hour: '戊午', arched: '巳' },
];

const GONG_GUI_RULES: ReadonlyArray<{ day: string; hour: string; arched: string }> = [
  { day: '甲申', hour: '甲戌', arched: '酉' },
  { day: '乙未', hour: '乙酉', arched: '申' },
  { day: '甲寅', hour: '甲子', arched: '丑' },
  { day: '戊申', hour: '戊午', arched: '未' },
  { day: '辛丑', hour: '辛卯', arched: '寅' },
];

function getPairLabel(e1: string, e2: string): string {
  return TWO_GOD_LABELS[`${e1}${e2}`] ?? TWO_GOD_LABELS[`${e2}${e1}`] ?? `${e1}${e2}两神成象`;
}

export function detectBaziSpecialPatterns(
  pillars: Pillars,
  _strength?: ReturnType<typeof buildDayMasterStrength>,
): SpecialPatternMatch[] {
  const matches: SpecialPatternMatch[] = [];
  const allBranches = POSITIONS.map((p) => pillars[p].zhi);
  const allStems = POSITIONS.map((p) => pillars[p].gan);
  const visibleTenGods = (['year', 'month', 'hour'] as const).map((p) => pillars[p].tenGod);
  const dayStem = pillars.day.gan;
  const dayBranch = pillars.day.zhi;
  const dayGz = pillars.day.ganZhi;
  const hourGz = pillars.hour.ganZhi;
  const monthBranch = pillars.month.zhi;

  const hasClashWith = (branch: string, skipPos?: PillarName) =>
    POSITIONS.some((p) => p !== skipPos && branchesClash(pillars[p].zhi, branch));

  // 1. 两神成象格：八字明字（4天干 + 4地支本气）仅两种五行且势均（各 >= 2，且差值 <= 4）
  {
    const counts = new Map<string, number>();
    for (const p of POSITIONS) {
      counts.set(pillars[p].stemElement, (counts.get(pillars[p].stemElement) ?? 0) + 1);
      counts.set(pillars[p].branchElement, (counts.get(pillars[p].branchElement) ?? 0) + 1);
    }
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (entries.length === 2 && entries[0]![1] >= 2 && entries[1]![1] >= 2) {
      const [e1, c1] = entries[0]!;
      const [e2, c2] = entries[1]!;
      const shengMap: Record<string, string> = SHENG_MAP;
      const keMap: Record<string, string> = KE_MAP;
      const isSheng = shengMap[e1] === e2 || shengMap[e2] === e1;
      const isKe = keMap[e1] === e2 || keMap[e2] === e1;
      const balanced = Math.abs(c1 - c2) <= 2;
      const label = getPairLabel(e1, e2);
      const breaking: string[] = [];
      if (!balanced) breaking.push(`两行明字比例偏斜（${e1}${c1} vs ${e2}${c2}），须防偏枯`);
      if (isKe && !balanced) breaking.push('相克两神失衡，岁运须防一方受克过甚');
      matches.push({
        id: 'liang-shen-cheng-xiang',
        name: `两神成象格（${label}）`,
        category: '象法格',
        status: balanced ? '条件成立' : '候补参考',
        basis: `四柱八字明字纯由${e1}（${c1}字）与${e2}（${c2}字）两行构成（${isSheng ? '相生流畅' : '相克制衡'}），无杂气混局`,
        breakingFactors: breaking,
        guidance: isSheng
          ? '相生两神宜顺其秀气流通，岁运忌见克泄截断之五行'
          : '相克两神宜通关调和或维持双方均势，忌一边倒破衡',
      });
    }
  }

  // 2. 魁罡格
  if (KUI_GANG_PILLARS.has(dayGz)) {
    const multiCount = POSITIONS.filter((p) => KUI_GANG_PILLARS.has(pillars[p].ganZhi)).length;
    const breaking: string[] = [];
    const hasOfficer = visibleTenGods.some((g) => g === '正官' || g === '七杀');
    const hasWealth = visibleTenGods.some((g) => g === '正财' || g === '偏财');
    if (dayGz.startsWith('庚') && hasOfficer) breaking.push('庚日魁罡透官杀，易损制断锋芒');
    if (dayGz === '壬辰' && hasWealth) breaking.push('壬辰魁罡透财星，须防财破印比气势');
    if (hasClashWith(dayBranch, 'day')) breaking.push(`日支${dayBranch}见原局六冲，根基动摇`);
    matches.push({
      id: 'kui-gang',
      name: multiCount >= 2 ? `叠见魁罡格（共${multiCount}柱）` : '魁罡格',
      category: '日时外格',
      status: breaking.length === 0 ? '条件成立' : '成中有破',
      basis: `日柱${dayGz}坐魁罡${multiCount >= 2 ? `，且全盘共见${multiCount}柱魁罡` : ''}；主决断刚毅、掌权立威之象`,
      breakingFactors: breaking,
      guidance: '魁罡喜身旺成势，忌刑冲破害与岁运再逢冲日支之年',
    });
  }

  // 3. 金神格（甲、己日见乙丑、己巳、癸酉时）
  if ((dayStem === '甲' || dayStem === '己') && JIN_SHEN_HOURS.has(hourGz)) {
    const hasFire =
      allStems.some((s) => s === '丙' || s === '丁') ||
      allBranches.some((b) => b === '巳' || b === '午');
    const monthFire = monthBranch === '巳' || monthBranch === '午';
    const breaking: string[] = [];
    if (!hasFire) breaking.push('原局不见丙丁巳午火乡制化，金神未得真火锻炼');
    if (allBranches.filter((b) => b === '亥' || b === '子').length >= 2) {
      breaking.push('原局水旺克火，须防岁运水乡损制火之力');
    }
    matches.push({
      id: 'jin-shen',
      name: '金神格',
      category: '日时外格',
      status: hasFire ? (breaking.length === 0 ? '条件成立' : '成中有破') : '候补参考',
      basis: `${dayStem}日生于${hourGz}时入古法金神；${monthFire ? '月令见火乡最得真气' : hasFire ? '原局见火制化' : '原局暂缺火制，须待火运引动'}`,
      breakingFactors: breaking,
      guidance: '《三命通会》云“金神入火乡，富贵天下响”，最喜丙丁巳午火运制化，忌水乡熄火',
    });
  }

  // 4. 日德格
  if (RI_DE_PILLARS.has(dayGz)) {
    const breaking: string[] = [];
    if (hasClashWith(dayBranch, 'day')) breaking.push(`日支${dayBranch}受六冲，削弱日德厚重之气`);
    const hasSha = visibleTenGods.includes('七杀');
    if (hasSha) breaking.push('天干透七杀相攻，须有印星或食神转化');
    matches.push({
      id: 'ri-de',
      name: '日德格',
      category: '日时外格',
      status: breaking.length === 0 ? '条件成立' : '成中有破',
      basis: `日柱${dayGz}为五日德之一，主气度醇厚、逢凶化吉之象`,
      breakingFactors: breaking,
      guidance: '日德喜身旺印比帮扶，忌刑冲破害与官杀无制',
    });
  }

  // 5. 日贵格
  if (RI_GUI_PILLARS.has(dayGz)) {
    const breaking: string[] = [];
    if (hasClashWith(dayBranch, 'day')) breaking.push(`日支贵人位（${dayBranch}）遭六冲，贵气受损`);
    if (visibleTenGods.includes('正官') && visibleTenGods.includes('七杀')) {
      breaking.push('官杀混杂透干，须取清方显日贵清纯');
    }
    matches.push({
      id: 'ri-gui',
      name: '日贵格',
      category: '日时外格',
      status: breaking.length === 0 ? '条件成立' : '成中有破',
      basis: `日柱${dayGz}自坐天乙贵人，主为人得体、易得贵人提携`,
      breakingFactors: breaking,
      guidance: '日贵贵在纯静无冲，喜财官印清透护贵',
    });
  }

  // 6. 日禄归时格（专禄归禄）
  const dayLu = LU_BRANCH[dayStem];
  if (dayLu && pillars.hour.zhi === dayLu) {
    const breaking: string[] = [];
    const hasOfficer = visibleTenGods.some((g) => g === '正官' || g === '七杀');
    if (hasOfficer) breaking.push('天干明透官杀，违背“青云得路，不喜官星”之归禄清格条件');
    if (hasClashWith(dayLu, 'hour')) breaking.push(`时支禄位${dayLu}遭六冲，归禄根基受扰`);
    if (allBranches.filter((b) => b === dayLu).length >= 3) {
      breaking.push(`地支叠见多${dayLu}禄，禄多反杂需食伤财星泄秀`);
    }
    matches.push({
      id: 'ri-lu-gui-shi',
      name: '日禄归时格',
      category: '日时外格',
      status: breaking.length === 0 ? '条件成立' : '成中有破',
      basis: `${dayStem}日主临官禄位（${dayLu}）落于时支，主晚运归宿得力、自食其力成事`,
      breakingFactors: breaking,
      guidance: '归禄清格最喜食伤生财、印星护禄，忌官星冲克与时支逢冲',
    });
  }

  // 7. 拱禄格（注：建禄/月刃已归普通月令正格链路，不在此重复）
  for (const rule of GONG_LU_RULES) {
    if (dayGz === rule.day && hourGz === rule.hour) {
      const breaking: string[] = [];
      if (allBranches.includes(rule.arched)) breaking.push(`原局已见${rule.arched}字填实，不作暗拱论`);
      if (hasClashWith(rule.arched)) breaking.push(`原局见冲${rule.arched}之支，暗拱禄位受冲破`);
      if (visibleTenGods.some((g) => g === '正官' || g === '七杀')) {
        breaking.push('天干透官杀，破暗拱清气');
      }
      matches.push({
        id: 'gong-lu',
        name: `拱禄格（暗拱${rule.arched}禄）`,
        category: '暗拱暗冲格',
        status: breaking.length === 0 ? '条件成立' : '成中有破',
        basis: `日柱${dayGz}配时柱${hourGz}，日时同干夹拱日主禄位${rule.arched}`,
        breakingFactors: breaking,
        guidance: '拱禄最喜虚拱清纯，忌填实、忌冲破拱位、忌官星混杂',
      });
    }
  }

  // 9. 拱贵格
  for (const rule of GONG_GUI_RULES) {
    if (dayGz === rule.day && hourGz === rule.hour) {
      const breaking: string[] = [];
      if (allBranches.includes(rule.arched)) breaking.push(`原局已见${rule.arched}字填实，不作暗拱论`);
      if (hasClashWith(rule.arched)) breaking.push(`原局见冲${rule.arched}之支，暗拱贵位受冲破`);
      matches.push({
        id: 'gong-gui',
        name: `拱贵格（暗拱${rule.arched}贵）`,
        category: '暗拱暗冲格',
        status: breaking.length === 0 ? '条件成立' : '成中有破',
        basis: `日柱${dayGz}配时柱${hourGz}，日时夹拱天乙贵人${rule.arched}位`,
        breakingFactors: breaking,
        guidance: '拱贵喜清纯无伤，岁运忌填实冲破与空亡落空',
      });
    }
  }

  // 10. 六阴朝阳格（辛日戊子时）
  if (dayStem === '辛' && hourGz === '戊子') {
    const breaking: string[] = [];
    if (allStems.some((s) => s === '丙' || s === '丁')) breaking.push('天干透丙丁官杀，破暗动朝阳之象');
    if (allBranches.includes('午')) breaking.push('地支见午冲子，破子水暗合动气');
    matches.push({
      id: 'liu-yin-zhao-yang',
      name: '六阴朝阳格',
      category: '暗拱暗冲格',
      status: breaking.length === 0 ? '条件成立' : '成中有破',
      basis: '辛金日主配戊子时，以子中癸水暗动合巳中丙火官星',
      breakingFactors: breaking,
      guidance: '六阴朝阳喜西北金水运助势，忌丙丁午火填实冲子',
    });
  }

  // 11. 井栏叉格（庚日申子辰全）
  if (dayStem === '庚' && allBranches.includes('申') && allBranches.includes('子') && allBranches.includes('辰')) {
    const breaking: string[] = [];
    if (allStems.some((s) => s === '丙' || s === '丁') || allBranches.some((b) => b === '巳' || b === '午')) {
      breaking.push('原局明见丙丁巳午火官杀，破井栏暗冲清局');
    }
    matches.push({
      id: 'jing-lan-cha',
      name: '井栏叉格',
      category: '暗拱暗冲格',
      status: breaking.length === 0 ? '条件成立' : '成中有破',
      basis: '庚金日主地支全见申子辰三合水局，暗冲寅午戌财官印库',
      breakingFactors: breaking,
      guidance: '井栏叉喜北方水运与东方木运，忌原局及岁运丙丁巳午填实官杀',
    });
  }

  // 12. 壬骑龙背格（壬辰日且辰>=2 或 寅辰齐多）
  if (dayGz === '壬辰') {
    const chenCount = allBranches.filter((b) => b === '辰').length;
    const yinCount = allBranches.filter((b) => b === '寅').length;
    if (chenCount >= 2 || (chenCount >= 1 && yinCount >= 2)) {
      const breaking: string[] = [];
      if (allBranches.includes('戌')) breaking.push('地支见戌填实冲辰，破暗冲财官库之象');
      if (allStems.some((s) => s === '丙' || s === '丁' || s === '戊' || s === '己')) {
        breaking.push('天干明透财官，须兼论正格取用');
      }
      matches.push({
        id: 'ren-qi-long-bei',
        name: '壬骑龙背格',
        category: '暗拱暗冲格',
        status: breaking.length === 0 ? '条件成立' : '成中有破',
        basis: `壬辰日且原局地支见${chenCount}辰${yinCount ? `、${yinCount}寅` : ''}，取辰暗冲戌中丁财戊杀之象`,
        breakingFactors: breaking,
        guidance: '壬骑龙背重地支辰寅相济，忌戌字填实与官杀混杂',
      });
    }
  }

  return matches;
}

export function formatBaziSpecialPatterns(
  matches: readonly SpecialPatternMatch[],
  options?: { compact?: boolean },
): string {
  if (!matches.length) return '';
  if (options?.compact) {
    return matches
      .map((m) => {
        const broken = m.breakingFactors.length ? `；破格：${m.breakingFactors.join('、')}` : '';
        return `- ${m.name}（${m.status}）：${m.basis}${broken}`;
      })
      .join('\n');
  }
  return matches
    .map((m) => {
      const broken = m.breakingFactors.length ? `；反证/破格核查：${m.breakingFactors.join('；')}` : '；原局未见明显破格反证';
      return `- 【${m.name}｜${m.status}】${m.basis}${broken}。论断要点：${m.guidance}。`;
    })
    .join('\n');
}
