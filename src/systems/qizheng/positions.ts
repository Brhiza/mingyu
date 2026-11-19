import { Astronomy, type Body } from '../astronomy/engine';
import {
  J2000_JD,
  UNIX_EPOCH_JD,
  normalizeDegrees as normalizeLongitude,
  signedDegreesDifference as signedAngle,
  timestampToJulianDay,
} from '../astronomy/ephemeris';
const { MakeTime, Rotation_EQJ_ECT, GeoMoon, RotateState, StateVector } = Astronomy;

const JULIAN_CENTURY_DAYS = 36_525;
const LUNAR_INCLINATION_DEGREES = 5.1453964;

/** Swiss Ephemeris Moshier 平均月球根数的长期项。 */
const MOSHIER_LUNAR_Z: number[] = [
  -13.12045233711, -0.00113821591258, -0.000009646018347184, 31.468347198839, 0.0476835758578,
  -0.0003421689790404, -6.84707090541, -0.005834100476561, -0.0002905334122698, -5.663161722088,
  0.005722859298199, -0.00008466472828815,
];

function modArcSeconds(value: number): number {
  return ((value % 1_296_000) + 1_296_000) % 1_296_000;
}

function moshierMeanNodeLongitude(jd: number): number {
  const t = (jd - J2000_JD) / JULIAN_CENTURY_DAYS;
  const t2 = t * t;
  const fracT = t % 1;
  const nfArc = modArcSeconds(
    1_739_232_000 * fracT + 295_263.0983 * t - 0.207941990176 * t + 335_779.55755,
  );
  const lpArc = modArcSeconds(
    1_731_456_000 * fracT + 1_108_372.83264 * t - 0.6784914260953 * t + 785_939.95571,
  );
  const nf = nfArc + ((MOSHIER_LUNAR_Z[2] * t + MOSHIER_LUNAR_Z[1]) * t + MOSHIER_LUNAR_Z[0]) * t2;
  const lp =
    lpArc + ((MOSHIER_LUNAR_Z[11] * t + MOSHIER_LUNAR_Z[10]) * t + MOSHIER_LUNAR_Z[9]) * t2;
  return normalizeLongitude(((lp - nf) / 3600 + 360) % 360);
}

function moshierMeanApogeeLongitude(jd: number): number {
  const t = (jd - J2000_JD) / JULIAN_CENTURY_DAYS;
  const t2 = t * t;
  const fracT = t % 1;
  const mpArc = modArcSeconds(
    1_717_200_000 * fracT + 715_923.4728 * t - 0.2035946368532 * t + 485_868.28096,
  );
  const lpArc = modArcSeconds(
    1_731_456_000 * fracT + 1_108_372.83264 * t - 0.6784914260953 * t + 785_939.95571,
  );
  const mp = mpArc + ((MOSHIER_LUNAR_Z[5] * t + MOSHIER_LUNAR_Z[4]) * t + MOSHIER_LUNAR_Z[3]) * t2;
  const lp =
    lpArc + ((MOSHIER_LUNAR_Z[11] * t + MOSHIER_LUNAR_Z[10]) * t + MOSHIER_LUNAR_Z[9]) * t2;
  return normalizeLongitude((modArcSeconds(lp - mp + 648_000) / 3600 + 360) % 360);
}

function trueNodeLongitude(utcMs: number): number {
  const time = MakeTime(new Date(utcMs));
  const rotation = Rotation_EQJ_ECT(time);
  const center = GeoMoon(time);
  // 极短的两点位置差分会在停逆附近放大舍入误差。
  // 在惯性系求四阶速度，随后按同一瞬时旋转r、v，保持真交点的r×v定义。
  const stepDays = 1 / 24;
  const before = GeoMoon(time.AddDays(-stepDays));
  const after = GeoMoon(time.AddDays(stepDays));
  const before2 = GeoMoon(time.AddDays(-2 * stepDays));
  const after2 = GeoMoon(time.AddDays(2 * stepDays));
  const velocity = (axis: 'x' | 'y' | 'z') =>
    (8 * (after[axis] - before[axis]) - (after2[axis] - before2[axis])) / (12 * stepDays);
  const state = RotateState(
    rotation,
    new StateVector(
      center.x,
      center.y,
      center.z,
      velocity('x'),
      velocity('y'),
      velocity('z'),
      time,
    ),
  );
  const hx = state.y * state.vz - state.z * state.vy;
  const hy = state.z * state.vx - state.x * state.vz;
  return normalizeLongitude(Math.atan2(hx, -hy) * (180 / Math.PI));
}

function moshierMeanLilithLongitude(utcMs: number): number {
  const jd = utcMs / 86_400_000 + UNIX_EPOCH_JD;
  const node = moshierMeanNodeLongitude(jd);
  const apogee = moshierMeanApogeeLongitude(jd);
  const u = ((apogee - node) * Math.PI) / 180;
  return normalizeLongitude(
    node +
      Math.atan2(Math.cos((LUNAR_INCLINATION_DEGREES * Math.PI) / 180) * Math.sin(u), Math.cos(u)) *
        (180 / Math.PI),
  );
}

