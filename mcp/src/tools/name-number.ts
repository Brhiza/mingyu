import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  analyzeChineseCharacters,
  selectChineseCharacters,
  analyzeChineseName,
  generateChineseNames,
  analyzeNumber,
  calculateZhugeNumber,
  castKongmingHexagram,
} from 'mingyu-core/name-number';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { randomOptionShape, readMcpRandomOptions } from './random-options.js';

const wuxing = z.enum(['金', '木', '水', '火', '土']);

export function registerNameNumberTools(server: McpServer) {
  server.registerTool(
    'name_generate',
    {
      description:
        '按姓氏、性别、名字字数和偏好五行生成中文姓名候选，并返回康熙笔画、五格、三才与综合评分',
      inputSchema: {
        surname: z.string().min(1).max(2).describe('一字或二字姓氏'),
        gender: z.enum(['男', '女', '通用']).optional().describe('名字用字倾向，默认通用'),
        givenNameLength: z
          .union([z.literal(1), z.literal(2)])
          .optional()
          .describe('名字字数，默认2'),
        preferredElements: z.array(wuxing).max(5).optional().describe('偏好五行，可多选'),
        limit: z.number().int().min(1).max(50).optional().describe('候选数量，默认20'),
      },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({ result: generateChineseNames(args) });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '起名失败'));
      }
    },
  );

  server.registerTool(
    'name_analyze',
    {
      description: '解析中文姓名的逐字资料、康熙笔画、五格数理、三才配置、五行分布与综合评分',
      inputSchema: {
        fullName: z.string().min(2).max(4).describe('完整中文姓名'),
        surnameLength: z
          .union([z.literal(1), z.literal(2)])
          .optional()
          .describe('姓氏字数，默认1'),
        preferredElements: z.array(wuxing).max(5).optional().describe('偏好五行，用于评估用字匹配'),
      },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({
          result: analyzeChineseName({
            fullName: args.fullName,
            surnameLength: args.surnameLength,
            xiYong: args.preferredElements,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '姓名解析失败'));
      }
    },
  );

  server.registerTool(
    'character_analyze',
    {
      description: '解析一至二十个汉字的康熙笔画、现代笔画、五行、部首、拼音与繁简对应',
      inputSchema: { text: z.string().min(1).max(20).describe('待解析汉字') },
      outputSchema: resultOutputSchema,
    },
    async ({ text }) => {
      try {
        return createStructuredToolResult({ result: analyzeChineseCharacters(text) });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '汉字解析失败'));
      }
    },
  );

  server.registerTool(
    'character_select',
    {
      description: '按康熙笔画、五行、拼音和常用字条件筛选汉字，可用于起名选字',
      inputSchema: {
        kangxiStrokes: z.number().int().min(1).max(64).optional().describe('康熙笔画数'),
        wuxing: wuxing.optional().describe('字的五行'),
        pinyin: z.string().max(32).optional().describe('拼音或拼音片段'),
        commonOnly: z.boolean().optional().describe('只返回常用字，默认true'),
        limit: z.number().int().min(1).max(100).optional().describe('返回数量，默认50'),
      },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        return createStructuredToolResult({
          result: selectChineseCharacters({ ...args, strokes: args.kangxiStrokes }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '汉字筛选失败'));
      }
    },
  );

  server.registerTool(
    'number_analyze',
    {
      description: '解析手机号、车牌号及一般数字字母编号的八十一数理、数字和、奇偶与重复结构',
      inputSchema: {
        value: z.string().min(1).max(64).describe('待解析号码'),
        purpose: z.enum(['phone', 'plate', 'general']).optional().describe('号码类型，默认general'),
      },
      outputSchema: resultOutputSchema,
    },
    async ({ value, purpose }) => {
      try {
        return createStructuredToolResult({ result: analyzeNumber(value, purpose) });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '数字解析失败'));
      }
    },
  );

  server.registerTool(
    'divine_zhuge',
    {
      description: '按三个汉字的康熙笔画尾数计算诸葛神数，并返回取数过程、384签序、签文与解释',
      inputSchema: { text: z.string().length(3).describe('恰好三个汉字') },
      outputSchema: resultOutputSchema,
    },
    async ({ text }) => {
      try {
        return createStructuredToolResult({ result: calculateZhugeNumber(text) });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '诸葛神数计算失败'));
      }
    },
  );

  server.registerTool(
    'divine_kongming',
    {
      description: '按五次阴阳结果起孔明神卦；可传入五位卦象，也可用随机种子起卦并保留重放样本',
      inputSchema: {
        pattern: z.string().min(5).max(5).optional().describe('五位卦象，可用●○、10或阴阳字样'),
        ...randomOptionShape,
      },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        if (args.pattern && (args.seed !== undefined || args.replay !== undefined)) {
          throw new Error('指定卦象时不接受 seed 或 replay。');
        }
        const options = args.pattern ? undefined : readMcpRandomOptions(args);
        return createStructuredToolResult({ result: castKongmingHexagram(args.pattern, options) });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '孔明神卦起卦失败'));
      }
    },
  );
}
