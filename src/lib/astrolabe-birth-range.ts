import { getDivinationTime, TimeManager } from 'mingyu-core/calendar';
import {
  generateAstrolabeBirthRange as generateCoreAstrolabeBirthRange,
  type AstrolabeBirthRange as CoreAstrolabeBirthRange,
  type AstrolabeBirthRangeOptions as CoreAstrolabeBirthRangeOptions,
} from 'mingyu-core/divination/astrolabe-birth-range';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import type { BaziReverseSource } from '@/lib/bazi-reverse-input';

const CHINA_OFFSET_HOURS = 8;
const CHINA_OFFSET_MINUTES = CHINA_OFFSET_HOURS * 60;
const MAX_RANGE_MILLISECONDS = 2 * 60 * 60 * 1000;
const ASTROLABE_MACHINE_FIELDS = [
  'startTimestamp',
  'endTimestamp',
  'endExclusive',
  'timezone',
  'offsetHours',
] as const;

export type AstrolabeBirthRange = CoreAstrolabeBirthRange;
export type AstrolabeBirthRangeSource = BaziReverseSource & {
  startTimestamp: number;
  endTimestamp: number;
  endExclusive: true;
  timezone: 'Asia/Shanghai';
  offsetHours: 8;
};

export type AstrolabeBirthRangeOptions = CoreAstrolabeBirthRangeOptions;

function assertTimestamp(value: number, label: string) {
  if (
    !Number.isSafeInteger(value) ||
    value % 1000 !== 0 ||
    Number.isNaN(new Date(value).getTime())
  ) {
    throw new Error(`西占星盘${label}必须是秒级北京时间时间戳。`);
  }
}

function formatBeijingWallClock(timestamp: number) {
  assertTimestamp(timestamp, '范围');
  const parts = TimeManager.getWallClockParts(new Date(timestamp), CHINA_OFFSET_MINUTES);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function hasPillars(source: BaziReverseSource) {
  return Boolean(
    source.pillars &&
    typeof source.pillars === 'object' &&
    ['year', 'month', 'day', 'hour'].every((key) => {
      const value = source.pillars[key as keyof typeof source.pillars];
      return typeof value === 'string' && value.length > 0;
    }),
  );
}

/** 判断来源是否携带过机器区间字段；不完整字段也返回 true，便于路由拒绝回退单点。 */
export function hasAstrolabeBirthRangeSource(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    ASTROLABE_MACHINE_FIELDS.some((field) => Object.hasOwn(value, field)),
  );
}

/** 只接受四柱反推写入的完整东八区机器区间。 */
export function isAstrolabeBirthRangeSource(
  source: BaziReverseSource | null | undefined,
): source is AstrolabeBirthRangeSource {
  return Boolean(
    source &&
    typeof source === 'object' &&
    hasPillars(source) &&
    typeof source.intervalStart === 'string' &&
    typeof source.intervalEnd === 'string' &&
    typeof source.startTimestamp === 'number' &&
    typeof source.endTimestamp === 'number' &&
    Number.isSafeInteger(source.startTimestamp) &&
    Number.isSafeInteger(source.endTimestamp) &&
    source.startTimestamp % 1000 === 0 &&
    source.endTimestamp % 1000 === 0 &&
    source.startTimestamp < source.endTimestamp &&
    source.endExclusive === true &&
    source.timezone === 'Asia/Shanghai' &&
    source.offsetHours === CHINA_OFFSET_HOURS,
  );
}

function assertRangeSource(source: BaziReverseSource): asserts source is AstrolabeBirthRangeSource {
  if (!isAstrolabeBirthRangeSource(source)) {
    throw new Error('西占星盘出生区间需要完整的北京时间半开机器区间。');
  }
  const startText = formatBeijingWallClock(source.startTimestamp);
  const endText = formatBeijingWallClock(source.endTimestamp);
  if (source.intervalStart !== startText || source.intervalEnd !== endText) {
    throw new Error('西占星盘出生区间来源的文本边界与机器时间戳不一致。');
  }
  if (source.endTimestamp - source.startTimestamp > MAX_RANGE_MILLISECONDS) {
    throw new Error('西占星盘出生区间来源超过两小时上限。');
  }
}

function assertAstrolabeInput(input: AstrolabeBirthInput, startTimestamp: number) {
  if (!input || typeof input !== 'object') {
    throw new Error('西占星盘出生区间输入不能为空。');
  }
  if (Number(input.timezone) !== CHINA_OFFSET_HOURS) {
    throw new Error('西占星盘出生区间只接受 timezone 为 8 的北京时间输入。');
  }
  if (input.timeZoneId !== undefined) {
    throw new Error('西占星盘出生区间不接受 timeZoneId，只使用固定北京时间。');
  }
  const parts = TimeManager.getWallClockParts(new Date(startTimestamp), CHINA_OFFSET_MINUTES);
  if (
    Number(input.year) !== parts.year ||
    Number(input.month) !== parts.month ||
    Number(input.day) !== parts.day ||
    Number(input.hour) !== parts.hour ||
    Number(input.minute) !== parts.minute ||
    Number(input.second ?? '0') !== parts.second
  ) {
    throw new Error('西占星盘出生代表时间必须等于四柱候选区间起点。');
  }
}

