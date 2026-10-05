import assert from 'node:assert/strict';
import test from 'node:test';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerQizhengTool } from '../../mcp/src/tools/qi_zheng';
import { registerCalendarTools } from '../../mcp/src/tools/calendar';
import { assertPromptIsPortableTaskText } from '../prompt-assertions';
import type { generateQizheng } from '../../packages/core/src/qi_zheng';

test('七政MCP排盘与任务书支持当地年界，公共UTC月相保持原范围', async () => {
  const server = new McpServer({ name: 'qizheng-civil-year-test', version: '1.0.0' });
  registerQizhengTool(server);
  registerCalendarTools(server);
  const client = new Client({ name: 'qizheng-civil-year-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    for (const sample of [
      {
        year: 1900,
        month: 1,
        day: 1,
        hour: 0,
        minute: 0,
        second: 0,
        timezone: 14,
        utc: '1899-12-31T10:00:00.000Z',
      },
      {
        year: 2200,
        month: 12,
        day: 31,
        hour: 23,
        minute: 59,
        second: 59,
        timezone: -12,
        utc: '2201-01-01T11:59:59.000Z',
      },
    ]) {
      const { utc, ...clock } = sample;
      for (const name of ['metaphysics_qizheng', 'qizheng_prompt']) {
        const response = await client.callTool({
          name,
          arguments: {
            ...clock,
            latitude: 0,
            longitude: 180,
            detailMode: 'full',
          },
        });
        assert.equal(response.isError, undefined, JSON.stringify(response.structuredContent));
        const data = response.structuredContent as {
          result: ReturnType<typeof generateQizheng>;
          prompt?: string;
        };
        const result = data.result;
        assert.equal(result.calculationContext.utcDateTime, utc);
        assert.equal(result.calculationContext.moonPhase.utcDateTime, utc);
        assert.equal(result.stars.length, 11);
        if (name === 'qizheng_prompt') {
          const prompt = data.prompt!;
          for (const star of result.stars.filter((item) => ['太阳', '太阴'].includes(item.name))) {
            assert.ok(
              prompt.includes(
                `${star.name}：在${star.xiu}宿${star.xiuDegree.toFixed(2)}度，落${star.signBranch}宫${star.palace}`,
              ),
            );
          }
          assertPromptIsPortableTaskText(prompt);
        }
      }
      const response = await client.callTool({
        name: 'calendar_moon_phase',
        arguments: { utcDateTime: utc },
      });
      assert.equal(response.isError, true);
      assert.match(
        String((response.structuredContent as { error?: string })?.error),
        /支持 1900-2200 年/,
      );
    }
  } finally {
    await client.close();
    await server.close();
  }
});
