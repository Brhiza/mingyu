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
  assert.doesNotMatch(
    prompt,
    /本项目|当前项目|项目统一|本地|技术限制|未计算|资料包|提示词规则|系统提示词|在线\s*AI|工程|算法(?:结果|返回|生成|实际)|本模块|当前数据|实际返回|用户补充：/,
  );
  assert.doesNotMatch(prompt, /当前已写入|当前未写入|已写入|未写入/);
  assert.doesNotMatch(prompt, /用户(?:未|没有|选择|所选|已选|填写|提供|补充|问题)/);
  assert.doesNotMatch(prompt, /需要补充|请补充|再选择/);
  assert.doesNotMatch(prompt, /预设|模板|接口|API|MCP|调试/);
}

export function assertPromptIsPortableTaskText(prompt: string) {
  assertNoPromptPlaceholders(prompt);
  assertNoEngineeringPromptText(prompt);
  assert.doesNotMatch(prompt, /\*\*/);
}
