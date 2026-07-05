import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  readLimitedNodeRequestBody,
  type NodeRequestBodySource,
} from '../src/lib/http/node-request-body';
import { RequestBodyTooLargeError } from '../src/lib/http/request-body';

function createBodySource(chunks: string[], contentLength?: string): NodeRequestBodySource {
  const stream = new PassThrough();
  for (const chunk of chunks) {
    stream.write(chunk);
  }
  stream.end();
  return Object.assign(stream, {
    headers: contentLength === undefined ? {} : { 'content-length': contentLength },
  });
}

test('Node 请求体读取应在 Content-Length 超限时直接拒绝', async () => {
  await assert.rejects(
    () => readLimitedNodeRequestBody(createBodySource([], '20'), 10),
    RequestBodyTooLargeError,
  );
});

test('Node 请求体读取应在流式内容超限时拒绝', async () => {
  await assert.rejects(
    () => readLimitedNodeRequestBody(createBodySource(['12345', '678901']), 10),
    RequestBodyTooLargeError,
  );
});

test('Node 请求体读取应返回限制内的完整 Buffer', async () => {
  const body = await readLimitedNodeRequestBody(createBodySource(['命', '语']), 16);
  assert.equal(body.toString('utf8'), '命语');
});
