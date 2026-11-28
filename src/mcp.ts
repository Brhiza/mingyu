import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { calculate, inputSchemas, reprompt, repromptInput, type Method } from './core';
import { getPromptCatalog } from './catalog';
import { z } from 'zod';
import { createRepromptInput, methodEnglishLabels, methodIds, methodLabels } from './schema';
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
      description: `${methodEnglishLabels[method]} (${methodLabels[method]}). ${inputSchemas[method].description ?? ''} Returns structured chart data & AI prompt (supports optional outputLanguage).`,
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
      description: 'Generate a follow-up AI prompt from a prior result or repromptToken without re-casting. Supports optional outputLanguage override. / 基于先前结果与新问题生成追问提示词（不重新起卦或抽牌），支持指定 outputLanguage。',
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
      description: 'Inspect prompt topics, subtopics, scopes, and school options for enabled methods. / 查询已启用术数的提示词主题、子主题、范围与流派选项。',
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
    description: 'List all 39 Eastern/Western metaphysics methods by category (with English/Chinese labels) before calling get_method_schema or calculate. / 列出开放术数方法标识、中英文名称与分类。',
    inputSchema: z.object({
      category: z.enum(['mingli', 'ziwei-astro', 'qimen-liuren', 'divination', 'fengshui', 'name-classics']).optional(),
    }).strict(),
  }, async ({ category }) => {
    const groups = METHOD_CATEGORY_GROUPS
      .filter((group) => !category || group.id === category)
      .map((group) => ({
        id: group.id,
        label: group.label,
        labelEn: group.labelEn,
        methods: group.methods
          .filter((id) => enabledSet.has(id))
          .map((id) => ({
            id,
            label: methodLabels[id],
            labelEn: methodEnglishLabels[id],
            description: inputSchemas[id].description ?? methodLabels[id],
          })),
      }))
      .filter((group) => group.methods.length > 0);
    const result = { count: enabled.length, categories: groups };
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
  });

  server.registerTool('get_method_schema', {
    description: 'Fetch the input JSON Schema and prompt options for a single method on demand. / 按需获取单个术数方法的输入 Schema 与提示词选项。',
    inputSchema: z.object({
      method: z.enum(enabled),
    }).strict(),
  }, async ({ method }) => {
    const result = {
      method,
      label: methodLabels[method],
      labelEn: methodEnglishLabels[method],
      description: inputSchemas[method].description ?? methodLabels[method],
      inputSchema: z.toJSONSchema(inputSchemas[method]),
      promptCatalog: getPromptCatalog([method])[method] ?? null,
    };
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }], structuredContent: result };
  });

  server.registerTool('calculate', {
    description: 'Run calculation and build AI prompt (BaZi, Zi Wei, Qi Men, Astrology, Tarot, Feng Shui, etc.). Defaults to responseMode:"compact" returning summary, prompt.text & repromptToken. Pass outputLanguage (e.g. "en","zh-TW","ja","ko","vi") for non-Simplified-Chinese output. / 执行排盘计算，默认 compact 返回省流结果与 repromptToken。',
    inputSchema: z.object({
      method: z.enum(enabled),
      input: z.record(z.string(), z.unknown()),
      responseMode: z.enum(['compact', 'full']).optional(),
      outputLanguage: z.string().trim().min(1).max(64).optional(),
    }).strict(),
  }, async ({ method, input, responseMode, outputLanguage }) => {
    try {
      const mergedInput = outputLanguage && input.outputLanguage === undefined
        ? { ...input, outputLanguage }
        : input;
      const normalized = normalizeAgentToolInput(method, mergedInput);
      const fullResult = await calculate(method, normalized, runtime) as CompactableCalculationResult;
      const mode = responseMode ?? 'compact';
      const output = mode === 'compact' ? await toCompactResult(fullResult) : fullResult;
      return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output };
    } catch (error) {
      return formatErrorResponse(error, '计算失败');
    }
  });

  server.registerTool('reprompt', {
    description: 'Generate follow-up prompt without re-casting; pass prior repromptToken (or result) and new question, plus optional outputLanguage. / 基于已有结果或 repromptToken 继续追问。',
    inputSchema: z.object({
      repromptToken: z.string().min(1).optional(),
      method: z.enum(enabled).optional(),
      result: z.record(z.string(), z.unknown()).optional(),
      question: z.string().min(1).max(2000),
      prompt: z.unknown().optional(),
      currentTime: z.string().optional(),
      outputLanguage: z.string().trim().min(1).max(64).optional(),
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
