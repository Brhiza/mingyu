import assert from 'node:assert/strict';
import test from 'node:test';
import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei';
import { buildPublicZiweiPromptForRuntime } from 'mingyu-core/prompt/public-api';
import {
  formatZiweiEvidenceText,
  getZiweiPromptCalculationScopes as getPublicZiweiPromptCalculationScopes,
} from '../packages/core/src/prompt/public-api';
import {
  buildZiweiPrompt,
  getZiweiPromptCalculationScopes,
} from '../packages/core/src/prompt/ziwei';
import type { PalaceFact } from '../packages/core/src/types/analysis';
import { isZiweiConditionRestatedByPalaces } from '../packages/core/src/ziwei/prompt/pattern-condition-visibility';
import { buildZiweiMatchedPatternSummary } from '../packages/core/src/ziwei/prompt/snapshot';
import { buildPortablePromptPack } from '../src/lib/ziwei-prompts';

test('紫微完整提示词仅列一次本命十二宫并保留长生博士与安星口径', async () => {
  const input = buildZiweiChartInput({
    name: '资料回归',
    gender: 'female',
    dateType: 'solar',
    year: '1992',
    month: '8',
    day: '21',
    timeIndex: 4,
    algorithm: 'zhongzhou',
  });
  const context = { dateStr: '2026-08-06', hourIndex: 4 };
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin', 'monthly', 'daily', 'hourly'],
    skipAnalysis: true,
    horoscopeContext: context,
    fortuneRange: { scope: 'all', ...context },
  });
  const text = buildPublicZiweiPromptForRuntime({ result: runtime, scope: 'full' });
  assert.equal((text.match(/宫位关系：本宫/g) ?? []).length, 12);
  assert.match(text, /安星口径：中州派安星法/);
  assert.doesNotMatch(text, /命宫宫/);
  const natal = text.slice(text.indexOf('本命：'), text.indexOf('范围：童限'));
  for (const palace of runtime.payloadByScope.origin.palaces) {
    const line = natal
      .split('\n')
      .find((value) =>
        value.trimStart().startsWith(`${palace.name}${palace.name.endsWith('宫') ? '' : '宫'}`),
      );
    assert.ok(line, palace.name);
    for (const star of [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars]) {
      assert.ok(line.includes(star.name), `${palace.name} ${star.name}`);
    }
    if (palace.changsheng12) assert.ok(line.includes(`长生：${palace.changsheng12}`), palace.name);
    if (palace.boshi12) assert.ok(line.includes(`博士：${palace.boshi12}`), palace.name);
  }
});

test('紫微合参完整范围不重复本命十二宫，年龄年分册仍保留本命快照', async () => {
  const input = buildZiweiChartInput({
    name: '合参去重',
    gender: 'female',
    dateType: 'solar',
    year: '1992',
    month: '8',
    day: '21',
    timeIndex: 4,
  });
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin', 'monthly'],
    skipAnalysis: true,
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
  });

  const fullText = formatZiweiEvidenceText(runtime, 'full');
  assert.equal((fullText.match(/宫位关系：本宫/g) ?? []).length, 24);
  assert.match(fullText, /本命：分析对象：本命/);
  assert.match(fullText, /流月：分析对象：/);
  assert.equal(
    (formatZiweiEvidenceText(runtime, 'origin').match(/宫位关系：本宫/g) ?? []).length,
    12,
  );
  assert.equal(
    (formatZiweiEvidenceText(runtime, 'monthly').match(/宫位关系：本宫/g) ?? []).length,
    12,
  );

  const promptOptions = {
    runtime,
    scope: 'full' as const,
    currentTime: new Date('2026-10-04T08:00:00+08:00'),
    question: '请结合本命和流月资料解读。',
  };
  const normalPrompt = buildZiweiPrompt(promptOptions);
  assert.match(normalPrompt, /本命：\n/);
  assert.match(normalPrompt, /流月：\n/);
  assert.equal((normalPrompt.match(/宫位关系：本宫/g) ?? []).length, 24);
  assert.ok(normalPrompt.includes(promptOptions.question));
  const scopes = getZiweiPromptCalculationScopes('full');
  assert.deepEqual(scopes, ['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly', 'age']);
  const originalScopes = [...scopes];
  try {
    scopes.splice(1);
    assert.deepEqual(scopes, ['origin']);
    const freshScopes = getZiweiPromptCalculationScopes('full');
    assert.notStrictEqual(freshScopes, scopes);
    assert.deepEqual(freshScopes, [
      'origin',
      'decadal',
      'yearly',
      'monthly',
      'daily',
      'hourly',
      'age',
    ]);
    assert.deepEqual(getZiweiPromptCalculationScopes('monthly'), ['monthly']);
    assert.deepEqual(getPublicZiweiPromptCalculationScopes('full'), [
      'origin',
      'decadal',
      'yearly',
      'monthly',
      'daily',
      'hourly',
    ]);
    assert.equal(buildZiweiPrompt(promptOptions), normalPrompt);
    assert.equal(formatZiweiEvidenceText(runtime, 'full'), fullText);
  } finally {
    scopes.splice(0, scopes.length, ...originalScopes);
  }

  const fortuneBatch = await calculateZiweiChart(input, {
    scopes: [],
    independentBatch: 'fortune',
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 4 },
    fortuneRange: {
      scope: 'all',
      dateStr: '2026-08-06',
      hourIndex: 4,
      batch: { startIndex: 0, limit: 1 },
    },
  });
  const batchText = formatZiweiEvidenceText(fortuneBatch, 'full');
  assert.equal((batchText.match(/宫位关系：本宫/g) ?? []).length, 12);
  assert.match(batchText, /十二宫本命资料：/);
  assert.match(batchText, /运限范围资料：/);
});

