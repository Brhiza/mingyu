import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { generateQimen, analyzeQimenEvidence } from 'mingyu-core/divination/qimen';
import { formatQimenPatternBasis } from '@core/divination/qimen-evidence';
import { resolveSignByNumber } from 'mingyu-core/divination/ssgw';
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
  const text = formatDivinationInfo('liuyao', data).split('应期观察条件：')[1];
  assert.ok(text);
  for (let position = 1; position <= 6; position += 1) assert.ok(text.includes(`第${position}爻`));
  assert.doesNotMatch(text, /谋事有成|必待|方可图谋|见分晓|见转机|应期在/);
  for (const line of data.yaosDetail) {
    if (line.isVoid) assert.match(text, new RegExp(`第${line.position}爻[^\n]*本爻旬空`));
    if (line.isMonthBreak) assert.match(text, new RegExp(`第${line.position}爻[^\n]*本爻月破`));
    if (line.changedYao?.isVoid)
      assert.match(text, new RegExp(`第${line.position}爻[^\n]*变爻${line.changedYao.dizhi}旬空`));
  }
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
    if (yao.dayLifeStage)
      assert.match(text, new RegExp(`本爻${yao.wuxing}在日辰支十二长生${yao.dayLifeStage}`));
  }

  const fanfu = data.fanfuRelations?.fanyin[0] ?? data.fanfuRelations?.fuyin[0];
  assert.ok(fanfu, '固定卦例应生成反吟或伏吟结构');
  assert.match(text, new RegExp(fanfu.description));
});

test('梅花保留本互变卦辞与本次动爻辞', () => {
  const data = generateMeihua(date, { method: 'number', number: 123 });
  const text = buildDivinationPrompt('meihua', '整体解读', data);
  for (const gua of [data.mainHexagram, data.interHexagram, data.changedHexagram]) {
    if (!gua) continue;
    assert.ok(text.includes(gua.description));
  }
  const movingText = data.mainHexagram.yaoCi?.[data.movingYao.position - 1];
  if (movingText) assert.ok(text.includes(movingText));
  const unusedText = data.mainHexagram.yaoCi?.find(
    (_, index) => index + 1 !== data.movingYao.position,
  );
  if (unusedText) assert.ok(!text.includes(unusedText));
  assert.match(text, /逐爻体用：/);
  assert.ok(data.analysis.yingQi?.length, '固定梅花卦例应提供实际应期条件');
  for (const yao of data.yaosDetail) {
    assert.match(text, new RegExp(`主卦爻象：[^\\n]*第${yao.position}爻${yao.yaoType}`));
    assert.match(text, new RegExp(`逐爻体用：[^\\n]*第${yao.position}爻属${yao.tiYong}`));
  }
  const originRelation = data.evidenceAnalysis?.stages.find(
    (stage) => stage.stage === 'origin',
  )?.relation;
  for (const condition of data.analysis.yingQi ?? []) {
    const sourceCondition = condition.replace(
      '，只作取数来源旁证，不换算绝对日期',
      '；取数来源旁证',
    );
    const promptCondition = originRelation
      ? sourceCondition.replace(`${originRelation}，`, '')
      : sourceCondition;
    assert.ok(text.includes(promptCondition), condition);
  }
  assert.doesNotMatch(text, /只作取数来源旁证，不换算绝对日期/);
  const mainDescription = `${data.mainHexagram.name}，${data.mainHexagram.description}`;
  assert.equal(text.split(mainDescription).length - 1, 1);
  if (movingText) assert.equal(text.split(movingText).length - 1, 1);
});

test('梅花单动乾卦不把用九当作当前卦辞', () => {
  const qian = generateMeihua(new Date('2025-01-01T00:00:00+08:00'), {
    method: 'number',
    number: 1,
  });
  assert.equal(qian.mainHexagram.name, '乾为天');
  assert.equal(qian.mainHexagram.yongCi, '见群龙无首，吉');
  const text = formatDivinationInfo('meihua', qian);
  assert.doesNotMatch(text, /见群龙无首，吉/);
});

test('灵签真实签谱基础解签只列一次，篡改解签不能进入任务书', () => {
  const data = resolveSignByNumber(18, date);
  const text = buildDivinationPrompt('ssgw', '整体解读', data);
  assert.match(text, /签号：第18签/);
  assert.match(text, /签诗：东施效颦反增丑，画虎不成反类犬。/);
  assert.match(text, /补充解释：诗句取象：西施皱眉很美/);
  assert.equal(text.split('与其费力学别人走路').length - 1, 1);
  assert.doesNotMatch(text, /解签总论：|此签核心：|行动建议：|风险提醒：|来源状态|签谱状态/);

  const mismatched = {
    ...data,
    details: { ...data.details, 核心寓意: '初段解释。' },
  };
  assert.throws(
    () => buildDivinationPrompt('ssgw', '整体解读', mismatched),
    /签号、签谱内容或抽签记录不一致/,
  );
});

