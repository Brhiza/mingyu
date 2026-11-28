import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';
import { methodIds } from '../src/schema';
import { webExamples } from '../src/web-examples';
import { distillPromptForUser } from '../src/prompt-profile';
import { formatAstroChartWarnings } from '../src/systems/prompt-format';

const PURE_LOOKUP_METHODS = new Set(['calendar', 'zhouyi', 'character-query']);

const RAW_FORBIDDEN_LITERALS = [
  'undefined',
  'NaN',
  '资料不足',
  '未判定',
  '非最终用神',
  '非最终喜忌',
  '并非最终用神',
  'applyChinaDst',
  'timeZoneId',
  'tyme4ts',
  'includeAsteroids',
  'maxAspects',
  'referenceTime',
  '年分界normal',
  '不化禄',
  '不化权',
  '不化科',
  '不化忌',
  '日辰生旺墓绝绝',
  '三阳一阴，三阳一阴',
  '三奇得（',
  '三奇得遇',
  '模型求根差',
  '近似月龄',
  '南離',
  '西兌',
  '中中（',
  '不生成旧版加权评分',
  '基准true',
  '已对齐参考时刻',
  '【本地算法初筛概览',
  '第一人',
  '第二人',
  '[object Object]',
  'points.sun.longitude',
  'includeTimeline',
  '（满足，reference）',
  'Combust',
];

const RAW_FORBIDDEN_REGEXPS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'placidus', pattern: /\bplacidus\b/i },
  { label: 'whole_sign', pattern: /\bwhole_sign\b/i },
  { label: 'lichun', pattern: /\blichun\b/i },
  { label: 'next-day', pattern: /\bnext-day\b/i },
  { label: 'exact-instant', pattern: /\bexact-instant\b/i },
  { label: 'normal', pattern: /\bnormal\b/i },
  { label: 'forward', pattern: /\bforward\b/i },
  { label: 'decadalGanzhi', pattern: /\bdecadalGanzhi\b/i },
  { label: 'movingCount', pattern: /\bmovingCount\b/i },
  { label: '裸JSON键', pattern: /"(?:start|pillars|birthRange)":|"kind":\s*"delta_t_uncertain"/ },
  { label: '空括号', pattern: /\(\)|（）/ },
];

test('底层源头直出 S 级守卫（不经精炼器）：39 术数原始输出零脏词、零英文参数、零重复标题与置顶摘要', async () => {
  for (const method of methodIds) {
    const res = (await calculate(method, webExamples[method], {
      promptGuidance: { enableContract: true, replyStyle: 'standard', topTaskAnchor: true },
    })) as {
      summary?: { title?: string; tags?: string[]; lines?: string[] };
      prompt: { text: string };
    };

    const summaryTexts = [
      res.summary?.title ?? '',
      ...(res.summary?.tags ?? []),
      ...(res.summary?.lines ?? []),
    ].filter(Boolean);
    for (const sText of summaryTexts) {
      assert.equal(sText.includes('[object Object]'), false, `${method} summary 不得包含 [object Object]`);
      assert.equal(/\bplacidus\b/i.test(sText), false, `${method} summary 不得漏出英文 placidus`);
      assert.equal(/\b(?:sound-rhythm|animal-plant|historical-era)\b/.test(sText), false, `${method} summary 不得漏出英文表名`);
      assert.equal(/"(?:start|pillars|kind)":/.test(sText), false, `${method} summary 不得漏出裸 JSON`);
    }

    for (const variant of [
      { label: '原始直出', text: res.prompt.text },
      { label: '精炼展示', text: distillPromptForUser(res.prompt.text, { includeClassics: false }) },
    ]) {
      const headers = [...variant.text.matchAll(/^【([^】]+)】/gm)].map((match) => match[1]);
      const dupHeaders = headers.filter((header, index) => headers.indexOf(header) !== index);
      assert.deepEqual(dupHeaders, [], `${method}[${variant.label}] 不应出现重复段落标题: ${dupHeaders.join(', ')}`);

      for (const forbidden of RAW_FORBIDDEN_LITERALS) {
        assert.equal(
          variant.text.includes(forbidden),
          false,
          `${method}[${variant.label}] 不应出现低质/内部/英文残留「${forbidden}」`,
        );
      }

      for (const { label, pattern } of RAW_FORBIDDEN_REGEXPS) {
        assert.equal(
          pattern.test(variant.text),
          false,
          `${method}[${variant.label}] 不应出现英文参数/格式缺陷「${label}」`,
        );
      }

      if (!PURE_LOOKUP_METHODS.has(method)) {
        const digestIndex = headers.indexOf('局势要点');
        assert.ok(
          digestIndex >= 0 && digestIndex <= 2,
          `${method}[${variant.label}] 应具备置顶【局势要点】（实际 index=${digestIndex}, headers=${headers.slice(0, 5).join('>')})`,
        );
      }
    }
  }
});

