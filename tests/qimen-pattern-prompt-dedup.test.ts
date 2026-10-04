import assert from 'node:assert/strict';
import test from 'node:test';

import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen';
import {
  analyzeQimenEvidence,
  formatQimenClassicPatternSummary,
  selectQimenClassicPatternsForPrompt,
} from '../packages/core/src/divination/qimen-evidence';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail';
import { getDivinationSummaryBlocks } from '../packages/core/src/prompt/divination';

const fixedQimen = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
const cloneFixedQimen = () => structuredClone(fixedQimen);

test('奇门证据提示词保留格局条件、三奇得、马星和击刑事实各一次', () => {
  const data = cloneFixedQimen();
  const analysis = analyzeQimenEvidence(data);
  const prompt = analysis.promptText;
  const patterns = prompt.split('【传统格局】\n')[1]?.split('【应期资料】')[0] ?? '';

  assert.match(patterns, /^吉格：天遁（兑七宫）$/mu);
  assert.match(patterns, /^吉格：休诈（兑七宫）$/mu);
  assert.match(patterns, /^吉格：相佐（巽四宫）$/mu);
  assert.doesNotMatch(
    patterns,
    /生门、丙奇、地盘戊同宫|丙奇、生门、六合同宫|值符天冲加地盘丁于巽四宫/u,
  );
  assert.doesNotMatch(patterns, /乃天遁之格/);
  assert.doesNotMatch(patterns, /^吉格：月奇得使（/mu);
  assert.match(patterns, /^吉格：月奇得使临吉门；丙奇加地盘戊（甲子\/甲申所遁）于兑七宫$/mu);
  assert.doesNotMatch(patterns, /同宫临生门/u);
  assert.match(patterns, /吉格：三奇游六仪；甲寅癸值符加地盘丁奇于巽四宫；星奇游于甲辰壬/u);
  assert.match(patterns, /凶格：庚入墓；庚在坤二宫入墓（墓在未）/u);
  assert.doesNotMatch(patterns, /月奇得使又临吉门生门/);
  assert.match(patterns, /凶格：门迫；惊门（金）克巽四宫（木）/);
  assert.match(patterns, /吉格：三奇得（丙奇（月奇）合生门于兑七宫）\n/u);
  assert.match(patterns, /吉格：三奇得（丁奇（星奇）合开门于离九宫）\n/u);
  assert.doesNotMatch(patterns, /三奇与开休生吉门同宫|中性格局：马星（/u);
  assert.match(prompt, /乾六宫[^\n]*马星/u);
  assert.match(prompt, /驿马发动，出现行动、迁移、消息流转时更容易触发进展/u);
  assert.match(patterns, /凶格：癸击刑；癸在巽四宫击刑\n/u);
  assert.doesNotMatch(patterns, /在此宫落于相刑之位/u);
  assert.ok(analysis.patternFacts.some((item) => item.name.startsWith('马星（')));
  assert.ok(analysis.patternFacts.some((item) => item.originalText.includes('在此宫落于相刑之位')));
});

test('三奇入墓在固定盘与证据提示词中只保留三奇专名', () => {
  const data = generateQimen(new Date('2026-05-01T14:00:00+08:00'));
  const tombNames = (data.classicPatterns ?? []).map((pattern) => pattern.name);
  assert.ok(tombNames.includes('日奇入墓'));
  assert.ok(!tombNames.includes('乙入墓'));
  assert.ok(tombNames.includes('己入墓'));

  const prompt = analyzeQimenEvidence(data).promptText;
  const patterns = prompt.split('【传统格局】\n')[1]?.split('【应期资料】')[0] ?? '';
  assert.match(patterns, /凶格：日奇入墓；乙奇入坤二宫/);
  assert.doesNotMatch(patterns, /凶格：乙入墓/);
  assert.match(patterns, /凶格：己入墓/);
});

test('复合格局引用同盘经典格局时省略占位复述并保留独有兵事依据', () => {
  const data = cloneFixedQimen();
  const prompt = formatEnhancedDivinationInfo('qimen', data, '军事战术如何行动');
  const combos = prompt.split('复合格局：\n')[1]?.split('\n值符宫应期参考')[0] ?? '';

  assert.doesNotMatch(combos, /：该格局(?:同宫生门)?[，；]/);
  assert.match(combos, /飞鸟跌穴利客（兑七宫）：合“丙加甲利为客”/);
  assert.match(combos, /螣蛇夭矫宜守（巽四宫）：合“主军宜固守”/);
  assert.match(combos, /螣蛇迁戊己（巽四宫）：古法急迁甲子戊、甲戌己两土宫/);

  const hostGuestInjury = combos.split('星门主客互伤：')[1]?.split('\n八门余气')[0] ?? '';
  assert.match(hostGuestInjury, /同宫星门与宫各见一生一克：坤二宫、艮八宫、离九宫/);
  assert.doesNotMatch(hostGuestInjury, /天英火星生宫利主|休门水宫克门利主/);
  assert.match(hostGuestInjury, /合“一克一生，主客互伤”/);
});

