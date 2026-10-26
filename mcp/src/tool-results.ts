import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { shapeCalculationResult, type ResultDetailMode } from '../../src/lib/result-detail.js';
import {
  projectCalculationResult,
  type CalculationSystem,
} from '../../src/lib/public-api/result-projection.js';
import { MingyuCoreError, type CoreErrorCategory } from 'mingyu-core/result';
import type { PromptResponseMode } from './schemas.js';

type StructuredContent = Record<string, unknown>;

export interface ErrorToolResultOptions {
  code?: string;
  missingFields?: string[];
  retryable?: boolean;
  fallback?: string;
  message?: string;
  category?: CoreErrorCategory;
  field?: string;
  recoverable?: boolean;
}

export interface StructuredToolResultOptions {
  calculationSystem?: CalculationSystem;
  meta?: {
    tool?: string;
    durationMs?: number;
    system?: string;
    [key: string]: unknown;
  };
  warnings?: string[];
  responseMode?: PromptResponseMode;
}

function shapePromptResponseContent(
  structuredContent: StructuredContent,
  responseMode: PromptResponseMode,
): StructuredContent {
  const prompt =
    typeof structuredContent.prompt === 'string' ? structuredContent.prompt : undefined;
  if (prompt === undefined || responseMode === 'full') {
    return structuredContent;
  }

  const { result: fullResult, ...withoutResult } = structuredContent;
  if (responseMode === 'prompt-only') {
    return { ...withoutResult, prompt };
  }

  return {
    ...withoutResult,
    ...(fullResult === undefined
      ? {}
      : { resultSummary: shapeCalculationResult(fullResult, 'compact') }),
    prompt,
  };
}

export function createStructuredToolResult(
  structuredContent: StructuredContent,
  detailMode?: ResultDetailMode | null,
  options?: StructuredToolResultOptions,
): CallToolResult {
  const prompt =
    typeof structuredContent.prompt === 'string' ? structuredContent.prompt : undefined;
  const shouldShapeCalculation = arguments.length >= 2 && detailMode !== null;
  const effectiveMode = detailMode ?? 'compact';
  const responseContent =
    prompt === undefined && shouldShapeCalculation
      ? options?.calculationSystem && Object.hasOwn(structuredContent, 'result')
        ? {
            ...structuredContent,
            result: projectCalculationResult(
              structuredContent.result,
              effectiveMode,
              options.calculationSystem,
            ),
          }
        : (projectCalculationResult(
            structuredContent,
            effectiveMode,
            options?.calculationSystem,
          ) as StructuredContent)
      : structuredContent;

  const responseMode = options?.responseMode ?? 'full';
  const promptResponseContent = shapePromptResponseContent(responseContent, responseMode);

  const finalContent: Record<string, unknown> = {
    ...promptResponseContent,
    ...(options?.meta ? { meta: options.meta } : {}),
    ...(options?.warnings?.length ? { warnings: options.warnings } : {}),
  };

  return {
    structuredContent: finalContent,
    content: [
      {
        type: 'text',
        text: prompt ?? '结构化结果已返回，请读取 structuredContent。',
      },
    ],
  };
}

export function applyPromptResponseMode(
  result: CallToolResult,
  responseMode: PromptResponseMode = 'full',
): CallToolResult {
  if (!result.structuredContent || typeof result.structuredContent !== 'object') {
    return result;
  }

  const structuredContent = result.structuredContent as StructuredContent;
  if (typeof structuredContent.prompt !== 'string' || responseMode === 'full') {
    return result;
  }

  return {
    ...result,
    structuredContent: shapePromptResponseContent(structuredContent, responseMode),
  };
}

export function createPromptToolResult(
  structuredContent: StructuredContent & { prompt: string },
  responseMode?: PromptResponseMode,
): CallToolResult {
  return createStructuredToolResult(structuredContent, null, {
    responseMode: responseMode ?? 'full',
  });
}

export function createErrorToolResult(
  error: unknown,
  options?: ErrorToolResultOptions,
): CallToolResult {
  const message = getErrorMessage(error, options?.message ?? '工具执行失败。');
  const defaultOptions = mapKnownCoreError(error) ?? classifyError(message);
  const resolvedOptions = {
    ...defaultOptions,
    ...options,
    missingFields: options?.missingFields ?? defaultOptions.missingFields,
  };
  const structuredContent: Record<string, unknown> = {
    error: message,
    ...(resolvedOptions.code ? { code: resolvedOptions.code } : {}),
    ...(resolvedOptions.category ? { category: resolvedOptions.category } : {}),
    ...(resolvedOptions.field ? { field: resolvedOptions.field } : {}),
    ...(resolvedOptions.recoverable !== undefined
      ? { recoverable: resolvedOptions.recoverable }
      : {}),
    ...(resolvedOptions.missingFields?.length
      ? { missingFields: resolvedOptions.missingFields }
      : {}),
    ...(resolvedOptions.retryable !== undefined ? { retryable: resolvedOptions.retryable } : {}),
    ...(resolvedOptions.fallback ? { fallback: resolvedOptions.fallback } : {}),
  };

  return {
    structuredContent,
    content: [
      {
        type: 'text',
        text: JSON.stringify(structuredContent),
      },
    ],
    isError: true,
  };
}

