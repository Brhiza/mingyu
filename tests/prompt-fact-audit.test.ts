import assert from 'node:assert/strict';
import test from 'node:test';
import { extractDivinationPromptFacts } from '../scripts/prompt-audit/divination-facts';
import { extractZiweiFacts } from '../scripts/prompt-audit/natal-facts';
import { buildZiweiChartInput, calculateZiweiChart } from '../packages/core/src/ziwei/runtime';
import { buildPublicZiweiPromptForRuntime } from '../packages/core/src/prompt/public-api';
import {
  auditPromptFacts,
  assertPromptFactCoverage,
  type PromptFactExpectation,
} from '../scripts/prompt-audit/facts';

const facts: PromptFactExpectation[] = [
  {
    id: '本人年柱',
    owner: '年柱',
    values: ['甲子'],
    scope: { start: '【本人】', end: '【对方】' },
  },
  {
    id: '本人月柱',
    owner: '月柱',
    values: ['乙丑'],
    scope: { start: '【本人】', end: '【对方】' },
  },
  { id: '对方年柱', owner: '年柱', values: ['乙丑'], scope: { start: '【对方】' } },
];
const prompt = '【本人】\n年柱：甲子\n月柱：乙丑\n【对方】\n年柱：乙丑';

const ziweiFactOptions = {
  scope: { start: '【本命资料】', end: '【任务】' },
  activeFactStyle: 'public',
  palaceValueStyle: 'public',
  mutagenValueStyle: 'public',
} as const;
let ziweiAuditRuntime: ReturnType<typeof calculateZiweiChart> | undefined;
function getZiweiAuditRuntime() {
  return (ziweiAuditRuntime ??= calculateZiweiChart(
    buildZiweiChartInput({
      name: '四化审查虚构样本',
      gender: 'male',
      dateType: 'solar',
      year: '1993',
      month: '4',
      day: '8',
      timeIndex: '',
      isLeapMonth: false,
      useTrueSolarTime: true,
      birthHour: '23',
      birthMinute: '34',
      birthLongitude: '103.8198',
    }),
    { scopes: ['origin', 'yearly'], horoscopeContext: { dateStr: '2026-05-19', hourIndex: 5 } },
  ));
}

test('真实紫微流年四化审查逐项绑定宫内注记，删注记和错宫均失败', async () => {
  const runtime = await getZiweiAuditRuntime();
  const payload = runtime.payloadByScope.yearly;
  const text = buildPublicZiweiPromptForRuntime({
    result: runtime,
    scope: 'yearly',
    question: '解读当前事业与财务主题。',
  });
  const expectations = extractZiweiFacts(payload, ziweiFactOptions);
  const mapFacts = expectations.filter((item) => /\.mutagens(?:\.|$)/u.test(item.id));
  assert.equal(mapFacts.length, payload.active_scope.mutagen_map.length);
  assert.equal(mapFacts.length, 4);
  assert.doesNotMatch(text, /^当前四化：/mu);
  assert.deepEqual(auditPromptFacts(text, expectations).missing, []);
  for (const [index, mapping] of payload.active_scope.mutagen_map.entries()) {
    const target = payload.palaces.find((palace) => palace.index === mapping.palace_index);
    assert.ok(target);
    const owner = `${target.name}（${target.heavenly_stem}${target.earthly_branch}）：`;
    const line = text.split('\n').find((item) => item.trimStart().startsWith(owner));
    assert.ok(line);
    const starPattern = new RegExp(`${mapping.star}\\([^)]*当前化${mapping.mutagen}[^)]*\\)`, 'u');
    const annotation = line.match(starPattern)?.[0];
    assert.ok(annotation);
    const removed = text.replace(
      line,
      line.replace(annotation, annotation.replace(`，当前化${mapping.mutagen}`, '')),
    );
    assert.ok(auditPromptFacts(removed, expectations).missing.includes(mapFacts[index].id));
    const wrongPalace = payload.palaces.find((palace) => palace.index !== target.index);
    assert.ok(wrongPalace);
    const swapped = text.replace(
      line,
      line.replace(
        owner,
        `${wrongPalace.name}（${wrongPalace.heavenly_stem}${wrongPalace.earthly_branch}）：`,
      ),
    );
    assert.ok(auditPromptFacts(swapped, expectations).missing.includes(mapFacts[index].id));
    const changedLayer = text.replace(
      line,
      line.replace(
        annotation,
        annotation.replace(`当前化${mapping.mutagen}`, `生年化${mapping.mutagen}`),
      ),
    );
    assert.ok(auditPromptFacts(changedLayer, expectations).missing.includes(mapFacts[index].id));
  }
});

