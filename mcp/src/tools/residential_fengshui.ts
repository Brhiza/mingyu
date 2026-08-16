import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { residentialFengshui } from 'mingyu-core';
import { BAGUA, TWENTY_FOUR_MOUNTAINS } from 'mingyu-core/direction';
import { calculationDetailShape, resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';
import { createPromptSchoolsShape } from './school-options.js';

const mountainSchema = z
  .string()
  .refine((value) => TWENTY_FOUR_MOUNTAINS.includes(value), '必须是有效二十四山')
  .optional();

const residentialSchema = z.object({
  year: z
    .number()
    .int()
    .min(1)
    .max(9999)
    .optional()
    .describe('建造年或起运年；排玄空宅运盘时必填，只做八宅时可不填'),
  birthYear: z.number().int().min(1900).max(2100).optional().describe('出生公历年份'),
  birthMonth: z.number().int().min(1).max(12).optional().describe('出生公历月份'),
  birthDay: z.number().int().min(1).max(31).optional().describe('出生公历日期'),
  gender: z.enum(['male', 'female']).optional().describe('性别'),
  mingGua: z
    .string()
    .refine((value) => BAGUA.includes(value), 'mingGua 必须是有效八卦')
    .optional()
    .describe('直接给定命卦'),
  sitMountain: mountainSchema.describe('坐山二十四山'),
  facingMountain: mountainSchema.describe('朝向二十四山'),
  facingDegree: z.number().min(0).max(360).optional().describe('朝向度数，正北 0°'),
  sitDegree: z.number().min(0).max(360).optional().describe('坐山度数，正北 0°'),
  doorToInteriorDegree: z
    .number()
    .min(0)
    .max(360)
    .optional()
    .describe('站在大门处面向屋内的指南针读数'),
  northReference: z
    .enum(['unspecified', 'magnetic', 'true'])
    .optional()
    .describe('指南针读数的北向基准'),
  magneticDeclinationDegrees: z.number().min(-30).max(30).optional().describe('当地磁偏角'),
  measurementUncertaintyDegrees: z.number().min(0).max(45).optional().describe('测量可能误差'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

function calculateResidential(args: z.infer<typeof residentialSchema>) {
  return residentialFengshui.generateResidentialFengshui({
    ...(args.year !== undefined ? { year: args.year } : {}),
    ...(args.birthYear !== undefined ? { birthYear: args.birthYear } : {}),
    ...(args.birthMonth !== undefined ? { birthMonth: args.birthMonth } : {}),
    ...(args.birthDay !== undefined ? { birthDay: args.birthDay } : {}),
    ...(args.gender ? { gender: args.gender } : {}),
    ...(args.mingGua ? { mingGua: args.mingGua } : {}),
    ...(args.sitMountain ? { sitMountain: args.sitMountain } : {}),
    ...(args.facingMountain ? { facingMountain: args.facingMountain } : {}),
    ...(args.facingDegree !== undefined ? { facingDegree: args.facingDegree } : {}),
    ...(args.sitDegree !== undefined ? { sitDegree: args.sitDegree } : {}),
    ...(args.doorToInteriorDegree !== undefined
      ? { doorToInteriorDegree: args.doorToInteriorDegree }
      : {}),
    ...(args.northReference ? { northReference: args.northReference } : {}),
    ...(args.magneticDeclinationDegrees !== undefined
      ? { magneticDeclinationDegrees: args.magneticDeclinationDegrees }
      : {}),
    ...(args.measurementUncertaintyDegrees !== undefined
      ? { measurementUncertaintyDegrees: args.measurementUncertaintyDegrees }
      : {}),
  });
}

export function registerResidentialFengshuiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_residential',
    {
      description:
        '住宅风水一站式：分层计算八宅与玄空飞星，输出宅运结构、人宅适配、合参要点与证据；玄空层须提供建造年或起运年，不生成综合吉凶总分',
      inputSchema: {
        ...residentialSchema.omit({ question: true }).shape,
        ...calculationDetailShape,
      },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateResidential(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '住宅风水排盘失败'));
      }
    },
  );

  server.registerTool(
    'residential_prompt',
    {
      description: '住宅风水排盘并生成可直接复制给 AI 的结构化提示词',
      inputSchema: { ...residentialSchema.shape, ...createPromptSchoolsShape('residential') },
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateResidential(args);
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question, {
            method: 'residential',
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成住宅风水提示词失败'));
      }
    },
  );
}
