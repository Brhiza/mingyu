import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { shapeCalculationResult, type ResultDetailMode } from '../../src/lib/result-detail.js';

type StructuredContent = Record<string, unknown>;

export function createStructuredToolResult(
  structuredContent: StructuredContent,
  detailMode?: ResultDetailMode | null,
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

  return {
    structuredContent: responseContent,
    content: [
      {
        type: 'text',
        text: prompt ?? '结构化结果已返回，请读取 structuredContent。',
      },
    ],
  };
}

export function createErrorToolResult(message: string): CallToolResult {
  return {
    structuredContent: { error: message },
    content: [
      {
        type: 'text',
        text: JSON.stringify({ error: message }),
      },
    ],
    isError: true,
  };
}

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}
