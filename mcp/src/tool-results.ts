import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { shapeCalculationResult, type ResultDetailMode } from '../../src/lib/result-detail.js';

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
        : { prompt };

  const finalContent: Record<string, unknown> = {
    ...responseContent,
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

export function createErrorToolResult(
  message: string,
  options?: ErrorToolResultOptions,
): CallToolResult {
  const structuredContent: Record<string, unknown> = {
    error: message,
    ...(options?.code ? { code: options.code } : {}),
    ...(options?.missingFields?.length ? { missingFields: options.missingFields } : {}),
    ...(options?.retryable !== undefined ? { retryable: options.retryable } : {}),
    ...(options?.fallback ? { fallback: options.fallback } : {}),
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

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
