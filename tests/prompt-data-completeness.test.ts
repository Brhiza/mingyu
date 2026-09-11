import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { generateQimen, analyzeQimenEvidence } from 'mingyu-core/divination/qimen';
import { drawRandomSign } from 'mingyu-core/divination/ssgw';
import { buildAstrolabePrompt, formatDivinationInfo } from 'mingyu-core/prompt';
import { buildDivinationPrompt } from '../src/lib/divination/engine';

const date = new Date('2026-05-19T10:30:00+08:00');

test('星盘各提示词入口保留全部计算点和十二宫宫头', () => {
  const data = generateAstrolabe({
    name: '样本',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
    locationName: '北京',
  });
  for (const text of [
    buildAstrolabePrompt({ chart: data }),
    buildDivinationPrompt('astrolabe', '整体解读', data),
  ]) {
    assert.match(text, /十二宫宫头/);
    for (const point of [...data.planets, ...data.houses]) {
      assert.ok(text.includes(point.label), point.label);
      assert.ok(text.includes(point.formatted), point.formatted);
    }
  }
});

test('六爻全动卦保留全部动爻应期线索', () => {
  const data = generateLiuyao(date, { yaos: [9, 9, 9, 9, 9, 9] });
  const text = formatDivinationInfo('liuyao', data).split('应期断诀：')[1];
  assert.ok(text);
  for (let position = 1; position <= 6; position += 1) assert.ok(text.includes(`第${position}爻`));
});

test('六爻提示词逐爻保留原爻、月日旺衰、十二长生与反伏吟详情', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    yaos: [9, 7, 7, 9, 7, 7],
  });
  assert.equal(data.originalName, '乾为天');
  assert.equal(data.changedName, '巽为风');
  assert.equal(data.yaosDetail.length, 6);
  const text = formatDivinationInfo('liuyao', data);
  const rawLabels: Record<number, string> = { 6: '老阴', 7: '少阳', 8: '少阴', 9: '老阳' };

  for (const yao of data.yaosDetail) {
    assert.match(
      text,
      new RegExp(`第${yao.position}爻[^\\n]*原爻${yao.yaoType}（${rawLabels[yao.rawValue]}）`),
    );
    assert.match(text, new RegExp(`月令${yao.seasonState}`));
    if (yao.dayLifeStage) assert.match(text, new RegExp(`日辰十二长生${yao.dayLifeStage}`));
  }

  const fanfu = data.fanfuRelations?.fanyin[0] ?? data.fanfuRelations?.fuyin[0];
  assert.ok(fanfu, '固定卦例应生成反吟或伏吟结构');
  assert.match(text, new RegExp(fanfu.description));
});

test('梅花完整保留本互变的卦辞与六爻辞', () => {
  const data = generateMeihua(date, { method: 'number', number: 123 });
  const text = buildDivinationPrompt('meihua', '整体解读', data);
  for (const gua of [data.mainHexagram, data.interHexagram, data.changedHexagram]) {
    if (!gua) continue;
    assert.ok(text.includes(gua.description));
    for (const line of gua.yaoCi ?? []) assert.ok(text.includes(line), line);
  }
  assert.match(text, /逐爻体用：/);
  assert.ok(data.analysis.yingQi?.length, '固定梅花卦例应提供实际应期条件');
  for (const yao of data.yaosDetail) {
    assert.match(text, new RegExp(`第${yao.position}爻${yao.yaoType}属${yao.tiYong}`));
  }
  for (const condition of data.analysis.yingQi ?? []) {
    const promptCondition = condition.replace(
      '，只作取数来源旁证，不换算绝对日期',
      '；取数来源旁证',
    );
    assert.ok(text.includes(promptCondition), condition);
  }
  assert.doesNotMatch(text, /只作取数来源旁证，不换算绝对日期/);
  const mainDescription = `${data.mainHexagram.name}，${data.mainHexagram.description}`;
  assert.equal(text.split(mainDescription).length - 1, 1);
  const movingText = data.mainHexagram.yaoCi?.[data.movingYao.position - 1];
  if (movingText) assert.equal(text.split(movingText).length - 1, 1);
});

test('梅花单动乾卦不把用九当作当前卦辞', () => {
  const qian = generateMeihua(new Date('2025-01-01T14:00:00+08:00'), {
    method: 'number',
    number: 1,
  });
  assert.equal(qian.mainHexagram.name, '乾为天');
  assert.equal(qian.mainHexagram.yongCi, '见群龙无首，吉');
  const text = formatDivinationInfo('meihua', qian);
  assert.doesNotMatch(text, /见群龙无首，吉/);
});

test('灵签解释保留完整段落及有效补充并合并同文', () => {
  const data = drawRandomSign(date, { seed: 20260521 });
  data.details = {
    ...data.details,
    核心寓意: data.poem,
    解签: '初段解释。',
    签意: '初段解释。',
    解签总论: '第一句。第二句。第三句仍含完整条件。',
    整体运势: '阶段信息应当保留。',
    此签核心: '另一个有效取义。',
  };
  const text = buildDivinationPrompt('ssgw', '整体解读', data);
  for (const phrase of ['第三句仍含完整条件。', '阶段信息应当保留。', '另一个有效取义。'])
    assert.ok(text.includes(phrase));
  assert.equal(text.split('初段解释。').length - 1, 1);
});

test('奇门经典格局保留触发事实而非只列名称', () => {
  const data = generateQimen(date);
  const facts = analyzeQimenEvidence(data).patternFacts.filter((item) => item.kind === '经典格局');
  assert.ok(facts.length);
  const text = formatDivinationInfo('qimen', data);
  for (const fact of facts) assert.ok(text.includes(fact.promptText), fact.name);
  assert.doesNotMatch(text, /不作通用吉凶评分/);
});
