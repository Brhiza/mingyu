import assert from 'node:assert/strict';
import test from 'node:test';
import type { TaiyiResult } from 'mingyu-core/taiyi';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import { generateDivinationSession } from '../src/lib/divination/engine';

test('前端太乙夏至秒边界的采用时间与实际起局时间一致', async () => {
  for (const [second, yinYang] of [
    ['29', '阳遁'],
    ['30', '阴遁'],
  ] as const) {
    const time = `16:24:${second}`;
    const session = await generateDivinationSession({
      ...defaultDraft,
      method: 'taiyi',
      taiyiScope: 'hour',
      question: '核对夏至交接。',
      divinationTimeMode: 'custom',
      customDivinationDate: '2026-06-21',
      customDivinationTime: time,
      divinationTimeStandard: 'beijing',
    });
    const result = session.data as TaiyiResult;

    assert.equal(session.timeContext?.clockDateTime, `2026-06-21T${time}`);
    assert.equal(session.timeContext?.effectiveDateTime, `2026-06-21T${time}`);
    assert.equal(result.dateTime, `2026-06-21 ${time}`);
    assert.equal(result.yinYang, yinYang);
    assert.match(session.prompt, new RegExp(`采用时间：2026-06-21 ${time}`));
  }
});

test('前端太乙真太阳时换算保留输入秒及实际占时', async () => {
  const correctedTimes: number[] = [];
  for (const second of ['29', '30']) {
    const session = await generateDivinationSession({
      ...defaultDraft,
      method: 'taiyi',
      taiyiScope: 'hour',
      question: '核对秒级真太阳时。',
      divinationTimeMode: 'custom',
      customDivinationDate: '2026-06-21',
      customDivinationTime: `16:24:${second}`,
      divinationTimeStandard: 'true-solar',
      birthPlace: '测试地点',
      birthLongitude: '120',
    });
    const result = session.data as TaiyiResult;

    assert.equal(session.timeContext?.clockDateTime, `2026-06-21T16:24:${second}`);
    assert.equal(result.termReferenceDateTime, `2026-06-21 16:24:${second}`);
    assert.equal(result.dateTime, session.timeContext?.effectiveDateTime.replace('T', ' '));
    assert.equal(result.yinYang, second === '29' ? '阳遁' : '阴遁');
    correctedTimes.push(Date.parse(`${session.timeContext?.effectiveDateTime}+08:00`));
  }
  assert.equal(correctedTimes[1] - correctedTimes[0], 1000);
});

test('前端太乙历史夏令时日期沿用用户输入的固定东八区口径', async () => {
  const session = await generateDivinationSession({
    ...defaultDraft,
    method: 'taiyi',
    taiyiScope: 'hour',
    question: '核对时间口径。',
    divinationTimeMode: 'custom',
    customDivinationDate: '1988-07-01',
    customDivinationTime: '12:30:15',
    divinationTimeStandard: 'true-solar',
    birthPlace: '测试地点',
    birthLongitude: '120',
  });

  assert.equal(session.timeContext?.clockDateTime, '1988-07-01T12:30:15');
  assert.equal((session.data as TaiyiResult).termReferenceDateTime, '1988-07-01 12:30:15');
});
