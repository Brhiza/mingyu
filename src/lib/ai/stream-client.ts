/**
 * 前端 SSE 流式客户端
 *
 * 调用 /api/v1/ai/analyze 端点，解析 SSE 流式响应，
 * 逐 token 回调更新 UI。
 */

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export interface StreamOptions extends StreamCallbacks {
  /** AbortSignal 用于取消请求 */
  signal?: AbortSignal;
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

/**
 * 发送提示词到 AI 解析端点，流式接收回复（单轮，向后兼容）。
 *
 * @param prompt 完整的提示词文本
 * @param options 回调和可选的 AbortSignal
 * @returns fetch Response（流已消费完毕）
 */
export async function streamAiAnalysis(prompt: string, options: StreamOptions) {
  const { onChunk, onDone, onError, signal } = options;

  try {
    const response = await fetch('/api/v1/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
      signal,
    });

    await consumeSseStream(response, { onChunk, onDone, onError });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      onDone();
      return;
    }
    onError(err instanceof Error ? err.message : '网络请求异常');
  }
}

/**
 * 发送多轮对话消息到 AI 解析端点，流式接收回复。
 *
 * @param messages 对话消息数组（不含 system 消息，由后端注入）
 * @param options 回调和可选的 AbortSignal
 */
export async function streamAiChat(messages: ChatMessage[], options: StreamOptions) {
  const { onChunk, onDone, onError, signal } = options;

  try {
    const response = await fetch('/api/v1/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });

    await consumeSseStream(response, { onChunk, onDone, onError });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      onDone();
      return;
    }
    onError(err instanceof Error ? err.message : '网络请求异常');
  }
}

/**
 * 消费 SSE 流式响应，逐 chunk 回调。
 */
async function consumeSseStream(response: Response, { onChunk, onDone, onError }: StreamCallbacks) {
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const data = await response.json();
      if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // 忽略 JSON 解析失败
    }
    onError(message);
    return;
  }

  if (!response.body) {
    onError('服务端未返回流式响应。');
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // 按双换行分割 SSE 事件
    const events = buffer.split('\n\n');
    buffer = events.pop() ?? '';

    for (const event of events) {
      const line = event.trim();
      if (!line.startsWith('data:')) continue;

      const data = line.slice(5).trim();
      if (!data) continue;
      if (data === '[DONE]') {
        onDone();
        return;
      }

      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          onError(parsed.error);
          return;
        }
        if (typeof parsed.content === 'string' && parsed.content) {
          onChunk(parsed.content);
        }
      } catch {
        // 忽略无法解析的行
      }
    }
  }

  onDone();
}
