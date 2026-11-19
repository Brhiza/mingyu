import { Engine, lunarPhases, solarEclipses, lunarEclipses } from 'caelus';
import { embeddedData } from 'caelus/data-embedded';
import type { z } from 'zod';
import type { astrolabeIndependentInput } from '../schema';
import type { Natal } from './astrolabe-flow';
import { createTimezoneOffsetReader, formatCivilDateTime, getCivilDateTimeAtFixedOffset } from './huangji/civil-time';
import { houseAt } from './astrology/geometry';

type Input = z.infer<typeof astrolabeIndependentInput>;
type Period = NonNullable<NonNullable<Input['flow']>['period']>;
type Kind = NonNullable<Period['kinds']>[number];
type Body = NonNullable<Period['bodies']>[number];
type Sample = { longitude: number; speed: number };
type Event = { kind: Kind; utcTimestamp: number; utcDateTime: string; localDateTime: string; timezone: number; moving?: Body; movingName?: string; target?: string; targetName?: string; aspect?: string; aspectName?: string; direction?: string; sign?: string; house?: number; phase?: string; eclipse?: string; touches?: Array<{ point: string; pointName: string; aspect: string; deviation: number }> };
const day = 86_400_000, epoch = 2_440_587.5;
const engine = new Engine(embeddedData);
const bodies: Body[] = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'true_node'];
const labels: Record<string, string> = { sun: '太阳', moon: '月亮', mercury: '水星', venus: '金星', mars: '火星', jupiter: '木星', saturn: '土星', uranus: '天王星', neptune: '海王星', pluto: '冥王星', true_node: '北交点' };
const signs = ['白羊', '金牛', '双子', '巨蟹', '狮子', '处女', '天秤', '天蝎', '射手', '摩羯', '水瓶', '双鱼'];
const kinds: Kind[] = ['transit_aspect', 'sky_aspect', 'station', 'sign_ingress', 'house_ingress', 'moon_phase', 'eclipse'];
const rules = [{ id: 'conjunction', name: '合相', angle: 0 }, { id: 'sextile', name: '六合', angle: 60 }, { id: 'square', name: '刑相', angle: 90 }, { id: 'trine', name: '拱相', angle: 120 }, { id: 'opposition', name: '冲相', angle: 180 }] as const;
const norm = (n: number) => ((n % 360) + 360) % 360;
const wrap = (n: number) => norm(n + 180) - 180;
const offsets = (angle: number) => angle === 0 || angle === 180 ? [angle] : [angle, -angle];
const toJd = (ms: number) => ms / day + epoch;
const toMs = (jd: number) => (jd - epoch) * day;

