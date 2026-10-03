import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateQizhengBirthRange,
  generateQizhengFlowBirthRange,
} from '../packages/core/src/qi_zheng';
import { formatQizhengBirthRangePrompt } from '../src/lib/qizheng-birth-range-prompt';

test('七政本命区间资料保留月亮换宫两侧、整秒范围与完整连续量中文名称', () => {
  const startTimestamp = Date.parse('2024-02-19T11:24:48+08:00');
  const range = generateQizhengBirthRange(
    { year: 2024, month: 2, day: 19, hour: 11, minute: 24, second: 48, timezone: 8 },
    { startTimestamp, endTimestamp: startTimestamp + 2_000 },
  );
  const text = formatQizhengBirthRangePrompt(range);
  assert.ok(text.includes('东八区；计算参考地点：纬度39.9、经度116.4（北京参考坐标）；'));
  assert.equal(range.branches.length, 2);
  assert.match(text, /共2个时刻、2段/);
  assert.match(text, /2024-02-19 11:24:48 至 2024-02-19 11:24:49/);
  assert.match(text, /2024-02-19 11:24:49 至 2024-02-19 11:24:50/);
  const [shared, firstBranch, secondBranch] = text.split(/(?=【时段\d+】)/u);
  assert.match(shared!, /【全范围共同盘面】/u);
  assert.equal((text.match(/十二宫：/gu) ?? []).length, 1);
  assert.equal((text.match(/太阳：/gu) ?? []).length, 1);
  assert.equal((text.match(/太阴：/gu) ?? []).length, 2);
  assert.match(firstBranch!, /身宫巳。/u);
  assert.match(secondBranch!, /身宫辰。/u);
  assert.doesNotMatch(firstBranch!, /十二宫：|太阳：/u);
  assert.doesNotMatch(secondBranch!, /十二宫：|太阳：/u);
  for (const branch of range.branches) {
    for (const item of branch.continuous) assert.ok(text.includes(item.label));
    for (const item of branch.representative.enNan?.aspectInteraction ?? []) {
      assert.ok(text.includes(item));
    }
  }
  assert.match(text, /流年与行限属于另外的时段资料/);
  assert.match(text, /昼夜分金：.*当地太阳高度阈值/);
  assert.match(
    text,
    /昼夜分金：.*太阳中心名义高度负零点八三三度，含标准太阳半径与近地平折射近似。/u,
  );
  assert.doesNotMatch(text, /太阳上缘负零点八三三度/u);
  for (const branch of range.branches) {
    assert.equal(
      branch.representative.calculationContext.solarIllumination.sunriseSunset.solarAltitudeDegrees,
      -0.833,
    );
  }
  assert.doesNotMatch(text, /正常交点|全天高于阈值|全天低于阈值|光照日期/);
  assert.doesNotMatch(text, /罗睺\(火余\)[^。]*，—|计都\(土余\)[^。]*，—/);
  assert.doesNotMatch(text, /calculationContext|startTimestamp|sourceId|mingyu|API|MCP/);
  assert.doesNotMatch(
    text,
    /盘面证据|证据链状态|坐标来源|手动输入|现代天文计算|传统均速模型|计算口径/,
  );
});