test('奇门提示词合并相同宫位相同条件的命中记录，保留不同宫位与独立条件', () => {
  for (const [name, god] of [
    ['真诈', '太阴'],
    ['重诈', '九地'],
    ['休诈', '六合'],
  ]) {
    const members = `丁奇、开门、${god}同宫于兑七宫`;
    assert.equal(
      formatQimenClassicPatternSummary(name, `${members}，三奇、吉门、${god}同宫，乃${name}之格`),
      members,
    );
    assert.equal(
      formatQimenClassicPatternSummary(name, `三奇、吉门、${god}同宫，乃${name}之格`),
      `三奇、吉门、${god}同宫`,
    );
    assert.equal(
      formatQimenClassicPatternSummary(name, `丁奇、开门同宫于兑七宫，三奇、吉门、${god}同宫`),
      `丁奇、开门同宫于兑七宫，三奇、吉门、${god}同宫`,
    );
    assert.equal(
      formatQimenClassicPatternSummary(name, `${members}，三奇、吉门、九天同宫`),
      `${members}，三奇、吉门、九天同宫`,
    );
  }
  const same = { name: '条件格', palaces: [7], summary: '生门、丙奇、地盘戊同宫' };
  const duplicate = { ...same, palaces: [7] };
  const elsewhere = { ...same, palaces: [8] };
  const additional = { ...same, summary: '生门、丙奇、九天同宫' };
  assert.deepEqual(selectQimenClassicPatternsForPrompt([same, duplicate, elsewhere, additional]), [
    same,
    elsewhere,
    additional,
  ]);

  const data = cloneFixedQimen();
  const hit = data.classicPatterns!.find((item) => item.name === '天遁')!;
  data.classicPatterns!.push(structuredClone(hit));
  const evidence = analyzeQimenEvidence(data);
  assert.equal(evidence.promptText.match(/^吉格：天遁（/gmu)?.length, 1);
  assert.equal(evidence.patternFacts.filter((item) => item.name === '天遁').length, 2);
  assert.equal(data.classicPatterns!.filter((item) => item.name === '天遁').length, 2);
  data.patternTags.push(data.patternTags[0]);
  data.patternDetails.push(structuredClone(data.patternDetails[0]));
  data.palaceInsights.push(structuredClone(data.palaceInsights[0]));
  data.stemRelations!.push(structuredClone(data.stemRelations![0]));
  data.patternCombos!.push(structuredClone(data.patternCombos![0]));
  const repeatedBefore = structuredClone(data);
  assert.ok(analyzeQimenEvidence(data).patternFacts.length > evidence.patternFacts.length);
  assert.equal(
    formatEnhancedDivinationInfo('qimen', data).match(/^天遁（吉格，兑七宫）$/gmu)?.length,
    1,
  );
  assert.deepEqual(data, repeatedBefore);
});

test('奇门详细在线资料复用命中条件，摘要不重复格局且不采样专项复合格局', () => {
  const data = cloneFixedQimen();
  const prompt = formatDetailedDivinationInfo('qimen', data);
  assert.equal(prompt.match(/^吉格：天遁（兑七宫）$/gmu)?.length, 1);
  assert.doesNotMatch(prompt, /生门、丙奇、地盘戊同宫/u);
  assert.match(prompt, /凶格：门迫；惊门（金）克巽四宫（木）/u);
  assert.doesNotMatch(prompt, /^格局：|盘面命中格局：|乃天遁之格|主此宫事务受阻/gmu);
  assert.match(prompt, /值符宫应期参考：/u);
  assert.doesNotMatch(getDivinationSummaryBlocks('qimen', data).lines.join('\n'), /复合格局：/u);
  assert.ok(data.patternCombos!.length > 0);

  delete data.yingQi;
  const withoutTiming = formatDetailedDivinationInfo('qimen', data);
  assert.equal(withoutTiming.match(/^吉格：天遁（兑七宫）$/gmu)?.length, 1);
  assert.doesNotMatch(withoutTiming, /生门、丙奇、地盘戊同宫/u);
  assert.match(withoutTiming, /凶格：门迫；惊门（金）克巽四宫（木）/u);
  assert.doesNotMatch(withoutTiming, /盘面命中格局：/u);
});

test('奇门空命中资料在证据与详细入口省略格局标题', () => {
  const data = cloneFixedQimen();
  data.classicPatterns = [];
  data.patternDetails = [];
  data.patternTags = [];
  data.patternCombos = [];
  assert.doesNotMatch(analyzeQimenEvidence(data).promptText, /【传统格局】/u);
  assert.doesNotMatch(formatDetailedDivinationInfo('qimen', data), /格局明细：|^格局：/mu);
});

test('奇门专项复合格局合并重复说明并省略空名称与空条件', () => {
  const data = cloneFixedQimen();
  const bird = data.patternCombos!.find((item) => item.name === '飞鸟跌穴利客')!;
  assert.ok(bird);
  data.patternCombos!.push(structuredClone(bird));
  const prompt = formatEnhancedDivinationInfo('qimen', data, '军事战术如何行动');
  assert.equal(prompt.match(/飞鸟跌穴利客（兑七宫）：/gu)?.length, 1);
  assert.doesNotMatch(prompt, /空名称条件|空摘要条件/u);
  for (const item of [
    { ...bird, name: '', summary: '空名称条件' },
    { ...bird, name: '空摘要条件', summary: '' },
  ]) {
    const invalid = structuredClone(data);
    invalid.patternCombos!.push(item);
    const before = structuredClone(invalid);
    assert.throws(
      () => formatEnhancedDivinationInfo('qimen', invalid, '军事战术如何行动'),
      /复合格局条件与当前盘面条件不一致/u,
    );
    assert.deepEqual(invalid, before);
  }
});
