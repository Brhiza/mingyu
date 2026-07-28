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

export function assertPromptHasSingleRole(
  prompt: string,
  expectedGuidance?: {
    identity: string;
    analysis: string;
    tradition?: string;
    sources?: string;
    output: string;
  },
) {
  assert.doesNotMatch(prompt, /^【角色】$/m, '角色设定不应使用【角色】标签');
  assert.equal(prompt.match(/^【解读主线】$/gm)?.length ?? 0, 1, '解读主线应且只应出现一次');
  assert.equal(prompt.match(/^【输出结构】$/gm)?.length ?? 0, 1, '输出结构应且只应出现一次');
  if (expectedGuidance) {
    assert.match(prompt, new RegExp(`^${escapeRegExp(expectedGuidance.identity)}$`, 'm'));
    assert.match(
      prompt,
      new RegExp(`^【解读主线】\\n${escapeRegExp(expectedGuidance.analysis)}$`, 'm'),
    );
    assert.match(
      prompt,
      new RegExp(`^【输出结构】\\n${escapeRegExp(expectedGuidance.output)}$`, 'm'),
    );
    if (expectedGuidance.tradition) {
      assert.match(
        prompt,
        new RegExp(`^【传统判断规则】\\n${escapeRegExp(expectedGuidance.tradition)}$`, 'm'),
      );
    }
    if (expectedGuidance.sources) {
      assert.match(
        prompt,
        new RegExp(`^【传统依据】\\n${escapeRegExp(expectedGuidance.sources)}$`, 'm'),
      );
    }
  }
}

export function assertNoPromptPlaceholders(prompt: string) {
  assert.doesNotMatch(prompt, /\b(?:undefined|null|NaN)\b/);
}

export function assertNoEngineeringPromptText(prompt: string) {
  assert.doesNotMatch(
    prompt,
    /本项目|当前项目|项目(?:统一|明确)|本地|技术限制|未计算|资料包|提示词规则|系统提示词|在线\s*AI|工程|算法(?:结果|返回|生成|实际)|本模块|当前数据|实际返回|用户补充：/,
  );
  assert.doesNotMatch(prompt, /当前已写入|当前未写入|已写入|未写入/);
  assert.doesNotMatch(prompt, /用户(?:未|没有|选择|所选|已选|填写|提供|补充|问题)/);
  assert.doesNotMatch(prompt, /需要补充|请补充|再选择/);
  assert.doesNotMatch(prompt, /预设|模板|接口|API|MCP|调试/);
  assert.doesNotMatch(
    prompt,
    /若【问题】|如果【问题】|问题未限定|主题未明确|按通用[^。\n]*口径|本提示词/,
  );
}

export function assertPromptIsPortableTaskText(prompt: string) {
  assertNoPromptPlaceholders(prompt);
  assertNoEngineeringPromptText(prompt);
  assert.doesNotMatch(prompt, /\*\*/);
}
