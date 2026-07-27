import { AstroTime, RotateVector, Rotation_EQJ_ECT, Vector } from 'astronomy-engine';

export interface QizhengMansionStar {
  mansion: string;
  chineseName: string;
  simbadId: string;
  raJ2000Degrees: number;
  decJ2000Degrees: number;
  pmRaMasPerYear: number;
  pmDecMasPerYear: number;
}

export interface QizhengMansionBoundary extends QizhengMansionStar {
  longitude: number;
  widthDegrees: number;
}

/**
 * 明清修订后保持觜前参后的二十八宿距星目录。
 *
 * 星宿与西名对应采用中文维基百科固定版本 oldid=92223725，并按其所述乾隆十七年
 * 修订采用觜宿一（猎户座 lambda）与参宿一（猎户座 zeta）。ICRS/J2000 坐标及自行
 * 来自 SIMBAD TAP `basic` 表的 ra、dec、pmra、pmdec 字段，查询日期 2026-07-27。
 */
export const QIZHENG_MANSION_STARS: readonly QizhengMansionStar[] = [
  ['角', '角宿一', '* alf Vir', 201.298247361563, -11.161319485112, -42.35, -30.67],
  ['亢', '亢宿一', '* kap Vir', 213.223936885957, -10.273703461482, 6.674, 138.987],
  ['氐', '氐宿一', '* alf Lib', 222.71963789158, -16.041776519834, -105.68, -68.4],
  ['房', '房宿一', '* pi Sco', 239.712971824167, -26.114107945, -11.42, -26.83],
  ['心', '心宿一', '* sig Sco', 245.297148805833, -25.592792076667, -10.6, -16.28],
  ['尾', '尾宿一', '* mu.01 Sco', 252.96761814529, -38.047399464, -10.451, -18.315],
  ['箕', '箕宿一', '* gam Sgr', 271.452033745, -30.424089849444, -48.839, -204.86],
  ['斗', '斗宿一', '* phi Sgr', 281.414123094121, -26.990782645111, 49.919, -0.09],
  ['牛', '牛宿一', '* bet Cap', 305.25277749238, -14.78140760208, 44.133, 0.36],
  ['女', '女宿一', '* eps Aqr', 311.918956553417, -9.495776926901, 33.923, -34.936],
  ['虚', '虚宿一', '* bet Aqr', 322.889716983479, -5.571174828064, 19.214, -8.163],
  ['危', '危宿一', '* alf Aqr', 331.445981440948, -0.319850955424, 18.59, -10.45],
  ['室', '室宿一', '* alf Peg', 346.190222691426, 15.205267147928, 60.4, -41.3],
  ['壁', '壁宿一', '* gam Peg', 3.308968120905, 15.183598429594, 0.492, -10.73],
  ['奎', '奎宿一', '* eta And', 14.301667830111, 23.417650023124, -43.008, -45.254],
  ['娄', '娄宿一', '* bet Ari', 28.660045788845, 20.808031471916, 98.74, -110.41],
  ['胃', '胃宿一', '* 35 Ari', 40.8629761644, 27.70714940929, 8.502, -11.433],
  ['昴', '昴宿一', '* 17 Tau', 56.218904540788, 24.11333785002, 20.542, -46.081],
  ['毕', '毕宿一', '* eps Tau', 67.154167729665, 19.180434205814, 107.526, -36.2],
  ['觜', '觜宿一', '* lam Ori', 83.784490021032, 9.934155874167, -0.34, -2.94],
  ['参', '参宿一', '* zet Ori', 85.189694427931, -1.942573585972, 3.19, 2.03],
  ['井', '井宿一', '* mu. Gem', 95.740111926196, 22.513582745904, 56.39, -110.03],
  ['鬼', '鬼宿一', '* tet Cnc', 127.89887483425, 18.09441817296, -59.639, -56.615],
  ['柳', '柳宿一', '* del Hya', 129.41403113663, 5.70378776223, -68.867, -7.551],
  ['星', '星宿一', '* alf Hya', 141.896844595859, -8.658599531746, -15.23, 34.37],
  ['张', '张宿一', '* ups01 Hya', 147.869479078842, -14.846628713347, 31.037, -26.862],
  ['翼', '翼宿一', '* alf Crt', 164.943604815762, -18.298786220616, -462.303, 128.614],
  ['轸', '轸宿一', '* gam Crv', 183.951545037377, -17.541930457603, -158.61, 21.86],
].map(
  ([mansion, chineseName, simbadId, ra, dec, pmRa, pmDec]) =>
    ({
      mansion,
      chineseName,
      simbadId,
      raJ2000Degrees: ra,
      decJ2000Degrees: dec,
      pmRaMasPerYear: pmRa,
      pmDecMasPerYear: pmDec,
    }) as QizhengMansionStar,
);

