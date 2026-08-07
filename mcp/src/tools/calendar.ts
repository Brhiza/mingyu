import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  buildAstronomicalTimeEvidence,
  calculateMoonPhaseEvidence,
  calculateSolarIlluminationEvidence,
  calculateSolarTermEvidence,
  convertTrueSolarTime,
  resolveTrueSolarBirthTime,
} from 'mingyu-core/calendar';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';

const trueSolarTimeSchema = z.object({
  localDateTime: z
    .string()
    .describe('当地钟表时间，如 1990-05-15T10:30:00；不要附带 Z 或 +08:00 等时区后缀'),
  longitude: z.number().min(-180).max(180).describe('当地经度，东经为正、西经为负'),
  timezone: z
    .number()
    .min(-12)
    .max(14)
    .optional()
    .describe('固定 UTC 偏移；未提供 timeZoneId 时默认 UTC+8，也可用于回拨时间消歧'),
  timeZoneId: z.string().min(1).optional().describe('IANA 历史时区，如 America/New_York'),
  applyChinaDst: z
    .boolean()
    .optional()
    .describe('是否按中国 1986-1991 历史规则自动还原夏令时，默认 false'),
});

const trueSolarBirthSchema = z.object({
  dateType: z.enum(['solar', 'lunar']).describe('日期类型：公历或农历'),
  year: z.number().int().min(1900).max(2100),
  month: z.number().int().min(1).max(12),
  day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
  second: z.number().int().min(0).max(59).optional().describe('秒，默认 0'),
  isLeapMonth: z.boolean().optional().describe('农历是否为闰月'),
  longitude: z.number().min(-180).max(180).describe('当地经度，东经为正、西经为负'),
  timezone: z
    .number()
    .min(-12)
    .max(14)
    .optional()
    .describe('固定 UTC 偏移；未提供 timeZoneId 时默认 UTC+8，也可用于回拨时间消歧'),
  timeZoneId: z.string().min(1).optional().describe('IANA 历史时区，如 America/New_York'),
  applyChinaDst: z.boolean().optional().describe('是否自动还原中国历史夏令时'),
});

const solarIlluminationSchema = z
  .object({
    year: z.number().int().min(1900).max(2200),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    hour: z.number().int().min(0).max(23).optional().describe('参考当地小时，默认12'),
    minute: z.number().int().min(0).max(59).optional().describe('参考当地分钟，默认0'),
    second: z.number().int().min(0).max(59).optional().describe('参考当地秒，默认0'),
    latitude: z.number().min(-90).max(90).describe('纬度，北纬为正'),
    longitude: z.number().min(-180).max(180).describe('经度，东经为正'),
    timezone: z.number().min(-12).max(14).optional().describe('法定UTC偏移'),
    timeZoneId: z.string().min(1).optional().describe('IANA历史时区，如 Asia/Shanghai'),
  })
  .refine((value) => value.timezone !== undefined || Boolean(value.timeZoneId), {
    message: 'timezone 与 timeZoneId 至少需要提供一项',
  });

const astronomicalTimeSchema = z
  .object({
    year: z.number().int().min(1900).max(2200),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    hour: z.number().int().min(0).max(23).optional().describe('当地小时，默认0'),
    minute: z.number().int().min(0).max(59).optional().describe('当地分钟，默认0'),
    second: z.number().int().min(0).max(59).optional().describe('当地秒，默认0'),
    timezone: z.number().min(-12).max(14).optional().describe('固定法定UTC偏移'),
    timeZoneId: z.string().min(1).optional().describe('IANA历史时区，如 Asia/Shanghai'),
  })
  .refine((value) => value.timezone !== undefined || Boolean(value.timeZoneId), {
    message: 'timezone 与 timeZoneId 至少需要提供一项',
  });

const moonPhaseSchema = z.object({
  utcDateTime: z
    .string()
    .datetime({ offset: true })
    .describe('带 Z 或 UTC 偏移的 ISO 时间，如 2024-06-21T12:00:00Z'),
});

const solarTermSchema = z.object({
  year: z.number().int().min(1900).max(2200).describe('节气所属历表年份'),
  index: z.number().int().min(0).max(23).describe('节气索引：0冬至、1小寒、2大寒、3立春……23大雪'),
});

export function registerCalendarTools(server: McpServer) {
  server.registerTool(
    'calendar_true_solar_time',
    {
      description:
        '将当地钟表时间按固定偏移或IANA历史时区换算为真太阳时，返回唯一校正时间、经度与均时差修正、跨日和时辰结果，以及可核验的计算链、校正事实、证据汇总、来源与限制',
      inputSchema: trueSolarTimeSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({ result: convertTrueSolarTime(args) });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '真太阳时换算失败'));
      }
    },
  );

  server.registerTool(
    'calendar_true_solar_birth',
    {
      description:
        '统一按固定偏移或IANA历史时区换算公历或农历出生真太阳时，返回历法换算、历史夏令时、跨日、唯一时辰索引及完整结构化计算链、校正事实、证据汇总、来源与限制',
      inputSchema: trueSolarBirthSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({ result: resolveTrueSolarBirthTime(args) });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '出生真太阳时换算失败'));
      }
    },
  );

  server.registerTool(
    'calendar_solar_illumination',
    {
      description:
        '按日期、地点和历史时区计算太阳高度、方位、视太阳正午、日出日落及民用/航海/天文曙暮光结构化证据',
      inputSchema: solarIlluminationSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const parsed = solarIlluminationSchema.parse(args);
        return createStructuredToolResult({
          result: calculateSolarIlluminationEvidence({
            ...parsed,
            hour: parsed.hour ?? 12,
            minute: parsed.minute ?? 0,
            second: parsed.second ?? 0,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '太阳光照证据计算失败'));
      }
    },
  );

  server.registerTool(
    'calendar_astronomical_time',
    {
      description:
        '将当地钟表时间和固定偏移或IANA历史时区换算为UTC、JD(UTC)、近似UT1、ΔT与近似TT，并返回时区诊断、计算链、反证和精度限制',
      inputSchema: astronomicalTimeSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const parsed = astronomicalTimeSchema.parse(args);
        return createStructuredToolResult({
          result: buildAstronomicalTimeEvidence({
            ...parsed,
            hour: parsed.hour ?? 0,
            minute: parsed.minute ?? 0,
            second: parsed.second ?? 0,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '天文时间尺度证据计算失败'));
      }
    },
  );

  server.registerTool(
    'calendar_moon_phase',
    {
      description:
        '按UTC时刻计算日月黄经差、八分月相、照明比例、近似月龄及前后朔弦望求根事件，并返回计算链、汇总与精度限制',
      inputSchema: moonPhaseSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const parsed = moonPhaseSchema.parse(args);
        return createStructuredToolResult({
          result: calculateMoonPhaseEvidence(Date.parse(parsed.utcDateTime)),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '月相证据计算失败'));
      }
    },
  );

  server.registerTool(
    'calendar_solar_term',
    {
      description:
        '查询单个二十四节气交接证据：采用tyme4ts历表时刻，并用低阶太阳视黄经独立求根核验差值，返回计算链、汇总和精度限制',
      inputSchema: solarTermSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({
          result: calculateSolarTermEvidence(args.year, args.index),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '节气交接证据计算失败'));
      }
    },
  );
}
