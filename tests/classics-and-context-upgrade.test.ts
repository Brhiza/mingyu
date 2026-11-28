import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import {
  ensureYilinLoaded,
  getBaziQiongtongAdvice,
  selectBaziClassics,
  selectLiuyaoClassics,
  selectQimenClassics,
  selectYilinClassic,
} from '../src/systems/classics';
import { ensureZhouyiLoaded } from '../src/systems/zhouyi-text';
import { parseQuestionContext } from '../src/systems/question-context';
import { buildMethodSituationDigest } from '../src/systems/situation-digest';
import { resolveFocusPresetsForContext } from '../src/systems/focus-presets';
import { applyGlobalRulesToPayload, DEFAULT_GLOBAL_RULES } from '../src/web-settings';

const now = '2026-06-15T04:00:00Z';

test('奇门十干克应支持紧凑双字干组合并命中对应克应条文', () => {
  const excerpts = selectQimenClassics({ stemPairs: ['戊丙', '丙戊'] });
  const joined = excerpts.map((e) => `${e.book}:${e.title}:${e.quote}:${e.explanation ?? ''}`).join('\n');
  assert.match(joined, /青龙返首|飞鸟跌穴/);
});

test('六爻经典检索按动爻化象与《黄金策》分类精准匹配，不再全量倾倒', async () => {
  await Promise.all([ensureZhouyiLoaded(), ensureYilinLoaded()]);
  const excerpts = selectLiuyaoClassics({
    category: 'marriage',
    changeTypes: ['化进神'],
    isSixClash: true,
    hasFuShen: true,
  });
  const joined = excerpts.map((e) => `${e.book}:${e.title}:${e.quote}:${e.explanation ?? ''}`).join('\n');
  assert.match(joined, /婚姻篇/);
  assert.match(joined, /动化进神/);
  assert.doesNotMatch(joined, /动化退神|回头克/);
  assert.match(joined, /六冲卦/);
  assert.match(joined, /飞伏神藏透/);
});

test('八字古籍覆盖 120 格《穷通宝鉴》与从格/专旺格', () => {
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const branches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  for (const stem of stems) {
    for (const branch of branches) {
      const entry = getBaziQiongtongAdvice(stem, branch);
      assert.ok(entry, `缺失穷通宝鉴条目: ${stem}日主 ${branch}月`);
      assert.ok(entry.verse.length > 0 && entry.advice.length > 5);
    }
  }
  const baziClassics = selectBaziClassics('甲', '从财格', '子');
  const joined = baziClassics.map((e) => `${e.book}:${e.title}:${e.quote}:${e.explanation ?? ''}`).join('\n');
  assert.match(joined, /滴天髓/);
  assert.match(joined, /穷通宝鉴/);
  assert.match(joined, /从财格/);
});

test('《焦氏易林》附带通俗吉凶导读', async () => {
  await ensureYilinLoaded();
  const excerpt = selectYilinClassic({ baseHexagram: '乾', targetHexagram: '坤' });
  assert.ok(excerpt);
  assert.equal(excerpt.book, '焦氏易林');
  assert.match(excerpt.explanation ?? '', /林辞/);
});

