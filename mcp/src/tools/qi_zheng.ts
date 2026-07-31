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
  year: z.number().int().min(1900).max(2200).describe('公元年'),
  month: z.number().int().min(1).max(12).describe('月'),
  day: z.number().int().min(1).max(31).describe('日'),
  hour: z.number().int().min(0).max(23).describe('时'),
  minute: z.number().int().min(0).max(59).optional().describe('分'),
  latitude: z.number().min(-90).max(90).optional().describe('纬度（默认北京）'),
  longitude: z.number().min(-180).max(180).optional().describe('经度（默认北京）'),
  useTrueSolarTime: z
    .boolean()
    .optional()
    .describe('是否用真太阳时校正命宫所用生时与可能跨日的传统年界；身宫仍取太阴所在宫'),
  timezone: z.number().min(-12).max(14).optional().describe('时区偏移（默认 +8）'),
  timeZoneId: z
    .string()
    .optional()
    .describe('IANA 历史时区，例如 Asia/Shanghai；提供后会自动解析当年的夏令时'),
  standardMeridian: z
    .number()
    .min(-180)
    .max(180)
    .optional()
    .describe('真太阳时采用的当地标准经线；使用 IANA 历史时区时必须明确提供'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

export function registerQizhengTool(server: McpServer) {
  server.registerTool(
    'metaphysics_qizheng',
    {
      description:
        '七政四余（果老星宗）：计算十一星、真实距星二十八宿界、5项已校勘命身十二职宫规则、全部55组星对实际夹角、8项已校勘生年神煞起例及分层天文证据；庙旺与吊照规则不自动判定',
      inputSchema: qiZhengSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = qizheng.generateQizheng({
          year: args.year,
          month: args.month,
          day: args.day,
          hour: args.hour,
          minute: args.minute ?? 0,
          ...(args.latitude !== undefined ? { latitude: args.latitude } : {}),
          ...(args.longitude !== undefined ? { longitude: args.longitude } : {}),
          ...(args.timezone !== undefined ? { timezone: args.timezone } : {}),
          ...(args.timeZoneId ? { timeZoneId: args.timeZoneId } : {}),
          ...(args.standardMeridian !== undefined
            ? { standardMeridian: args.standardMeridian }
            : {}),
          ...(args.useTrueSolarTime !== undefined
            ? { useTrueSolarTime: args.useTrueSolarTime }
            : {}),
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
      description: '七政四余排盘并生成可直接复制给 AI 的结构化提示词',
      inputSchema: qiZhengSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = qizheng.generateQizheng({
          year: args.year,
          month: args.month,
          day: args.day,
          hour: args.hour,
          minute: args.minute ?? 0,
          ...(args.latitude !== undefined ? { latitude: args.latitude } : {}),
          ...(args.longitude !== undefined ? { longitude: args.longitude } : {}),
          ...(args.timezone !== undefined ? { timezone: args.timezone } : {}),
          ...(args.timeZoneId ? { timeZoneId: args.timeZoneId } : {}),
          ...(args.standardMeridian !== undefined
            ? { standardMeridian: args.standardMeridian }
            : {}),
          ...(args.useTrueSolarTime !== undefined
            ? { useTrueSolarTime: args.useTrueSolarTime }
            : {}),
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
