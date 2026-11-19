import { createTimezoneOffsetReader, formatFixedTimezoneOffset, getCivilDateTimeAtFixedOffset } from '../huangji/civil-time';
import { sampleLongitudes } from './positions';

type Mode = 'yearly' | 'monthly' | 'daily';
type Natal = { name: string; longitude: number };
type Palace = { palace: string; signIndex: number; signBranch: string };
export type PeriodEvent = { kind: '换宫' | '停逆' | '精确吊照'; utcTimestamp: number; localDateTime: string; timezone: number; movingStar: string;
  signBranch?: string; palace?: string; stationDirection?: '顺行' | '逆行'; targetStar?: string; aspectType?: string; aspectDirection?: '正向' | '逆向'; text: string };
type Sampler = (timestamp: number, names: readonly string[]) => Array<{ name: string; longitude: number }>;
const annualBodies = ['太阳', '太白(金)', '荧惑(火)', '岁星(木)', '镇星(土)', '罗睺(火余)'];
const otherBodies = [...annualBodies, '辰星(水)', '太阴'];
const aspectRules = [{ type: '同宫', angle: 0 }, { type: '六合', angle: 60 }, { type: '四正', angle: 90 }, { type: '三方', angle: 120 }, { type: '对照', angle: 180 }] as const;
const signBranches = [...'戌酉申未午巳辰卯寅丑子亥'];
const normalize = (value: number) => ((value % 360) + 360) % 360;
const wrap = (value: number) => { const angle = normalize(value); return angle > 180 ? angle - 360 : angle; };
const signIndex = (value: number) => Math.floor(normalize(value) / 30) % 12;
const nearZero = (value: number) => Math.abs(value) <= Number.EPSILON * Math.max(1, Math.abs(value));
const isSignBoundary = (value: number) => nearZero(normalize(value) / 30 - Math.round(normalize(value) / 30));

/** 只缓存精确时刻的星位；缓存有界且由一次请求持有。 */
export function createPeriodSampleCache(sample: Sampler = sampleLongitudes) {
  const cache = new Map<number, Map<string, number>>();
  return (timestamp: number, names: readonly string[]): ReadonlyMap<string, number> => {
    let data = cache.get(timestamp);
    if (!data) { if (cache.size >= 12_000) cache.delete(cache.keys().next().value!); data = new Map(); cache.set(timestamp, data); }
    const missing = names.filter((name) => !data!.has(name));
    if (missing.length) for (const point of sample(timestamp, missing)) data.set(point.name, point.longitude);
    for (const name of names) if (!Number.isFinite(data.get(name))) throw new Error(`周期扫描缺少${name}的有效黄经。`);
    return data;
  };
}
export type PeriodSampleCache = ReturnType<typeof createPeriodSampleCache>;

