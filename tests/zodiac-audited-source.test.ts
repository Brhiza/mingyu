import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeZodiacEvidence,
  getZodiacYearFortune,
  rebuildAuditedZodiacData,
  type ZodiacGenerationSource,
  type ZodiacYearFortune,
} from '../packages/core/src/zodiac/index';

function createResult() {
  return getZodiacYearFortune('午', '庚子');
}

test('生肖流年结果应只保存生肖年支与流年干支作为可信来源', () => {
  const result = createResult();

  assert.deepEqual(result.generation, {
    zodiacBranch: '午',
    yearGanZhi: '庚子',
  });
  assert.deepEqual(Object.keys(result.generation).sort(), ['yearGanZhi', 'zodiacBranch']);
  assert.deepEqual(rebuildAuditedZodiacData(result), result);
});

test('生肖流年审核重建与证据入口应忽略全部旧派生字段污染', () => {
  const result = createResult();
  const polluted = structuredClone(result);
  polluted.zodiacBranch = '子';
  polluted.zodiac = '鼠';
  polluted.yearGanZhi = '甲辰';
  polluted.yearBranch = '辰';
  polluted.relation = '旧缓存伪造关系';
  polluted.elementRelation.label = '旧缓存伪造五行关系';
  polluted.harmony = '旧缓存伪造三合';
  polluted.meeting = '旧缓存伪造三会';
  polluted.conflicts = [];
  polluted.evidenceAnalysis.promptText = '旧缓存伪造证据';
  polluted.prompt = '旧缓存伪造提示词';

  assert.deepEqual(rebuildAuditedZodiacData(polluted), result);
  assert.deepEqual(analyzeZodiacEvidence(polluted), result.evidenceAnalysis);
  assert.doesNotMatch(rebuildAuditedZodiacData(polluted).prompt, /旧缓存伪造/);
});

test('生肖流年旧结果缺少可信来源、来源夹带或字段非法时应失败关闭', () => {
  const result = createResult();
  const legacy = structuredClone(result) as Partial<ZodiacYearFortune>;
  delete legacy.generation;
  assert.throws(() => rebuildAuditedZodiacData(legacy as ZodiacYearFortune), /缺少可信原始输入/);

  assert.throws(
    () => rebuildAuditedZodiacData(null as unknown as ZodiacYearFortune),
    /必须提供结果对象/,
  );

  const pollutedSource = structuredClone(result) as ZodiacYearFortune & {
    generation: ZodiacGenerationSource & { conflicts: unknown };
  };
  pollutedSource.generation.conflicts = result.conflicts;
  assert.throws(() => rebuildAuditedZodiacData(pollutedSource), /包含不受支持的字段：conflicts/);

  const missingYear = structuredClone(result);
  delete (missingYear.generation as Partial<ZodiacGenerationSource>).yearGanZhi;
  assert.throws(() => rebuildAuditedZodiacData(missingYear), /缺少流年干支/);

  const invalidBranch = structuredClone(result);
  invalidBranch.generation.zodiacBranch = '无';
  assert.throws(() => rebuildAuditedZodiacData(invalidBranch), /生肖地支无效：无/);

  const invalidGanZhi = structuredClone(result);
  invalidGanZhi.generation.yearGanZhi = '甲丑';
  assert.throws(() => rebuildAuditedZodiacData(invalidGanZhi), /流年干支无效：甲丑/);

  const objectBranch = structuredClone(result);
  objectBranch.generation.zodiacBranch = {
    toString: () => '午',
  } as unknown as string;
  assert.throws(() => rebuildAuditedZodiacData(objectBranch), /生肖年支必须是字符串/);

  const objectGanZhi = structuredClone(result);
  objectGanZhi.generation.yearGanZhi = {
    toString: () => '庚子',
  } as unknown as string;
  assert.throws(() => rebuildAuditedZodiacData(objectGanZhi), /流年干支必须是字符串/);
});
