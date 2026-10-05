import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { drawLenormandSpread } from 'mingyu-core/divination/lenormand';
import {
  buildLifetimePrompt,
  generateQimenLifetimePrompt,
} from '../packages/core/src/divination/algorithms/qimen';
import { generateXuanKong } from '../packages/core/src/xuan_kong';
import { calculateWuyunLiuqi } from '../packages/core/src/wuyun-liuqi';
import { buildDivinationPrompt } from '../src/lib/divination/engine';
import { extractDivinationPromptFacts } from '../scripts/prompt-audit/divination-facts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts';

function swapRowValues(prompt: string, rows: number[], pattern: RegExp) {
  const lines = prompt.split('\n');
  const first = lines[rows[0]].match(pattern)?.[0];
  const second = lines[rows[1]].match(pattern)?.[0];
  assert.ok(first && second);
  assert.notEqual(first, second);
  lines[rows[0]] = lines[rows[0]].replace(first, second);
  lines[rows[1]] = lines[rows[1]].replace(second, first);
  const changed = lines.join('\n');
  assert.ok(changed.includes(first) && changed.includes(second));
  return changed;
}

test('实际奇门九宫的天地盘归属互换后，同样的奇仪仍在也应检出错位', () => {
  const data = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
  const prompt = buildDivinationPrompt('qimen', '请分析合作。', data);
  const facts = extractDivinationPromptFacts('qimen', data);
  assert.deepEqual(auditPromptFacts(prompt, facts).missing, []);
  const palaceRow = /^ {2}(?:坎一|坤二|震三|巽四|中五|乾六|兑七|艮八|离九)宫（/u;
  const lines = prompt.split('\n');
  const rows = lines.flatMap((line, index) => (palaceRow.test(line) ? [index] : []));
  assert.equal(rows.length, 9);
  const centerStem = data.jiuGongGe.find((palace) => palace.gong === 5)!.diPan.stem;
  assert.ok(centerStem);
  assert.equal(lines[rows[4]], `  中五宫（中央，土）：地盘${centerStem}`);
  assert.doesNotMatch(prompt, /门无|星无|神无|天盘无/u);
  const changed = swapRowValues(prompt, rows, /天盘[^，]+/u);
  assert.ok(auditPromptFacts(changed, facts).missing.some((id) => id.startsWith('qimen.palace.')));
});

