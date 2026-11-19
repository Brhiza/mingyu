import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { calculate, reprompt } from '../src/core';
import { getPromptCatalog } from '../src/catalog';
import { inputSchemas, methodIds } from '../src/schema';
import { methodExamples } from '../scripts/method-examples.mjs';

test('所有已发布子主题都能生成对应提示词、保存并追问', async () => {
  const catalog = getPromptCatalog(methodIds) as Record<string, { subtopics?: Record<string, Array<{ id: string; label: string }>> }>;
  let covered = 0;
  for (const method of methodIds) {
    const fields = (z.toJSONSchema(inputSchemas[method]) as any).properties?.prompt?.properties;
    if (!fields?.subtopicId) continue;
    const groups = catalog[method].subtopics;
    assert.ok(groups && Object.keys(groups).length > 0, `${method} 缺少子主题目录`);
    for (const [topicId, subtopics] of Object.entries(groups)) for (const subtopic of subtopics) {
      const input = { ...methodExamples[method], currentTime: '2026-06-15T04:00:00Z', prompt: { topicId, subtopicId: subtopic.id } };
      const saved = JSON.parse(JSON.stringify(await calculate(method, input)));
      assert.ok(saved.prompt.text.includes(subtopic.label), `${method}/${topicId}/${subtopic.id}`);
      const next = await reprompt({ method, result: saved, question: input.question, currentTime: input.currentTime });
      assert.ok(next.prompt.text === saved.prompt.text, `${method}/${topicId}/${subtopic.id} 追问丢失子主题`);
      covered++;
    }
    const mismatched = Object.entries(groups).find(([topic, entries]) => topic !== 'general' && entries.length > 0);
    if (mismatched) {
      await assert.rejects(() => calculate(method, { ...methodExamples[method], prompt: { topicId: 'general', subtopicId: mismatched[1][0].id } }), undefined, method);
    }
  }
  assert.ok(covered >= 264, `子主题覆盖下降：${covered}`);
});

test('每个公开流派及经典选项都能改变提示词并在追问时保留', async () => {
  let covered = 0;
  for (const method of methodIds) {
    const fields = (z.toJSONSchema(inputSchemas[method]) as any).properties?.prompt?.properties;
    if (!fields) continue;
    const choices: Array<{ schools?: string[]; includeClassics?: boolean }> = (fields.schools?.items?.enum ?? []).map((school: string) => ({ schools: [school] }));
    if (fields.includeClassics) choices.push({ includeClassics: true });
    for (const prompt of choices) {
      const input = { ...methodExamples[method], currentTime: '2026-06-15T04:00:00Z', prompt };
      const saved = JSON.parse(JSON.stringify(await calculate(method, input)));
      const follow = await reprompt({ method, result: saved, question: input.question, currentTime: input.currentTime });
      const reset = await reprompt({ method, result: saved, question: input.question, currentTime: input.currentTime, prompt: {} });
      assert.ok(follow.prompt.text === saved.prompt.text, `${method}/${JSON.stringify(prompt)} 未沿用`);
      assert.ok(reset.prompt.text !== saved.prompt.text, `${method}/${JSON.stringify(prompt)} 未改变提示词`);
      covered++;
    }
  }
  assert.ok(covered >= 72, `流派及经典选项覆盖下降：${covered}`);
});
