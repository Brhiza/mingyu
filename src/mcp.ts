import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { calculate, inputSchemas, reprompt, repromptInput, type Method } from './core';
import { getPromptCatalog } from './catalog';
import { z } from 'zod';
import { createRepromptInput, methodIds, methodLabels } from './schema';
import { METHOD_CATEGORY_GROUPS } from './method-registry';
import { normalizeAgentToolInput } from './tool-input-normalizer';
import type { RuntimeContext } from './runtime-context';
import { resolveRepromptPayload, toCompactResult, type CompactableCalculationResult } from './compact';

export type McpServerMode = 'full' | 'router';

export interface CreateMcpServerOptions {
  mode?: McpServerMode;
}

export function enabledMethods(value: string | undefined): Method[] {
  const configured = value?.split(',').map((part) => part.trim()).filter(Boolean);
  const methods = [...new Set(configured ?? methodIds)];
  const unknown = methods.filter((method) => !methodIds.includes(method as Method));
  if (unknown.length) throw new Error(`ENABLED_METHODS 包含未知方法：${unknown.join(', ')}`);
  return methods as Method[];
}

function formatErrorResponse(error: unknown, fallback: string) {
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: error instanceof Error ? error.message : fallback }],
  };
}

function registerFullTools(server: McpServer, enabled: readonly Method[], runtime: RuntimeContext & { enabledMethods: readonly Method[] }) {
  for (const method of enabled) {
    server.registerTool(method, {
      description: `${inputSchemas[method].description ?? methodLabels[method]} 返回结构化结果与 AI 提示词。`,
      inputSchema: inputSchemas[method],
    }, async (args: unknown) => {
      try {
        const result = await calculate(method, args, runtime);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
      } catch (error) {
        return formatErrorResponse(error, '计算失败');
      }
    });
  }
  if (enabled.length) {
    server.registerTool('reprompt', {
      description: '使用先前结果和新问题生成提示词，不重新起卦或抽牌。提示词参考时间默认是本次调用时间，可用 currentTime 指定；不改变原盘时间。省略 prompt 时沿用结果中保存的选项，传空对象可恢复默认。盘面由调用方提供。',
      inputSchema: createRepromptInput(enabled),
    }, async (args: unknown) => {
      try {
        const { payload } = await resolveRepromptPayload(args);
        const input = repromptInput.parse(payload);
        if (!enabled.includes(input.method)) throw new Error('术数不存在或未启用');
        const result = await reprompt(input, runtime);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
      } catch (error) {
        return formatErrorResponse(error, '生成提示词失败');
      }
    });
    server.registerTool('prompt_catalog', {
      description: '查询已启用术数的提示词主题、子主题、范围和流派选项。',
      inputSchema: z.object({ method: z.enum(enabled).optional() }).strict(),
    }, async ({ method }) => {
      if (method && !enabled.includes(method)) return formatErrorResponse(new Error('术数不存在或未启用'), '术数不存在');
      const result = { methods: getPromptCatalog(method ? [method] : enabled) };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    });
  }
}

function registerRouterTools(server: McpServer, enabled: readonly Method[], runtime: RuntimeContext & { enabledMethods: readonly Method[] }) {
  if (!enabled.length) return;
  const enabledSet = new Set(enabled);

  server.registerTool('list_methods', {
    description: '列出当前服务开放的术数方法标识、中文名称与分类；在调用 get_method_schema 或 calculate 前可先按分类浏览。',
    inputSchema: z.object({
      category: z.enum(['mingli', 'ziwei-astro', 'qimen-liuren', 'divination', 'fengshui', 'name-classics']).optional(),
    }).strict(),
  }, async ({ category }) => {
    const groups = METHOD_CATEGORY_GROUPS
      .filter((group) => !category || group.id === category)
      .map((group) => ({
        id: group.id,
        label: group.label,
        methods: group.methods
          .filter((id) => enabledSet.has(id))
          .map((id) => ({ id, label: methodLabels[id], description: inputSchemas[id].description ?? methodLabels[id] })),
      }))
      .filter((group) => group.methods.length > 0);
    const result = { count: enabled.length, categories: groups };
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
  });

  server.registerTool('get_method_schema', {
    description: '按需获取单个术数方法的输入参数 JSON Schema 与提示词选项（主题、流派、范围），避免一次性加载全部方法定义。',
    inputSchema: z.object({
      method: z.enum(enabled),
    }).strict(),
  }, async ({ method }) => {
    const result = {
      method,
      label: methodLabels[method],
      description: inputSchemas[method].description ?? methodLabels[method],
      inputSchema: z.toJSONSchema(inputSchemas[method]),
      promptCatalog: getPromptCatalog([method])[method] ?? null,
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
  });

  server.registerTool('calculate', {
    description: '执行指定术数排盘或占卜计算。默认 responseMode 为 compact：返回摘要、可直接交付的 prompt.text 以及用于后续无损追问的紧凑 repromptToken，显著减少上下文 Token 占用；仅在需要原始结构化盘面树时传 responseMode: "full"。',
    inputSchema: z.object({
      method: z.enum(enabled),
      input: z.record(z.string(), z.unknown()),
      responseMode: z.enum(['compact', 'full']).optional(),
    }).strict(),
  }, async ({ method, input, responseMode }) => {
    try {
      const normalized = normalizeAgentToolInput(method, input);
      const fullResult = await calculate(method, normalized, runtime) as CompactableCalculationResult;
      const mode = responseMode ?? 'compact';
      const output = mode === 'compact' ? await toCompactResult(fullResult) : fullResult;
      return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output };
    } catch (error) {
      return formatErrorResponse(error, '计算失败');
    }
  });

  server.registerTool('reprompt', {
    description: '基于已有计算结果继续追问并生成新提示词（不重新起卦或抽牌）。优先直接传入上次 compact 模式返回的 repromptToken 与新 question；也可传完整 result 对象。',
    inputSchema: z.object({
      repromptToken: z.string().min(1).optional(),
      method: z.enum(enabled).optional(),
      result: z.record(z.string(), z.unknown()).optional(),
      question: z.string().min(1).max(2000),
      prompt: z.unknown().optional(),
      currentTime: z.string().optional(),
    }).strict(),
  }, async (args) => {
    try {
      const { payload } = await resolveRepromptPayload(args);
      const parsed = repromptInput.parse(payload);
      if (!enabled.includes(parsed.method)) throw new Error('术数不存在或未启用');
      const result = await reprompt(parsed, runtime);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
    } catch (error) {
      return formatErrorResponse(error, '生成提示词失败');
    }
  });
}

export function createServer(
  enabled: readonly Method[] = methodIds,
  context?: RuntimeContext,
  options?: CreateMcpServerOptions,
) {
  const server = new McpServer({ name: 'mingyu', version: '2.0.0' });
  const runtime = { ...context, enabledMethods: enabled };
  const mode = options?.mode ?? 'full';
  if (mode === 'router') {
    registerRouterTools(server, enabled, runtime);
  } else {
    registerFullTools(server, enabled, runtime);
  }
  return server;
}
