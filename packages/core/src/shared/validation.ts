/** 运行时校验可选配置对象，避免字符串、数组或 null 被静默当成默认配置。 */
export function assertOptionalRecord(value: unknown, label: string): void {
  if (value === undefined) return;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label}必须是对象。`);
  }
}