test('黄道宫界两侧的零度吊照在出生区间资料中称为合相', () => {
  const startTimestamp = Date.parse('2024-06-20T12:00:00+08:00');
  const input = {
    year: 2024,
    month: 6,
    day: 20,
    hour: 12,
    timezone: 8,
  };
  const natal = generateQizhengBirthRange(input, {
    startTimestamp,
    endTimestamp: startTimestamp + 1_000,
  });
  const natalStars = natal.branches[0].representative.stars;
  assert.notEqual(
    natalStars.find((star) => star.name === '太阳')?.signBranch,
    natalStars.find((star) => star.name === '太白(金)')?.signBranch,
  );
  const natalText = formatQizhengBirthRangePrompt(natal);
  assert.match(natalText, /太阳与太白\(金\)合相/);
  assert.doesNotMatch(natalText, /太阳与太白\(金\)同宫/);

  const flow = generateQizhengFlowBirthRange(
    { ...input, flowYear: 2024, flowMonth: 6, flowDay: 21 },
    {
      startTimestamp,
      endTimestamp: startTimestamp + 1_000,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    },
  );
  const flowText = formatQizhengBirthRangePrompt(flow);
  assert.ok(flowText.includes('流曜周期按2024年6月21日扫描；代表时刻2024-06-21T12:00:00。'));
  assert.doesNotMatch(flowText, /落宫取当日 12:00/u);
  assert.equal(
    flow.branches[0].representative.flowingStars!.timestampNote,
    '流曜周期按2024年6月21日扫描；落宫取当日 12:00',
  );
  assert.equal(flow.branches[0].representative.timeLords, undefined);
  assert.match(flowText, /结合目标时段的流曜与周期星象解读/u);
  assert.doesNotMatch(flowText, /行限：性别未提供/u);
  assert.match(flowText, /流曜太阳与本命太阳合相/);
  assert.doesNotMatch(flowText, /流曜太阳与本命太阳同宫/);

  const period = flow.branches[0].periodEvents;
  period.events = [
    {
      identity: '太阳:太阳:零度角',
      kind: '精确吊照',
      movingStar: '太阳',
      targetStar: '太阳',
      aspectType: '同宫',
      aspectDirection: '正向',
      firstUtcMs: startTimestamp,
      lastUtcMs: startTimestamp,
      minUtcMs: startTimestamp,
      maxUtcMs: startTimestamp,
      sampleCount: 1,
      firstDateTime: period.startDateTime,
      lastDateTime: period.startDateTime,
    },
  ];
  const periodText = formatQizhengBirthRangePrompt(flow);
  assert.match(periodText, /事件1：太阳精确吊照本命太阳合相/u);
  assert.doesNotMatch(periodText, /事件1：太阳精确吊照本命太阳同宫/u);
});

test('七政流曜区间资料保留目标窗口、所有分段、行限与事件连续量', () => {
  const startTimestamp = Date.parse('2024-02-19T11:24:48+08:00');
  const range = generateQizhengFlowBirthRange(
    {
      year: 2024,
      month: 2,
      day: 19,
      hour: 11,
      minute: 24,
      second: 48,
      timezone: 8,
      gender: 'male',
      flowYear: 2024,
      flowMonth: 3,
      flowDay: 15,
    },
    {
      startTimestamp,
      endTimestamp: startTimestamp + 2_000,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    },
  );
  const text = formatQizhengBirthRangePrompt(range);
  assert.match(text, /【七政四余流曜与出生区间】/);
  assert.match(text, /2024-03-15/);
  assert.match(text, /周期事件窗口/);
  assert.ok(text.includes('流曜周期按2024年3月15日扫描；代表时刻2024-03-15T12:00:00。'));
  assert.doesNotMatch(text, /落宫取当日 12:00/u);
  assert.match(text, /大限/);
  assert.match(text, /小限/);
  assert.match(text, /结合目标时段的流曜、小限与太岁解读/u);
  assert.match(text, /【时段1】/);
  assert.match(text, /【时段2】/);
  const [shared, firstBranch, secondBranch] = text.split(/(?=【时段\d+】)/u);
  assert.match(shared!, /【全范围共同盘面】[\s\S]*流曜落宫落宿/u);
  assert.equal((text.match(/流曜太阳：/gu) ?? []).length, 1);
  assert.match(firstBranch!, /身宫巳。/u);
  assert.match(secondBranch!, /身宫辰。/u);
  assert.match(firstBranch!, /事件1：太阴精确吊照/u);
  assert.match(secondBranch!, /事件1：太阴精确吊照/u);
  assert.doesNotMatch(firstBranch!, /流曜太阳：/u);
  assert.doesNotMatch(secondBranch!, /流曜太阳：/u);
  assert.doesNotMatch(text, /流年与行限属于另外/);
  assert.doesNotMatch(text, /正常交点|全天高于阈值|全天低于阈值|光照日期/);
  for (const branch of range.branches) {
    for (const item of branch.continuous) assert.ok(text.includes(item.label));
    for (const event of branch.representative.flowingStars!.periodEvents.events) {
      assert.ok(text.includes(event.movingStar));
      if (event.targetStar) assert.ok(text.includes(event.targetStar));
      if (event.aspectDirection) assert.ok(text.includes(`黄经差${event.aspectDirection}`));
    }
  }
  assert.doesNotMatch(text, /calculationContext|startTimestamp|sourceId|mingyu|API|MCP/);
  assert.doesNotMatch(
    text,
    /盘面证据|证据链状态|坐标来源|手动输入|现代天文计算|传统均速模型|计算口径/,
  );
});
