/**
 * @file 七政四余（Qizheng Siyu / 果老星宗）
 * @description 中国占星：日、月、五星为七政；罗睺、计都、月孛、紫炁为四余。
 * 依《果老星宗》《御定五星精义》立命身、定十二宫、安命主、排庙旺、起神煞：
 *   - 安命宫：「以生时，加太阳宫，即从生时顺数见卯所临之宫，即为命宫。」（逢卯安命）
 *   - 安身宫：「以生时加太阴宫，即从生时逆数见酉所临之宫，即为身宫。」
 *   - 安十二宫：自命宫逆数（命、财帛、兄弟、田宅、男女、奴仆、妻妾、疾厄、迁移、官禄、福德、相貌）。
 *   - 安命主：寅亥木、卯戌火、辰酉金、巳申水、子丑土、午日、未月。
 *   - 宿度：采用古距度（角宿起），七政经度由回归黄道换算恒星黄道（减岁差），再入二十八宿。
 *   - 庙旺：七政于十二宫之庙、旺、乐、陷。
 *   - 神煞：天乙贵人（日干）、驿马/劫煞/咸池/华盖/孤辰/寡宿（年支）。
 *
 * 说明：紫炁（木余）之学各派略有异同，本实现依「罗睺逆行九十度」之常法推算，并明确标注，
 * 精确宿度须对照《果老星宗》原表校订；余曜罗計孛取月交点与真莉莉丝（celestine）。
 *
 * 古籍依据：《果老星宗》《御定五星精义》《星学大成》。
 */
import { calculateChart } from 'celestine';
import { SevenStar, TwentyEightStar } from 'tyme4ts';
import { getGanZhiFromDate } from '../ganzhi';

/** 二十八宿古距度（角宿起黄经 0；用于古距度宿度换算） */
const XIU_DISTANCES = [
  12, 9, 16, 5, 6, 18, 9.5, 26, 8, 12, 10, 17, 16, 9, 16, 12, 15, 11, 16, 2, 9, 33, 4, 15, 7, 18,
  18, 17,
];
const XIU_TOTAL = XIU_DISTANCES.reduce((sum, distance) => sum + distance, 0);
const XIU: { name: string; du: number }[] = TwentyEightStar.NAMES.map(
  (name: string, index: number) => ({
    name: TwentyEightStar.fromName(name).getName(),
    du: XIU_DISTANCES[index],
  }),
);

/** 黄道十二宫（七政四余职名，子丑寅卯…自命宫逆布十二职） */
export const TWELVE_PALACES = [
  '命宫',
  '财帛',
  '兄弟',
  '田宅',
  '男女',
  '奴仆',
  '妻妾',
  '疾厄',
  '迁移',
  '官禄',
  '福德',
  '相貌',
];

/** 命主：十二宫序（子0…亥11）→ 主星 */
const MING_ZHU: Record<number, string> = {
  0: '土',
  1: '土',
  2: '木',
  3: '火',
  4: '金',
  5: '水',
  6: '日',
  7: '月',
  8: '水',
  9: '金',
  10: '火',
  11: '木',
};

/** 七政庙旺乐陷（按十二宫序，子0…亥11） */
const DIGNITY: Record<string, { miao: number[]; wang: number[]; le: number[]; xian: number[] }> = {
  日: { miao: [6], wang: [8], le: [1, 7], xian: [0] },
  月: { miao: [7], wang: [9], le: [2], xian: [5] },
  木: { miao: [2], wang: [11], le: [3], xian: [8] },
  火: { miao: [3], wang: [2], le: [5], xian: [11] },
  土: { miao: [0], wang: [1], le: [4], xian: [6] },
  金: { miao: [9], wang: [4], le: [1], xian: [3] },
  水: { miao: [0], wang: [8], le: [11], xian: [5] },
};

export interface QizhengStar {
  name: string;
  kind: '七政' | '四余';
  longitude: number; // 恒星黄经 0-360
  xiu: string;
  sevenStar: string;
  xiuDegree: number;
  signIndex: number; // 十二宫序号 0-11
  palace: string;
  retrograde: boolean;
  dignity?: string; // 庙/旺/乐/陷/平（七政）；四余为 —
}

