/**
 * AI 解析代理 — 共享逻辑
 *
 * 被 catch-all handler 和独立 Pages Function 共用。
 * 接收提示词或对话消息，调用 OpenAI 兼容的 Chat Completions API 流式解析，返回 SSE Response。
 * 支持任何兼容接口（DeepSeek、千问、豆包、Groq、OpenAI 等）。
 */

const DEFAULT_BASE_URL = 'https://api.deepseek.com/v1';
const DEFAULT_MODEL = 'deepseek-chat';
const MAX_PROMPT_LENGTH = 50_000;
const MAX_MESSAGES = 30;

const SSE_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
};

export type AiEnv = {
  AI_API_KEY?: string;
  AI_BASE_URL?: string;
  AI_MODEL?: string;
  AI_DEFAULT_ENABLED?: string;
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type AiProviderConfig = {
  mode?: 'builtin' | 'custom';
  apiKey?: unknown;
  baseUrl?: unknown;
  model?: unknown;
};

const SYSTEM_PROMPT_SINGLE =
  '你是一位精通中国传统命理学、占卜术数的分析师。' +
  '请根据用户提供的排盘数据和问题，给出专业、客观、有建设性的解读。' +
  '回答使用中文，使用 Markdown 格式排版，结构清晰。' +
  '如果排盘数据不足以支撑判断，请明确说明，不要编造信息。' +
  '回答末尾附上简短提示：本结果仅供参考和娱乐，不替代专业建议。';

const SYSTEM_PROMPT_CHAT =
  '你是一位精通中国传统命理学、占卜术数的分析师。' +
  '用户的第一条消息包含完整的排盘数据和需要解读的问题，请基于此给出专业、客观、有建设性的解读。' +
  '回答使用中文，使用 Markdown 格式排版，结构清晰。' +
  '如果排盘数据不足以支撑判断，请明确说明，不要编造信息。' +
  '\n\n重要限制：用户后续的追问只能围绕本次解析结果展开（例如要求澄清某个判断、补充细节、解释术语等）。' +
  '如果用户提出与本次解析完全无关的新问题（例如换一个全新的话题或更换命主），' +
  '请简要说明"本次对话仅围绕当前解析展开，如需分析其他问题请重新选择问题开始新的解析"，不要回答该无关问题。' +
  '此限制是为了保证命理解析的准确性，因为多个不同问题混在一起会导致分析失焦。' +
  '回答末尾附上简短提示：本结果仅供参考和娱乐，不替代专业建议。';

/**
 * 处理 AI 解析请求，返回 SSE Response。
 * 如果出错则返回 JSON error Response。
 *
 * 请求体支持两种格式：
 * 1. { prompt: string } — 单轮解析（向后兼容）
 * 2. { messages: Array<{role, content}> } — 多轮对话
 */
export async function handleAiAnalyze(request: Request, env?: AiEnv): Promise<Response> {
  let body: { prompt?: unknown; messages?: unknown; aiConfig?: AiProviderConfig };
  try {
    body = await request.json();
  } catch {
    return aiJsonError(400, 'BAD_REQUEST', '请求体必须是合法 JSON。');
  }

  const provider = resolveAiProvider(body.aiConfig, env);
  if ('error' in provider) {
    return provider.error;
  }

  // 解析对话消息：优先使用 messages 数组，否则回退到 prompt 字符串
  let chatMessages: ChatMessage[];
  let isMultiTurn = false;

  if (
    Array.isArray(body.messages) &&
    body.messages.length > 0 &&
    body.messages.every(
      (m) =>
        m &&
        typeof m === 'object' &&
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.content === 'string',
    )
  ) {
    chatMessages = (body.messages as ChatMessage[])
      .map((m) => ({ role: m.role, content: m.content.trim() }))
      .filter((m) => m.content.length > 0)
      .slice(0, MAX_MESSAGES);
    isMultiTurn = chatMessages.length > 1;
  } else {
    const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
    if (!prompt) {
      return aiJsonError(400, 'BAD_REQUEST', 'prompt 不能为空。');
    }
    chatMessages = [{ role: 'user' as const, content: prompt }];
  }

  if (chatMessages.length === 0) {
    return aiJsonError(400, 'BAD_REQUEST', '消息内容不能为空。');
  }

  const totalLength = chatMessages.reduce((sum, m) => sum + m.content.length, 0);
  if (totalLength > MAX_PROMPT_LENGTH) {
    return aiJsonError(400, 'PROMPT_TOO_LONG', `提示词不能超过 ${MAX_PROMPT_LENGTH} 字符。`);
  }

  const systemPrompt = isMultiTurn ? SYSTEM_PROMPT_CHAT : SYSTEM_PROMPT_SINGLE;

  const endpoint = `${provider.baseUrl}/chat/completions`;
  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider.model,
      stream: true,
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...chatMessages,
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    return aiJsonError(
      upstream.status,
      'AI_UPSTREAM_ERROR',
      `AI 服务返回错误（${upstream.status}）。${errText.slice(0, 200)}`,
    );
  }

  // 将 upstream SSE 流转换为前端可读的 SSE 流
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    const reader = upstream.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') {
            await writer.write(encoder.encode('data: [DONE]\n\n'));
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (typeof delta === 'string' && delta) {
              const payload = JSON.stringify({ content: delta });
              await writer.write(encoder.encode(`data: ${payload}\n\n`));
            }
          } catch {
            // 忽略无法解析的行
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : '流式读取异常';
      const payload = JSON.stringify({ error: errMsg });
      await writer.write(encoder.encode(`data: ${payload}\n\n`));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    status: 200,
    headers: SSE_HEADERS,
  });
}

