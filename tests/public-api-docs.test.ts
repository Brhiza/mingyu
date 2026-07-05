import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const publicApiDocs = readFileSync('docs/api.md', 'utf8');
const publicSkill = readFileSync('public/skills/aov-mingyu-api/SKILL.md', 'utf8');

test('公开 API 文档和 skill 应写明 AI 接口', () => {
  for (const content of [publicApiDocs, publicSkill]) {
    assert.match(content, /POST \/ai\/analyze/);
    assert.match(content, /POST \/ai\/models/);
    assert.match(content, /text\/event-stream/);
    assert.match(content, /aiConfig/);
  }
});

test('公开 API 文档和 skill 应覆盖完整塔罗牌阵参数', () => {
  for (const spreadType of [
    'single',
    'three',
    'love',
    'career',
    'decision',
    'celtic',
    'chakra',
    'year',
    'mindBodySpirit',
    'horseshoe',
  ]) {
    assert.match(publicApiDocs, new RegExp(spreadType));
    assert.match(publicSkill, new RegExp(spreadType));
  }
});