test('奇门终身局精简后仍核对完整干支日期分组与关系归属', () => {
  const { data, prompt } = generateQimenLifetimePrompt({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    periodRange: { startDate: '2026-01-01', endDate: '2026-12-31' },
  });
  const facts = extractDivinationPromptFacts('qimen-lifetime', data);
  assert.deepEqual(auditPromptFacts(prompt, facts).missing, []);

  for (const [name, gong, stem, door, interpretation] of [
    ['虎遁', 8, '乙', '生门', '主威严稳固、资源回归'],
    ['休诈', 6, '丁', '开门', '主和合调停、协作成事'],
  ] as const) {
    const index = data.baseChart.classicPatterns!.findIndex((item) => item.name === name);
    assert.ok(index >= 0);
    const pattern = data.baseChart.classicPatterns![index];
    assert.deepEqual(pattern.palaces, [gong]);
    const palace = data.baseChart.jiuGongGe.find((item) => item.gong === gong)!;
    assert.equal(palace.tianPan.stem, stem);
    assert.equal(palace.renPan.door, door);
    if (name === '休诈') assert.equal(palace.shenPan.god, '六合');
    const id = `qimen-lifetime.base-pattern.${index}`;
    const expected = facts.find((item) => item.id === id)!;
    const patternLine = `  ${name}（吉，${palace.name}）：${interpretation}`;
    assert.equal(expected.unit, 'block');
    assert.equal(expected.owner, patternLine.trim());
    assert.ok(prompt.split('\n').includes(patternLine));
    const palaceLine = prompt.split('\n').find((line) => line.startsWith(`  ${palace.name}（`))!;
    assert.ok(palaceLine.includes(expected.values[0]));
    const starText = palace.tianPan.companionStar
      ? `${palace.tianPan.star}（携${palace.tianPan.companionStar}）`
      : palace.tianPan.star;
    const stemText = palace.tianPan.companionStem
      ? `${palace.tianPan.stem}（携${palace.tianPan.companionStem}）`
      : palace.tianPan.stem;
    for (const trigger of [
      palace.name,
      `天盘[${starText}`,
      `干${stemText}`,
      `人盘[${palace.renPan.door}]`,
      `神盘[${palace.shenPan.god}]`,
      `地盘干[${palace.diPan.stem}]`,
    ]) {
      const changedLine = palaceLine.replace(trigger, '');
      assert.notEqual(changedLine, palaceLine);
      assert.ok(
        auditPromptFacts(prompt.replace(palaceLine, changedLine), facts).missing.includes(id),
        `${name}删去同宫${trigger}后应缺失`,
      );
    }
    for (const changedLine of [
      patternLine.replace(name, '未名格'),
      patternLine.replace(palace.name, '另一宫'),
      patternLine.replace(interpretation, ''),
    ]) {
      assert.ok(
        auditPromptFacts(prompt.replace(patternLine, changedLine), facts).missing.includes(id),
      );
    }

    const extra = structuredClone(data);
    const extraPattern = extra.baseChart.classicPatterns![index];
    extraPattern.summary += '；另须核本次甲旬条件';
    const extraEvidence = extra.baseChart.evidenceAnalysis!.patternFacts.find(
      (item) => item.kind === '经典格局' && item.name === name,
    )!;
    extraEvidence.originalText = extraPattern.summary;
    extraEvidence.promptText = extraPattern.summary;
    const extraPrompt = buildLifetimePrompt(extra, undefined, { includeCurrentTime: false });
    const extraFacts = extractDivinationPromptFacts('qimen-lifetime', extra);
    assert.ok(extraPrompt.includes(`${patternLine}；另须核本次甲旬条件`));
    assert.deepEqual(auditPromptFacts(extraPrompt, extraFacts).missing, []);
    assert.ok(
      auditPromptFacts(
        extraPrompt.replace('；另须核本次甲旬条件', ''),
        extraFacts,
      ).missing.includes(id),
    );
  }

  const compactPatternIds = ['虎遁', '休诈'].map(
    (name) =>
      `qimen-lifetime.base-pattern.${data.baseChart.classicPatterns!.findIndex((item) => item.name === name)}`,
  );
  const palaceRows = [8, 6].map((gong) => {
    const palace = data.baseChart.jiuGongGe.find((item) => item.gong === gong)!;
    return prompt.split('\n').findIndex((line) => line.startsWith(`  ${palace.name}（`));
  });
  for (const field of [
    /人盘\[[^\]]+\]/u,
    /干[乙丙丁戊己庚辛壬癸](?:（携[乙丙丁戊己庚辛壬癸]）)?/u,
    /神盘\[[^\]]+\]/u,
  ]) {
    const changed = swapRowValues(prompt, palaceRows, field);
    const missing = auditPromptFacts(changed, facts).missing;
    assert.ok(compactPatternIds.every((id) => missing.includes(id)));
  }
  const patternRows = ['虎遁', '休诈'].map((name) =>
    prompt.split('\n').findIndex((line) => line.startsWith(`  ${name}（吉，`)),
  );
  const swappedPatternPalaces = swapRowValues(prompt, patternRows, /，[^）]+宫/u);
  assert.ok(
    compactPatternIds.every((id) =>
      auditPromptFacts(swappedPatternPalaces, facts).missing.includes(id),
    ),
  );

  for (const index of [10, 11]) {
    const retainedPattern = data.baseChart.classicPatterns![index];
    assert.ok(/甲|旬|遁|星奇游/u.test(retainedPattern.summary));
    assert.equal(retainedPattern.palaces.length, 1);
    const retainedPalace = data.baseChart.jiuGongGe.find(
      (item) => item.gong === retainedPattern.palaces[0],
    )!;
    const stemPair = retainedPattern.summary.match(
      /^天盘([乙丙丁戊己庚辛壬癸])加地盘([乙丙丁戊己庚辛壬癸])于([^，]+)，/u,
    )!;
    assert.equal(stemPair[3], retainedPalace.name);
    assert.ok(
      [retainedPalace.tianPan.stem, retainedPalace.tianPan.companionStem].includes(stemPair[1]),
    );
    assert.equal(retainedPalace.diPan.stem, stemPair[2]);
    const retainedId = `qimen-lifetime.base-pattern.${index}`;
    const retainedFact = facts.find((item) => item.id === retainedId)!;
    assert.equal(retainedFact.unit, 'line');
    const tone =
      retainedPattern.type === 'good' ? '吉' : retainedPattern.type === 'bad' ? '凶' : '中性';
    assert.equal(retainedFact.owner, `${retainedPattern.name}（${tone}）：`);
    const retainedLine = prompt
      .split('\n')
      .find((line) => line.startsWith(`  ${retainedFact.owner}`))!;
    assert.ok(retainedLine.includes('甲'));
    assert.ok(
      auditPromptFacts(
        prompt.replace(retainedLine, retainedLine.replaceAll('甲', '乙')),
        facts,
      ).missing.includes(retainedId),
    );
  }

  const cluster = data.eventClusters?.find((item) => item.key.includes(':day:'));
  const firstDate = cluster?.triggerDates?.[0];
  const date = cluster?.triggerDates?.find(
    (item, index) => index > 0 && item.ganzhi === firstDate?.ganzhi,
  );
  assert.ok(date?.ganzhi && date.relation);
  const dateLine = prompt
    .split('\n')
    .find(
      (line) =>
        line.includes(`可复核日期：`) &&
        line.includes(date.date) &&
        line.includes(`${date.ganzhi}：`) &&
        line.includes(`日干支关系：${date.relation}`),
    );
  assert.ok(dateLine);
  const groupedDates = dateLine
    .slice('  可复核日期：'.length)
    .split(`；日干支关系：${date.relation}`)[0]!
    .split('；');
  const ownGroupIndex = groupedDates.findIndex((group) => group.startsWith(`${date.ganzhi}：`));
  const wrongGroupIndex = groupedDates.findIndex((group) => !group.startsWith(`${date.ganzhi}：`));
  assert.ok(ownGroupIndex >= 0 && wrongGroupIndex >= 0, '应找到本干支组和另一干支组');
  const ownDates = groupedDates[ownGroupIndex]!.slice(`${date.ganzhi}：`.length).split('、');
  const ownDateIndex = ownDates.indexOf(date.date);
  assert.ok(ownDateIndex >= 0, '非首日期应位于其对应的干支组内');
  ownDates.splice(ownDateIndex, 1);
  const wrongGanzhi = groupedDates[wrongGroupIndex]!.split('：')[0]!;
  const wrongDates = groupedDates[wrongGroupIndex]!.slice(`${wrongGanzhi}：`.length).split('、');
  wrongDates.push(date.date);
  groupedDates[ownGroupIndex] = `${date.ganzhi}：${ownDates.join('、')}`;
  groupedDates[wrongGroupIndex] = `${wrongGanzhi}：${wrongDates.join('、')}`;
  const changedLine = `  可复核日期：${groupedDates.join('；')}；日干支关系：${date.relation}`;
  const changed = prompt.replace(dateLine, changedLine);
  assert.ok(
    auditPromptFacts(changed, facts).missing.some((id) => id.startsWith('qimen-lifetime.event.')),
    '将同一干支组的非首日期移到其他组后应审计失败',
  );

  const patternIndex = data.baseChart.classicPatterns!.findIndex(
    (pattern) => pattern.name === '干合蛇刑',
  );
  assert.ok(patternIndex >= 0);
  const pattern = data.baseChart.classicPatterns![patternIndex];
  assert.deepEqual(pattern.palaces, [1]);
  const patternId = `qimen-lifetime.base-pattern.${patternIndex}`;
  const compactLine = '  干合蛇刑（中性，坎一宫）：主文书财喜，宜阴人，贵人官禄，常人平平';
  assert.ok(prompt.split('\n').includes(compactLine));
  const palace = data.baseChart.jiuGongGe.find((item) => item.gong === 1)!;
  assert.equal(palace.tianPan.stem, '壬');
  assert.equal(palace.diPan.stem, '丁');
  const palaceLine = prompt.split('\n').find((line) => line.startsWith('  坎一宫（水）：'))!;
  assert.match(palaceLine, /天盘\[[^\n]*干壬\][^\n]*地盘干\[丁\]/u);
  for (const wrongPattern of [
    '  干合蛇刑（中性，坎一宫）：',
    '  干合蛇刑（中性，离九宫）：主文书财喜，宜阴人，贵人官禄，常人平平',
    '  干合蛇刑（凶，坎一宫）：主文书财喜，宜阴人，贵人官禄，常人平平',
  ]) {
    assert.ok(
      auditPromptFacts(prompt.replace(compactLine, wrongPattern), facts).missing.includes(
        patternId,
      ),
    );
  }
  for (const wrongPalace of [
    palaceLine.replace('坎一宫', '离九宫'),
    palaceLine.replace('干壬', '干甲'),
    palaceLine.replace('地盘干[丁]', '地盘干[庚]'),
  ]) {
    assert.ok(
      auditPromptFacts(prompt.replace(palaceLine, wrongPalace), facts).missing.includes(patternId),
    );
  }

  const fuShiData = structuredClone(data);
  const fuShiSourcePalace = fuShiData.baseChart.jiuGongGe.find((item) => item.gong === 1)!;
  fuShiData.baseChart.zhiFu = fuShiSourcePalace.tianPan.star;
  fuShiData.baseChart.zhiShi = fuShiSourcePalace.renPan.door;
  const fuShiSummary = `值符${fuShiData.baseChart.zhiFu}与值使${fuShiData.baseChart.zhiShi}同落坎一宫，乃符使同宫之格，事情有极强的集中力量。`;
  fuShiData.baseChart.classicPatterns!.push({
    name: '符使同宫',
    type: 'good',
    palaces: [1],
    summary: fuShiSummary,
  });
  const fuShiEvidence = structuredClone(
    fuShiData.baseChart.evidenceAnalysis!.patternFacts.find((item) => item.kind === '经典格局')!,
  );
  Object.assign(fuShiEvidence, {
    key: 'qimen:classic:fu-shi-control',
    name: '符使同宫',
    traditionalTone: '有利',
    originalText: fuShiSummary,
    promptText: `值符${fuShiData.baseChart.zhiFu}与值使${fuShiData.baseChart.zhiShi}同落坎一宫`,
    palaces: [1],
  });
  fuShiData.baseChart.evidenceAnalysis!.patternFacts.push(fuShiEvidence);
  const fuShiPrompt = buildLifetimePrompt(fuShiData, undefined, { includeCurrentTime: false });
  const fuShiFacts = extractDivinationPromptFacts('qimen-lifetime', fuShiData);
  assert.deepEqual(auditPromptFacts(fuShiPrompt, fuShiFacts).missing, []);
  assert.equal(fuShiFacts.length, facts.length + 1);

  const fuShiIndex = fuShiData.baseChart.classicPatterns!.findIndex(
    (item) => item.name === '符使同宫',
  );
  assert.ok(fuShiIndex >= 0);
  const fuShiPattern = fuShiData.baseChart.classicPatterns![fuShiIndex];
  assert.equal(fuShiPattern.type, 'good');
  assert.equal(fuShiPattern.palaces.length, 1);
  const fuShiPalace = fuShiData.baseChart.jiuGongGe.find(
    (item) => item.gong === fuShiPattern.palaces[0],
  )!;
  assert.ok(
    [fuShiPalace.tianPan.star, fuShiPalace.tianPan.companionStar].includes(
      fuShiData.baseChart.zhiFu,
    ),
  );
  assert.equal(fuShiPalace.renPan.door, fuShiData.baseChart.zhiShi);
  assert.ok(
    fuShiPrompt.split('\n').includes(`  符使同宫（吉，${fuShiPalace.name}）：事情有极强的集中力量`),
  );
  const fuShiId = `qimen-lifetime.base-pattern.${fuShiIndex}`;
  const roleLine = `值符星：${fuShiData.baseChart.zhiFu} | 值使门：${fuShiData.baseChart.zhiShi}`;
  assert.ok(fuShiPrompt.split('\n').includes(roleLine));
  const fuShiPalaceLine = prompt
    .split('\n')
    .find((line) => line.startsWith(`  ${fuShiPalace.name}（`))!;
  assert.ok(fuShiPalaceLine.includes(fuShiData.baseChart.zhiFu));
  assert.ok(fuShiPalaceLine.includes(`人盘[${fuShiData.baseChart.zhiShi}]`));
  const wrongFu = fuShiData.baseChart.zhiFu === '天蓬' ? '天任' : '天蓬';
  const wrongShi = fuShiData.baseChart.zhiShi === '休门' ? '开门' : '休门';
  for (const wrongRoleLine of [
    '',
    roleLine.replace(`值符星：${fuShiData.baseChart.zhiFu}`, `值符星：${wrongFu}`),
    roleLine.replace(`值使门：${fuShiData.baseChart.zhiShi}`, `值使门：${wrongShi}`),
  ]) {
    assert.ok(
      auditPromptFacts(fuShiPrompt.replace(roleLine, wrongRoleLine), fuShiFacts).missing.includes(
        fuShiId,
      ),
    );
  }
  for (const wrongFuShiPalaceLine of [
    fuShiPalaceLine.replace(fuShiData.baseChart.zhiFu, wrongFu),
    fuShiPalaceLine.replace(`人盘[${fuShiData.baseChart.zhiShi}]`, `人盘[${wrongShi}]`),
  ]) {
    assert.notEqual(wrongFuShiPalaceLine, fuShiPalaceLine);
    assert.ok(
      auditPromptFacts(
        fuShiPrompt.replace(fuShiPalaceLine, wrongFuShiPalaceLine),
        fuShiFacts,
      ).missing.includes(fuShiId),
    );
  }

  const companionData = structuredClone(data);
  const companionPalace = companionData.baseChart.jiuGongGe.find((item) => item.gong === 1)!;
  companionPalace.tianPan.stem = '甲';
  companionPalace.tianPan.companionStem = '壬';
  const companionPrompt = buildLifetimePrompt(companionData, undefined, {
    includeCurrentTime: false,
  });
  const companionFacts = extractDivinationPromptFacts('qimen-lifetime', companionData);
  assert.ok(companionPrompt.split('\n').includes(compactLine));
  assert.deepEqual(auditPromptFacts(companionPrompt, companionFacts).missing, []);
  assert.ok(
    auditPromptFacts(
      companionPrompt.replace('干甲（携壬）', '干甲（携庚）'),
      companionFacts,
    ).missing.includes(patternId),
  );

  const extraData = structuredClone(data);
  const extraPattern = extraData.baseChart.classicPatterns![patternIndex];
  extraPattern.summary += '；另须核本次甲旬条件';
  const extraFact = extraData.baseChart.evidenceAnalysis!.patternFacts.find(
    (item) => item.kind === '经典格局' && item.name === '干合蛇刑',
  )!;
  extraFact.originalText = extraPattern.summary;
  extraFact.promptText = extraPattern.summary;
  const extraPrompt = buildLifetimePrompt(extraData, undefined, { includeCurrentTime: false });
  const extraFacts = extractDivinationPromptFacts('qimen-lifetime', extraData);
  assert.ok(
    extraPrompt
      .split('\n')
      .includes(
        '  干合蛇刑（中性）：天盘壬加地盘丁于坎一宫，主文书财喜，宜阴人，贵人官禄，常人平平；另须核本次甲旬条件',
      ),
  );
  assert.deepEqual(auditPromptFacts(extraPrompt, extraFacts).missing, []);
  assert.ok(
    auditPromptFacts(extraPrompt.replace('；另须核本次甲旬条件', ''), extraFacts).missing.includes(
      patternId,
    ),
  );

  const missingEvidenceData = structuredClone(data);
  delete missingEvidenceData.baseChart.evidenceAnalysis;
  const missingEvidencePrompt = buildLifetimePrompt(missingEvidenceData, undefined, {
    includeCurrentTime: false,
  });
  const missingEvidenceFacts = extractDivinationPromptFacts('qimen-lifetime', missingEvidenceData);
  assert.ok(
    missingEvidencePrompt
      .split('\n')
      .includes(
        '  干合蛇刑（中性）：天盘壬加地盘丁于坎一宫，主文书财喜，宜阴人，贵人官禄，常人平平',
      ),
  );
  assert.deepEqual(auditPromptFacts(missingEvidencePrompt, missingEvidenceFacts).missing, []);
  for (const [name, location] of [
    ['虎遁', '生门、乙奇落艮八宫，'],
    ['休诈', '丁奇、开门、六合同宫于乾六宫，'],
  ]) {
    const index = data.baseChart.classicPatterns!.findIndex((item) => item.name === name);
    const id = `qimen-lifetime.base-pattern.${index}`;
    const fullLine = missingEvidencePrompt
      .split('\n')
      .find((line) => line.startsWith(`  ${name}（吉）：`))!;
    assert.ok(fullLine.includes(location));
    assert.equal(missingEvidenceFacts.find((item) => item.id === id)!.unit, 'line');
    assert.ok(
      auditPromptFacts(
        missingEvidencePrompt.replace(fullLine, fullLine.replace(location, '')),
        missingEvidenceFacts,
      ).missing.includes(id),
    );
  }
  assert.equal(facts.length, extraFacts.length);
  assert.equal(facts.length, companionFacts.length);
  assert.equal(facts.length, missingEvidenceFacts.length);
});

