import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMetaphysicsPrompt } from '@core/prompt';
import { getZodiacYearFortune } from '@core/zodiac';
import { formatPromptCurrentTime } from '../packages/core/src/prompt/current-time';

test('生肖同盘在不同提问时点保留相同参与资料，同支只算一种成员', () => {
  const base = getZodiacYearFortune('午', '丙午').prompt;
  assert.match(base, /本次地支组合为午，共1种不同地支/);
  const prompts = ['2026-05-19T10:30:00+08:00', '2026-12-19T20:30:00+08:00'].map((time) => {
    const currentTime = new Date(time);
    const prompt = buildMetaphysicsPrompt(base, '请解读2026年的生肖关系。', {
      method: 'zodiac',
      currentTime,
    });
    assert.ok(prompt.includes(base));
    assert.ok(prompt.includes(formatPromptCurrentTime(currentTime)));
    assert.match(prompt, /时间身份：本节为提问时点的历法背景/);
    return prompt;
  });
  assert.notEqual(prompts[0], prompts[1]);
  assert.equal(
    prompts[0].replace(/【当前时间】[\s\S]*?(?=【任务】)/, ''),
    prompts[1].replace(/【当前时间】[\s\S]*?(?=【任务】)/, ''),
  );
  assert.match(getZodiacYearFortune('寅', '丙午').prompt, /本次地支组合为寅、午，共2种不同地支/);
});

test('生肖时间身份说明按方法生效，其他元学入口保留既有当前时间正文', () => {
  const currentTime = new Date('2026-05-19T10:30:00+08:00');
  for (const method of ['bazhai', 'residential', 'taiyi', 'qizheng', 'xuankong'] as const) {
    const prompt = buildMetaphysicsPrompt('【排盘资料】\n测试盘面', '请解读。', {
      method,
      currentTime,
    });
    assert.ok(prompt.includes(`【当前时间】\n${formatPromptCurrentTime(currentTime)}`));
    assert.doesNotMatch(prompt, /时间身份：本节为提问时点/);
  }
});
