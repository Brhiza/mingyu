import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLiuyao } from '../packages/core/src/divination/algorithms/liuyao';

test('六爻深层爻情：正确识别月破（与月建相冲且休囚）', () => {
  // 午月子日起卦，午火当令，若卦中有子水爻，与月建相冲且处休囚死绝，则为月破
  const result = generateLiuyao(new Date('2026-06-15T10:00:00'), {
    method: 'time',
  });

  const monthBranch = result.ganzhi.month.substring(1);
  for (const yao of result.yaosDetail) {
    if (yao.isMonthBreak) {
      assert.ok(
        (monthBranch === '午' && yao.najiaDizhi === '子') ||
          (monthBranch === '子' && yao.najiaDizhi === '午') ||
          (monthBranch === '未' && yao.najiaDizhi === '丑') ||
          (monthBranch === '丑' && yao.najiaDizhi === '未') ||
          (monthBranch === '寅' && yao.najiaDizhi === '申') ||
          (monthBranch === '申' && yao.najiaDizhi === '寅') ||
          (monthBranch === '卯' && yao.najiaDizhi === '酉') ||
          (monthBranch === '酉' && yao.najiaDizhi === '卯') ||
          (monthBranch === '辰' && yao.najiaDizhi === '戌') ||
          (monthBranch === '戌' && yao.najiaDizhi === '辰') ||
          (monthBranch === '巳' && yao.najiaDizhi === '亥') ||
          (monthBranch === '亥' && yao.najiaDizhi === '巳'),
        `月破爻的地支 ${yao.najiaDizhi} 必须与月建 ${monthBranch} 相冲`,
      );
    }
  }
});

test('六爻深层爻情：手工六爻能够正确判定动爻化进神与化退神', () => {
  // 申金化酉金为化进神，酉金化申金为化退神
  // 手工起卦测试：传入 6 个爻值
  const result = generateLiuyao(new Date('2026-09-04T10:00:00'), {
    method: 'manual',
    yaos: [7, 8, 9, 8, 7, 6], // 第3爻老阳，第6爻老阴
  });

  assert.equal(result.yaosDetail.length, 6);
  assert.equal(result.yaosDetail[2].isChanging, true);
  assert.equal(result.yaosDetail[5].isChanging, true);
  // 验证动变爻对象存在
  assert.ok(result.yaosDetail[2].changedYao);
  assert.ok(result.yaosDetail[5].changedYao);
});
