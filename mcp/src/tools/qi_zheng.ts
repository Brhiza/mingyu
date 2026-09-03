import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { qizheng } from 'mingyu-core';
import { calculationDetailShape, resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';
import { createPromptSchoolsShape } from './school-options.js';

const qiZhengSchema = z.object({
  year: z.number().int().min(1900).max(2200).describe('公元年'),
  month: z.number().int().min(1).max(12).describe('月'),
  day: z.number().int().min(1).max(31).describe('日'),
  hour: z.number().int().min(0).max(23).describe('时'),
  minute: z.number().int().min(0).max(59).optional().describe('分'),
  latitude: z.number().min(-90).max(90).optional().describe('纬度（默认北京）'),
  longitude: z.number().min(-180).max(180).optional().describe('经度（默认北京）'),
  useTrueSolarTime: z.boolean().optional().describe('是否启用真太阳时仅校正传统命身十二宫'),
  timezone: z.number().min(-12).max(14).optional().describe('时区偏移（默认 +8）'),
  timeZoneId: z
    .string()
    .optional()
    .describe('IANA 历史时区，例如 Asia/Shanghai；提供后会自动解析当年的夏令时'),
  gender: z.enum(['male', 'female']).optional().describe('性别；排行限时需要'),
  flowYear: z
    .number()
    .int()
    .min(1900)
    .max(2200)
    .optional()
    .describe('流年公元年；不传则只排本命静态盘'),
  flowMonth: z.number().int().min(1).max(12).optional().describe('流月公历月'),
  flowDay: z.number().int().min(1).max(31).optional().describe('流日；不传流月时按立春'),
  flowHour: z.number().int().min(0).max(23).optional().describe('流时'),
  flowMinute: z.number().int().min(0).max(59).optional().describe('流分'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

export function registerQizhengTool(server: McpServer) {
  server.registerTool(
    'metaphysics_qizheng',
    {
      description:
        '七政四余（果老星宗）：计算十一星、真实距星二十八宿界、命身十二宫、庙旺、吊照；可传性别与流年生成行限、流曜',
      inputSchema: { ...qiZhengSchema.shape, ...calculationDetailShape },
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
          ...(args.useTrueSolarTime !== undefined
            ? { useTrueSolarTime: args.useTrueSolarTime }
            : {}),
          ...(args.gender ? { gender: args.gender } : {}),
          ...(args.flowYear !== undefined ? { flowYear: args.flowYear } : {}),
          ...(args.flowMonth !== undefined ? { flowMonth: args.flowMonth } : {}),
          ...(args.flowDay !== undefined ? { flowDay: args.flowDay } : {}),
          ...(args.flowHour !== undefined ? { flowHour: args.flowHour } : {}),
          ...(args.flowMinute !== undefined ? { flowMinute: args.flowMinute } : {}),
        });
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '七政四余排盘失败'));
      }
    },
  );

  server.registerTool(
    'qizheng_prompt',
    {
      description: '七政四余排盘并生成可直接复制给 AI 的结构化提示词',
      inputSchema: { ...qiZhengSchema.shape, ...createPromptSchoolsShape('qizheng') },
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
          ...(args.useTrueSolarTime !== undefined
            ? { useTrueSolarTime: args.useTrueSolarTime }
            : {}),
          ...(args.gender ? { gender: args.gender } : {}),
          ...(args.flowYear !== undefined ? { flowYear: args.flowYear } : {}),
          ...(args.flowMonth !== undefined ? { flowMonth: args.flowMonth } : {}),
          ...(args.flowDay !== undefined ? { flowDay: args.flowDay } : {}),
          ...(args.flowHour !== undefined ? { flowHour: args.flowHour } : {}),
          ...(args.flowMinute !== undefined ? { flowMinute: args.flowMinute } : {}),
        });
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question, {
            method: 'qizheng',
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成七政四余提示词失败'));
      }
    },
  );
}