test('真实紫微同宫另一星曜四化不能冒充目标星曜注记', async () => {
  const runtime = await getZiweiAuditRuntime();
  const payload = runtime.payloadByScope.yearly;
  const text = buildPublicZiweiPromptForRuntime({
    result: runtime,
    scope: 'yearly',
    question: '解读当前四化。',
  });
  const expectations = extractZiweiFacts(payload, ziweiFactOptions);
  const mapping = payload.active_scope.mutagen_map[0];
  const target = payload.palaces.find((palace) => palace.index === mapping.palace_index);
  assert.ok(target);
  const otherStar = [...target.major_stars, ...target.minor_stars, ...target.other_stars].find(
    (star) => star.name !== mapping.star && star.active_scope_mutagen !== mapping.mutagen,
  );
  assert.ok(otherStar);
  const owner = `${target.name}（${target.heavenly_stem}${target.earthly_branch}）：`;
  const line = text.split('\n').find((item) => item.trimStart().startsWith(owner));
  assert.ok(line);
  const moved = line
    .replace(new RegExp(`${mapping.star}\\([^)]*\\)`, 'u'), (annotation) =>
      annotation.replace(`，当前化${mapping.mutagen}`, ''),
    )
    .replace(new RegExp(`${otherStar.name}(?:\\([^)]*\\))?`, 'u'), (annotation) =>
      annotation.endsWith(')')
        ? `${annotation.slice(0, -1)}，当前化${mapping.mutagen})`
        : `${annotation}(当前化${mapping.mutagen})`,
    );
  assert.ok(
    moved.includes(mapping.star) &&
      moved.includes(otherStar.name) &&
      moved.includes(`当前化${mapping.mutagen}`),
  );
  assert.ok(
    auditPromptFacts(text.replace(line, moved), expectations).missing.includes(
      'ziwei.yearly.mutagens',
    ),
  );
});

test('真实紫微额外动态信息在摘要中逐项核验，另一行相同动态名不能补足', async () => {
  const runtime = await getZiweiAuditRuntime();
  const payload = structuredClone(runtime.payloadByScope.yearly);
  const mapping = payload.active_scope.mutagen_map[0];
  mapping.dynamic_palace_name = '额外流年命宫';
  const selectedRuntime = {
    ...runtime,
    payloadByScope: { ...runtime.payloadByScope, yearly: payload },
  };
  const text = buildPublicZiweiPromptForRuntime({
    result: selectedRuntime,
    scope: 'yearly',
    question: '解读当前四化。',
  });
  const expectations = extractZiweiFacts(payload, ziweiFactOptions);
  assert.equal(
    expectations.filter((item) => /\.mutagens(?:\.|$)/u.test(item.id)).length,
    payload.active_scope.mutagen_map.length,
  );
  assert.deepEqual(auditPromptFacts(text, expectations).missing, []);
  const summary = `${mapping.star}化${mapping.mutagen}入本命${mapping.palace_name}（动态${mapping.dynamic_palace_name}）`;
  assert.ok(text.includes(summary));
  const removed = text.replace(
    summary,
    summary.replace(`（动态${mapping.dynamic_palace_name}）`, ''),
  );
  assert.ok(auditPromptFacts(removed, expectations).missing.includes('ziwei.yearly.mutagens'));
  const borrowed = removed.replace(
    '【任务】',
    `旁记：动态${mapping.dynamic_palace_name}\n\n【任务】`,
  );
  assert.ok(auditPromptFacts(borrowed, expectations).missing.includes('ziwei.yearly.mutagens'));
  const target = payload.palaces.find((palace) => palace.index === mapping.palace_index);
  assert.ok(target);
  mapping.dynamic_palace_name = target.dynamic_scope_name;
  const annotatedText = buildPublicZiweiPromptForRuntime({
    result: selectedRuntime,
    scope: 'yearly',
    question: '解读当前四化。',
  });
  const annotationExpectations = extractZiweiFacts(payload, ziweiFactOptions);
  assert.deepEqual(auditPromptFacts(annotatedText, annotationExpectations).missing, []);
  const owner = `${target.name}（${target.heavenly_stem}${target.earthly_branch}）：`;
  const line = annotatedText.split('\n').find((item) => item.trimStart().startsWith(owner));
  assert.ok(line && mapping.dynamic_palace_name);
  const missingDynamic = annotatedText.replace(
    line,
    line.replace(`；动态宫名：${mapping.dynamic_palace_name}`, ''),
  );
  assert.ok(
    auditPromptFacts(missingDynamic, annotationExpectations).missing.includes(
      'ziwei.yearly.mutagens',
    ),
  );
});

