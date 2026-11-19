import { z } from 'zod';
import { inputSchemas, methodIds, methodLabels, repromptInput } from '../src/schema';
import { methodExamples } from './method-examples.mjs';

export function generateOpenApiDocument(serverUrl = 'https://your-mingyu-domain.example') {
  const methodInputSchemas = Object.fromEntries(
    methodIds.map((method) => [method, z.toJSONSchema(inputSchemas[method])]),
  );

  return {
    openapi: '3.1.0',
    info: {
      title: '命语 V2 (Mingyu V2) HTTP REST API',
      version: '2.0.0',
      description:
        `无状态中华传统术数排盘与 AI 解读提示词服务，覆盖 ${methodIds.length} 种术数与典籍入口。支持 responseMode: "compact" 返回紧凑追问令牌（repromptToken），显著降低 AI Agent 上下文消耗。`,
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: serverUrl,
        description: '当前部署服务端点',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: '可选访问令牌；仅当服务端配置了 ACCESS_TOKEN 环境变量时需要。',
        },
      },
      schemas: {
        MethodId: {
          type: 'string',
          enum: [...methodIds],
          description: `已开放的 ${methodIds.length} 种术数方法标识`,
        },
        CalculateRequest: {
          type: 'object',
          required: ['method', 'input'],
          properties: {
            method: { $ref: '#/components/schemas/MethodId' },
            input: {
              type: 'object',
              description: '对应术数的输入参数（具体结构可通过 GET /api/schema?method=<方法名> 查询）',
            },
            responseMode: {
              type: 'string',
              enum: ['full', 'compact'],
              default: 'full',
              description: 'compact 模式仅返回摘要、prompt.text 与 repromptToken，不返回大体积 data 树。',
            },
          },
          example: {
            method: 'bazi',
            input: methodExamples.bazi,
            responseMode: 'compact',
          },
        },
        RepromptRequest: {
          oneOf: [
            {
              type: 'object',
              required: ['repromptToken', 'question'],
              properties: {
                repromptToken: { type: 'string', description: 'compact 模式返回的紧凑追问令牌' },
                question: { type: 'string', minLength: 1, maxLength: 2000 },
                prompt: { type: 'object', description: '可选覆盖原提示词选项，传 {} 恢复默认' },
                currentTime: { type: 'string', format: 'date-time' },
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
          summary: '健康检查',
          responses: {
            '200': {
              description: '服务状态正常',
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
          summary: '列出当前服务开放的所有术数方法',
          responses: {
            '200': {
              description: '成功返回方法 ID 列表',
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
          summary: '查询所有或单个术数的输入 JSON Schema',
          parameters: [
            {
              name: 'method',
              in: 'query',
              required: false,
              schema: { $ref: '#/components/schemas/MethodId' },
              description: '指定单个术数方法名；省略则返回全部已启用方法。',
            },
          ],
          responses: {
            '200': { description: '返回方法输入 Schema 与 reprompt Schema' },
            '400': { description: '方法不存在或参数重复' },
          },
        },
      },
      '/api/prompts': {
        get: {
          operationId: 'getPromptCatalog',
          summary: '查询提示词主题、流派与范围选项',
          parameters: [
            {
              name: 'method',
              in: 'query',
              required: false,
              schema: { $ref: '#/components/schemas/MethodId' },
            },
          ],
          responses: {
            '200': { description: '返回提示词目录' },
            '400': { description: '方法不存在或参数重复' },
          },
        },
      },
      '/api/calculate': {
        post: {
          operationId: 'calculate',
          summary: '执行排盘/占卜计算并返回结构化数据与 AI 提示词',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CalculateRequest' },
              },
            },
          },
          responses: {
            '200': { description: '计算成功，返回盘面与 prompt.text' },
            '400': { description: '参数校验失败或方法未启用' },
            '401': { description: '缺少或无效访问令牌' },
            '413': { description: '请求体超过 1 MiB' },
          },
        },
      },
      '/api/prompt': {
        post: {
          operationId: 'reprompt',
          summary: '基于原计算结果或 repromptToken 重新生成追问提示词（免重排）',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RepromptRequest' },
              },
            },
          },
          responses: {
            '200': { description: '生成追问提示词成功' },
            '400': { description: '参数无效或盘面校验不一致' },
            '401': { description: '缺少或无效访问令牌' },
            '413': { description: '请求体超过 1 MiB' },
          },
        },
      },
    },
    'x-mingyu-method-labels': methodLabels,
    'x-mingyu-method-schemas': methodInputSchemas,
  };
}
