import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '../packages/core/src/bazi/index.ts';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';
import { analyzeQimenEvidence } from '../packages/core/src/divination/qimen-evidence.ts';
import {
  evaluateQimenPatternFulfillment,
  formatQimenPatternConditionSummary,
} from '../packages/core/src/divination/algorithms/qimen/helpers/guidance.ts';
import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index.ts';
import { resolveSignByNumber } from '../packages/core/src/divination/algorithms/ssgw.ts';
import { buildTaskText } from '../packages/core/src/divination/engine/method-text.ts';
import { resolveSsgwStoryContent } from '../packages/core/src/divination/ssgw-content.ts';
import { calculateHuangjiJingshi } from '../packages/core/src/huangji-jingshi/index.ts';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced.ts';
import {
  buildBaziPromptForResult,
  buildPublicZiweiPromptForRuntime,
  formatZiweiEvidenceText,
} from '../packages/core/src/prompt/public-api.ts';
import { buildZiweiChartInput, calculateZiweiChart } from '../packages/core/src/ziwei/runtime.ts';
import { extractZiweiFacts } from '../scripts/prompt-audit/natal-facts.ts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts.ts';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const QIMEN_PROMPT_SAMPLE_TIME = '2026-05-19T10:30:00+08:00';
let qimenPromptSample: ReturnType<typeof generateQimen> | undefined;

function createQimenPromptSample() {
  qimenPromptSample ??= generateQimen(new Date(QIMEN_PROMPT_SAMPLE_TIME));
  return structuredClone(qimenPromptSample);
}

test('本命八字提示词的任务范围不越过已列岁运资料', () => {
  const result = baziCalculator.calculateBazi({
    gender: 'male',
    year: 1990,
    month: 5,
    day: 15,
    timeIndex: 5,
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const prompt = buildBaziPromptForResult({
    result,
    topic: 'career',
    fortuneScope: 'natal',
    question: '本命事业结构如何？',
  });
  const task = prompt.match(/【任务】\n([\s\S]*?)\n【问题】/)?.[1] ?? '';

  assert.match(task, /四柱原局/);
  assert.doesNotMatch(task, /大运|流年|岁运|具体干支时段/);
  const focus = prompt.match(/【主题取用】\n([^\n]+)/)?.[1] ?? '';
  assert.match(focus, /月令、官杀、印星、财星/);
  assert.doesNotMatch(focus, /大运|流年|岁运/);
});

test('梅花与皇极任务模板按实际输入资料收窄', () => {
  const numberMeihua = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), {
    method: 'number',
    number: 42,
  });
  const meihuaTask = buildTaskText('meihua', numberMeihua);
  assert.match(meihuaTask, /起卦数字/);
  assert.doesNotMatch(meihuaTask, /年月日时起卦资料/);

  const cycle = calculateHuangjiJingshi({ epochYear: 0, year: 2026 });
  const cycleTask = buildTaskText('huangji', cycle);
  assert.match(cycleTask, /元会运世周期资料/);
  assert.doesNotMatch(cycleTask, /六十年统卦|时经卦/);
});

test('奇门提示资料保留完整格局索引，空亡事实不重复列出', () => {
  const data = createQimenPromptSample();
  const anchor = data.jiuGongGe[0];
  const patternNames = [
    '日奇得使',
    '三奇游六仪',
    '相佐',
    '门迫',
    '宫生门',
    '癸击刑',
    '青龙逃走',
    '刑狱之格',
  ];
  const expanded = {
    ...data,
    classicPatterns: data.classicPatterns.filter((pattern) => patternNames.includes(pattern.name)),
  };
  expanded.evidenceAnalysis = analyzeQimenEvidence(expanded);
  const fulfillments = evaluateQimenPatternFulfillment(expanded);
  const text = formatEnhancedDivinationInfo('qimen', expanded);

  assert.equal(fulfillments.length, 8);
  const summary = formatQimenPatternConditionSummary(expanded);
  assert.deepEqual(summary, ['坎一宫同宫见空亡', '巽四宫同宫见门迫', '艮八宫同宫见空亡']);
  assert.doesNotMatch(text, /格局条件：/);
  const palaceLine = text
    .split('\n')
    .find((line) => line.trimStart().startsWith(`${anchor.name}（`));
  assert.match(text, new RegExp(`旬空子空落${escapeRegExp(anchor.name)}`));
  assert.doesNotMatch(palaceLine ?? '', /逢空/);
  for (const pattern of expanded.classicPatterns) {
    assert.match(text, new RegExp(escapeRegExp(pattern.name)));
    assert.equal(text.split(pattern.name).length - 1, 1);
  }
  assert.doesNotMatch(text, /灾咎减半/);
});

