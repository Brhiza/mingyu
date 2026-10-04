import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { generateResidentialFengshui } from '../packages/core/src/residential_fengshui/index.ts';
import { MetaphysicsPanel } from '../src/components/MetaphysicsPanel';

test('候选宅卦改变命宅关系时建议复测坐向而非补充已提供资料', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    birthYear: 1990,
    gender: 'male',
    doorToInteriorDegree: 64,
    northReference: 'magnetic',
    magneticDeclinationDegrees: 1,
    measurementUncertaintyDegrees: 3,
  });

  assert.equal(result.xuankong?.measurement?.stability, '山向边界敏感');
  assert.ok(result.bazhai && 'directionMeasurement' in result.bazhai);
  assert.deepEqual(
    result.bazhai.directionMeasurement.candidateDirections.map((item) => [
      item.label,
      item.houseGua,
      item.match,
    ]),
    [
      ['寅山申向', '艮', '相冲'],
      ['甲山庚向', '震', '相合'],
    ],
  );
  assert.ok(result.advice.some((item) => item.includes('复测坐向')));
  assert.ok(result.advice.every((item) => !item.includes('补山向或居住人信息')));
});

test('候选宅卦同属东四宅时证据仍标明中心宅卦及另一候选宅卦', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    mingGua: '坎',
    sitDegree: 112,
    northReference: 'true',
    measurementUncertaintyDegrees: 1,
  });

  assert.ok(result.bazhai && 'directionMeasurement' in result.bazhai);
  assert.equal(result.bazhai.directionMeasurement.stability, '宅卦不稳定');
  assert.deepEqual(
    result.bazhai.directionMeasurement.candidateDirections.map((item) => [
      item.houseGua,
      item.match,
    ]),
    [
      ['震', '相合'],
      ['巽', '相合'],
    ],
  );
  assert.match(result.evidencePromptText, /宅卦震（中心读数；候选震宅、巽宅），命宅关系相合/);
  assert.match(result.prompt, /候选坐向：乙山辛向（震宅、命宅相合）、辰山戌向（巽宅、命宅相合）/);
});

test('北向基准未声明时命宅与宅运只按原始读数暂列，已校正磁北可改变结论', () => {
  const input = {
    year: 2008,
    birthYear: 2000,
    birthMonth: 6,
    birthDay: 1,
    gender: 'male' as const,
    doorToInteriorDegree: 70,
  };
  const unspecified = generateResidentialFengshui(input);
  assert.equal(unspecified.inputSummary.northReferenceUnspecified, true);
  assert.equal(unspecified.bazhai?.mingGua, '离');
  assert.equal(unspecified.bazhai?.houseGua, '震');
  assert.equal(unspecified.bazhai?.match, '相合');
  assert.ok(unspecified.agreements.every((item) => item.level !== '一致关注'));
  assert.match(unspecified.agreements[0].detail, /暂按命宅关系相合/);
  assert.match(unspecified.advice.join('\n'), /暂按命宅关系相合/);
  assert.match(unspecified.advice.join('\n'), /核定坐向读数的北向基准/);
  assert.match(unspecified.bazhai?.matchAdvice ?? '', /按原始读数暂列/);
  assert.match(unspecified.prompt, /命宅配合：暂按相合/);
  assert.match(unspecified.prompt, /坐向北向基准未声明；玄空角度盘按原始读数暂排/);
  assert.match(unspecified.evidencePromptText, /暂按命宅关系相合/);

  const html = renderToStaticMarkup(
    createElement(MetaphysicsPanel, {
      method: 'residential',
      birthData: { year: 2000, month: 6, day: 1, gender: 'male' },
      initialHouseYear: '2008',
      initialFacingDegree: '70',
    }),
  );
  assert.match(html, /坐向按原始读数暂列，待核定北向基准。/);
  assert.match(html, /<span>命宅关系<\/span><strong>相合（暂按）<\/strong>/);

  const houseOnlyHtml = renderToStaticMarkup(
    createElement(MetaphysicsPanel, {
      method: 'residential',
      initialHouseYear: '2008',
      initialFacingDegree: '70',
    }),
  );
  assert.match(houseOnlyHtml, /坐向按原始读数暂列，待核定北向基准。/);
  assert.match(houseOnlyHtml, /<span>命宅关系<\/span><strong>仅宅运<\/strong>/);

  assert.throws(
    () => generateResidentialFengshui({ ...input, northReference: 'magnetic' }),
    /必须提供当地磁偏角/,
  );
  const magnetic = generateResidentialFengshui({
    ...input,
    northReference: 'magnetic',
    magneticDeclinationDegrees: -20,
  });
  assert.equal(magnetic.bazhai?.houseGua, '艮');
  assert.equal(magnetic.bazhai?.match, '相冲');
  assert.ok(magnetic.agreements.some((item) => item.level === '口径不同需分述'));
  assert.match(magnetic.prompt, /命宅配合：相冲/);

  const trueNorth = generateResidentialFengshui({ ...input, northReference: 'true' });
  assert.equal(trueNorth.inputSummary.northReferenceUnspecified, false);
  assert.ok(trueNorth.agreements.some((item) => item.level === '一致关注'));
  assert.match(trueNorth.prompt, /命宅配合：相合/);
});

