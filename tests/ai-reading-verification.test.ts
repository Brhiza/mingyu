import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyReadingAnswer } from '../src/lib/ai/reading-verification';
import {
  normalizeAiChatHistory,
  getChartChatHistoryContext,
  buildAiChatInitialPrompt,
} from '../src/lib/ai/chat-history';
import { lookupReadingClassics } from '../src/lib/ai/reading-resources';

const chart = `年柱: 庚午 [比肩]
藏干: 丁[正官]己[正印]
月柱: 辛巳 [劫财]
藏干: 丙[七杀]庚[比肩]戊[偏印]
日柱: 庚辰 [日主]
藏干: 戊[偏印]乙[正财]癸[伤官]
时柱: 甲申 [偏财]
藏干: 庚[比肩]壬[食神]戊[偏印]
2020年(31岁) 庚子｜干庚:比肩/支子:伤官`;

test('识别实测回答中的藏干错认、虚构六冲和支神错读', () => {
  const issues = verifyReadingAnswer(
    chart,
    '年干丁、月干丙藏于地支；甲冲日支庚；申冲年支午，申冲日支辰；2020年子食神。',
  );
  assert.ok(issues.some((text) => text.includes('年干为庚')));
  assert.ok(issues.some((text) => text.includes('月干为辛')));
  assert.ok(issues.some((text) => text.includes('日支为辰')));
  assert.ok(issues.some((text) => text.includes('申与午并非六冲')));
  assert.ok(issues.some((text) => text.includes('子对应伤官')));
});

test('正确事实、否定句和跨盘十神不误报', () => {
  assert.deepEqual(
    verifyReadingAnswer(chart, '年干庚，月干辛，日支辰；甲偏财，壬食神，子伤官；申冲寅。'),
    [],
  );
  assert.deepEqual(verifyReadingAnswer(chart, '申冲午不成立。'), []);
  assert.deepEqual(verifyReadingAnswer(chart, '2026年流年天干丙，年支午。'), []);
  assert.deepEqual(verifyReadingAnswer(chart, '庚子（比肩+伤官）'), []);
  assert.deepEqual(verifyReadingAnswer(`${chart}\n${chart}`, '另一位日主甲为正官。'), []);
});

test('引用与实际查询条文对照，概括取义不当成引文', () => {
  const resources = [
    { key: 'classic', title: '传统条文：庚', text: '原文：庚金带煞，刚健为最。', usable: true },
  ];
  assert.deepEqual(verifyReadingAnswer(chart, '原文：「庚金带煞，刚健为最。」', resources), []);
  assert.ok(verifyReadingAnswer(chart, '原文：「得火而炼，方成器用。」', resources).length);
  assert.deepEqual(verifyReadingAnswer(chart, '取义为刚健、锻炼成器。', resources), []);
});

test('核对提示随对话历史保存，异常字段被规范化', () => {
  const state = normalizeAiChatHistory({
    sessions: [
      {
        id: 'reading',
        turns: [{ role: 'assistant', content: '解读', notices: ['回答需核对', 12] }],
      },
    ],
  });
  assert.deepEqual(state.sessions[0].turns[0].notices, ['回答需核对']);
});

test('命盘历史忽略当前时钟并恢复当时的完整资料', () => {
  const first = '【当前时间】2026年9月10日 10时\n【命盘】庚午';
  const later = '【当前时间】2026年9月10日 11时\n【命盘】庚午';
  assert.equal(getChartChatHistoryContext(first), getChartChatHistoryContext(later));
  assert.notEqual(
    getChartChatHistoryContext(first),
    getChartChatHistoryContext(later.replace('庚午', '辛未')),
  );
  const saved = normalizeAiChatHistory({
    sessions: [{ id: 'one', initialPrompt: first, turns: [] }],
  });
  assert.equal(buildAiChatInitialPrompt(later, saved.sessions[0]), first);
});

test('实测的自然语言日主查询能取得对应滴天髓原句', async () => {
  const result = await lookupReadingClassics('bazi', '滴天髓庚金日主相关条文');
  assert.equal(result.usable, true);
  assert.match(result.text, /庚金带杀/u);
});