export interface QizhengInput {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute?: number;
  latitude?: number;
  longitude?: number;
  timezone?: number;
}

export interface QizhengResult {
  stars: QizhengStar[];
  mingGong: number;
  shenGong: number;
  mingZhu: string;
  twelvePalaces: { palace: string; signIndex: number }[];
  shensha: { name: string; value: string }[];
  prompt: string;
}

/**
 * J2000.0 至目标年份的黄经岁差（IAU 2006 近似，单位：度）。
 * 23.44° 是黄赤交角，不能作为岁差基数；2024 年累计岁差约 0.34°。
 */
export function getPrecessionOffset(year: number): number {
  const t = (year - 2000) / 100;
  const arcSeconds =
    5028.796195 * t + 1.1054348 * t ** 2 + 0.00007964 * t ** 3 - 0.000023857 * t ** 4;
  return arcSeconds / 3600;
}

/** 回归黄经 → 恒星黄经（减岁差） */
function toSidereal(tropical: number, year: number): number {
  return (((tropical - getPrecessionOffset(year)) % 360) + 360) % 360;
}

function longitudeToXiu(L: number): { xiu: string; xiuDegree: number } {
  // 先按本表总古度把现代 360° 黄经等比例换算，再逐宿扣减距度。
  let rem = (((L % 360) + 360) % 360) * (XIU_TOTAL / 360);
  for (const x of XIU) {
    if (rem < x.du) return { xiu: x.name, xiuDegree: rem };
    rem -= x.du;
  }
  return { xiu: XIU[0].name, xiuDegree: rem };
}

/** 天乙贵人（日干） */
function tianYiGuiRen(dayGan: string): string {
  const map: Record<string, string> = {
    甲: '丑未',
    戊: '丑未',
    庚: '丑未',
    乙: '子申',
    己: '子申',
    丙: '亥酉',
    丁: '亥酉',
    壬: '卯巳',
    癸: '卯巳',
    辛: '寅午',
  };
  return map[dayGan] ?? '—';
}

/** 年支三合局 → 各项神煞地支 */
function yearBranchShensha(yearBranch: string): {
  yi: string;
  jie: string;
  chi: string;
  hua: string;
  gu: string;
  gua: string;
} {
  const groups: Record<
    string,
    { yi: string; jie: string; chi: string; hua: string; gu: string; gua: string }
  > = {
    申: { yi: '寅', jie: '巳', chi: '酉', hua: '辰', gu: '巳', gua: '丑' },
    子: { yi: '寅', jie: '巳', chi: '酉', hua: '辰', gu: '巳', gua: '丑' },
    辰: { yi: '寅', jie: '巳', chi: '酉', hua: '辰', gu: '巳', gua: '丑' },
    寅: { yi: '申', jie: '亥', chi: '卯', hua: '戌', gu: '申', gua: '戌' },
    午: { yi: '申', jie: '亥', chi: '卯', hua: '戌', gu: '申', gua: '戌' },
    戌: { yi: '申', jie: '亥', chi: '卯', hua: '戌', gu: '申', gua: '戌' },
    巳: { yi: '亥', jie: '寅', chi: '午', hua: '丑', gu: '亥', gua: '未' },
    酉: { yi: '亥', jie: '寅', chi: '午', hua: '丑', gu: '亥', gua: '未' },
    丑: { yi: '亥', jie: '寅', chi: '午', hua: '丑', gu: '亥', gua: '未' },
    亥: { yi: '巳', jie: '申', chi: '子', hua: '未', gu: '寅', gua: '辰' },
    卯: { yi: '巳', jie: '申', chi: '子', hua: '未', gu: '寅', gua: '辰' },
    未: { yi: '巳', jie: '申', chi: '子', hua: '未', gu: '寅', gua: '辰' },
  };
  const sanhui: Record<string, { gu: string; gua: string }> = {
    亥: { gu: '寅', gua: '戌' },
    子: { gu: '寅', gua: '戌' },
    丑: { gu: '寅', gua: '戌' },
    寅: { gu: '巳', gua: '丑' },
    卯: { gu: '巳', gua: '丑' },
    辰: { gu: '巳', gua: '丑' },
    巳: { gu: '申', gua: '辰' },
    午: { gu: '申', gua: '辰' },
    未: { gu: '申', gua: '辰' },
    申: { gu: '亥', gua: '未' },
    酉: { gu: '亥', gua: '未' },
    戌: { gu: '亥', gua: '未' },
  };
  const base = groups[yearBranch];
  const guChen = sanhui[yearBranch];
  return base && guChen
    ? { ...base, ...guChen }
    : { yi: '—', jie: '—', chi: '—', hua: '—', gu: '—', gua: '—' };
}

