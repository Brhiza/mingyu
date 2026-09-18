import type { QimenLifetimeData, QimenLifetimeInput } from '../../../../types/divination';
import { validateBirthProfileTimeRange } from '../../../../profile/time-range';
import { getCivilDateTimeAtFixedOffset } from '../../../../calendar/civil-time';
import { normalizeQimenLifetimeTime } from './lifetime-time';

/** 终身局阶段起止可随出生秒变化，逐秒续取保留完整结果而不合并成代表盘。 */
export function selectQimenLifetimeBirthSample(input: QimenLifetimeInput): {
  pointInput: QimenLifetimeInput;
  birthRange: NonNullable<QimenLifetimeData['birthRange']>;
} {
  if (!input.birthTimeRange) throw new RangeError('奇门终身局缺少完整出生区间。');
  if (
    input.calendarType === 'lunar' ||
    input.timeStandard === 'trueSolar' ||
    input.applyChinaDst === true ||
    input.timeZoneId !== undefined ||
    (input.timezone !== undefined && input.timezone !== 8)
  ) {
    throw new RangeError(
      '奇门终身局出生范围必须使用公历标准北京时间和法定民用时，夏令时保持关闭。',
    );
  }
  const normalized = normalizeQimenLifetimeTime(input);
  if (normalized.timezoneOffsetMinutes !== 480) {
    throw new RangeError('奇门终身局出生范围必须使用标准北京时间。');
  }
  const source = validateBirthProfileTimeRange(
    {
      gender: input.gender === 'male' || input.gender === 'female' ? input.gender : 'unspecified',
      calendarType: input.calendarType ?? 'solar',
      ...normalized.calculationParts,
      useTrueSolarTime: false,
      applyChinaDst: false,
    },
    input.birthTimeRange,
  );
  const totalSamples = (source.endTimestamp - source.startTimestamp) / 1000;
  const index = input.birthRangeIndex ?? 0;
  if (!Number.isSafeInteger(index) || index < 0 || index >= totalSamples) {
    throw new RangeError('奇门终身局出生范围索引超出可用整秒范围。');
  }
  const timestamp = source.startTimestamp + index * 1000;
  const parts = getCivilDateTimeAtFixedOffset(new Date(timestamp), 8);
  const pad = (value: number) => String(value).padStart(2, '0');
  const { birthTimeRange: _range, birthRangeIndex: _index, ...pointInput } = input;
  return {
    pointInput: {
      ...pointInput,
      birthDateTime: `${String(parts.year).padStart(4, '0')}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`,
    },
    birthRange: {
      source,
      index,
      timestamp,
      totalSamples,
      nextIndex: index + 1 < totalSamples ? index + 1 : null,
    },
  };
}
