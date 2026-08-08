import { DEFAULT_CHINA_TIME_ZONE_ID } from 'mingyu-core/calendar';

export const FRONTEND_DEFAULT_TIME_ZONE_ID = DEFAULT_CHINA_TIME_ZONE_ID;

interface FrontendBirthTimeOptions {
  useTrueSolarTime?: boolean;
  timeZoneId?: string;
  applyChinaDst?: boolean;
}

/**
 * 网页端时间策略：
 * - 普通时辰 / 真太阳时模式统一按 IANA `Asia/Shanghai` 解析，该时区已自动覆盖 1986–1991 中国夏令时。
 * - `applyChinaDst` 仅在「网页端显式开启」时透传（UI 小开关，限定 1986–1991 出生时辰模式），
 *   其余情况默认 false；真太阳时分支因与 timeZoneId 互斥（见 true-solar-time.ts 互斥守卫），恒为 false。
 */
export function applyFrontendBirthTimeDefaults<T extends FrontendBirthTimeOptions>(input: T): T {
  if (input.useTrueSolarTime !== true) {
    return {
      ...input,
      applyChinaDst: input.applyChinaDst === true,
    };
  }
  return {
    ...input,
    timeZoneId: input.timeZoneId?.trim() || FRONTEND_DEFAULT_TIME_ZONE_ID,
    applyChinaDst: false,
  };
}
