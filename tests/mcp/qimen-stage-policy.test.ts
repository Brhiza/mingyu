import assert from 'node:assert/strict';
import test from 'node:test';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ZodType } from 'zod';
import { registerQimenTool } from '../../mcp/src/tools/qimen';

test('奇门终身局两项 MCP 工具仅接受正整数阶段跨度', () => {
  const schemas = new Map<string, Record<string, ZodType>>();
  registerQimenTool({
    registerTool(name: string, config: { inputSchema: Record<string, ZodType> }) {
      schemas.set(name, config.inputSchema);
    },
  } as unknown as McpServer);
  for (const name of ['divine_qimen_lifetime', 'qimen_lifetime_prompt']) {
    const policy = schemas.get(name)?.stagePolicy;
    assert.ok(policy);
    assert.equal(policy.safeParse({ model: 'palaceWalk', yearsPerStage: 1 }).success, true);
    assert.equal(policy.safeParse({ model: 'palaceWalk' }).success, true);
    for (const yearsPerStage of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal(policy.safeParse({ model: 'palaceWalk', yearsPerStage }).success, false);
    }
  }
});
