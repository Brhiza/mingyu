import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { formatEnhancedDivinationInfo, getDivinationSummaryBlocks } from 'mingyu-core/prompt';
import { formatEnhancedDivinationInfo as formatSourceLiuyaoPrompt } from '../packages/core/src/prompt/divination-enhanced.ts';
import { buildDivinationPrompt as buildSourceDivinationPrompt } from '../packages/core/src/prompt/divination.ts';

test('六爻时间起卦提示词保留精确占时与实际三钱计算样本', () => {
  const dates = [
    new Date('2026-05-19T10:30:01.234+08:00'),
    new Date('2026-05-19T10:30:59.876+08:00'),
  ];
  const prompts = dates.map((date) => {
    const data = generateLiuyao(date, { method: 'time' });
    const prompt = buildSourceDivinationPrompt({ method: 'liuyao', data, currentTime: date });
    return { data, date, prompt };
  });

  const displayedClockTimes = prompts.map(
    ({ prompt }) => prompt.match(/【当前时间】\n([^\n]+)/u)?.[1],
  );
  assert.equal(displayedClockTimes[0], displayedClockTimes[1]);

  for (const { data, date, prompt } of prompts) {
    assert.ok(prompt.includes(`起卦时刻（UTC）：${date.toISOString()}`));
    assert.ok(prompt.includes('起卦方式：时间起卦'));
    assert.equal(data.generation?.method, 'time');
    const coinThrows = data.generation?.coinThrows ?? [];
    assert.equal(coinThrows.length, 6);
    for (const [index, item] of coinThrows.entries()) {
      assert.ok(prompt.includes(`第${index + 1}爻计算样本：${item.coins.join('+')}=${item.total}`));
    }
  }
});

test('六爻静卦不把未变化的本卦写成变卦', () => {
  const staticData = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [7, 7, 7, 7, 7, 7],
  });
  assert.equal(staticData.originalName, '乾为天');
  assert.equal(staticData.changedName, '乾为天');
  assert.equal(staticData.changingYaos.length, 0);
  const staticText = formatEnhancedDivinationInfo('liuyao', staticData);
  assert.match(staticText, /主卦乾为天（乾宫）；变卦无；互卦/);
  assert.match(staticText, /世应：世爻第6爻父母戌土；应爻第3爻父母辰土/);
  assert.match(staticText, /世应五行：世爻与应爻同五行/);
  assert.ok(getDivinationSummaryBlocks('liuyao', staticData).tags.includes('变卦：无'));

  const movingData = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [9, 7, 7, 7, 7, 7],
  });
  assert.equal(movingData.changingYaos.length, 1);
  assert.match(
    formatEnhancedDivinationInfo('liuyao', movingData),
    new RegExp(`主卦乾为天（乾宫）；变卦${movingData.changedName}；互卦`),
  );
  assert.ok(
    getDivinationSummaryBlocks('liuyao', movingData).tags.includes(
      `变卦：${movingData.changedName}`,
    ),
  );
});