export const QIZHENG_MANSION_MODEL = {
  id: 'qizheng-mansion-stars-simbad-astronomy-engine',
  catalogEpoch: 'J2000.0 / ICRS',
  mappingSource: 'https://zh.wikipedia.org/w/index.php?title=二十八宿&oldid=92223725',
  astrometrySource: 'SIMBAD TAP basic 表（ra、dec、pmra、pmdec；查询日期 2026-07-27）',
  transformSource:
    'astronomy-engine 2.1.19：Rotation_EQJ_ECT，将 J2000 平赤道坐标转为目标日期真黄道坐标',
  limitation:
    '宿界按距星目标日期真黄经至下一距星真黄经的实际弧段划分；这是可复算的现代坐标复原，不等同于某一历史历元的古赤道距度表，也不证明占星解释有效。',
} as const;

function normalizeLongitude(value: number): number {
  return ((value % 360) + 360) % 360;
}

function decimalYear(date: Date): number {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (end - start);
}

export function calculateQizhengMansionBoundaries(date: Date): QizhengMansionBoundary[] {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('七政四余距星边界日期无效。');
  }
  const yearsSinceJ2000 = decimalYear(date) - 2000;
  const time = new AstroTime(date);
  const rotation = Rotation_EQJ_ECT(time);
  const boundaries = QIZHENG_MANSION_STARS.map((star) => {
    const dec = star.decJ2000Degrees + (star.pmDecMasPerYear * yearsSinceJ2000) / 3_600_000;
    const ra =
      star.raJ2000Degrees +
      (star.pmRaMasPerYear * yearsSinceJ2000) /
        (3_600_000 * Math.cos((star.decJ2000Degrees * Math.PI) / 180));
    const raRadians = (ra * Math.PI) / 180;
    const decRadians = (dec * Math.PI) / 180;
    const eqj = new Vector(
      Math.cos(decRadians) * Math.cos(raRadians),
      Math.cos(decRadians) * Math.sin(raRadians),
      Math.sin(decRadians),
      time,
    );
    const ecliptic = RotateVector(rotation, eqj);
    return {
      ...star,
      longitude: normalizeLongitude((Math.atan2(ecliptic.y, ecliptic.x) * 180) / Math.PI),
      widthDegrees: 0,
    };
  }).sort((left, right) => left.longitude - right.longitude);

  return boundaries.map((boundary, index) => ({
    ...boundary,
    widthDegrees: normalizeLongitude(
      boundaries[(index + 1) % boundaries.length].longitude - boundary.longitude,
    ),
  }));
}

export function longitudeToQizhengMansion(
  longitude: number,
  boundaries: readonly QizhengMansionBoundary[],
): { xiu: string; xiuDegree: number } {
  if (!Number.isFinite(longitude)) {
    throw new Error(`七政四余黄经无效：${String(longitude)}。`);
  }
  if (boundaries.length !== 28) throw new Error('七政四余距星边界必须完整包含二十八宿。');
  const expectedMansions = new Set(QIZHENG_MANSION_STARS.map((item) => item.mansion));
  const actualMansions = new Set(boundaries.map((item) => item.mansion));
  if (
    actualMansions.size !== expectedMansions.size ||
    [...expectedMansions].some((mansion) => !actualMansions.has(mansion))
  ) {
    throw new Error('七政四余距星边界存在重复或缺失宿名。');
  }
  if (
    boundaries.some(
      (item) =>
        !Number.isFinite(item.longitude) ||
        !Number.isFinite(item.widthDegrees) ||
        item.widthDegrees <= 0 ||
        item.widthDegrees >= 360,
    )
  ) {
    throw new Error('七政四余距星边界黄经或宿宽无效。');
  }
  const target = normalizeLongitude(longitude);
  const sortedBoundaries = [...boundaries].sort((left, right) => left.longitude - right.longitude);
  for (let index = 0; index < sortedBoundaries.length; index += 1) {
    const boundary = sortedBoundaries[index];
    const next = sortedBoundaries[(index + 1) % sortedBoundaries.length];
    const actualWidth = normalizeLongitude(next.longitude - boundary.longitude);
    if (actualWidth <= 1e-10 || Math.abs(actualWidth - boundary.widthDegrees) > 1e-7) {
      throw new Error(`七政四余宿界不连续：${boundary.mansion}宿。`);
    }
  }
  const exactBoundary = sortedBoundaries.find((item) => {
    const separation = normalizeLongitude(target - item.longitude);
    return Math.min(separation, 360 - separation) < 1e-10;
  });
  const boundary =
    exactBoundary ??
    [...sortedBoundaries].reverse().find((item) => item.longitude < target) ??
    sortedBoundaries[sortedBoundaries.length - 1];
  const xiuDegree = normalizeLongitude(target - boundary.longitude);
  if (xiuDegree >= boundary.widthDegrees + 1e-9) {
    throw new Error(`七政四余宿界不连续：${boundary.mansion}宿。`);
  }
  return { xiu: boundary.mansion, xiuDegree };
}
