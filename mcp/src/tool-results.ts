import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { shapeCalculationResult, type ResultDetailMode } from '../../src/lib/result-detail.js';
import type { PromptResponseMode } from './schemas.js';

type StructuredContent = Record<string, unknown>;

export interface ErrorToolResultOptions {
  code?: string;
  missingFields?: string[];
  retryable?: boolean;
  fallback?: string;
}

export interface StructuredToolResultOptions {
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
  const responseContent =
    prompt === undefined && shouldShapeCalculation
      ? shapeCalculationResult(structuredContent, detailMode ?? 'compact')
      : prompt === undefined
        ? structuredContent
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
  message: string,
  options?: ErrorToolResultOptions,
): CallToolResult {
  const defaultOptions = classifyError(message);
  const resolvedOptions = { ...defaultOptions, ...options };
  const structuredContent: Record<string, unknown> = {
    error: message,
    ...(resolvedOptions.code ? { code: resolvedOptions.code } : {}),
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

function classifyError(
  message: string,
): Required<Pick<ErrorToolResultOptions, 'code' | 'retryable' | 'fallback'>> {
  if (/资源|超出|过大|限制|1102|timeout|timed out|limit/i.test(message)) {
    return {
      code: 'RESOURCE_LIMIT',
      retryable: true,
      fallback: '请缩小日期或年份范围并分段调用；需要完整结果时使用本地或自部署 MCP。',
    };
  }
  if (
    /必须|需要|缺少|不能|不得|不接受|无效|不合法|不一致|至少|至多|只能|应为|超出范围/.test(message)
  ) {
    return {
      code: 'INVALID_ARGUMENTS',
      retryable: false,
      fallback: '请根据 error 修正输入参数后重试。',
    };
  }
  return {
    code: 'MCP_TOOL_ERROR',
    retryable: false,
    fallback: '请检查输入并重试；若问题持续，请稍后再试。',
  };
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
