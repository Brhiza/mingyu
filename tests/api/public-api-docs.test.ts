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

test('公开 API 文档和 skill 应覆盖五运六气与皇极经世的关键输入口径', () => {
  for (const content of [publicApiDocs, publicSkill]) {
    assert.match(content, /POST \/metaphysics\/wuyun-liuqi\/calculate/);
    assert.match(content, /POST \/metaphysics\/wuyun-liuqi\/prompt/);
    assert.match(content, /year.*yearGanZhi|yearGanZhi.*year/);
    assert.match(content, /天符.*岁会/);
    assert.match(content, /sourceReconciliation/);
    assert.match(content, /26 年|26年/);
    assert.match(content, /二十八年/);
    assert.match(content, /POST \/metaphysics\/huangji-jingshi\/calculate/);
    assert.match(content, /POST \/metaphysics\/huangji-jingshi\/prompt/);
    assert.match(content, /普通模式.*公元.*year|公元.*year.*普通模式/);
    assert.match(content, /值年卦/);
    assert.match(content, /1984 年鼎卦|1984年鼎卦/);
    assert.match(content, /epochYear/);
    assert.match(content, /year.*elapsedYears|elapsedYears.*year/);
    assert.match(content, /自定义纪元/);
  }
});

test('公开 API 文档和 skill 应说明统一多派合参与排盘口径边界', () => {
  for (const content of [publicApiDocs, publicSkill]) {
    assert.match(content, /`schools`/);
    assert.match(content, /规划内确有合理差异/);
    assert.match(content, /一至三个/);
    assert.match(content, /共同结论|共识/);
    assert.match(content, /ziping.*mangpai.*xinpai/);
    assert.match(content, /huozhulin.*bushizhengzong.*zengshanbuyi/);
    assert.match(content, /modern.*traditional.*timing/);
    assert.match(content, /yuanhui.*guaqi/);
    assert.match(content, /转盘.*飞盘.*实际(?:排)?盘/);
    assert.match(content, /三山国王灵签.*不附加派系.*不接受 `schools`/);
  }
});
