import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import type { MeihuaSettings } from 'mingyu-core/types';
import { calculationDetailShape, promptOutputSchema, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpCustomDate, readMcpPositiveInteger } from './input-helpers.js';
import {
  assertMcpNoRandomOptions,
  randomOptionShape,
  readMcpRandomOptions,
} from './random-options.js';

const meihuaSchema = z.object({
  ...randomOptionShape,
  method: z
    .enum(['time', 'number', 'sound', 'character', 'direction', 'random', 'timeTrigram'])
    .optional()
    .describe(
      '起卦方式：time=时间起卦, number=数字起卦, sound=声音起卦, character=字数起卦, direction=方位取象, random=随机起卦, timeTrigram=兼容旧参数并按时间起卦',
    ),
  number: z.number().optional().describe('数字起卦时使用的正整数'),
  soundCount: z.number().optional().describe('声音起卦时记录的所闻声音数'),
  characterText: z.string().optional().describe('字数起卦时使用的原始文字'),
  characterCount: z.number().optional().describe('字数起卦时使用的字符数'),
  characterTones: z
    .array(z.number().int().min(1).max(4))
    .min(4)
    .max(10)
    .optional()
    .describe('4-10字时按顺序提供传统平、上、去、入声类对应的1-4数，不等同于普通话一至四声'),
  characterStrokeCounts: z
    .array(z.number().int().positive())
    .min(2)
    .max(3)
    .optional()
    .describe('2-3字时按顺序提供各字人工笔画数，避免字体差异'),
  characterLeftStrokes: z.number().optional().describe('单字起卦时左侧分笔数'),
  characterRightStrokes: z.number().optional().describe('单字起卦时右侧分笔数'),
  direction: z
    .enum(['northwest', 'west', 'south', 'east', 'southeast', 'north', 'northeast', 'southwest'])
    .optional()
    .describe('方位取象时的后天八卦方位'),
  objectType: z
    .enum(['heaven', 'lake', 'fire', 'thunder', 'wind', 'water', 'mountain', 'earth'])
    .optional()
    .describe('方位取象时所见物类对应的八卦自然象'),
  customDate: z
    .string()
    .optional()
    .describe('自定义起卦时间（ISO 8601 格式），不提供则使用当前时间'),
});

const meihuaPromptSchema = extendPromptSchema(meihuaSchema, 'meihua', '用户希望围绕卦盘解读的问题');

function buildMeihuaSettings(args: z.infer<typeof meihuaSchema>): MeihuaSettings {
  const method = args.method || 'time';
  if (method !== 'random') {
    assertMcpNoRandomOptions(args, '梅花易数仅随机起卦接受 seed 或 replay。');
  }
  return {
    method,
    ...(method === 'number' ? { number: readMcpPositiveInteger(args.number, 'number') } : {}),
    ...(method === 'sound'
      ? { soundCount: readMcpPositiveInteger(args.soundCount, 'soundCount') }
      : {}),
    ...(method === 'character'
      ? {
          ...(args.characterText !== undefined ? { characterText: args.characterText } : {}),
          ...(args.characterCount !== undefined
            ? { characterCount: readMcpPositiveInteger(args.characterCount, 'characterCount') }
            : {}),
          ...(args.characterTones !== undefined ? { characterTones: args.characterTones } : {}),
          ...(args.characterStrokeCounts !== undefined
            ? { characterStrokeCounts: args.characterStrokeCounts }
            : {}),
          ...(args.characterLeftStrokes !== undefined
            ? {
                characterLeftStrokes: readMcpPositiveInteger(
                  args.characterLeftStrokes,
                  'characterLeftStrokes',
                ),
              }
            : {}),
          ...(args.characterRightStrokes !== undefined
            ? {
                characterRightStrokes: readMcpPositiveInteger(
                  args.characterRightStrokes,
                  'characterRightStrokes',
                ),
              }
            : {}),
        }
      : {}),
    ...(method === 'direction'
      ? {
          direction: args.direction,
          objectType: args.objectType,
        }
      : {}),
    ...(method === 'random' ? readMcpRandomOptions(args) : {}),
  };
}

export function registerMeihuaTool(server: McpServer) {
  server.registerTool(
    'divine_meihua',
    {
      description:
        '梅花易数起卦：支持时间、数字、声音、字数、方位取象和随机起卦，timeTrigram 作为兼容旧参数按时间起卦计算，生成主卦、互卦、变卦/体用生克分析及应期判断',
      inputSchema: { ...meihuaSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const settings = buildMeihuaSettings(args);
        const result = generateMeihua(readMcpCustomDate(args.customDate), settings);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '起卦失败'));
      }
    },
  );

  server.registerTool(
    'meihua_prompt',
    {
      description:
        '梅花易数起卦并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要主互变卦等卦盘数据时调用 divine_meihua',
      inputSchema: meihuaPromptSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const settings = buildMeihuaSettings(args);
        const result = generateMeihua(readMcpCustomDate(args.customDate), settings);
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('meihua', args.question, result, args.promptMode, {
            schools: args.schools,
            topicId: args.topicId,
            subtopicId: args.subtopicId,
            scope: args.scope,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成梅花提示词失败'));
      }
    },
  );
}
