import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateQimenLifetime,
  generateQimenLifetimePrompt,
} from '../packages/core/src/divination/algorithms/qimen/lifetime';
import type { QimenLifetimeInput } from '../packages/core/src/types/divination';
import { scanLifetimeDynamicEvents } from '../packages/core/src/divination/algorithms/qimen/helpers/lifetime-dynamic';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

const input: QimenLifetimeInput = {
  birthDateTime: '1990-05-15T14:30:00+08:00',
  gender: 'male',
  stagePolicy: { model: 'decadalGanzhi' },
};

test('十年干支大运按年干阴阳与性别顺逆排月柱干支，童限独立且十二步连续', () => {
  const male = calculateQimenLifetime(input);
  const female = calculateQimenLifetime({ ...input, gender: 'female' });
  assert.equal(male.basis.decadalLuck?.direction, 'forward');
  assert.equal(female.basis.decadalLuck?.direction, 'backward');
  assert.equal(male.baseChart.ganzhi.month, '辛巳');
  assert.deepEqual(
    male.stages.slice(1, 4).map((stage) => stage.ganzhi),
    ['壬午', '癸未', '甲申'],
  );
  assert.deepEqual(
    female.stages.slice(1, 4).map((stage) => stage.ganzhi),
    ['庚辰', '己卯', '戊寅'],
  );
  for (const data of [male, female]) {
    assert.equal(data.stages.length, 13);
    assert.equal(data.stages[0].ganzhi, undefined);
    assert.ok(Date.parse(data.basis.decadalLuck!.startDateTime) > Date.parse(input.birthDateTime));
    assert.equal(data.stages[0].endDateTimeExclusive, data.stages[1].startDateTime);
    for (let i = 1; i < data.stages.length; i++) {
      const stage = data.stages[i];
      assert.equal(
        Number(stage.endDateTimeExclusive!.slice(0, 4)) - Number(stage.startDateTime!.slice(0, 4)),
        10,
      );
      if (i + 1 < data.stages.length)
        assert.equal(stage.endDateTimeExclusive, data.stages[i + 1].startDateTime);
      assert.ok(stage.associatedMarkers.some((marker) => marker.includes('天盘')));
      assert.ok(stage.associatedMarkers.some((marker) => marker.includes('地盘')));
      assert.ok(stage.associatedMarkers.some((marker) => marker.includes('后天卦宫')));
    }
  }
  assert.ok(male.stages[3].associatedMarkers.some((marker) => marker.includes('甲遁庚')));
});

test('同一出生瞬间在不同时区、真太阳时下保持交节起运与大运干支一致', () => {
  const china = calculateQimenLifetime(input);
  const london = calculateQimenLifetime({
    ...input,
    birthDateTime: '1990-05-15T07:30:00+01:00',
    timeZoneId: 'Europe/London',
  });
  const solar = calculateQimenLifetime({
    ...input,
    timeStandard: 'trueSolar',
    location: { longitude: 105 },
  });
  for (const other of [london, solar]) {
    assert.equal(
      Date.parse(other.basis.decadalLuck!.startDateTime),
      Date.parse(china.basis.decadalLuck!.startDateTime),
    );
    assert.deepEqual(
      other.stages.map((stage) => stage.ganzhi),
      china.stages.map((stage) => stage.ganzhi),
    );
  }
});

test('十年运的交运年和交运日同时保留前后两运，提示词提供精确区间与定位口径', () => {
  const initial = calculateQimenLifetime(input);
  const boundary = initial.stages[2].startDateTime!.slice(0, 10);
  const year = boundary.slice(0, 4);
  const { data, prompt } = generateQimenLifetimePrompt({
    ...input,
    periodRange: { startDate: `${year}-01-01`, endDate: `${year}-12-31` },
  });
  const annual = data.eventClusters?.find(
    (cluster) =>
      cluster.key.includes(':after-lichun:') &&
      cluster.stageIndices?.includes(1) &&
      cluster.stageIndices.includes(2),
  );
  assert.ok(annual);
  assert.deepEqual(annual?.stageIndices, [1, 2]);
  assert.equal(annual?.stageIndex, undefined);
  assert.match(prompt, /八字交节起运/);
  assert.match(prompt, /精确区间/);
  assert.match(prompt, /甲遁庚/);
  assert.match(prompt, /涉及阶段2、3/);
  assertPromptIsPortableTaskText(prompt);
  assert.ok(data.stages[1].eventClusterKeys?.includes(annual!.key));
  assert.ok(data.stages[2].eventClusterKeys?.includes(annual!.key));
});

test('十年干支大运拒绝缺少性别与未知阶段模型', () => {
  assert.throws(() => calculateQimenLifetime({ ...input, gender: undefined }), /性别/);
  assert.throws(
    () =>
      calculateQimenLifetime({ ...input, stagePolicy: { model: 'unknown' as 'decadalGanzhi' } }),
    /阶段模型无效/,
  );
});

test('已知交节时刻按精确交运瞬间归属新运，日期级事实保留跨运日', () => {
  const data = calculateQimenLifetime({
    ...input,
    periodRange: { startDate: '2026-01-01', endDate: '2026-12-31' },
  });
  const term = data.eventClusters!.find((cluster) => cluster.key.includes(':month-clash:'))!;
  const fact = term.triggerDates![0];
  assert.equal(typeof fact.timestamp, 'number');
  for (const shift of [0, 1]) {
    const boundary = new Date(fact.timestamp! + shift).toISOString();
    const stages = [
      {
        ...data.stages[1],
        stageIndex: 0,
        calendarStart: '2026-01-01',
        calendarEnd: fact.date,
        startDateTime: '2026-01-01T00:00:00+08:00',
        endDateTimeExclusive: boundary,
      },
      {
        ...data.stages[2],
        stageIndex: 1,
        calendarStart: fact.date,
        calendarEnd: '2026-12-31',
        startDateTime: boundary,
        endDateTimeExclusive: '2027-01-01T00:00:00+08:00',
      },
    ];
    const clusters = scanLifetimeDynamicEvents(data.baseChart, stages, {
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });
    assert.deepEqual(clusters.find((cluster) => cluster.key === term.key)?.stageIndices, [
      shift === 0 ? 1 : 0,
    ]);
  }
});
