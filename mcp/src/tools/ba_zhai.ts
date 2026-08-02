import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { bazhai } from 'mingyu-core';
import { BAGUA, TWENTY_FOUR_MOUNTAINS } from 'mingyu-core/direction';
import { resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';

const baZhaiSchema = z.object({
  birthYear: z.number().int().min(1900).max(2100).optional().describe('出生公历年份（用于推命卦）'),
  birthMonth: z.number().int().min(1).max(12).optional().describe('出生公历月份（用于立春换年）'),
  birthDay: z.number().int().min(1).max(31).optional().describe('出生公历日期（用于立春换年）'),
  gender: z.enum(['male', 'female']).optional().describe('性别'),
  mingGua: z
    .string()
    .refine((value) => BAGUA.includes(value), 'mingGua 必须是有效八卦')
    .optional()
    .describe('直接给定命卦（坎坤震巽乾兑艮离）'),
  sitMountain: z
    .string()
    .refine((value) => TWENTY_FOUR_MOUNTAINS.includes(value), 'sitMountain 必须是有效二十四山')
    .optional()
    .describe('坐山（二十四山，如「子」），用于推宅卦'),
  doorToInteriorDegree: z
    .number()
    .min(0)
    .max(360)
    .optional()
    .describe('站在大门处面向屋内的指南针读数；与 sitMountain 二选一'),
  northReference: z
    .enum(['unspecified', 'magnetic', 'true'])
    .optional()
    .describe('指南针读数的北向基准；磁北读数需同时提供磁偏角'),
  magneticDeclinationDegrees: z
    .number()
    .min(-30)
    .max(30)
    .optional()
    .describe('当地磁偏角，东偏为正、西偏为负，仅用于磁北读数'),
  measurementUncertaintyDegrees: z
    .number()
    .min(0)
    .max(45)
    .optional()
    .describe('门向度数必填；测量可能误差，用于判断是否跨越山向或宅卦边界，确认无误差时填 0'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

function calculateBaZhai(args: z.infer<typeof baZhaiSchema>) {
  if (args.sitMountain && args.doorToInteriorDegree !== undefined) {
    throw new Error('sitMountain 与 doorToInteriorDegree 只能提供一个。');
  }
  const baseInput = {
    birthYear: args.birthYear,
    birthMonth: args.birthMonth,
    birthDay: args.birthDay,
    gender: args.gender,
    mingGua: args.mingGua,
  };
  const generated =
    args.doorToInteriorDegree !== undefined
      ? bazhai.analyzeBaZhaiByDoorDegree({
          ...baseInput,
          doorToInteriorDegree: args.doorToInteriorDegree,
          northReference: args.northReference,
          magneticDeclinationDegrees: args.magneticDeclinationDegrees,
          measurementUncertaintyDegrees: args.measurementUncertaintyDegrees,
        })
      : bazhai.analyzeBaZhai({ ...baseInput, sitMountain: args.sitMountain });
  return bazhai.rebuildAuditedBaZhaiData(generated);
}

export function registerBaZhaiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_bazhai',
    {
      description:
        '八宅风水排盘：返回命卦、宅卦、东四西四分组、八宫传统标签、坐向测量与边界候选；不自动生成方向宜避或布置结论',
      inputSchema: baZhaiSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateBaZhai(args);
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '八宅排盘失败'));
      }
    },
  );

  server.registerTool(
    'bazhai_prompt',
    {
      description: '八宅风水排盘并生成结构化 AI 解读提示词',
      inputSchema: baZhaiSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateBaZhai(args);
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question, {
            method: 'bazhai',
            measurement: (result as { directionMeasurement?: { promptText: string } })
              .directionMeasurement?.promptText,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成八宅提示词失败'));
      }
    },
  );
}
