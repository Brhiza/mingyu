import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeBaziCompatibility, baziCalculator } from '../packages/core/src/bazi/index.ts';
import { buildBaziCompatibilityPrompt } from '../packages/core/src/prompt/bazi.ts';
import { buildZiweiChartInput, calculateZiweiChart } from '../packages/core/src/ziwei/runtime.ts';
import { buildZiweiPrompt } from '../packages/core/src/prompt/ziwei.ts';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe';
import { analyzeAstrolabeSynastry } from '../packages/core/src/divination/astrolabe-synastry';
import { buildAstrolabeScopeContext } from '../packages/core/src/divination/astrolabe-scope';
import { buildAstrolabeSynastryPrompt } from '../packages/core/src/prompt/astrolabe';
import { buildDivinationPrompt } from '../src/lib/divination/engine';
import { auditPromptFacts } from '../scripts/prompt-audit/facts.ts';
import {
  extractBaziCompatibilityFacts,
  extractAstrolabeFacts,
  extractAstrolabeSynastryFacts,
  extractZiweiFacts,
} from '../scripts/prompt-audit/natal-facts.ts';

const currentTime = new Date('2026-09-13T12:00:00+08:00');

function auditOriginal(prompt: string, facts: Parameters<typeof auditPromptFacts>[1]) {
  const result = auditPromptFacts(prompt, facts);
  assert.equal(result.present, result.expected);
  assert.deepEqual(result.missing, []);
  return result;
}

function swapAll(text: string, first: string, second: string) {
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(
    new RegExp(`${escapeRegExp(first)}|${escapeRegExp(second)}`, 'gu'),
    (value) => (value === first ? second : first),
  );
}

let astrolabeAuditCharts:
  | { first: ReturnType<typeof generateAstrolabe>; second: ReturnType<typeof generateAstrolabe> }
  | undefined;
function getAstrolabeAuditCharts() {
  return (astrolabeAuditCharts ??= {
    first: generateAstrolabe({
      name: '甲',
      gender: '男',
      year: '1993',
      month: '4',
      day: '8',
      hour: '23',
      minute: '34',
      latitude: '1.3521',
      longitude: '103.8198',
      timezone: '8',
      locationName: '新加坡',
      useTrueSolarTime: false,
    }),
    second: generateAstrolabe({
      name: '乙',
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
    }),
  });
}

function swapBaziSubjectsYearPillars(
  prompt: string,
  firstYearPillar: string,
  secondYearPillar: string,
) {
  const firstStart = prompt.indexOf('【第一人排盘信息】');
  const secondStart = prompt.indexOf('【第二人排盘信息】');
  const relationStart = prompt.indexOf('【双盘关系资料】');
  assert.ok(firstStart >= 0 && secondStart > firstStart && relationStart > secondStart);
  const firstSection = prompt
    .slice(firstStart, secondStart)
    .replace(`年柱: ${firstYearPillar}`, `年柱: ${secondYearPillar}`);
  const secondSection = prompt
    .slice(secondStart, relationStart)
    .replace(`年柱: ${secondYearPillar}`, `年柱: ${firstYearPillar}`);
  return prompt.slice(0, firstStart) + firstSection + secondSection + prompt.slice(relationStart);
}

