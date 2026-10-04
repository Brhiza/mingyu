import assert from 'node:assert/strict';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMingyuMcpServer } from '../../mcp/src/create-server';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

const birth = {
  gender: 'male' as const,
  year: 1904,
  month: 1,
  day: 20,
  birthHour: 0,
  birthMinute: 0,
  birthSecond: 17,
};

function assertNamingFacts(prompt: string) {
  assert.match(prompt, /出生记录：公历1904年1月20日 00:00:17/);
  assert.match(prompt, /四柱：癸卯 乙丑 癸丑 壬子/);
  assert.match(prompt, /增补喜用五行：金、水（部分判定）/);
  assert.match(prompt, /条件取用：丙火用于解冻（作用对象：癸）/);
  assert.match(prompt, /干级所忌：丁/);
  assert.match(prompt, /mò/);
  assert.match(prompt, /qí/);
}

function assertCharacterFacts(result: any) {
  assert.deepEqual(
    result.characters.map((item: any) => item.char),
    ['万', '俟', '鍾', '鐘'],
  );
  assert.deepEqual(
    result.characters.map((item: any) => item.detail.kangxiStrokes),
    [15, 9, 17, 20],
  );
  assert.equal(result.characters[0].detail.pinyin, 'wàn、mò');
  assert.equal(result.characters[1].detail.pinyin, 'sì、qí');
  assert.match(result.characters[1].detail.kangxiText, /待也/);
  assert.match(result.characters[2].detail.kangxiText, /酒器/);
  assert.match(result.characters[3].detail.kangxiText, /樂鐘/);
}

test('姓名HTTP真实请求保留部分取用、复姓音义及明确康熙字形', async () => {
  async function call(path: string, body: Record<string, unknown>) {
    const response = await handlePublicApiRequest(
      new Request(`https://example.test/api/v1/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(response.status, 200);
    return ((await response.json()) as any).data;
  }
  const analyzed = await call('name/analyze/prompt', {
    fullName: '万俟清和',
    surnameLength: 2,
    birth,
  });
  assert.equal(analyzed.analysis.birthContext.incrementStatus, '部分判定');
  assert.deepEqual(
    analyzed.analysis.chars.slice(0, 2).map((item: any) => item.surnameReading),
    ['mò', 'qí'],
  );
  assertNamingFacts(analyzed.prompt);
  const generated = await call('name/generate/prompt', { surname: '万俟', limit: 1, birth });
  assertNamingFacts(generated.prompt);
  assertCharacterFacts(await call('character/analyze', { text: '万俟鍾鐘' }));
});

test('姓名MCP实际工具输出保留取用状态与复姓音义，字查询原文仍对应本字', async () => {
  const server = createMingyuMcpServer();
  const client = new Client({ name: 'name-fact-consistency', version: '1.0.0' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await server.connect(right);
  await client.connect(left);
  try {
    async function call(name: string, args: Record<string, unknown>) {
      const response = await client.callTool({ name, arguments: args });
      assert.equal(response.isError, undefined);
      return (response.structuredContent as any).result;
    }
    const analyzed = await call('name_analyze_prompt', {
      fullName: '万俟清和',
      surnameLength: 2,
      birth,
    });
    assert.equal(analyzed.analysis.birthContext.incrementStatus, '部分判定');
    assertNamingFacts(analyzed.prompt);
    const generated = await call('name_generate_prompt', { surname: '万俟', limit: 1, birth });
    assertNamingFacts(generated.prompt);
    assertCharacterFacts(await call('character_analyze', { text: '万俟鍾鐘' }));
  } finally {
    await client.close();
    await server.close();
  }
});

test('姓名HTTP与MCP任务书按中国夏令时别名保留原钟表及校正事实', async () => {
  const aliasBirth = {
    gender: 'male',
    year: 1988,
    month: 7,
    day: 1,
    birthHour: 12,
    birthMinute: 30,
    birthSecond: 15,
    timeZoneId: 'Asia/Chongqing',
  };
  const inputs = [
    {
      path: 'name/analyze/prompt',
      tool: 'name_analyze_prompt',
      args: { fullName: '李清和', birth: aliasBirth },
    },
    {
      path: 'name/generate/prompt',
      tool: 'name_generate_prompt',
      args: {
        surname: '李',
        givenNameLength: 1,
        generationCharacter: '和',
        limit: 1,
        birth: aliasBirth,
      },
    },
  ];
  function contextOf(result: any) {
    return result.analysis?.birthContext ?? result.candidates[0].analysis.birthContext;
  }
  function assertAliasFacts(result: any) {
    const context = contextOf(result);
    assert.equal(context.timeBasis.timeZoneId, 'Asia/Chongqing');
    assert.equal(context.timeBasis.timezone, 9);
    assert.equal(context.timeBasis.inputTime, '12:30:15');
    assert.equal(context.timeBasis.calculatedTime, '11:30:15');
    assert.equal(context.timeBasis.mode, '中国历史夏令时钟表时间（已回拨为标准北京时间）');
    assert.match(result.prompt, /出生记录：公历1988年7月1日 12:30:15/);
    assert.match(result.prompt, /排盘公历：1988-07-01 11:30:15/);
    assert.ok(result.prompt.includes(`四柱：${context.pillars.join(' ')}`));
    return context;
  }
  const httpContexts = [];
  for (const input of inputs) {
    const response = await handlePublicApiRequest(
      new Request(`https://example.test/api/v1/${input.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.args),
      }),
    );
    assert.equal(response.status, 200);
    httpContexts.push(assertAliasFacts(((await response.json()) as any).data));
  }
  const server = createMingyuMcpServer();
  const client = new Client({ name: 'name-dst-alias-facts', version: '1.0.0' });
  const [left, right] = InMemoryTransport.createLinkedPair();
  await server.connect(right);
  await client.connect(left);
  try {
    for (const [index, input] of inputs.entries()) {
      const response = await client.callTool({ name: input.tool, arguments: input.args });
      assert.equal(response.isError, undefined);
      const context = assertAliasFacts((response.structuredContent as any).result);
      assert.deepEqual(context.pillars, httpContexts[index].pillars);
      assert.deepEqual(context.timeBasis, httpContexts[index].timeBasis);
    }
  } finally {
    await client.close();
    await server.close();
  }
});
