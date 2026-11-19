import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/worker';
import { parseWorkspaceLocation } from '../src/app/workspace-router';
import { resolveLegacyWebRedirect } from '../src/v1-sunset';

const DEFAULTS = {
  defaultChartFeature: 'bazi' as const,
  defaultDivinationFeature: 'liuyao',
};

test('V1 老网页链接自动映射到 V2 规范路由', () => {
  assert.equal(parseWorkspaceLocation('/records', '', DEFAULTS).canonicalPath, '/history');
  assert.equal(parseWorkspaceLocation('/cases', '', DEFAULTS).canonicalPath, '/chart');
  assert.equal(parseWorkspaceLocation('/calendar', '', DEFAULTS).canonicalPath, '/utilities/calendar');
  assert.equal(parseWorkspaceLocation('/culture-tools', '', DEFAULTS).canonicalPath, '/utilities/chinese-name');
  assert.equal(parseWorkspaceLocation('/tutorial', '', DEFAULTS).canonicalPath, '/');
  assert.equal(parseWorkspaceLocation('/home', '', DEFAULTS).canonicalPath, '/');
  assert.equal(parseWorkspaceLocation('/result', '', DEFAULTS).canonicalPath, '/history');
  assert.equal(parseWorkspaceLocation('/divination/liuyao/result', '', DEFAULTS).canonicalPath, '/divination/liuyao');
  assert.equal(
    parseWorkspaceLocation('/divination/tarot/result/assistant', '', DEFAULTS).canonicalPath,
    '/divination/tarot',
  );
  assert.equal(resolveLegacyWebRedirect('/chart'), null);
});

test('V1 旧接口 /api/v1/* 与 /sse 返回 410 Gone 与 V2 迁移指引', async () => {
  const env = { ASSETS: { fetch: async () => new Response('ok') } };

  const v1Res = await worker.fetch(new Request('https://aov.cc/api/v1/bazi/prompt', { method: 'POST' }), env);
  assert.equal(v1Res.status, 410);
  const v1Body = (await v1Res.json()) as { error: string; deprecatedPath: string; migration: { markdownDocs: string } };
  assert.match(v1Body.error, /V1 接口已下线/);
  assert.equal(v1Body.deprecatedPath, '/api/v1/bazi/prompt');
  assert.equal(v1Body.migration.markdownDocs, '/api-docs.md');

  const sseRes = await worker.fetch(new Request('https://aov.cc/sse', { method: 'GET' }), env);
  assert.equal(sseRes.status, 410);
  const sseBody = (await sseRes.json()) as { error: string; migration: { mcp: string } };
  assert.match(sseBody.error, /SSE/);
  assert.equal(sseBody.migration.mcp, '/mcp?mode=router');
});
