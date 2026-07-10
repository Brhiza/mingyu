/**
 * @file 太乙神数（Taiyi）
 * @description 太乙式盘核心推算，严格依《太乙金镜式经》（唐·王希明）与《太乙积年》传世算法实现：
 *   - 太乙积年：年计/月计以「10153917 + 公元年」为本（《四库全书总目提要》引太乙积年术）。
 *   - 入纪元数 = 积年 % 360；局数 = 入纪元数 % 72；阳遁（局≤36）/阴遁（局>36）。
 *   - 太乙落宫、文昌（天目）、始击（主目）：太乙每三岁（3局）一移宫，阳遁顺行八宫
 *     1→8→3→4→9→2→7→6，阴遁逆行 9→2→7→6→1→8→3→4（不入中五，中五不立）。
 *   - 始击（主目）= 文昌（客目）之洛书对宫（1↔9、2↔8、3↔7、4↔6）。
 *   - 计神：年计随太岁，岁支所临洛书宫即为计神。
 *   - 主算/客算：自太乙宫顺（阳）/逆（阴）行八宫至主目/客目，所经各宫洛书数之和（同宫为0）。
 *   - 十六神：依《太乙金镜式经》正名，布于十二辰（岁支起太乙）。
 *   - 掩/迫/击/格：依太乙式格局规则判定。
 *   - 五元六纪：一元360年，五元六纪以纪元数推之。
 *
 * 古籍依据：《太乙金镜式经》《太乙统宗宝鉴》《四库全书总目提要·子部·太乙积年》。
 */
import { getGanZhiFromDate, getBranchIndex, EARTHLY_BRANCHES } from '../ganzhi';

/** 太乙积年基数（年计、月计）：上古太极上元至唐开元之积年法定值 10153917，加公元年即当年积年 */
export const TAIYI_BASE_YEARS = 10153917;
/** 日计、时计之积年基数 */
export const TAIYI_BASE_DAY = 29277;

/** 洛书九宫：宫数 → {卦, 方位, 五行}（中五不立） */
const LUOSHU: Record<number, { gua: string; dir: string; wu: string }> = {
  1: { gua: '坎', dir: '北', wu: '水' },
  2: { gua: '坤', dir: '西南', wu: '土' },
  3: { gua: '震', dir: '东', wu: '木' },
  4: { gua: '巽', dir: '东南', wu: '木' },
  6: { gua: '乾', dir: '西北', wu: '金' },
  7: { gua: '兑', dir: '西', wu: '金' },
  8: { gua: '艮', dir: '东北', wu: '土' },
  9: { gua: '离', dir: '南', wu: '火' },
};

/** 洛书对宫 */
function oppositePalace(p: number): number {
  const map: Record<number, number> = { 1: 9, 9: 1, 2: 8, 8: 2, 3: 7, 7: 3, 4: 6, 6: 4 };
  return map[p] ?? p;
}

/** 阳遁太乙行宫序列（不入中五）：1→8→3→4→9→2→7→6→1，每宫3局 */
const PALACE_SEQ_YANG = [1, 8, 3, 4, 9, 2, 7, 6];
/** 阴遁太乙行宫序列（不入中五）：9→2→7→6→1→8→3→4→9，每宫3局 */
const PALACE_SEQ_YIN = [9, 2, 7, 6, 1, 8, 3, 4];

/** 阳遁文昌（客目/天目）序列：每宫3局 */
const WENCHANG_SEQ_YANG = [6, 7, 2, 9, 4, 3, 8, 1];
/** 阴遁文昌序列：每宫3局 */
const WENCHANG_SEQ_YIN = [1, 8, 3, 4, 9, 2, 7, 6];

/** 十六神（依《太乙金镜式经》正名），对应十二辰/四维 */
export const TAIYI_16_GODS: { name: string; branch: string }[] = [
  { name: '地主', branch: '子' },
  { name: '阳德', branch: '丑' },
  { name: '和德', branch: '艮' },
  { name: '吕申', branch: '寅' },
  { name: '高丛', branch: '卯' },
  { name: '太阳', branch: '辰' },
  { name: '大旲', branch: '巽' },
  { name: '大神', branch: '巳' },
  { name: '大威', branch: '午' },
  { name: '天道', branch: '未' },
  { name: '大武', branch: '坤' },
  { name: '武德', branch: '申' },
  { name: '太簇', branch: '酉' },
  { name: '阴主', branch: '戌' },
  { name: '阴德', branch: '乾' },
  { name: '大义', branch: '亥' },
];