test('核心底层数据模型与算法语义准确性专项核验', async () => {
  // 1. 八字 1990-05-15（庚生巳月）立正宗七杀格，且底层数据结构本身不含资料不足/未判定
  const baziRes = (await calculate('bazi', webExamples.bazi)) as {
    data: {
      chart: {
        ordinaryPattern: { candidate: string };
        patternOverview: { pattern: string };
        patternEvidence: {
          paths: Array<{ status: string }>;
          decision: { status: string; targetCondition: string } | null;
        };
      };
    };
    prompt: { text: string };
  };
  assert.equal(baziRes.data.chart.ordinaryPattern.candidate, '七杀格');
  assert.equal(baziRes.data.chart.patternOverview.pattern, '七杀格');
  assert.ok(
    baziRes.data.chart.patternEvidence.paths.every((p) => p.status !== '资料不足'),
    '八字制化路径底层状态应为确定性术数定性，不得为资料不足',
  );
  assert.notEqual(baziRes.data.chart.patternEvidence.decision?.status, '未判定');
  assert.notEqual(baziRes.data.chart.patternEvidence.decision?.targetCondition, '资料不足');

  // 2. 紫微 1990-05-15 庚年女盘：太阴不得·化科，绝不写成太阴不化科
  const ziweiRes = (await calculate('ziwei', webExamples.ziwei)) as { prompt: { text: string } };
  assert.match(ziweiRes.prompt.text, /太阴不得·化科/);
  assert.equal(ziweiRes.prompt.text.includes('太阴不化科'), false);

  // 3. 八宅/阳宅指南针真北基准源头直出真北基准
  const bazhaiRes = (await calculate('bazhai', webExamples.bazhai)) as { prompt: { text: string } };
  assert.match(bazhaiRes.prompt.text, /真北基准/);

  // 4. 运势日运源头输出完整九星全名（如 九紫火），不截断单字｜九｜
  const fortuneRes = (await calculate('fortune', webExamples.fortune)) as { prompt: { text: string } };
  assert.match(fortuneRes.prompt.text, /黄历值神：[^｜\n]+｜[^｜\n]+｜[^｜\n]+宿｜[一二三四五六七八九][^｜\n]{2}｜/);
  assert.doesNotMatch(fortuneRes.prompt.text, /｜[一二三四五六七八九]｜/);

  // 5. 玄空飞星底层数据模型宫位名已直出简体（离/兑），无繁体（離/兌）
  const xkRes = (await calculate('xuankong', webExamples.xuankong)) as {
    data: { charts: Array<{ palaces: Array<{ name: string }> }> };
    prompt: { text: string };
  };
  const xkNames = xkRes.data.charts[0]!.palaces.map((p) => p.name);
  assert.ok(xkNames.includes('离') && xkNames.includes('兑'));
  assert.equal(xkNames.includes('離') || xkNames.includes('兌'), false);
  assert.match(xkRes.prompt.text, /南离（9宫）/);
  assert.match(xkRes.prompt.text, /西兑（7宫）/);
  assert.match(xkRes.prompt.text, /中宫（5宫）/);

  // 6. 起名黑名单排除负面字、皇极补六十年统卦、个人命录无财官假张力
  const namingRes = (await calculate('chinese-naming', webExamples['chinese-naming'])) as { prompt: { text: string } };
  assert.equal(/[恐惧恨怒愁悲哀忧怨]/.test(namingRes.prompt.text), false);

  const hjRes = (await calculate('huangji-jingshi', webExamples['huangji-jingshi'])) as { prompt: { text: string } };
  assert.match(hjRes.prompt.text, /六十年统卦「火风鼎」/);

  const mlRes = (await calculate('minglu', webExamples.minglu)) as { prompt: { text: string } };
  assert.equal(mlRes.prompt.text.includes('财官发力与风控结构 · 跨盘张力'), false);

  // 7. 星历警告对象数组应转为纯中文提醒，不输出 [object Object] 或 JSON
  const formattedWarnings = formatAstroChartWarnings([
    { kind: 'outside_validated_range', body: 'chiron', validated: { from: 1800, to: 2100 }, text: 'raw english' },
    { kind: 'delta_t_uncertain', sigmaSeconds: 12.5, angleSmearDeg: 0.05, moonSmearArcmin: 0.1, text: 'raw english' },
  ]);
  assert.equal(formattedWarnings.length, 2);
  assert.match(formattedWarnings[0]!, /「凯龙星」超出星历校验年代范围（1800–2100年）/);
  assert.match(formattedWarnings[1]!, /地球自转时差（ΔT）存在约 12.5 秒不确定度/);
  assert.equal(formattedWarnings.join('\n').includes('[object Object]'), false);
  assert.equal(formattedWarnings.join('\n').includes('"kind"'), false);
});