test('实际六爻的六神换到另一爻后不能通过全表事实核验', () => {
  const data = generateLiuyao(new Date('2026-05-19T10:30:00+08:00'));
  const prompt = buildDivinationPrompt('liuyao', '请分析事业。', data);
  const facts = extractDivinationPromptFacts('liuyao', data);
  assert.deepEqual(auditPromptFacts(prompt, facts).missing, []);
  const rows = prompt
    .split('\n')
    .flatMap((line, index) => (/第\d爻.+六神/u.test(line) ? [index] : []));
  assert.equal(rows.length, 6);
  const changed = swapRowValues(prompt, rows, /六神[\u4e00-\u9fff]{2}/u);
  assert.ok(auditPromptFacts(changed, facts).missing.some((id) => id.startsWith('liuyao.yao.')));
});

test('雷诺曼提示词按逐牌资料核验普通相邻关系，并保留固定组合判词核验', () => {
  const ordinary = drawLenormandSpread('three', { manualCardIds: [31, 32, 8] });
  const ordinaryPrompt = buildDivinationPrompt('lenormand', '请分析事情走向。', ordinary);
  const ordinaryFacts = extractDivinationPromptFacts('lenormand', ordinary);
  assert.deepEqual(auditPromptFacts(ordinaryPrompt, ordinaryFacts).missing, []);
  assert.ok(ordinaryFacts.some((item) => item.id.startsWith('lenormand.card.')));
  assert.ok(!ordinaryFacts.some((item) => item.id.startsWith('lenormand.combination.')));

  const fixed = drawLenormandSpread('three', { manualCardIds: [32, 31, 1] });
  const fixedPrompt = buildDivinationPrompt('lenormand', '请分析事情走向。', fixed);
  const fixedFacts = extractDivinationPromptFacts('lenormand', fixed);
  assert.deepEqual(auditPromptFacts(fixedPrompt, fixedFacts).missing, []);
  assert.ok(fixedFacts.some((item) => item.id === 'lenormand.combination.0'));
  const changed = fixedPrompt.replace('信息由模糊转向清晰的线索', '信息由清晰转向模糊的线索');
  assert.ok(auditPromptFacts(changed, fixedFacts).missing.includes('lenormand.combination.0'));
});

