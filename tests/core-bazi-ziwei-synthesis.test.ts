import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateBaziZiweiCombinedReading,
  formatBaziZiweiSynthesisForPrompt,
} from 'mingyu-core/synthesis';
import { createMingyuClient } from 'mingyu-core/client';
import type { BirthProfile } from 'mingyu-core/profile';

const profile: BirthProfile = {
  name: '时月',
  gender: 'female',
  calendarType: 'solar',
  year: 2024,
  month: 11,
  day: 2,
  hour: 16,
  minute: 44,
  location: { regionId: '110101' },
  useTrueSolarTime: false,
};

const ziwei = {
  horoscopeContext: {
    dateStr: '2026-08-07',
    hourIndex: 8,
  },
};

test('八字紫微合参缺少明确运限基准时间时应拒绝计算', async () => {
  await assert.rejects(
    () => calculateBaziZiweiCombinedReading(profile),
    /必须显式提供 ziwei\.horoscopeContext 或 ziwei\.now/,
  );

  const client = createMingyuClient();
  const safe = await client.safe.baziZiwei(profile);
  assert.equal(safe.ok, false);
  if (safe.ok) return;
  assert.match(safe.error.message, /必须显式提供 ziwei\.horoscopeContext 或 ziwei\.now/);
});

test('八字紫微合参应按主题保留两套结构化资料', async () => {
  const reading = await calculateBaziZiweiCombinedReading(profile, { ziwei });

  assert.ok(reading.bundle.bazi);
  assert.ok(reading.bundle.ziwei);
  assert.equal(reading.synthesis.themes.length, 10);
  assert.ok(reading.synthesis.themes.every((theme) => theme.baziEvidence.length > 0));
  assert.ok(reading.synthesis.themes.every((theme) => theme.ziweiEvidence.length > 0));
  assert.equal(reading.synthesis.status, '资料完整');
  assert.deepEqual(reading.synthesis.timingReference, {
    dateStr: '2026-08-07',
    year: 2026,
    hourIndex: 8,
    shichen: '申时',
  });
  const timing = reading.synthesis.themes.find((theme) => theme.id === 'timing');
  assert.equal(timing?.baziEvidence.filter((fact) => fact.title === '流年序列').length, 1);
  assert.match(
    timing?.baziEvidence.find((fact) => fact.title === '流年序列')?.detail ?? '',
    /2026年/,
  );
  assert.doesNotMatch(timing?.baziEvidence.map((fact) => fact.detail).join('\n') ?? '', /2027年/);
  assert.match(reading.promptText, /八字与紫微斗数合参/);
  assert.match(reading.promptText, /【运限基准】\n2026-08-07 申时/);
  assert.match(reading.promptText, /命局总纲/);
  assert.match(reading.promptText, /大运与流年/);
  assert.doesNotMatch(reading.promptText, /匹配率|吉凶概率|项目|API|内部字段/);
});

test('合参提示词应支持不同解读层级并保持完整任务结构', async () => {
  const reading = await calculateBaziZiweiCombinedReading(profile, { ziwei });
  const prompt = formatBaziZiweiSynthesisForPrompt(reading.synthesis, {
    detailLevel: 'professional',
    question: '重点分析未来十年的事业与迁移。',
  });

  assert.match(prompt, /专业术语完整展开/);
  assert.match(prompt, /重点分析未来十年的事业与迁移/);
  assert.match(prompt, /八字资料/);
  assert.match(prompt, /紫微资料/);
});

test('高层客户端应直接提供八字紫微合参和安全调用', async () => {
  const client = createMingyuClient({ defaults: { synthesis: { ziwei } } });
  const direct = await client.baziZiwei(profile);
  const safe = await client.safe.baziZiwei(profile);

  assert.equal(direct.synthesis.key, 'bazi-ziwei:synthesis');
  assert.equal(safe.ok, true);
  assert.equal(client.capability('bazi-ziwei-synthesis').name, '八字紫微合参');
});
