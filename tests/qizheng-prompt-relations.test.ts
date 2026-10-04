import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateQizheng,
  formatQizhengFlowTimestampNote,
} from '../packages/core/src/qi_zheng/index';
import { extractQizhengFacts } from '../scripts/prompt-audit/natal-facts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts';

test('未提供性别时流曜提示词只要求使用已生成的目标时段资料', () => {
  const result = generateQizheng({
    year: 1993,
    month: 4,
    day: 8,
    hour: 23,
    minute: 34,
    timezone: 8,
    flowYear: 2022,
    flowMonth: 6,
    flowDay: 15,
  });
  assert.ok(result.flowingStars);
  assert.equal(formatQizhengFlowTimestampNote(result.flowingStars), '流曜周期按2022年6月15日扫描');
  assert.equal(result.timeLords, undefined);
  assert.ok(result.prompt.includes('流曜周期按2022年6月15日扫描；落宫时刻 2022-06-15T12:00:00。'));
  assert.doesNotMatch(result.prompt, /落宫取当日 12:00/u);
  assert.match(result.prompt, /目标时段结合已列流曜与周期星象分析/);
  assert.doesNotMatch(result.prompt, /目标时段结合流曜、小限与太岁分析/);
  const facts = extractQizhengFacts(result);
  assert.deepEqual(auditPromptFacts(result.prompt, facts).missing, []);
  const timestampLine = '流曜周期按2022年6月15日扫描；落宫时刻 2022-06-15T12:00:00。';
  for (const changedLine of [
    '；落宫时刻 2022-06-15T12:00:00。',
    '流曜周期按2022年6月16日扫描；落宫时刻 2022-06-15T12:00:00。',
    '流曜周期按2022年6月15日扫描；落宫时刻 。',
    '流曜周期按2022年6月15日扫描；落宫时刻 2022-06-15T12:01:00。',
  ]) {
    assert.deepEqual(
      auditPromptFacts(result.prompt.replace(timestampLine, changedLine), facts).missing,
      ['qizheng.flow.timestamp'],
    );
  }
});

test('只指定流分时，流曜采样时刻与提示词时间一致', () => {
  const result = generateQizheng({
    year: 1993,
    month: 4,
    day: 8,
    hour: 23,
    minute: 34,
    timezone: 8,
    flowYear: 2022,
    flowMonth: 6,
    flowDay: 15,
    flowMinute: 37,
  });
  assert.equal(result.flowingStars?.localDateTime, '2022-06-15T12:37:00');
  assert.match(result.flowingStars?.timestampNote ?? '', /落宫取 12:37/);
  assert.ok(result.prompt.includes('流曜周期按2022年6月15日扫描；落宫时刻 2022-06-15T12:37:00。'));
  const clockLine = result.prompt
    .split('\n')
    .find((line) => line.includes('落宫时刻 2022-06-15T12:37:00'));
  assert.ok(clockLine);
  assert.equal(clockLine.match(/12:37/g)?.length, 1);
  assert.doesNotMatch(result.prompt, /落宫取 12:37/u);
  const facts = extractQizhengFacts(result);
  assert.deepEqual(auditPromptFacts(result.prompt, facts).missing, []);
  const timestampLine = '流曜周期按2022年6月15日扫描；落宫时刻 2022-06-15T12:37:00。';
  for (const changedLine of [
    '；落宫时刻 2022-06-15T12:37:00。',
    '流曜周期按2022年6月16日扫描；落宫时刻 2022-06-15T12:37:00。',
    '流曜周期按2022年6月15日扫描；落宫时刻 。',
    '流曜周期按2022年6月15日扫描；落宫时刻 2022-06-15T12:38:00。',
  ]) {
    assert.deepEqual(
      auditPromptFacts(result.prompt.replace(timestampLine, changedLine), facts).missing,
      ['qizheng.flow.timestamp'],
    );
  }
  for (const [note, shownNote] of [
    [
      '未指定流日时，流曜周期按2022年6月整月扫描；落宫取月中 15日 12:00，不代替整月',
      '流曜周期按2022年6月整月扫描；落宫取月中 15日 12:00',
    ],
    [
      '未指定流月时，流曜周期自立春扫描至次年立春；落宫取立春交节，不代替全年',
      '流曜周期自立春扫描至次年立春；落宫取立春交节',
    ],
  ]) {
    assert.equal(
      formatQizhengFlowTimestampNote({ ...result.flowingStars!, timestampNote: note }),
      shownNote,
    );
  }
  assert.equal(
    formatQizhengFlowTimestampNote({
      ...result.flowingStars!,
      localDateTime: '2022-06-15T12:38:00',
    }),
    result.flowingStars!.timestampNote,
  );
});