/** Scan one bounded page on a fixed UTC grid; end is exclusive. */
export function scanAstrolabePeriod(period: Period, birth: Input['birth'], natal: Natal) {
  const scopeStart = Date.parse(period.start), scopeEnd = Date.parse(period.end), cursor = period.cursor ? Date.parse(period.cursor) : scopeStart;
  const pageDays = period.pageDays ?? 7, pageMs = pageDays * day;
  if (scopeEnd <= scopeStart || scopeEnd - scopeStart > 370 * day) throw new Error('周期终点须晚于起点，且整个周期不得超过 370 日。');
  if (scopeStart < Date.UTC(1900, 0, 1) || scopeEnd > Date.UTC(2101, 0, 1)) throw new Error('周期窗口须位于 UTC 1900-01-01 至 2101-01-01 之间。');
  if (cursor < scopeStart || cursor >= scopeEnd || (cursor - scopeStart) % pageMs !== 0) throw new Error('周期游标须在范围内且按当前 pageDays 对齐；建议使用返回的 nextCursor。');
  const end = Math.min(scopeEnd, cursor + pageMs), selected = period.bodies ?? bodies, selectedKinds = period.kinds ?? kinds;
  const natalPoints = [...natal.points.filter((p) => [...bodies].includes(p.id as Body)), ...natal.derived.filter((p) => p.id === 'south_node'), ...natal.angles.filter((p) => p.id === 'asc' || p.id === 'mc')];
  const sampleCache = new Map<string, Sample>();
  const at = (body: Body, time: number) => {
    const key = `${body}:${time}`; let point = sampleCache.get(key);
    if (!point) { const p = engine.position(body, toJd(time)); point = { longitude: p.lon, speed: p.speed }; sampleCache.set(key, point); }
    return point;
  };
  const root = (left: number, right: number, f: (t: number) => number) => {
    let a = left, b = right, av = f(a), bv = f(b);
    if (Math.abs(av) < 1e-10) return a;
    if (Math.abs(bv) < 1e-10) return b;
    for (let i = 0; i < 45 && b - a > 10; i++) {
      const mid = (a + b) / 2, value = f(mid);
      if (Math.sign(av) === Math.sign(value)) { a = mid; av = value; } else { b = mid; bv = value; }
    }
    return (a + b) / 2;
  };
  const crosses = (a: number, b: number) => (Math.abs(a) < 1e-10 || Math.abs(b) < 1e-10 || Math.sign(a) !== Math.sign(b)) && Math.abs(a - b) < 180 && !(Math.abs(a) < 1e-10 && Math.abs(b) < 1e-10);
  const offsetAt = birth.timeZoneId ? createTimezoneOffsetReader(birth.timeZoneId) : () => birth.timezone!;
  const events: Event[] = [], seen = new Set<string>();
  const add = (raw: number, fields: Omit<Event, 'utcTimestamp' | 'utcDateTime' | 'localDateTime' | 'timezone'>) => {
    // Round before applying the half-open boundary, so neighboring pages
    // consistently assign an event whose numerical root is near the boundary.
    const utcTimestamp = Math.round(raw / 1000) * 1000;
    if (utcTimestamp < cursor || utcTimestamp >= end) return;
    const timezone = offsetAt(utcTimestamp);
    const key = [fields.kind, fields.moving, fields.target, fields.aspect, fields.direction, fields.sign, fields.house, fields.phase, fields.eclipse, utcTimestamp].join(':');
    if (seen.has(key)) return; seen.add(key);
    events.push({ ...fields, utcTimestamp, utcDateTime: new Date(utcTimestamp).toISOString(), localDateTime: formatCivilDateTime(getCivilDateTimeAtFixedOffset(new Date(utcTimestamp), timezone)), timezone });
  };
  const step = 6 * 3_600_000, times = [cursor - 60_000, cursor];
  for (let t = cursor + step; t < end; t += step) times.push(t);
  times.push(end, end + 60_000);
  const turns = new Map<Body, number[]>();
  if (selectedKinds.some((kind) => ['transit_aspect', 'sky_aspect', 'station', 'sign_ingress', 'house_ingress'].includes(kind))) {
    for (const body of selected) {
      const found: number[] = [];
      for (let i = 1; i < times.length; i++) {
        const left = times[i - 1], right = times[i], a = at(body, left).speed, b = at(body, right).speed;
        if (!crosses(a, b)) continue;
        const time = root(left, right, (t) => at(body, t).speed);
        if (!found.some((v) => Math.abs(v - time) < 1000)) found.push(time);
        if (selectedKinds.includes('station') && !['sun', 'moon', 'true_node'].includes(body)) {
          const before = at(body, time - 60_000).speed, after = at(body, time + 60_000).speed;
          if (before * after < 0) add(time, { kind: 'station', moving: body, movingName: labels[body], direction: after < 0 ? 'retrograde' : 'direct' });
        }
      }
      turns.set(body, found);
    }
  }
  for (const body of selected) {
    if (!selectedKinds.some((kind) => ['transit_aspect', 'sign_ingress', 'house_ingress'].includes(kind))) break;
    const frames = [...new Set([...times, ...(turns.get(body) ?? [])])].sort((a, b) => a - b);
    for (let i = 1; i < frames.length; i++) {
      const left = frames[i - 1], right = frames[i], from = at(body, left).longitude, to = at(body, right).longitude;
      const crossing = (target: number) => {
        const a = wrap(from - target), b = wrap(to - target);
        return crosses(a, b) ? root(left, right, (t) => wrap(at(body, t).longitude - target)) : null;
      };
      if (selectedKinds.includes('transit_aspect')) for (const natalPoint of natalPoints) for (const rule of rules) for (const offset of offsets(rule.angle)) {
        const t = crossing(norm(natalPoint.longitude + offset));
        if (t !== null) add(t, { kind: 'transit_aspect', moving: body, movingName: labels[body], target: natalPoint.id, targetName: natalPoint.name, aspect: rule.id, aspectName: rule.name, direction: offset < 0 ? 'negative' : 'positive' });
      }
      if (selectedKinds.includes('sign_ingress')) for (let sign = 0; sign < 12; sign++) {
        const t = crossing(sign * 30); if (t === null) continue;
        const before = Math.floor(norm(at(body, t - 60_000).longitude) / 30), after = Math.floor(norm(at(body, t + 60_000).longitude) / 30);
        if (before !== after) add(t, { kind: 'sign_ingress', moving: body, movingName: labels[body], sign: signs[after], direction: at(body, t).speed < 0 ? 'retrograde' : 'direct' });
      }
      if (selectedKinds.includes('house_ingress')) for (let index = 0; index < 12; index++) {
        const t = crossing(natal.houses[index].longitude); if (t === null) continue;
        const locate = (longitude: number) => houseAt(longitude, natal.houses.map((house) => house.longitude));
        const before = locate(at(body, t - 60_000).longitude), after = locate(at(body, t + 60_000).longitude);
        if (before && after && before !== after) add(t, { kind: 'house_ingress', moving: body, movingName: labels[body], house: after, direction: at(body, t).speed < 0 ? 'retrograde' : 'direct' });
      }
    }
  }
  if (selectedKinds.includes('sky_aspect')) for (let i = 0; i < selected.length; i++) for (let j = i + 1; j < selected.length; j++) {
    const first = selected[i], second = selected[j];
    if ((first === 'sun' && second === 'moon') || (first === 'moon' && second === 'sun')) continue;
    const extra: number[] = [];
    for (let k = 1; k < times.length; k++) {
      const l = times[k - 1], r = times[k], relative = (t: number) => at(first, t).speed - at(second, t).speed;
      if (crosses(relative(l), relative(r))) extra.push(root(l, r, relative));
    }
    const frames = [...new Set([...times, ...extra])].sort((a, b) => a - b);
    for (let k = 1; k < frames.length; k++) {
      const left = frames[k - 1], right = frames[k];
      for (const rule of rules) for (const offset of offsets(rule.angle)) {
        const residual = (t: number) => wrap(at(first, t).longitude - at(second, t).longitude - offset), a = residual(left), b = residual(right);
        if (crosses(a, b)) add(root(left, right, residual), { kind: 'sky_aspect', moving: first, movingName: labels[first], target: second, targetName: labels[second], aspect: rule.id, aspectName: rule.name, direction: offset < 0 ? 'negative' : 'positive' });
      }
    }
  }
  if (selectedKinds.includes('moon_phase')) {
    const phaseNames: Record<string, string> = { new: '朔', first_quarter: '上弦', full: '望', last_quarter: '下弦' };
    for (const [jd, phase] of lunarPhases(engine, toJd(cursor) - 0.5, toJd(end) + 0.5)) {
      const t = toMs(jd), moon = engine.position('moon', jd).lon;
      const touches = natalPoints.filter((p) => ['sun', 'moon', 'asc', 'mc', 'true_node', 'south_node'].includes(p.id)).flatMap((p) => {
        const separation = Math.abs(wrap(moon - p.longitude));
        return [{ name: '合相', angle: 0 }, { name: '刑相', angle: 90 }, { name: '冲相', angle: 180 }].flatMap((rule) => Math.abs(separation - rule.angle) <= 3 ? [{ point: p.id, pointName: p.name, aspect: rule.name, deviation: Math.abs(separation - rule.angle) }] : []);
      }).sort((a, b) => a.deviation - b.deviation);
      add(t, { kind: 'moon_phase', moving: 'moon', movingName: '月亮', target: 'sun', targetName: '太阳', phase: phaseNames[phase], touches });
    }
  }
  if (selectedKinds.includes('eclipse')) {
    const startJd = toJd(cursor) - 0.75, endJd = toJd(end) + 0.75;
    for (const event of solarEclipses(engine, startJd, endJd)) add(toMs(event.tMax), { kind: 'eclipse', moving: 'sun', movingName: '太阳', target: 'moon', targetName: '月亮', eclipse: `solar_${event.type}` });
    for (const event of lunarEclipses(engine, startJd, endJd)) add(toMs(event.tMax), { kind: 'eclipse', moving: 'moon', movingName: '月亮', target: 'sun', targetName: '太阳', eclipse: `lunar_${event.type}` });
  }
  events.sort((a, b) => a.utcTimestamp - b.utcTimestamp || a.kind.localeCompare(b.kind) || (a.moving ?? '').localeCompare(b.moving ?? '') || (a.target ?? '').localeCompare(b.target ?? ''));
  return { scope: { start: new Date(scopeStart).toISOString(), end: new Date(scopeEnd).toISOString(), endExclusive: true as const },
    page: { start: new Date(cursor).toISOString(), end: new Date(end).toISOString(), endExclusive: true as const, pageDays, nextCursor: end < scopeEnd ? new Date(end).toISOString() : null },
    bodies: [...selected], kinds: [...selectedKinds], sampleHours: 6, events,
    limitations: ['逐 6 小时取样并在速度转向处补点与求根；结果按秒归属半开窗口，接近停滞的极端情况仍需独立核验。', '朔望和交食分别列出；交食为全球事件，不代表出生地可见。', '事件列表不等于现实事件或固定应期；须按 nextCursor 读取全部页面。'] };
}
