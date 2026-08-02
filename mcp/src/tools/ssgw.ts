import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { drawRandomSign } from 'mingyu-core/divination/ssgw';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpRequiredCustomDate } from './input-helpers.js';
import { randomOptionShape, readMcpRandomOptions } from './random-options.js';

const ssgwSchema = z.object({
  ...randomOptionShape,
  customDate: z.string().describe('明确的求签时间（ISO 8601 格式）'),
});

const ssgwPromptSchema = extendPromptSchema(ssgwSchema, '用户希望围绕灵签解读的问题');

function buildSsgwResult(args: z.infer<typeof ssgwSchema>) {
  return drawRandomSign(
    readMcpRequiredCustomDate(args.customDate),
    readMcpRandomOptions(args),
  );
}

export function registerSsgwTool(server: McpServer) {
  server.registerTool(
    'divine_ssgw',
    {
      description:
        '三山国王灵签签号抽取：从1至92签号池随机抽取编号，返回签号、可重放抽取轨迹和签谱待校状态。掷筊流程、杯象判定与终止规则来源未闭合，不自动模拟；签谱校勘完成前不返回签题、签诗、典故、吉凶或解签结论',
      inputSchema: ssgwSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = buildSsgwResult(args);
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '求签失败'));
      }
    },
  );

  server.registerTool(
    'ssgw_prompt',
    {
      description:
        '三山国王灵签抽取签号并生成结构化 AI 资料核对提示词：一次调用返回签号、可重放抽取轨迹、签谱与掷筊规则待校边界',
      inputSchema: ssgwPromptSchema.shape,
      outputSchema: {
        result: z.unknown().describe('灵签结果'),
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = buildSsgwResult(args);
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('ssgw', args.question, result, args.promptMode),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成灵签提示词失败'));
      }
    },
  );
}
