const TOKEN_PREFIX = 'mingyu:v2:d1:';
const MAX_DECOMPRESSED_BYTES = 4 * 1024 * 1024;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function readStreamWithLimit(stream: ReadableStream<Uint8Array>, maxBytes: number): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error('追问令牌解压后超出大小限制。');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function deflateBytes(raw: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  const writePromise = writer.write(new Uint8Array(raw)).then(() => writer.close());
  const [compressed] = await Promise.all([readStreamWithLimit(cs.readable, MAX_DECOMPRESSED_BYTES), writePromise]);
  return compressed;
}

async function inflateBytes(compressed: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const writePromise = writer.write(new Uint8Array(compressed)).then(() => writer.close());
  const [raw] = await Promise.all([readStreamWithLimit(ds.readable, MAX_DECOMPRESSED_BYTES), writePromise]);
  return raw;
}

export interface CompactableCalculationResult {
  [key: string]: unknown;
  version: string;
  method: string;
  currentTime: string;
  data: Record<string, unknown>;
  summary?: unknown;
  prompt: { text: string };
  promptOptions?: unknown;
}

/** 将完整排盘结果无状态压缩为紧凑追问令牌（供精简模式跨轮传递，免去大体积 JSON 回传）。 */
export async function packRepromptToken(result: CompactableCalculationResult): Promise<string> {
  const payload = {
    version: result.version,
    method: result.method,
    currentTime: result.currentTime,
    data: result.data,
    ...(result.promptOptions !== undefined ? { promptOptions: result.promptOptions } : {}),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressed = await deflateBytes(bytes);
  return `${TOKEN_PREFIX}${bytesToBase64Url(compressed)}`;
}

/** 解压并校验精简追问令牌，恢复完整结果对象供 reprompt 使用。 */
export async function unpackRepromptToken(token: string): Promise<{
  version: string;
  method: string;
  currentTime: string;
  data: Record<string, unknown>;
  promptOptions?: unknown;
}> {
  if (typeof token !== 'string' || !token.startsWith(TOKEN_PREFIX)) {
    throw new Error('无效的追问令牌格式。');
  }
  const body = token.slice(TOKEN_PREFIX.length);
  if (!body) throw new Error('追问令牌内容为空。');
  let raw: Uint8Array;
  try {
    raw = await inflateBytes(base64UrlToBytes(body));
  } catch (error) {
    throw new Error(`追问令牌损坏或无法解压：${error instanceof Error ? error.message : '未知错误'}`);
  }
  const parsed = JSON.parse(new TextDecoder().decode(raw)) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('追问令牌载荷无效。');
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.method !== 'string' || typeof record.currentTime !== 'string' || !record.data || typeof record.data !== 'object') {
    throw new Error('追问令牌缺少必要盘面字段。');
  }
  return record as {
    version: string;
    method: string;
    currentTime: string;
    data: Record<string, unknown>;
    promptOptions?: unknown;
  };
}

/** 将完整计算结果转为省流量、低 Token 的精简响应（保留 summary、prompt 与 repromptToken）。 */
export async function toCompactResult(result: CompactableCalculationResult) {
  const repromptToken = await packRepromptToken(result);
  return {
    version: result.version,
    method: result.method,
    currentTime: result.currentTime,
    ...(result.summary !== undefined ? { summary: result.summary } : {}),
    prompt: result.prompt,
    ...(result.promptOptions !== undefined ? { promptOptions: result.promptOptions } : {}),
    repromptToken,
  };
}

/** 统一解析标准 result 或紧凑 repromptToken 追问请求体，并剥离扩展字段 responseMode。 */
export async function resolveRepromptPayload(raw: unknown): Promise<{
  payload: Record<string, unknown>;
  responseMode: 'full' | 'compact';
}> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('追问请求体必须是 JSON 对象。');
  }
  const obj = raw as Record<string, unknown>;
  const responseMode = obj.responseMode === 'compact' ? 'compact' : 'full';
  const { repromptToken, responseMode: _mode, ...rest } = obj;
  if (typeof repromptToken !== 'string') {
    return { payload: rest, responseMode };
  }
  const unpacked = await unpackRepromptToken(repromptToken);
  if (rest.method !== undefined && rest.method !== unpacked.method) {
    throw new Error('传入的 method 与追问令牌中的术数不一致。');
  }
  return {
    payload: {
      ...rest,
      method: unpacked.method,
      result: unpacked,
    },
    responseMode,
  };
}
