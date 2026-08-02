import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { analyzeBaziCompatibility, buildFortuneSelectionContext } from '@core/bazi/audited';
import type { Person } from '@core/bazi/baziTypes';
import type { BaziFortuneSelectionValue } from '@core/bazi/fortuneSelection';
import { getTimeIndexFromClock } from 'mingyu-core/calendar';
import { appendTraditionalResearchNotice } from 'mingyu-core/prompt-evidence';
import { getCompatibilityPrompt, type CompatType } from '../../../src/utils/ai/aiPrompts.js';
import {
  BAZI_PROMPT_TOPICS,
  BAZI_FORTUNE_SCOPES,
  BAZI_SCHOOLS,
  PROMPT_MODES,
  buildBaziPromptForResult,
  type BaziPromptTopic,
  type BaziSchool,
  type PromptMode,
} from '../../../src/lib/public-api/prompt-builders.js';
import { promptOutputSchema, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import {
  assertMcpBirthDate,
  readMcpIntegerLikeInRange,
  readMcpNumberLikeInRange,
} from './input-helpers.js';

export const baziSchema = z.object({
  name: z.string().optional().describe('称呼（可选，用于双盘证据来源标注）'),
  gender: z.enum(['male', 'female']).describe('性别：male 为男，female 为女'),
  year: z.number().describe('出生年'),
  month: z.number().describe('出生月'),
  day: z.number().describe('出生日'),
  timeIndex: z
    .number()
    .optional()
    .describe('时辰索引：0=早子时,1=丑时,...,12=晚子时；未启用真太阳时时必填'),
  dateType: z.enum(['solar', 'lunar']).describe('日期类型：solar 为阳历，lunar 为农历'),
  isLeapMonth: z.boolean().optional().describe('是否为闰月（仅农历有效）'),
  useTrueSolarTime: z.boolean().optional().describe('是否启用真太阳时校正'),
  birthHour: z.number().optional().describe('精准出生小时，启用真太阳时时必填'),
  birthMinute: z.number().optional().describe('精准出生分钟，启用真太阳时时必填'),
  birthPlace: z.string().optional().describe('出生地名称，启用真太阳时时可选'),
  birthLongitude: z.number().optional().describe('出生地经度，启用真太阳时时必填'),
  birthTimezone: z.number().optional().describe('出生地固定时区，启用真太阳时时必填，例如中国为 8'),
  applyChinaDst: z
    .boolean()
    .optional()
    .describe('是否明确按中国 1986-1991 历史夏令时校正；默认不启用'),
});

const baziCompatibilityTypes = [
  'marriage',
  'career',
  'friendship',
  'children',
  'parents',
  'siblings',
] as const;

const baziCompatibilitySchema = z.object({
  person1: baziSchema.describe('第一人的出生资料'),
  person2: baziSchema.describe('第二人的出生资料'),
});

const baziCompatibilityPromptSchema = baziCompatibilitySchema.extend({
  question: z.string().optional().describe('希望围绕双方关系解读的问题；省略时先做整体合盘'),
  compatType: z
    .enum(baziCompatibilityTypes)
    .optional()
    .describe('关系范围：婚恋、合作、友情、亲子、父母或兄弟姐妹'),
  promptMode: z
    .enum(PROMPT_MODES)
    .optional()
    .describe('提示词模式：framework=完整框架，custom=只围绕自定义问题'),
});

const baziPromptSchema = baziSchema.extend({
  question: z.string().describe('用户希望围绕命盘解读的问题'),
  promptTopic: z
    .enum(BAZI_PROMPT_TOPICS)
    .optional()
    .describe(
      '提示词主题：general=综合, career=事业, wealth=财运, marriage=婚恋, children=子女, health=健康',
    ),
  promptMode: z
    .enum(PROMPT_MODES)
    .optional()
    .describe('提示词模式：framework=内置完整框架, custom=只围绕用户问题自由作答'),
  school: z
    .enum(BAZI_SCHOOLS)
    .optional()
    .describe(
      '八字流派：traditional=传统派（子平正法、格局调候）, mangpai=盲派（十神象法、年限分段）, xinpai=新派（调候流通）。不传则不附加流派指引',
    ),
  baziFortuneScope: z
    .enum(BAZI_FORTUNE_SCOPES)
    .optional()
    .describe(
      '八字命限范围：natal=本命, full=完整输出版, dayun=大运, year=流年, month=流月, day=流日',
    ),
  baziFortuneCycleIndex: z
    .number()
    .optional()
    .describe('大运序号，从 0 开始；选择大运时必须与年份至少提供一项'),
  baziFortuneYear: z
    .number()
    .optional()
    .describe('指定年份；选择流年、流月或流日时必填，也可用于定位大运'),
  baziFortuneMonth: z.number().optional().describe('指定流月序号；选择流月或流日时必填'),
  baziFortuneDay: z.number().optional().describe('指定流日序号；选择流日时必填'),
});

export function buildBaziPerson(args: z.infer<typeof baziSchema>): Person {
  const useTrueSolarTime = args.useTrueSolarTime ?? false;
  assertMcpBirthDate({
    year: args.year,
    month: args.month,
    day: args.day,
    dateType: args.dateType,
    isLeapMonth: args.isLeapMonth,
  });

  if (useTrueSolarTime) {
    if (
      typeof args.birthHour !== 'number' ||
      typeof args.birthMinute !== 'number' ||
      typeof args.birthLongitude !== 'number' ||
      typeof args.birthTimezone !== 'number'
    ) {
      throw new Error('真太阳时缺少精准时间、经度或时区。');
    }

    const birthHour = readMcpIntegerLikeInRange(args.birthHour, 'birthHour', 0, 23);
    const birthMinute = readMcpIntegerLikeInRange(args.birthMinute, 'birthMinute', 0, 59);
    const birthLongitude = readMcpNumberLikeInRange(
      args.birthLongitude,
      'birthLongitude',
      -180,
      180,
    );
    const birthTimezone = readMcpNumberLikeInRange(args.birthTimezone, 'birthTimezone', -12, 14);
    const derivedTimeIndex = getTimeIndexFromClock(birthHour, birthMinute);
    if (derivedTimeIndex < 0) {
      throw new Error('birthHour 和 birthMinute 无法换算为有效时辰。');
    }

    return {
      gender: args.gender,
      year: args.year,
      month: args.month,
      day: args.day,
      timeIndex: derivedTimeIndex,
      isLunar: args.dateType === 'lunar',
      isLeapMonth: args.isLeapMonth ?? false,
      useTrueSolarTime,
      birthHour,
      birthMinute,
      birthPlace: args.birthPlace ?? '',
      birthLongitude,
      birthTimezone,
      applyChinaDst: args.applyChinaDst ?? false,
    };
  }

  if (typeof args.timeIndex !== 'number') {
    throw new Error('请选择出生时辰。');
  }

  const timeIndex = readMcpIntegerLikeInRange(args.timeIndex, 'timeIndex', 0, 12);

  return {
    gender: args.gender,
    year: args.year,
    month: args.month,
    day: args.day,
    timeIndex,
    isLunar: args.dateType === 'lunar',
    isLeapMonth: args.isLeapMonth ?? false,
    useTrueSolarTime,
    applyChinaDst: args.applyChinaDst ?? false,
  };
}

export function registerBaziTool(server: McpServer) {
  server.registerTool(
    'bazi_calculate',
    {
      description:
        '八字排盘：根据出生信息计算四柱、十神、藏干、大运、神煞与本命证据，并保存可审核重建的规范化出生来源；启用真太阳时时同时返回统一计算链、校正事实、证据汇总和限制',
      inputSchema: baziSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const person = buildBaziPerson(args);
        const result = baziCalculator.calculateBazi(person);
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '排盘失败'));
      }
    },
  );

  server.registerTool(
    'bazi_prompt',
    {
      description:
        '八字排盘并生成结构化 AI 解读提示词：命盘、岁运资料和提示词只凭规范化出生来源及原始命限选择重建，不采信旧派生上下文；返回可直接复制给 AI 的完整任务书',
      inputSchema: baziPromptSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const person = buildBaziPerson(args);
        const result = baziCalculator.calculateBazi(person);
        const fortuneSelection: BaziFortuneSelectionValue = {
          scope: args.baziFortuneScope ?? 'natal',
          cycleIndex:
            args.baziFortuneScope &&
            args.baziFortuneScope !== 'natal' &&
            args.baziFortuneScope !== 'full' &&
            args.baziFortuneCycleIndex !== undefined
              ? readMcpIntegerLikeInRange(
                  args.baziFortuneCycleIndex,
                  'baziFortuneCycleIndex',
                  0,
                  99,
                )
              : undefined,
          year:
            args.baziFortuneYear === undefined
              ? undefined
              : readMcpIntegerLikeInRange(args.baziFortuneYear, 'baziFortuneYear', 1900, 2200),
          month:
            args.baziFortuneMonth === undefined
              ? undefined
              : readMcpIntegerLikeInRange(args.baziFortuneMonth, 'baziFortuneMonth', 1, 12),
          day:
            args.baziFortuneDay === undefined
              ? undefined
              : readMcpIntegerLikeInRange(args.baziFortuneDay, 'baziFortuneDay', 1, 31),
        };
        const fortuneSelectionContext = buildFortuneSelectionContext(result, fortuneSelection);
        const basePrompt = buildBaziPromptForResult({
          result,
          question: args.question,
          topic: (args.promptTopic ?? 'general') as BaziPromptTopic,
          mode: (args.promptMode ?? 'framework') as PromptMode,
          fortuneSelection,
          school: args.school as BaziSchool | undefined,
        });
        return createStructuredToolResult({
          result: {
            ...result,
            ...(fortuneSelectionContext ? { fortuneSelection: fortuneSelectionContext } : {}),
          },
          prompt: basePrompt,
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成八字提示词失败'));
      }
    },
  );

  server.registerTool(
    'bazi_compatibility',
    {
      description:
        '八字双盘结构化证据计算：返回双方命盘、日主与日支关系、四柱交叉合冲刑害破、双向十神、喜忌覆盖和证据包',
      inputSchema: baziCompatibilitySchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const chart1 = baziCalculator.calculateBazi(buildBaziPerson(args.person1));
        const chart2 = baziCalculator.calculateBazi(buildBaziPerson(args.person2));
        const compatibility = analyzeBaziCompatibility(chart1, chart2, {
          person1Name: args.person1.name,
          person2Name: args.person2.name,
        });
        return createStructuredToolResult({
          result: { charts: { person1: chart1, person2: chart2 }, compatibility },
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '八字双盘计算失败'));
      }
    },
  );

  server.registerTool(
    'bazi_compatibility_prompt',
    {
      description:
        '八字双盘计算并生成结构化 AI 解读提示词：返回双方命盘、可复核交叉证据和完整关系分析任务书',
      inputSchema: baziCompatibilityPromptSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const chart1 = baziCalculator.calculateBazi(buildBaziPerson(args.person1));
        const chart2 = baziCalculator.calculateBazi(buildBaziPerson(args.person2));
        const compatibility = analyzeBaziCompatibility(chart1, chart2, {
          person1Name: args.person1.name,
          person2Name: args.person2.name,
        });
        const promptParts = getCompatibilityPrompt(
          args.question ?? '',
          chart1,
          chart2,
          (args.compatType ?? 'marriage') as CompatType,
          {
            isCustomQuestion: args.promptMode === 'custom',
            person1Name: args.person1.name,
            person2Name: args.person2.name,
          },
        );
        const prompt = appendTraditionalResearchNotice(
          [promptParts.system, promptParts.user].filter(Boolean).join('\n\n'),
        );
        return createStructuredToolResult({
          result: { charts: { person1: chart1, person2: chart2 }, compatibility },
          prompt,
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成八字双盘提示词失败'));
      }
    },
  );
}
