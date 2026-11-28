import { warnDev } from '../lib/dev-log';
import type { PromptGuidanceOptions } from '../prompt-guidance';
import type { PromptProfile } from '../prompt-profile';
import type { Method } from '../schema';

export interface RunCalculateInBackgroundOptions {
  promptGuidance?: PromptGuidanceOptions;
  promptProfile?: PromptProfile;
}

function buildRuntimeContext(options: RunCalculateInBackgroundOptions) {
  if (!options.promptGuidance && !options.promptProfile) {
    return undefined;
  }
  return {
    ...(options.promptGuidance ? { promptGuidance: options.promptGuidance } : {}),
    ...(options.promptProfile ? { promptProfile: options.promptProfile } : {}),
  };
}

let calculateModulePromise: Promise<typeof import('../calculate')> | null = null;
let repromptModulePromise: Promise<typeof import('../reprompt')> | null = null;
let inputErrorModulePromise: Promise<typeof import('../input-error')> | null = null;

function loadCalculateModule() {
  if (!calculateModulePromise) {
    calculateModulePromise = import('../calculate');
  }
  return calculateModulePromise;
}

function loadRepromptModule() {
  if (!repromptModulePromise) {
    repromptModulePromise = import('../reprompt');
  }
  return repromptModulePromise;
}

function loadInputErrorModule() {
  if (!inputErrorModulePromise) {
    inputErrorModulePromise = import('../input-error');
  }
  return inputErrorModulePromise;
}

async function normalizeExecutionError(err: unknown): Promise<Error> {
  try {
    const { formatInputError } = await loadInputErrorModule();
    return new Error(formatInputError(err));
  } catch {
    return err instanceof Error ? err : new Error(String(err));
  }
}

/** @deprecated 常规算盘已回迁主线程按需执行，仅保留空导出兼容历史调用方。 */
export function prewarmCalcWorker(): void {}

/**
 * 静默预加载计算引擎入口及可选的目标术数分片，仅拉取代码模块，不执行运算。
 */
export function preloadCalculateEngine(method?: Method): void {
  void loadCalculateModule()
    .then((mod) => (method ? mod.preloadMethodCalculator?.(method) : undefined))
    .catch((err) => {
      warnDev('calc-runner', `预加载算盘模块失败（${method ?? 'entry'}）`, err);
    });
}

/**
 * 静默预加载追问重排模块，加快结果页追问与二次提示词切换响应。
 */
export function preloadRepromptEngine(): void {
  void loadRepromptModule().catch((err) => {
    warnDev('calc-runner', '预加载追问重排模块失败', err);
  });
}

/**
 * 浏览器端直接按需动态导入单术数分片并在当前线程完成排盘（仅耗时 1~15ms），
 * 避免后台 Worker 线程冷启动与无预加载串行拉包导致的额外等待。
 */
export async function runCalculateInBackground<T = unknown>(
  method: Method,
  payload: unknown,
  options: RunCalculateInBackgroundOptions = {},
): Promise<T> {
  try {
    const { calculate } = await loadCalculateModule();
    return (await calculate(method, payload, buildRuntimeContext(options))) as T;
  } catch (err) {
    throw await normalizeExecutionError(err);
  }
}

/**
 * 在当前线程按需动态导入追问处理模块并基于已有结果完成重排/追问。
 */
export async function runRepromptInBackground<T = unknown>(
  payload: unknown,
  options: RunCalculateInBackgroundOptions = {},
): Promise<T> {
  try {
    const { reprompt } = await loadRepromptModule();
    return (await reprompt(payload, buildRuntimeContext(options))) as T;
  } catch (err) {
    throw await normalizeExecutionError(err);
  }
}
