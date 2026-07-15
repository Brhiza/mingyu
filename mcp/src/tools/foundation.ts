import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  analyzeCompassDirection,
  analyzeWuxing,
  describeGanZhi,
  getFoundationCapabilities,
} from 'mingyu-core/foundation';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';

const ganZhiSchema = z.object({
  ganZhi: z.string().length(2).describe('六十甲子，如“甲子”“甲辰”'),
});

const wuxingSchema = z.object({
  items: z.array(z.string()).min(1).max(32).describe('天干或地支数组，如 [“甲”,“子”,“丙”,“午”]'),
  weightHidden: z.boolean().optional().describe('是否计入地支藏干权重，默认 true'),
});

const directionSchema = z.object({
  degree: z.number().min(0).max(360).describe('朝向罗盘度数，正北为0°、顺时针增加，360°等同0°'),
});

export function registerFoundationTools(server: McpServer) {
  server.registerTool(
    'foundation_capabilities',
    {
      description: '获取命语公共地基能力目录：天干地支、六十甲子、五行、八卦、二十四山与通用神煞',
      inputSchema: {},
      outputSchema: resultOutputSchema,
    },
    async () => createStructuredToolResult({ result: getFoundationCapabilities() }),
  );

  server.registerTool(
    'foundation_ganzhi',
    {
      description:
        '查询单个六十甲子的序号、纳音、五行、阴阳、藏干与合冲刑害破，并返回稳定键、计算链、来源事实、证据汇总和解释限制',
      inputSchema: ganZhiSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({ result: describeGanZhi(args.ganZhi) });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '干支查询失败'));
      }
    },
  );

  server.registerTool(
    'foundation_wuxing',
    {
      description:
        '统计天干地支的五行分布，可选计入地支藏干权重，并返回逐项贡献、并列最高最低五行、计算链、证据汇总和解释限制',
      inputSchema: wuxingSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({
          result: analyzeWuxing(args.items, { weightHidden: args.weightHidden }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '五行分析失败'));
      }
    },
  );

  server.registerTool(
    'foundation_direction',
    {
      description:
        '将朝向罗盘度数换算为二十四山向山、相反坐山和后天八卦归属，并返回分界线状态、计算链、证据汇总与解释限制',
      inputSchema: directionSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({ result: analyzeCompassDirection(args.degree) });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '罗盘方位换算失败'));
      }
    },
  );
}
