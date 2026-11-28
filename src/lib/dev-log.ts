/**
 * 开发态轻量诊断日志：仅在 Vite/Node DEV 模式下输出警告，生产环境零噪音。
 */
export function warnDev(scope: string, detail: string, error?: unknown): void {
  const isDev =
    typeof import.meta !== 'undefined' &&
    Boolean((import.meta as { env?: { DEV?: boolean } }).env?.DEV);
  if (!isDev) return;
  if (error !== undefined) {
    console.warn(`[${scope}] ${detail}`, error);
  } else {
    console.warn(`[${scope}] ${detail}`);
  }
}
