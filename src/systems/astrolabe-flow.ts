import { Engine, solarReturn, type HouseSystem } from 'caelus';
import { embeddedData } from 'caelus/data-embedded';
import type { z } from 'zod';
import type { astrolabeIndependentInput } from '../schema';
import { resolveCivilTime } from './huangji/civil-time';
import { houseAt } from './astrology/geometry';

type Input = z.infer<typeof astrolabeIndependentInput>;
type Flow = NonNullable<Input['flow']>;
export type Natal = { basis: { julianDay: number; utcDateTime: string; houseSystem: HouseSystem }; points: Array<{ id: string; name: string; longitude: number }>; derived: Array<{ id: string; name: string; longitude: number }>; angles: Array<{ id: string; name: string; longitude: number }>; houses: Array<{ house: number; longitude: number }> };
const engine = new Engine(embeddedData);
const epoch = 2_440_587.5, dayMs = 86_400_000;
const norm = (n: number) => ((n % 360) + 360) % 360;
const labels: Record<string, string> = { sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星', uranus: '天王星', neptune: '海王星', pluto: '冥王星', true_node: '北交点' };
const ids = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'mars', 'venus', 'mercury', 'sun', 'moon', 'true_node'];
const main = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const rules = [{ type: 'conjunction', label: '合相', angle: 0, orb: 8 }, { type: 'sextile', label: '六合', angle: 60, orb: 6 }, { type: 'square', label: '刑相', angle: 90, orb: 7 }, { type: 'trine', label: '拱相', angle: 120, orb: 8 }, { type: 'opposition', label: '冲相', angle: 180, orb: 8 }] as const;
const returnOrbs: Record<number, number> = { 0: 6, 60: 4, 90: 5, 120: 5, 180: 6 };
const iso = (jd: number) => new Date(Math.round((jd - epoch) * dayMs)).toISOString();
function atReference(flow: Flow, birth: Input['birth']) {
  const r = flow.reference;
  if (r.kind === 'instant') {
    const timestamp = Date.parse(r.at), utcYear = new Date(timestamp).getUTCFullYear();
    if (utcYear < 1900 || utcYear > 2100) throw new Error('推运参考瞬时 UTC 年份须在 1900 至 2100 之间。');
    return { kind: r.kind, utcDateTime: new Date(timestamp).toISOString(), timestamp, localDateTime: null, timezone: null };
  }
  const local = { year: r.year, month: r.kind === 'year' ? 7 : r.month, day: r.kind === 'year' ? 1 : r.kind === 'month' ? 15 : r.day, hour: 12, minute: 0, second: 0 };
  const resolved = resolveCivilTime({ ...local, ...(birth.timeZoneId ? { timeZoneId: birth.timeZoneId } : { timezone: birth.timezone }) });
  return { kind: r.kind, utcDateTime: resolved.utcDateTime, timestamp: resolved.utcTimestamp, localDateTime: resolved.localDateTime, timezone: resolved.timezone };
}
type Position = { id: string; name: string; longitude: number; speed?: number; retrograde?: boolean };
function pointsAt(jd: number, keys: string[]): Position[] {
  return keys.map((id) => { const value = engine.position(id, jd); return { id, name: labels[id] ?? id, longitude: value.lon, speed: value.speed, retrograde: value.retrograde }; });
}
function aspects(moving: Position[], natal: Position[], orbFor: (point: Position, base: number, angle: number) => number, minimumStrength: number, phases: boolean) {
  return moving.flatMap((a) => natal.flatMap((b) => {
    const direct = norm(b.longitude - a.longitude), actualAngle = Math.min(direct, 360 - direct);
    return rules.flatMap((rule) => {
      const allowedOrb = orbFor(a, rule.orb, rule.angle), deviation = Math.abs(actualAngle - rule.angle), strength = 100 * (1 - deviation / allowedOrb);
      if (strength < minimumStrength) return [];
      const speed = -(a.speed ?? 0), separationSpeed = (direct > 180 ? -1 : 1) * speed;
      const applying = speed === 0 || actualAngle === rule.angle ? null : (actualAngle - rule.angle) * separationSpeed < 0;
      const phase = !phases ? null : deviation < 0.005 ? 'exact' : applying === null ? 'unknown' : applying ? 'applying' : 'separating';
      return [{ moving: a.id, movingName: a.name, natal: b.id, natalName: b.name, type: rule.type, label: rule.label, angle: rule.angle, actualAngle, deviation, allowedOrb, strength, phase }];
    });
  })).sort((a, b) => b.strength - a.strength || a.deviation - b.deviation);
}
function houseFor(natal: Natal, longitude: number) {
  return houseAt(longitude, natal.houses.map((house) => house.longitude));
}
export async function calculateAstrolabeFlow(flow: Flow, birth: Input['birth'], natal: Natal) {
  const reference = atReference(flow, birth), referenceJd = reference.timestamp / dayMs + epoch, natalJd = natal.basis.julianDay;
  const selected = flow.techniques ?? ['transit', 'solar-return', 'secondary', 'solar-arc'];
  const natalPoints = [...natal.points.filter((point) => [...main, 'true_node'].includes(point.id)), ...natal.derived.filter((point) => point.id === 'south_node'), ...natal.angles.filter((point) => ['asc', 'mc'].includes(point.id))];
  const allNatals = [...natal.points.filter((point) => main.includes(point.id)), ...natal.angles];
  const beforeBirth = referenceJd < natalJd;
  const natalTimestamp = Date.parse(natal.basis.utcDateTime);
  const age = (reference.timestamp - natalTimestamp) / (365.2425 * dayMs);
  const progressedTimestamp = new Date(natalTimestamp + age * dayMs).getTime();
  const progressedJd = progressedTimestamp / dayMs + epoch;
  const progressed = !beforeBirth && (selected.includes('secondary') || selected.includes('solar-arc')) ? pointsAt(progressedJd, ['sun', 'moon', 'mercury', 'venus', 'mars']) : [];
  const transitPoints = selected.includes('transit') ? pointsAt(referenceJd, ids).map((point) => ({ ...point, natalHouse: houseFor(natal, point.longitude) })) : [];
  const transit = selected.includes('transit') ? { at: reference.utcDateTime, points: transitPoints, aspects: aspects(transitPoints, natalPoints, (_, base) => base, 35, true) } : null;
  const secondary = selected.includes('secondary') ? beforeBirth ? { status: 'not-applicable' as const, reason: '参考时刻早于出生瞬时。' } : {
    status: 'calculated' as const, ageYears: age, progressedUtcDateTime: new Date(progressedTimestamp).toISOString(), points: progressed,
    aspects: aspects(progressed, natalPoints, (point) => point.id === 'moon' ? 1 : 0.5, 0, false), yearLengthDays: 365.2425,
  } : null;
  const solarArc = selected.includes('solar-arc') ? beforeBirth ? { status: 'not-applicable' as const, reason: '参考时刻早于出生瞬时。' } : (() => {
    const sun = natal.points.find((point) => point.id === 'sun')!, arc = norm(progressed.find((point) => point.id === 'sun')!.longitude - sun.longitude);
    const points = allNatals.map((point) => ({ ...point, longitude: norm(point.longitude + arc) }));
    return { status: 'calculated' as const, ageYears: age, progressedUtcDateTime: new Date(progressedTimestamp).toISOString(), arcDegrees: arc, points, aspects: aspects(points, natalPoints, () => 1, 0, false) };
  })() : null;
  const returns = selected.includes('solar-return') ? beforeBirth ? { status: 'not-applicable' as const, reason: '参考时刻早于出生瞬时。' } : (() => {
    const start = Math.max(natalJd - 1 / 86400, referenceJd - 370), hits = solarReturn(engine, natalJd, start, referenceJd + 370).sort((a, b) => a - b);
    const previous = hits.filter((jd) => jd <= referenceJd).at(-1) ?? null, next = hits.find((jd) => jd > referenceJd) ?? null;
    if (previous === null && next === null) throw new Error('未找到参考时刻附近的太阳返照。');
    const location = flow.solarReturnLocation ?? { latitude: birth.latitude, longitude: birth.longitude };
    const charts = hits.map((jd) => {
      const chart = engine.chartAt(jd, location.latitude, location.longitude, { houseSystem: natal.basis.houseSystem });
      const points = main.map((id) => { const point = chart.bodies[id]; if (!point) throw new Error(`返照盘缺少 ${id}。`); return { id, name: labels[id], longitude: point.lon, house: point.house, speed: point.speed, retrograde: point.retrograde }; });
      const angles = [{ id: 'asc', name: '上升', longitude: chart.angles.asc }, { id: 'desc', name: '下降', longitude: norm(chart.angles.asc + 180) }, { id: 'mc', name: '天顶', longitude: chart.angles.mc }, { id: 'ic', name: '天底', longitude: norm(chart.angles.mc + 180) }];
      const all = [...points, ...angles];
      const internalAspects = all.flatMap((point, index) => index < points.length ? aspects([point], all.slice(index + 1), (_, _orb, angle) => returnOrbs[angle], 0, false) : []);
      return { utcDateTime: iso(jd), julianDay: jd, houseSystem: chart.houseSystem, houseSystemRequested: chart.houseSystemRequested,
        points, angles, houses: chart.cusps, internalAspects, natalAspects: aspects(all, natalPoints, (_, _orb, angle) => returnOrbs[angle], 0, false), warnings: chart.warnings };
    });
    return { status: 'calculated' as const, previousUtcDateTime: previous === null ? null : iso(previous), nextUtcDateTime: next === null ? null : iso(next), charts,
      location: { ...location, meaning: flow.solarReturnLocation ? '指定地点' : '出生地' } };
  })() : null;
  const period = flow.period ? (await import('./astrolabe-period')).scanAstrolabePeriod(flow.period, birth, natal) : null;
  return { reference, selected, transit, solarReturn: returns, secondary, solarArc, period, limitations: [
    '行运是参考瞬时的快照，不代表整年、整月或整日的全部变化。',
    '次限采用回归年 365.2425 日换算一岁一日；太阳弧采用推进太阳与本命太阳黄经之差。',
    flow.solarReturnLocation ? '太阳返照宫位按指定地点计算；年、月、日参考时点仍按出生地时区定位。' : '太阳返照宫位按出生地计算；可指定返照地点经纬度。',
    ...(period ? [] : ['未启用周期事件扫描。']),
    '出生时间范围比较需使用 astrolabe-range；传统推运不能保证现实事件。',
  ] };
}
