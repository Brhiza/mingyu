import { SolarTime } from 'tyme4ts';
import { TimeManager } from '../calendar/timeManager';

const promptTimeCache = new Map<string, string>();

type PromptTimeParts = ReturnType<typeof TimeManager.getWallClockParts>;

function getPromptTimeParts(date: Date): PromptTimeParts {
  return TimeManager.getWallClockParts(date);
}

function getCacheKey(parts: PromptTimeParts) {
  return [parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second].join('-');
}

function formatSolarTime(parts: PromptTimeParts) {
  return `公历：${parts.year}年${parts.month}月${parts.day}日 ${parts.hour}时${parts.minute}分（UTC+08:00）`;
}

function formatGanzhiCalendar(parts: PromptTimeParts) {
  const solarTime = SolarTime.fromYmdHms(
    parts.year,
    parts.month,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  const lunarHour = solarTime.getLunarHour();
  const lunarDay = lunarHour.getLunarDay();
  const eightChar = lunarHour.getEightChar();
  const lunarText = lunarDay.toString().replace(/^农历/, '');
  const lunarHourText = lunarHour.toString().replace(/^农历/, '');

  return [
    `农历：${lunarText} ${lunarHourText.slice(-2)}`,
    `干支历：${eightChar.getYear().getName()}年 ${eightChar.getMonth().getName()}月 ${eightChar.getDay().getName()}日 ${eightChar.getHour().getName()}时`,
    `当前节气：${solarTime.getTerm().getName()}`,
  ].join('\n');
}

export function formatPromptCurrentTime(date: Date = new Date()) {
  const parts = getPromptTimeParts(date);
  const cacheKey = getCacheKey(parts);
  const cached = promptTimeCache.get(cacheKey);
  if (cached) return cached;

  const solarText = formatSolarTime(parts);
  let text: string;
  try {
    text = [solarText, formatGanzhiCalendar(parts)].join('\n');
  } catch {
    text = [solarText, '干支历：暂无法计算'].join('\n');
  }

  promptTimeCache.clear();
  promptTimeCache.set(cacheKey, text);
  return text;
}
