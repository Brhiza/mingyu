import assert from 'node:assert/strict';
import test from 'node:test';
import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei';
import { buildPublicZiweiPromptForRuntime } from 'mingyu-core/prompt/public-api';

test('紫微完整提示词仅列一次本命十二宫并保留长生博士与安星口径', async () => {
  const input = buildZiweiChartInput({
    name: '资料回归',
    gender: 'female',
    dateType: 'solar',
    year: '1992',
    month: '8',
    day: '21',
    timeIndex: 4,
    algorithm: 'zhongzhou',
  });
  const context = { dateStr: '2026-08-06', hourIndex: 4 };
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin', 'monthly', 'daily', 'hourly'],
    skipAnalysis: true,
    horoscopeContext: context,
    fortuneRange: { scope: 'all', ...context },
  });
  const text = buildPublicZiweiPromptForRuntime({ result: runtime, scope: 'full' });
  assert.equal((text.match(/宫位关系：本宫/g) ?? []).length, 12);
  assert.match(text, /安星口径：中州派安星法/);
  assert.doesNotMatch(text, /命宫宫/);
  const natal = text.slice(text.indexOf('本命：'), text.indexOf('范围：童限'));
  for (const palace of runtime.payloadByScope.origin.palaces) {
    const line = natal
      .split('\n')
      .find((value) =>
        value.trimStart().startsWith(`${palace.name}${palace.name.endsWith('宫') ? '' : '宫'}`),
      );
    assert.ok(line, palace.name);
    for (const star of [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars]) {
      assert.ok(line.includes(star.name), `${palace.name} ${star.name}`);
    }
    if (palace.changsheng12) assert.ok(line.includes(`长生：${palace.changsheng12}`), palace.name);
    if (palace.boshi12) assert.ok(line.includes(`博士：${palace.boshi12}`), palace.name);
  }
});
