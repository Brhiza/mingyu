import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { queryYilinEntry } from 'mingyu-core/classics';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';

const yilinQuerySchema = z.object({
  baseHexagram: z
    .string()
    .min(1)
    .max(4)
    .describe('固定卦序中的本卦名称，例如“乾”；支持已登记的繁简或异体输入'),
  targetHexagram: z
    .string()
    .min(1)
    .max(4)
    .describe('固定卦序中的之卦名称，例如“需”；支持已登记的繁简或异体输入'),
  source: z
    .enum(['wikisource', 'kanripo', 'both'])
    .optional()
    .describe('text 字段的主底本；默认 both，同时返回两个固定底本和来源状态'),
});

export function registerYilinTool(server: McpServer) {
  server.registerTool(
    'classics_yilin_query',
    {
      description:
        '查询焦氏易林固定 W20.03 版本的 64×64 卦对原文，返回 Wikisource 四库全书本与 Kanripo KR3g0029 WYG 对读资料、来源定位和未决字形/校勘状态；不承担起卦或随机取卦',
      inputSchema: yilinQuerySchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({
          result: queryYilinEntry(args.baseHexagram, args.targetHexagram, args.source ?? 'both'),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '焦氏易林索引查询失败'));
      }
    },
  );
}
