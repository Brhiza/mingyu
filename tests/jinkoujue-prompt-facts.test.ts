import assert from 'node:assert/strict';
import test from 'node:test';

import { generateJinkoujue } from '../packages/core/src/divination/algorithms/jinkoujue.ts';
import {
  buildDivinationPrompt,
  formatDivinationInfo,
  getDivinationSummaryBlocks,
} from '../packages/core/src/prompt/divination.ts';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';
import { TimeManager } from '../packages/core/src/calendar/timeManager';
import { buildTimeInfoText, buildSolarTimeInfoText } from '../packages/core/src/prompt/formatters';
import { formatJinkoujueJudgmentFacts } from '../packages/core/src/prompt/jinkoujue-facts';

const formatters = [
  formatDivinationInfo,
  formatDetailedDivinationInfo,
  formatEnhancedDivinationInfo,
];

test('金口诀完整任务书重开沿用保存时区与原四位占时', () => {
  const cases = [
    {
      offset: 480,
      zone: 'UTC+08:00',
      solar: '公历：2025年6月18日 10时30分',
      day: '戊午',
      hour: '丁巳',
    },
    {
      offset: -720,
      zone: 'UTC-12:00',
      solar: '公历：2025年6月17日 14时30分',
      day: '丁巳',
      hour: '丁未',
    },
    {
      offset: 840,
      zone: 'UTC+14:00',
      solar: '公历：2025年6月18日 16时30分',
      day: '戊午',
      hour: '庚申',
    },
  ];
  try {
    for (const { offset, zone, solar, day, hour } of cases) {
      TimeManager.setTimezoneOffsetMinutesOverride(offset);
      const data = generateJinkoujue({
        method: 'branch',
        branch: '申',
        customDate: new Date('2025-06-18T02:30:00Z'),
      });
      assert.equal(data.timezoneOffsetMinutes, offset);
      assert.deepEqual(data.ganzhi, { year: '乙巳', month: '壬午', day, hour });
      TimeManager.setTimezoneOffsetMinutesOverride(offset === 480 ? 0 : 480);
      assert.equal(buildSolarTimeInfoText(data), solar);
      assert.match(buildTimeInfoText(data), new RegExp(`${day}日 ${hour}时`));
      const prompt = buildDivinationPrompt({
        method: 'jinkoujue',
        data,
        question: '核对同一占时四位',
        currentTime: new Date('2025-06-19T00:00:00Z'),
      });
      const origin = prompt.match(/【起课时间】\n([\s\S]*?)(?:\n\n【|$)/)?.[1].trim();
      assert.equal(origin, `${solar}（${zone}）`);
      assert.match(prompt, /【当前时间】\n公历：2025年6月19日 8时0分（UTC\+08:00）/);
      assert.equal(data.evidenceAnalysis?.calculationFact.status, '完整');
      assert.match(prompt, /^四位：地分申（[^\n]+）；将神[^\n]+；贵神[^\n]+；人元[^\n]+/mu);
    }
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});

test('金口诀摘要和详细提示不重复展开四位、发用、动爻与比合资料', () => {
  const data = generateJinkoujue({
    customDate: new Date('2025-03-28T12:00:00+08:00'),
    method: 'branch',
    branch: '申',
  });
  const summary = getDivinationSummaryBlocks('jinkoujue', data);
  assert.ok(!summary.lines.includes(data.mainLine));
  assert.ok(!summary.lines.includes(data.summary));
  assert.ok(!summary.lines.some((line) => line.startsWith('四位：')));
  assert.match(summary.lines.join('\n'), /阴阳发用：/);
  assert.match(summary.lines.join('\n'), /动爻：/);
  assert.match(summary.tags.join('\n'), /地分：/);

  const detailed = formatDetailedDivinationInfo('jinkoujue', data);
  assert.doesNotMatch(detailed, /^详细资料：$/m);
  assert.equal(detailed.match(/^阴阳发用：/gm)?.length, 1);
  assert.equal(detailed.match(/^四位：/gm)?.length, 1);
  assert.equal(detailed.match(/^五动三动：/gm)?.length, 1);
  assert.equal(detailed.match(/^四位比合：/gm)?.length, 1);
  assert.doesNotMatch(detailed, /^四位依据：|^取用依据：|^阴阳次第：/m);
  assert.match(detailed, /^四位取象：/m);
  assert.match(detailed, /^四位五行依据：/m);
});

test('金口诀提示词区分固定时支昼夜约定与古本星出没口径', () => {
  const data = generateJinkoujue({
    customDate: new Date('2025-03-28T12:00:00+08:00'),
    method: 'time',
  });

  for (const format of formatters) {
    const text = format('jinkoujue', data);
    assert.match(text, /本次按卯至申昼占、酉至寅夜占的固定时支约定起贵人/);
    assert.match(text, /《六壬神课金口诀·贵神治旦暮》以星没为旦、星出为暮/);
    assert.doesNotMatch(text, /未提供地点|无法按星出没时刻判定昼夜/);
  }
});

test('金口诀提示资料只列实际动爻，不再重复展开未触发的通用取法', () => {
  const data = generateJinkoujue({
    customDate: new Date('2026-05-19T10:30:00+08:00'),
    method: 'time',
  });
  assert.equal(data.positions.renYuan.element, '火');
  assert.equal(data.positions.diFen.element, '火');
  assert.equal(data.positions.jiangShen.element, '金');
  const structuredBefore = structuredClone(data);
  for (const text of [
    ...formatters.map((format) => format('jinkoujue', data)),
    buildDivinationPrompt({ method: 'jinkoujue', data, question: '问合作进度' }),
  ]) {
    assert.match(text, /兄弟动（人元火比和地分火）/);
    assert.doesNotMatch(text, /人元火与地分火比和/);
    assert.match(text, /地分火克将神金/);
    assert.match(text, /五动三动：.*兄弟动（人元火比和地分火）/);
    assert.doesNotMatch(text, /五动取法：|三动取法：/);
    assert.doesNotMatch(text, /贵人被生|将神金与地分火比和/);
    assert.equal(text.split('人元火克将神金').length - 1, 1);
    assert.equal(text.split('地分火克将神金').length - 1, 1);
    assert.doesNotMatch(text, /将神受人元克|将神受地分克/);
    assert.match(text, /四位反证：将神处月令死，力量条件偏弱/);
    assert.match(text, /发用位将神不空/);
    assert.match(text, /遁干五行：将神遁干辛属金；贵神遁干癸属水/);
  }
  for (const options of [{}, { compact: true }]) {
    const standalone = formatJinkoujueJudgmentFacts(data, options).join('\n');
    assert.match(standalone, /将神受人元克；将神受地分克/);
    const missingFocus = structuredClone(data);
    delete missingFocus.focusEvidence![1];
    const missingBefore = structuredClone(missingFocus);
    assert.throws(
      () => formatJinkoujueJudgmentFacts(missingFocus, options),
      /主线或焦点依据与四位课值不一致/,
    );
    assert.deepEqual(missingFocus, missingBefore);
  }
  assert.deepEqual(data, structuredBefore);
});

test('金口诀古本算例关系沿用人元干与贵神本属并明确被生的施受方向', () => {
  const data = generateJinkoujue({
    method: 'number',
    number: 9,
    customDate: new Date('2020-03-24T12:00:00+08:00'),
  });
  assert.equal(data.positions.renYuan.branch, '申');
  assert.equal(data.positions.renYuan.element, '火');
  assert.equal(data.positions.guiShen.stem, '戊');
  assert.equal(data.positions.guiShen.element, '水');
  assert.equal(data.relations.renToJiang, '被克');
  assert.notEqual(data.positions.guiShen.branch, data.positions.diFen.branch);
  const structuredBefore = structuredClone(data);
  const summary = getDivinationSummaryBlocks('jinkoujue', data);
  assert.ok(
    summary.tags.includes(
      `贵神：${data.positions.guiShen.god}（本属${data.positions.guiShen.branch}）`,
    ),
  );
  for (const text of [
    ...formatters.map((format) => format('jinkoujue', data)),
    buildDivinationPrompt({ method: 'jinkoujue', data, question: '问合作进度' }),
  ]) {
    assert.match(text, /贵神水与将神水比和/);
    assert.match(text, /将神水克人元火/);
    assert.match(text, /贵神水克人元火/);
    assert.match(text, /地分金生将神水/);
    assert.match(text, /人元火克地分金/);
    assert.match(text, /地分金生贵神水/);
    assert.match(text, /妻动（人元火克地分金）/);
    assert.match(text, /官动（贵神水克人元火）/);
    assert.equal(text.split('贵神水克人元火').length - 1, 1);
    assert.equal(text.split('将神水克人元火').length - 1, 1);
    assert.equal(text.split('人元火克地分金').length - 1, 1);
    assert.doesNotMatch(text, /人元受贵神克|人元受将神克|地分受人元克/);
    assert.match(
      text,
      /四位反证：地分处月令囚，力量条件偏弱；将神处月令休，力量条件偏弱；贵神处月令休，力量条件偏弱/,
    );
    assert.match(text, /发用位贵神不空/);
    assert.match(text, /贵神戊子乘玄武（阳水/);
    assert.match(text, /贵神按贵神本属/);
    assert.match(text, /遁干五行：将神遁干戊属土；贵神遁干戊属土/);
  }
  assert.deepEqual(data, structuredBefore);
});
