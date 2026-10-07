import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getFoundationCapabilities } from 'mingyu-core/foundation';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../mcp/src/create-server';
import { getPublicApiOpenApiDocument } from '../src/lib/public-api/handler';
import { API_VERSION, getPublicApiManifest } from '../src/lib/public-api/metadata';

export const PAGES_DISCOVERY_PATHS = [
  '/api/v1/health',
  '/api/v1/manifest',
  '/api/v1/openapi.json',
  '/api/v1/foundation/capabilities',
  '/.well-known/aov-mingyu-api.json',
] as const;

export const MCP_TOOL_LIST_PATH = '/mcp-tools.json';

async function generateOnlineToolList() {
  const server = createMingyuMcpServer({ preset: 'online' });
  const client = new Client({ name: '静态目录生成', version: '1' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    return await client.listTools();
  } finally {
    await client.close();
    await server.close();
  }
}

/** 固定目录在构建时生成，访问这些文件不调用 Pages Function。 */
export async function generatePagesDiscoveryAssets(outputDirectory: string) {
  const runtime = { service: 'mingyu', origin: '' };
  const manifest = getPublicApiManifest(runtime);
  const wrap = (data: unknown) => ({
    ok: true,
    data,
    meta: { service: runtime.service, version: API_VERSION },
  });
  const documents = [
    wrap({
      status: 'ok',
      service: runtime.service,
      version: API_VERSION,
      timestamp: new Date().toISOString(),
      timestampKind: 'build',
    }),
    wrap(manifest),
    wrap(getPublicApiOpenApiDocument(runtime)),
    wrap(getFoundationCapabilities()),
    manifest,
  ];
  for (const [index, route] of PAGES_DISCOVERY_PATHS.entries()) {
    const filePath = path.join(outputDirectory, route.slice(1));
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(documents[index]), 'utf8');
  }
  await writeFile(
    path.join(outputDirectory, MCP_TOOL_LIST_PATH.slice(1)),
    JSON.stringify(await generateOnlineToolList()),
    'utf8',
  );
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await generatePagesDiscoveryAssets(path.resolve('dist'));
  console.log(`已生成 ${PAGES_DISCOVERY_PATHS.length} 个 Pages 静态发现入口及 MCP 工具目录。`);
}
