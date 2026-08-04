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
  expectedGuidance?: Record<string, string>,
  options: { requireTraditionalGuidance?: boolean } = {},
) {
  const requireTraditionalGuidance = options.requireTraditionalGuidance ?? true;
  assert.doesNotMatch(prompt, /^【角色】$/m, '角色设定不应使用【角色】标签');
  assert.doesNotMatch(prompt, /^【解读主线】$/m, '解读主线不应作为独立 section');
  assert.doesNotMatch(prompt, /^【输出结构】$/m, '输出结构不应作为独立 section');
  assert.doesNotMatch(prompt, /^【输出要求】$/m, '输出要求不应作为独立 section');
  assert.match(prompt, /^【当前时间】$/m, '任务书应包含【当前时间】');
  if (requireTraditionalGuidance) {
    assert.match(prompt, /^【传统依据】$/m, '任务书应包含【传统依据】');
    assert.ok(
      prompt.indexOf('【传统依据】') < prompt.indexOf('【当前时间】'),
      '【传统依据】应位于【当前时间】之前',
    );
  }
  if (
    findPromptSectionHeadingIndex(prompt, '【问题】') !== -1 &&
    findPromptSectionHeadingIndex(prompt, '【任务】') !== -1
  ) {
    assert.ok(
      findPromptSectionHeadingIndex(prompt, '【问题】') <
        findPromptSectionHeadingIndex(prompt, '【任务】'),
      '【问题】应位于【任务】之前',
    );
  }
  assert.doesNotMatch(
    prompt,
    /现实建议|风险提醒|掷筊|投筊|提示:|留意:|合参要点|宿界模型|只依据|只基于|给出行动建议|提供行动建议|输出行动建议/,
    '最终任务书不应包含行动建议、风险提醒或限制性措辞',
  );

  if (requireTraditionalGuidance && expectedGuidance?.tradition) {
    assert.match(
      prompt,
      new RegExp(
        `^【传统依据】\\n[\\s\\S]*${escapeRegExp(expectedGuidance.tradition.slice(0, 24))}`,
      ),
      '传统依据应包含对应方法的传统口径',
    );
  }
}

export function assertNoPromptPlaceholders(prompt: string) {
  assert.doesNotMatch(prompt, /\b(?:undefined|null|NaN)\b/);
}

export function assertNoEngineeringPromptText(prompt: string) {
  assert.doesNotMatch(
    prompt,
    /本项目|当前项目|项目(?:统一|明确)|本地算法|技术限制|未计算|资料包|提示词规则|系统提示词|在线\s*AI|工程|算法(?:结果|返回|生成|实际)|本模块|当前数据|实际返回|用户补充：|排盘口径|定盘口径|取样时间|推算口径|现代天文|公开天文|坐标口径|紫炁周期|日行|目标日期黄经|公共罗盘|tyme4ts|原生吉凶属性|吉神明细|黄历宜项命中|时辰宜项命中/,
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
  assert.doesNotMatch(
    prompt,
    /使用简体中文|简体中文输出|【输出要求】|现实建议|风险提醒|掷筊|投筊|提示:|留意:|合参要点|宿界模型|给出行动建议|提供行动建议|输出行动建议|行动清单/,
  );
}