test('六爻事业用神与世爻不同五行时保留原忌仇神的作用对象', () => {
  const data = generateLiuyao(new Date('2026-05-19T10:30:00+08:00'), {
    method: 'manual',
    yaos: [6, 8, 8, 8, 8, 6],
  });
  const text = formatEnhancedDivinationInfo('liuyao', data, '', undefined, {
    liuyaoTemplate: 'shiye',
  });
  assert.match(text, /世爻第6爻子孙酉金/);
  assert.match(text, /用神：官鬼；盘面第3爻官鬼卯木/);
  assert.match(text, /以所选用神为对象的生克关系：原神水（水生木）/);
  assert.doesNotMatch(text, /生克参照：本次所选用神第3爻官鬼卯木/);
  assert.match(text, /原神水（水生木）见第5爻妻财亥水/);
  assert.match(text, /忌神金（金克木）见第6爻子孙酉金/);
  assert.match(text, /仇神土（土生金并克水）/);
  assert.doesNotMatch(text, /原神水（水生金）/);
  assert.match(text, /动变五行：本爻未土克变爻子水/);
  assert.match(text, /动变五行：本爻酉金克变爻寅木/);
  assert.equal(text.split('动变五行：本爻未土克变爻子水').length - 1, 1);
  assert.equal(text.split('动变五行：本爻酉金克变爻寅木').length - 1, 1);
  assert.doesNotMatch(text, /^动变：/m);
  assert.doesNotMatch(text, /变爻寅木克本爻酉金|变爻子水生本爻未土/);
  for (const content of [
    text,
    buildSourceDivinationPrompt({
      method: 'liuyao',
      data,
      question: '请分析工作进展。',
      currentTime: new Date('2026-05-19T10:30:00+08:00'),
      liuyaoTemplate: 'shiye',
    }),
  ]) {
    assert.match(content, /世应：世爻第6爻子孙酉金；应爻第3爻官鬼卯木/);
    assert.match(content, /世应五行：世爻克应爻/);
    assert.match(content, /用神：官鬼；盘面第3爻官鬼卯木/);
    assert.match(content, /以所选用神为对象的生克关系：原神水（水生木）见第5爻妻财亥水/);
    assert.match(content, /忌神金（金克木）见第6爻子孙酉金/);
    assert.match(content, /仇神土（土生金并克水）/);
    assert.doesNotMatch(content, /世应五行：世爻第6爻子孙酉金|生克参照：/);
    assert.match(content, /第2爻父母巳火[^\n]*值月建、日辰巳/u);
    assert.match(content, /第5爻妻财亥水[^\n]*冲月建、日辰巳，月破，日冲成破/u);
    assert.equal(content.split('值月建、日辰巳').length - 1, 1);
    assert.equal(content.split('冲月建、日辰巳').length - 1, 1);
    assert.doesNotMatch(content, /月日触发：|值月建巳，值日辰巳|冲月建巳，冲日辰巳/u);
    assert.match(content, /月日五行：[^\n]*月建、日辰巳火与第2爻父母巳火同五行/u);
  }
});

test('六爻通用与感情提示词不把世爻写成事项用神', () => {
  const data = generateLiuyao(new Date('2026-05-19T10:30:00+08:00'), {
    method: 'manual',
    yaos: [6, 8, 8, 8, 8, 6],
  });
  for (const liuyaoTemplate of ['general', 'ganqing', 'guaishen'] as const) {
    const text = formatEnhancedDivinationInfo('liuyao', data, '', undefined, {
      liuyaoTemplate,
    });
    assert.match(text, /用神主线：事项用神待按具体问题取用；盘面线索：/);
    assert.doesNotMatch(
      text,
      /本次所选用神|以所选用神为对象|生克关系：原神|用神：通用主轴|用神：关系我方/,
    );
  }
});

test('六爻有实际伏神时保留伏藏位置和飞神资料', () => {
  const data = generateLiuyao(new Date('2025-06-18T10:30:00+08:00'), {
    method: 'manual',
    yaos: [7, 8, 8, 8, 7, 8],
  });
  const text = formatEnhancedDivinationInfo('liuyao', data);
  assert.equal(data.hiddenSpirits?.length, 1);
  assert.match(text, /伏神1爻：妻财伏第3爻午火/);
  assert.match(text, /伏于官鬼辰土下/);
});

test('六爻旧结果缺爻位或伏神字段时提示资料覆盖状态', () => {
  const completeData = generateLiuyao(new Date('2025-06-18T10:30:00+08:00'), {
    method: 'manual',
    yaos: [7, 8, 8, 8, 7, 8],
  });
  const incompleteData = structuredClone(completeData);
  incompleteData.yaosDetail = incompleteData.yaosDetail.slice(0, 5);
  delete incompleteData.hiddenSpirits;

  const text = formatSourceLiuyaoPrompt('liuyao', incompleteData);

  assert.match(text, /六爻逐爻资料（覆盖不完整）/);
  assert.match(text, /资料覆盖：逐爻资料已列第1、2、3、4、5爻；缺少第6爻；伏神记录未提供/);
  assert.doesNotMatch(text, /六爻全表：/);
  assert.doesNotMatch(text, /伏神0爻/);
  assert.match(text, /^月日触发：月建、日辰午：冲第1爻兄弟子水$/mu);
  assert.doesNotMatch(text, /未直接同支入爻|冲第6爻/u);
  assert.match(text, /第1爻兄弟子水[^\n]*冲月建、日辰午[^\n]*月破，日冲成破/u);
});

