import assert from 'node:assert/strict';
import test from 'node:test';
import { handlePublicApiRequest } from '../../src/lib/public-api/handler';

async function callApi(path: string, input: Record<string, unknown>) {
  const response = await handlePublicApiRequest(
    new Request(`https://aov.cc/api/v1/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  const body = await response.json();
  assert.equal(response.status, 200, `${path}：${JSON.stringify(input)}`);
  assert.equal(body.ok, true, path);
  return body.data;
}

test('太乙公开计算和完整任务书采用原典定算及相应将参', async () => {
  const examples = [
    { input: { scope: 'year', year: 1977 }, bureau: 6, count: 32, general: 2, assistant: 6 },
    { input: { scope: 'year', year: 1998 }, bureau: 27, count: 24, general: 4, assistant: 2 },
    { input: { scope: 'year', year: 1956 }, bureau: 57, count: 1, general: 1, assistant: 3 },
    { input: { scope: 'year', year: 1957 }, bureau: 58, count: 37, general: 7, assistant: 1 },
    {
      input: { scope: 'hour', year: 2026, month: 6, day: 25, hour: 10, minute: 30 },
      bureau: 6,
      count: 30,
      general: 3,
      assistant: 9,
    },
    {
      input: { scope: 'hour', year: 2026, month: 6, day: 26, hour: 0, minute: 30 },
      bureau: 13,
      count: 13,
      general: 3,
      assistant: 9,
    },
    {
      input: { scope: 'hour', year: 2026, month: 6, day: 27, hour: 4, minute: 30 },
      bureau: 27,
      count: 16,
      general: 6,
      assistant: 8,
    },
    {
      input: { scope: 'hour', year: 2026, month: 6, day: 29, hour: 22, minute: 30 },
      bureau: 60,
      count: 23,
      general: 3,
      assistant: 9,
    },
  ];
  for (const example of examples) {
    const calculated = await callApi('metaphysics/taiyi/calculate', example.input);
    const prompted = await callApi('metaphysics/taiyi/prompt', {
      ...example.input,
      responseMode: 'full',
      question: '如何理解这一局？',
    });
    for (const result of [calculated, prompted.result]) {
      assert.equal(result.bureau, example.bureau);
      assert.equal(result.setCount, example.count);
      assert.equal(result.setGeneral, example.general);
      assert.equal(result.setAssistant, example.assistant);
    }
    assert.match(prompted.prompt, new RegExp(`定算 ${example.count}(?!\\d)`));
    assert.ok(prompted.prompt.includes(`定大将${example.general}宫`));
    assert.ok(prompted.prompt.includes(`定参将${example.assistant}宫`));
    assert.ok(prompted.prompt.includes('如何理解这一局？'));
  }
});

test('公开汉字、姓名和诸葛取数保留同一原字形的笔画事实', async () => {
  const examples = [
    ['钟', '鐘', 20, 20],
    ['鍾', '鍾', 17, 17],
    ['鐘', '鐘', 20, 20],
    ['复', '複', 15, 14],
    ['復', '復', 12, 12],
    ['複', '複', 15, 14],
    ['台', '台', 5, 5],
    ['檯', '檯', 18, 18],
    ['干', '干', 3, 3],
    ['乾', '乾', 11, 11],
    ['后', '后', 6, 6],
    ['後', '後', 9, 9],
    ['发', '發', 12, 12],
    ['發', '發', 12, 12],
    ['髮', '髮', 15, 15],
    ['于', '于', 3, 3],
    ['於', '於', 8, 8],
    ['准', '准', 10, 10],
    ['準', '準', 14, 13],
    ['斗', '斗', 4, 4],
    ['鬥', '鬥', 10, 10],
    ['余', '余', 7, 7],
    ['餘', '餘', 16, 15],
    ['里', '裏', 13, 13],
    ['裏', '裏', 13, 13],
    ['云', '雲', 12, 12],
    ['雲', '雲', 12, 12],
    ['叶', '葉', 15, 12],
    ['葉', '葉', 15, 12],
  ] as const;
  for (const [char, traditional, kangxiStrokes, traditionalStrokes] of examples) {
    const character = await callApi('character/analyze', { text: char });
    assert.deepEqual(character.unknownCharacters, [], char);
    assert.equal(character.characters[0].detail.traditional, traditional, char);
    assert.equal(character.characters[0].detail.kangxiStrokes, kangxiStrokes, char);
    assert.equal(character.characters[0].detail.traditionalStrokes, traditionalStrokes, char);
    const name = await callApi('name/analyze', { fullName: `李${char}` });
    assert.equal(name.chars[1].char, char);
    assert.equal(name.chars[1].traditional, traditional, char);
    assert.equal(name.chars[1].kangxiStrokes, kangxiStrokes, char);
    const prompted = await callApi('name/analyze/prompt', { fullName: `李${char}` });
    assert.equal(prompted.analysis.chars[1].kangxiStrokes, kangxiStrokes, char);
    assert.ok(prompted.prompt.includes(`${char}（康熙${kangxiStrokes}画`), char);
    const zhuge = await callApi('divination/zhuge', { text: char.repeat(3) });
    assert.deepEqual(zhuge.strokes, [kangxiStrokes, kangxiStrokes, kangxiStrokes], char);
  }
});

test('公开字符资料的明确原字形采用本字条目和义项', async () => {
  for (const example of [
    { char: '裏', section: '衣字部', definition: /衣|内|裡/u, unrelated: /里程|故里/u },
    { char: '雲', section: '雨字部', definition: /云|水汽/u, unrelated: /子曰诗云/u },
    { char: '葉', section: '艸字部', definition: /草木|叶片|叶子/u, unrelated: /协同|协和/u },
  ]) {
    const result = await callApi('character/analyze', { text: example.char });
    const detail = result.characters[0].detail;
    assert.match(detail.kangxiText, new RegExp(`【${example.section}】\\s*${example.char}`));
    assert.doesNotMatch(detail.kangxiText, /【(?:里|二|口)字部】/u);
    assert.match(detail.definition, example.definition);
    assert.doesNotMatch(detail.definition, example.unrelated);
  }
});
