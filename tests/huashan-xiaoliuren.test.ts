import assert from 'node:assert/strict';
import test from 'node:test';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';

const SAMPLE_DATE = new Date('2025-06-18T10:30:00+08:00');

test('华山派小六壬只允许时间起课', () => {
  assert.throws(
    () =>
      generateXiaoliuren({
        method: 'number',
        number: 5,
        school: 'huashan',
        customDate: SAMPLE_DATE,
      }),
    /只以时间起课/,
  );
  assert.throws(
    () =>
      generateXiaoliuren({
        method: 'random',
        school: 'huashan',
        customDate: SAMPLE_DATE,
        seed: 'x',
      }),
    /只以时间起课/,
  );
});

test('华山派时间课应输出完整课象、日干支六亲与神煞', () => {
  const data = generateXiaoliuren({ method: 'time', school: 'huashan', customDate: SAMPLE_DATE });

  assert.equal(data.school, 'huashan');
  assert.equal(data.schoolLabel, '华山派');
  assert.equal(data.method, 'time');
  assert.ok(data.mainLine?.includes('华山派时间课主线'));
  assert.ok(data.ganzhi?.day);
  assert.ok(data.dayNight);
  assert.ok(Array.isArray(data.xunKong));
  assert.ok(data.yiMa);
  assert.ok(data.taoHua);
  assert.ok(data.stageCharts?.start.relative);
  assert.ok(data.stageCharts?.process.relative);
  assert.ok(data.stageCharts?.result.relative);
  assert.equal(data.stageCharts?.result.palace.name, data.primary.name);
  assert.ok(data.focusEvidence?.length);
  assert.ok(data.sixPalaceRing?.length === 6);
  assert.equal(data.calculation?.school, 'huashan');
  assert.match(data.evidenceAnalysis?.sources[0]?.title ?? '', /华山派/);
});

test('通行掌诀默认仍支持数字起课且标记 standard', () => {
  const data = generateXiaoliuren({ method: 'number', number: 5, customDate: SAMPLE_DATE });
  assert.equal(data.school, 'standard');
  assert.equal(data.schoolLabel, '通行掌诀');
  assert.equal(data.method, 'number');
  assert.equal(data.stageCharts, undefined);
  assert.ok(data.ganzhi?.day);
});