test('求测背景上下文自动接入六爻用神、六壬金口诀本命行年、奇门事项用神与八字梅花局势要点', async () => {
  const composed = '我和伴侣最近沟通紧张，后续感情走向如何？\n【求测背景】性别：男｜出生年：1995年｜所问对象：伴侣对象｜当前处境：已婚｜关注周期：3个月内';
  const parsed = parseQuestionContext(composed);
  assert.equal(parsed.gender, '男');
  assert.equal(parsed.birthYear, 1995);
  assert.equal(parsed.liuyaoCategory, 'marriage');

  // 1. 六爻：自动锁定妻财用神并保留 reprompt 一致性
  const liuyaoRes: any = await calculate('liuyao', {
    question: composed,
    currentTime: now,
    liuyao: { method: 'manual', yaos: [7, 8, 9, 7, 8, 7] },
    prompt: { includeClassics: true },
  });
  assert.match(liuyaoRes.prompt.text, /【局势要点】/);
  assert.match(liuyaoRes.prompt.text, /妻财/);
  assert.equal(liuyaoRes.data.evidenceAnalysis?.topic, 'ganqing');
  assert.equal(liuyaoRes.data.evidenceAnalysis?.candidates?.[0]?.relative, '妻财');
  const liuyaoFollow = await reprompt({
    method: 'liuyao',
    result: liuyaoRes,
    question: composed,
    currentTime: now,
  });
  assert.equal(liuyaoFollow.prompt.text, liuyaoRes.prompt.text);

  // 2. 大六壬 & 金口诀：注入本命与行年落宫
  const liurenRes: any = await calculate('liuren', {
    question: composed,
    currentTime: now,
    prompt: { includeClassics: true },
  });
  assert.match(liurenRes.prompt.text, /【本命与行年】/);
  assert.match(liurenRes.prompt.text, /乙亥/);
  assert.match(liurenRes.prompt.text, /【局势要点】/);

  const jkjRes: any = await calculate('jinkoujue', {
    question: composed,
    currentTime: now,
    prompt: { includeClassics: true },
  });
  assert.match(jkjRes.prompt.text, /【本命与行年】/);
  assert.match(jkjRes.prompt.text, /乙亥/);

  // 3. 奇门遁甲：注入婚姻/伴侣用神落宫（六合/乙/庚）
  const qimenRes: any = await calculate('qimen', {
    question: composed,
    currentTime: now,
    prompt: { includeClassics: true },
  });
  assert.match(qimenRes.prompt.text, /【事项用神落宫】/);
  assert.match(qimenRes.prompt.text, /六合|乙|庚/);
  assert.match(qimenRes.prompt.text, /【局势要点】/);

  // 4. 梅花易数 & 八字：局势要点摘要与白话报告速览
  const meihuaRes: any = await calculate('meihua', {
    question: composed,
    currentTime: now,
    meihua: { method: 'number', number: 258 },
    prompt: { includeClassics: true },
  });
  assert.match(meihuaRes.prompt.text, /【局势要点】/);
  assert.ok(buildMethodSituationDigest('meihua', meihuaRes.data, composed).length >= 2);

  const baziRes: any = await calculate('bazi', {
    question: composed,
    currentTime: now,
    birth: {
      year: 1995,
      month: 5,
      day: 15,
      clock: { kind: 'exact', hour: 10, minute: 30, second: 0 },
      timezone: 8,
    },
    gender: 'male',
    prompt: { includeClassics: true },
  });
  assert.match(baziRes.prompt.text, /【局势要点】/);
  assert.match(baziRes.prompt.text, /穷通宝鉴/);
  assert.ok(buildMethodSituationDigest('bazi', baziRes.data, composed).length >= 2);
});

test('全局规则默认开启附经典依据且不会误注入不支持 classics 的方法', () => {
  assert.equal(DEFAULT_GLOBAL_RULES.prompt.includeClassics, true);
  const liuyaoPayload = applyGlobalRulesToPayload('liuyao', { question: '测试' }, true) as any;
  assert.equal(liuyaoPayload.prompt?.includeClassics, true);

  const randomPayload = applyGlobalRulesToPayload('random-divination', { question: '测试' }, true) as any;
  assert.equal(randomPayload.prompt, undefined);

  const ziweiWithoutClassicsFlag = applyGlobalRulesToPayload('ziwei', { question: '测试' }, false) as any;
  assert.equal(ziweiWithoutClassicsFlag.prompt, undefined);
});

test('分板块分析侧重点按合盘/命盘/占卜/牌卡/择吉/风水各自独立定制', () => {
  const compatPresets = resolveFocusPresetsForContext('compatibility', 'bazi-synastry');
  assert.ok(compatPresets.some((p) => p.label === '合婚配对' && p.relationship === 'marriage'));
  assert.ok(compatPresets.some((p) => p.label === '合伙创业' && p.relationship === 'career'));
  assert.ok(!compatPresets.some((p) => p.label === '用神开运'));

  const liuyaoPresets = resolveFocusPresetsForContext('divination', 'liuyao');
  assert.ok(liuyaoPresets.some((p) => p.label === '综合断事'));
  assert.ok(liuyaoPresets.some((p) => p.label === '应期与行动'));

  const tarotPresets = resolveFocusPresetsForContext('divination', 'tarot');
  assert.ok(tarotPresets.some((p) => p.label === '对方心意'));

  const almanacPresets = resolveFocusPresetsForContext('divination', 'almanac');
  assert.ok(almanacPresets.some((p) => p.label === '嫁娶合婚'));

  const resiPresets = resolveFocusPresetsForContext('divination', 'residential');
  assert.ok(resiPresets.some((p) => p.label === '财位与办公'));
});

