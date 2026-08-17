import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const llmsTxtPath = 'public/llms.txt';
const llmsTxt = readFileSync(llmsTxtPath, 'utf8');

test('llms.txt 应作为站点根路径静态文件发布', () => {
  assert.ok(statSync(llmsTxtPath).isFile());
  assert.match(llmsTxt, /^# 命语（Mingyu）/m);
  assert.match(llmsTxt, /https:\/\/aov\.cc\/api\/v1\/manifest/);
  assert.match(llmsTxt, /https:\/\/aov\.cc\/api\/v1\/openapi\.json/);
  assert.match(llmsTxt, /https:\/\/aov\.cc\/skills\/aov-mingyu-api\/SKILL\.md/);
  assert.match(llmsTxt, /https:\/\/www\.npmjs\.com\/package\/mingyu-core/);
  assert.doesNotMatch(llmsTxt, /localhost|127\.0\.0\.1|\.dev\.vars|API_KEY/);
});
