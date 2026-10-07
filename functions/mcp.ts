import { handleMcpRequest } from '../src/lib/mcp/handler.js';
import type { ListToolsResult } from '@modelcontextprotocol/sdk/types.js';

type PagesAssets = { fetch: (request: Request) => Promise<Response> };
const toolLists = new WeakMap<PagesAssets, Promise<ListToolsResult>>();

function loadToolList(assets: PagesAssets, requestUrl: string): Promise<ListToolsResult> {
  const cached = toolLists.get(assets);
  if (cached) return cached;

  const loading = (async () => {
    const response = await assets.fetch(new Request(new URL('/mcp-tools.json', requestUrl)));
    if (!response.ok) {
      throw new Error('在线工具目录暂不可用，请确认部署包含 mcp-tools.json。');
    }
    const catalog: ListToolsResult = await response.json().catch(() => {
      throw new Error('在线工具目录格式异常，请确认部署包含完整 mcp-tools.json。');
    });
    if (!Array.isArray(catalog?.tools)) {
      throw new Error('在线工具目录格式异常，请确认部署包含完整 mcp-tools.json。');
    }
    return catalog;
  })().catch((error) => {
    toolLists.delete(assets);
    throw error;
  });
  toolLists.set(assets, loading);
  return loading;
}

type PagesContext = {
  request: Request;
  env?: { ASSETS?: PagesAssets };
};

export function onRequest(context: PagesContext): Promise<Response> {
  const assets = context.env?.ASSETS;
  return handleMcpRequest(context.request, {
    preset: 'online',
    ...(assets ? { loadToolList: () => loadToolList(assets, context.request.url) } : {}),
  });
}
