import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { convertTrueSolarTime } from 'mingyu-core/calendar';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';

const trueSolarTimeSchema = z.object({
  localDateTime: z
    .string()
    .describe('当地钟表时间，如 1990-05-15T10:30:00；不要附带 Z 或 +08:00 等时区后缀'),
  longitude: z.number().min(-180).max(180).describe('当地经度，东经为正、西经为负'),
  timezone: z.number().min(-12).max(14).optional().describe('当地标准时区，默认 UTC+8'),
});

export function registerCalendarTools(server: McpServer) {
  server.registerTool(
    'calendar_true_solar_time',
    {
      description:
        '将当地钟表时间换算为真太阳时，返回经度修正、均时差、总修正量、跨日状态和对应时辰',
      inputSchema: trueSolarTimeSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({ result: convertTrueSolarTime(args) });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '真太阳时换算失败'));
      }
    },
  );
}
