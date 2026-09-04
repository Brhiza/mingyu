import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  analyzeChineseCharacters,
  selectChineseCharacters,
  selectNamingCharacters,
  analyzeChineseName,
  generateChineseNames,
  analyzeNumber,
  calculateZhugeNumber,
  castKongmingHexagram,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  buildNumberEnergyPrompt,
} from 'mingyu-core/name-number';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { randomOptionShape, readMcpRandomOptions } from './random-options.js';

const wuxing = z.enum(['金', '木', '水', '火', '土']);
const namingBirth = z
  .object({
    gender: z.enum(['male', 'female']),
    year: z.number().int().min(1900).max(2100),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    timeIndex: z.number().int().min(0).max(12),
    dateType: z.enum(['solar', 'lunar']).optional(),
    isLeapMonth: z.boolean().optional(),
  })
  .describe('出生资料，用于结合四柱喜用筛选名字');

const namingPreferenceShape = {
  preferredCharacters: z.string().max(100).optional().describe('希望优先考虑的汉字'),
  forbiddenCharacters: z.string().max(100).optional().describe('候选姓名中需要回避的汉字'),
  generationCharacter: z.string().max(1).optional().describe('固定使用的辈分字'),
  generationPosition: z
    .enum(['first', 'second'])
    .optional()
    .describe('辈分字位于名字首字或末字，默认首字'),
};

export function registerNameNumberTools(server: McpServer) {
  server.registerTool(
    'name_generate',
    {
      description: '结合出生资料与明确的用字条件生成中文姓名候选，并返回逐字、五格和三才资料',
      inputSchema: {
        surname: z.string().min(1).max(2).describe('一字或二字姓氏'),
        gender: z.enum(['男', '女', '通用']).optional().describe('名字用字倾向，默认通用'),
        givenNameLength: z
          .union([z.literal(1), z.literal(2)])
          .optional()
          .describe('名字字数，默认2'),
        preferredElements: z.array(wuxing).max(5).optional().describe('偏好五行，可多选'),
        ...namingPreferenceShape,
        limit: z.number().int().min(1).max(50).optional().describe('候选数量，默认20'),
        birth: namingBirth.optional(),
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
      description: '解析中文姓名的逐字资料、康熙笔画、五格数理、三才配置与五行分布',
      inputSchema: {
        fullName: z.string().min(2).max(4).describe('完整中文姓名'),
        surnameLength: z
          .union([z.literal(1), z.literal(2)])
          .optional()
          .describe('姓氏字数，默认1'),
        preferredElements: z.array(wuxing).max(5).optional().describe('偏好五行，用于评估用字匹配'),
        birth: namingBirth.optional(),
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
            birth: args.birth,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '姓名解析失败'));
      }
    },
  );

  server.registerTool(
    'name_generate_prompt',
    {
      description: '结合出生资料、用字条件、适配字池与候选样本生成完整起名提示词',
      inputSchema: {
        surname: z.string().min(1).max(2).describe('一字或二字姓氏'),
        gender: z.enum(['男', '女', '通用']).optional().describe('名字用字倾向，默认通用'),
        givenNameLength: z
          .union([z.literal(1), z.literal(2)])
          .optional()
          .describe('名字字数，默认2'),
        preferredElements: z.array(wuxing).max(5).optional().describe('偏好五行，可多选'),
        ...namingPreferenceShape,
        limit: z.number().int().min(1).max(20).optional().describe('进入提示词的候选数量，默认10'),
        birth: namingBirth.optional(),
      },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const candidates = generateChineseNames({ ...args, limit: args.limit ?? 10 });
        return createStructuredToolResult({
          result: {
            candidates,
            prompt: buildChineseNamingPrompt({
              surname: args.surname,
              gender: args.gender,
              candidates,
              suitableCharacters: selectNamingCharacters({ ...args, limit: 24 }),
              preferredCharacters: args.preferredCharacters,
              forbiddenCharacters: args.forbiddenCharacters,
              generationCharacter: args.generationCharacter,
              generationPosition: args.generationPosition,
            }),
          },
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '起名提示词生成失败'));
      }
    },
  );

  server.registerTool(
    'name_analyze_prompt',
    {
      description: '结合出生资料与姓名算法底稿生成可直接交给 AI 的完整姓名解析提示词',
      inputSchema: {
        fullName: z.string().min(2).max(4).describe('完整中文姓名'),
        surnameLength: z
          .union([z.literal(1), z.literal(2)])
          .optional()
          .describe('姓氏字数，默认1'),
        preferredElements: z.array(wuxing).max(5).optional().describe('偏好五行，用于评估用字匹配'),
        birth: namingBirth.optional(),
        question: z.string().max(1000).optional().describe('希望重点了解的问题'),
      },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const analysis = analyzeChineseName({
          fullName: args.fullName,
          surnameLength: args.surnameLength,
          xiYong: args.preferredElements,
          birth: args.birth,
        });
        return createStructuredToolResult({
          result: {
            analysis,
            prompt: buildChineseNameAnalysisPrompt({ analysis, question: args.question }),
          },
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '姓名解析提示词生成失败'));
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
      description: '解析手机号、车牌号及一般数字字母编号的八星磁场、相邻组合以及0和5作用',
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
        return createErrorToolResult(getErrorMessage(error, '数字能量解析失败'));
      }
    },
  );

  server.registerTool(
    'number_energy_prompt',
    {
      description: '解析数字与字母编号的八星磁场并生成可直接交给 AI 的完整解读提示词',
      inputSchema: {
        value: z.string().min(1).max(64).describe('待解析的数字或字母编号'),
        purpose: z.enum(['phone', 'plate', 'general']).optional().describe('使用类型，默认general'),
        question: z.string().max(1000).optional().describe('希望重点了解的问题'),
      },
      outputSchema: resultOutputSchema,
    },
    async ({ value, purpose, question }) => {
      try {
        const analysis = analyzeNumber(value, purpose);
        return createStructuredToolResult({
          result: {
            analysis,
            prompt: buildNumberEnergyPrompt({ analysis, question }),
          },
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '数字能量提示词生成失败'));
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
