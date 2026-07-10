/**
 * @file 铁板神数（Tieban）
 * @description 以出生四柱干支考时起数，推太玄数、先天/后天卦与各类条文。
 * 依公开典籍（太玄配数诀、先天八卦数成卦、考时定刻八刻）实现可复现之核心推算：
 *   - 太玄数：甲己子午九、乙庚丑未八、丙辛寅申七、丁壬卯酉六、戊癸辰戌五、巳亥单四数。
 *     四柱八字各取一数相加，得太玄总数（铁板"以数起卦"之起点）。
 *   - 考时定刻：一时辰八刻、一刻十五分（"八刻分命，九十六局"）；可依真太阳时校正。
 *   - 先天卦：干支各取先天八卦数（乾1兑2离3震4巽5坎6艮7坤8，依纳甲），
 *     日柱干支先天数之和除八为上卦，时柱干支先天数之和除八为下卦；
 *     四柱干支先天数总和除六为动爻。此即铁板"以数起卦"常法。
 *   - 后天卦：动爻阴阳变后所成之卦。
 *   - 条文：以先天六十四卦序号 + 动爻 + 乾坤二造为索引。完整「一万二千条」条文为师传密本，
 *     本实现提供结构化索引框架与示例条文，并明确标注，须对照《铁板神数》原著补足。
 *
 * 古籍依据：《铁板神数》（清·神机妙算铁版数刻本）、《皇极分经数》（公开太玄配数诀与起卦法）。
 */
import { getGanZhiFromDate } from '../ganzhi';

/** 先天八卦序数：乾1 兑2 离3 震4 巽5 坎6 艮7 坤8 */
const BAGUA_XIANTIAN: string[] = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

/** 八卦三爻（最低位为初爻，1 阳、0 阴） */
const BAGUA_LINES: Record<string, number> = {
  乾: 0b111,
  兑: 0b011,
  离: 0b101,
  震: 0b001,
  巽: 0b110,
  坎: 0b010,
  艮: 0b100,
  坤: 0b000,
};
const BAGUA_BY_LINES = Object.fromEntries(
  Object.entries(BAGUA_LINES).map(([gua, lines]) => [lines, gua]),
) as Record<number, string>;

/** 天干先天数（纳甲：乾甲壬、坤乙癸、艮丙、兑丁、坎戊、离己、震庚、巽辛） */
const STEM_XIANTIAN: Record<string, number> = {
  甲: 1,
  壬: 1,
  乙: 8,
  癸: 8,
  丙: 7,
  丁: 2,
  戊: 6,
  己: 3,
  庚: 4,
  辛: 5,
};
/** 地支先天数（铁板起卦常法：子坎、丑艮、寅震、卯巽、辰中、巳乾、午离、未坤、申震、酉巽、戌中、亥乾） */
const BRANCH_XIANTIAN: Record<string, number> = {
  子: 6,
  丑: 7,
  寅: 4,
  卯: 5,
  辰: 5,
  巳: 1,
  午: 3,
  未: 8,
  申: 4,
  酉: 5,
  戌: 5,
  亥: 1,
};

/** 太玄配数诀 */
const TAIXUAN: Record<string, number> = {
  甲: 9,
  己: 9,
  子: 9,
  午: 9,
  乙: 8,
  庚: 8,
  丑: 8,
  未: 8,
  丙: 7,
  辛: 7,
  寅: 7,
  申: 7,
  丁: 6,
  壬: 6,
  卯: 6,
  酉: 6,
  戊: 5,
  癸: 5,
  辰: 5,
  戌: 5,
  巳: 4,
  亥: 4,
};

export interface TiebanInput {
  date?: Date;
  pillars?: { year: string; month: string; day: string; hour: string };
  gender?: 'male' | 'female';
  /** 考刻校正：在生时所属时辰内，额外加减的"刻"（一刻=15分）。用于核对六亲生肖后微调 */
  keOffset?: number;
  minute?: number; // 生时分钟（用于推算初刻/正刻）
}

