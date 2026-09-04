import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeNumber, buildNumberEnergyPrompt } from '../packages/core/src/name-number/index.ts';

test('全角数字字母与半角输入产生相同磁场', () => {
  const fullWidth = analyzeNumber(' 粤ｂ·１２３４５ ', 'plate');
  const halfWidth = analyzeNumber('粤B·12345', 'plate');
  assert.equal(fullWidth.normalized, halfWidth.normalized);
  assert.equal(fullWidth.energySequence, halfWidth.energySequence);
  assert.deepEqual(fullWidth.energyPairs, halfWidth.energyPairs);
  assert.equal(analyzeNumber('ａｚ').energySequence, '126');
});

test('提示词完整保留首尾及仅含0和5的序列位置', () => {
  const analysis = analyzeNumber('0135');
  assert.equal(analysis.energyPairs.length, 1);
  const prompt = buildNumberEnergyPrompt({ analysis });
  assert.match(prompt, /第1位：0；头部/);
  assert.match(prompt, /第4位：5；尾部/);
  assert.doesNotMatch(prompt, /0（隐藏）|5（增强）/);
  const modifiersOnly = buildNumberEnergyPrompt({ analysis: analyzeNumber('０５０') });
  assert.match(modifiersOnly, /第2位：5；独立/);
  assert.doesNotMatch(modifiersOnly, /0（隐藏）|5（增强）/);
  assert.match(modifiersOnly, /不足以形成八星磁场组合/);
});

test('字母内部与跨字符磁场均能追溯展开位置', () => {
  const result = analyzeNumber('粤Ｚ·１０５Ａ', 'plate');
  assert.equal(result.alphanumeric, 'Z105A');
  assert.equal(result.energySequence, '261051');
  assert.deepEqual(result.excludedCharacters, ['粤']);
  assert.deepEqual(
    result.energyPairs.map(({ pair, span, sourceText, sourceStart, sourceEnd, start, end }) => [
      pair,
      span,
      sourceText,
      sourceStart,
      sourceEnd,
      start,
      end,
    ]),
    [
      ['26', '26', 'Z', 0, 0, 0, 1],
      ['61', '61', 'Z1', 0, 1, 1, 2],
      ['11', '1051', '105A', 1, 4, 2, 5],
    ],
  );
  const prompt = buildNumberEnergyPrompt({ analysis: result });
  assert.match(prompt, /能量序列第3—6位，对应数字字母第2—5位「105A」/);
  assert.match(prompt, /号码标记：粤/);
});

test('连续磁场保留重叠位置与分段次数并向AI交代解读口径', () => {
  const analysis = analyzeNumber('13114');
  assert.deepEqual(
    analysis.magneticSegments.map(({ name, span, pairCount, start, end }) => [
      name,
      span,
      pairCount,
      start,
      end,
    ]),
    [
      ['天医', '131', 2, 0, 2],
      ['伏位', '11', 1, 2, 3],
      ['生气', '14', 1, 3, 4],
    ],
  );
  const prompt = buildNumberEnergyPrompt({ analysis });
  assert.match(prompt, /天医（131，2组，能量序列第1—3位） → 伏位（11，1组，能量序列第3—4位）/);
  assert.match(prompt, /相邻组合共享连接处的数字/);
  assert.match(prompt, /统计频次与现实影响程度分别讨论/);
});

test('相同号码的提示词按实际用途提供不同解读任务而保持磁场计算一致', () => {
  const phone = analyzeNumber('A1314', 'phone');
  const plate = analyzeNumber('A1314', 'plate');
  const general = analyzeNumber('A1314', 'general');
  assert.deepEqual(phone.energyPairs, plate.energyPairs);
  assert.deepEqual(phone.energyPairs, general.energyPairs);
  const phonePrompt = buildNumberEnergyPrompt({ analysis: phone });
  const platePrompt = buildNumberEnergyPrompt({ analysis: plate });
  const generalPrompt = buildNumberEnergyPrompt({ analysis: general });
  assert.match(phonePrompt, /日常联络、工作沟通、关系维护/);
  assert.doesNotMatch(phonePrompt, /驾驶安全以/);
  assert.match(platePrompt, /驾驶安全以交通规则、车辆状况和驾驶行为/);
  assert.doesNotMatch(platePrompt, /手机号结合日常联络/);
  assert.match(generalPrompt, /用途未明时先给通用象意/);
});

test('0和5只关联两端有效数字构成的组合并区分头尾与独立位置', () => {
  const analysis = analyzeNumber('0501053050');
  assert.deepEqual(
    analysis.modifiers.map((item) => item.placement),
    ['头部', '头部', '头部', '组内', '组内', '尾部', '尾部', '尾部'],
  );
  for (const modifier of analysis.modifiers) {
    if (modifier.placement === '组内') {
      assert.deepEqual(modifier.relatedPair, {
        pair: '13',
        span: '1053',
        name: '天医',
        start: 3,
        end: 6,
      });
      assert.match(modifier.meaning, /1053 取 13，对应天医/);
    } else {
      assert.equal(modifier.relatedPair, null);
      assert.match(modifier.meaning, /两端有效数字不足/);
    }
  }
  assert.ok(
    analyzeNumber('050').modifiers.every(
      (item) => item.placement === '独立' && item.relatedPair === null,
    ),
  );
  assert.ok(analyzeNumber('0150').modifiers.every((item) => item.relatedPair === null));
  const letter = analyzeNumber('1E3').modifiers[0];
  assert.equal(letter.placement, '组内');
  assert.equal(letter.relatedPair?.span, '153');
  const prompt = buildNumberEnergyPrompt({ analysis });
  assert.match(prompt, /组内，1053 取 13，对应天医/);
  assert.match(prompt, /头部.*两端有效数字不足/);
  assert.doesNotMatch(prompt, /relatedPair|placement|undefined/);
});

test('非英文字母不会经大写转换悄悄变成有效号码', () => {
  assert.throws(() => analyzeNumber('ß'), /数字或英文字母/);
  const result = analyzeNumber('aß13');
  assert.equal(result.alphanumeric, 'A13');
  assert.deepEqual(result.excludedCharacters, ['ß']);
  assert.match(analyzeNumber('AZ').formula, /字母序号相加/);
});

test('磁场顺序仅合并连续同类组合并保留跨度', () => {
  const analysis = analyzeNumber('13131');
  assert.deepEqual(analysis.magneticSegments, [
    {
      name: '天医',
      nature: '助益',
      start: 0,
      end: 4,
      pairCount: 4,
      span: '13131',
    },
  ]);
  const separated = analyzeNumber('131131');
  assert.deepEqual(
    separated.magneticSegments.map((item) => [item.name, item.pairCount]),
    [
      ['天医', 2],
      ['伏位', 1],
      ['天医', 2],
    ],
  );
  assert.equal(
    separated.magneticSegments.reduce((sum, item) => sum + item.pairCount, 0),
    separated.energyPairs.length,
  );
  assert.equal(analyzeNumber('050').magneticSegments.length, 0);
  assert.equal(analyzeNumber('105313').magneticSegments[0].span, '105313');
  assert.match(buildNumberEnergyPrompt({ analysis }), /天医（13131，4组，能量序列第1—5位）/);
});
