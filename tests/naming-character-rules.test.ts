import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateChineseNames,
  selectNamingCharacters,
  selectChineseCharacters,
  buildChineseNamingPrompt,
} from 'mingyu-core/name-number';

test('偏好字与忌用字按字典繁简对应处理并以忌用字优先', () => {
  for (const [preferredCharacters, forbiddenCharacters] of [
    ['樂宁', '乐'],
    ['乐寧', '樂'],
  ]) {
    const pool = selectNamingCharacters({ preferredCharacters, forbiddenCharacters, limit: 100 });
    assert.equal(pool[0].char, '宁');
    assert.ok(pool.every((item) => item.simplified !== '乐' && item.traditional !== '樂'));
    const names = generateChineseNames({
      surname: '李',
      preferredCharacters,
      forbiddenCharacters,
      limit: 50,
    });
    assert.equal(names.length, 50);
    assert.ok(names.every((item) => !/[乐樂]/u.test(item.givenName)));
  }
  const pool = selectNamingCharacters({ preferredCharacters: '寧宁樂乐', limit: 100 });
  assert.deepEqual(
    pool.slice(0, 2).map((item) => item.char),
    ['宁', '乐'],
  );
  assert.equal(pool.length, new Set(pool.map((item) => item.simplified)).size);
});

test('给AI的用字条件与繁简回避规则一致', () => {
  const candidates = generateChineseNames({ surname: '李', forbiddenCharacters: '樂', limit: 2 });
  const prompt = buildChineseNamingPrompt({
    surname: '李',
    candidates,
    preferredCharacters: '乐清',
    forbiddenCharacters: '樂',
    suitableCharacters: selectNamingCharacters({ preferredCharacters: '乐清', limit: 2 }),
  });
  assert.match(prompt, /偏好字：清/);
  assert.match(prompt, /回避用字：乐（樂）/);
  const poolLine = prompt.split('\n').find((line) => line.startsWith('适配字池：'))!;
  assert.match(poolLine, /清/);
  assert.doesNotMatch(poolLine, /乐（/);
});

test('候选姓名明确返回实际命中的偏好字、辈分字与出生取用字', () => {
  const candidates = generateChineseNames({
    surname: '李',
    preferredCharacters: '清宁',
    generationCharacter: '宁',
    generationPosition: 'second',
    preferredElements: ['水'],
    limit: 4,
  });
  assert.equal(candidates.length, 4);
  for (const candidate of candidates) {
    assert.equal(candidate.selectionEvidence.generationCharacter, '宁');
    assert.equal(candidate.selectionEvidence.generationPosition, 'second');
    assert.equal([...candidate.givenName][1], '宁');
    assert.deepEqual(
      candidate.selectionEvidence.favorableElementCharacters,
      candidate.analysis.elementMatches,
    );
  }
  assert.ok(candidates.some((candidate) => candidate.selectionEvidence.preferredCharacters.length));

  const prompt = buildChineseNamingPrompt({
    surname: '李',
    candidates,
    preferredCharacters: '清宁',
    generationCharacter: '宁',
    generationPosition: 'second',
  });
  assert.match(prompt, /用字条件：.*辈分字宁位于名字末字/);
  assert.match(prompt, /使用偏好字/);
});

test('起名提示词保留可复算依据并避免用数理等级替代选字判断', () => {
  const candidates = generateChineseNames({
    surname: '李',
    preferredCharacters: '清宁',
    generationCharacter: '宁',
    generationPosition: 'second',
    preferredElements: ['水'],
    limit: 12,
  });
  const prompt = buildChineseNamingPrompt({
    surname: '李',
    candidates,
    preferredCharacters: '清宁',
    generationCharacter: '宁',
    generationPosition: 'second',
    suitableCharacters: selectNamingCharacters({
      preferredCharacters: '清宁',
      preferredElements: ['水'],
      limit: 24,
    }),
  });
  assert.match(prompt, /五格取数：天格\d+、人格\d+、地格\d+、外格\d+、总格\d+/);
  assert.match(prompt, /五格算式：天格\d+ \+ \d+ = \d+/);
  assert.match(prompt, /三才：[金木水火土]{3}；/);
  assert.doesNotMatch(prompt, /大吉|半吉|大凶|吉带凶|凶带吉/);
  assert.ok(prompt.length < 18_000, `提示词长度为 ${prompt.length}`);
});

test('辈分字保留所填字形且繁简冲突与同字重复都能识别', () => {
  for (const [generationCharacter, forbiddenCharacters] of [
    ['樂', '乐'],
    ['乐', '樂'],
  ]) {
    assert.throws(
      () => generateChineseNames({ surname: '李', generationCharacter, forbiddenCharacters }),
      /辈分字不能同时设为忌用字/,
    );
  }
  for (const generationPosition of ['first', 'second'] as const) {
    const names = generateChineseNames({
      surname: '李',
      generationCharacter: '樂',
      preferredCharacters: '乐清',
      generationPosition,
      limit: 30,
    });
    assert.equal(names.length, 30);
    assert.ok(
      names.every((item) => [...item.givenName][generationPosition === 'first' ? 0 : 1] === '樂'),
    );
    assert.ok(names.every((item) => item.givenName !== '樂乐' && item.givenName !== '乐樂'));
  }
});

test('拼音检索兼容声调和键盘输入并区分ü与u', () => {
  const chars = (pinyin: string) =>
    selectChineseCharacters({ pinyin, limit: 200 }).map((item) => item.char);
  for (const query of ['lǚ', 'lü', 'lv', ' LV3 ', 'lu:3']) {
    assert.ok(chars(query).includes('吕'), query);
    assert.deepEqual(chars(query), chars('lv'), query);
  }
  assert.ok(!chars('lu').includes('吕'));
  assert.ok(chars('lu').includes('路'));
  assert.deepEqual(chars('nǚ'), chars('nv3'));
  assert.deepEqual(chars('yuè'), chars('yue4'));
});