/** 岁支 → 洛书宫（计神随太岁，年计所用） */
const BRANCH_TO_PALACE: Record<string, number> = {
  子: 1,
  丑: 8,
  寅: 3,
  卯: 4,
  辰: 4,
  巳: 6,
  午: 7,
  未: 2,
  申: 2,
  酉: 7,
  戌: 6,
  亥: 1,
};

export type TaiyiScope = 'year' | 'month' | 'day' | 'hour';

export interface TaiyiInput {
  date?: Date;
  /** 也可直接给定干支（年/月/日/时家对应的那一柱） */
  ganZhi?: string;
  scope?: TaiyiScope;
  /** 年计/月计用公元年；日计/时计可传四柱 */
  year?: number;
}

export interface TaiyiResult {
  scope: TaiyiScope;
  ganZhi: string;
  accumulatedYears: number;
  entryYears: number; // 入纪元数
  yuan: number; // 五元（0-4）
  ji: number; // 六纪（0-5）
  yinYang: '阳遁' | '阴遁';
  bureau: number; // 1-72
  taiyiPalace: number;
  taiyiGua: string;
  taiyiDir: string;
  wenChangPalace: number;
  shiJiPalace: number;
  jiShenPalace: number;
  lordCount: number; // 主算（主目=始击）
  guestCount: number; // 客算（客目=文昌）
  sixteenGods: { branch: string; god: string }[];
  judgments: string[];
  prompt: string;
}

/** 顺逆数宫求和：自 from 宫沿八宫序列行至 to 宫，所经各宫洛书数之和（含 to，不含 from；同宫为 0） */
function countPalaces(from: number, to: number, yin: boolean): number {
  const seq = yin ? PALACE_SEQ_YIN : PALACE_SEQ_YANG;
  const start = seq.indexOf(from);
  const end = seq.indexOf(to);
  if (start === end) return 0;
  let sum = 0;
  let i = (start + 1) % 8;
  let guard = 0;
  while (guard < 8) {
    sum += seq[i];
    if (seq[i] === to) break;
    i = (i + 1) % 8;
    guard++;
  }
  return sum;
}

