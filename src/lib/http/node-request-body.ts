import { Buffer } from 'node:buffer';
import type { IncomingHttpHeaders } from 'node:http';
import { RequestBodyTooLargeError } from './request-body';

export type NodeRequestBodySource = AsyncIterable<Buffer | Uint8Array | string> & {
  headers: IncomingHttpHeaders;
};

export async function readLimitedNodeRequestBody(
  request: NodeRequestBodySource,
  maxBytes: number,
): Promise<Buffer> {
  const declaredLength = parseContentLength(request.headers['content-length']);
  if (declaredLength !== undefined && declaredLength > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes);
    }
    chunks.push(buffer);
  }

  return Buffer.concat(chunks, totalBytes);
}

function parseContentLength(value: string | string[] | undefined): number | undefined {
  if (Array.isArray(value)) return undefined;
  if (!value || !/^\d+$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : undefined;
}
