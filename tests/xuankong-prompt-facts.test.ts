import assert from 'node:assert/strict';
import test from 'node:test';
import { generateXuanKong } from '../packages/core/src/xuan_kong/index.ts';
import { generateResidentialFengshui } from '../packages/core/src/residential_fengshui/index.ts';

test('九运玄空正文明确星数五行与山向运的生克施受', () => {
  const result = generateXuanKong({ year: 2024, sitMountain: '午' });
  assert.match(result.prompt, /运5（土，平气） 山9（火，当运） 向9（火，当运）/);
  assert.match(result.prompt, /山星9火生运星5土/);
  assert.match(result.prompt, /向星9火生运星5土/);
  assert.match(result.prompt, /山向生入：向星2土生山星7金/);
  assert.match(result.prompt, /山向克入：向星8土克山星1水/);
  assert.match(result.prompt, /运8（土，退气）/);
  assert.match(result.prompt, /本次资料层级：宅盘（运盘、山盘、向盘）。/);
  assert.doesNotMatch(result.prompt, /流年盘|流月盘/);
});

test('玄空年盘月盘仅随实际计算结果加入正文层级与各宫', () => {
  const yearly = generateXuanKong({ year: 2024, sitMountain: '午', flowYear: 2026 });
  assert.match(yearly.prompt, /本次资料层级：宅盘（运盘、山盘、向盘）、流年盘。/);
  assert.doesNotMatch(yearly.prompt, /流月盘/);
  const monthly = generateXuanKong({
    year: 2024,
    sitMountain: '午',
    flowYear: 2026,
    flowMonth: 5,
    flowDay: 19,
  });
  assert.match(monthly.prompt, /本次资料层级：宅盘（运盘、山盘、向盘）、流年盘、流月盘。/);
  assert.equal(monthly.flowStars?.yearPlate.centerStar, 1);
  assert.deepEqual([...monthly.plates.year!].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const center = monthly.prompt.split('\n').find((line) => line.startsWith('中五（中）：'))!;
  assert.match(center, /年1（水）/);
});

test('住宅合参保留玄空原生星性与关系而非另行补写', () => {
  const result = generateResidentialFengshui({ year: 2024, sitMountain: '子' });
  assert.ok(result.xuankong);
  for (const line of result.xuankong.prompt.split('\n').slice(1)) {
    assert.ok(result.prompt.includes(line.trim()), `住宅正文缺少玄空资料：${line}`);
  }
  assert.match(result.prompt, /山向克出：山星8土克向星1水/);
  assert.match(result.prompt, /运8（土，退气）/);
});