function computeTaiyi(ganZhi: string, scope: TaiyiScope, yearForAccum: number): TaiyiResult {
  // 积年：年/月家以 TAIYI_BASE_YEARS 为本，日/时家以 TAIYI_BASE_DAY 为本
  const base = scope === 'year' || scope === 'month' ? TAIYI_BASE_YEARS : TAIYI_BASE_DAY;
  const accumulatedYears = base + yearForAccum;

  const entryYears = ((accumulatedYears % 360) + 360) % 360; // 入纪元数 0-359
  let bureau = ((entryYears % 72) + 72) % 72;
  if (bureau === 0) bureau = 72;
  const yin = bureau > 36;
  const yinYang: '阳遁' | '阴遁' = yin ? '阴遁' : '阳遁';

  // 太乙落宫：每3局一宫，按序循环
  const palaceSeq = yin ? PALACE_SEQ_YIN : PALACE_SEQ_YANG;
  const taiyiPalace = palaceSeq[Math.floor((bureau - 1) / 3) % 8];

  // 文昌（客目/天目）
  const wenSeq = yin ? WENCHANG_SEQ_YIN : WENCHANG_SEQ_YANG;
  const wenChangPalace = wenSeq[Math.floor((bureau - 1) / 3) % 8];

  // 始击（主目）= 文昌洛书对宫
  const shiJiPalace = oppositePalace(wenChangPalace);

  // 计神：年计随太岁（岁支所临洛书宫）；非年计则取岁支近似（调用方传年支）
  const yearBranch = EARTHLY_BRANCHES[(yearForAccum + 8) % 12];
  const jiShenPalace = BRANCH_TO_PALACE[yearBranch] ?? 1;

  // 主算（至始击/主目）、客算（至文昌/客目）
  const lordCount = countPalaces(taiyiPalace, shiJiPalace, yin);
  const guestCount = countPalaces(taiyiPalace, wenChangPalace, yin);

  // 十六神十二辰盘：自岁支起太乙，顺时针布神
  const startIdx = getBranchIndex(yearBranch);
  const sixteenGods = EARTHLY_BRANCHES.map((branch, i) => ({
    branch,
    god: TAIYI_16_GODS[(i - startIdx + 16) % 16].name,
  }));

  // 格局判断（掩/迫/击/格）
  const judgments: string[] = [];
  if (wenChangPalace === taiyiPalace)
    judgments.push('掩：文昌（客目）与太乙同宫，客掩太乙，外侵内乱，大凶。');
  if (shiJiPalace === taiyiPalace)
    judgments.push('击：始击（主目）与太乙同宫，主有兵革、犯上作乱之象。');
  if ([6, 7].includes(taiyiPalace)) judgments.push('迫：太乙临乾兑（金宫），阳气受迫。');
  else if ([6, 7].includes(wenChangPalace) || [6, 7].includes(shiJiPalace))
    judgments.push('迫：文昌/始击临乾兑（金宫），强权凌主。');
  if (wenChangPalace === 9 || shiJiPalace === 9)
    judgments.push('迫：文昌/始击临离宫（火），明争暗斗。');
  if (oppositePalace(shiJiPalace) === taiyiPalace)
    judgments.push('格：始击（主目）与太乙相冲，刚愎自用、内外不和。');
  if (judgments.length === 0) judgments.push('太乙安宫，无显要掩迫击格之象，主客相安。');

  // 阴阳数判定
  const judgeCount = (n: number): string => {
    if ([33, 39].includes(n)) return '重阳数';
    if ([22, 26].includes(n)) return '重阴数';
    if ([14, 18].includes(n)) return '上和数';
    if ([23, 29, 32, 36].includes(n)) return '次和数';
    if ([12, 16, 21, 27].includes(n)) return '下和数';
    return '';
  };
  const lj = judgeCount(lordCount);
  const gj = judgeCount(guestCount);
  if (lj) judgments.push(`主算 ${lordCount} 为${lj}。`);
  if (gj) judgments.push(`客算 ${guestCount} 为${gj}。`);

  const prompt = [
    `【太乙神数 · ${scopeLabel(scope)}家】`,
    `干支：${ganZhi}；岁支：${yearBranch}。`,
    `太乙积年：${accumulatedYears}（基数 ${base} + 公元 ${yearForAccum}）；入纪元数：${entryYears}；五元第 ${yuanOf(entryYears)}、六纪第 ${jiOf(accumulatedYears)}。`,
    `${yinYang}第 ${bureau} 局。`,
    `太乙落 ${LUOSHU[taiyiPalace].gua}宫（${LUOSHU[taiyiPalace].dir}，${LUOSHU[taiyiPalace].wu}）；文昌（客目）${LUOSHU[wenChangPalace].gua}宫；始击（主目）${LUOSHU[shiJiPalace].gua}宫；计神${LUOSHU[jiShenPalace].gua}宫。`,
    `主算（至始击）${lordCount}，客算（至文昌）${guestCount}。`,
    `判断：${judgments.join('；')}`,
    '',
    '请依《太乙金镜式经》式理，结合主客算数与十六神所临十二辰，分析气运、动静、攻守与时宜。',
  ].join('\n');

  const yuan = yuanOf(entryYears);
  const ji = jiOf(accumulatedYears);

  return {
    scope,
    ganZhi,
    accumulatedYears,
    entryYears,
    yuan,
    ji,
    yinYang,
    bureau,
    taiyiPalace,
    taiyiGua: LUOSHU[taiyiPalace].gua,
    taiyiDir: LUOSHU[taiyiPalace].dir,
    wenChangPalace,
    shiJiPalace,
    jiShenPalace,
    lordCount,
    guestCount,
    sixteenGods,
    judgments,
    prompt,
  };
}

function yuanOf(entryYears: number): number {
  return Math.floor(entryYears / 72) % 5; // 五元（0-4）
}
function jiOf(accumulatedYears: number): number {
  return Math.floor(accumulatedYears / 360) % 6; // 六纪（0-5）
}
function scopeLabel(scope: TaiyiScope): string {
  return { year: '年', month: '月', day: '日', hour: '时' }[scope];
}

/** 推算太乙 */
export function generateTaiyi(input: TaiyiInput = {}): TaiyiResult {
  const scope = input.scope ?? 'year';
  let ganZhi = input.ganZhi;
  const yearForAccum = input.year ?? new Date().getFullYear();
  if (!ganZhi) {
    const gz = getGanZhiFromDate(input.date ?? new Date());
    ganZhi = { year: gz.year, month: gz.month, day: gz.day, hour: gz.hour }[scope];
  }
  return computeTaiyi(ganZhi, scope, yearForAccum);
}

export const taiyi = { generateTaiyi, TAIYI_16_GODS, TAIYI_BASE_YEARS, TAIYI_BASE_DAY };