function assertSourcePillars(source: AstrolabeBirthRangeSource) {
  const startGanZhi = getDivinationTime(
    new Date(source.startTimestamp),
    CHINA_OFFSET_MINUTES,
  ).ganzhi;
  const endGanZhi = getDivinationTime(
    new Date(source.endTimestamp - 1000),
    CHINA_OFFSET_MINUTES,
  ).ganzhi;
  const matches = (ganzhi: typeof startGanZhi) =>
    ganzhi.year === source.pillars.year &&
    ganzhi.month === source.pillars.month &&
    ganzhi.day === source.pillars.day &&
    ganzhi.hour === source.pillars.hour;
  if (!matches(startGanZhi)) {
    throw new Error('西占星盘出生区间起点的干支与四柱候选来源不一致。');
  }
  if (!matches(endGanZhi)) {
    throw new Error('西占星盘出生区间终点前的干支与四柱候选来源不一致。');
  }
}

function validateAstrolabeBirthRangeInput(
  input: AstrolabeBirthInput,
  source: BaziReverseSource,
): AstrolabeBirthRangeSource {
  assertRangeSource(source);
  assertAstrolabeInput(input, source.startTimestamp);
  assertSourcePillars(source);
  return source;
}

function toCoreRange(source: AstrolabeBirthRangeSource) {
  return {
    startTimestamp: source.startTimestamp,
    endTimestamp: source.endTimestamp,
  };
}

/** 在来源、起点代表输入与四柱事实核验通过后执行本命区间扫描。 */
export function generateAstrolabeBirthRange(
  input: AstrolabeBirthInput,
  source: BaziReverseSource,
  options?: AstrolabeBirthRangeOptions,
): AstrolabeBirthRange {
  const validSource = validateAstrolabeBirthRangeInput(input, source);
  return generateCoreAstrolabeBirthRange(input, toCoreRange(validSource), options);
}

type AstrolabeBirthRangeWorkerProgress = {
  id: string;
  type: 'progress';
  completed: number;
  total: number;
};

type AstrolabeBirthRangeWorkerResult = {
  id: string;
  type: 'result';
  result: AstrolabeBirthRange;
};

type AstrolabeBirthRangeWorkerError = {
  id: string;
  type: 'error';
  error?: string;
};

type AstrolabeBirthRangeWorkerResponse =
  | AstrolabeBirthRangeWorkerProgress
  | AstrolabeBirthRangeWorkerResult
  | AstrolabeBirthRangeWorkerError;

let requestCounter = 0;

function createAbortError() {
  return new DOMException('已停止西占星盘出生区间计算。', 'AbortError');
}

function createWorkerId() {
  requestCounter += 1;
  return `astrolabe-birth-range-${requestCounter}`;
}

/** 在独立 Worker 中执行本命区间扫描；取消时终止 Worker，不使用人工超时。 */
export function executeAstrolabeBirthRangeWorker(
  input: AstrolabeBirthInput,
  source: BaziReverseSource,
  signal?: AbortSignal,
  onProgress?: (completed: number, total: number) => void,
): Promise<AstrolabeBirthRange> {
  if (signal?.aborted) return Promise.reject(createAbortError());

  let validSource: AstrolabeBirthRangeSource;
  try {
    validSource = validateAstrolabeBirthRangeInput(input, source);
  } catch (error) {
    return Promise.reject(error);
  }

  let worker: Worker;
  try {
    worker = new Worker(new URL('../workers/astrolabe-birth-range.worker.ts', import.meta.url), {
      type: 'module',
    });
  } catch (error) {
    return Promise.reject(error);
  }

  const requestId = createWorkerId();
  return new Promise<AstrolabeBirthRange>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      signal?.removeEventListener('abort', handleAbort);
      try {
        worker.terminate();
      } catch {
        // Worker 已结束时无需重复处理终止错误。
      }
    };

    const finishWithError = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error('西占星盘出生区间计算失败。'));
    };

    const handleAbort = () => finishWithError(createAbortError());

    if (signal?.aborted) {
      finishWithError(createAbortError());
      return;
    }
    signal?.addEventListener('abort', handleAbort, { once: true });

    worker.onmessage = (event: MessageEvent<AstrolabeBirthRangeWorkerResponse>) => {
      if (settled || event.data.id !== requestId) return;
      if (event.data.type === 'progress') {
        try {
          onProgress?.(event.data.completed, event.data.total);
        } catch (error) {
          finishWithError(error);
        }
        return;
      }
      if (event.data.type === 'result') {
        settled = true;
        cleanup();
        resolve(event.data.result);
        return;
      }
      finishWithError(new Error(event.data.error || '西占星盘出生区间计算失败。'));
    };
    worker.onerror = (event) => {
      finishWithError(new Error(event.message || '西占星盘出生区间计算失败。'));
    };
    worker.onmessageerror = () => {
      finishWithError(new Error('西占星盘出生区间结果解析失败。'));
    };

    try {
      worker.postMessage({ id: requestId, input, source: validSource });
    } catch (error) {
      finishWithError(error);
    }
  });
}