test('住宅合参按实际边界区分候选山向与下卦替卦起法', () => {
  const centralNine = generateResidentialFengshui({
    year: 2025,
    mingGua: '坎',
    sitDegree: 4.5,
    northReference: 'true',
  });
  assert.deepEqual(centralNine.xuankong?.measurement?.boundaryReasons, ['中央九度分界']);
  assert.ok(centralNine.bazhai && 'directionMeasurement' in centralNine.bazhai);
  assert.equal(centralNine.bazhai.directionMeasurement.stability, '稳定');
  assert.ok(centralNine.agreements.some((item) => item.title === '下卦与替卦起法待核定'));
  assert.match(centralNine.advice.join('\n'), /核定下卦或替卦起法/);
  assert.doesNotMatch(
    centralNine.agreements.map((item) => item.detail).join('\n'),
    /候选山向与宅卦/,
  );

  const mountainOnly = generateResidentialFengshui({
    year: 2025,
    mingGua: '坎',
    sitDegree: 7,
    northReference: 'true',
    measurementUncertaintyDegrees: 1,
  });
  assert.deepEqual(mountainOnly.xuankong?.measurement?.boundaryReasons, ['二十四山分界']);
  assert.ok(mountainOnly.bazhai && 'directionMeasurement' in mountainOnly.bazhai);
  assert.equal(mountainOnly.bazhai.directionMeasurement.stability, '山向边界敏感');
  assert.ok(mountainOnly.agreements.some((item) => item.title === '山向边界仍敏感'));
  assert.match(mountainOnly.advice.join('\n'), /核定候选山向后/);
  assert.doesNotMatch(mountainOnly.advice.join('\n'), /核定候选山向与宅卦/);
});

test('测量范围同时触及山向与中央九度分界时合参列出两项待核定内容', () => {
  const result = generateResidentialFengshui({
    year: 2025,
    mingGua: '坎',
    sitDegree: 4.5,
    northReference: 'true',
    measurementUncertaintyDegrees: 3,
  });

  assert.deepEqual(result.xuankong?.measurement?.boundaryReasons, ['二十四山分界', '中央九度分界']);
  assert.ok(result.bazhai && 'directionMeasurement' in result.bazhai);
  assert.equal(result.bazhai.directionMeasurement.stability, '山向边界敏感');
  const boundary = result.agreements.find((item) => item.level === '资料不足');
  assert.equal(boundary?.title, '候选山向与下卦替卦起法待核定');
  assert.match(boundary?.detail ?? '', /候选山向已列出；同时触及中央九度分界/);
  assert.match(result.advice.join('\n'), /核定候选山向、下卦或替卦起法/);
  assert.doesNotMatch(result.advice.join('\n'), /核定候选山向与宅卦/);
});

test('交运首年只给年份时，宅运摘要与提示词保持暂排口径', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    mingGua: '坎',
    sitMountain: '子',
  });

  assert.equal(result.xuankong?.period.boundaryStatus, '待核定');
  assert.match(result.agreements[0].detail, /玄空见暂按下元9运/);
  assert.match(result.advice[0], /先看宅运：暂按下元9运/);
  assert.match(result.advice[0], /需按建造或起运日期核定运期/);
  assert.match(result.prompt, /运程：暂按下元9运/);
  assert.match(result.evidencePromptText, /暂按下元9运/);

  const settled = generateResidentialFengshui({ year: 2025, mingGua: '坎', sitMountain: '子' });
  assert.equal(settled.xuankong?.period.boundaryStatus, undefined);
  assert.doesNotMatch(settled.advice[0], /暂按|核定运期/);
});

test('立春同小时出生时刻不完整时，住宅合参不把命卦写成已核定', () => {
  const result = generateResidentialFengshui({
    year: 2024,
    birthYear: 2024,
    birthMonth: 2,
    birthDay: 4,
    birthHour: 16,
    gender: 'male',
    sitMountain: '子',
  });

  assert.equal(result.bazhai?.birthYearBoundaryStatus, '待复核');
  assert.match(result.agreements[0].detail, /八宅暂按命卦巽/);
  assert.match(result.advice[1], /暂按命卦巽/);
  assert.match(result.evidencePromptText, /暂按命卦巽/);
  assert.match(result.prompt, /候选命卦：2023年巽命、2024年震命/);
});

test('住宅合参按缺失的出生日期或秒数提出复核资料', () => {
  const onlyYear = generateResidentialFengshui({ birthYear: 1990, gender: 'male' });
  assert.equal(onlyYear.bazhai?.birthYearBoundaryStatus, '待复核');
  assert.match(onlyYear.advice.join(' '), /补充出生月日后复核/);
  assert.doesNotMatch(onlyYear.advice.join(' '), /补充准确出生时刻/);

  const birth = {
    birthYear: 2024,
    birthMonth: 2,
    birthDay: 4,
    birthHour: 16,
    birthMinute: 27,
    gender: 'male' as const,
  };
  const partial = generateResidentialFengshui(birth);
  const settled = generateResidentialFengshui({ ...birth, birthSecond: 8 });
  assert.match(partial.advice.join(' '), /补充出生秒数后复核/);
  assert.equal(settled.bazhai?.birthYearBoundaryStatus, '已核定');
  assert.equal(settled.bazhai?.calculationInput.birthSecond, 8);
  assert.doesNotMatch(settled.advice.join(' '), /补充出生秒数/);
});
