/**
 * 前端 SSE 流式客户端
 *
 * 调用 /api/v1/ai/analyze 端点，解析 SSE 流式响应，
 * 逐 token 回调更新 UI。
 */

import type { AiRequestConfig } from './settings';
import { Capacitor } from '@capacitor/core';
import {
  fetchAndroidDirectAiModels,
  isAndroidDirectCustomAi,
  streamAndroidDirectAi,
} from './android-custom-ai';

const ANDROID_API_ORIGIN = 'https://aov.cc';

export function getAiApiEndpoint(path: string): string {
  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
    return new URL(path, ANDROID_API_ORIGIN).toString();
  }
  return path;
}

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

export const AI_STREAM_INTERRUPTED_MESSAGE = 'AI 流在完成前中断，已保留已生成内容，请重新生成。';
export const AI_STREAM_MALFORMED_MESSAGE = 'AI 流数据无法解析，本次回答未完整生成，请重新生成。';

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

  if (isAndroidDirectCustomAi(aiConfig)) {
    try {
      await streamAndroidDirectAi(messages, aiConfig, { onChunk, onDone, onError }, signal);
    } catch (error) {
      if (isAbortError(error)) return;
      onError(error instanceof Error ? error.message : '无法从当前设备直连自定义 AI。');
    }
    return;
  }

  try {
    const response = await fetch(getAiApiEndpoint('/api/v1/ai/analyze'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, aiConfig }),
      signal,
    });

    await consumeSseStream(response, { onChunk, onDone, onError });
  } catch (err) {
    if (isAbortError(err)) return;
    const message = err instanceof Error ? err.message : '';
    onError(
      err instanceof TypeError || /failed to fetch|network error/i.test(message)
        ? '网络连接失败，请检查网络后重试。'
        : message || '网络请求异常，请稍后重试。',
    );
  }
}

export async function fetchAiModels(aiConfig: AiRequestConfig): Promise<string[]> {
  if (isAndroidDirectCustomAi(aiConfig)) {
    return fetchAndroidDirectAiModels(aiConfig);
  }

  const response = await fetch(getAiApiEndpoint('/api/v1/ai/models'), {
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
  let completed = false;
  let failed = false;

  const closeReader = () => {
    void reader.cancel().catch(() => undefined);
    try {
      reader.releaseLock();
    } catch {
      // reader 可能已由底层响应关闭
    }
  };

  const fail = (message: string) => {
    if (completed || failed) return;
    failed = true;
    closeReader();
    onError(message);
  };

  const finish = () => {
    if (completed || failed) return;
    if (!receivedContent) {
      fail('AI 未返回任何内容，请重新生成。');
      return;
    }
    completed = true;
    closeReader();
    onDone();
  };

  const processEvent = (event: string) => {
    if (completed || failed) return;
    const data = event
      .split(/\r?\n/u)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n')
      .trim();
    if (!data) return;
    if (data === '[DONE]') {
      finish();
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      fail(AI_STREAM_MALFORMED_MESSAGE);
      return;
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      fail(AI_STREAM_MALFORMED_MESSAGE);
      return;
    }
    const payload = parsed as { content?: unknown; error?: unknown };
    if (payload.error) {
      fail(formatAiErrorMessage(parsed, 'AI 返回错误。'));
      return;
    }
    if (typeof payload.content === 'string' && payload.content) {
      receivedContent ||= payload.content.trim().length > 0;
      onChunk(payload.content);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按双换行分割 SSE 事件
      const events = buffer.split(/\r?\n\r?\n/u);
      buffer = events.pop() ?? '';

      for (const event of events) {
        processEvent(event);
        if (completed || failed) return;
      }
    }

    // 流结束，flush decoder 并处理残留 buffer
    buffer += decoder.decode();
    if (buffer.trim()) {
      processEvent(buffer);
    }
    if (completed || failed) return;
    fail(
      receivedContent
        ? AI_STREAM_INTERRUPTED_MESSAGE
        : 'AI 流在完成前中断，未返回任何内容，请重新生成。',
    );
  } finally {
    if (!completed && !failed) {
      try {
        reader.releaseLock();
      } catch {
        // reader 可能已由底层响应关闭
      }
    }
  }
}

function isAbortError(error: unknown): boolean {
  return Boolean(
    error && typeof error === 'object' && 'name' in error && error.name === 'AbortError',
  );
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