test('紫微完整任务书省略已展示的同宫正事实，未展示与未知属性保留条件', async () => {
  const cases = [
    {
      birthDate: '1994-06-26',
      birthTimeIndex: 5,
      patternName: '刑囚夹印',
      condition: '天刑、廉贞同临命宫',
      stars: ['天刑', '廉贞'],
      retainedCondition: '天府、天相分别坐财帛宫与官禄宫',
    },
    {
      birthDate: '1992-06-15',
      birthTimeIndex: 7,
      patternName: '泛水桃花',
      condition: '命宫同见擎羊',
      stars: ['擎羊', '贪狼'],
      retainedCondition: undefined,
    },
    {
      birthDate: '1992-06-08',
      birthTimeIndex: 8,
      patternName: '羊陀夹忌',
      condition: '武曲生年化忌坐命宫',
      stars: ['武曲'],
      retainedCondition: '擎羊、陀罗分居命宫相邻两宫',
    },
    {
      birthDate: '1997-06-12',
      birthTimeIndex: 7,
      patternName: '权禄生逢',
      condition: '两颗化曜亮度均为庙或旺',
      stars: ['天同', '太阴'],
      retainedCondition: '禄存在午宫守迁移，对照命宫',
    },
  ] as const;
  const currentTime = new Date('2026-10-04T08:00:00+08:00');
  const question = '请结合本命盘面分析整体结构。';

  for (const sample of cases) {
    const runtime = await calculateZiweiChart(
      {
        name: '格局条件回归',
        dateType: 'lunar',
        birthDate: sample.birthDate,
        birthTimeIndex: sample.birthTimeIndex,
        gender: '女',
        algorithm: 'default',
      },
      {
        scopes: ['origin'],
        horoscopeContext: { dateStr: '2026-10-04', hourIndex: 4 },
      },
    );
    const payload = runtime.payloadByScope.origin;
    const before = structuredClone(payload);
    const pattern = payload.patterns?.find((item) => item.name === sample.patternName);
    const lifePalace = payload.palaces.find((palace) => palace.name === '命宫');
    assert.ok(pattern, sample.patternName);
    assert.ok(lifePalace);
    assert.ok(pattern.matched_conditions?.includes(sample.condition));
    const natalStars = [
      ...lifePalace.major_stars,
      ...lifePalace.minor_stars,
      ...lifePalace.other_stars,
    ];
    for (const name of sample.stars) {
      assert.ok(
        natalStars.some((star) => star.name === name),
        name,
      );
    }

    const texts = [
      buildZiweiPrompt({ runtime, scope: 'full', currentTime, question }),
      buildPublicZiweiPromptForRuntime({ result: runtime, scope: 'full', question }),
      buildPortablePromptPack({
        payload,
        mode: 'task-book',
        reportContext: {
          report_key: 'life:origin:2026-10-04',
          report_title: '人生解析报告',
          report_type: 'life',
          selected_topic: 'life',
          scope_type: 'origin',
          scope_label: '本命',
          focus_notes: [],
        },
      }),
    ];
    for (const text of texts) {
      assert.ok(text.includes(`格局：${sample.patternName}`));
      assert.ok(text.includes(`古籍依据：${pattern.sources?.[0]}`));
      assert.equal(
        text
          .split('\n')
          .some((line) => line.startsWith('命中条件：') && line.includes(sample.condition)),
        false,
        sample.condition,
      );
      for (const name of sample.stars) assert.ok(text.includes(name), name);
      if (sample.retainedCondition) assert.ok(text.includes(sample.retainedCondition));
      if (sample.patternName === '权禄生逢') {
        const lifePalaceLine = text
          .split('\n')
          .find((line) => /^\s*命宫(?:（[^）]+）)?；|^宫位：命宫｜/u.test(line));
        assert.ok(lifePalaceLine);
        assert.match(
          lifePalaceLine,
          new RegExp(`宫干支：?${lifePalace.heavenly_stem}${lifePalace.earthly_branch}`, 'u'),
        );
        assert.match(lifePalaceLine, /天同(?:，亮度：旺，生年化权|\(旺\/生年化权\))/u);
        assert.match(lifePalaceLine, /太阴(?:，亮度：庙，生年化禄|\(庙\/生年化禄\))/u);
        const targetPattern = text.split('格局：权禄生逢\n')[1]?.split('\n\n')[0];
        assert.ok(targetPattern);
        assert.doesNotMatch(targetPattern, /命中条件：|涉及星曜：/u);
      }
    }
    const focused = buildZiweiPrompt({
      runtime,
      scope: 'origin',
      currentTime,
      question,
      focusPalaceNames: ['夫妻宫'],
    });
    assert.ok(
      focused
        .split('\n')
        .some((line) => line.startsWith('命中条件：') && line.includes(sample.condition)),
    );

    const assertRetained = (displayedPalaces: readonly PalaceFact[]) => {
      assert.equal(
        isZiweiConditionRestatedByPalaces(pattern, sample.condition, displayedPalaces),
        false,
      );
      const summary = buildZiweiMatchedPatternSummary(payload, { displayedPalaces }).find(
        (item) => item.格局 === sample.patternName,
      );
      assert.ok(summary?.命中条件?.includes(sample.condition));
    };
    assert.equal(isZiweiConditionRestatedByPalaces(pattern, sample.condition, [lifePalace]), true);
    assertRetained([]);
    assertRetained([{ ...lifePalace, index: (lifePalace.index + 1) % 12 }]);
    const missingStar = sample.stars[0];
    const missingPalace = {
      ...lifePalace,
      major_stars: lifePalace.major_stars.filter((star) => star.name !== missingStar),
      minor_stars: lifePalace.minor_stars.filter((star) => star.name !== missingStar),
      other_stars: lifePalace.other_stars.filter((star) => star.name !== missingStar),
    };
    assertRetained([missingPalace]);
    assertRetained([
      {
        ...missingPalace,
        scope_stars: [
          ...lifePalace.scope_stars,
          ...natalStars
            .filter((star) => star.name === missingStar)
            .map((star) => ({ ...star, scope: 'yearly' })),
        ],
      },
    ]);
    assert.equal(
      isZiweiConditionRestatedByPalaces(pattern, `${sample.condition}，另见其他条件`, [lifePalace]),
      false,
    );

    if (sample.patternName === '刑囚夹印') {
      // 复用同一宫位事实，核对“身宫”别名只在展示了对应身宫标记时成立。
      const bodyCondition = '天刑、廉贞同临身宫';
      const bodyPalace = { ...lifePalace, is_body_palace: true };
      assert.equal(isZiweiConditionRestatedByPalaces(pattern, bodyCondition, [bodyPalace]), true);
      assert.equal(isZiweiConditionRestatedByPalaces(pattern, bodyCondition, [lifePalace]), false);
      assert.equal(
        isZiweiConditionRestatedByPalaces(pattern, bodyCondition, [
          { ...bodyPalace, name: '兄弟' },
        ]),
        false,
      );
      assert.equal(
        isZiweiConditionRestatedByPalaces(pattern, bodyCondition, [
          { ...missingPalace, is_body_palace: true },
        ]),
        false,
      );
    }
    if (sample.patternName === '羊陀夹忌') {
      assert.equal(natalStars.find((star) => star.name === '武曲')?.birth_mutagen, '忌');
      assertRetained([
        {
          ...lifePalace,
          major_stars: lifePalace.major_stars.map((star) =>
            star.name === '武曲'
              ? {
                  ...star,
                  birth_mutagen: undefined,
                  horoscope_mutagen: '忌',
                  active_scope_mutagen: '忌',
                }
              : star,
          ),
        },
      ]);
      assertRetained([
        {
          ...lifePalace,
          major_stars: lifePalace.major_stars.map((star) =>
            star.name === '武曲' ? { ...star, birth_mutagen: '科' } : star,
          ),
        },
      ]);
    }
    if (sample.patternName === '权禄生逢') {
      assert.deepEqual(pattern.star_names, ['天同化权', '太阴化禄']);
      assert.match(focused, /涉及星曜：天同化权、太阴化禄/u);
      assert.doesNotMatch(focused, /^\s*命宫(?:（[^）]+）)?；/mu);
      assert.deepEqual(
        natalStars
          .filter((star) => star.birth_mutagen)
          .map((star) => [star.name, star.birth_mutagen, star.brightness]),
        [
          ['天同', '权', '旺'],
          ['太阴', '禄', '庙'],
        ],
      );
      assertRetained([
        {
          ...lifePalace,
          major_stars: lifePalace.major_stars.map((star) =>
            star.name === '天同' ? { ...star, brightness: undefined } : star,
          ),
        },
      ]);
      assertRetained([
        {
          ...lifePalace,
          major_stars: lifePalace.major_stars.map((star) =>
            star.name === '天同' ? { ...star, brightness: '陷' } : star,
          ),
        },
      ]);
      assertRetained([
        {
          ...lifePalace,
          major_stars: lifePalace.major_stars.map((star) =>
            star.name === '天同'
              ? { ...star, birth_mutagen: undefined, horoscope_mutagen: '权' }
              : star,
          ),
        },
      ]);
      const assertStarIdentities = (
        displayedPalaces: readonly PalaceFact[],
        expected: string | undefined,
      ) => {
        const summary = buildZiweiMatchedPatternSummary(payload, { displayedPalaces }).find(
          (item) => item.格局 === '权禄生逢',
        );
        assert.ok(summary);
        assert.equal(summary.涉及星曜, expected);
      };
      for (const displayedPalaces of [
        [],
        [{ ...lifePalace, index: (lifePalace.index + 1) % 12 }],
        [{ ...lifePalace, name: '夫妻宫' }],
        [
          {
            ...lifePalace,
            major_stars: [],
            minor_stars: [],
            other_stars: [],
            scope_stars: natalStars.map((star) => ({ ...star, scope: 'yearly' })),
          },
        ],
        [
          {
            ...lifePalace,
            major_stars: lifePalace.major_stars.map((star) => ({
              ...star,
              birth_mutagen: undefined,
              horoscope_mutagen: star.birth_mutagen,
              active_scope_mutagen: star.birth_mutagen,
            })),
          },
        ],
      ]) {
        assertStarIdentities(displayedPalaces, '天同化权、太阴化禄');
        const summary = buildZiweiMatchedPatternSummary(payload, { displayedPalaces }).find(
          (item) => item.格局 === '权禄生逢',
        );
        assert.ok(summary?.命中条件?.includes('生年化权、生年化禄同守命宫'));
        assert.ok(summary?.命中条件?.includes(sample.condition));
      }
      assertStarIdentities([missingPalace], '天同化权');
      assertStarIdentities(
        [
          {
            ...lifePalace,
            major_stars: lifePalace.major_stars.map((star) =>
              star.name === '天同'
                ? { ...star, birth_mutagen: undefined, horoscope_mutagen: '权' }
                : star,
            ),
          },
        ],
        '天同化权',
      );
      assertStarIdentities(
        [
          {
            ...lifePalace,
            major_stars: lifePalace.major_stars.map((star) =>
              star.name === '天同' ? { ...star, brightness: undefined } : star,
            ),
          },
        ],
        undefined,
      );
    }
    assert.deepEqual(payload, before);
  }
});
