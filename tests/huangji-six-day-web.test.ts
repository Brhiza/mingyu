import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import { buildDivinationReadingSubject } from '../src/lib/ai/reading-subject';
import { executeReadingAction } from '../src/lib/ai/reading-resources';
import { handlePublicApiRequest } from '../src/lib/public-api/handler';
import type { HuangjiJingshiResult } from 'mingyu-core/huangji-jingshi';

function buildSixDayDraft(overrides: Partial<DivinationDraft> = {}): DivinationDraft {
  return {
    ...defaultDraft,
    method: 'huangji',
    question: '这个目标时点的六日时势如何？',
    huangjiMethod: 'six-day',
    divinationTimeMode: 'custom',
    customDivinationDate: '2026-08-24',
    customDivinationTime: '15:30',
    huangjiSixDayEpochDate: '2026-08-20',
    huangjiSixDayTimezone: '8',
    ...overrides,
  };
}

async function withRealApi(callback: () => Promise<void>) {
  const original = globalThis.fetch;
  globalThis.fetch = (async (inputValue, init) => {
    const request = new Request(new URL(String(inputValue), 'https://aov.cc'), init);
    return handlePublicApiRequest(request);
  }) as typeof fetch;
  try {
    await callback();
  } finally {
    globalThis.fetch = original;
  }
}

test('网页皇极六日逐爻入口保留目标、历元和有效盘面资料', async () => {
  const draft = buildSixDayDraft();
  const session = await generateDivinationSession(draft);
  const data = session.data as HuangjiJingshiResult;
  const cycle = data.sixDayCycle;

  assert.ok(cycle);
  assert.equal(data.input.mode, '六日逐爻公历');
  assert.equal(cycle?.civilTime.dateTime, '2026-08-24T15:30:00+08:00');
  assert.equal(cycle?.anchor.dateTime, '2026-08-20T00:00:00+08:00');
  assert.equal(cycle?.calendar.actualElapsedDays, 4);
  assert.ok(cycle?.hexagrams.jing.name);
  assert.ok(cycle?.hexagrams.daily.name);
  assert.ok(cycle?.hexagrams.hourly.name);

  const subject = buildDivinationReadingSubject(draft, session);
  assert.ok(subject);
  assert.equal(subject?.lockedInputs.huangji._mode, '六日逐爻公历');
  assert.equal(subject?.lockedInputs.huangji.sixDayEpochDateTime, cycle?.anchor.dateTime);
  assert.equal(subject?.lockedInputs.huangji.calendarModel, cycle?.calendar.model);
  assert.equal(subject?.lockedInputs.huangji.timezone, 8);
  assert.equal(subject?.range.huangjiSixDayDateTime, cycle?.civilTime.dateTime);

  await withRealApi(async () => {
    const resource = await executeReadingAction(
      {
        kind: 'calculate',
        method: 'huangji',
        input: { sixDayDateTime: '2026-08-24T15:30:00+08:00' },
      },
      undefined,
      subject,
    );
    const structured = resource.structured as Record<string, unknown>;
    const restoredCycle = structured.sixDayCycle as Record<string, unknown>;
    assert.equal(resource.usable, true);
    assert.match(resource.title, /皇极经世2026-08-24 15:30:00/u);
    assert.ok(restoredCycle.civilTime);
    assert.ok(restoredCycle.anchor);
    assert.ok(restoredCycle.hexagrams);
    await assert.rejects(
      executeReadingAction(
        {
          kind: 'calculate',
          method: 'huangji',
          input: {
            sixDayDateTime: '2026-08-25T15:30:00+08:00',
            sixDayEpochDateTime: '2026-08-21T00:00:00+08:00',
          },
        },
        undefined,
        subject,
      ),
      /补算主体与当前命盘不一致/u,
    );
  });
});

test('网页皇极六日逐爻入口拒绝超出显式历元坐标范围的目标', async () => {
  await assert.rejects(
    generateDivinationSession(
      buildSixDayDraft({
        customDivinationDate: '2027-08-24',
      }),
    ),
    /超出显式历元后0至359日的已定义坐标范围/u,
  );
});
