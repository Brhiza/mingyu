import { secureRandomUint32 } from 'mingyu-core/random';

/** 生成不依赖时间戳或 Math.random 的本地唯一标识。 */
export function createSecureId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return Array.from({ length: 4 }, () => secureRandomUint32().toString(16).padStart(8, '0')).join(
    '',
  );
}