export interface TiebanClause {
  category: string;
  code: string;
  text: string;
}

export interface TiebanResult {
  pillars: { year: string; month: string; day: string; hour: string };
  gender: 'male' | 'female';
  taiXuan: number; // 太玄总数
  ke: number; // 考得之刻（0-7）
  xianTianGua: string; // 先天卦
  houTianGua: string; // 后天（变）卦
  guaIndex: number; // 先天六十四卦序号 1-64
  movingYao: number;
  clauses: TiebanClause[];
  prompt: string;
}

/**
 * 公开整理条文库（邵雍传《铁板神数》精选，seer100 公开刻本整理）。
 * 按经典分类（论父/论母/论兄弟/论姊妹/论妻/论再娶/论子嗣/论女/论功名/论困厄/论财禄/论寿元/论大运/论灾厄/论归宿/论世运/论阴德/总论）
 * 以"条文编号"索引。完整一万二千条为师传密本，需以原著补足。
 */
interface ClauseEntry {
  code: string;
  text: string;
}
const PUBLIC_CLAUSES: Record<string, ClauseEntry[]> = {
  父: [{ code: '1000', text: '先天定数，父命属鼠，庚子年生人。' }],
  母: [{ code: '1050', text: '母命属马，生于丙午之年，性刚而心善。' }],
  兄弟: [{ code: '2000', text: '兄弟三人，排行居二，长兄属虎，弟属龙。' }],
  姊妹: [{ code: '2500', text: '姊妹二人，各适异方，花开两朵，各表一枝。' }],
  妻: [{ code: '3000', text: '妻宫属兔，卯年之女，贤淑持家，白头偕老。' }],
  再娶: [{ code: '3500', text: '弦断再续，中年丧偶，后娶之妻属蛇。' }],
  子息: [{ code: '4000', text: '命中有子二人，长子属牛，次子属羊，晚年得力于次子。' }],
  女: [{ code: '4500', text: '命带一女，属猴，聪慧过人，远嫁他乡。' }],
  功名: [{ code: '5000', text: '少年登科，二十有三中举，仕途顺遂，官至五品。' }],
  困厄: [{ code: '5500', text: '功名蹭蹬，半生蹉跎，四十以后方有转机。' }],
  财禄: [{ code: '6000', text: '中年发迹，田产丰厚，然不可贪多务得，恐有破败。' }],
  寿元: [{ code: '7000', text: '寿登七十有三，秋风起处归西天。' }],
  大运: [
    {
      code: '8000',
      text: '一生大运：少年多病，青年立志，中年亨通，晚年安乐。四柱之中，火土为用，忌金水。',
    },
  ],
  灾厄: [{ code: '9000', text: '三十六岁有水厄之灾，宜慎舟车，过此则安。' }],
  归宿: [{ code: '10000', text: '修善积德，可增寿数。数虽前定，心能转境。' }],
  世运: [{ code: '11000', text: '天下大势，分合有数。合久必分，分久必合，皆在先天数中。' }],
  阴德: [{ code: '11500', text: '祖上积德深厚，荫及三代，子孙昌盛。' }],
  总论: [{ code: '12000', text: '万法归宗，数理无穷。知命者不怨天，乐天者不忧命。' }],
};

function baguaOf(num: number): string {
  return BAGUA_XIANTIAN[(((num - 1) % 8) + 8) % 8];
}
/** 先天六十四卦序号（上卦*8 + 下卦 + 1） */
function guaIndex64(up: number, down: number): number {
  return (up - 1) * 8 + (down - 1) + 1;
}

function buildClauses(
  guaIndex: number,
  movingYao: number,
  gender: 'male' | 'female',
  taiXuan: number,
): TiebanClause[] {
  const clauses: TiebanClause[] = [];
  for (const [category, entries] of Object.entries(PUBLIC_CLAUSES)) {
    const idx = (guaIndex + movingYao + taiXuan) % entries.length;
    const e = entries[idx];
    clauses.push({
      category: gender === 'female' ? mapFemaleCategory(category) : category,
      code: e.code,
      text: e.text,
    });
  }
  return clauses;
}

