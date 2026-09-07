import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from '../packages/core/src/bazi/index.ts';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';
import { evaluateQimenPatternFulfillment } from '../packages/core/src/divination/algorithms/qimen/helpers/guidance.ts';
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

test('奇门提示资料完整保留超过三条格局实效', () => {
  const data = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
  const anchor = data.jiuGongGe[0];
  const expanded = {
    ...data,
    classicPatterns: Array.from({ length: 8 }, (_, index) => ({
      name: `整改核验格${index + 1}`,
      type: 'bad' as const,
      summary: '测试用空亡格局',
      palaces: [anchor.gong],
    })),
    voidPalaces: [{ branch: '子', palace: anchor.gong, name: anchor.name }],
  };
  const fulfillments = evaluateQimenPatternFulfillment(expanded);
  const text = formatEnhancedDivinationInfo('qimen', expanded);

  assert.equal(fulfillments.length, 8);
  for (const fulfillment of fulfillments) {
    assert.match(text, new RegExp(escapeRegExp(fulfillment)));
  }
  assert.doesNotMatch(text, /灾咎减半/);
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
  const mutagen = `${star.name}化${star.birth_mutagen}`;

  assert.match(
    publicPrompt,
    new RegExp(
      `${escapeRegExp('生年四化：')}[^\\n]*${escapeRegExp(`${mutagen}入本命${palace.name}`)}`,
    ),
  );
  assert.match(
    publicPrompt,
    new RegExp(`${escapeRegExp(star.name)}[^\\n]*${escapeRegExp(`生年化${star.birth_mutagen}`)}`),
  );
  assert.match(formatZiweiEvidenceText(testRuntime, 'origin'), new RegExp(escapeRegExp(mutagen)));
  assert.doesNotMatch(publicPrompt, /小限落宫/);
});