test('实际玄空飞星和五运六气按宫位及步序绑定，交换数字或客运不能蒙混通过', () => {
  const house = generateXuanKong({ year: 2024, facingDegree: 0 });
  const houseFacts = extractDivinationPromptFacts('xuankong', house);
  assert.deepEqual(auditPromptFacts(house.prompt, houseFacts).missing, []);
  const houseRows = house.prompt
    .split('\n')
    .flatMap((line, index) => (/）：运\d/u.test(line) ? [index] : []));
  const changedHouse = swapRowValues(house.prompt, houseRows, /山\d/u);
  assert.ok(
    auditPromptFacts(changedHouse, houseFacts).missing.some((id) =>
      id.startsWith('xuankong.palace.'),
    ),
  );
  const climate = calculateWuyunLiuqi({ year: 2026 });
  const climateFacts = extractDivinationPromptFacts('wuyun-liuqi', climate);
  assert.deepEqual(auditPromptFacts(climate.prompt, climateFacts).missing, []);
  const movementRows = climate.prompt
    .split('\n')
    .flatMap((line, index) => (/^\d\. .+主运.+客运/u.test(line) ? [index] : []));
  const changedClimate = swapRowValues(climate.prompt, movementRows, /客运[^（；]+/u);
  assert.ok(
    auditPromptFacts(changedClimate, climateFacts).missing.some((id) =>
      id.startsWith('wuyun.movement.'),
    ),
  );
});
