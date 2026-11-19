export type AiMessage = { role: 'system' | 'user' | 'assistant'; content: string; submittedAt?: string };
export type AiConfig = { baseUrl: string; apiKey?: string; model: string };

export interface AgentToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface AgentToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export type AgentApiMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: AgentToolCall[] }
  | { role: 'tool'; tool_call_id: string; name?: string; content: string };

export interface StreamAgentCallbacks {
  onText?: (text: string) => void;
  onToolCallDelta?: (toolCalls: AgentToolCall[]) => void;
}

export interface StreamAgentTurnResult {
  content: string;
  toolCalls: AgentToolCall[];
  finishReason: string;
}

function endpoint(baseUrl: string, path: string) {
  let url: URL;
  try { url = new URL(baseUrl.trim()); } catch { throw new Error('模型接口地址无效。'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('模型接口地址须为不含账号、查询参数或片段的 HTTP(S) 地址。');
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/${path}`;
  return url.toString();
}

function headers(apiKey?: string, json = true): HeadersInit {
  const token = apiKey?.trim();
  if (token && /\s/.test(token)) throw new Error('模型密钥不能包含空白字符。');
  return { ...(json ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) };
}

export async function listModels(config: Pick<AiConfig, 'baseUrl' | 'apiKey'>, fetcher: typeof fetch = fetch, signal?: AbortSignal) {
  const response = await fetcher(endpoint(config.baseUrl, 'models'), { headers: headers(config.apiKey, false), credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal });
  if (!response.ok) throw new Error(`获取模型失败（HTTP ${response.status}）。`);
  const result = await response.json() as { data?: unknown };
  if (!Array.isArray(result?.data)) throw new Error('模型列表格式不受支持，请手动填写模型名称。');
  return [...new Set(result.data.flatMap((item: unknown) => item && typeof item === 'object' && 'id' in item && typeof item.id === 'string' && item.id ? [item.id] : []))].sort();
}

/** Browser-to-provider stream; the caller owns credentials and conversation state. */
export async function streamChat(config: AiConfig, messages: readonly AiMessage[], onText: (text: string) => void, signal?: AbortSignal, fetcher: typeof fetch = fetch) {
  if (!config.model.trim()) throw new Error('请填写模型名称。');
  if (!messages.length || messages.some((message) => !['system', 'user', 'assistant'].includes(message.role) || typeof message.content !== 'string' || !message.content.trim())) throw new Error('对话消息不能为空。');
  const response = await fetcher(endpoint(config.baseUrl, 'chat/completions'), {
    method: 'POST', headers: headers(config.apiKey), credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer', signal,
    body: JSON.stringify({ model: config.model.trim(), messages: messages.map(({ role, content, submittedAt }) => ({ role,
      content: role === 'user' && submittedAt ? `${content}\n\n【本次发送时间（UTC）】\n${submittedAt}` : content })), stream: true }),
  });
  if (!response.ok) throw new Error(`模型请求失败（HTTP ${response.status}）。`);
  if (!response.body) throw new Error('模型服务未返回流式内容。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', dataLines: string[] = [], content = '', finishReason: string | null = null, done = false;

  const event = () => {
    if (!dataLines.length) return;
    const data = dataLines.join('\n'); dataLines = [];
    if (data === '[DONE]') { done = true; return; }
    let parsed: { choices?: Array<{ delta?: { content?: unknown }; finish_reason?: unknown }>; error?: unknown };
    try { parsed = JSON.parse(data); } catch { throw new Error('模型返回了无法解析的流式数据。'); }
    if (!parsed || typeof parsed !== 'object' || parsed.error) throw new Error('模型流返回错误。');
    const choice = parsed.choices?.[0];
    if (typeof choice?.delta?.content === 'string' && choice.delta.content) { content += choice.delta.content; onText(choice.delta.content); }
    if (typeof choice?.finish_reason === 'string') finishReason = choice.finish_reason;
  };
  const line = (value: string) => {
    if (!value) event();
    else if (value.startsWith('data:')) dataLines.push(value.slice(5).replace(/^ /, ''));
  };
  const drain = (final: boolean) => {
    for (;;) {
      const match = /\r\n|\r|\n/.exec(buffer);
      if (!match) break;
      const index = match.index;
      if (!final && match[0] === '\r' && index === buffer.length - 1) break;
      line(buffer.slice(0, index));
      buffer = buffer.slice(index + match[0].length);
      if (done) return;
    }
    if (final) { if (buffer) line(buffer); buffer = ''; event(); }
  };
  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) { buffer += decoder.decode(); drain(true); break; }
      buffer += decoder.decode(chunk.value, { stream: true });
      drain(false);
    }
    if (!done && !finishReason) throw new Error('模型流提前中断，已保留收到的内容。');
    if (!content) throw new Error('模型未返回文本内容。');
    return { content, finishReason: finishReason ?? 'stop' };
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Browser-to-provider OpenAI-compatible agent turn with streaming text and tool_calls. */
export async function streamAgentCompletion(
  config: AiConfig,
  messages: readonly AgentApiMessage[],
  tools: readonly AgentToolDefinition[],
  callbacks: StreamAgentCallbacks = {},
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
): Promise<StreamAgentTurnResult> {
  if (!config.model.trim()) throw new Error('请填写模型名称。');
  if (!messages.length) throw new Error('对话消息不能为空。');

  const response = await fetcher(endpoint(config.baseUrl, 'chat/completions'), {
    method: 'POST',
    headers: headers(config.apiKey),
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
    signal,
    body: JSON.stringify({
      model: config.model.trim(),
      messages,
      ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
      stream: true,
    }),
  });

  if (!response.ok) {
    let detail = '';
    try {
      const errJson = (await response.json()) as { error?: { message?: unknown }; message?: unknown };
      const rawMsg =
        typeof errJson?.error?.message === 'string'
          ? errJson.error.message
          : typeof errJson?.message === 'string'
            ? errJson.message
            : '';
      if (rawMsg) detail = `：${rawMsg.slice(0, 160)}`;
    } catch {}
    throw new Error(`模型请求失败（HTTP ${response.status}${detail}）。`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json') || !response.body) {
    const json = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: unknown;
          tool_calls?: Array<{ id?: unknown; type?: unknown; function?: { name?: unknown; arguments?: unknown } }>;
        };
        finish_reason?: unknown;
      }>;
      error?: { message?: unknown };
    };
    if (json?.error) {
      throw new Error(typeof json.error.message === 'string' ? json.error.message : '模型返回错误。');
    }
    const msg = json.choices?.[0]?.message;
    const content = typeof msg?.content === 'string' ? msg.content : '';
    if (content) callbacks.onText?.(content);
    const toolCalls: AgentToolCall[] = Array.isArray(msg?.tool_calls)
      ? msg.tool_calls.map((tc, idx) => ({
          id: typeof tc.id === 'string' && tc.id ? tc.id : `call_${idx + 1}`,
          type: 'function',
          function: {
            name: typeof tc.function?.name === 'string' ? tc.function.name : '',
            arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : '{}',
          },
        }))
      : [];
    if (toolCalls.length) callbacks.onToolCallDelta?.(toolCalls);
    const finishReason =
      typeof json.choices?.[0]?.finish_reason === 'string'
        ? json.choices[0].finish_reason
        : toolCalls.length
          ? 'tool_calls'
          : 'stop';
    if (!content && !toolCalls.length) throw new Error('模型未返回文本或工具调用。');
    return { content, toolCalls, finishReason };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let dataLines: string[] = [];
  let content = '';
  let finishReason: string | null = null;
  let done = false;
  const toolCallMap = new Map<number, AgentToolCall>();

  const snapshotToolCalls = (): AgentToolCall[] =>
    [...toolCallMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([idx, tc]) => ({
        id: tc.id || `call_${idx + 1}`,
        type: 'function' as const,
        function: { ...tc.function },
      }));

  const event = () => {
    if (!dataLines.length) return;
    const data = dataLines.join('\n');
    dataLines = [];
    if (data === '[DONE]') {
      done = true;
      return;
    }
    let parsed: {
      choices?: Array<{
        delta?: {
          content?: unknown;
          tool_calls?: Array<{
            index?: unknown;
            id?: unknown;
            type?: unknown;
            function?: { name?: unknown; arguments?: unknown };
          }>;
        };
        finish_reason?: unknown;
      }>;
      error?: { message?: unknown } | unknown;
    };
    try {
      parsed = JSON.parse(data);
    } catch {
      throw new Error('模型返回了无法解析的流式数据。');
    }
    if (!parsed || typeof parsed !== 'object' || parsed.error) {
      const msg =
        parsed &&
        typeof parsed.error === 'object' &&
        parsed.error &&
        'message' in parsed.error &&
        typeof (parsed.error as { message?: unknown }).message === 'string'
          ? `：${(parsed.error as { message: string }).message.slice(0, 160)}`
          : '';
      throw new Error(`模型流返回错误${msg}。`);
    }
    const choice = parsed.choices?.[0];
    if (typeof choice?.delta?.content === 'string' && choice.delta.content) {
      content += choice.delta.content;
      callbacks.onText?.(choice.delta.content);
    }
    if (Array.isArray(choice?.delta?.tool_calls)) {
      let changed = false;
      for (const tc of choice.delta.tool_calls) {
        const idx = typeof tc.index === 'number' ? tc.index : 0;
        const existing = toolCallMap.get(idx) ?? {
          id: '',
          type: 'function' as const,
          function: { name: '', arguments: '' },
        };
        if (typeof tc.id === 'string' && tc.id) existing.id = tc.id;
        if (typeof tc.function?.name === 'string' && tc.function.name) {
          existing.function.name += tc.function.name;
        }
        if (typeof tc.function?.arguments === 'string' && tc.function.arguments) {
          existing.function.arguments += tc.function.arguments;
        }
        toolCallMap.set(idx, existing);
        changed = true;
      }
      if (changed) {
        callbacks.onToolCallDelta?.(snapshotToolCalls());
      }
    }
    if (typeof choice?.finish_reason === 'string') {
      finishReason = choice.finish_reason;
    }
  };

  const line = (value: string) => {
    if (!value) event();
    else if (value.startsWith('data:')) dataLines.push(value.slice(5).replace(/^ /, ''));
  };

  const drain = (final: boolean) => {
    for (;;) {
      const match = /\r\n|\r|\n/.exec(buffer);
      if (!match) break;
      const index = match.index;
      if (!final && match[0] === '\r' && index === buffer.length - 1) break;
      line(buffer.slice(0, index));
      buffer = buffer.slice(index + match[0].length);
      if (done) return;
    }
    if (final) {
      if (buffer) line(buffer);
      buffer = '';
      event();
    }
  };

  try {
    while (!done) {
      const chunk = await reader.read();
      if (chunk.done) {
        buffer += decoder.decode();
        drain(true);
        break;
      }
      buffer += decoder.decode(chunk.value, { stream: true });
      drain(false);
    }
    const toolCalls = snapshotToolCalls();
    if (!done && !finishReason) throw new Error('模型流提前中断，已保留收到的内容。');
    if (!content && !toolCalls.length) throw new Error('模型未返回文本或工具调用。');
    return {
      content,
      toolCalls,
      finishReason: finishReason ?? (toolCalls.length ? 'tool_calls' : 'stop'),
    };
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