/** 周期扫描只使用半开窗口；求根后以秒为分辨率记录，不声称亚秒精度。 */
export function scanPeriodEvents(input: { startUtcMs: number; endUtcMs: number; mode: Mode; timezone: number; timeZoneId?: string; natalStars: Natal[]; palaces: Palace[]; sample?: Sampler }, sharedSamples?: PeriodSampleCache) {
  if (!Number.isFinite(input.startUtcMs) || !Number.isFinite(input.endUtcMs) || input.startUtcMs >= input.endUtcMs || input.endUtcMs - input.startUtcMs > 370 * 86_400_000) throw new Error('七政周期窗口无效或超过一年。');
  if (input.palaces.length !== 12 || input.natalStars.some((star) => !Number.isFinite(star.longitude))) throw new Error('周期扫描需要完整本命宫位及有效星曜黄经。');
  const moving = input.mode === 'yearly' ? annualBodies : otherBodies;
  const natal = input.mode === 'yearly' ? input.natalStars.filter((star) => ['太阳', '太阴', '岁星(木)', '镇星(土)'].includes(star.name)) : input.natalStars;
  const rules = input.mode === 'yearly' ? aspectRules.filter((item) => ['同宫', '三方', '对照'].includes(item.type)) : aspectRules;
  const at = input.sample ? createPeriodSampleCache(input.sample) : sharedSamples ?? createPeriodSampleCache();
  const velocity = (timestamp: number, name: string) => {
    const delta = 60_000, before = at(timestamp - delta, [name]).get(name)!, after = at(timestamp + delta, [name]).get(name)!;
    const speed = wrap(after - before);
    return Math.abs(speed) < 1e-10 ? 0 : speed;
  };
  const root = (start: number, end: number, evaluate: (timestamp: number) => number) => {
    let left = start, right = end, leftValue = evaluate(left);
    if (nearZero(leftValue)) return left;
    if (nearZero(evaluate(right))) return right;
    for (let i = 0; i < 32; i++) {
      if (nearZero(leftValue)) return left;
      const mid = (left + right) / 2, value = evaluate(mid);
      if (mid === left || mid === right) break;
      if (Math.sign(leftValue) === Math.sign(value) || nearZero(value)) { left = mid; leftValue = value; } else right = mid;
    }
    return right;
  };
  const step = input.mode === 'yearly' ? 2 * 86_400_000 : input.mode === 'monthly' ? 12 * 3_600_000 : 3_600_000;
  const times: number[] = [];
  for (let timestamp = input.startUtcMs; timestamp < input.endUtcMs; timestamp += step) times.push(timestamp);
  times.push(input.endUtcMs);
  const stations: Array<{ name: string; at: number; direction: '顺行' | '逆行' }> = [];
  for (let i = 1; i < times.length; i++) for (const name of moving) {
    const left = times[i - 1], right = times[i];
    const a = velocity(left, name), b = velocity(right, name), before = a === 0 ? velocity(left - 60_000, name) : a, after = b === 0 ? velocity(right + 60_000, name) : b;
    if (before === 0 || after === 0 || Math.sign(before) === Math.sign(after)) continue;
    const crossing = a === 0 ? left : b === 0 ? right : root(left, right, (time) => velocity(time, name));
    if (crossing >= input.startUtcMs && crossing < input.endUtcMs) stations.push({ name, at: crossing, direction: after < 0 ? '逆行' : '顺行' });
  }
  const frames = [...new Set([...times, ...stations.map((station) => station.at)])].sort((a, b) => a - b);
  const offsetAt = input.timeZoneId ? createTimezoneOffsetReader(input.timeZoneId) : () => input.timezone;
  const describeTime = (timestamp: number) => {
    const timezone = offsetAt(timestamp), local = getCivilDateTimeAtFixedOffset(new Date(timestamp), timezone);
    const pad = (value: number) => String(value).padStart(2, '0');
    return { timezone, localDateTime: `${local.year}-${pad(local.month)}-${pad(local.day)}T${pad(local.hour)}:${pad(local.minute)}:${pad(local.second)}` };
  };
  const eventTime = (raw: number) => Math.floor(raw / 1000) * 1000;
  const events: PeriodEvent[] = [];
  const add = (raw: number, event: Omit<PeriodEvent, 'utcTimestamp' | 'localDateTime' | 'timezone' | 'text'>, text: string) => {
    if (raw < input.startUtcMs || raw >= input.endUtcMs) return;
    const utcTimestamp = eventTime(raw), time = describeTime(utcTimestamp);
    events.push({ ...event, utcTimestamp, ...time, text: `${time.localDateTime} UTC${formatFixedTimezoneOffset(time.timezone)} ${text}` });
  };
  for (const station of stations) add(station.at, { kind: '停逆', movingStar: station.name, stationDirection: station.direction }, `流曜${station.name}${station.direction === '逆行' ? '由顺转逆' : '由逆转顺'}`);
  for (let i = 1; i < frames.length; i++) {
    const left = frames[i - 1], right = frames[i], beforeFrame = at(left, moving), afterFrame = at(right, moving);
    for (const name of moving) {
      const before = beforeFrame.get(name)!, after = afterFrame.get(name)!, beforeSign = signIndex(before), afterSign = signIndex(after);
      const entersAtStart = isSignBoundary(before) && beforeSign === afterSign && wrap(after - before) > 0;
      if ((beforeSign !== afterSign || entersAtStart) && !(right === input.endUtcMs && isSignBoundary(after))) {
        const crossing = isSignBoundary(before) ? left : isSignBoundary(after) ? right : root(left, right, (time) => signIndex(at(time, [name]).get(name)!) === beforeSign ? -1 : 1);
        const preSign = signIndex(at(crossing - 2000, [name]).get(name)!), postSign = signIndex(at(crossing + 2000, [name]).get(name)!);
        if (preSign !== postSign) {
          const palace = input.palaces.find((item) => item.signIndex === postSign), branch = palace?.signBranch ?? signBranches[postSign];
          add(crossing, { kind: '换宫', movingStar: name, signBranch: branch, ...(palace ? { palace: palace.palace } : {}) }, `流曜${name}换入本命${branch}宫${palace?.palace ?? ''}`);
        }
      }
      for (const target of natal) for (const rule of rules) for (const angle of rule.angle === 0 || rule.angle === 180 ? [rule.angle] : [rule.angle, -rule.angle]) {
        const residual = (value: number) => wrap(wrap(value - target.longitude) - angle);
        const a = residual(before), b = residual(after);
        if (Math.sign(a) === Math.sign(b) || (right === input.endUtcMs && nearZero(b)) || Math.abs(b - a) >= 180) continue;
        const crossing = nearZero(a) ? left : nearZero(b) ? right : root(left, right, (time) => residual(at(time, [name]).get(name)!));
        const direction = angle >= 0 ? '正向' as const : '逆向' as const;
        add(crossing, { kind: '精确吊照', movingStar: name, targetStar: target.name, aspectType: rule.type, aspectDirection: direction }, `流曜${name}与本命${target.name}成${rule.type === '同宫' ? '合相' : rule.type}（${direction}），目标角${rule.angle}°`);
      }
    }
  }
  const unique = new Map<string, PeriodEvent>();
  for (const event of events.sort((a, b) => a.utcTimestamp - b.utcTimestamp)) {
    const key = [event.kind, event.movingStar, event.targetStar, event.aspectType, event.aspectDirection, event.stationDirection, event.signBranch, event.utcTimestamp].join(':');
    if (!unique.has(key)) unique.set(key, event);
  }
  const ordered = [...unique.values()];
  const groups: PeriodEvent[][] = [];
  for (const event of ordered) {
    const group = groups.at(-1), last = group?.at(-1);
    if (group && last && event.utcTimestamp - last.utcTimestamp <= 5 * 86_400_000) group.push(event);
    else groups.push([event]);
  }
  const windows = groups.filter((group) => group.length >= 2).map((group) => ({ startUtcMs: group[0].utcTimestamp, endUtcMs: group.at(-1)!.utcTimestamp,
    count: group.length, kinds: [...new Set(group.map((event) => event.kind))].map((kind) => ({ kind, count: group.filter((event) => event.kind === kind).length })),
    movingStars: [...new Set(group.map((event) => event.movingStar))] })).sort((a, b) => b.count - a.count || a.startUtcMs - b.startUtcMs).slice(0, 8);
  return { mode: input.mode, startUtcMs: input.startUtcMs, endUtcMs: input.endUtcMs, endExclusive: true as const,
    movingStars: [...moving], natalStars: natal.map((star) => star.name), aspectTypes: rules.map((rule) => rule.type), events: ordered, windows,
    limitation: '按固定采样步长扫描所列星曜及相位，事件时刻以秒为分辨率；窗口按相邻事件不超过五日串联，不是现实应期。未列星曜或相位不代表无事件，也不保证现实结果。' };
}
