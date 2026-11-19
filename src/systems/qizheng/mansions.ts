import { Astronomy } from '../astronomy/engine';
import { estimateDeltaTSeconds } from '../astronomy/delta-t';

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

/** SIMBAD J2000 距星和自行；按乾隆修订的二十八宿次序。 */
export const MANSION_STARS: readonly QizhengMansionStar[] = [
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

const normalize = (angle: number) => ((angle % 360) + 360) % 360;

/** 公共星历库旋转替代自维护岁差、章动矩阵；输入为实际 UTC。 */
export function mansionBoundaries(date: Date): QizhengMansionBoundary[] {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error('距星边界日期无效。');
  const year = date.getUTCFullYear(), start = Date.UTC(year, 0, 1), end = Date.UTC(year + 1, 0, 1);
  const decimalYear = year + (date.getTime() - start) / (end - start), years = decimalYear - 2000;
  const tt = (date.getTime() - Date.UTC(2000, 0, 1, 12)) / 86_400_000 + estimateDeltaTSeconds(decimalYear) / 86_400;
  const time = Astronomy.AstroTime.FromTerrestrialTime(tt), rotation = Astronomy.Rotation_EQJ_ECT(time);
  const boundaries = MANSION_STARS.map((star) => {
    const dec = (star.decJ2000Degrees + star.pmDecMasPerYear * years / 3_600_000) * Math.PI / 180;
    const ra = (star.raJ2000Degrees + star.pmRaMasPerYear * years / (3_600_000 * Math.cos(star.decJ2000Degrees * Math.PI / 180))) * Math.PI / 180;
    const vector = new Astronomy.Vector(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec), time);
    const ecliptic = Astronomy.RotateVector(rotation, vector);
    return { ...star, longitude: normalize(Math.atan2(ecliptic.y, ecliptic.x) * 180 / Math.PI), widthDegrees: 0 };
  }).sort((a, b) => a.longitude - b.longitude);
  return boundaries.map((star, index) => ({ ...star, widthDegrees: normalize(boundaries[(index + 1) % 28].longitude - star.longitude) }));
}

/** 黄经落在本距星及下一距星之间；输入边界必须完整连续。 */
export function locateMansion(longitude: number, boundaries: readonly QizhengMansionBoundary[]) {
  if (!Number.isFinite(longitude) || boundaries.length !== 28) throw new Error('宿度需要有效黄经及完整二十八宿边界。');
  const sorted = [...boundaries].sort((a, b) => a.longitude - b.longitude), target = normalize(longitude);
  if (new Set(sorted.map((star) => star.mansion)).size !== 28 || sorted.some((star, i) => !Number.isFinite(star.longitude) || !Number.isFinite(star.widthDegrees) || star.widthDegrees <= 0 || Math.abs(normalize(sorted[(i + 1) % 28].longitude - star.longitude) - star.widthDegrees) > 1e-7)) throw new Error('距星边界缺失或不连续。');
  // 浮点变换在重复调用中可能有约 1e-11° 的差异；微角秒级范围统一归入距星边界。
  const exact = sorted.find((star) => Math.min(normalize(target - star.longitude), normalize(star.longitude - target)) <= 1e-9);
  const star = exact ?? [...sorted].reverse().find((item) => item.longitude < target) ?? sorted[27];
  return { xiu: star.mansion, xiuDegree: exact ? 0 : normalize(target - star.longitude) };
}

