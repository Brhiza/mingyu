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
});

test('住宅风水仅有山向时可出玄空，不出八宅', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    sitMountain: '子',
  });
  assert.ok(result.xuankong);
  assert.equal(result.bazhai, null);
  assert.equal(result.xuankong?.sitMountain, '子');
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
  const measurement = (result.bazhai as { directionMeasurement?: { sitMountain: string; facingMountain: string } })
    .directionMeasurement;
  assert.ok(measurement);
  assert.equal(result.xuankong?.sitMountain, measurement?.sitMountain);
  assert.equal(result.xuankong?.facingMountain, measurement?.facingMountain);
  assert.match(result.prompt, /合参要点/);
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

