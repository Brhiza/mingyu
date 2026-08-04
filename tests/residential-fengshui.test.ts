import test from 'node:test';
import assert from 'node:assert/strict';
import { generateResidentialFengshui } from '../packages/core/src/residential_fengshui/index.ts';

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
  assert.ok(result.agreements.some((item) => /缺少住宅建造年或起运年/.test(item.detail)));
  assert.ok(result.advice.some((item) => /补充住宅建造年或起运年/.test(item)));
  assert.match(result.prompt, /玄空：未排盘（缺少建造年或起运年）/);
  assert.doesNotMatch(result.prompt, new RegExp(`宅运年份：${new Date().getFullYear()}`));
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
  assert.ok(result.agreements.length >= 1);
  assert.ok(result.advice.length >= 1);
  const measurement = (
    result.bazhai as { directionMeasurement?: { sitMountain: string; facingMountain: string } }
  ).directionMeasurement;
  assert.ok(measurement);
  assert.equal(result.xuankong?.sitMountain, measurement?.sitMountain);
  assert.equal(result.xuankong?.facingMountain, measurement?.facingMountain);
  assert.doesNotMatch(result.prompt, /合参要点|命宅相合可提高关注优先级/);
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
});

test('住宅风水无居住人时门向磁北应换算真北并同步玄空盘', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    doorToInteriorDegree: 64,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  });

  assert.equal(result.bazhai, null);
  assert.ok(result.xuankong);
  assert.equal(result.xuankong?.measurement?.sitDegree, 65);
  assert.equal(result.xuankong?.measurement?.stability, '山向边界敏感');
  assert.equal(result.xuankong?.sitMountain, '寅');
  assert.equal(result.xuankong?.facingMountain, '申');
  assert.ok(result.xuankong?.measurement?.candidateMountains?.length === 2);
});

test('住宅风水无居住人时门向测量参数应执行与八宅一致的校验', () => {
  for (const input of [
    {
      year: 2024,
      doorToInteriorDegree: 0,
      northReference: 'magnetic' as const,
    },
    {
      year: 2024,
      doorToInteriorDegree: 0,
      northReference: 'true' as const,
      magneticDeclinationDegrees: 1,
    },
    {
      year: 2024,
      doorToInteriorDegree: 0,
      northReference: 'invalid' as never,
    },
    {
      year: 2024,
      doorToInteriorDegree: 361,
    },
  ]) {
    assert.throws(() => generateResidentialFengshui(input));
  }
});