// 只接受核心公开错误形状；第三方的 code/status/context 不进入 MCP 协议。
function mapKnownCoreError(error: unknown): ErrorToolResultOptions | undefined {
  if (
    !(error instanceof MingyuCoreError) &&
    !(
      error !== null &&
      typeof error === 'object' &&
      'name' in error &&
      ['MingyuCoreError', 'MingyuCoreRangeError', 'BirthProfileError'].includes(
        String(error.name),
      ) &&
      'recoverable' in error &&
      typeof error.recoverable === 'boolean'
    )
  )
    return undefined;
  const value = error as MingyuCoreError;
  const categories: CoreErrorCategory[] = [
    'validation',
    'boundary',
    'unsupported',
    'dependency',
    'calculation',
    'serialization',
  ];
  if (typeof value.code !== 'string' || !categories.includes(value.category)) return undefined;
  const retryable = value.category === 'dependency';
  const code =
    value.category === 'validation' || value.category === 'boundary'
      ? 'INVALID_ARGUMENTS'
      : value.category === 'unsupported'
        ? 'OPERATION_UNSUPPORTED'
        : value.category === 'dependency'
          ? 'DEPENDENCY_UNAVAILABLE'
          : 'MCP_TOOL_ERROR';
  const randomCodes = new Set([
    'RANDOM_OPTIONS_INVALID',
    'RANDOM_SOURCE_CONFLICT',
    'RANDOM_OPTIONS_CONFLICT',
    'RANDOM_REPLAY_REQUIRED',
    'RANDOM_REPLAY_EXHAUSTED',
    'RANDOM_SOURCE_INVALID',
    'RANDOM_SAMPLE_INVALID',
    'RANDOM_SEED_INVALID',
    'RANDOM_RANGE_INVALID',
  ]);
  return {
    code: randomCodes.has(value.code) ? value.code : code,
    category: value.category,
    ...(typeof value.field === 'string' ? { field: value.field } : {}),
    ...(typeof value.recoverable === 'boolean' ? { recoverable: value.recoverable } : {}),
    retryable,
    fallback: ['INPUT_CURSOR_INVALID', 'INPUT_CURSOR_CONTEXT_INVALID'].includes(value.code)
      ? '请使用上一页返回的 nextIndex 或 next 游标；更换出生资料后从 startIndex=0 重新查询。'
      : code === 'INVALID_ARGUMENTS'
        ? '请根据 error 和 field 修正输入参数后重试。'
        : code === 'DEPENDENCY_UNAVAILABLE'
          ? '请安装或恢复所需依赖后重试。'
          : code === 'OPERATION_UNSUPPORTED'
            ? '请使用当前支持的方法或范围。'
            : '请检查输入并重试；若问题持续，请稍后再试。',
  };
}

function extractMissingFields(message: string): string[] | undefined {
  if (/timezone.*timeZoneId|timeZoneId.*timezone/i.test(message)) {
    return ['timezone', 'timeZoneId'];
  }
  if (/location\.longitude/i.test(message)) {
    return ['location.longitude'];
  }
  if (/真太阳时.*(?:精准时间|经度)|缺少精准时间或经度/i.test(message)) {
    const fields: string[] = [];
    if (/birthHour/i.test(message) || /小时/.test(message)) fields.push('birthHour');
    if (/birthMinute/i.test(message) || /分钟/.test(message)) fields.push('birthMinute');
    if (/birthLongitude/i.test(message) || /经度/.test(message)) fields.push('birthLongitude');
    return fields.length ? fields : ['birthLongitude'];
  }
  if (/birthLongitude|出生地经度/i.test(message)) {
    return ['birthLongitude'];
  }
  if (/customDate/i.test(message)) {
    return ['customDate'];
  }
  if (/时辰|birthTime|timeIndex/i.test(message)) {
    return ['timeIndex'];
  }
  return undefined;
}

function classifyError(message: string): ErrorToolResultOptions &
  Required<Pick<ErrorToolResultOptions, 'code' | 'retryable' | 'fallback'>> & {
    missingFields?: string[];
  } {
  if (/(?:startIndex|续取位置|游标|contextKey)/i.test(message)) {
    return {
      code: 'INVALID_ARGUMENTS',
      category: 'validation',
      field: /contextKey/.test(message)
        ? 'contextKey'
        : /scopeBatch/.test(message)
          ? 'scopeBatch.startIndex'
          : 'fortuneBatch.startIndex',
      retryable: false,
      fallback:
        '请使用上一页返回的 nextIndex 或 next 游标；更换出生资料后从 startIndex=0 重新查询。',
    };
  }
  if (
    /资源|过大|1102|timeout|timed out|(?:resource|rate)[ _-]?limit|最多.*(?:天|年)|范围.*(?:限制|过大)/i.test(
      message,
    )
  ) {
    return {
      code: 'RESOURCE_LIMIT',
      retryable: true,
      fallback: '请缩小日期或年份范围并分段调用；需要完整结果时使用本地或自部署 MCP。',
    };
  }
  if (
    /必须|需要|缺少|不能|不得|不接受|无效|不合法|不一致|至少|至多|只能|应为|超出范围/.test(message)
  ) {
    const missingFields = extractMissingFields(message);
    return {
      code: 'INVALID_ARGUMENTS',
      retryable: false,
      fallback: '请根据 error 修正输入参数后重试。',
      ...(missingFields?.length ? { missingFields } : {}),
    };
  }
  return {
    code: 'MCP_TOOL_ERROR',
    retryable: false,
    fallback: '请检查输入并重试；若问题持续，请稍后再试。',
  };
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    ['MingyuCoreError', 'MingyuCoreRangeError', 'BirthProfileError'].includes(String(error.name)) &&
    'message' in error &&
    typeof error.message === 'string'
  )
    return error.message;
  return fallback;
}
