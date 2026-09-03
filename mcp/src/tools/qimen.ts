import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  generateQimen,
  calculateQimenLifetime,
  generateQimenLifetimePrompt,
} from 'mingyu-core/divination/qimen';
import type { QimenLifetimeInput } from 'mingyu-core/types';
import { calculationDetailShape, promptOutputSchema, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpCustomDate } from './input-helpers.js';

const qimenSchema = z.object({
  customDate: z
    .string()
    .optional()
    .describe('自定义排盘时间（ISO 8601 格式），不提供则使用当前时间'),
  qimenMethod: z
    .enum(['zhuanpan', 'feipan'])
    .optional()
    .describe('排盘方法：zhuanpan 为转盘法（默认），feipan 为飞盘法'),
  qimenScope: z
    .enum(['hour', 'day', 'month', 'year'])
    .optional()
    .describe('排盘层级：hour 时家（默认）、day 日家、month 月家、year 年家'),
  qimenJuMethod: z
    .enum(['chaibu', 'zhirun'])
    .optional()
    .describe('定局方法：chaibu 为拆补法（默认），zhirun 为置闰法；仅时家/日家生效'),
});

const qimenPromptSchema = extendPromptSchema(qimenSchema, 'qimen', '用户希望围绕奇门盘解读的问题');

const qimenLifetimeSchema = z.object({
  birthDateTime: z.string().describe('出生时刻（ISO 8601 格式，如 1990-05-15T14:30:00）'),
  timeZoneId: z.string().optional().describe('IANA 时区标识符（如 Asia/Shanghai）'),
  timezone: z.number().optional().describe('固定 UTC 偏移（默认 8）'),
  location: z
    .object({
      longitude: z.number().describe('经度（-180~180）'),
      latitude: z.number().optional().describe('纬度（-90~90）'),
      locationName: z.string().optional().describe('地点名称'),
    })
    .optional()
    .describe('出生地点与经纬度（启用真太阳时必须提供经度）'),
  calendarType: z.enum(['solar', 'lunar']).optional().describe('历法类型：solar 为公历（默认），lunar 为农历'),
  isLeapMonth: z.boolean().optional().describe('农历是否闰月'),
  timeStandard: z.enum(['civil', 'trueSolar']).optional().describe('时间标准：civil 为法定民用时（默认），trueSolar 为真太阳时'),
  applyChinaDst: z.boolean().optional().describe('是否按中国 1986-1991 规则自动还原夏令时'),
  method: z.enum(['zhuanpan', 'feipan']).optional().describe('排盘方法：zhuanpan 为转盘法（默认），feipan 为飞盘法'),
  juMethod: z.enum(['chaibu', 'zhirun']).optional().describe('定局方法：chaibu 为拆补法（默认），zhirun 为置闰法'),
  stagePolicy: z
    .object({
      model: z.enum(['pillarFourLimits', 'palaceWalk', 'fuShiHexagramOrbit']).describe('阶段模型：pillarFourLimits(四柱分限法，默认) | palaceWalk(洛书九宫巡行法) | fuShiHexagramOrbit(符使卦轨法)'),
      anchorRule: z.enum(['birthInstant', 'solarTermBoundary', 'lunarNewYear']).optional(),
      ageSystem: z.enum(['fullYears', 'nominalAge']).optional(),
      yearsPerStage: z.number().optional(),
    })
    .optional()
    .describe('阶段引擎策略配置'),
  periodRange: z
    .object({
      startDate: z.string().describe('起始日期（YYYY-MM-DD）'),
      endDate: z.string().describe('结束日期（YYYY-MM-DD）'),
    })
    .optional()
    .describe('动态扫描的时间区间'),
  name: z.string().optional().describe('求测者姓名或代号'),
  gender: z.enum(['male', 'female']).optional().describe('性别：male 为男，female 为女'),
  schools: z.array(z.string()).optional().describe('流派或解读侧重'),
});

const qimenLifetimePromptSchema = qimenLifetimeSchema.extend({
  question: z.string().describe('用户围绕终身局宏观格局或阶段运限希望解读的问题'),
});

export function registerQimenTool(server: McpServer) {
  server.registerTool(
    'divine_qimen',
    {
      description:
        '奇门遁甲排盘：基于当前时间或自定义时间生成时家、日家、月家或年家奇门盘，包含天地人神四盘、值符值使、格局标签、节令背景、复合格局与宫位洞察',
      inputSchema: { ...qimenSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const method = args.qimenMethod ?? 'zhuanpan';
        const scope = args.qimenScope ?? 'hour';
        const juMethod = args.qimenJuMethod ?? 'chaibu';
        const result = generateQimen(
          readMcpCustomDate(args.customDate),
          method as 'zhuanpan' | 'feipan',
          scope,
          juMethod as 'chaibu' | 'zhirun',
        );
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '排盘失败'));
      }
    },
  );

  server.registerTool(
    'qimen_prompt',
    {
      description:
        '奇门遁甲排盘并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要完整奇门盘时调用 divine_qimen',
      inputSchema: qimenPromptSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const method = args.qimenMethod ?? 'zhuanpan';
        const scope = args.qimenScope ?? 'hour';
        const juMethod = args.qimenJuMethod ?? 'chaibu';
        const result = generateQimen(
          readMcpCustomDate(args.customDate),
          method as 'zhuanpan' | 'feipan',
          scope,
          juMethod as 'chaibu' | 'zhirun',
        );
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('qimen', args.question, result, args.promptMode, {
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成奇门提示词失败'));
      }
    },
  );

  server.registerTool(
    'divine_qimen_lifetime',
    {
      description:
        '奇门遁甲终身局排盘：基于出生时间计算终身本命基础盘、个人年命标记、六亲主题宫、人生阶段运限卡及动态事件簇',
      inputSchema: { ...qimenLifetimeSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateQimenLifetime(args as unknown as QimenLifetimeInput);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '终身局排盘失败'));
      }
    },
  );

  server.registerTool(
    'qimen_lifetime_prompt',
    {
      description:
        '奇门遁甲终身局排盘并生成自包含的 AI 解读提示词任务书，用于全面推演人生长期结构、运限阶段与关键窗口',
      inputSchema: qimenLifetimePromptSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const { prompt, data } = generateQimenLifetimePrompt(
          args as unknown as QimenLifetimeInput,
          args.question,
        );
        return createStructuredToolResult({ result: data, prompt });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成终身局提示词失败'));
      }
    },
  );
}
