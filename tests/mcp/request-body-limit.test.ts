import test from 'node:test';
import assert from 'node:assert/strict';
import { handleMcpRequest } from '../../src/lib/mcp/handler.js';

const MAX_REQUEST_BODY_BYTES = 512 * 1024;
const MCP_URL = 'https://aov.cc/mcp';
const PADDED_CALL_PREFIX =
  '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"unknown_tool","arguments":{"padding":"';
const PADDED_CALL_SUFFIX = '"}}}';

function createPaddedToolCallBody(totalBytes: number) {
  const paddingLength = totalBytes - PADDED_CALL_PREFIX.length - PADDED_CALL_SUFFIX.length;
  assert.ok(paddingLength >= 0);
  const body = `${PADDED_CALL_PREFIX}${'x'.repeat(paddingLength)}${PADDED_CALL_SUFFIX}`;
  assert.equal(new TextEncoder().encode(body).byteLength, totalBytes);
  return body;
}

async function assertLimitResponse(response: Response) {
  assert.equal(response.status, 413);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.match(response.headers.get('content-type') ?? '', /application\/json/i);

  const payload = await response.json();
  assert.equal(payload.jsonrpc, '2.0');
  assert.equal(payload.id, null);
  assert.equal(payload.error?.code, -32600);
  assert.match(payload.error?.message ?? '', /524288 字节/);
}

test('在线 MCP 在解析前按 Content-Length 拒绝超过 512 KiB 的请求体', async () => {
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({
    cancel() {
      canceled = true;
      return new Promise<void>(() => undefined);
    },
  });
  const response = await handleMcpRequest(
    new Request(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(MAX_REQUEST_BODY_BYTES + 1),
      },
      body,
      duplex: 'half',
    } as RequestInit),
    { preset: 'online' },
  );

  await assertLimitResponse(response);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(canceled, true);
});

test('在线 MCP 按流式字节数拒绝没有 Content-Length 的超限请求体并取消输入流', async () => {
  let canceled = false;
  const chunks = [new Uint8Array(MAX_REQUEST_BODY_BYTES), new Uint8Array(1)];
  let nextChunk = 0;
  const requestBody = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (nextChunk < chunks.length) controller.enqueue(chunks[nextChunk++]);
    },
    cancel() {
      canceled = true;
      return new Promise<void>(() => undefined);
    },
  });
  const request = new Request(MCP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: requestBody,
    duplex: 'half',
  } as RequestInit);

  const response = await handleMcpRequest(request, { preset: 'online' });

  await assertLimitResponse(response);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(canceled, true);
});

test('在线 MCP 接受恰好 512 KiB 的 JSON-RPC 请求体', async () => {
  const response = await handleMcpRequest(
    new Request(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: createPaddedToolCallBody(MAX_REQUEST_BODY_BYTES),
    }),
    { preset: 'online' },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  assert.equal((await response.json()).jsonrpc, '2.0');
});

test('本地 full MCP 预设不套用在线请求体上限', async () => {
  const response = await handleMcpRequest(
    new Request(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: createPaddedToolCallBody(MAX_REQUEST_BODY_BYTES + 1),
    }),
    { preset: 'full' },
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).jsonrpc, '2.0');
});

test('在线 MCP 对上限内的无效 JSON 继续返回协议解析错误', async () => {
  const response = await handleMcpRequest(
    new Request(MCP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    }),
    { preset: 'online' },
  );

  assert.equal(response.status, 400);
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  const payload = await response.json();
  assert.equal(payload.jsonrpc, '2.0');
  assert.equal(payload.error?.code, -32700);
});
