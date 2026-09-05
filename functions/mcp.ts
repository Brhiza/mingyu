import { handleMcpRequest } from '../src/lib/mcp/handler.js';

type PagesContext = {
  request: Request;
};

export function onRequest(context: PagesContext): Promise<Response> {
  return handleMcpRequest(context.request);
}