test('真实紫微生年四化始终绑定本命宫和化星，不被当前四化替代', async () => {
  const runtime = await getZiweiAuditRuntime();
  const payload = runtime.payloadByScope.origin;
  const text = buildPublicZiweiPromptForRuntime({
    result: runtime,
    scope: 'origin',
    question: '解读生年四化。',
  });
  const expectations = extractZiweiFacts(payload, ziweiFactOptions);
  const birthFacts = expectations.filter((item) => item.id.includes('.birth-mutagen.'));
  assert.equal(birthFacts.length, 4);
  assert.deepEqual(auditPromptFacts(text, expectations).missing, []);
  const first = birthFacts[0];
  const annotation = first.values[0];
  const changed = annotation.replace('生年化', '当前化');
  assert.ok(text.includes(annotation));
  assert.ok(
    auditPromptFacts(text.replace(annotation, changed), expectations).missing.includes(first.id),
  );
});

test('住宅事实审查从输入摘要读取坐向与宅运年份', () => {
  const residentialFacts = extractDivinationPromptFacts('residential', {
    inputSummary: { orientationText: '坐子向午', houseYear: 2024 },
  });
  assert.deepEqual(
    residentialFacts.map((item) => item.id),
    ['residential.orientation', 'residential.house-year'],
  );
  const chart = '山向：坐子向午\n宅运年份：2024';
  assert.equal(auditPromptFacts(chart, residentialFacts).present, 2);
  assert.deepEqual(auditPromptFacts(chart.replace('2024', '2023'), residentialFacts).missing, [
    'residential.house-year',
  ]);
});

test('梅花事实审查在变卦阶段核对变后体用与生克归属', () => {
  const changedFacts = extractDivinationPromptFacts('meihua', {
    changedName: '天火同人',
    changedTiGua: { name: '乾', element: '金' },
    changedYongGua: { name: '离', element: '火' },
    analysis: { changedTiYongRelation: '用克体' },
    evidenceAnalysis: { stages: [{ stage: 'result', status: '已计算' }] },
  }).filter((item) => item.id === 'meihua.changed');
  assert.equal(changedFacts.length, 1);
  const resultLine = '变卦天火同人：体卦乾金（月令死），用卦离火（月令旺），关系用克体';
  assert.equal(auditPromptFacts(resultLine, changedFacts).present, 1);
  assert.equal(auditPromptFacts(resultLine.replace('用克体', '用生体'), changedFacts).present, 0);
  assert.equal(auditPromptFacts(resultLine.replace('变卦', '互卦'), changedFacts).present, 0);
});

test('事实覆盖核验归属及值，交换柱位仍有相同关键词时应检出错绑', () => {
  assert.equal(auditPromptFacts(prompt, facts).present, 3);
  const swapped = '【本人】\n年柱：乙丑\n月柱：甲子\n【对方】\n年柱：乙丑';
  assert.deepEqual(auditPromptFacts(swapped, facts).missing, ['本人年柱', '本人月柱']);
});

test('相同干支出现在另一主体或另一时段不能填补缺失事实', () => {
  const missing = prompt.replace('年柱：甲子', '年柱：未列');
  assert.deepEqual(auditPromptFacts(`${missing}\n对方备注：年柱甲子`, facts).missing, ['本人年柱']);
  const temporal: PromptFactExpectation[] = [
    {
      id: '交运前条件',
      owner: '甲子运',
      values: ['2026-02-03', '未合化'],
      scope: { start: '【交运前】', end: '【交运后】' },
    },
  ];
  assert.equal(
    auditPromptFacts(
      '【交运前】\n甲子运2026-02-03未合化\n【交运后】\n甲子运2026-02-04合化',
      temporal,
    ).present,
    1,
  );
  assert.equal(
    auditPromptFacts(
      '【交运前】\n甲子运2026-02-03合化\n【交运后】\n甲子运2026-02-03未合化',
      temporal,
    ).present,
    0,
  );
});

