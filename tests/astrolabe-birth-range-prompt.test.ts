import assert from 'node:assert/strict';
import test from 'node:test';

import { getDivinationTime } from 'mingyu-core/calendar';
import { generateAstrolabeBirthRange } from '../src/lib/astrolabe-birth-range';
import {
  formatAstrolabeBirthRangeInterval,
  formatAstrolabeBirthRangePrompt,
} from '../src/lib/astrolabe-birth-range-prompt';
import type { AstrolabeBirthInput } from 'mingyu-core/types';
import type { BaziReverseSource } from '../src/lib/bazi-reverse-input';

const OFFSET_MINUTES = 480;

function sourceFor(startText: string, endText: string): BaziReverseSource {
  const startTimestamp = Date.parse(`${startText.replace(' ', 'T')}+08:00`);
  const endTimestamp = Date.parse(`${endText.replace(' ', 'T')}+08:00`);
  return {
    pillars: getDivinationTime(new Date(startTimestamp), OFFSET_MINUTES).ganzhi,
    intervalStart: startText,
    intervalEnd: endText,
    startTimestamp,
    endTimestamp,
    endExclusive: true,
    timezone: 'Asia/Shanghai',
    offsetHours: 8,
  };
}

const START = '2024-03-20 11:06:20';
const INPUT: AstrolabeBirthInput = {
  name: '公开合成本命样本',
  gender: '女',
  year: '2024',
  month: '3',
  day: '20',
  hour: '11',
  minute: '6',
  second: '20',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
};

const RANGE = generateAstrolabeBirthRange(INPUT, sourceFor(START, '2024-03-20 11:06:30'));

test('西占本命区间提示词保留全部分支完整事实和连续量中文标签', () => {
  const startTimestamp = Date.parse(`${START.replace(' ', 'T')}+08:00`);
  const text = formatAstrolabeBirthRangePrompt(RANGE);

  assert.match(text, /【西洋占星本命出生时间区间】/u);
  assert.match(text, /起点含、终点不含/u);
  assert.match(text, /太阳/u);
  assert.match(text, /星体位置/u);
  assert.match(text, /连续事实范围/u);
  assert.match(text, /出生范围/u);
  assert.notEqual(RANGE.source.startTimestamp, 0);
  assert.equal(RANGE.source.startTimestamp, startTimestamp);
  assert.ok(RANGE.branches.length >= 2);

  for (const [index, branch] of RANGE.branches.entries()) {
    assert.match(text, new RegExp(`【时段${index + 1}】`, 'u'));
    assert.match(text, new RegExp(String(branch.sampleCount), 'u'));
    assert.ok(
      text.includes(formatAstrolabeBirthRangeInterval(branch.startTimestamp, branch.endTimestamp)),
    );
    for (const item of branch.continuous.filter((fact) => fact.path.startsWith('aspects['))) {
      const match = /^aspects\[(.+?)↔(.+?)↔(.+?)\]\./u.exec(item.path);
      assert.ok(match);
      const [first, , second] = match.slice(1);
      const points = [...branch.representative.planets, ...branch.representative.angles];
      const firstLabel = points.find((point) => point.name === first)?.label ?? first;
      const secondLabel = points.find((point) => point.name === second)?.label ?? second;
      assert.ok(text.includes(`${firstLabel}↔`));
      assert.ok(text.includes(`↔${secondLabel}`));
    }
  }

  assert.doesNotMatch(
    text,
    /startTimestamp|endTimestamp|endExclusive|evidenceAnalysis|calculationContext|sourceId|mingyu|API|MCP|planets\[/u,
  );
  assert.doesNotMatch(
    text,
    /(?<!（)(?:Placidus|True North Node|Mean North Node)|first\/last|min\/max|\b(?:Sun|Moon|Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|Ascendant|Midheaven)\b/u,
  );
  assert.match(text, /普拉西德斯宫制（Placidus）/u);
  assert.doesNotMatch(text, /代表盘信息（[^）]*）[^\n]*出生信息：/u);
});

test('西占本命区间格式化保留分段边界文本', () => {
  const facts = formatAstrolabeBirthRangePrompt(RANGE);
  assert.match(facts, /2024-03-20 11:06:20 至 2024-03-20 11:06:30/u);
  assert.ok(RANGE.branches.length >= 1);
});

test('西占本命区间任务书保留问题和解读选择且覆盖全部分段', () => {
  const text = formatAstrolabeBirthRangePrompt(RANGE, {
    question: '哪些事业判断在整个出生区间都成立？',
    topicId: 'career',
  });
  assert.match(text, /【问题】\n哪些事业判断在整个出生区间都成立？/u);
  assert.match(text, /【解读选择】/u);
  assert.match(text, /事业/u);
  for (let index = 0; index < RANGE.branches.length; index += 1) {
    assert.ok(text.includes(`【时段${index + 1}】`));
  }
});
