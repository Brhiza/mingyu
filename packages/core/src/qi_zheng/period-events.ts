/**
 * @file 七政流曜周期事件
 * @description 在流年或流月窗口内扫描换宫、停逆与精确吊照，不以单一时刻代替整段周期。
 */
import { getCivilDateTimeAtFixedOffset } from '../calendar/civil-time';
import { getHistoricalTimezoneOffsetAt } from '../calendar/historical-timezone';

const SIGN_BRANCHES = [
  '戌',
  '酉',
  '申',
  '未',
  '午',
  '巳',
  '辰',
  '卯',
  '寅',
  '丑',
  '子',
  '亥',
] as const;

type QizhengSignBranch = (typeof SIGN_BRANCHES)[number];

function getQizhengSignBranch(signIndex: number): QizhengSignBranch {
  return SIGN_BRANCHES[((signIndex % 12) + 12) % 12];
}

export interface QizhengNatalStarRef {
  name: string;
  longitude: number;
}

export type QizhengPeriodMode = 'yearly' | 'monthly' | 'daily';
export type QizhengPeriodEventKind = '精确吊照' | '停逆' | '换宫';

export interface QizhengLongitudeSample {
  name: string;
  longitude: number;
}

export interface QizhengPeriodEvent {
  key: string;
  kind: QizhengPeriodEventKind;
  utcMs: number;
  dateTime: string;
  promptText: string;
  movingStar: string;
  targetStar?: string;
  aspectType?: string;
  aspectDirection?: '正向' | '逆向';
  palace?: string;
  signBranch?: QizhengSignBranch;
  stationDirection?: '逆行' | '顺行';
}

export interface QizhengPeriodEventCollection {
  startDateTime: string;
  endDateTime: string;
  mode: QizhengPeriodMode;
  events: QizhengPeriodEvent[];
  axis: string[];
  windows: string[];
  promptText: string;
}

const ASPECTS = [
  { type: '同宫', angle: 0 },
  { type: '六合', angle: 60 },
  { type: '四正', angle: 90 },
  { type: '三方', angle: 120 },
  { type: '对照', angle: 180 },
] as const;

