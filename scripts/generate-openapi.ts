import { z } from 'zod';
import { inputSchemas, methodEnglishLabels, methodIds, methodLabels, repromptInput } from '../src/schema';
import { methodExamples } from './method-examples.mjs';

export function generateOpenApiDocument(serverUrl = 'https://your-mingyu-domain.example') {
  const methodInputSchemas = Object.fromEntries(
    methodIds.map((method) => [method, z.toJSONSchema(inputSchemas[method])]),
  );

  return {
    openapi: '3.1.0',
    info: {
      title: 'Mingyu V2 (命语 V2) HTTP REST API',
      version: '2.0.0',
      description:
        `Stateless Chinese & Western metaphysics calculation and AI prompt engine covering ${methodIds.length} methods (BaZi, Zi Wei Dou Shu, Qi Men Dun Jia, Western Astrology, Tarot, Feng Shui, Almanac, Classics). Supports responseMode: "compact" with repromptToken and optional outputLanguage ("en", "zh-TW", "ja", "ko", "vi", or any language). / 无状态传统术数与占星排盘及 AI 提示词服务，覆盖 ${methodIds.length} 种术数与典籍入口。`,
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: serverUrl,
        description: 'Current deployment endpoint / 当前部署服务端点',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'Optional Bearer token when ACCESS_TOKEN is configured on the server. / 可选访问令牌，仅当服务端配置 ACCESS_TOKEN 时需要。',
        },
      },
      schemas: {
        MethodId: {
          type: 'string',
          enum: [...methodIds],
          description: `Enabled ${methodIds.length} method IDs / 已开放的 ${methodIds.length} 种术数方法标识`,
        },
        CalculateRequest: {
          type: 'object',
          required: ['method', 'input'],
          properties: {
            method: { $ref: '#/components/schemas/MethodId' },
            input: {
              type: 'object',
              description: 'Method-specific input object (query GET /api/schema?method=<id>). Accepts optional outputLanguage inside input or top-level. / 对应术数入参，可通过 /api/schema 查询。',
            },
            responseMode: {
              type: 'string',
              enum: ['full', 'compact'],
              default: 'full',
              description: 'Use "compact" to return summary, prompt.text, and repromptToken without the large data tree. / compact 模式仅返回摘要、prompt.text 与 repromptToken。',
            },
            outputLanguage: {
              type: 'string',
              description: 'Optional AI reading output language (e.g. "en", "zh-TW", "ja", "ko", "vi", or any language tag/name). Defaults to Simplified Chinese (zh-CN). / 可选 AI 解读输出语言，省略默认简体中文。',
              example: 'en',
            },
          },
          example: {
            method: 'bazi',
            input: methodExamples.bazi,
            responseMode: 'compact',
            outputLanguage: 'en',
          },
        },
        RepromptRequest: {
          oneOf: [
            {
              type: 'object',
              required: ['repromptToken', 'question'],
              properties: {
                repromptToken: { type: 'string', description: 'Compact repromptToken from prior compact calculation / 紧凑追问令牌' },
                question: { type: 'string', minLength: 1, maxLength: 2000 },
                prompt: { type: 'object', description: 'Optional prompt options override; pass {} to reset / 可选覆盖提示词选项' },
                currentTime: { type: 'string', format: 'date-time' },
                outputLanguage: { type: 'string', description: 'Optional output language override (inherits prior language if omitted) / 可选覆盖输出语言' },
                method: { $ref: '#/components/schemas/MethodId' },
              },
            },
            z.toJSONSchema(repromptInput),
          ],
        },
      },
    },
    paths: {
      '/api/health': {
        get: {
          operationId: 'getHealth',
          summary: 'Health check / 健康检查',
          responses: {
            '200': {
              description: 'Service is healthy / 服务状态正常',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      version: { type: 'string', example: '2.0.0' },
                      methodsCount: { type: 'integer', example: methodIds.length },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/methods': {
        get: {
          operationId: 'listMethods',
          summary: 'List enabled method IDs / 列出当前开放的所有术数方法',
          responses: {
            '200': {
              description: 'List of enabled method IDs / 成功返回方法 ID 列表',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      methods: { type: 'array', items: { $ref: '#/components/schemas/MethodId' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/api/schema': {
        get: {
          operationId: 'getMethodSchema',
          summary: 'Get input JSON Schema for one or all methods / 查询术数输入 JSON Schema',
          parameters: [
            {
              name: 'method',
              in: 'query',
              required: false,
              schema: { $ref: '#/components/schemas/MethodId' },
              description: 'Target method ID; omit for all enabled methods. / 指定单个术数方法名；省略返回全部。',
            },
          ],
          responses: {
            '200': { description: 'Method schema(s) and reprompt schema / 返回输入 Schema 与追问 Schema' },
            '400': { description: 'Unknown method or duplicate query param / 方法不存在或参数重复' },
          },
        },
      },
      '/api/prompts': {
        get: {
          operationId: 'getPromptCatalog',
          summary: 'Get prompt topics, schools, and scopes / 查询提示词主题、流派与范围选项',
          parameters: [
            {
              name: 'method',
              in: 'query',
              required: false,
              schema: { $ref: '#/components/schemas/MethodId' },
            },
          ],
          responses: {
            '200': { description: 'Prompt catalog / 返回提示词目录' },
            '400': { description: 'Unknown method or duplicate query param / 方法不存在或参数重复' },
          },
        },
      },
      '/api/calculate': {
        post: {
          operationId: 'calculate',
          summary: 'Run deterministic chart/divination calculation & build AI prompt / 执行排盘计算并返回结果与 AI 提示词',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CalculateRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Success, returns chart summary/data & prompt.text / 计算成功' },
            '400': { description: 'Validation error or disabled method / 参数校验失败或方法未启用' },
            '401': { description: 'Missing or invalid Bearer token / 缺少或无效访问令牌' },
            '413': { description: 'Request body exceeds 1 MiB / 请求体超过 1 MiB' },
          },
        },
      },
      '/api/prompt': {
        post: {
          operationId: 'reprompt',
          summary: 'Follow-up prompt from prior result or repromptToken without re-casting / 基于原结果或 repromptToken 免重排追问',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RepromptRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Follow-up prompt generated / 生成追问提示词成功' },
            '400': { description: 'Invalid arguments or tampered chart / 参数无效或盘面不一致' },
            '401': { description: 'Missing or invalid Bearer token / 缺少或无效访问令牌' },
            '413': { description: 'Request body exceeds 1 MiB / 请求体超过 1 MiB' },
          },
        },
      },
    },
    'x-mingyu-method-labels': methodLabels,
    'x-mingyu-method-english-labels': methodEnglishLabels,
    'x-mingyu-method-schemas': methodInputSchemas,
  };
}
