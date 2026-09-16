import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateSolarTermsForYear,
  getDivinationTime,
  reverseBaziDates,
  TimeManager,
} from 'mingyu-core/calendar';
import { formatLiurenJudgmentFacts } from 'mingyu-core/prompt';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import { resolveBaziReverseCandidate, type BaziReverseSource } from '../src/lib/bazi-reverse-input';
import {
  formatLiurenRangeFacts,
  formatLiurenRangeInterval,
  generateLiurenRange,
} from '../src/lib/divination/liuren-range';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';

function beijingTimestamp(text: string) {
  return Date.parse(`${text.replace(' ', 'T')}+08:00`);
}

function beijingText(timestamp: number) {
  const parts = TimeManager.getWallClockParts(new Date(timestamp), 480);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

function makeSource(startText: string, endText: string): BaziReverseSource {
  const startTimestamp = beijingTimestamp(startText);
  const endTimestamp = beijingTimestamp(endText);
  return {
    pillars: getDivinationTime(new Date(startTimestamp), 480).ganzhi,
    intervalStart: startText,
    intervalEnd: endText,
    startTimestamp,
    endTimestamp,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
}

const RAIN_WATER_SOURCE = makeSource('2024-02-19 11:00:00', '2024-02-19 13:00:00');
const STABLE_TWO_HOUR_SOURCE = makeSource('2024-02-19 09:00:00', '2024-02-19 11:00:00');

function buildPillarsDraft(source: BaziReverseSource): DivinationDraft {
  return {
    ...defaultDraft,
    method: 'liuren',
    question: '合成大六壬时间范围验证',
    divinationTimeMode: 'pillars',
    customDivinationDate: source.intervalStart.slice(0, 10),
    customDivinationTime: source.intervalStart.slice(11),
    divinationReverseSource: source,
    divinationTimeStandard: 'beijing',
  };
}

test('公共节气证据与统一占卜时间入口共同确认雨水整秒边界', () => {
  const rainWater = calculateSolarTermsForYear(2024).find((item) => item.name === '雨水');
  assert.ok(rainWater);
  const boundary = beijingTimestamp('2024-02-19 12:13:12');
  assert.equal(rainWater.utcTimestamp, boundary);
  assert.deepEqual(TimeManager.getWallClockParts(new Date(boundary), 480), {
    year: 2024,
    month: 2,
    day: 19,
    hour: 12,
    minute: 13,
    second: 12,
  });
  assert.equal(getDivinationTime(new Date(boundary - 1_000), 480).timeInfo.jieQi, '立春');
  assert.equal(getDivinationTime(new Date(boundary), 480).timeInfo.jieQi, '雨水');
});

test('2024雨水11至13点按整秒月将切成两套大六壬课', () => {
  const range = generateLiurenRange({
    source: RAIN_WATER_SOURCE,
    representativeDate: new Date(RAIN_WATER_SOURCE.startTimestamp!),
  });

  assert.equal(range.status, 'conditional');
  assert.deepEqual(
    range.branches.map(({ startTimestamp, endTimestamp, data }) => [
      startTimestamp,
      endTimestamp,
      data.monthLeader,
    ]),
    [
      [RAIN_WATER_SOURCE.startTimestamp, beijingTimestamp('2024-02-19 12:13:12'), '子'],
      [beijingTimestamp('2024-02-19 12:13:12'), RAIN_WATER_SOURCE.endTimestamp, '亥'],
    ],
  );
  assert.deepEqual(
    range.branches.map(({ data }) => data.threeTransmissions.map((item) => item.branch)),
    [
      ['未', '丑', '未'],
      ['午', '亥', '辰'],
    ],
  );

  const facts = formatLiurenRangeFacts(range);
  assert.match(facts, /分支1：/u);
  assert.match(facts, /分支2：/u);
  for (const branch of range.branches) {
    const { data } = branch;
    assert.equal(data.fourLessons.length, 4);
    assert.equal(data.threeTransmissions.length, 3);
    assert.ok(data.lessonSummary);
    assert.ok(data.transmissionSummary);
    for (const lesson of data.fourLessons) {
      assert.ok(facts.includes(`${lesson.name}${lesson.upper}临${lesson.lower}`));
    }
    for (const transmission of data.threeTransmissions) {
      assert.ok(facts.includes(`${transmission.stage}${transmission.branch}乘${transmission.god}`));
    }
    for (const evidence of data.focusEvidence ?? []) {
      assert.ok(facts.includes(evidence.target));
      for (const item of evidence.evidence) assert.ok(facts.includes(item));
    }
    for (const evidence of data.timingEvidence ?? []) assert.ok(facts.includes(evidence));
    assert.ok(facts.includes(data.lessonSummary));
    assert.ok(facts.includes(data.transmissionSummary));
    const judgmentFacts = formatLiurenJudgmentFacts(data);
    assert.ok(judgmentFacts.some((item) => item.startsWith('取传说明：')));
    assert.ok(judgmentFacts.some((item) => item.startsWith('取传条件：')));
    assert.equal(
      judgmentFacts.some((item) => item.startsWith('课体条件：')),
      Boolean(data.guaTiFacts?.length),
    );
    assert.ok(judgmentFacts.some((item) => item.startsWith('课传反证：')));
    for (const judgmentFact of judgmentFacts) assert.ok(facts.includes(judgmentFact));
  }
});

test('真实四柱反推的23点至次日1点范围保持同一六壬课', () => {
  const startText = '2024-02-04 23:00:00';
  const endText = '2024-02-05 01:00:00';
  const startTimestamp = beijingTimestamp(startText);
  const targetPillars = getDivinationTime(new Date(startTimestamp), 480).ganzhi;
  const candidate = reverseBaziDates({
    pillars: targetPillars,
    startYear: 2024,
    endYear: 2024,
  }).candidates.find((item) => item.start.text === startText && item.end.text === endText);
  assert.ok(candidate, '23点至次日1点应由真实四柱反推返回候选区间');
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  assert.deepEqual(selection.source.pillars, targetPillars);

  const range = generateLiurenRange({
    source: selection.source,
    representativeDate: new Date(selection.source.startTimestamp!),
  });
  assert.equal(range.source.startTimestamp, candidate.startTimestamp);
  assert.equal(range.source.endTimestamp, candidate.endTimestamp);
  const firstBranch = range.branches[0];
  const lastBranch = range.branches.at(-1);
  assert.ok(firstBranch);
  assert.ok(lastBranch);
  const actualBoundaries = [
    firstBranch.startTimestamp,
    ...range.branches.map((branch) => branch.endTimestamp),
  ];
  assert.deepEqual(actualBoundaries, [candidate.startTimestamp, candidate.endTimestamp]);
  assert.equal(range.status, 'stable');
  for (const branch of range.branches) {
    assert.ok(branch.endTimestamp > branch.startTimestamp);
    assert.ok(branch.endTimestamp - branch.startTimestamp <= 2 * 60 * 60 * 1000);
    assert.deepEqual(branch.data.ganzhi, targetPillars);
  }
});

test('未跨节气与时辰边界的完整两小时范围合并为稳定一课', () => {
  const range = generateLiurenRange({
    source: STABLE_TWO_HOUR_SOURCE,
    representativeDate: new Date(STABLE_TWO_HOUR_SOURCE.startTimestamp!),
  });

  assert.equal(range.status, 'stable');
  assert.equal(range.branches.length, 1);
  assert.deepEqual(
    [range.branches[0]?.startTimestamp, range.branches[0]?.endTimestamp],
    [STABLE_TWO_HOUR_SOURCE.startTimestamp, STABLE_TWO_HOUR_SOURCE.endTimestamp],
  );
  assert.equal(range.branches[0]?.data.monthLeader, '子');
});

test('大六壬范围坚持半开秒级边界与完整来源校验', () => {
  assert.equal(
    formatLiurenRangeInterval(RAIN_WATER_SOURCE.startTimestamp!, RAIN_WATER_SOURCE.endTimestamp!),
    '北京时间 2024-02-19 11:00:00 至 2024-02-19 13:00:00（起点含、终点不含）',
  );
  assert.equal(beijingText(RAIN_WATER_SOURCE.startTimestamp!), '2024-02-19 11:00:00');

  assert.throws(
    () =>
      generateLiurenRange({
        source: {
          ...RAIN_WATER_SOURCE,
          intervalEnd: '2024-02-19 13:01:00',
          endTimestamp: beijingTimestamp('2024-02-19 13:01:00'),
        },
        representativeDate: new Date(RAIN_WATER_SOURCE.startTimestamp!),
      }),
    /两小时上限/u,
  );
  assert.throws(
    () =>
      generateLiurenRange({
        source: RAIN_WATER_SOURCE,
        representativeDate: new Date(RAIN_WATER_SOURCE.startTimestamp! + 1_000),
      }),
    /代表时间必须等于四柱候选区间起点/u,
  );
});

test('引擎条件提示词按每个六壬分支保留四课三传和判断事实', async () => {
  const session = await generateDivinationSession(buildPillarsDraft(RAIN_WATER_SOURCE));
  assert.equal(session.liurenRange?.status, 'conditional');
  assert.equal(session.liurenRange?.branches.length, 2);
  assert.doesNotMatch(session.prompt, /【当前时间】/u);
  assert.match(session.prompt, /候选时间范围内各分段的大六壬课盘/u);
  assert.match(session.prompt, /各时间段的月将、四课、三传与时令判断事实/u);
  assert.equal((session.prompt.match(/\n\n【任务】\n/gu) ?? []).length, 1);
  assert.equal((session.prompt.match(/\n\n【问题】\n/gu) ?? []).length, 1);

  for (const branch of session.liurenRange?.branches ?? []) {
    const { data } = branch;
    assert.ok(data.lessonSummary);
    assert.ok(data.transmissionSummary);
    assert.ok(session.prompt.includes(`课情：${data.lessonSummary}`));
    assert.ok(session.prompt.includes(`传情：${data.transmissionSummary}`));
    for (const lesson of data.fourLessons) {
      assert.ok(session.prompt.includes(`${lesson.name}${lesson.upper}临${lesson.lower}`));
    }
    for (const transmission of data.threeTransmissions) {
      assert.ok(
        session.prompt.includes(`${transmission.stage}${transmission.branch}乘${transmission.god}`),
      );
    }
    for (const judgmentFact of formatLiurenJudgmentFacts(data)) {
      assert.ok(session.prompt.includes(judgmentFact));
    }
  }
});

test('旧文本来源仍走单一代表课，不误启用六壬范围字段', async () => {
  const oldSource: BaziReverseSource = {
    pillars: RAIN_WATER_SOURCE.pillars,
    intervalStart: RAIN_WATER_SOURCE.intervalStart,
    intervalEnd: RAIN_WATER_SOURCE.intervalEnd,
  };
  const session = await generateDivinationSession(buildPillarsDraft(oldSource));
  assert.equal(session.liurenRange, undefined);
  assert.match(session.prompt, /当前盘面采用区间起点作为代表时刻/u);
});
