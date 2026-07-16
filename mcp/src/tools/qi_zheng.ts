import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { qizheng } from 'mingyu-core';
import { resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';

const qiZhengSchema = z.object({
  year: z.number().int().min(1900).max(2200).optional().describe('公元年（默认今年）'),
  month: z.number().int().min(1).max(12).optional().describe('月'),
  day: z.number().int().min(1).max(31).optional().describe('日'),
  hour: z.number().int().min(0).max(23).optional().describe('时'),
  minute: z.number().int().min(0).max(59).optional().describe('分'),
  latitude: z.number().min(-90).max(90).optional().describe('纬度（默认北京）'),
  longitude: z.number().min(-180).max(180).optional().describe('经度（默认北京）'),
  useTrueSolarTime: z.boolean().optional().describe('是否启用真太阳时仅校正传统命身十二宫'),
  timezone: z.number().min(-12).max(14).optional().describe('时区偏移（默认 +8）'),
  timeZoneId: z
    .string()
    .optional()
    .describe('IANA 历史时区，例如 Asia/Shanghai；提供后会自动解析当年的夏令时'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

export function registerQizhengTool(server: McpServer) {
  server.registerTool(
    'metaphysics_qizheng',
    {
      description:
        '七政四余（果老星宗）：计算日月五星、罗睺、计都、月孛及《七政算内篇》古法紫炁，立命身宫、排十二宫、二十八宿宿度与庙旺神煞',
      inputSchema: qiZhengSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = qizheng.generateQizheng({
          year: args.year ?? new Date().getFullYear(),
          month: args.month ?? 1,
          day: args.day ?? 1,
          hour: args.hour ?? 12,
          minute: args.minute ?? 0,
          ...(args.latitude !== undefined ? { latitude: args.latitude } : {}),
          ...(args.longitude !== undefined ? { longitude: args.longitude } : {}),
          ...(args.timezone !== undefined ? { timezone: args.timezone } : {}),
          ...(args.timeZoneId ? { timeZoneId: args.timeZoneId } : {}),
          ...(args.useTrueSolarTime !== undefined ? { useTrueSolarTime: args.useTrueSolarTime } : {}),
        });
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '七政四余排盘失败'));
      }
    },
  );

  server.registerTool(
    'qizheng_prompt',
    {
      description: '七政四余排盘并生成结构化 AI 解读提示词',
      inputSchema: qiZhengSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = qizheng.generateQizheng({
          year: args.year ?? new Date().getFullYear(),
          month: args.month ?? 1,
          day: args.day ?? 1,
          hour: args.hour ?? 12,
          minute: args.minute ?? 0,
          ...(args.latitude !== undefined ? { latitude: args.latitude } : {}),
          ...(args.longitude !== undefined ? { longitude: args.longitude } : {}),
          ...(args.timezone !== undefined ? { timezone: args.timezone } : {}),
          ...(args.timeZoneId ? { timeZoneId: args.timeZoneId } : {}),
          ...(args.useTrueSolarTime !== undefined ? { useTrueSolarTime: args.useTrueSolarTime } : {}),
        });
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question, { method: 'qizheng' }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成七政四余提示词失败'));
      }
    },
  );
}
