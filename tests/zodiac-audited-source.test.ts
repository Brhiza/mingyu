import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeZodiacEvidence,
  getZodiacYearFortune,
  rebuildAuditedZodiacData,
  resolveZodiacYearGanZhi,
  type ZodiacGenerationSource,
  type ZodiacYearFortune,
} from '../packages/core/src/zodiac/index';
import { EARTHLY_BRANCHES, SIXTY_CYCLE } from '../packages/core/src/ganzhi/index';

const LIUCHONG_PAIRS = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
const LIUHAI_PAIRS = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
const LIUPO_PAIRS = ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌'];
const LIUHE_PAIRS = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
const SANHE_GROUPS = [
  ['水局', '申子辰'],
  ['木局', '亥卯未'],
  ['火局', '寅午戌'],
  ['金局', '巳酉丑'],
] as const;
const SANHUI_GROUPS = [
  ['东方木', '寅卯辰'],
  ['南方火', '巳午未'],
  ['西方金', '申酉戌'],
  ['北方水', '亥子丑'],
] as const;

function hasPair(pairs: readonly string[], left: string, right: string) {
  return left !== right && pairs.some((pair) => pair.includes(left) && pair.includes(right));
}

function findGroup(groups: ReadonlyArray<readonly [string, string]>, left: string, right: string) {
  if (left === right) return undefined;
  return groups.find(([, members]) => members.includes(left) && members.includes(right))?.[0];
}

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

test('生肖流年年份来源必须明确、合法且相互一致', () => {
  assert.throws(() => resolveZodiacYearGanZhi({}), /必须明确提供 year 或 yearGanZhi/);
  assert.equal(resolveZodiacYearGanZhi({ year: 2024 }), '甲辰');
  assert.equal(resolveZodiacYearGanZhi({ yearGanZhi: '甲辰' }), '甲辰');
  assert.equal(resolveZodiacYearGanZhi({ year: 2024, yearGanZhi: '甲辰' }), '甲辰');
  assert.throws(
    () => resolveZodiacYearGanZhi({ year: 2024, yearGanZhi: '庚子' }),
    /year 与 yearGanZhi 不一致/,
  );
  assert.throws(() => resolveZodiacYearGanZhi({ year: 2024.5 }), /必须是1900至2200之间的整数/);
  assert.throws(() => resolveZodiacYearGanZhi({ year: 1899 }), /必须是1900至2200之间的整数/);
  assert.throws(() => resolveZodiacYearGanZhi({ year: 2201 }), /必须是1900至2200之间的整数/);
  assert.throws(() => resolveZodiacYearGanZhi({ yearGanZhi: '甲丑' }), /不是有效的六十甲子/);
});

test('生肖十二地支与六十甲子720组应逐项符合独立关系表并可完整重建', () => {
  let checked = 0;
  for (const zodiacBranch of EARTHLY_BRANCHES) {
    for (const yearGanZhi of SIXTY_CYCLE) {
      const yearBranch = yearGanZhi[1];
      const result = getZodiacYearFortune(zodiacBranch, yearGanZhi);
      const expectedConflictTypes: string[] = [];
      if (zodiacBranch === yearBranch) expectedConflictTypes.push('值太岁');
      if (hasPair(LIUCHONG_PAIRS, zodiacBranch, yearBranch)) expectedConflictTypes.push('冲太岁');
      if (
        hasPair(['子卯'], zodiacBranch, yearBranch) ||
        (zodiacBranch === yearBranch && '辰午酉亥'.includes(zodiacBranch))
      ) {
        expectedConflictTypes.push('刑太岁');
      }
      if (hasPair(LIUHAI_PAIRS, zodiacBranch, yearBranch)) expectedConflictTypes.push('害太岁');
      if (hasPair(LIUPO_PAIRS, zodiacBranch, yearBranch)) expectedConflictTypes.push('破太岁');

      const sanheGroup = findGroup(SANHE_GROUPS, zodiacBranch, yearBranch);
      const sanhuiGroup = findGroup(SANHUI_GROUPS, zodiacBranch, yearBranch);
      const expectedHarmony = hasPair(LIUHE_PAIRS, zodiacBranch, yearBranch)
        ? '六合关系'
        : sanheGroup
          ? `三合组成员关系（${sanheGroup}）`
          : null;
      const expectedMeeting = sanhuiGroup ? `三会组成员关系（${sanhuiGroup}）` : null;

      assert.deepEqual(
        result.conflicts.map((item) => item.type),
        expectedConflictTypes,
        `${zodiacBranch}/${yearGanZhi}犯太岁关系不符`,
      );
      assert.equal(result.harmony, expectedHarmony, `${zodiacBranch}/${yearGanZhi}三合六合不符`);
      assert.equal(result.meeting, expectedMeeting, `${zodiacBranch}/${yearGanZhi}三会成员不符`);
      assert.deepEqual(rebuildAuditedZodiacData(result), result);

      const evidence = result.evidenceAnalysis;
      const factKeys = [
        ...evidence.calculationSteps.map((item) => item.key),
        ...evidence.relations.map((item) => item.key),
        ...evidence.counterEvidenceFacts.map((item) => item.key),
        evidence.counterSummaryFact.key,
        ...evidence.limitationFacts.map((item) => item.key),
      ];
      assert.equal(evidence.summaryFact.status, '证据链完整');
      assert.equal(
        new Set(factKeys).size,
        factKeys.length,
        `${zodiacBranch}/${yearGanZhi}证据键重复`,
      );
      assert.deepEqual(evidence.summaryFact.factKeys, factKeys);
      checked += 1;
    }
  }
  assert.equal(checked, 720);
});
