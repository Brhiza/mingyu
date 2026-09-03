/**
 * @file 七政流曜周期事件
 * @description 在流年或流月窗口内扫描换宫、停逆与精确吊照，不以单一时刻代替整段周期。
 */
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

function formatUtc(utcMs: number, timezone: number) {
  const shifted = new Date(utcMs + timezone * 3_600_000);
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())} ${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`;
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
  mode: QizhengPeriodMode;
  sampleLongitudes: (utcMs: number) => QizhengLongitudeSample[];
}): QizhengPeriodEventCollection {
  const startDateTime = formatUtc(params.startUtcMs, params.timezone);
  const endDateTime = formatUtc(params.endUtcMs, params.timezone);
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

  for (let index = 1; index < frames.length; index += 1) {
    const previousUtc = frames[index - 1].utc;
    const currentUtc = frames[index].utc;
    const previous = frames[index - 1].map;
    const current = frames[index].map;
    const earlier = index >= 2 ? frames[index - 2].map : undefined;
    for (const name of bodies) {
      const before = previous.get(name);
      const after = current.get(name);
      if (before === undefined || after === undefined) continue;
      const beforeSign = signIndexOf(before);
      const afterSign = signIndexOf(after);
      if (beforeSign !== afterSign) {
        const crossing = refineCrossing(previousUtc, currentUtc, (value) => {
          const sample = mapByName(params.sampleLongitudes(value)).get(name);
          if (sample === undefined) return 0;
          return signIndexOf(sample) === beforeSign ? -1 : 1;
        });
        const palace = palaceBySign.get(afterSign);
        events.push({
          key: `ingress:${name}:${afterSign}:${Math.round(crossing)}`,
          kind: '换宫',
          utcMs: crossing,
          dateTime: formatUtc(crossing, params.timezone),
          movingStar: name,
          palace: palace?.palace,
          signBranch: palace?.signBranch ?? getQizhengSignBranch(afterSign),
          promptText: `${formatUtc(crossing, params.timezone)} 流曜${name}换入${palace?.signBranch ?? getQizhengSignBranch(afterSign)}宫${palace?.palace ?? ''}`,
        });
      }
      const beforeSpeed = wrap180(after - before);
      if (earlier) {
        const earlierLon = earlier.get(name);
        if (earlierLon !== undefined) {
          const earlierSpeed = wrap180(before - earlierLon);
          if (
            Math.sign(earlierSpeed) !== 0 &&
            Math.sign(beforeSpeed) !== 0 &&
            Math.sign(earlierSpeed) !== Math.sign(beforeSpeed)
          ) {
            const direction: '逆行' | '顺行' = beforeSpeed < 0 ? '逆行' : '顺行';
            const crossing = refineCrossing(previousUtc, currentUtc, (value) => {
              const mid = mapByName(params.sampleLongitudes(value)).get(name);
              const prev = mapByName(params.sampleLongitudes(value - step / 4)).get(name);
              if (mid === undefined || prev === undefined) return 0;
              return wrap180(mid - prev);
            });
            events.push({
              key: `station:${name}:${direction}:${Math.round(crossing)}`,
              kind: '停逆',
              utcMs: crossing,
              dateTime: formatUtc(crossing, params.timezone),
              movingStar: name,
              stationDirection: direction,
              promptText: `${formatUtc(crossing, params.timezone)} 流曜${name}${direction === '逆行' ? '由顺转逆' : '由逆转顺'}`,
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
            if (Math.sign(beforeWrapped) === Math.sign(afterWrapped) || beforeWrapped === 0)
              continue;
            const crossing = refineCrossing(previousUtc, currentUtc, (value) => {
              const sample = mapByName(params.sampleLongitudes(value)).get(name);
              if (sample === undefined) return 0;
              return wrap180(wrap180(sample - natal.longitude) - target);
            });
            events.push({
              key: `aspect:${name}:${natal.name}:${aspect.type}:${Math.round(crossing)}`,
              kind: '精确吊照',
              utcMs: crossing,
              dateTime: formatUtc(crossing, params.timezone),
              movingStar: name,
              targetStar: natal.name,
              aspectType: aspect.type,
              promptText: `${formatUtc(crossing, params.timezone)} 流曜${name}与本命${natal.name}成${aspect.type}`,
            });
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
  const axis = [...stations, ...palaceHits, ...tightAspects]
    .slice(0, 12)
    .map((item) => item.promptText);
  const windows = clusterWindows(ordered).slice(0, 8);
  const promptText = [
    `范围：${startDateTime} 至 ${endDateTime}`,
    axis.length
      ? `周期主轴：${axis.join('；')}`
      : '周期主轴：本窗口未见停逆、换入重点宫或精确同宫对照三方',
    windows.length ? `关键窗口：${windows.join('；')}` : '',
    ordered.length
      ? `完整明细：${ordered.map((item) => item.promptText).join('；')}`
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
    .map(
      (group) =>
        `${group[0].dateTime}至${group.at(-1)?.dateTime}（${group.length}项：${group
          .slice(0, 4)
          .map((item) => item.promptText.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} /, ''))
          .join('、')}）`,
    );
}
