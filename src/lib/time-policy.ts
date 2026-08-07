import { DEFAULT_CHINA_TIME_ZONE_ID } from 'mingyu-core/calendar';

export const FRONTEND_DEFAULT_TIME_ZONE_ID = DEFAULT_CHINA_TIME_ZONE_ID;

interface FrontendBirthTimeOptions {
  useTrueSolarTime?: boolean;
  timeZoneId?: string;
  applyChinaDst?: boolean;
}

/**
 * 网页端只采用一套默认时间策略：精准出生时间按中国历史时区自动解析；
 * 旧的中国夏令时开关只保留给 API 和核心包兼容调用，网页端始终关闭。
 */
export function applyFrontendBirthTimeDefaults<T extends FrontendBirthTimeOptions>(input: T): T {
  if (input.useTrueSolarTime !== true) {
    return {
      ...input,
      applyChinaDst: false,
    };
  }
  return {
    ...input,
    timeZoneId: input.timeZoneId?.trim() || FRONTEND_DEFAULT_TIME_ZONE_ID,
    applyChinaDst: false,
  };
}
