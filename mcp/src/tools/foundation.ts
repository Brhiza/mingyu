import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeWuxing, describeGanZhi, getFoundationCapabilities } from 'mingyu-core/foundation';
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
      description: '查询单个六十甲子的序号、纳音、五行、阴阳、藏干与合冲刑害破',
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
      description: '统计天干地支的五行分布，可选计入地支藏干权重',
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
}
