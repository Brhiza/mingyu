import assert from 'node:assert/strict';
import test from 'node:test';
import { readLimitedRequestText, RequestBodyTooLargeError } from '../../src/lib/http/request-body';

function requestFromStream(body: ReadableStream<Uint8Array>, contentLength?: string) {
  return new Request('https://aov.cc/api/v1/bazi/calculate', {
    method: 'POST',
    body,
    duplex: 'half',
    headers: contentLength === undefined ? {} : { 'Content-Length': contentLength },
  } as RequestInit);
}

test('请求体单块与跨块中文解码应保持完整并释放读取锁', async () => {
  const bytes = new TextEncoder().encode('{"问题":"命理"}');
  for (const chunks of [[bytes], [bytes.slice(0, 3), bytes.slice(3, 8), bytes.slice(8)]]) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    });
    assert.equal(await readLimitedRequestText(requestFromStream(stream), 100), '{"问题":"命理"}');
    assert.equal(stream.locked, false);
  }
});

test('请求体实际或声明大小超限应取消剩余流并保持大小错误', async () => {
  for (const contentLength of [undefined, '100']) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(11));
      },
      cancel() {
        cancelled = true;
        throw new Error('模拟流取消失败');
      },
    });
    await assert.rejects(
      readLimitedRequestText(requestFromStream(stream, contentLength), 10),
      RequestBodyTooLargeError,
    );
    assert.equal(cancelled, true);
    assert.equal(stream.locked, false);
  }
});

test('请求体读取失败应保留原始错误并释放读取锁', async () => {
  const error = new Error('模拟传输失败');
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(error);
    },
  });
  await assert.rejects(readLimitedRequestText(requestFromStream(stream), 10), error);
  assert.equal(stream.locked, false);
});

test('输入流取消一直未完成时仍及时返回大小错误', { timeout: 1000 }, async () => {
  for (const contentLength of [undefined, '100']) {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(11));
      },
      cancel() {
        return new Promise<void>(() => {});
      },
    });
    await assert.rejects(
      readLimitedRequestText(requestFromStream(stream, contentLength), 10),
      RequestBodyTooLargeError,
    );
    assert.equal(stream.locked, false);
  }
});
