export const DEFAULT_MAX_REQUEST_BODY_BYTES = 512 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`请求体不能超过 ${maxBytes} 字节。`);
  }
}

export async function readLimitedRequestText(request: Request, maxBytes: number): Promise<string> {
  const declaredLength = parseContentLength(request.headers.get('content-length'));
  if (declaredLength !== undefined && declaredLength > maxBytes) {
    // 取消尽力而为，超限响应无需等待远端输入流关闭。
    void request.body?.cancel().catch(() => undefined);
    throw new RequestBodyTooLargeError(maxBytes);
  }

  if (!request.body) {
    return '';
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw new RequestBodyTooLargeError(maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (chunks.length === 1) return new TextDecoder().decode(chunks[0]);

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(body);
}

function parseContentLength(value: string | null): number | undefined {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
