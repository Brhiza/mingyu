import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuren } from '../packages/core/src/divination/algorithms/liuren';
import { buildLiurenTemplateText } from '../packages/core/src/divination/engine/liuren-template';
import { buildLiuyaoTemplateText } from '../packages/core/src/divination/engine/liuyao-template';
import { drawTarotSpread } from '../packages/core/src/divination/tarot';
import { buildTarotSpreadTask } from '../packages/core/src/prompt/tarot-spread';

const fixtureDate = new Date('2026-05-19T10:30:00+08:00');

test('六爻主题模板应给出候选取用与盘面核对维度', () => {
  assert.equal(buildLiuyaoTemplateText('general'), '通用');

  const relationship = buildLiuyaoTemplateText('ganqing');
  assert.match(relationship, /世爻.*应爻.*关系候选/);
  assert.match(relationship, /妻财、官鬼/);
  assert.match(relationship, /爻位、动静、旺衰、空破/);

  const career = buildLiuyaoTemplateText('shiye');
  assert.match(career, /官鬼.*职位或约束候选/);
  assert.match(career, /父母.*文书或制度候选/);
  assert.match(career, /实际爻位/);

  const wealth = buildLiuyaoTemplateText('caifu');
  assert.match(wealth, /妻财.*财物或收益候选/);
  assert.match(wealth, /兄弟.*分夺或支出候选/);

  const anomaly = buildLiuyaoTemplateText('guaishen');
  assert.match(anomaly, /现实主体/);
  assert.match(anomaly, /环境、身心与现实线索/);
  assert.doesNotMatch(`${relationship}${career}${wealth}${anomaly}`, /undefined|null/);
});

test('大六壬主题模板应把候选类神与实际课传条件并列核对', () => {
  const data = generateLiuren(fixtureDate);
  const text = buildLiurenTemplateText('shiye', data);

  assert.match(text, /类神：事业看贵人、朱雀、青龙/);
  assert.match(text, /候选角色核对：先按问题确认求测者、岗位或事务对象/);
  assert.match(text, /贵人：天地盘/);
  assert.match(text, /实际位置及乘支旺衰、空亡/);
  assert.match(text, /三传命中/);
  assert.doesNotMatch(text, /undefined|null/);
});

test('塔罗任务应把牌位条件与逐张事实核对写入解读主线', () => {
  const single = buildTarotSpreadTask(drawTarotSpread('single', { seed: 'template-single' }));
  assert.match(single, /唯一牌位、牌名、正逆位、关键词与牌面象征/);
  assert.doesNotMatch(single, /相邻牌|牌序组合|牌位联动/);

  const three = buildTarotSpreadTask(drawTarotSpread('three', { seed: 'template-three' }));
  assert.match(three, /事实核对：逐张对应牌位、牌名、正逆位、关键词、元素与牌阶主题/);
  assert.match(three, /现实核对：联系问题中可观察的信息/);
  assert.match(three, /解读主线：/);
  assert.doesNotMatch(three, /undefined|null/);
});
