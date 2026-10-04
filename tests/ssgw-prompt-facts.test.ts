import test from 'node:test';
import assert from 'node:assert/strict';
import {
  drawRandomSign,
  resolveSignByNumber,
} from '../packages/core/src/divination/algorithms/ssgw.ts';
import { resolveSsgwStoryContent } from '../packages/core/src/divination/ssgw-content.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';
import {
  buildDivinationPrompt,
  getDivinationSummaryBlocks,
} from '../packages/core/src/prompt/divination.ts';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail.ts';

test('三山国王第79签保留传统签解，不把分项运势说成已经发生的事实', () => {
  const sign = resolveSignByNumber(79, new Date('2026-09-01T12:00:00+08:00'));
  const prompt = formatEnhancedDivinationInfo('ssgw', sign);

  assert.match(prompt, /签号：第79签/);
  assert.match(prompt, /签诗：千祥云集照门庭/);
  assert.match(prompt, /吉凶级别：上签（大吉）/);
  assert.match(prompt, /基础解签：签诗以千祥、百福写喜庆汇集的传统吉象/);
  assert.match(prompt, /补充解释：诗句取象：千万种吉祥如云朵般聚集照耀家门/);
  assert.doesNotMatch(prompt, /健康、财运全都好|财运全面向好|学习考试顺利|整体康泰/);
  assert.doesNotMatch(prompt, /解签总论：|事业：|财运：|健康：|行动建议：|风险提醒：/);
  assert.equal((prompt.match(/基础解签：/gu) ?? []).length, 1);
});

test('灵签补充解释保留本签诗句的独有释义，不复述分项运势断语', () => {
  const second = formatEnhancedDivinationInfo('ssgw', resolveSignByNumber(2));
  assert.match(second, /签诗：六出奇花开晚香/);
  assert.match(second, /补充解释：诗句取象："六出"指雪花/);
  assert.doesNotMatch(second, /最终方能蟾宫折桂、一举成名|收入上的好转会来得晚一些/);

  const thirtySixth = formatEnhancedDivinationInfo('ssgw', resolveSignByNumber(36));
  assert.match(thirtySixth, /典故：.*破镜重圆/);
  assert.match(thirtySixth, /补充解释：诗句取象：破碎的铜镜重新明亮/);
  assert.doesNotMatch(thirtySixth, /失去的东西终将回来|关系可以修复/);
});

test('三山国王签谱典故不把别签对照或误引典籍写进本签提示词', () => {
  const eightyNinth = formatEnhancedDivinationInfo('ssgw', resolveSignByNumber(89));
  assert.match(eightyNinth, /《周易·坤·文言》有“积善之家，必有余庆”/);
  assert.doesNotMatch(eightyNinth, /“吉人自有天相”出自《周易》/);

  const ninetySecond = resolveSignByNumber(92);
  const story = resolveSsgwStoryContent(ninetySecond);
  const prompt = formatEnhancedDivinationInfo('ssgw', ninetySecond);
  assert.doesNotMatch(story.canonicalStory, /第一签/);
  assert.doesNotMatch(prompt, /第一签|第1签/);
  assert.match(prompt, /签号：第92签/);
  assert.match(prompt, /基础解签：签诗以万殊归一/);
});

