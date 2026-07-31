import test from 'node:test';
import assert from 'node:assert/strict';
import { generateResidentialFengshui } from '../packages/core/src/residential_fengshui/index.ts';

const AUTOMATIC_DIRECTION_CONCLUSION =
  /四吉方[:：]|四凶方[:：]|(?:吉方|凶方)[:：]|较利方位[:：]|命宅相合|命宅相冲|(?:建议)?优先利用|(?:布置|布局|行动)建议[:：]/;

function assertKeepsOnlyLayeredFacts(result: ReturnType<typeof generateResidentialFengshui>) {
  assert.equal('agreements' in result, false);
  assert.equal('advice' in result, false);
  assert.doesNotMatch(JSON.stringify(result), AUTOMATIC_DIRECTION_CONCLUSION);
}

test('住宅风水仅有出生信息时可出八宅，不出玄空', () => {
  const result = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
  });
  assert.equal(result.key, 'residential-fengshui');
  assert.ok(result.bazhai);
  assert.equal(result.xuankong, null);
  assert.match(result.prompt, /八宅/);
  assert.match(result.prompt, /玄空：未排盘/);
  assert.equal(result.inputSummary.xuankongStatus, '缺少山向');
  assertKeepsOnlyLayeredFacts(result);
});

test('住宅风水有居住人与山向但缺少建造或起运年时不得静默套用当前年', () => {
  const result = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
    sitMountain: '子',
  });

  assert.ok(result.bazhai);
  assert.equal(result.xuankong, null);
  assert.equal(result.inputSummary.houseYear, null);
  assert.equal(result.inputSummary.xuankongStatus, '缺少建造年或起运年');
  assert.ok(result.reviewNotes.some((item) => /缺少住宅建造年或起运年/.test(item.detail)));
  assert.match(result.prompt, /玄空：未排盘（缺少建造年或起运年）/);
  assert.doesNotMatch(result.prompt, new RegExp(`宅运年份：${new Date().getFullYear()}`));
  assertKeepsOnlyLayeredFacts(result);
});

test('住宅风水只有山向却缺少建造或起运年时应明确报错', () => {
  assert.throws(
    () => generateResidentialFengshui({ sitMountain: '子' }),
    /必须提供住宅建造年或起运年/,
  );
});

test('住宅风水仅有山向时可出玄空，不出八宅', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    sitMountain: '子',
  });
  assert.ok(result.xuankong);
  assert.equal(result.bazhai, null);
  assert.equal(result.xuankong?.sitMountain, '子');
  assert.equal(result.inputSummary.xuankongStatus, '已排盘');
  assert.match(result.prompt, /玄空/);
  assertKeepsOnlyLayeredFacts(result);
});

test('住宅风水门向度数会同步八宅与玄空山向', () => {
  const result = generateResidentialFengshui({
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 12,
    gender: 'male',
    year: 2024,
    doorToInteriorDegree: 0,
  });
  assert.ok(result.bazhai?.houseGua);
  assert.ok(result.xuankong);
  assert.ok(result.reviewNotes.length >= 1);
  const measurement = (
    result.bazhai as { directionMeasurement?: { sitMountain: string; facingMountain: string } }
  ).directionMeasurement;
  assert.ok(measurement);
  assert.equal(result.xuankong?.sitMountain, measurement?.sitMountain);
  assert.equal(result.xuankong?.facingMountain, measurement?.facingMountain);
  assert.match(result.prompt, /资料与复核提示/);
  assertKeepsOnlyLayeredFacts(result);
});

test('住宅风水缺少山向与居住人时应报错', () => {
  assert.throws(() => generateResidentialFengshui({}), /至少需要提供山向|出生年/);
});

test('住宅风水仅有门向度数时可出玄空，不依赖出生信息', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    doorToInteriorDegree: 0,
  });
  assert.equal(result.bazhai, null);
  assert.ok(result.xuankong);
  assert.equal(result.xuankong?.sitMountain, '子');
  assert.equal(result.xuankong?.facingMountain, '午');
  assert.match(result.prompt, /仅完成玄空宅运层|玄空/);
  assertKeepsOnlyLayeredFacts(result);
});