test('奇门常规提示词只列经典格局命中及各自落宫', () => {
  const data = createQimenPromptSample();
  const text = formatEnhancedDivinationInfo('qimen', data);
  const patternBlock = text.split('盘面命中格局：\n')[1]?.split('\n值符宫应期参考：')[0] ?? '';

  const palaceTable = text.match(/九宫简表：\r?\n((?:  [^\r\n]*(?:\r?\n|$))*)/u)?.[1] ?? '';
  assert.equal(palaceTable.trim().split('\n').length, 9);
  assert.match(
    palaceTable,
    /兑七宫（正西，金）：门生门，星天芮、天禽，神六合，天盘壬、丙（丙为寄干），地盘戊/u,
  );
  assert.match(palaceTable, /巽四宫（东南，木）：门惊门，星天冲，神值符，天盘癸，地盘丁/u);
  assert.match(patternBlock, /^天遁（吉格，兑七宫）$/mu);
  assert.match(patternBlock, /^休诈（吉格，兑七宫）$/mu);
  assert.match(patternBlock, /^相佐（吉格，巽四宫）$/mu);
  assert.doesNotMatch(
    patternBlock,
    /生门、丙奇、地盘戊同宫|丙奇、生门、六合同宫|值符天冲加地盘丁于巽四宫/u,
  );
  assert.match(patternBlock, /^月奇得使临吉门（吉格）：丙奇加地盘戊（甲子\/甲申所遁）于兑七宫$/mu);
  assert.match(patternBlock, /三奇游六仪（吉格）：甲寅癸值符加地盘丁奇于巽四宫/);
  assert.match(patternBlock, /门迫（凶格）：惊门（金）克巽四宫（木）/);
  assert.doesNotMatch(text, /复合格局：|兑七宫三吉聚气|巽四宫吉凶混杂/);
});

test('三山国王签谱提示资料过滤串签典故与编辑性噪音', () => {
  const sign = resolveSignByNumber(79, new Date('2026-09-01T12:00:00+08:00'));
  const story = resolveSsgwStoryContent(sign);
  const text = formatEnhancedDivinationInfo('ssgw', sign);

  assert.match(story.canonicalStory, /千祥云集/);
  assert.doesNotMatch(story.canonicalStory, /第24签|第64签|全方位的多/);
  assert.doesNotMatch(text, /第24签|第64签|全方位的多/);
});

test('紫微公开提示词从本命星曜事实回溯四化并过滤小限标签', async () => {
  const runtime = await calculateZiweiChart(
    buildZiweiChartInput({
      name: '四化核验',
      gender: 'female',
      dateType: 'solar',
      year: 1990,
      month: 5,
      day: 15,
      timeIndex: 4,
      isLeapMonth: false,
    }),
    {
      scopes: ['origin'],
      skipAnalysis: false,
      horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
    },
  );
  const payload = runtime.payloadByScope.origin;
  const palace = payload.palaces.find((item) =>
    [...item.major_stars, ...item.minor_stars, ...item.other_stars].some((star) =>
      Boolean(star.birth_mutagen),
    ),
  );
  if (!palace) throw new Error('测试盘未生成本命四化星曜。');
  const star = [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars].find((item) =>
    Boolean(item.birth_mutagen),
  );
  if (!star?.birth_mutagen) throw new Error('测试盘未生成本命四化星曜。');

  const testPayload = {
    ...payload,
    active_scope: { ...payload.active_scope, mutagen_map: [] },
    palaces: payload.palaces.map((item) =>
      item.index === palace.index
        ? { ...item, summary_tags: [...item.summary_tags, '小限落宫'] }
        : item,
    ),
  };
  const testRuntime = {
    ...runtime,
    payloadByScope: { ...runtime.payloadByScope, origin: testPayload },
  };
  const publicPrompt = buildPublicZiweiPromptForRuntime({
    result: testRuntime,
    scope: 'origin',
    question: '本命四化如何落宫？',
  });
  const annotation = `${star.name}(${[star.brightness, `生年化${star.birth_mutagen}`].filter(Boolean).join('，')})`;
  const owner = `${palace.name}（${palace.heavenly_stem}${palace.earthly_branch}）：`;
  const embeddedText = formatZiweiEvidenceText(testRuntime, 'origin');
  for (const [text, scope] of [
    [publicPrompt, { start: '【本命资料】', end: '【任务】' }],
    [embeddedText, { start: '分析对象：' }],
  ] as const) {
    const facts = extractZiweiFacts(testPayload, {
      scope,
      palaceValueStyle: 'public',
      mutagenValueStyle: 'public',
    });
    assert.equal(facts.filter((item) => item.id.includes('.birth-mutagen.')).length, 4);
    assert.deepEqual(auditPromptFacts(text, facts).missing, []);
    const palaceLine = text.split('\n').find((line) => line.trimStart().startsWith(owner));
    assert.ok(palaceLine?.includes(annotation));
    assert.equal(text.split(annotation).length - 1, 1);
    assert.doesNotMatch(text, /^生年四化：/mu);
  }
  assert.doesNotMatch(publicPrompt, /小限落宫/);
});
