import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from 'mingyu-core/bazi';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import {
  appendClassicalReferences,
  buildBaziPromptDocument,
  buildDivinationPromptDocument,
  buildMetaphysicsPromptDocument,
  formatClassicalReferences,
  getClassicalReferences,
  supportsClassicalReferences,
} from 'mingyu-core/prompt';
import { buildBaziPromptForResult } from 'mingyu-core/prompt/public-api';

const currentTime = new Date('2026-10-09T12:00:00+08:00');
const chart = baziCalculator.calculateBazi({
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 5,
  gender: 'female',
});

test('经典依据默认关闭，关闭值与原完整任务书逐字一致', () => {
  const options = { result: chart, question: '工作安排如何推进？', currentTime };
  const baseline = buildBaziPromptDocument(options);
  assert.deepEqual(buildBaziPromptDocument({ ...options, includeClassics: false }), baseline);
  assert.doesNotMatch(baseline.text, /【经典依据】/u);
  assert.equal(appendClassicalReferences(baseline.text, 'bazi'), baseline.text);
});

test('八字完整任务书和兼容入口均可附入同一份少量经典依据', () => {
  const baseline = structuredClone(chart);
  const prompt = buildBaziPromptDocument({
    result: chart,
    question: '工作安排如何推进？',
    currentTime,
    includeClassics: true,
  });
  const section = formatClassicalReferences('bazi');
  assert.ok(section && prompt.text.includes(section));
  assert.equal(prompt.text, prompt.user);
  assert.ok(prompt.text.indexOf('【经典依据】') < prompt.text.indexOf('【任务】'));
  assert.ok(prompt.text.endsWith('【问题】\n工作安排如何推进？'));
  assert.ok(buildBaziPromptForResult({ result: chart, includeClassics: true }).includes(section));
  assert.deepEqual(chart, baseline);
});

test('按本次术数选取经典，重复包装不重复附入', () => {
  const base =
    '【盘面资料】\n体卦乾，用卦坤。\n\n【任务】\n解释体用关系。\n\n【问题】\n事情如何推进？';
  const prompt = appendClassicalReferences(base, 'meihua', true);
  assert.match(prompt, /【经典依据】/u);
  assert.match(prompt, /梅花易数/u);
  assert.doesNotMatch(prompt, /子平真诠|紫微斗数全书|太乙金镜/u);
  assert.equal(appendClassicalReferences(prompt, 'meihua', true), prompt);
  assert.equal(prompt.match(/【经典依据】/gu)?.length, 1);
});

test('经典规则转述附适用条件，出处元数据留在结构化资料', () => {
  for (const method of [
    'bazi',
    'ziwei',
    'bazi-ziwei',
    'liuyao',
    'meihua',
    'qimen',
    'liuren',
    'jinkoujue',
    'xiaoliuren',
    'almanac',
    'taiyi',
    'wuyun-liuqi',
    'huangji-jingshi',
    'bazhai',
    'xuankong',
    'residential',
    'qizheng',
  ]) {
    const references = getClassicalReferences(method);
    assert.ok(references.length > 0, `${method} 应有已核经典依据`);
    assert.ok(references.length <= 2, `${method} 每次至多两条`);
    assert.equal(new Set(references.map((item) => item.id)).size, references.length);
    for (const reference of references) {
      assert.equal(reference.textType, 'summary');
      assert.ok(reference.book && reference.chapter && reference.summary && reference.application);
      assert.equal(new URL(reference.sourceUrl).protocol, 'https:');
    }
    const section = formatClassicalReferences(method);
    assert.ok(section.length < 1500, `${method} 保持简短`);
    assert.match(section, /适用条件：/u);
    assert.doesNotMatch(
      section,
      /https?:|sourceUrl|textType|MCP|API|命语|仓库|待核|来源状态|禁止|不得/u,
    );
  }
});

test('返回的经典依据副本不影响后续调用', () => {
  const baseline = getClassicalReferences('bazi');
  const changed = getClassicalReferences('bazi');
  changed[0].summary = '调用方修改';
  changed.pop();
  assert.deepEqual(getClassicalReferences('bazi'), baseline);
});

test('合参只保留两个体系的适量依据，别名与原体系相同', () => {
  const combined = getClassicalReferences('bazi-ziwei');
  const baziIds = new Set(getClassicalReferences('bazi').map((item) => item.id));
  const ziweiIds = new Set(getClassicalReferences('ziwei').map((item) => item.id));
  assert.ok(combined.some((item) => baziIds.has(item.id)));
  assert.ok(combined.some((item) => ziweiIds.has(item.id)));
  assert.ok(combined.every((item) => baziIds.has(item.id) || ziweiIds.has(item.id)));
  for (const [alias, method] of [
    ['qimen-lifetime', 'qimen'],
    ['huangji', 'huangji-jingshi'],
    ['wuyun', 'wuyun-liuqi'],
  ]) {
    assert.deepEqual(getClassicalReferences(alias), getClassicalReferences(method));
  }
});

test('签谱和西方体系保持原提示词，未知与原型名称不返回经典', () => {
  const base = '签号：第1签\n签诗：本次签文';
  for (const method of [
    'ssgw',
    'zhuge',
    'kongming',
    'tarot',
    'lenormand',
    'astrolabe',
    'zodiac',
    '__proto__',
    'constructor',
    'unknown',
  ]) {
    assert.equal(supportsClassicalReferences(method), false);
    assert.deepEqual(getClassicalReferences(method), []);
    assert.equal(appendClassicalReferences(base, method, true), base);
  }
  assert.equal(appendClassicalReferences('', 'bazi', true), '');
});

test('通用起卦入口仅附入当前术数依据并保留盘面', () => {
  const data = generateMeihua(currentTime, { method: 'number', number: 123 });
  const options = { method: 'meihua' as const, data, currentTime, question: '事情如何推进？' };
  const base = buildDivinationPromptDocument(options);
  const prompt = buildDivinationPromptDocument({ ...options, includeClassics: true });
  assert.equal(prompt.text, appendClassicalReferences(base.text, 'meihua', true));
});

test('风水完整任务书开启与关闭经典依据均保持任务和盘面', () => {
  const base =
    '【任务】\n结合门主灶解释住宅。\n【盘面资料】\n坐北朝南。\n【传统依据】\n结合实际测量。';
  const options = { method: 'residential' as const, currentTime };
  const disabled = buildMetaphysicsPromptDocument(base, '住宅如何安排？', options);
  const enabled = buildMetaphysicsPromptDocument(base, '住宅如何安排？', {
    ...options,
    includeClassics: true,
  });
  assert.equal(enabled.text, appendClassicalReferences(disabled.text, 'residential', true));
});