test('签号与签题、诗文、解签或抽取轨迹矛盾时，完整任务书不接纳错签', () => {
  const first = resolveSignByNumber(1, new Date('2025-01-01T00:00:00Z'));
  const second = resolveSignByNumber(2, new Date('2025-01-01T00:00:00Z'));
  const prompt = (data: typeof first) =>
    buildDivinationPrompt({ method: 'ssgw', data, question: '本次占问' });
  const mismatches = [
    { ...first, title: second.title },
    { ...first, poem: second.poem },
    { ...first, story: second.story },
    { ...first, details: second.details },
    { ...first, draw: { ...first.draw!, selectedNumber: second.number } },
    { ...first, meta: { ...first.meta!, algorithm: 'ssgw.draw' } },
  ];
  for (const data of mismatches) {
    assert.throws(
      () => formatEnhancedDivinationInfo('ssgw', data),
      /签号、签谱内容或抽签记录不一致/,
    );
    assert.throws(() => prompt(data), /签号、签谱内容或抽签记录不一致/);
  }

  const random = drawRandomSign(new Date('2025-01-01T00:00:00Z'), { replay: [0] });
  const changedTrace = structuredClone(random);
  changedTrace.meta!.random!.samples[0] = 0.9;
  assert.throws(() => prompt(changedTrace), /签号、签谱内容或抽签记录不一致/);

  const oldResult = {
    ...first,
    story: undefined,
    details: undefined,
    draw: undefined,
    meta: undefined,
  };
  const rebuilt = prompt(oldResult);
  assert.match(rebuilt, /签号：第1签/);
  assert.match(rebuilt, /明月千山，太平丰年/);
  assert.match(rebuilt, /一轮明月千山秀/);
  assert.match(rebuilt, /吉凶级别：上签（大吉）/);
  assert.match(rebuilt, /典故：/);
  assert.match(rebuilt, /基础解签：/);
  assert.match(rebuilt, /补充解释：/);
  assert.doesNotMatch(rebuilt, /第二签|魁梅独占/);
  assert.match(formatDetailedDivinationInfo('ssgw', oldResult), /基础解签：/);
  assert.match(getDivinationSummaryBlocks('ssgw', oldResult).tags.join('；'), /第1签/);
});

test('旧版随机签保留合法抽签与掷筊轨迹，仍拒绝错签记录', () => {
  const first = resolveSignByNumber(1, new Date('2025-01-01T00:00:00Z'));
  const legacy = {
    ...first,
    draw: { poolSize: 92, selectedIndex: 0, selectedNumber: 1 },
    meta: {
      ...first.meta!,
      algorithm: 'ssgw.draw',
      input: { timestamp: first.timestamp },
      random: { mode: 'replay' as const, samples: [0.001, 0, 0.75] },
    },
    ritual: {
      throws: [{ result: '圣杯', firstFace: '阳面', secondFace: '阴面' }],
      confirmed: true,
      rejected: false,
    },
  };
  assert.match(buildDivinationPrompt({ method: 'ssgw', data: legacy }), /签号：第1签/);
  assert.match(formatEnhancedDivinationInfo('ssgw', legacy), /签诗：/);

  const oldOneSample = {
    ...legacy,
    draw: { ...legacy.draw, method: 'random' as const },
    meta: {
      ...legacy.meta,
      // 旧版直接缩放落在第1签，现行等宽桶映射则落在第2签。
      random: { mode: 'replay' as const, samples: [0.010869565202206697] },
    },
    ritual: undefined,
  };
  assert.match(buildDivinationPrompt({ method: 'ssgw', data: oldOneSample }), /签号：第1签/);

  const wrongDraw = { ...legacy, draw: { ...legacy.draw, selectedIndex: 1 } };
  assert.throws(
    () => buildDivinationPrompt({ method: 'ssgw', data: wrongDraw }),
    /签号、签谱内容或抽签记录不一致/,
  );
  const wrongTrace = {
    ...legacy,
    meta: { ...legacy.meta, random: { mode: 'replay' as const, samples: [0.9, 0, 0.75] } },
  };
  assert.throws(
    () => buildDivinationPrompt({ method: 'ssgw', data: wrongTrace }),
    /签号、签谱内容或抽签记录不一致/,
  );
  const wrongRitual = {
    ...legacy,
    ritual: { ...legacy.ritual, throws: [{ ...legacy.ritual.throws[0], result: '阴杯' }] },
  };
  assert.throws(
    () => buildDivinationPrompt({ method: 'ssgw', data: wrongRitual }),
    /签号、签谱内容或抽签记录不一致/,
  );
});
