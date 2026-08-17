import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContestPrompt,
  buildRankingReport,
  loadContestData,
  validateExistingRankingResultFromMarkdown,
} from '../scripts/evaluate-fortune-contest-model.js';

function buildReportRows(answerForQuestion: (question: number) => string) {
  return Array.from({ length: 40 }, (_, index) => {
    const question = index + 1;
    const actual = answerForQuestion(question);
    const result = actual === 'A' ? '正确' : '错误';
    return `| Q${question} | A | ${actual} | ${result} |`;
  }).join('\n');
}

function buildCurrentReportRows(
  years: number[],
  answerForQuestion: (year: number, question: number) => string,
) {
  return years
    .flatMap((year) =>
      Array.from({ length: 40 }, (_, index) => {
        const question = index + 1;
        const actual = answerForQuestion(year, question);
        const result = actual === 'A' ? '正确' : '错误';
        return `| ${year}-Q${question} | 婚姻 | A | ${actual} | ${result} |`;
      }),
    )
    .join('\n');
}

test('比赛评测默认只加载最新的 2026 年 40 题', async () => {
  const dataset = await loadContestData();

  assert.deepEqual(dataset.availableYears, [2022, 2023, 2024, 2025, 2026]);
  assert.deepEqual(dataset.years, [2026]);
  assert.equal(dataset.cases.length, 8);
  assert.equal(dataset.totalQuestions, 40);
  assert.equal(dataset.description, '2026 年，全部类别，共 40 题');
});

test('比赛评测应覆盖 2022—2026 年全部 200 题', async () => {
  const dataset = await loadContestData({ years: 'all' });
  const countsByYear = new Map<number, number>();

  for (const item of dataset.cases) {
    countsByYear.set(item.year, (countsByYear.get(item.year) ?? 0) + item.questions.length);
  }

  assert.equal(dataset.cases.length, 40);
  assert.equal(dataset.totalQuestions, 200);
  assert.deepEqual(
    [...countsByYear.entries()],
    [
      [2022, 40],
      [2023, 40],
      [2024, 40],
      [2025, 40],
      [2026, 40],
    ],
  );
  assert.equal(dataset.description, '2022—2026 年，全部类别，共 200 题');
});

test('比赛评测应支持非连续年份和类别筛选', async () => {
  const selectedYears = await loadContestData({ years: '2022,2026' });
  const marriage = await loadContestData({ years: 'all', category: '婚姻' });

  assert.deepEqual(selectedYears.years, [2022, 2026]);
  assert.equal(selectedYears.totalQuestions, 80);
  assert.equal(selectedYears.description, '2022、2026 年，全部类别，共 80 题');
  assert.equal(marriage.totalQuestions, 55);
  assert.ok(
    marriage.cases.every((item) =>
      item.questions.every((question) => question.category === '婚姻'),
    ),
  );
});

test('比赛提示词应是自包含任务书且不泄露内部上下文', async () => {
  const dataset = await loadContestData();
  const item = dataset.cases[0];
  const prompt = buildContestPrompt(item);

  assert.match(prompt, /【任务】/);
  assert.match(prompt, /【命例资料】/);
  assert.match(prompt, /【题目】/);
  assert.match(prompt, /【输出要求】/);
  assert.match(prompt, new RegExp(item.birthInfo));
  assert.match(prompt, /Q1：/);
  assert.match(prompt, /A\. /);
  assert.doesNotMatch(
    prompt,
    /mingyu|命语|仓库|\bAPI\b|\bMCP\b|question_number|birth_info|2026-case-1|provider|source/i,
  );
});

test('排名报告应按当前数据集动态显示总题数', async () => {
  const dataset = await loadContestData({ years: '2022,2026' });
  const report = buildRankingReport({
    endpoint: 'https://example.com/v1/chat/completions',
    startedAt: '2026/8/17 10:00:00',
    finishedAt: '2026/8/17 10:01:00',
    dataset,
    results: [
      {
        Label: '测试模型',
        Model: 'test/model',
        Status: '成功',
        Score: 75,
        Accuracy: 75,
        Correct: 60,
        Total: 80,
        ReportFile: '',
        Error: '',
      },
    ],
  });

  assert.match(report, /2022、2026 年，全部类别，共 80 题/);
  assert.match(report, /计分方式：80 题选择题/);
  assert.match(report, /60\/80/);
});

test('历史比赛评测结果自检应拒绝未解析答案', () => {
  const result = validateExistingRankingResultFromMarkdown(
    {
      Label: '测试模型',
      Model: 'test/model',
      Status: '成功',
      Score: 100,
      Accuracy: 100,
      Correct: 40,
      Total: 40,
      ReportFile: 'report.md',
      Error: '',
    },
    buildReportRows((question) => (question === 7 ? '未解析' : 'A')),
  );

  assert.equal(result.Status, '失败');
  assert.equal(result.Score, null);
  assert.match(result.Error, /未解析或非法答案/);
  assert.match(result.Error, /Q7=未解析/);
});

test('历史比赛评测结果自检应按报告明细重新计算成绩', () => {
  const result = validateExistingRankingResultFromMarkdown(
    {
      Label: '测试模型',
      Model: 'test/model',
      Status: '成功',
      Score: 0,
      Accuracy: 0,
      Correct: 0,
      Total: 40,
      ReportFile: 'report.md',
      Error: '旧错误',
    },
    buildReportRows((question) => (question <= 20 ? 'A' : 'B')),
  );

  assert.equal(result.Status, '成功');
  assert.equal(result.Correct, 20);
  assert.equal(result.Total, 40);
  assert.equal(result.Score, 50);
  assert.equal(result.Accuracy, 50);
  assert.equal(result.Error, '');
});

test('评测结果自检应兼容新五列报告并校验动态总题数', () => {
  const result = validateExistingRankingResultFromMarkdown(
    {
      Label: '测试模型',
      Model: 'test/model',
      Status: '成功',
      Score: 0,
      Accuracy: 0,
      Correct: 0,
      Total: 80,
      ReportFile: 'report.md',
      Error: '',
    },
    buildCurrentReportRows([2022, 2026], (_year, question) => (question <= 20 ? 'A' : 'B')),
    { expectedTotal: 80 },
  );

  assert.equal(result.Status, '成功');
  assert.equal(result.Correct, 40);
  assert.equal(result.Total, 80);
  assert.equal(result.Score, 50);
  assert.equal(result.Accuracy, 50);
});
