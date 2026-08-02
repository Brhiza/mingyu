import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import type { MeihuaSettings } from 'mingyu-core/types';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpPositiveInteger, readMcpRequiredCustomDate } from './input-helpers.js';
import {
  assertMcpNoRandomOptions,
  randomOptionShape,
  readMcpRandomOptions,
} from './random-options.js';

const meihuaSchema = z.object({
  ...randomOptionShape,
  method: z
    .enum(['time', 'number', 'random', 'timeTrigram'])
    .describe(
      '起卦方式：time=时间起卦, number=数字起卦, random=随机起卦, timeTrigram=兼容旧参数并按时间起卦',
    ),
  number: z.number().optional().describe('数字起卦时使用的正整数'),
  customDate: z.string().describe('明确的起卦时间（ISO 8601 格式）'),
});

const meihuaPromptSchema = extendPromptSchema(meihuaSchema, '用户希望围绕卦盘解读的问题');

function buildMeihuaSettings(args: z.infer<typeof meihuaSchema>): MeihuaSettings {
  const method = args.method;
  if (method !== 'random') {
    assertMcpNoRandomOptions(args, '梅花易数仅随机起卦接受 seed 或 replay。');
  }
  return {
    method,
    ...(method === 'number' ? { number: readMcpPositiveInteger(args.number, 'number') } : {}),
    ...(method === 'random' ? readMcpRandomOptions(args) : {}),
  };
}

export function registerMeihuaTool(server: McpServer) {
  server.registerTool(
    'divine_meihua',
    {
      description:
        '梅花易数起卦：支持时间起卦、数字起卦、随机起卦，timeTrigram 作为兼容旧参数按时间起卦计算，生成主卦、互卦、变卦、体用生克分析、坐端与万物耳目外应资料边界、饮食、观物占物、物数为体、变爻取象、现场克应、趣时、历史用易实例与手中物规则边界、诸事响应专项情境与风险边界、占卜十应目录与正互变三应复用及七应资料边界、论事十大应目录与现场及日辰口径边界、卦应八卦目录与说卦版本边界、反对性情综错卦、抽象卦义与版本边界、全卦克应候选及事项情境边界',
      inputSchema: meihuaSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const settings = buildMeihuaSettings(args);
        const result = generateMeihua(readMcpRequiredCustomDate(args.customDate), settings);
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '起卦失败'));
      }
    },
  );

  server.registerTool(
    'meihua_prompt',
    {
      description:
        '梅花易数起卦并生成结构化 AI 解读提示词：一次调用返回卦盘数据（含主互变卦、体用生克、坐端与万物耳目外应资料边界、饮食、观物占物、物数为体、变爻取象、现场克应、趣时、历史用易实例与手中物规则边界、诸事响应专项情境与风险边界、占卜十应目录与正互变三应复用及七应资料边界、论事十大应目录与现场及日辰口径边界、卦应八卦目录与说卦版本边界、反对性情综错卦、抽象卦义与版本边界、全卦克应候选与事项情境边界）和可直接复制给 AI 的提示词',
      inputSchema: meihuaPromptSchema.shape,
      outputSchema: {
        result: z.unknown().describe('梅花易数卦盘数据'),
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const settings = buildMeihuaSettings(args);
        const result = generateMeihua(readMcpRequiredCustomDate(args.customDate), settings);
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('meihua', args.question, result, args.promptMode),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成梅花提示词失败'));
      }
    },
  );
}
