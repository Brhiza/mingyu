import type { z } from 'zod';
import type { calendarInput } from '../schema';
import { sameJsonValue } from '../json-value';
import { correctBirthClock, resolveBirthClock } from './birth-time';
import { formatCivilDateTime, getCivilDateTimeAtFixedOffset } from './huangji/civil-time';

type Input = z.infer<typeof calendarInput>;
type Request = Input['calendar'];

function lunarPhase(event: { name: string; utcTimestamp: number; utcDateTime: string; residualDegrees: number }) {
  return { name: event.name, utcTimestamp: event.utcTimestamp, utcDateTime: event.utcDateTime, residualDegrees: event.residualDegrees };
}

async function compute(request: Request) {
  if (request.kind === 'solar-term') {
    const { calculateSolarTermEvidence, calculateSolarTermsForYear } = await import('./astronomy/solar-term-evidence');
    const entries = request.index === undefined ? calculateSolarTermsForYear(request.year) : [calculateSolarTermEvidence(request.year, request.index)];
    const terms = entries.map((term) => ({ name: term.name, index: term.index, isJie: term.isJie, targetLongitudeDegrees: term.targetLongitudeDegrees,
      utcTimestamp: term.utcTimestamp, utcDateTime: term.utcDateTime, modelRootUtcDateTime: term.modelRootUtcDateTime,
      modelDifferenceSeconds: term.seedDifferenceSeconds, adoptedLongitudeResidualDegrees: term.residualDegrees }));
    return { input: { calendar: request }, result: { kind: request.kind, terms }, limitations: [
      '排盘采用精密节气历表；太阳视黄经低阶模型仅作交叉核验，不覆盖历表。',
      '数值求根到秒不等于观测级精度；单项索引 0 为序列起点冬至，通常位于上一公历年。',
    ] };
  }
  if (request.kind === 'moon-phase') {
    const { calculateCivilMoonPhaseEvidence } = await import('./astronomy/moon-phase-evidence');
    const moon = calculateCivilMoonPhaseEvidence(Date.parse(request.at));
    return { input: { calendar: request }, result: { kind: request.kind, utcDateTime: moon.utcDateTime, julianDayUtc: moon.julianDayUtc,
      sunLongitudeDegrees: moon.sunLongitudeDegrees, moonLongitudeDegrees: moon.moonLongitudeDegrees, phaseAngleDegrees: moon.phaseAngleDegrees,
      elongationDegrees: moon.elongationDegrees, illuminationFraction: moon.illuminationFraction, waxing: moon.waxing, eightPhaseName: moon.eightPhaseName,
      approximateMoonAgeDays: moon.approximateMoonAgeDays, previousPrincipalPhase: lunarPhase(moon.previousPrincipalPhase),
      nextPrincipalPhase: lunarPhase(moon.nextPrincipalPhase), ...(moon.currentPrincipalPhase ? { currentPrincipalPhase: lunarPhase(moon.currentPrincipalPhase) } : {}) },
      limitations: ['日月地心位置来自 Caelus 星历；月龄为平均朔望月近似。', '前后四正月相为数值求根结果，不表示当地可见性或月食。'] };
  }
  if (request.kind === 'true-solar') {
    const birth = { ...request.birth, second: request.birth.second ?? 0, timeStandard: 'true-solar' as const, longitude: request.longitude };
    const resolved = resolveBirthClock(birth), corrected = await correctBirthClock(birth, resolved);
    const solar = getCivilDateTimeAtFixedOffset(new Date(corrected.timestamp), resolved.timezone);
    const civil = resolved.localTime;
    const dayChange = Math.sign(Date.UTC(solar.year, solar.month - 1, solar.day) - Date.UTC(civil.year, civil.month - 1, civil.day));
    return { input: { calendar: request }, result: { kind: request.kind, utcDateTime: resolved.utcDateTime, localDateTime: resolved.localDateTime,
      timezone: resolved.timezone, timeZoneId: birth.timeZoneId ?? null, trueSolarDateTime: formatCivilDateTime(solar), dayChange,
      shichenIndex: Math.floor(((solar.hour + 1) % 24) / 2), correction: corrected.correction },
      limitations: ['真太阳时由经度与均时差修正民用钟表，不改变实际 UTC 瞬时。', '固定时区不自动套用历史夏令时；IANA 重复时刻须用固定偏移消歧。', '没有提供真实经度时不能以所在地名称猜测。'] };
  }
  const clock = { ...request.time, second: request.time.second ?? 0 };
  const resolved = resolveBirthClock(clock), timestamp = resolved.utcTimestamp;
  if (request.kind === 'time-scales') {
    const { estimateDeltaTSeconds } = await import('./astronomy/delta-t');
    const date = new Date(timestamp), year = date.getUTCFullYear(), yearStart = Date.UTC(year, 0, 1), yearEnd = Date.UTC(year + 1, 0, 1);
    const decimalYear = year + (timestamp - yearStart) / (yearEnd - yearStart);
    const deltaTSeconds = estimateDeltaTSeconds(decimalYear), julianDayUtc = timestamp / 86_400_000 + 2_440_587.5;
    return { input: { calendar: request }, result: { kind: request.kind, localDateTime: resolved.localDateTime, timezone: resolved.timezone,
      timeZoneId: clock.timeZoneId ?? null, utcDateTime: resolved.utcDateTime, utcTimestamp: timestamp, julianDayUtc,
      approximateJulianDayUt1: julianDayUtc, deltaTSeconds, approximateJulianDayTt: julianDayUtc + deltaTSeconds / 86400 },
      limitations: ['未读取实测 DUT1；以 UTC 近似 UT1，再使用 NASA/Espenak–Meeus 分段多项式估算 ΔT，所得 TT 仅为近似。',
        '历史日期使用推算的民用时间与 UTC；闰秒和历史授时细节未单独建模。'] };
  }
  const { solarIllumination } = await import('./astronomy/solar-illumination');
  const illumination = solarIllumination({ timestamp, year: resolved.localTime.year, month: resolved.localTime.month, day: resolved.localTime.day,
    latitude: request.latitude, longitude: request.longitude, timezone: resolved.timezone, timeZoneId: clock.timeZoneId });
  const { solarNoons } = await import('./astronomy/solar-noon');
  const apparentSolarNoons = solarNoons(illumination.window.startUtcMs, illumination.window.endUtcMs, request.latitude, request.longitude, resolved.timezone, clock.timeZoneId);
  return { input: { calendar: request }, result: { kind: request.kind, utcDateTime: resolved.utcDateTime, localDateTime: resolved.localDateTime,
    timezone: resolved.timezone, latitude: request.latitude, longitude: request.longitude, ...illumination, apparentSolarNoons },
    limitations: [illumination.limitation, '视太阳正午为太阳上中天，极夜时不表示太阳可见。曙暮光、日出日落和太阳正午按当地民用日列出全部交点。'] };
}
type Data = Awaited<ReturnType<typeof compute>>;
function shortUtc(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d{3}Z$/u, ' UTC').replace(/Z$/u, ' UTC');
}

