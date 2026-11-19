import type { z } from 'zod';
import type { qimenInput } from '../../schema';
import { generateQimen } from './chart';
import { createTimezoneOffsetReader } from '../huangji/civil-time';

type Settings = z.infer<typeof qimenInput>['qimen'];

export async function computeQimen(date: Date, settings: Settings, includeEvidence = true) {
  if (settings?.timeStandard === 'civil') {
    const offset = settings.timeZoneId ? createTimezoneOffsetReader(settings.timeZoneId)(date.getTime()) : settings.timezone;
    if (offset === undefined || !Number.isFinite(offset) || offset < -12 || offset > 14 || Math.abs(offset * 60 - Math.round(offset * 60)) >= 1e-8) throw new Error('地方时区须为 UTC-12 至 UTC+14 的整分钟偏移。');
    const data = generateQimen(date, settings.method, settings.scope, settings.juMethod, undefined, Math.round(offset * 60), settings.timeZoneId, { evidence: includeEvidence, centerPalace: settings.centerPalace, feipanMode: settings.feipanMode });
    data.civilTime = settings.timeZoneId ? { timeZoneId: settings.timeZoneId } : { timezone: settings.timezone };
    return data;
  }
  if (settings?.timeStandard !== 'true-solar') return generateQimen(date, settings?.method, settings?.scope, settings?.juMethod, undefined, 480, undefined, { evidence: includeEvidence, centerPalace: settings?.centerPalace, feipanMode: settings?.feipanMode });
  if (settings.longitude === undefined) throw new Error('真太阳时必须提供经度。');
  const { trueSolarTime } = await import('../astronomy/true-solar');
  const correction = trueSolarTime(date, settings.longitude);
  const data = generateQimen(new Date(correction.effectiveTimestamp), settings.method, settings.scope, settings.juMethod, date, 480, undefined, { evidence: includeEvidence, centerPalace: settings?.centerPalace, feipanMode: settings?.feipanMode });
  data.timeContext = {
    standard: 'true-solar', longitude: correction.longitude, referenceTimestamp: date.getTime(),
    longitudeCorrectionMinutes: correction.longitudeCorrectionMinutes,
    equationOfTimeMinutes: correction.equationOfTimeMinutes, totalCorrectionMinutes: correction.totalCorrectionMinutes,
  };
  return data;
}