test('流曜吊照绑定采样时刻并保留落宫关系，角距两端来自不同时间盘', () => {
  const result = generateQizheng({
    year: 1993,
    month: 4,
    day: 8,
    hour: 23,
    minute: 34,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
    flowYear: 2022,
    flowMonth: 6,
    flowDay: 15,
    flowHour: 12,
  });
  const flowing = result.flowingStars!;
  assert.ok(flowing.transits.length > 0);
  for (const aspect of flowing.transits) {
    const first = flowing.stars.find((star) => `流曜${star.name}` === aspect.star1)!;
    const second = result.stars.find((star) => `本命${star.name}` === aspect.star2)!;
    const raw = Math.abs(first.longitude - second.longitude);
    const angle = Math.min(raw, 360 - raw);
    assert.ok(Math.abs(angle - aspect.actualAngle) < 0.0001);
    assert.ok(Math.abs(Math.abs(angle - aspect.exactAngle) - aspect.orb) < 0.0001);
    assert.ok(result.prompt.includes(`${aspect.star1}与${aspect.star2}：`));
    const relation = aspect.type === '同宫' ? '合相' : aspect.type;
    const palaceRelation = first.signBranch === second.signBranch ? '同宫' : '异宫';
    assert.ok(
      result.prompt.includes(
        `${aspect.star1}与${aspect.star2}：${relation}；目标角${aspect.exactAngle}°，实际角距${aspect.actualAngle.toFixed(2)}°，偏差${aspect.orb.toFixed(2)}°，容许偏差上限${aspect.allowedOrb}°，${aspect.closeness}；落宫关系${palaceRelation}`,
      ),
    );
    assert.ok(
      result.prompt.includes(
        `流曜${first.name}：在${first.xiu}宿${first.xiuDegree.toFixed(2)}度，入本命${first.signBranch}宫${first.palace}`,
      ),
    );
    assert.ok(
      result.prompt.includes(
        `${second.kind} ${second.name}：在${second.xiu}宿${second.xiuDegree.toFixed(2)}度，落${second.signBranch}宫${second.palace}`,
      ),
    );
  }
  const flowingText = result.prompt.split('【流曜】\n')[1]?.split('【流曜周期】')[0] ?? '';
  assert.equal((flowingText.match(/落宫时刻 2022-06-15T12:00:00/g) ?? []).length, 1);
  assert.doesNotMatch(flowingText, /采样时刻2022-06-15T12:00:00/);
  assert.equal(flowing.periodEvents?.mode, 'daily');
});

test('七政正文区分跨宫合相与同宫位置，并保留角距和偏差口径', () => {
  const result = generateQizheng({
    year: 2026,
    month: 5,
    day: 19,
    hour: 10,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });
  assert.match(
    result.prompt,
    /太阳与辰星\(水\)：合相；目标角0°，实际角距5\.48°，偏差5\.48°，容许偏差上限8°；落宫关系异宫/,
  );
  assert.match(
    result.prompt,
    /太阴与太白\(金\)：合相；目标角0°，实际角距0\.39°，偏差0\.39°，容许偏差上限8°；落宫关系同宫/,
  );
  const stars = new Map(result.stars.map((star) => [star.name, star]));
  for (const aspect of result.aspects) {
    const first = stars.get(aspect.star1)!;
    const second = stars.get(aspect.star2)!;
    const raw = Math.abs(first.longitude - second.longitude);
    const angle = Math.min(raw, 360 - raw);
    assert.ok(Math.abs(angle - aspect.actualAngle) < 0.0001);
    assert.ok(Math.abs(Math.abs(angle - aspect.exactAngle) - aspect.orb) < 0.0001);
    assert.ok(aspect.orb <= aspect.allowedOrb);
    if (first.name === '罗睺(火余)' && second.name === '计都(土余)') continue;
    assert.ok(result.prompt.includes(`${first.name}与${second.name}：`));
    assert.ok(
      !result.prompt.includes(
        `${first.name}（${first.signBranch}宫${first.palace}）与${second.name}（${second.signBranch}宫${second.palace}）`,
      ),
    );
  }
  assert.equal(
    result.aspects.find((aspect) => aspect.star1 === '太阳' && aspect.star2 === '辰星(水)')?.type,
    '同宫',
  );
  const crossPalace = result.evidenceAnalysis.aspectFacts.find(
    (aspect) => aspect.star1 === '太阳' && aspect.star2 === '辰星(水)',
  );
  assert.match(crossPalace?.promptText ?? '', /太阳与辰星\(水\)合相：/u);
  assert.doesNotMatch(crossPalace?.promptText ?? '', /太阳与辰星\(水\)同宫：/u);
  assert.match(crossPalace?.sources[0] ?? '', /合相容许度/u);
  const evidence = result.evidenceAnalysis;
  assert.equal(evidence.promptText.split(evidence.summaryFact.promptText).length - 1, 1);
  assert.equal(evidence.promptText.split(evidence.counterSummaryFact.promptText).length - 1, 1);
});

test('七政在线任务书省去恒定罗计对照和重复星曜名单，完整盘仍保留吊照事实', () => {
  const result = generateQizheng({
    year: 2026,
    month: 5,
    day: 19,
    hour: 10,
    minute: 30,
    latitude: 39.9,
    longitude: 116.4,
    timezone: 8,
  });
  const nodalAspect = result.aspects.find(
    (aspect) => aspect.star1 === '罗睺(火余)' && aspect.star2 === '计都(土余)',
  );
  assert.equal(nodalAspect?.type, '对照');
  assert.equal(nodalAspect?.actualAngle, 180);
  assert.match(result.prompt, /四余 罗睺\(火余\)：/);
  assert.match(result.prompt, /四余 计都\(土余\)：/);
  assert.match(result.prompt, /太白\(金\)与紫炁\(木余\)：对照/);
  assert.doesNotMatch(result.prompt, /罗睺\(火余\)与计都\(土余\)：对照/);
  assert.doesNotMatch(result.prompt, /七政：太阳、太阴、水、金、火、木、土；四余：/);
  assert.ok(
    !extractQizhengFacts(result).some(
      (fact) => fact.id === `qizheng.natal.aspect.${result.aspects.indexOf(nodalAspect!)}`,
    ),
  );
  assert.match(result.prompt, /命主：月（水）；命主恩星：太白\(金\)/u);
  assert.equal(result.prompt.match(/太阴与太白\(金\)：合相/gu)?.length, 1);
  assert.doesNotMatch(result.prompt, /恩星太白\(金\)与命主形成合相吊照/u);
});