test('真实八字双盘交换主体年柱后，相同柱名仍能检出归属错绑', () => {
  const first = baziCalculator.calculateBazi({
    gender: 'female',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const second = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1991,
    month: 7,
    day: 20,
    timeIndex: 7,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const relation = analyzeBaziCompatibility(first, second, {
    person1Name: '甲',
    person2Name: '乙',
  });
  const prompt = buildBaziCompatibilityPrompt({
    result1: first,
    result2: second,
    person1Name: '甲',
    person2Name: '乙',
    question: '请分析双方关系。',
    currentTime,
  });
  const facts = extractBaziCompatibilityFacts(first, second, relation);
  auditOriginal(prompt, facts);

  const swapped = swapBaziSubjectsYearPillars(
    prompt,
    first.pillars.year.ganZhi,
    second.pillars.year.ganZhi,
  );
  const result = auditPromptFacts(swapped, facts);
  assert.ok(result.missing.includes('bazi.compatibility.person1.natal.year.pillar'));
  assert.ok(result.missing.includes('bazi.compatibility.person2.natal.year.pillar'));
  const hiddenLine = (key: 'year' | 'month') =>
    `藏干: ${first.hiddenStems[key].map((stem, index) => `${stem}[${first.hiddenTenGods[key][index]}]`).join('')}`;
  const yearHidden = hiddenLine('year');
  const monthHidden = hiddenLine('month');
  assert.notEqual(yearHidden, monthHidden);
  const swappedHidden = swapAll(prompt, yearHidden, monthHidden);
  assert.ok(swappedHidden.includes(yearHidden) && swappedHidden.includes(monthHidden));
  const hiddenResult = auditPromptFacts(swappedHidden, facts);
  assert.ok(hiddenResult.missing.includes('bazi.compatibility.person1.natal.year.hidden-stems'));
  assert.ok(hiddenResult.missing.includes('bazi.compatibility.person1.natal.month.hidden-stems'));
});

test('真实紫微宫位交换后，相同宫名仍能检出宫干支错绑', async () => {
  const input = buildZiweiChartInput({
    name: '审计样本',
    gender: 'female',
    dateType: 'solar',
    year: 1992,
    month: 8,
    day: 21,
    timeIndex: 4,
    isLeapMonth: false,
  });
  const runtime = await calculateZiweiChart(input, {
    scopes: ['decadal'],
    horoscopeContext: { dateStr: '2026-09-13', hourIndex: 4 },
  });
  const payload = runtime.payloadByScope.decadal;
  const prompt = buildZiweiPrompt({
    runtime,
    scope: 'decadal',
    question: '请分析当前运限。',
    currentTime,
  });
  const facts = extractZiweiFacts(payload, {
    scope: { start: '【紫微盘面资料】', end: '【任务】' },
    payloadScopes: ['decadal'],
    includeActiveFacts: false,
    palaceValueStyle: 'public',
    starValuePrefix: false,
  });
  auditOriginal(prompt, facts);

  const [firstPalace, secondPalace] = payload.palaces;
  const swapped = swapAll(
    prompt,
    `宫干支${firstPalace.heavenly_stem}${firstPalace.earthly_branch}`,
    `宫干支${secondPalace.heavenly_stem}${secondPalace.earthly_branch}`,
  );
  const result = auditPromptFacts(swapped, facts);
  assert.ok(result.missing.includes('ziwei.decadal.0.palace'));
  assert.ok(result.missing.includes('ziwei.decadal.1.palace'));
});

test('真实紫微当前四化交换落宫后应保留星曜关键词并检出配对错绑', async () => {
  const input = buildZiweiChartInput({
    name: '四化审计样本',
    gender: 'female',
    dateType: 'solar',
    year: 1992,
    month: 8,
    day: 21,
    timeIndex: 4,
    isLeapMonth: false,
  });
  const runtime = await calculateZiweiChart(input, {
    scopes: ['decadal'],
    horoscopeContext: { dateStr: '2026-09-13', hourIndex: 4 },
  });
  const payload = runtime.payloadByScope.decadal;
  const prompt = buildZiweiPrompt({
    runtime,
    scope: 'decadal',
    question: '请分析当前四化。',
    currentTime,
  });
  const facts = extractZiweiFacts(payload, {
    scope: { start: '【紫微盘面资料】', end: '【任务】' },
    payloadScopes: ['decadal'],
    includeActiveFacts: false,
    palaceValueStyle: 'public',
    starValuePrefix: false,
  });
  auditOriginal(prompt, facts);

  const mappings = payload.active_scope.mutagen_map;
  const mapFacts = facts.filter((item) => /\.mutagens(?:\.|$)/u.test(item.id));
  assert.equal(mapFacts.length, mappings.length);
  assert.equal(mapFacts.length, 4);
  assert.deepEqual(
    mapFacts.map((item) => item.id),
    mappings.map((_, index) => `ziwei.decadal.mutagens${index === 0 ? '' : `.${index}`}`),
  );
  const first = mappings[0];
  const secondIndex = mappings.findIndex(
    (item, index) => index > 0 && item.palace_index !== first.palace_index,
  );
  const second = mappings[secondIndex];
  assert.ok(first && second && first.dynamic_palace_name && second.dynamic_palace_name);
  assert.notEqual(first.palace_index, second.palace_index);
  const firstFact = mapFacts[0];
  const secondFact = mapFacts[secondIndex];
  const firstText = firstFact.values[0];
  const secondText = secondFact.values[0];
  assert.notEqual(firstFact.owner, '当前四化');
  assert.notEqual(secondFact.owner, '当前四化');
  assert.ok(firstText.startsWith(first.star) && firstText.includes(`当前化${first.mutagen}`));
  assert.ok(secondText.startsWith(second.star) && secondText.includes(`当前化${second.mutagen}`));
  assert.ok(prompt.includes(firstText) && prompt.includes(secondText));
  const firstLine = prompt.split('\n').find((line) => line.trimStart().startsWith(firstFact.owner));
  const secondLine = prompt
    .split('\n')
    .find((line) => line.trimStart().startsWith(secondFact.owner));
  assert.ok(firstLine && secondLine);
  assert.deepEqual(auditPromptFacts(swapAll(prompt, firstLine, secondLine), facts).missing, []);
  const swapped = swapAll(prompt, firstText, secondText);
  assert.ok(swapped.includes(firstText) && swapped.includes(secondText));
  assert.ok(swapped.includes(firstFact.owner) && swapped.includes(secondFact.owner));
  const result = auditPromptFacts(swapped, facts);
  assert.ok(result.missing.includes(firstFact.id), '第一条四化交换到其他宫位应失败');
  assert.ok(result.missing.includes(secondFact.id), '第二条四化交换到其他宫位应失败');
  for (const [index, mapping] of mappings.entries()) {
    const annotated = mapFacts[index].values[0];
    assert.ok(annotated.includes(`当前化${mapping.mutagen}`));
    const removed = prompt.replace(annotated, annotated.replace(`，当前化${mapping.mutagen}`, ''));
    assert.ok(auditPromptFacts(removed, facts).missing.includes(mapFacts[index].id));
  }
});

test('真实西占双盘落宫逐项绑定方向与宫位，跨盘相位和无关宫号不能填补', () => {
  const { first, second } = getAstrolabeAuditCharts();
  const relation = analyzeAstrolabeSynastry(first, second);
  const text = buildAstrolabeSynastryPrompt({
    chart1: first,
    chart2: second,
    synastry: relation,
    question: '请分析双方关系。',
    currentTime,
  });
  const facts = extractAstrolabeSynastryFacts(first, second, relation);
  const overlayFacts = facts.filter((item) => item.id.includes('.overlay.'));
  assert.equal(overlayFacts.length, relation.houseOverlays.length);
  assert.equal(
    facts.length,
    first.planets.length +
      first.angles.length +
      second.planets.length +
      second.angles.length +
      relation.aspects.length +
      relation.houseOverlays.length,
  );
  const original = auditOriginal(text, facts);
  assert.deepEqual(original.repeated, []);
  const aspectSection = text.split('【跨盘相位】')[1].split('【跨盘落宫】')[0];
  const aspectLines = aspectSection.split('\n');
  const borrowedIndex = relation.houseOverlays.findIndex((item) =>
    aspectLines.some(
      (line) =>
        line.includes(
          `${item.visitorPerson === 'person1' ? '第一人' : '第二人'}${item.visitor}的${item.point}`,
        ) &&
        line.includes(`${item.ownerPerson === 'person1' ? '第一人' : '第二人'}${item.owner}的`),
    ),
  );
  assert.ok(borrowedIndex >= 0, '实际跨盘相位须含对应落宫点位与双方身份');
  const overlay = relation.houseOverlays[borrowedIndex];
  const expected = overlayFacts[borrowedIndex];
  const visitor = `${overlay.visitorPerson === 'person1' ? '第一人' : '第二人'}${overlay.visitor}`;
  const owner = `${overlay.ownerPerson === 'person1' ? '第一人' : '第二人'}${overlay.owner}`;
  assert.equal(expected.owner, `${visitor}的${overlay.point}`);
  assert.deepEqual(expected.values, [`落入${owner}的本命盘第${overlay.house}宫`]);
  const line = text
    .split('\n')
    .find(
      (item) => item.trimStart().startsWith(expected.owner) && item.includes(expected.values[0]),
    );
  assert.ok(line);

  const removed = text.replace(line, '');
  assert.equal(removed.split('【跨盘相位】')[1].split('【跨盘落宫】')[0], aspectSection);
  assert.ok(auditPromptFacts(removed, facts).missing.includes(expected.id));
  const aspectRow = aspectLines.find(
    (item) => item.includes(`${visitor}的${overlay.point}`) && item.includes(`${owner}的`),
  );
  assert.ok(aspectRow);
  const interferenceRow = `${aspectRow}；另记第${overlay.house}宫`;
  const interference = removed.replace(aspectRow, interferenceRow);
  const interferenceSection = interference.split('【跨盘相位】')[1].split('【跨盘落宫】')[0];
  assert.ok(
    interferenceSection
      .split('\n')
      .some((item) =>
        [overlay.point, overlay.visitor, overlay.owner, `第${overlay.house}宫`].every((value) =>
          item.includes(value),
        ),
      ),
    '无关宫号使实际相位行满足旧宽松关键词同现，但不能充当落宫事实',
  );
  assert.ok(auditPromptFacts(interference, facts).missing.includes(expected.id));
  const copiedToAspect = removed.replace('【跨盘落宫】', `${line}\n\n【跨盘落宫】`);
  assert.ok(auditPromptFacts(copiedToAspect, facts).missing.includes(expected.id));

  const reversed = line
    .replace(`${visitor}的${overlay.point}`, `${owner}的${overlay.point}`)
    .replace(`落入${owner}的本命盘`, `落入${visitor}的本命盘`);
  assert.ok(auditPromptFacts(text.replace(line, reversed), facts).missing.includes(expected.id));
  const wrongHouse = line.replace(
    expected.values[0],
    `落入${owner}的本命盘第${(overlay.house % 12) + 1}宫；另记第${overlay.house}宫`,
  );
  assert.ok(wrongHouse.includes(`第${overlay.house}宫`));
  assert.ok(auditPromptFacts(text.replace(line, wrongHouse), facts).missing.includes(expected.id));
  const wrongPoint = relation.houseOverlays.find((item) => item.point !== overlay.point);
  assert.ok(wrongPoint);
  assert.ok(
    auditPromptFacts(
      text.replace(line, line.replace(expected.owner, `${visitor}的${wrongPoint.point}`)),
      facts,
    ).missing.includes(expected.id),
  );
});

test('真实太阳返照相位绑定有效期与时刻，另一窗口相同相位不能补足', () => {
  const { first } = getAstrolabeAuditCharts();
  const context = buildAstrolabeScopeContext(first, 'yearly', '2022', {
    includePeriodEvents: false,
  });
  const text = buildDivinationPrompt('astrolabe', '请分析所选流年。', first, undefined, {
    astrolabeScopeText: context.promptText,
    omitCurrentTime: true,
  });
  const facts = extractAstrolabeFacts(first, context, {
    scope: { start: '【占卜信息】', end: '【任务】' },
    periodScope: { start: '【分析对象】', end: '【占卜信息】' },
  });
  const solarReturn = context.solarReturnEvidence;
  assert.ok(solarReturn?.dateTime && solarReturn.returnChart);
  const periods = context.solarReturnPeriods;
  assert.ok(periods && periods.length >= 2);
  assert.ok(periods.every((item) => item.evidence.dateTime));
  assert.equal(
    facts.length,
    first.planets.length +
      first.angles.length +
      first.houses.length +
      first.aspects.length +
      periods.reduce((total, item) => total + item.evidence.aspectFacts.length + 1, 0) +
      (context.secondaryProgressionEvidence?.aspectFacts.length ?? 0) +
      (context.solarArcEvidence?.aspectFacts.length ?? 0),
  );
  const solarFacts = facts.filter((item) => /^astrolabe\.yearly\.太阳返照\.\d+$/u.test(item.id));
  assert.equal(solarFacts.length, solarReturn.aspectFacts.length);
  assert.deepEqual(
    solarFacts.map((item) => item.id),
    solarReturn.aspectFacts.map((_, index) => `astrolabe.yearly.太阳返照.${index}`),
  );
  const original = auditOriginal(text, facts);
  assert.deepEqual(original.repeated, []);
  const selected = context.solarReturnPeriods?.find(
    (item) => item.evidence.dateTime === solarReturn.dateTime,
  );
  const other = context.solarReturnPeriods?.find(
    (item) => item.evidence.dateTime !== solarReturn.dateTime,
  );
  assert.ok(selected && other?.evidence.returnChart);
  assert.equal(
    facts.filter((item) => item.id.includes('.太阳返照.') && item.id.endsWith('.time')).length,
    periods.length,
  );
  for (const [periodIndex, period] of periods.entries()) {
    const idPrefix =
      period.evidence.dateTime === solarReturn.dateTime
        ? 'astrolabe.yearly.太阳返照'
        : `astrolabe.yearly.太阳返照.period.${periodIndex}`;
    assert.ok(facts.some((item) => item.id === `${idPrefix}.time`));
    assert.deepEqual(
      facts
        .filter(
          (item) =>
            item.id.startsWith(`${idPrefix}.`) && /^\d+$/u.test(item.id.slice(idPrefix.length + 1)),
        )
        .map((item) => item.id),
      period.evidence.aspectFacts.map((_, index) => `${idPrefix}.${index}`),
    );
  }
  const sharedIndex = solarReturn.aspectFacts.findIndex((item) =>
    other.evidence.aspectFacts.some(
      (candidate) =>
        candidate.movingPoint === item.movingPoint &&
        candidate.natalPoint === item.natalPoint &&
        candidate.aspectName === item.aspectName &&
        candidate.deviation.toFixed(2) === item.deviation.toFixed(2) &&
        candidate.closeness === item.closeness,
    ),
  );
  assert.ok(sharedIndex >= 0, '真实两个返照窗口包含同一完整相位条件');
  const aspect = solarReturn.aspectFacts[sharedIndex];
  const relationText = `${aspect.movingPoint}${aspect.aspectName}${aspect.natalPoint}（偏差${aspect.deviation.toFixed(2)}°，${aspect.closeness}）`;
  const expected = solarFacts[sharedIndex];
  assert.deepEqual(expected.values, [relationText]);
  assert.ok(expected.owner.includes(selected.startsAt) && expected.owner.includes(selected.endsAt));
  assert.ok(expected.owner.includes(`返照时刻${solarReturn.dateTime}`));
  const lines = text.split('\n');
  const headerIndex = lines.findIndex((line) =>
    line.startsWith(`太阳返照有效期${selected.startsAt}至${selected.endsAt}`),
  );
  assert.ok(headerIndex >= 0);
  const header = lines[headerIndex];
  const body = lines[headerIndex + 1];
  assert.match(body, /^太阳返照盘/u);
  assert.ok(body.includes(relationText));
  const removed = text.replace(body, body.replace(relationText, ''));
  assert.ok(removed.includes(relationText), '另一窗口仍有相同相位');
  assert.ok(auditPromptFacts(removed, facts).missing.includes(expected.id));

  const wrongWindow = header
    .replace(selected.startsAt, other.startsAt)
    .replace(selected.endsAt, other.endsAt);
  assert.ok(
    auditPromptFacts(text.replace(header, wrongWindow), facts).missing.includes(expected.id),
  );
  const wrongTime = header.replace(
    `返照时刻${solarReturn.dateTime}`,
    `返照时刻${other.evidence.dateTime}`,
  );
  assert.ok(auditPromptFacts(text.replace(header, wrongTime), facts).missing.includes(expected.id));
  const orphaned = text.replace(`${header}\n${body}`, body);
  assert.ok(orphaned.includes(relationText));
  assert.ok(auditPromptFacts(orphaned, facts).missing.includes(expected.id));

  const otherPeriodIndex = periods.indexOf(other);
  const otherAspectIndex = other.evidence.aspectFacts.findIndex(
    (item) =>
      item.movingPoint === aspect.movingPoint &&
      item.natalPoint === aspect.natalPoint &&
      item.aspectName === aspect.aspectName &&
      item.deviation.toFixed(2) === aspect.deviation.toFixed(2) &&
      item.closeness === aspect.closeness,
  );
  assert.ok(otherAspectIndex >= 0);
  const otherIdPrefix = `astrolabe.yearly.太阳返照.period.${otherPeriodIndex}`;
  const otherExpectedId = `${otherIdPrefix}.${otherAspectIndex}`;
  const otherHeaderIndex = lines.findIndex((line) =>
    line.startsWith(`太阳返照有效期${other.startsAt}至${other.endsAt}`),
  );
  assert.ok(otherHeaderIndex >= 0);
  const otherBody = lines[otherHeaderIndex + 1];
  assert.match(otherBody, /^太阳返照盘/u);
  const otherRemoved = auditPromptFacts(
    text.replace(otherBody, otherBody.replace(relationText, '')),
    facts,
  );
  assert.ok(otherRemoved.missing.includes(otherExpectedId));
  assert.ok(
    solarFacts.every((item) => !otherRemoved.missing.includes(item.id)),
    '参考盘保持完整',
  );
  const otherChartRemoved = auditPromptFacts(text.replace(otherBody, ''), facts);
  assert.ok(otherChartRemoved.missing.includes(`${otherIdPrefix}.time`));
  assert.ok(otherChartRemoved.missing.includes(otherExpectedId));
  assert.ok(solarFacts.every((item) => !otherChartRemoved.missing.includes(item.id)));

  const fallback = {
    ...context,
    solarReturnPeriods: undefined,
    secondaryProgressionEvidence: undefined,
    solarArcEvidence: undefined,
    promptText: `太阳返照（${solarReturn.dateTime}）。\n${solarReturn.returnChart.promptText}`,
  };
  const fallbackText = buildDivinationPrompt('astrolabe', '请分析单次返照。', first, undefined, {
    astrolabeScopeText: fallback.promptText,
    omitCurrentTime: true,
  });
  const fallbackFacts = extractAstrolabeFacts(first, fallback, {
    scope: { start: '【占卜信息】', end: '【任务】' },
    periodScope: { start: '【分析对象】', end: '【占卜信息】' },
  });
  assert.equal(
    fallbackFacts.filter((item) => item.id.includes('.太阳返照.')).length,
    solarReturn.aspectFacts.length + 1,
  );
  auditOriginal(fallbackText, fallbackFacts);
  const fallbackWrongTime = auditPromptFacts(
    fallbackText.replace(
      `太阳返照（${solarReturn.dateTime}）`,
      `太阳返照（${other.evidence.dateTime}）`,
    ),
    fallbackFacts,
  );
  assert.ok(fallbackWrongTime.missing.includes('astrolabe.yearly.太阳返照.time'));
  assert.ok(fallbackWrongTime.missing.includes(expected.id));
});