const planets: readonly [string, Body, string][] = [
  ['太阳', Astronomy.Body.Sun, '日'], ['太阴', Astronomy.Body.Moon, '月'], ['辰星(水)', Astronomy.Body.Mercury, '水'],
  ['太白(金)', Astronomy.Body.Venus, '金'], ['荧惑(火)', Astronomy.Body.Mars, '火'], ['岁星(木)', Astronomy.Body.Jupiter, '木'], ['镇星(土)', Astronomy.Body.Saturn, '土'],
];
function planetLongitude(body: Body, timestamp: number) {
  const time = Astronomy.MakeTime(new Date(timestamp));
  return body === Astronomy.Body.Moon ? Astronomy.EclipticGeoMoon(time).lon : Astronomy.Ecliptic(Astronomy.GeoVector(body, time, true)).elon;
}

/** 周期搜索只读取指定星曜的黄经，避免为每次求根重复计算所有星体与逆行状态。 */
export function sampleLongitudes(timestamp: number, names: readonly string[]) {
  if (!Number.isFinite(timestamp)) throw new Error('星位计算时刻无效。');
  const wanted = new Set(names), result: Array<{ name: string; longitude: number }> = [];
  for (const [name, body] of planets) if (wanted.has(name)) result.push({ name, longitude: normalizeLongitude(planetLongitude(body, timestamp)) });
  if (wanted.has('罗睺(火余)') || wanted.has('计都(土余)')) {
    const node = trueNodeLongitude(timestamp);
    if (wanted.has('罗睺(火余)')) result.push({ name: '罗睺(火余)', longitude: node });
    if (wanted.has('计都(土余)')) result.push({ name: '计都(土余)', longitude: normalizeLongitude(node + 180) });
  }
  if (wanted.has('月孛(水余)')) result.push({ name: '月孛(水余)', longitude: moshierMeanLilithLongitude(timestamp) });
  if (wanted.has('紫炁(木余)')) result.push({ name: '紫炁(木余)', longitude: normalizeLongitude(237.038993 + ((timestamp - Date.UTC(1995, 11, 31)) / 86_400_000) * (360 / 10227.1792)) });
  if (result.length !== wanted.size) throw new Error('周期采样包含未知星曜。');
  return result;
}

/** 七政使用现代星历；月交点（支持真交点与平均交点）、平均月孛和紫炁分别标记来源。 */
export function positionsAt(timestamp: number, options?: { nodeModel?: 'true' | 'mean' }) {
  if (!Number.isFinite(timestamp)) throw new Error('星位计算时刻无效。');
  const regular = planets.map(([name, body, key]) => ({ name, kind: '七政' as const, key, longitude: normalizeLongitude(planetLongitude(body, timestamp)),
    retrograde: body === Astronomy.Body.Sun || body === Astronomy.Body.Moon ? false : signedAngle(planetLongitude(body, timestamp - 432_000), planetLongitude(body, timestamp + 432_000)) < 0,
    source: 'Astronomy Engine 地心视黄经', precision: '现代天文计算' as const }));
  const useMeanNode = options?.nodeModel === 'mean';
  const lilith = moshierMeanLilithLongitude(timestamp);
  const node = useMeanNode
    ? moshierMeanNodeLongitude(timestampToJulianDay(timestamp))
    : trueNodeLongitude(timestamp);
  const extra = [
    { name: '罗睺(火余)', longitude: node, retrograde: undefined, source: useMeanNode ? 'Moshier 平均月交点' : 'Astronomy Engine 真月交点', precision: '现代天文计算' as const },
    { name: '计都(土余)', longitude: normalizeLongitude(node + 180), retrograde: undefined, source: useMeanNode ? '平均月交点对宫' : '真月交点对宫', precision: '现代天文计算' as const },
    { name: '月孛(水余)', longitude: lilith, retrograde: signedAngle(moshierMeanLilithLongitude(timestamp - 86_400_000), moshierMeanLilithLongitude(timestamp + 86_400_000)) < 0, source: 'Moshier 平均月孛模型', precision: '现代天文计算' as const },
    { name: '紫炁(木余)', longitude: normalizeLongitude(237.038993 + ((timestamp - Date.UTC(1995, 11, 31)) / 86_400_000) * (360 / 10227.1792)), retrograde: false, source: '《七政算内篇》紫炁均速模型', precision: '传统均速模型' as const },
  ].map((item) => ({ ...item, kind: '四余' as const, key: null }));
  return [...regular, ...extra];
}

/** 计算出生地地平真上升点（Ascendant）视黄经。 */
export function ascendantLongitude(timestamp: number, latitude: number, longitude: number): number {
  const time = MakeTime(new Date(timestamp));
  const gst = Astronomy.SiderealTime(time);
  const ramc = normalizeLongitude(gst * 15 + longitude) * (Math.PI / 180);
  const eps = Astronomy.e_tilt(time).tobl * (Math.PI / 180);
  const phi = latitude * (Math.PI / 180);
  return normalizeLongitude(
    Math.atan2(Math.cos(ramc), -(Math.sin(eps) * Math.tan(phi) + Math.cos(eps) * Math.sin(ramc))) *
      (180 / Math.PI),
  );
}

export function skyAt(timestamp: number, latitude: number, longitude: number) {
  const time = Astronomy.MakeTime(new Date(timestamp)), observer = new Astronomy.Observer(latitude, longitude, 0);
  const equatorial = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  const horizon = Astronomy.Horizon(time, observer, equatorial.ra, equatorial.dec, 'normal');
  return { sunAltitudeDegrees: horizon.altitude, sunAzimuthDegrees: horizon.azimuth,
    limitation: '太阳视高度采用标准大气折射和海拔零米，不等于实际可见光照或日出日落时刻。' };
}

