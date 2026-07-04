import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import {
  meihuaAnimalOptions,
  meihuaColorOptions,
  meihuaDirectionOptions,
  meihuaObjectOptions,
  meihuaPersonOptions,
  meihuaSoundOptions,
} from 'mingyu-core/divination/meihua-omens';
import type { MeihuaExternalOmens, MeihuaSettings } from 'mingyu-core/types';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import {
  assertMcpRecord,
  readMcpCustomDate,
  readMcpOptionalEnum,
  readMcpPositiveInteger,
} from './input-helpers.js';

const meihuaSchema = z.object({
  method: z
    .enum(['time', 'number', 'random', 'external', 'timeTrigram'])
    .optional()
    .describe(
      '起卦方式：time=时间起卦, number=数字起卦, random=随机起卦, external=外应起卦, timeTrigram=兼容旧参数并按时间起卦',
    ),
  number: z.number().optional().describe('数字起卦时使用的正整数'),
  externalOmens: z
    .object({
      direction: z
        .enum(['东', '东南', '南', '西南', '西', '西北', '北', '东北'])
        .optional()
        .describe('外应方向'),
      count: z.number().optional().describe('外应数量，用于取动爻'),
      person: z
        .enum(['老父', '老妇', '长男', '长女', '中男', '中女', '少男', '少女'])
        .optional()
        .describe('外应人物取象'),
      animal: z
        .enum(['马', '牛', '龙', '鸡', '猪', '雉', '狗', '羊'])
        .optional()
        .describe('外应动物取象'),
      object: z
        .enum([
          '金玉圆器',
          '布帛陶器',
          '竹木乐器',
          '绳索长木',
          '水器液体',
          '火电文书',
          '石块门板',
          '刀剪口器',
        ])
        .optional()
        .describe('外应物象'),
      sound: z
        .enum([
          '洪亮金石',
          '沉厚低缓',
          '雷鸣震动',
          '风声呼啸',
          '流水滴答',
          '爆裂鸣叫',
          '闷阻叩击',
          '清脆笑语',
        ])
        .optional()
        .describe('外应声音取象'),
      color: z
        .enum(['金白', '土黄', '青碧', '青绿', '黑蓝', '赤紫', '棕黄', '银白'])
        .optional()
        .describe('外应颜色取象'),
    })
    .optional()
    .describe('外应起卦信息：至少提供两项可映射外应，并提供 count'),
  customDate: z
    .string()
    .optional()
    .describe('自定义起卦时间（ISO 8601 格式），不提供则使用当前时间'),
});

const meihuaPromptSchema = extendPromptSchema(meihuaSchema, '用户希望围绕卦盘解读的问题');

function optionNames<const T extends string>(options: ReadonlyArray<{ name: T }>): T[] {
  return options.map((option) => option.name);
}

function readMcpMeihuaExternalOmens(value: unknown): MeihuaExternalOmens {
  assertMcpRecord(value, 'externalOmens');

  const externalOmens: MeihuaExternalOmens = {
    direction: readMcpOptionalEnum(
      value.direction,
      'direction',
      optionNames(meihuaDirectionOptions),
    ),
    person: readMcpOptionalEnum(value.person, 'person', optionNames(meihuaPersonOptions)),
    animal: readMcpOptionalEnum(value.animal, 'animal', optionNames(meihuaAnimalOptions)),
    object: readMcpOptionalEnum(value.object, 'object', optionNames(meihuaObjectOptions)),
    sound: readMcpOptionalEnum(value.sound, 'sound', optionNames(meihuaSoundOptions)),
    color: readMcpOptionalEnum(value.color, 'color', optionNames(meihuaColorOptions)),
    count: readMcpPositiveInteger(value.count as number | undefined, 'count'),
  };
  const mappedCount = [
    externalOmens.direction,
    externalOmens.person,
    externalOmens.animal,
    externalOmens.object,
    externalOmens.sound,
    externalOmens.color,
  ].filter(Boolean).length;

  if (mappedCount < 2) {
    throw new Error('外应起卦至少需要两项可映射的外应。');
  }

  return externalOmens;
}

function buildMeihuaSettings(args: z.infer<typeof meihuaSchema>): MeihuaSettings {
  const method = args.method || 'time';
  return {
    method,
    ...(method === 'number' ? { number: readMcpPositiveInteger(args.number, 'number') } : {}),
    ...(method === 'external'
      ? { externalOmens: readMcpMeihuaExternalOmens(args.externalOmens) }
      : {}),
  };
}

export function registerMeihuaTool(server: McpServer) {
  server.registerTool(
    'divine_meihua',
    {
      description:
        '梅花易数起卦：支持时间起卦、数字起卦、随机起卦、外应起卦，timeTrigram 作为兼容旧参数按时间起卦计算，生成主卦、互卦、变卦/体用生克分析及应期判断',
      inputSchema: meihuaSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const settings = buildMeihuaSettings(args);
        const result = generateMeihua(readMcpCustomDate(args.customDate), settings);
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
        '梅花易数起卦并生成结构化 AI 解读提示词：一次调用返回卦盘数据（含主互变卦、体用生克、应期判断）和可直接复制给 AI 的提示词',
      inputSchema: meihuaPromptSchema.shape,
      outputSchema: {
        result: z.unknown().describe('梅花易数卦盘数据'),
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const settings = buildMeihuaSettings(args);
        const result = generateMeihua(readMcpCustomDate(args.customDate), settings);
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
