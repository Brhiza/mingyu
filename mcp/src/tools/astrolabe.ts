import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { analyzeAstrolabeSynastry } from 'mingyu-core/divination/astrolabe-synastry';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import { ASTROLABE_PROMPT_TOPICS } from '../../../src/lib/astrolabe-prompts.js';
import {
  buildAstrolabeFullScopeContexts,
  buildAstrolabeScopeContext,
} from '../../../src/lib/astrolabe-scope.js';
import { buildAstrolabeSynastryPrompt } from '../../../src/lib/astrolabe-synastry-prompt.js';
import type { AstrolabeData } from '../../../src/types/divination.js';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import {
  buildCommonDivinationPrompt,
  extendOptionalQuestionPromptSchema,
  extendPromptSchema,
} from './divination-common.js';
import {
  assertMcpSolarBirthDate,
  readMcpIntegerLikeInRange,
  readMcpNumberLikeInRange,
} from './input-helpers.js';

const astrolabeSchema = z.object({
  name: z.string().optional().describe('姓名（可选）'),
  gender: z.enum(['男', '女', '']).optional().describe('性别'),
  year: z.number().describe('出生年'),
  month: z.number().describe('出生月'),
  day: z.number().describe('出生日'),
  hour: z.number().describe('出生小时'),
  minute: z.number().describe('出生分钟'),
  latitude: z.number().describe('出生地纬度'),
  longitude: z.number().describe('出生地经度'),
  timezone: z.number().optional().describe('固定时区偏移，例如中国大陆通常为 8'),
  timeZoneId: z
    .string()
    .optional()
    .describe('IANA 历史时区，例如 Asia/Shanghai；推荐用于历史出生时间和夏令时地区'),
  locationName: z.string().optional().describe('出生地点名称'),
  useTrueSolarTime: z
    .boolean()
    .optional()
    .describe('是否附带真太阳时参考证据；不改变现代星历采用的实际出生瞬间'),
});

const astrolabePromptScopes = ['natal', 'full', 'yearly', 'monthly', 'daily'] as const;

const astrolabePromptSchema = extendPromptSchema(
  astrolabeSchema.extend({
    astrolabeTopic: z.enum(ASTROLABE_PROMPT_TOPICS).optional().describe('星盘提示词主题'),
    astrolabeScope: z
      .enum(astrolabePromptScopes)
      .optional()
      .describe('星盘分析范围：natal=本命, full=完整输出版, yearly=流年, monthly=流月, daily=流日'),
    astrolabeScopeDate: z
      .string()
      .optional()
      .describe(
        '星盘行运日期；full 和 daily 用 YYYY-MM-DD，yearly 用 YYYY，monthly 用 YYYY-MM；除 natal 外必填',
      ),
    astrolabeScopeText: z
      .string()
      .optional()
      .describe('星盘分析对象文本，例如本命、流年、流月或流日范围与行运证据；传入后优先使用'),
  }),
  'astrolabe',
  '用户希望围绕星盘解读的问题',
);

const astrolabeSynastrySchema = z.object({
  person1: astrolabeSchema.describe('第一人的出生资料'),
  person2: astrolabeSchema.describe('第二人的出生资料'),
});

const astrolabeSynastryPromptSchema = extendOptionalQuestionPromptSchema(
  astrolabeSynastrySchema,
  'astrolabe',
  '用户希望围绕双方关系解读的问题；省略时先做整体互动分析',
);

function buildAstrolabeInput(args: z.infer<typeof astrolabeSchema>): AstrolabeBirthInput {
  assertMcpSolarBirthDate({
    year: args.year,
    month: args.month,
    day: args.day,
  });

  const hour = readMcpIntegerLikeInRange(args.hour, 'hour', 0, 23);
  const minute = readMcpIntegerLikeInRange(args.minute, 'minute', 0, 59);
  const latitude = readMcpNumberLikeInRange(args.latitude, 'latitude', -90, 90);
  const longitude = readMcpNumberLikeInRange(args.longitude, 'longitude', -180, 180);
  if (args.timezone === undefined && !args.timeZoneId) {
    throw new Error('timezone 与 timeZoneId 至少需要提供一项。');
  }
  const timezone =
    args.timezone === undefined
      ? undefined
      : readMcpNumberLikeInRange(args.timezone, 'timezone', -12, 14);

  return {
    name: args.name ?? '',
    gender: args.gender ?? '',
    year: String(args.year),
    month: String(args.month),
    day: String(args.day),
    hour: String(hour),
    minute: String(minute),
    latitude: String(latitude),
    longitude: String(longitude),
    ...(timezone !== undefined ? { timezone: String(timezone) } : {}),
    ...(args.timeZoneId ? { timeZoneId: args.timeZoneId } : {}),
    locationName: args.locationName ?? '',
    useTrueSolarTime: args.useTrueSolarTime ?? false,
  };
}

