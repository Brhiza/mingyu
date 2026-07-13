/**
 * 前端 SSE 流式客户端
 *
 * 调用 /api/v1/ai/analyze 端点，解析 SSE 流式响应，
 * 逐 token 回调更新 UI。
 */

import type { AiRequestConfig } from './settings';

export interface StreamCallbacks {
  onChunk: (text: string) => void;
  onDone: () => void;
  onError: (message: string) => void;
}

export interface StreamOptions extends StreamCallbacks {
  /** AbortSignal 用于取消请求 */
  signal?: AbortSignal;
  aiConfig?: AiRequestConfig;
}

export type ChatMessage = { role: 'user' | 'assistant'; content: string };

type AiErrorPayload = {
  error?: string | { code?: unknown; message?: unknown };
};

/**
 * 发送多轮对话消息到 AI 解析端点，流式接收回复。
 *
 * @param messages 对话消息数组（不含 system 消息，由后端注入）
 * @param options 回调和可选的 AbortSignal
 */
export async function streamAiChat(messages: ChatMessage[], options: StreamOptions) {
  const { onChunk, onDone, onError, signal, aiConfig } = options;

  try {
    const response = await fetch('/api/v1/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, aiConfig }),
      signal,
    });

    await consumeSseStream(response, { onChunk, onDone, onError });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      onDone();
      return;
    }
    const message = err instanceof Error ? err.message : '';
    onError(
      err instanceof TypeError || /failed to fetch|network error/i.test(message)
        ? '网络连接失败，请检查网络后重试。'
        : message || '网络请求异常，请稍后重试。',
    );
  }
}

export async function fetchAiModels(aiConfig: AiRequestConfig): Promise<string[]> {
  const response = await fetch('/api/v1/ai/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ aiConfig }),
  });

  if (!response.ok) {
    let message = `获取模型失败（${response.status}）`;
    try {
      const data = await response.json();
      message = formatAiErrorMessage(data, message);
    } catch {
      // 忽略 JSON 解析失败
    }
    throw new Error(message);
  }

  const data = await response.json();
  const models = Array.isArray(data?.models) ? data.models : [];
  return models.filter(
    (item: unknown): item is string => typeof item === 'string' && item.length > 0,
  );
}

/**
 * 消费 SSE 流式响应，逐 chunk 回调。
 */
async function consumeSseStream(response: Response, { onChunk, onDone, onError }: StreamCallbacks) {
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try {
      const data = await response.json();
      message = formatAiErrorMessage(data, message);
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
  let receivedContent = false;

  const finish = () => {
    if (!receivedContent) {
      onError('AI 未返回任何内容，请重新生成。');
      return;
    }
    onDone();
  };

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
        finish();
        return;
      }

      try {
        const parsed = JSON.parse(data);
        if (parsed.error) {
          onError(formatAiErrorMessage(parsed, 'AI 返回错误。'));
          return;
        }
        if (typeof parsed.content === 'string' && parsed.content) {
          receivedContent ||= parsed.content.trim().length > 0;
          onChunk(parsed.content);
        }
      } catch {
        // 忽略无法解析的行
      }
    }
  }

  // 流结束，flush decoder 并处理残留 buffer
  buffer += decoder.decode();
  if (buffer.trim()) {
    const line = buffer.trim();
    if (line.startsWith('data:')) {
      const data = line.slice(5).trim();
      if (data && data !== '[DONE]') {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            onError(formatAiErrorMessage(parsed, 'AI 返回错误。'));
            return;
          }
          if (typeof parsed.content === 'string' && parsed.content) {
            receivedContent ||= parsed.content.trim().length > 0;
            onChunk(parsed.content);
          }
        } catch {
          // 忽略
        }
      }
    }
  }

  finish();
}

function formatAiErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== 'object') return fallback;
  const payload = data as AiErrorPayload;
  const error = payload.error;
  if (typeof error === 'string') return error || fallback;
  if (!error || typeof error !== 'object') return fallback;

  const message = typeof error.message === 'string' && error.message ? error.message : fallback;
  const code = typeof error.code === 'string' && error.code ? error.code : '';
  return code ? `${message}（错误码：${code}）` : message;
}