const YEARLY_STARS = ['太阳', '太白(金)', '荧惑(火)', '岁星(木)', '镇星(土)', '罗睺(火余)'];
const MONTHLY_STARS = [...YEARLY_STARS, '辰星(水)', '太阴'];

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function normalizeLongitude(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function wrap180(value: number) {
  const normalized = normalizeLongitude(value);
  return normalized > 180 ? normalized - 360 : normalized;
}

/** 只吸收浮点舍入误差，不把真正接近端点的事件扩展成端点事件。 */
function isNumericallyZero(value: number): boolean {
  return value === 0 || Math.abs(value) <= Number.EPSILON * Math.max(1, Math.abs(value));
}

function isLongitudeBoundary(value: number): boolean {
  const quotient = normalizeLongitude(value) / 30;
  return (
    Math.abs(quotient - Math.round(quotient)) <= Number.EPSILON * Math.max(1, Math.abs(quotient))
  );
}

function isWithinHalfOpenWindow(utcMs: number, startUtcMs: number, endUtcMs: number): boolean {
  return utcMs >= startUtcMs && utcMs < endUtcMs;
}

function formatUtc(utcMs: number, timezone: number, timeZoneId?: string) {
  const instant = new Date(utcMs);
  const actualTimezone = timeZoneId ? getHistoricalTimezoneOffsetAt(instant, timeZoneId) : timezone;
  const local = getCivilDateTimeAtFixedOffset(instant, actualTimezone);
  return `${local.year}-${pad(local.month)}-${pad(local.day)} ${pad(local.hour)}:${pad(local.minute)}`;
}

function signIndexOf(longitude: number) {
  return Math.floor(normalizeLongitude(longitude) / 30) % 12;
}

function bodiesForMode(mode: QizhengPeriodMode) {
  return mode === 'yearly' ? YEARLY_STARS : MONTHLY_STARS;
}

function stepMs(mode: QizhengPeriodMode) {
  if (mode === 'daily') return 60 * 60 * 1000;
  if (mode === 'monthly') return 12 * 60 * 60 * 1000;
  return 2 * 24 * 60 * 60 * 1000;
}

function refineCrossing(
  startUtc: number,
  endUtc: number,
  evaluate: (utcMs: number) => number,
): number {
  let left = startUtc;
  let right = endUtc;
  let leftValue = evaluate(left);
  for (let index = 0; index < 18; index += 1) {
    const mid = (left + right) / 2;
    const midValue = evaluate(mid);
    if (leftValue === 0) return left;
    if (Math.sign(leftValue) === Math.sign(midValue) || midValue === 0) {
      left = mid;
      leftValue = midValue;
    } else {
      right = mid;
    }
  }
  return (left + right) / 2;
}

function mapByName(samples: QizhengLongitudeSample[]) {
  return new Map(samples.map((item) => [item.name, item.longitude]));
}

export function scanQizhengPeriodEvents(params: {
  natalStars: QizhengNatalStarRef[];
  twelvePalaces: ReadonlyArray<{
    palace: string;
    signIndex: number;
    signBranch: QizhengSignBranch;
  }>;
  startUtcMs: number;
  endUtcMs: number;
  timezone: number;
  /** 有 IANA 时区时逐个事件按该时刻的历史偏移格式化，timezone 仅保留固定偏移兼容路径。 */
  timeZoneId?: string;
  mode: QizhengPeriodMode;
  sampleLongitudes: (utcMs: number) => QizhengLongitudeSample[];
}): QizhengPeriodEventCollection {
  const formatEventTime = (utcMs: number) => formatUtc(utcMs, params.timezone, params.timeZoneId);
  const startDateTime = formatEventTime(params.startUtcMs);
  const endDateTime = formatEventTime(params.endUtcMs);
  const bodies = bodiesForMode(params.mode);
  const natalTargets = params.natalStars.filter((star) =>
    params.mode === 'yearly' ? ['太阳', '太阴', '岁星(木)', '镇星(土)'].includes(star.name) : true,
  );
  const aspectKinds =
    params.mode === 'yearly'
      ? ASPECTS.filter(
          (item) => item.type === '同宫' || item.type === '对照' || item.type === '三方',
        )
      : ASPECTS;
  const palaceBySign = new Map(params.twelvePalaces.map((item) => [item.signIndex, item]));
  const events: QizhengPeriodEvent[] = [];
  const step = stepMs(params.mode);
  const times: number[] = [];
  for (let utc = params.startUtcMs; utc < params.endUtcMs; utc += step) times.push(utc);
  times.push(params.endUtcMs);
  const frames = times.map((utc) => ({ utc, map: mapByName(params.sampleLongitudes(utc)) }));
  const velocitySamples = new Map<number, Map<string, number>>();
  const velocityAt = (utc: number, name: string) => {
    const delta = 60_000;
    for (const time of [utc - delta, utc + delta]) {
      if (!velocitySamples.has(time)) {
        velocitySamples.set(time, mapByName(params.sampleLongitudes(time)));
      }
    }
    const before = velocitySamples.get(utc - delta)?.get(name);
    const after = velocitySamples.get(utc + delta)?.get(name);
    if (before === undefined || after === undefined) return undefined;
    const velocity = wrap180(after - before);
    return Math.abs(velocity) < 1e-10 ? 0 : velocity;
  };

  for (let index = 1; index < frames.length; index += 1) {
    const previousUtc = frames[index - 1].utc;
    const currentUtc = frames[index].utc;
    const previous = frames[index - 1].map;
    const current = frames[index].map;
    for (const name of bodies) {
      const before = previous.get(name);
      const after = current.get(name);
      if (before === undefined || after === undefined) continue;
      const beforeSign = signIndexOf(before);
      const afterSign = signIndexOf(after);
      const startsAtBoundary = isLongitudeBoundary(before);
      const entersBoundaryAtStart =
        startsAtBoundary && beforeSign === afterSign && wrap180(after - before) > 0;
      if (beforeSign !== afterSign || entersBoundaryAtStart) {
        // 终点样本可以用于发现跨越，但终点本身属于下一个半开区间；
        // 内部采样点仍须在当前窗口记录一次，下一段只依靠唯一键去重。
        const atExclusiveEnd = currentUtc === params.endUtcMs && isLongitudeBoundary(after);
        if (!atExclusiveEnd) {
          const crossing = isLongitudeBoundary(before)
            ? previousUtc
            : isLongitudeBoundary(after)
              ? currentUtc
              : refineCrossing(previousUtc, currentUtc, (value) => {
                  const sample = mapByName(params.sampleLongitudes(value)).get(name);
                  if (sample === undefined) return 0;
                  return signIndexOf(sample) === beforeSign ? -1 : 1;
                });
          const palace = palaceBySign.get(afterSign);
          if (isWithinHalfOpenWindow(crossing, params.startUtcMs, params.endUtcMs)) {
            events.push({
              key: `ingress:${name}:${afterSign}:${Math.round(crossing)}`,
              kind: '换宫',
              utcMs: crossing,
              dateTime: formatEventTime(crossing),
              movingStar: name,
              palace: palace?.palace,
              signBranch: palace?.signBranch ?? getQizhengSignBranch(afterSign),
              promptText: `${formatEventTime(crossing)} 换宫：流曜${name}换入本命${palace?.signBranch ?? getQizhengSignBranch(afterSign)}宫${palace?.palace ?? ''}`,
            });
          }
        }
      }
      const previousVelocity = velocityAt(previousUtc, name);
      const currentVelocity = velocityAt(currentUtc, name);
      if (previousVelocity !== undefined && currentVelocity !== undefined) {
        const leftVelocity =
          previousVelocity === 0 ? velocityAt(previousUtc - 60_000, name) : previousVelocity;
        const rightVelocity =
          currentVelocity === 0 ? velocityAt(currentUtc + 60_000, name) : currentVelocity;
        if (
          !(previousVelocity === 0 && index > 1) &&
          leftVelocity !== undefined &&
          rightVelocity !== undefined &&
          leftVelocity !== 0 &&
          rightVelocity !== 0 &&
          Math.sign(leftVelocity) !== Math.sign(rightVelocity)
        ) {
          const direction: '逆行' | '顺行' = rightVelocity < 0 ? '逆行' : '顺行';
          const crossing =
            previousVelocity === 0
              ? previousUtc
              : currentVelocity === 0
                ? currentUtc
                : refineCrossing(previousUtc, currentUtc, (value) => {
                    const velocity = velocityAt(value, name);
                    if (velocity === undefined) throw new Error(`停逆求根缺少${name}的黄经采样。`);
                    return velocity;
                  });
          if (isWithinHalfOpenWindow(crossing, params.startUtcMs, params.endUtcMs)) {
            events.push({
              key: `station:${name}:${direction}:${Math.round(crossing)}`,
              kind: '停逆',
              utcMs: crossing,
              dateTime: formatEventTime(crossing),
              movingStar: name,
              stationDirection: direction,
              promptText: `${formatEventTime(crossing)} 停逆：流曜${name}${direction === '逆行' ? '由顺转逆' : '由逆转顺'}`,
            });
          }
        }
      }
      for (const natal of natalTargets) {
        for (const aspect of aspectKinds) {
          const targets =
            aspect.angle === 0 || aspect.angle === 180
              ? [aspect.angle]
              : [aspect.angle, -aspect.angle];
          for (const target of targets) {
            const beforeWrapped = wrap180(wrap180(before - natal.longitude) - target);
            const afterWrapped = wrap180(wrap180(after - natal.longitude) - target);
            const startsAtBoundary = isNumericallyZero(beforeWrapped);
            const endsAtBoundary = isNumericallyZero(afterWrapped);
            if (
              Math.sign(beforeWrapped) === Math.sign(afterWrapped) ||
              (currentUtc === params.endUtcMs && endsAtBoundary) ||
              Math.abs(afterWrapped - beforeWrapped) >= 180
            )
              continue;
            const crossing = startsAtBoundary
              ? previousUtc
              : endsAtBoundary
                ? currentUtc
                : refineCrossing(previousUtc, currentUtc, (value) => {
                    const sample = mapByName(params.sampleLongitudes(value)).get(name);
                    if (sample === undefined) return 0;
                    return wrap180(wrap180(sample - natal.longitude) - target);
                  });
            if (isWithinHalfOpenWindow(crossing, params.startUtcMs, params.endUtcMs)) {
              const aspectDirection = target >= 0 ? '正向' : '逆向';
              events.push({
                key: `aspect:${name}:${natal.name}:${aspect.type}:${aspectDirection}:${Math.round(crossing)}`,
                kind: '精确吊照',
                utcMs: crossing,
                dateTime: formatEventTime(crossing),
                movingStar: name,
                targetStar: natal.name,
                aspectType: aspect.type,
                aspectDirection,
                promptText: `${formatEventTime(crossing)} 精确吊照：流曜${name}与本命${natal.name}成${aspect.type === '同宫' ? '合相' : aspect.type}（${aspectDirection}），目标角${aspect.angle}°`,
              });
            }
          }
        }
      }
    }
  }

  const unique = new Map<string, QizhengPeriodEvent>();
  for (const event of events.sort((left, right) => left.utcMs - right.utcMs)) {
    if (!unique.has(event.key)) unique.set(event.key, event);
  }
  const ordered = [...unique.values()];
  const stations = ordered.filter((item) => item.kind === '停逆');
  const natalPalaces = new Set(['命宫', '财帛', '官禄', '妻妾']);
  const palaceHits = ordered.filter(
    (item) => item.kind === '换宫' && item.palace && natalPalaces.has(item.palace),
  );
  const tightAspects = ordered.filter(
    (item) =>
      item.kind === '精确吊照' &&
      (item.aspectType === '同宫' || item.aspectType === '对照' || item.aspectType === '三方'),
  );
  const priorityEvents = [...stations, ...palaceHits, ...tightAspects];
  const axis = priorityEvents
    .slice(0, 12)
    .sort((left, right) => left.utcMs - right.utcMs)
    .map((item) => item.promptText);
  const windows = clusterWindows(ordered).slice(0, 8);
  const axisSummary = formatAxisSummary(priorityEvents, ordered.length);
  const promptText = [
    `范围：${startDateTime} 至 ${endDateTime}`,
    axisSummary
      ? `周期主轴：${axisSummary}`
      : '周期主轴：本窗口未见停逆、换入重点宫或精确合相对照三方',
    windows.length ? `关键窗口：${windows.join('；')}` : '',
    ordered.length
      ? `完整明细：\n${ordered.map((item) => item.promptText).join('\n')}`
      : '完整明细：本窗口未见换宫、停逆或精确吊照',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    startDateTime,
    endDateTime,
    mode: params.mode,
    events: ordered,
    axis,
    windows,
    promptText,
  };
}

function clusterWindows(events: QizhengPeriodEvent[]) {
  if (!events.length) return [];
  const day = 24 * 60 * 60 * 1000;
  const groups: QizhengPeriodEvent[][] = [];
  let current: QizhengPeriodEvent[] = [];
  for (const event of events) {
    const last = current.at(-1);
    if (!last || event.utcMs - last.utcMs <= 5 * day) {
      current.push(event);
    } else {
      groups.push(current);
      current = [event];
    }
  }
  if (current.length) groups.push(current);
  return groups
    .filter((group) => group.length >= 2)
    .sort((left, right) => right.length - left.length)
    .map((group) => {
      const kindCounts = [...new Set(group.map((item) => item.kind))]
        .map((kind) => `${kind}${group.filter((item) => item.kind === kind).length}项`)
        .join('、');
      const stars = [...new Set(group.map((item) => item.movingStar))].join('、');
      return `${group[0].dateTime}至${group.at(-1)?.dateTime}（${group.length}项：${kindCounts}${stars ? `；涉及${stars}` : ''}）`;
    });
}

function formatAxisSummary(events: QizhengPeriodEvent[], total: number) {
  const unique = [...new Map(events.map((item) => [item.key, item])).values()];
  if (!unique.length) return '';
  const labels = unique
    .slice(0, 12)
    .sort((left, right) => left.utcMs - right.utcMs)
    .map((item) => {
      if (item.kind === '停逆') {
        return `${item.dateTime}停逆${item.movingStar}${item.stationDirection ? `（${item.stationDirection}）` : ''}`;
      }
      if (item.kind === '换宫') {
        return `${item.dateTime}换宫${item.movingStar}入${item.signBranch ?? ''}宫${item.palace ?? '宫位未记录'}`;
      }
      return `${item.dateTime}吊照${item.movingStar}与${item.targetStar ?? '本命目标'}${item.aspectType ? `成${item.aspectType}` : ''}${item.aspectDirection ? `（${item.aspectDirection}）` : ''}`;
    });
  const suffix =
    labels.length < unique.length
      ? `；主轴列${labels.length}项，完整明细共${total}项`
      : `；共${total}项`;
  return `${labels.join('；')}${suffix}`;
}
