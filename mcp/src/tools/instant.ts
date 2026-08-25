import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  INSTANT_CHART_TYPES,
  calculateInstantChart,
  type InstantObserver,
} from 'mingyu-core/instant';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { readMcpCustomDate } from './input-helpers.js';

const instantObserverSchema = z
  .object({
    locationName: z.string().min(1).optional().describe('观测地点名称'),
    longitude: z.number().min(-180).max(180).describe('观测地点经度，东经为正'),
    latitude: z.number().min(-90).max(90).optional().describe('观测地点纬度，北纬为正'),
    timezone: z.number().min(-12).max(14).optional().describe('固定 UTC 偏移'),
    timeZoneId: z.string().min(1).optional().describe('IANA 时区，如 Asia/Shanghai'),
  })
  .refine((value) => value.timezone !== undefined || Boolean(value.timeZoneId), {
    message: 'observer.timezone 与 observer.timeZoneId 至少需要提供一项',
  });

const instantChartSchema = z.object({
  type: z
    .enum(INSTANT_CHART_TYPES)
    .describe('即时排盘类型：八字、紫微、八字紫微合参、星盘或七政四余'),
  timeStandard: z
    .enum(['beijing', 'true-solar'])
    .optional()
    .describe('时间口径：beijing=北京时间（默认），true-solar=真太阳时'),
  customDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .describe('可重放时刻；不传即使用工具调用当刻'),
  observer: instantObserverSchema
    .optional()
    .describe('真太阳时必填；星盘和七政四余在两种口径下都必填'),
  ziweiAlgorithm: z
    .enum(['default', 'zhongzhou'])
    .optional()
    .describe('紫微安星算法；默认 default'),
  ...calculationDetailShape,
});

export function registerInstantTool(server: McpServer) {
  server.registerTool(
    'instant_chart',
    {
      description:
        '按调用当刻生成不绑定个人性别的即时盘，仅用于排盘。支持八字、紫微、八字紫微合参、星盘和七政四余，并明确区分北京时间与真太阳时；不用于六爻、梅花等占卜。',
      inputSchema: instantChartSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const parsed = instantChartSchema.parse(args);
        const observer: InstantObserver | undefined = parsed.observer
          ? { ...parsed.observer }
          : undefined;
        const result = await calculateInstantChart({
          type: parsed.type,
          customDate: readMcpCustomDate(parsed.customDate),
          timeStandard: parsed.timeStandard,
          observer,
          ziweiAlgorithm: parsed.ziweiAlgorithm,
        });
        return createStructuredToolResult({ result }, parsed.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '即时排盘失败'));
      }
    },
  );
}