test('跨盘落宫审查隔离关系区段并绑定连续方向短句', () => {
  const overlay: PromptFactExpectation[] = [
    {
      id: '甲太阳落乙第五宫',
      owner: '第一人甲的太阳',
      values: ['落入第二人乙的本命盘第5宫'],
      scope: { start: '【跨盘落宫】', end: '【任务】' },
      unit: 'line',
    },
  ];
  const correct = '第一人甲的太阳（白羊座，第2宫）落入第二人乙的本命盘第5宫。';
  const aspect = '第一人甲的太阳（自身本命第5宫）与第二人乙的月亮：合相。';
  const text = `【跨盘相位】\n${aspect}\n【跨盘落宫】\n${correct}\n【任务】`;
  assert.equal(auditPromptFacts(text, overlay).present, 1);
  assert.deepEqual(auditPromptFacts(text, overlay).repeated, []);
  assert.equal(auditPromptFacts(text.replace(correct, ''), overlay).present, 0);
  assert.equal(
    auditPromptFacts(text.replace(correct, '').replace(aspect, correct), overlay).present,
    0,
  );
  assert.equal(
    auditPromptFacts(text.replace(correct, '第二人乙的太阳落入第一人甲的本命盘第5宫。'), overlay)
      .present,
    0,
  );
  assert.equal(
    auditPromptFacts(
      text.replace(correct, '第一人甲的太阳（自身本命第5宫）落入第二人乙的本命盘第6宫。'),
      overlay,
    ).present,
    0,
  );
});

test('返照审查把完整相位归到相邻窗口标题，其他相位偏差不能拼补', () => {
  const owner = '太阳返照有效期2026-04-08至2027-01-01（结束时刻不含）：返照时刻2026-04-08 10:00:00';
  const relation = '太阳合相太阳（偏差0.00°，紧密）';
  const otherHeader =
    '太阳返照有效期2026-01-01至2026-04-08（结束时刻不含）：返照时刻2025-04-08 09:00:00';
  const expectations: PromptFactExpectation[] = [
    {
      id: '本年度太阳返照',
      owner,
      values: [relation],
      scope: { start: '【周期】', end: '【任务】' },
      unit: 'line',
      includeNextLine: true,
    },
    {
      id: '上期太阳返照',
      owner: otherHeader,
      values: [relation],
      scope: { start: '【周期】', end: '【任务】' },
      unit: 'line',
      includeNextLine: true,
    },
  ];
  const otherBody = `太阳返照盘：对本命主要相位${relation}。`;
  const selectedBody = `太阳返照盘：月亮落第5宫；对本命主要相位${relation}。`;
  const text = `【周期】\n${otherHeader}\n${otherBody}\n${owner}。\n${selectedBody}\n【任务】`;
  const original = auditPromptFacts(text, expectations);
  assert.equal(original.expected, 2);
  assert.equal(original.present, 2);
  assert.deepEqual(original.repeated, []);
  const mixed = selectedBody.replace(
    relation,
    '太阳合相太阳（偏差0.20°，紧密）、月亮拱相火星（偏差0.00°，紧密）',
  );
  assert.deepEqual(auditPromptFacts(text.replace(selectedBody, mixed), expectations).missing, [
    '本年度太阳返照',
  ]);
  assert.deepEqual(auditPromptFacts(text.replace(owner, otherHeader), expectations).missing, [
    '本年度太阳返照',
  ]);
  assert.deepEqual(
    auditPromptFacts(text.replace(`${owner}。\n${selectedBody}`, selectedBody), expectations)
      .missing,
    ['本年度太阳返照'],
  );
  assert.deepEqual(
    auditPromptFacts(text.replace(otherBody, '太阳返照盘：对本命相位未列。'), expectations).missing,
    ['上期太阳返照'],
  );
});

test('报告区分缺失与重复，整段删除或空事实清单不能通过', () => {
  assert.equal(
    auditPromptFacts(prompt.replace('月柱：乙丑', '月柱：乙丑\n月柱：乙丑'), facts).repeated[0]
      .occurrences,
    2,
  );
  assert.throws(
    () => assertPromptFactCoverage([{ name: '空样例', prompt, facts: [] }]),
    /尚未定义事实清单/,
  );
  assert.throws(
    () => assertPromptFactCoverage([{ name: '丢失主体', prompt: '【对方】\n年柱：乙丑', facts }]),
    /本人年柱/,
  );
  assert.throws(
    () => auditPromptFacts(prompt, [{ id: '空值', owner: '年柱', values: [] }]),
    /具体值/,
  );
});
