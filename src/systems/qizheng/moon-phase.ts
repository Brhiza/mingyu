import { Astronomy } from '../astronomy/engine';
import { calculateMoonGeometry } from '../astronomy/moon-geometry';
import { sampleLongitudes } from './positions';
const phases = ['朔', '上弦', '望', '下弦'] as const;
const eightPhases = ['新月', '蛾眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'] as const;
const normalize = (angle: number) => ((angle % 360) + 360) % 360;
const signed = (angle: number) => ((angle + 540) % 360) - 180;
const phaseAt = (timestamp: number) => { const values = sampleLongitudes(timestamp, ['太阳', '太阴']); return normalize(values[1].longitude - values[0].longitude); };

/** 以前后月相初值为窗口，用与七政同源的日月黄经求四正时刻。 */
function searchPhases(timestamp: number) {
  let quarter = Astronomy.SearchMoonQuarter(new Date(timestamp - 10 * 86_400_000));
  const events: Array<{ name: typeof phases[number]; targetAngleDegrees: number; utcTimestamp: number; residualDegrees: number }> = [];
  for (let index = 0; index < 5 && quarter.time.date.getTime() <= timestamp + 10 * 86_400_000; index++, quarter = Astronomy.NextMoonQuarter(quarter)) {
    const targetAngleDegrees = quarter.quarter * 90, estimate = quarter.time.date.getTime();
    let left = estimate - 2 * 3_600_000, right = estimate + 2 * 3_600_000, leftValue = signed(phaseAt(left) - targetAngleDegrees);
    const rightValue = signed(phaseAt(right) - targetAngleDegrees);
    if (leftValue * rightValue > 0) throw new Error('无法包围四正月相交点。');
    while (right - left > 10) {
      const middle = Math.round((left + right) / 2), value = signed(phaseAt(middle) - targetAngleDegrees);
      if (leftValue * value <= 0) right = middle; else { left = middle; leftValue = value; }
    }
    const utcTimestamp = Math.round((left + right) / 2000) * 1000;
    events.push({ name: phases[quarter.quarter], targetAngleDegrees, utcTimestamp, residualDegrees: Math.abs(signed(phaseAt(utcTimestamp) - targetAngleDegrees)) });
  }
  return events;
}
type Event = ReturnType<typeof searchPhases>[number];

function surrounding(events: readonly Event[], timestamp: number) {
  const previous = events.filter((event) => event.utcTimestamp < timestamp).at(-1), current = events.find((event) => event.utcTimestamp === timestamp) ?? null, next = events.find((event) => event.utcTimestamp > timestamp);
  return previous && next ? { previous, current, next } : undefined;
}

function atTime(timestamp: number, getEvents: (timestamp: number) => { previous: Event; current: Event | null; next: Event }) {
  if (!Number.isFinite(timestamp)) throw new Error('月相需要有效出生时刻。');
  const time = Astronomy.MakeTime(new Date(timestamp)), sun = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body.Sun, time, true)), moon = Astronomy.EclipticGeoMoon(time);
  const phaseAngleDegrees = normalize(moon.lon - sun.elon), geometry = calculateMoonGeometry({ sunLongitude: sun.elon, sunLatitude: sun.elat, sunDistance: sun.vec.Length(), moonLongitude: moon.lon, moonLatitude: moon.lat, moonDistance: moon.dist });
  const { previous, current, next } = getEvents(timestamp);
  return { phaseAngleDegrees, elongationDegrees: geometry.elongationDegrees, illuminationFraction: geometry.illuminationFraction,
    eightPhaseName: eightPhases[Math.floor((phaseAngleDegrees + 22.5) / 45) % 8], waxing: phaseAngleDegrees < 180,
    approximateMoonAgeDays: phaseAngleDegrees / 360 * 29.530588861, previous: { ...previous }, current: current ? { ...current } : null, next: { ...next },
    limitation: '月龄按平均朔望月与相位角近似换算，不是从实际朔时起算；照明为地心几何近似，求根分辨率不等于观测精度。' };
}

function requireSurrounding(events: readonly Event[], timestamp: number) {
  const result = surrounding(events, timestamp);
  if (!result) throw new Error('无法确定前后四正月相。');
  return result;
}

export function qizhengMoonPhase(timestamp: number) {
  return atTime(timestamp, (time) => requireSurrounding(searchPhases(time), time));
}

/** 仅在一次范围请求内复用已求根事件，跨越已缓存区间时重新搜索。 */
export function createQizhengMoonPhaseCalculator() {
  let events: Event[] = [];
  return (timestamp: number) => atTime(timestamp, (time) => {
    const found = surrounding(events, time);
    if (found) return found;
    events = searchPhases(time);
    return requireSurrounding(events, time);
  });
}
