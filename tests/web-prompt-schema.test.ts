import assert from 'node:assert/strict';
import test from 'node:test';
import { z } from 'zod';
import { inputSchemas } from '../src/schema';
import { promptFormSchema } from '../src/web-prompt-schema';

type Form = { properties: Record<string, { enum?: string[]; optionLabels?: Record<string, string>; description?: string }> };

test('网页提示词主题和子主题来自目录，切换主题时保留原值并明确提示', () => {
  const schema = (z.toJSONSchema(inputSchemas.tarot) as { properties: Record<string, unknown> }).properties.prompt;
  const original = structuredClone(schema);
  const career = promptFormSchema('tarot', schema, { topicId: 'career', subtopicId: 'workplace' }) as Form;
  assert.equal(career.properties.topicId.optionLabels?.career, '事业');
  assert.ok(career.properties.subtopicId.enum?.includes('workplace'));
  assert.equal(career.properties.subtopicId.optionLabels?.workplace, '职场发展');
  const changed = promptFormSchema('tarot', schema, { topicId: 'relationship', subtopicId: 'workplace' }) as Form;
  assert.ok(changed.properties.subtopicId.enum?.includes('workplace'));
  assert.match(changed.properties.subtopicId.optionLabels!.workplace, /不属于当前主题/);
  assert.equal(changed.properties.subtopicId.optionLabels?.marriage, '长期关系');
  const empty = promptFormSchema('tarot', schema, {}) as Form;
  assert.deepEqual(empty.properties.subtopicId.enum, []);
  assert.match(empty.properties.subtopicId.description!, /没有可选子主题/);
  assert.deepEqual(schema, original);
});

test('七政和只有固定主题的术数使用各自目录；不相关表单不改动', () => {
  for (const [method, topic, subtopic] of [['qizheng', 'career', ''], ['chinese-name', 'general', 'name-analysis']] as const) {
    const schema = (z.toJSONSchema(inputSchemas[method]) as { properties: Record<string, unknown> }).properties.prompt;
    const form = promptFormSchema(method, schema, { topicId: topic }) as Form;
    assert.ok(form.properties.topicId.enum?.includes(topic));
    if (subtopic) assert.ok(form.properties.subtopicId.enum?.includes(subtopic));
  }
  const baziSchema = (z.toJSONSchema(inputSchemas.bazi) as { properties: Record<string, unknown> }).properties.prompt;
  const baziForm = promptFormSchema('bazi', baziSchema, {}) as Form;
  assert.ok(baziForm.properties.schools.optionLabels?.ziping);
  const mingluSchema = (z.toJSONSchema(inputSchemas.minglu) as { properties: Record<string, unknown> }).properties.prompt;
  assert.deepEqual(promptFormSchema('minglu', mingluSchema, {}), mingluSchema);
});