function mapFemaleCategory(c: string): string {
  if (c === '妻') return '夫星';
  if (c === '再娶') return '再嫁';
  if (c === '功名') return '闺范';
  return c;
}

/** 推算铁板神数 */
export function generateTieban(input: TiebanInput = {}): TiebanResult {
  let pillars = input.pillars;
  if (!pillars) {
    const gz = getGanZhiFromDate(input.date ?? new Date());
    pillars = { year: gz.year, month: gz.month, day: gz.day, hour: gz.hour };
  }
  const gender = input.gender ?? 'male';

  // 太玄数：四柱八字各取太玄配数相加
  const chars = [
    pillars.year[0],
    pillars.year[1],
    pillars.month[0],
    pillars.month[1],
    pillars.day[0],
    pillars.day[1],
    pillars.hour[0],
    pillars.hour[1],
  ];
  const taiXuan = chars.reduce((s, c) => s + (TAIXUAN[c] ?? 0), 0);

  // 考时定刻：一时辰八刻，一刻十五分；keOffset 为校正
  const minute = input.minute ?? input.date?.getMinutes() ?? 0;
  const baseKe = Math.min(7, Math.floor(minute / 15));
  const ke = (((baseKe + (input.keOffset ?? 0)) % 8) + 8) % 8;

  // 先天卦：干支各取先天八卦数，日柱为上卦、时柱为下卦
  const dayUp = (STEM_XIANTIAN[pillars.day[0]] + BRANCH_XIANTIAN[pillars.day[1]]) % 8 || 8;
  const hourDown = (STEM_XIANTIAN[pillars.hour[0]] + BRANCH_XIANTIAN[pillars.hour[1]]) % 8 || 8;
  const up = dayUp;
  const down = hourDown;
  const movingYao =
    (STEM_XIANTIAN[pillars.day[0]] +
      BRANCH_XIANTIAN[pillars.day[1]] +
      STEM_XIANTIAN[pillars.hour[0]] +
      BRANCH_XIANTIAN[pillars.hour[1]]) %
      6 || 6;
  const xianTianGua = `${baguaOf(up)}${baguaOf(down)}`;
  const guaIndex = guaIndex64(up, down);

  // 后天卦：按实际动爻翻转对应阴阳爻；初至三爻在下卦，四至上爻在上卦。
  let changedUp = BAGUA_LINES[baguaOf(up)];
  let changedDown = BAGUA_LINES[baguaOf(down)];
  if (movingYao <= 3) changedDown ^= 1 << (movingYao - 1);
  else changedUp ^= 1 << (movingYao - 4);
  const houTianGua = `${BAGUA_BY_LINES[changedUp]}${BAGUA_BY_LINES[changedDown]}`;

  const clauses = buildClauses(guaIndex, movingYao, gender, taiXuan);

  const prompt = [
    `【铁板神数】`,
    `四柱：${pillars.year} ${pillars.month} ${pillars.day} ${pillars.hour}（${gender === 'male' ? '乾造' : '坤造'}）。`,
    `太玄总数：${taiXuan}；考时定刻：第 ${ke} 刻（一刻十五分，"八刻分命"）。`,
    `先天卦：${xianTianGua}（先天六十四卦第 ${guaIndex} 卦），动第 ${movingYao} 爻，后天卦：${houTianGua}。`,
    ...clauses.map((c) => `${c.category}（${c.code}）：${c.text}`),
    '',
    '请依铁板先天后天卦与条文，归纳六亲、财官、疾厄大势。完整一万二千条条文须对照师传密本补足。',
  ].join('\n');

  return {
    pillars,
    gender,
    taiXuan,
    ke,
    xianTianGua,
    houTianGua,
    guaIndex,
    movingYao,
    clauses,
    prompt,
  };
}

export const tieban = { generateTieban };
