import assert from 'node:assert/strict';

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function assertPromptCurrentTimeHasGanzhiCalendar(prompt: string) {
  const currentTimeSection = prompt.match(/^【当前时间】\n([\s\S]*?)(?=\n【)/m)?.[1] ?? '';

  assert.match(currentTimeSection, /^公历：\d{4}年\d{1,2}月\d{1,2}日 \d{1,2}时\d{1,2}分/m);
  assert.match(currentTimeSection, /^农历：.+[子丑寅卯辰巳午未申酉戌亥]时$/m);
  assert.match(currentTimeSection, /^干支历：.+年 .+月 .+日 .+时$/m);
  assert.match(currentTimeSection, /^当前节气：.+/m);
}

export function assertPromptSectionsInOrder(
  prompt: string,
  expectedSections: string[],
  options: { requireUnique?: boolean; requireBodyAfterHeading?: boolean } = {},
) {
  let lastIndex = -1;
  for (const section of expectedSections) {
    const escapedSection = escapeRegExp(section);
    if (options.requireUnique) {
      const headingMatches = prompt.match(new RegExp(`^${escapedSection}$`, 'gm')) ?? [];
      assert.equal(headingMatches.length, 1, `${section} 不应重复出现`);
    }

    const headingIndex = prompt.search(new RegExp(`^${escapedSection}$`, 'm'));
    assert.notEqual(headingIndex, -1, `缺少 section：${section}`);
    assert.ok(headingIndex > lastIndex, `${section} 顺序不正确`);

    if (options.requireBodyAfterHeading) {
      assert.match(prompt, new RegExp(`${escapedSection}\\n(?!\\n)`), `${section} 后应直接接正文`);
    }

    lastIndex = headingIndex;
  }
}

export function findPromptSectionHeadingIndex(prompt: string, section: string) {
  return prompt.search(new RegExp(`^${escapeRegExp(section)}$`, 'm'));
}

export function assertNoPromptPlaceholders(prompt: string) {
  assert.doesNotMatch(prompt, /\b(?:undefined|null|NaN)\b/);
}

export function assertNoEngineeringPromptText(prompt: string) {
  assert.doesNotMatch(prompt, /当前项目|本地算法|技术限制|未计算|资料包|提示词规则/);
  assert.doesNotMatch(prompt, /当前已写入|当前未写入|未写入/);
}

export function assertPromptIsPortableTaskText(prompt: string) {
  assertNoPromptPlaceholders(prompt);
  assertNoEngineeringPromptText(prompt);
  assert.doesNotMatch(prompt, /\*\*/);
}
