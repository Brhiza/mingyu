import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBaziZiweiSynthesis,
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

let combinedReadingPromise: ReturnType<typeof calculateBaziZiweiCombinedReading> | undefined;
const client = createMingyuClient({ defaults: { synthesis: { ziwei } } });

function getCombinedReading() {
  combinedReadingPromise ??= client.baziZiwei(profile);
  return combinedReadingPromise;
}

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
  const reading = await getCombinedReading();

  assert.equal(reading.synthesis.key, 'bazi-ziwei:synthesis');
  assert.equal(client.capability('bazi-ziwei-synthesis').name, '八字紫微合参');
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
  const reading = await getCombinedReading();
  const prompt = formatBaziZiweiSynthesisForPrompt(reading.synthesis, {
    detailLevel: 'professional',
    question: '重点分析未来十年的事业与迁移。',
  });

  assert.match(prompt, /专业术语完整展开/);
  assert.match(prompt, /重点分析未来十年的事业与迁移/);
  assert.match(prompt, /八字资料/);
  assert.match(prompt, /紫微资料/);
  const repeatedPattern = reading.synthesis.themes
    .flatMap((theme) => theme.baziEvidence)
    .find((fact) => fact.title === '格局');
  assert.ok(repeatedPattern);
  assert.match(prompt, /【共同盘面资料】/);
  assert.equal(prompt.split(`${repeatedPattern.title}：${repeatedPattern.detail}`).length - 1, 1);
});

test('运限证据超过展示范围时合参任务书明确标出未列条数', async () => {
  const reading = await getCombinedReading();
  const { bazi, ziwei: runtime } = reading.bundle;
  assert.ok(bazi);
  assert.ok(runtime);
  const yearly = runtime.payloadByScope.yearly;
  assert.ok(yearly);
  const template = yearly.evidence_pool[0];
  assert.ok(template);
  const evidence_pool = Array.from({ length: 13 }, (_, index) => ({
    ...template,
    id: `T${index + 1}`,
    key: `ziwei:timing:test:${index + 1}`,
    stable_key: `timing:test:${index + 1}`,
    type: 'scope_landing',
    scope: yearly.active_scope.scope,
    title: `运限证据${index + 1}`,
    description: index === 12 ? '第13项反证' : `第${index + 1}项资料`,
    promptText: index === 12 ? '第13项反证' : `第${index + 1}项资料`,
  }));
  const synthesis = buildBaziZiweiSynthesis({
    bazi,
    ziwei: {
      ...runtime,
      payloadByScope: {
        ...runtime.payloadByScope,
        yearly: { ...yearly, evidence_pool },
      },
    },
  });
  const yearlyFact = synthesis.themes
    .find((theme) => theme.id === 'timing')
    ?.ziweiEvidence.find((fact) => fact.scope === 'yearly');
  assert.ok(yearlyFact);
  assert.equal(yearlyFact.truncatedEvidenceCount, 1);
  assert.equal(yearlyFact.sourceKeys.length, 12);

  const prompt = formatBaziZiweiSynthesisForPrompt(synthesis);
  assert.match(prompt, /同一运限另有1项资料未列/);
  assert.doesNotMatch(prompt, /第13项反证/);
});

test('八字紫微跨体系合参互证应准确分析羊刃煞曜与天乙贵人吉曜同参', async () => {
  const reading = await getCombinedReading();
  assert.ok(reading.synthesis.corroboration);
  assert.ok(reading.synthesis.corroboration.shaYao);
  assert.ok(reading.synthesis.corroboration.guiRen);
  assert.match(reading.synthesis.corroboration.summary, /八字紫微互证：/);
  assert.match(reading.promptText, /八字紫微互证：/);
});
