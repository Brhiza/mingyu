import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { getYearSixtyCycle, isKe } from '../src/systems/ganzhi-foundation';
import { getDunJiaStem } from '../src/systems/qimen/layout';
import { doorElements, hasTianPanStem } from '../src/systems/qimen/palace';
import { getMutagensByStem, type HeavenlyStem } from '../src/systems/ziwei/index';

const ziweiBirth = {
  year: 1990,
  month: 5,
  day: 15,
  clock: { kind: 'exact', hour: 14, minute: 30, second: 0 },
  timezone: 8,
} as const;

const qimenBirth = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  second: 0,
  timezone: 8,
} as const;

function extractSection(text: string, header: string): string {
  const start = text.indexOf(header);
  assert.ok(start >= 0, `缺少区块 ${header}`);
  const rest = text.slice(start);
  const next = rest.indexOf('\n\n【', header.length);
  return next >= 0 ? rest.slice(0, next) : rest;
}

test('紫微斗数精确盘原生输出压平大限（含·当前）与流年四化链，且保持紧凑无 ISO 时间戳', async () => {
  const result = await calculate('ziwei', {
    question: '整体事业财运走势如何？',
    birth: ziweiBirth,
    gender: 'male',
    referenceTime: '2026-05-15T04:00:00Z',
  });

  const block = extractSection(result.prompt.text, '【运限动态与流年四化（压平精要）】');
  const lines = block.split('\n');
  assert.equal(lines.length, 3); // 标题 + 大限 + 流年
  assert.match(lines[1], /^大限：/);
  assert.match(lines[2], /^流年：/);

  // 8 步大限，且精确标出 1 处 ·当前
  const decadalItems = lines[1].replace(/^大限：/, '').split('｜');
  assert.equal(decadalItems.length, 8);
  const currentMarks = decadalItems.filter((item) => item.includes('·当前'));
  assert.equal(currentMarks.length, 1);

  const nominalAge = result.data.reference!.layers.age.nominalAge!;
  const expectedCurrentPalace = result.data.natal.palaces.find(
    (p: any) => nominalAge >= p.decadal.range[0] && nominalAge <= p.decadal.range[1],
  );
  assert.ok(expectedCurrentPalace);
  assert.ok(
    currentMarks[0].includes(`${expectedCurrentPalace.name}${expectedCurrentPalace.heavenlyStem}${expectedCurrentPalace.earthlyBranch}(${expectedCurrentPalace.decadal.range[0]}-${expectedCurrentPalace.decadal.range[1]}·当前)`),
    currentMarks[0],
  );

  // 默认 3 年流年（2026丙午、2027丁未、2028戊申），验证落宫与四化禄忌
  const yearItems = lines[2].replace(/^流年：/, '').split('｜');
  assert.equal(yearItems.length, 3);
  for (const [idx, year] of [2026, 2027, 2028].entries()) {
    const gz = getYearSixtyCycle(year);
    const stem = gz[0] as HeavenlyStem;
    const branch = gz[1];
    const palace = result.data.natal.palaces.find((p: any) => p.earthlyBranch === branch);
    const mutagens = getMutagensByStem(stem, 'default');
    assert.ok(yearItems[idx].includes(`${year}${gz}`), yearItems[idx]);
    assert.ok(yearItems[idx].includes(`落${palace.name}${branch}`), yearItems[idx]);
    assert.ok(yearItems[idx].includes(`禄${mutagens[0]}/忌${mutagens[3]}`), yearItems[idx]);
  }

  // 零 ISO 时间戳，极度紧凑
  assert.doesNotMatch(block, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  assert.ok(block.length >= 120 && block.length <= 360, `长度异常: ${block.length}`);
});

test('紫微斗数随问题动态切换中期多年/流月/流日，支持 reprompt，未知时辰不编造', async () => {
  const medium = await calculate('ziwei', {
    question: '未来五年哪年机会最好？',
    birth: ziweiBirth,
    gender: 'female',
    referenceTime: '2026-05-15T04:00:00Z',
  });
  const mediumBlock = extractSection(medium.prompt.text, '【运限动态与流年四化（压平精要）】');
  for (const y of ['2026丙午', '2027丁未', '2028戊申', '2029己酉', '2030庚戌']) {
    assert.ok(mediumBlock.includes(y), y);
  }

  const monthFollow = await reprompt({
    method: 'ziwei',
    result: medium,
    question: '最近几个月适合跳槽吗？',
  });
  const monthBlock = extractSection(monthFollow.prompt.text, '【运限动态与流年四化（压平精要）】');
  assert.match(monthBlock, /参考流月：/);
  assert.doesNotMatch(monthBlock, /\d{4}-\d{2}-\d{2}T/);

  const dayFollow = await reprompt({
    method: 'ziwei',
    result: medium,
    question: '这几天哪一天适合签约？',
  });
  const dayBlock = extractSection(dayFollow.prompt.text, '【运限动态与流年四化（压平精要）】');
  assert.match(dayBlock, /参考流日：/);

  // 未知时辰候选汇总不强行编造压平运限块
  const unknown = await calculate('ziwei', {
    question: '今年运势如何？',
    birth: { ...ziweiBirth, clock: { kind: 'unknown' } },
    gender: 'male',
    referenceTime: '2026-05-15T04:00:00Z',
  });
  assert.doesNotMatch(unknown.prompt.text, /【运限动态与流年四化（压平精要）】/);
});

test('奇门终身局紧邻【阶段运限】输出压平阶段（含·当前）与流年天盘真实落宫', async () => {
  const result = await calculate('qimen-lifetime', {
    birth: qimenBirth,
    gender: 'male',
    stagePolicy: { model: 'decadalGanzhi' },
    topics: ['career', 'wealth'],
    question: '未来三年事业财运如何？',
    currentTime: '2026-05-15T04:00:00Z',
  });

  // 紧邻【阶段运限】之后出现
  const idxStage = result.prompt.text.indexOf('【阶段运限】');
  const idxCompact = result.prompt.text.indexOf('【阶段运限与流年落宫（压平精要）】');
  assert.ok(idxStage >= 0 && idxCompact > idxStage);

  const block = extractSection(result.prompt.text, '【阶段运限与流年落宫（压平精要）】');
  const lines = block.split('\n');
  assert.equal(lines.length, 3); // 标题 + 阶段 + 流年
  assert.match(lines[1], /^阶段：/);
  assert.match(lines[2], /^流年：/);

  // 精确标出 1 处 ·当前
  const stageItems = lines[1].replace(/^阶段：/, '').split('｜');
  const currentStages = stageItems.filter((item) => item.includes('·当前'));
  assert.equal(currentStages.length, 1);

  // 校验流年天盘干落宫、门星及空亡/门迫/击刑标注
  const yearItems = lines[2].replace(/^流年：/, '').split('｜');
  assert.equal(yearItems.length, 5); // "未来三年" 触发 medium-term 5 年窗
  const voidSet = new Set((result.data.baseChart.voidPalaces ?? []).map((v: any) => v.palace));
  const punishments: Record<string, number> = { 戊: 3, 己: 2, 庚: 8, 辛: 9, 壬: 4, 癸: 4 };

  for (const [idx, year] of [2026, 2027, 2028, 2029, 2030].entries()) {
    const gz = getYearSixtyCycle(year);
    const stem = gz[0];
    const lookup = stem === '甲' ? getDunJiaStem(gz) : stem;
    const palace =
      result.data.baseChart.jiuGongGe.find((p: any) => p.gong !== 5 && hasTianPanStem(p, lookup)) ??
      result.data.baseChart.jiuGongGe.find((p: any) => hasTianPanStem(p, lookup));
    assert.ok(palace);
    const door = palace.renPan.door || '';
    const star =
      palace.tianPan.companionStem === lookup && palace.tianPan.companionStar
        ? palace.tianPan.companionStar
        : palace.tianPan.star;

    assert.ok(yearItems[idx].includes(`${year}${gz}`), yearItems[idx]);
    assert.ok(yearItems[idx].includes(`落${palace.name}`), yearItems[idx]);
    assert.ok(yearItems[idx].includes(`${door}${star}`), yearItems[idx]);
    if (voidSet.has(palace.gong)) assert.ok(yearItems[idx].includes('空亡'), yearItems[idx]);
    if (door && doorElements[door] && isKe(doorElements[door], palace.element)) {
      assert.ok(yearItems[idx].includes('门迫'), yearItems[idx]);
    }
    if (punishments[lookup] === palace.gong) {
      assert.ok(yearItems[idx].includes('击刑'), yearItems[idx]);
    }
  }

  assert.doesNotMatch(block, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
  assert.ok(block.length >= 120 && block.length <= 420, `长度异常: ${block.length}`);
});

test('奇门终身局支持甲年遁仪、四柱四限、scope=natal 省略与 reprompt 动态切窗', async () => {
  const result = await calculate('qimen-lifetime', {
    birth: qimenBirth,
    gender: 'female',
    stagePolicy: { model: 'pillarFourLimits' },
    question: '2024年和2026年运势如何？',
    currentTime: '2026-05-15T04:00:00Z',
  });

  const block = extractSection(result.prompt.text, '【阶段运限与流年落宫（压平精要）】');
  assert.match(block, /·当前/);
  // 2024甲辰 -> 甲辰遁壬
  assert.match(block, /2024甲辰\(天盘甲遁壬落/);
  assert.match(block, /2026丙午\(天盘丙落/);

  // reprompt 校验数据一致性并切换目标年份
  const followup = await reprompt({
    method: 'qimen-lifetime',
    result,
    question: '2029年怎么样？',
  });
  const followBlock = extractSection(followup.prompt.text, '【阶段运限与流年落宫（压平精要）】');
  assert.match(followBlock, /2029己酉\(天盘己落/);

  // scope: natal 不输出阶段运限压平块
  const natalOnly = await calculate('qimen-lifetime', {
    birth: qimenBirth,
    gender: 'female',
    stagePolicy: { model: 'pillarFourLimits' },
    question: '只看本命盘',
    currentTime: '2026-05-15T04:00:00Z',
    prompt: { scope: 'natal' },
  });
  assert.doesNotMatch(natalOnly.prompt.text, /【阶段运限与流年落宫（压平精要）】/);
});