export async function handleAiModels(request: Request, env?: AiEnv): Promise<Response> {
  let body: { aiConfig?: AiProviderConfig };
  try {
    body = await request.json();
  } catch {
    return aiJsonError(400, 'BAD_REQUEST', '请求体必须是合法 JSON。');
  }

  const provider = resolveAiProvider(body.aiConfig, env, { requireModel: false });
  if ('error' in provider) {
    return provider.error;
  }

  const upstream = await fetch(`${provider.baseUrl}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!upstream.ok) {
    const errText = await upstream.text().catch(() => '');
    return aiJsonError(
      upstream.status,
      'AI_UPSTREAM_ERROR',
      `获取模型失败（${upstream.status}）。${errText.slice(0, 200)}`,
    );
  }

  const data = await upstream.json().catch(() => null);
  const models = Array.isArray(data?.data)
    ? data.data
        .map((item: unknown) => {
          if (item && typeof item === 'object' && 'id' in item) {
            return (item as { id?: unknown }).id;
          }
          return null;
        })
        .filter((item: unknown): item is string => typeof item === 'string' && item.length > 0)
    : [];

  return new Response(JSON.stringify({ ok: true, models }), {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function resolveAiProvider(
  config: AiProviderConfig | undefined,
  env?: AiEnv,
  options: { requireModel?: boolean } = {},
):
  | {
      apiKey: string;
      baseUrl: string;
      model: string;
    }
  | { error: Response } {
  const mode = config?.mode === 'custom' ? 'custom' : 'builtin';
  const requireModel = options.requireModel ?? true;

  if (mode === 'custom') {
    const apiKey = typeof config?.apiKey === 'string' ? config.apiKey.trim() : '';
    const baseUrl =
      typeof config?.baseUrl === 'string' && config.baseUrl.trim()
        ? config.baseUrl.trim().replace(/\/+$/, '')
        : '';
    const model = typeof config?.model === 'string' ? config.model.trim() : '';

    if (!apiKey || !baseUrl || (requireModel && !model)) {
      return {
        error: aiJsonError(
          400,
          'AI_CUSTOM_CONFIG_REQUIRED',
          '请先填写自定义 AI 的接口、密钥和模型。',
        ),
      };
    }

    return { apiKey, baseUrl, model };
  }

  if (env?.AI_DEFAULT_ENABLED !== 'true') {
    return {
      error: aiJsonError(
        403,
        'AI_SERVER_NOT_ENABLED',
        '服务端 AI 未启用，请在设置里改用自己的 AI 接口。',
      ),
    };
  }

  const apiKey = env?.AI_API_KEY ?? '';
  const baseUrl = (env?.AI_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  const model = env?.AI_MODEL ?? DEFAULT_MODEL;

  if (!apiKey) {
    return {
      error: aiJsonError(500, 'AI_API_KEY 未配置', '服务端缺少 AI 密钥，请联系管理员。'),
    };
  }

  return { apiKey, baseUrl, model };
}

function aiJsonError(status: number, code: string, message: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: { code, message },
    }),
    {
      status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json; charset=utf-8',
      },
    },
  );
}