function buildAstrolabeResult(args: z.infer<typeof astrolabeSchema>) {
  return generateAstrolabe(buildAstrolabeInput(args));
}

function buildAstrolabeSynastryResult(args: z.infer<typeof astrolabeSynastrySchema>) {
  const chart1 = buildAstrolabeResult(args.person1);
  const chart2 = buildAstrolabeResult(args.person2);
  return {
    charts: { person1: chart1, person2: chart2 },
    synastry: analyzeAstrolabeSynastry(chart1, chart2),
  };
}

function buildAstrolabeFullScopePromptText(data: AstrolabeData, referenceDateStr: string) {
  const fullContexts = buildAstrolabeFullScopeContexts(data, referenceDateStr);
  const contexts = [
    fullContexts.natal,
    fullContexts.yearly,
    fullContexts.monthly,
    fullContexts.daily,
  ];
  const lines = contexts
    .map((context) => context.promptText)
    .filter(Boolean)
    .map((line, index) => `${index + 1}. ${line}`);

  return ['分析对象：本命盘与完整行运资料。', '完整星盘行运资料：', ...lines].join('\n');
}

function buildAstrolabePromptScopeText(
  args: z.infer<typeof astrolabePromptSchema>,
  result: AstrolabeData,
) {
  const customText = args.astrolabeScopeText?.trim();
  if (customText) return customText;

  const scope = args.astrolabeScope ?? 'natal';
  const dateStr = scope === 'natal' ? '' : requireAstrolabeScopeDate(args.astrolabeScopeDate);
  if (scope === 'full') {
    return buildAstrolabeFullScopePromptText(result, dateStr);
  }

  return buildAstrolabeScopeContext(result, scope, dateStr).promptText;
}

function requireAstrolabeScopeDate(dateStr: string | undefined) {
  if (!dateStr?.trim()) {
    throw new Error('除 natal 外必须提供 astrolabeScopeDate。');
  }
  return dateStr;
}

function buildAstrolabeScopeEvidence(
  args: z.infer<typeof astrolabePromptSchema>,
  result: AstrolabeData,
) {
  const customText = args.astrolabeScopeText?.trim();
  if (customText) return { scope: 'custom' as const, promptText: customText };

  const scope = args.astrolabeScope ?? 'natal';
  const dateStr = scope === 'natal' ? '' : requireAstrolabeScopeDate(args.astrolabeScopeDate);
  if (scope === 'full') {
    return {
      scope: 'full' as const,
      referenceDate: dateStr,
      contexts: buildAstrolabeFullScopeContexts(result, dateStr),
    };
  }

  return buildAstrolabeScopeContext(result, scope, dateStr);
}

export function registerAstrolabeTool(server: McpServer) {
  server.registerTool(
    'divine_astrolabe',
    {
      description:
        '星盘生成：根据民用出生时间、经纬度和时区生成星体、宫位、相位、元素模式及结构化证据；可附带真太阳时参考，但不改写现代星历时刻',
      inputSchema: { ...astrolabeSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = buildAstrolabeResult(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '星盘生成失败'));
      }
    },
  );

  server.registerTool(
    'astrolabe_prompt',
    {
      description:
        '星盘生成并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要星盘和结构化证据时调用 divine_astrolabe',
      inputSchema: astrolabePromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = buildAstrolabeResult(args);
        return createStructuredToolResult({
          result: { ...result, scopeEvidence: buildAstrolabeScopeEvidence(args, result) },
          prompt: buildCommonDivinationPrompt('astrolabe', args.question, result, args.promptMode, {
            astrolabeTopic: args.astrolabeTopic,
            astrolabeScopeText: buildAstrolabePromptScopeText(args, result),
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成星盘提示词失败'));
      }
    },
  );

  server.registerTool(
    'astrolabe_synastry',
    {
      description:
        '西洋占星双盘关系计算：返回双方本命盘、主要跨盘相位、精确角距、容许度、跨盘落宫与结构化证据',
      inputSchema: { ...astrolabeSynastrySchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult(
          { result: buildAstrolabeSynastryResult(args) },
          args.detailMode,
        );
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '西占双盘计算失败'));
      }
    },
  );

  server.registerTool(
    'astrolabe_synastry_prompt',
    {
      description:
        '西洋占星双盘计算并生成可直接使用的完整任务书，仅返回提示词；需要本命盘和跨盘证据时调用 astrolabe_synastry',
      inputSchema: astrolabeSynastryPromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的双盘证据提示词'),
      },
    },
    async (args) => {
      try {
        const result = buildAstrolabeSynastryResult(args);
        return createStructuredToolResult({
          result,
          prompt: buildAstrolabeSynastryPrompt({
            chart1: result.charts.person1,
            chart2: result.charts.person2,
            synastry: result.synastry,
            question: args.question,
            promptMode: args.promptMode,
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成西占双盘提示词失败'));
      }
    },
  );
}