const PLANET_NAMES: Record<string, { label: string; key: string }> = {
  Sun: { label: '太阳', key: SevenStar.fromName('日').getName() },
  Moon: { label: '太阴', key: SevenStar.fromName('月').getName() },
  Mercury: { label: '辰星(水)', key: SevenStar.fromName('水').getName() },
  Venus: { label: '太白(金)', key: SevenStar.fromName('金').getName() },
  Mars: { label: '荧惑(火)', key: SevenStar.fromName('火').getName() },
  Jupiter: { label: '岁星(木)', key: SevenStar.fromName('木').getName() },
  Saturn: { label: '镇星(土)', key: SevenStar.fromName('土').getName() },
};

/** 七政庙旺乐陷判定 */
function dignityOf(key: string, signIndex: number): string {
  const d = DIGNITY[key];
  if (!d) return '—';
  if (d.miao.includes(signIndex)) return '庙';
  if (d.wang.includes(signIndex)) return '旺';
  if (d.le.includes(signIndex)) return '乐';
  if (d.xian.includes(signIndex)) return '陷';
  return '平';
}

/** 生成七政四余盘 */
export function generateQizheng(input: QizhengInput): QizhengResult {
  const lat = input.latitude ?? 39.9;
  const lon = input.longitude ?? 116.4;
  const tz = input.timezone ?? 8;
  const chart = calculateChart(
    {
      year: input.year,
      month: input.month,
      day: input.day,
      hour: input.hour,
      minute: input.minute ?? 0,
      second: 0,
      timezone: tz,
      latitude: lat,
      longitude: lon,
    },
    {
      houseSystem: 'placidus',
      includeNodes: 'true' as const,
      includeLilith: 'true' as const,
      includeChiron: false,
      includeAsteroids: false,
      includeLots: false,
      aspectTypes: [],
      minimumAspectStrength: 0,
    },
  );

  const stars: QizhengStar[] = [];
  const pushStar = (
    name: string,
    kind: '七政' | '四余',
    tropical: number,
    key?: string,
    retrograde = false,
  ): void => {
    const L = toSidereal(tropical, input.year);
    const { xiu, xiuDegree } = longitudeToXiu(L);
    const sevenStar = TwentyEightStar.fromName(xiu).getSevenStar().getName();
    const signIndex = Math.floor(L / 30);
    const dignity = key ? dignityOf(key, signIndex) : '—';
    stars.push({
      name,
      kind,
      longitude: L,
      xiu,
      sevenStar,
      xiuDegree,
      signIndex,
      palace: '',
      retrograde,
      dignity,
    });
  };

  for (const p of chart.planets) {
    const m = PLANET_NAMES[p.name];
    if (!m) continue;
    pushStar(m.label, '七政', p.longitude, m.key, p.isRetrograde ?? false);
  }

  // 四余：罗睺=北交，计都=南交，月孛=真莉莉丝，紫炁=月孛对冲（近地点/远地点相差180°）
  // 古籍依据：《星学大成》《果老星宗》"紫气者，月孛之对冲也"；易德轩《罗睺计都紫气月孛精确计算公式》考：
  //   月孛为月球远地点(Apogee)、紫炁为月球近地点(Perigee)，二者分居椭圆长轴两端，黄经恒相差180°。
  //   故紫炁 = 月孛黄经 + 180°（用 celestine 真莉莉丝，比均值公式更准；无莉莉丝时退用罗睺逆行90°近似）。
  const nodeMap = new Map(chart.nodes.map((n) => [n.name, n]));
  const lilith = chart.lilith?.[0];
  const north = nodeMap.get('North Node');
  const south = nodeMap.get('South Node');
  if (north) pushStar('罗睺(火余)', '四余', north.longitude);
  if (south) pushStar('计都(土余)', '四余', south.longitude);
  if (lilith) {
    pushStar('月孛(水余)', '四余', lilith.longitude);
    // 紫炁(木余) = 月孛(水余) + 180°（近地点对冲远地点）
    pushStar('紫炁(木余)', '四余', (lilith.longitude + 180) % 360);
  } else if (north) {
    // 后备近似：紫炁 ≈ 罗睺逆行90°（仅当无莉莉丝数据时使用）
    pushStar('紫炁(木余)', '四余', (north.longitude + 270) % 360);
  }

  const sun = stars.find((s) => s.name === '太阳');
  const moon = stars.find((s) => s.name === '太阴');
  const sunSign = sun ? sun.signIndex : 0;
  const moonSign = moon ? moon.signIndex : 0;

  // 生时地支序（子0…亥11）：子时23-1，丑1-3，… 午11-13 → floor((hour+1)/2) % 12
  const hourIdx = Math.floor((input.hour + 1) / 2) % 12; // 子0…亥11
  const MAO = 3,
    YOU = 9; // 卯、酉

  // 安命宫：「生时加太阳宫，顺数见卯」→ 命宫 = 太阳宫 + (卯 - 生时) mod 12
  const mingGong = (((sunSign + (MAO - hourIdx) + 12) % 12) + 12) % 12;
  // 安身宫：「生时加太阴宫，逆数见酉」→ 身宫 = 太阴宫 + (生时 - 酉) mod 12
  const shenGong = (((moonSign + (hourIdx - YOU) + 12) % 12) + 12) % 12;

  const twelvePalaces = TWELVE_PALACES.map((palace, i) => ({
    palace,
    signIndex: (mingGong - i + 12) % 12, // 自命宫逆布
  }));
  const palaceBySign = new Map(twelvePalaces.map((t) => [t.signIndex, t.palace]));
  for (const s of stars) s.palace = palaceBySign.get(s.signIndex) ?? '—';

  const mingZhu = MING_ZHU[mingGong] ?? '—';

  // 神煞（年支 + 日干）
  const dateGanZhi = getGanZhiFromDate(
    new Date(input.year, input.month - 1, input.day, input.hour, input.minute ?? 0),
  );
  const yearBranch = dateGanZhi.year[1];
  const dayGan = dateGanZhi.day[0];
  const ys = yearBranchShensha(yearBranch);
  const shensha = [
    { name: '天乙贵人', value: tianYiGuiRen(dayGan) },
    { name: '驿马', value: ys.yi },
    { name: '劫煞', value: ys.jie },
    { name: '咸池', value: ys.chi },
    { name: '华盖', value: ys.hua },
    { name: '孤辰', value: ys.gu },
    { name: '寡宿', value: ys.gua },
  ];

  const prompt = [
    `【七政四余 · 果老星宗】`,
    `七政：太阳、太阴、水、金、火、木、土；四余：罗睺、计都、月孛、紫炁。`,
    ...stars.map(
      (s) =>
        `${s.kind} ${s.name}：恒星黄经${s.longitude.toFixed(1)}°，在${s.xiu}宿${s.xiuDegree.toFixed(
          1,
        )}度，落${s.palace}${s.dignity ? '（' + s.dignity + '）' : ''}${s.retrograde ? '（逆）' : ''}`,
    ),
    `命宫在${TWELVE_PALACES[0]}（黄道第 ${mingGong + 1} 宫），命主${mingZhu}；身宫在第 ${shenGong + 1} 宫。`,
    `神煞：天乙贵人${shensha[0].value}、驿马${shensha[1].value}、劫煞${shensha[2].value}、咸池${shensha[3].value}、华盖${shensha[4].value}、孤辰${shensha[5].value}、寡宿${shensha[6].value}。`,
    '',
    '请依《果老星宗》星学，论命主强弱、七政庙旺、四余吊照、十二宫所主与神煞吉凶。',
  ].join('\n');

  return { stars, mingGong, shenGong, mingZhu, twelvePalaces, shensha, prompt };
}

export const qizheng = { generateQizheng, getPrecessionOffset };