test('双人合盘（八字/紫微/西洋星盘）按合婚与合伙场景区分任务、经典要点并生成局势要点速览', async () => {
  const person1Base = {
    year: 1995,
    month: 5,
    day: 15,
    clock: { kind: 'exact' as const, hour: 10, minute: 30, second: 0 },
    timezone: 8,
  };
  const person2Base = {
    year: 1996,
    month: 8,
    day: 20,
    clock: { kind: 'exact' as const, hour: 14, minute: 0, second: 0 },
    timezone: 8,
  };
  const person1Astro = { year: 1995, month: 5, day: 15, hour: 10, minute: 30, timezone: 8, latitude: 39.9, longitude: 116.4 };
  const person2Astro = { year: 1996, month: 8, day: 20, hour: 14, minute: 0, timezone: 8, latitude: 31.23, longitude: 121.47 };

  // 八字合婚 vs 八字合伙
  const baziMarriage: any = await calculate('bazi-synastry', {
    question: '请看两人合婚契合度',
    person1: { name: '张三', gender: 'male', ...person1Base },
    person2: { name: '李四', gender: 'female', ...person2Base },
    relationship: 'marriage',
    prompt: { includeClassics: true },
  });
  assert.match(baziMarriage.prompt.text, /【局势要点】/);
  assert.match(baziMarriage.prompt.text, /【婚恋任务】/);
  assert.match(baziMarriage.prompt.text, /三命通会.*夫妻宫|渊海子平/);
  assert.match(baziMarriage.prompt.text, /穷通宝鉴/);
  assert.ok(buildMethodSituationDigest('bazi-synastry', baziMarriage.data, '请看两人合婚契合度').length >= 2);

  const baziCareer: any = await calculate('bazi-synastry', {
    question: '计划共同合伙创业',
    person1: { name: '张三', gender: 'male', ...person1Base },
    person2: { name: '李四', gender: 'female', ...person2Base },
    relationship: 'career',
    prompt: { includeClassics: true },
  });
  assert.match(baziCareer.prompt.text, /【合伙任务】/);
  assert.match(baziCareer.prompt.text, /十神互补/);

  // 紫微合盘合伙场景
  const ziweiCareer: any = await calculate('ziwei-synastry', {
    question: '合作创业分工如何',
    person1: { name: '张三', gender: 'male', birth: person1Base },
    person2: { name: '李四', gender: 'female', birth: person2Base },
    relationship: 'career',
    prompt: { includeClassics: true },
  });
  assert.match(ziweiCareer.prompt.text, /【局势要点】/);
  assert.match(ziweiCareer.prompt.text, /【合作任务】/);
  assert.match(ziweiCareer.prompt.text, /官禄宫/);

  // 星盘合盘：通过【求测背景】识别合盘场景
  const astroCareerQ = '我们适合合作开公司吗？\n\n【求测背景】合盘场景：事业合伙·职场共事｜当前处境：筹备合伙创业';
  const astroCareer: any = await calculate('astrolabe-synastry', {
    question: astroCareerQ,
    person1: { ...person1Astro, name: '张三' },
    person2: { ...person2Astro, name: '李四' },
    prompt: { includeClassics: true },
  });
  assert.match(astroCareer.prompt.text, /【局势要点】/);
  assert.match(astroCareer.prompt.text, /【事业合伙任务】/);
  assert.match(astroCareer.prompt.text, /第十宫/);
  assert.ok(buildMethodSituationDigest('astrolabe-synastry', astroCareer.data, astroCareerQ).length >= 2);
});