test('奇门经典格局保留触发事实而非只列名称', () => {
  const data = generateQimen(date);
  const facts = analyzeQimenEvidence(data).patternFacts.filter(
    (item) => item.kind === '经典格局' && item.status === '已命中',
  );
  assert.ok(facts.length);
  const text = formatDivinationInfo('qimen', data);
  const palaceTable = text.match(/九宫简表：\r?\n((?:  [^\r\n]*(?:\r?\n|$))*)/u)?.[1] ?? '';
  assert.equal(palaceTable.trim().split('\n').length, 9);
  assert.match(
    palaceTable,
    /兑七宫（正西，金）：门生门，星天芮、天禽，神六合，天盘壬、丙（丙为寄干），地盘戊/u,
  );
  assert.match(palaceTable, /巽四宫（东南，木）：门惊门，星天冲，神值符，天盘癸，地盘丁/u);
  const palaceCoveredPatterns = new Map([
    ['天遁', { line: '天遁（吉格，兑七宫）', basis: '生门、丙奇、地盘戊同宫', gong: 7 }],
    ['休诈', { line: '休诈（吉格，兑七宫）', basis: '丙奇、生门、六合同宫于兑七宫', gong: 7 }],
    ['相佐', { line: '相佐（吉格，巽四宫）', basis: '值符天冲加地盘丁于巽四宫', gong: 4 }],
  ]);
  for (const fact of facts) {
    const coveredByStrongerPattern =
      /^[日月星]奇得使$/u.test(fact.name) &&
      facts.some(
        (candidate) =>
          candidate.name === `${fact.name}临吉门` &&
          fact.palaces.every((gong) => candidate.palaces.includes(gong)),
      );
    if (coveredByStrongerPattern) {
      const strongerLine = text.split('\n').find((line) => line.startsWith(`${fact.name}临吉门（`));
      assert.ok(strongerLine, fact.name);
      assert.ok(strongerLine.includes(formatQimenPatternBasis(fact).split('；')[0]!));
      assert.doesNotMatch(text, new RegExp(`^${fact.name}（`, 'mu'));
      continue;
    }
    const lines = text.split('\n').filter((item) => item.startsWith(`${fact.name}（`));
    assert.ok(lines.length, fact.name);
    const palaceCovered = palaceCoveredPatterns.get(fact.name);
    if (palaceCovered) {
      assert.equal(formatQimenPatternBasis(fact), palaceCovered.basis, fact.name);
      assert.deepEqual(fact.palaces, [palaceCovered.gong], fact.name);
      assert.deepEqual(lines, [palaceCovered.line], fact.name);
      assert.doesNotMatch(lines[0]!, /：/u);
    } else if (/^[日月星]奇得使临吉门$/u.test(fact.name)) {
      const door = fact.promptText.match(/[休生开]门/u)?.[0];
      assert.equal(door, '生门');
      assert.deepEqual(fact.palaces, [7]);
      assert.equal(data.jiuGongGe.find((palace) => palace.gong === 7)?.renPan.door, door);
      assert.deepEqual(lines, ['月奇得使临吉门（吉格）：丙奇加地盘戊（甲子/甲申所遁）于兑七宫']);
      assert.doesNotMatch(lines[0]!, /同宫临生门/u);
    } else {
      const factualBasis = formatQimenPatternBasis(fact);
      const stemPair = factualBasis.match(
        /^天盘([乙丙丁戊己庚辛壬癸])加地盘([乙丙丁戊己庚辛壬癸])于([坎坤震巽中乾兑艮离][一二三四五六七八九]宫)(?:；(.+))?$/u,
      );
      const tone =
        fact.traditionalTone === '有利'
          ? '吉格'
          : fact.traditionalTone === '风险'
            ? '凶格'
            : '中性格局';
      const compactLine = stemPair
        ? `${fact.name}（${tone}，${stemPair[3]}）${stemPair[4] ? `：${stemPair[4]}` : ''}`
        : undefined;
      if (stemPair && compactLine && lines.includes(compactLine)) {
        const palaces = data.jiuGongGe.filter((palace) => palace.name === stemPair[3]);
        assert.equal(palaces.length, 1, fact.name);
        const palace = palaces[0]!;
        assert.deepEqual(fact.palaces, [palace.gong], fact.name);
        const heavenStems = [palace.tianPan.stem, palace.tianPan.companionStem].filter(Boolean);
        assert.ok(heavenStems.includes(stemPair[1]), fact.name);
        assert.equal(palace.diPan.stem, stemPair[2], fact.name);
        const palaceLines = text
          .split('\n')
          .filter((line) =>
            line
              .trimStart()
              .startsWith(`${palace.name}（${palace.direction}，${palace.element}）：`),
          );
        assert.equal(palaceLines.length, 1, fact.name);
        const heavenText = `${heavenStems.join('、')}${palace.tianPan.companionStem ? `（${palace.tianPan.companionStem}为寄干）` : ''}`;
        assert.equal(
          palaceLines[0]!.split('，天盘')[1],
          `${heavenText}，地盘${stemPair[2]}`,
          fact.name,
        );
        assert.ok(lines.includes(compactLine), fact.name);
      } else if (factualBasis !== fact.name) {
        for (const clause of factualBasis.split('；')) {
          assert.ok(
            lines.some((line) => line.includes(clause)),
            `${fact.name}：${clause}`,
          );
        }
      }
    }
  }
  assert.doesNotMatch(text, /不作通用吉凶评分/);
});
