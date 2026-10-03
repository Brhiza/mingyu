import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  generateChineseNames,
  selectNamingCharacters,
  selectChineseCharacters,
  buildChineseNamingPrompt,
} from 'mingyu-core/name-number';

test('姓名提示词只要求本次资料支持的分析与方案', () => {
  const analysisPrompt = buildChineseNameAnalysisPrompt({
    analysis: analyzeChineseName({ fullName: '李清和' }),
  });
  assert.doesNotMatch(analysisPrompt, /【出生资料】|出生适配/);
  assert.match(analysisPrompt, /【输出要求】\n先给整体结论/);

  const candidates = generateChineseNames({ surname: '李', limit: 1 });
  assert.equal(candidates.length, 1);
  const namingPrompt = buildChineseNamingPrompt({ surname: '李', candidates });
  assert.doesNotMatch(namingPrompt, /【出生资料】|出生适配|不少于八个|首选名及两个备选名/);
  assert.match(namingPrompt, /已列出的三才五格依据/);
  assert.match(namingPrompt, /至多两个备选名/);
  assert.doesNotMatch(namingPrompt, /^回避用字：|^辈分字：/m);
  assert.doesNotMatch(namingPrompt, /五格取数：/);
  assert.match(
    namingPrompt,
    /五格算式：天格7 \+ 1 = 8；人格7 \+ 6 = 13；地格6 \+ 14 = 20；外格1 \+ 14 = 15；总格7 \+ 6 \+ 14 = 27/,
  );
});

test('偏好字保留原字形且忌用字按繁简对应优先处理', () => {
  for (const [preferredCharacters, forbiddenCharacters, firstPreferred] of [
    ['樂宁', '乐', '宁'],
    ['乐寧', '樂', '寧'],
  ]) {
    const pool = selectNamingCharacters({ preferredCharacters, forbiddenCharacters, limit: 100 });
    assert.equal(pool[0].char, firstPreferred);
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
    pool.slice(0, 4).map((item) => item.char),
    ['寧', '宁', '樂', '乐'],
  );
  assert.equal(pool.length, new Set(pool.map((item) => item.char)).size);
});

test('“髮”按简体键“发”参与候选偏好与回避', () => {
  const preferred = selectNamingCharacters({ preferredCharacters: '髮', limit: 100 });
  assert.ok(preferred.some((item) => item.simplified === '发'));

  const forbidden = selectNamingCharacters({ forbiddenCharacters: '髮', limit: 100 });
  assert.ok(forbidden.every((item) => item.simplified !== '发'));
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

test('候选姓名明确返回实际命中的偏好字、辈分字与选字五行字', () => {
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
  assert.ok(candidates.every((candidate) => candidate.analysis.birthContext === null));
  assert.match(prompt, /用字条件：使用偏好字清、宁；辈分字宁位于名字末字；选字五行相应字清/);
  assert.match(prompt, /辈分字：宁（名字末字）/);
  assert.doesNotMatch(prompt, /出生取用相应字|【出生资料】|^回避用字：/m);
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
  assert.doesNotMatch(prompt, /五格取数：/);
  assert.match(
    prompt,
    /五格算式：天格7 \+ 1 = 8；人格7 \+ 12 = 19；地格12 \+ 14 = 26；外格1 \+ 14 = 15；总格7 \+ 12 \+ 14 = 33/,
  );
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
  const lvChars = chars('lv');
  for (const query of ['lǚ', 'lü', 'lv', ' LV3 ', 'lu:3']) {
    const matched = chars(query);
    assert.ok(matched.includes('吕'), query);
    assert.deepEqual(matched, lvChars, query);
  }
  const luChars = chars('lu');
  assert.ok(!luChars.includes('吕'));
  assert.ok(luChars.includes('路'));
  assert.deepEqual(chars('nǚ'), chars('nv3'));
  assert.deepEqual(chars('yuè'), chars('yue4'));
});