function shortLocal(iso: string): string {
  return iso.replace('T', ' ');
}

function formatCalendarResult(res: Data['result']): string {
  if (res.kind === 'solar-term') {
    return res.terms.map((t) => {
      const bj = shortLocal(formatCivilDateTime(getCivilDateTimeAtFixedOffset(new Date(t.utcTimestamp), 8)));
      return `${t.index}. ${t.name}（${t.isJie ? '节' : '中气'}，太阳视黄经 ${t.targetLongitudeDegrees}°）：北京时间 ${bj}｜${shortUtc(t.utcDateTime)}`;
    }).join('\n');
  }
  if (res.kind === 'moon-phase') {
    return [
      `观测瞬时：${shortUtc(res.utcDateTime)}（儒略日 ${res.julianDayUtc.toFixed(6)}）`,
      `月相状态：${res.eightPhaseName}（${res.waxing ? '盈' : '亏'}），月相角 ${res.phaseAngleDegrees.toFixed(2)}°，日月黄经差 ${res.elongationDegrees.toFixed(2)}°，月面照明 ${(res.illuminationFraction * 100).toFixed(2)}%，朔望月龄 ${res.approximateMoonAgeDays.toFixed(2)} 日`,
      `黄经位置：太阳 ${res.sunLongitudeDegrees.toFixed(4)}°，太阴 ${res.moonLongitudeDegrees.toFixed(4)}°`,
      `前后四正：前一四正 ${res.previousPrincipalPhase.name}（${shortUtc(res.previousPrincipalPhase.utcDateTime)}）${res.currentPrincipalPhase ? `；当前四正 ${res.currentPrincipalPhase.name}（${shortUtc(res.currentPrincipalPhase.utcDateTime)}）` : ''}；下一四正 ${res.nextPrincipalPhase.name}（${shortUtc(res.nextPrincipalPhase.utcDateTime)}）`,
    ].join('\n');
  }
  if (res.kind === 'true-solar') {
    return [
      `当地民用时间：${shortLocal(res.localDateTime)}（UTC${res.timezone >= 0 ? '+' : ''}${res.timezone}${res.timeZoneId ? `，${res.timeZoneId}` : ''}）；真实瞬时 ${shortUtc(res.utcDateTime)}`,
      `真太阳时钟表：${shortLocal(res.trueSolarDateTime)}（跨日偏移：${res.dayChange === 0 ? '同日' : res.dayChange > 0 ? '进一日' : '退一日'}；对应时辰索引：${res.shichenIndex}）`,
      res.correction ? `修正明细：经度 ${res.correction.longitude}°，经度修正 ${res.correction.longitudeCorrectionMinutes.toFixed(3)} 分钟，均时差 ${res.correction.equationOfTimeMinutes.toFixed(3)} 分钟，合计修正 ${res.correction.totalCorrectionMinutes.toFixed(3)} 分钟` : '',
    ].filter(Boolean).join('\n');
  }
  if (res.kind === 'time-scales') {
    return [
      `当地民用时间：${shortLocal(res.localDateTime)}（UTC${res.timezone >= 0 ? '+' : ''}${res.timezone}${res.timeZoneId ? `，${res.timeZoneId}` : ''}）；${shortUtc(res.utcDateTime)}`,
      `儒略日（JD_UTC / 近似 JD_UT1）：${res.julianDayUtc.toFixed(8)}`,
      `地球自转参数估算 ΔT：${res.deltaTSeconds.toFixed(3)} 秒；近似地球力学时儒略日（JD_TT）：${res.approximateJulianDayTt.toFixed(8)}`,
    ].join('\n');
  }
  const events = [res.sunriseSunset, res.civilTwilight, res.nauticalTwilight, res.astronomicalTwilight].map(
    (item) => `${item.name}（阈值 ${item.threshold}°）：${item.crossings.length ? item.crossings.map((c) => `${c.direction} ${shortLocal(c.localDateTime)}（UTC${c.timezone >= 0 ? '+' : ''}${c.timezone}）`).join('、') : item.status}`,
  );
  return [
    `观测地时间：${shortLocal(res.localDateTime)}（UTC${res.timezone >= 0 ? '+' : ''}${res.timezone}），纬度 ${res.latitude}°，经度 ${res.longitude}°；昼夜状态：${res.daylight ? '白昼' : '夜晚'}`,
    `太阳几何高度角：${res.sun.geometricAltitudeDegrees.toFixed(3)}°，方位角：${res.sun.azimuthDegrees.toFixed(3)}°`,
    `视太阳正午（上中天）：${res.apparentSolarNoons.map((n) => `${shortLocal(n.localDateTime)}（${shortUtc(n.utcDateTime)}）`).join('、') || '无'}`,
    ...events,
  ].join('\n');
}
function render(data: Data, question: string) {
  const text = [`【历法与天文资料】\n${formatCalendarResult(data.result)}`, `【计算限制】\n${data.limitations.join('\n')}`,
    `【任务】\n依据已计算资料回答；区分真实瞬时、当地钟表和近似模型，不补造未计算的位置或精度。`, `【问题】\n${question}`].join('\n\n');
  return { text };
}
export async function calendarTool(input: Input) {
  const data = await compute(input.calendar), question = input.question?.trim() || '请解释这些历法与天文资料。';
  const labels = { 'solar-term': '节气', 'moon-phase': '月相', 'time-scales': '天文时间尺度', 'true-solar': '真太阳时', 'solar-illumination': '太阳光照' };
  return { data, summary: { title: '历法与天文资料', lines: [labels[data.result.kind]] }, prompt: render(data, question) };
}
export async function promptForCalendar(data: unknown, input: Input, question: string) {
  const expected = await compute(input.calendar);
  if (!sameJsonValue(data, expected, 1e-9)) throw new Error('历法结果与保存的输入不一致。');
  return render(expected, question);
}
