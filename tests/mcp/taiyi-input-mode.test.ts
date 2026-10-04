import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';

test('太乙 MCP 年计和时间计不静默忽略另一模式的时间字段', async () => {
  const server = createMingyuMcpServer();
  const client = new Client({ name: 'taiyi-input-mode-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    for (const tool of ['metaphysics_taiyi', 'taiyi_prompt']) {
      const yearWithDate = await client.callTool({
        name: tool,
        arguments: { scope: 'year', year: 2026, customDate: '2025-12-21T23:03:05+08:00' },
      });
      assert.equal(yearWithDate.isError, true);
      assert.match(
        String((yearWithDate.structuredContent as { error?: string } | undefined)?.error),
        /年计只接受 year/,
      );

      const hourWithYear = await client.callTool({
        name: tool,
        arguments: { scope: 'hour', year: 2026, customDate: '2025-12-21T23:03:05+08:00' },
      });
      assert.equal(hourWithYear.isError, true);
      assert.match(
        String((hourWithYear.structuredContent as { error?: string } | undefined)?.error),
        /不得提供 year/,
      );

      const emptyGanZhi = await client.callTool({
        name: tool,
        arguments: { scope: 'year', year: 2026, ganZhi: '' },
      });
      assert.equal(emptyGanZhi.isError, true);
    }
  } finally {
    await client.close();
    await server.close();
  }
});