test('六爻静卦按实际世应和空爻给出月日生克及冲空对象', () => {
  const data = generateLiuyao(new Date('2026-05-19T10:30:00+08:00'), {
    method: 'manual',
    yaos: [8, 8, 7, 8, 8, 7],
  });
  const text = formatEnhancedDivinationInfo('liuyao', data, '', undefined, {
    liuyaoTemplate: 'shiye',
  });
  assert.match(text, /世应：世爻第6爻官鬼寅木；应爻第3爻子孙申金/);
  assert.match(text, /世应五行：应爻克世爻/);
  assert.match(text, /第5爻妻财子水克月建、日辰巳火/);
  assert.match(text, /第6爻官鬼寅木生月建、日辰巳火/);
  assert.match(text, /第2爻父母午火（本爻空亡；本爻午逢值，子冲午）/);
  assert.doesNotMatch(text, /动变五行：/);
  assert.match(text, /明伏分布：本卦明爻6爻，六亲为兄弟、父母、子孙、妻财、官鬼；伏神0爻/);
  for (const content of [
    text,
    buildSourceDivinationPrompt({
      method: 'liuyao',
      data,
      question: '请分析静卦。',
      currentTime: new Date('2026-05-19T10:30:00+08:00'),
      liuyaoTemplate: 'shiye',
    }),
  ]) {
    assert.match(content, /世应：世爻第6爻官鬼寅木；应爻第3爻子孙申金/);
    assert.match(content, /世应五行：应爻克世爻/);
    assert.doesNotMatch(content, /世应五行：应爻第3爻子孙申金/);
    assert.match(content, /第3爻子孙申金[^\n]*合月建、日辰巳，刑月建、日辰巳（无恩之刑）/u);
    assert.match(content, /第6爻官鬼寅木[^\n]*害月建、日辰巳，刑月建、日辰巳（无恩之刑）/u);
    assert.equal(content.split('合月建、日辰巳').length - 1, 1);
    assert.equal(content.split('害月建、日辰巳').length - 1, 1);
    assert.equal(content.split('刑月建、日辰巳（无恩之刑）').length - 1, 2);
    assert.doesNotMatch(content, /月日触发：|未直接同支入爻/u);
  }
});

test('六爻逐爻表同时呈现化空、回头关系与进神', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const voidData = generateLiuyao(date, { method: 'manual', yaos: [6, 6, 6, 6, 6, 6] });
  const voidText = formatSourceLiuyaoPrompt('liuyao', voidData);
  const voidLine = voidText.split('\n').find((line) => line.startsWith('  第6爻'));
  assert.deepEqual(voidData.yaosDetail[5].changeRelations, ['回头生', '化空']);
  assert.match(voidLine ?? '', /化兄弟戌土（回头生、化空）/);
  assert.match(voidText, /第1爻兄弟未土[^\n]*害月建子，合日辰午/u);
  assert.match(voidText, /第4爻兄弟丑土[^\n]*合月建子，害日辰午/u);
  assert.match(voidText, /月日五行：[^\n]*第1爻兄弟未土克月建子水[^\n]*日辰午火生第1爻兄弟未土/u);
  assert.doesNotMatch(voidText, /月建、日辰|月日触发：/u);
  const legacyVoidData = structuredClone(voidData);
  delete legacyVoidData.yaosDetail[5].changeRelations;
  const legacyVoidLine = formatSourceLiuyaoPrompt('liuyao', legacyVoidData)
    .split('\n')
    .find((line) => line.startsWith('  第6爻'));
  assert.equal(legacyVoidLine, voidLine);

  const advanceData = generateLiuyao(date, { method: 'manual', yaos: [7, 6, 8, 8, 8, 8] });
  const advanceText = formatSourceLiuyaoPrompt('liuyao', advanceData);
  const advanceLine = advanceText.split('\n').find((line) => line.startsWith('  第2爻'));
  assert.equal(advanceData.yaosDetail[1].changeDirection, '化进神');
  assert.match(advanceLine ?? '', /化官鬼卯木（比和、化进神）/);
});

test('六爻用神只列实际支持与限制，保留伏藏和飞神资料', () => {
  const data = generateLiuyao(new Date('2025-06-18T10:30:00+08:00'), {
    method: 'manual',
    yaos: [6, 6, 7, 6, 6, 6],
  });
  const text = formatSourceLiuyaoPrompt('liuyao', data, '', undefined, {
    liuyaoTemplate: 'caifu',
  });
  assert.equal(data.originalName, '地山谦');
  assert.match(text, /用神：妻财；盘面伏神第/u);
  assert.match(text, /；限制伏藏待透、受飞神/u);
  assert.doesNotMatch(text, /支持未见|限制未见|支持盘面平稳/u);
});
