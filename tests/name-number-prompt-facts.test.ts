import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  generateChineseNames,
} from '../packages/core/src/name-number/index.ts';

test('起名提示词只列未知时辰下已确定的出生柱并标明待补柱', () => {
  const analysis = analyzeChineseName({
    fullName: '李明',
    birth: {
      gender: 'male',
      year: 2000,
      month: 1,
      day: 1,
      timeIndex: '',
      dateType: 'solar',
      isThreePillars: true,
    },
  });

  const prompt = buildChineseNameAnalysisPrompt({ analysis });

  assert.match(prompt, /已确定柱：年柱己卯、月柱丙子/);
  assert.match(prompt, /待补柱：日柱、时柱/);
  assert.doesNotMatch(prompt, /四柱（已确定柱）|日柱藏干：|时柱藏干：/);
  assert.match(prompt, /候选日初00:00:00候选/);
  assert.match(prompt, /候选晚子时候选/);
});

test('姓名任务书保留冬癸实际取用的部分判定、条件作用及原始出生记录', () => {
  const birth = {
    gender: 'male' as const,
    year: 1904,
    month: 1,
    day: 20,
    timeIndex: 0,
    birthHour: 0,
    birthMinute: 0,
    birthSecond: 17,
  };
  const analysis = analyzeChineseName({ fullName: '万俟清和', surnameLength: 2, birth });
  const candidates = generateChineseNames({ surname: '万俟', birth, limit: 1 });
  assert.deepEqual(analysis.birthContext?.pillars, ['癸卯', '乙丑', '癸丑', '壬子']);
  assert.equal(analysis.birthContext?.incrementStatus, '部分判定');
  assert.deepEqual(analysis.birthContext?.favorableElements, ['金', '水']);
  for (const prompt of [
    buildChineseNameAnalysisPrompt({ analysis }),
    buildChineseNamingPrompt({ surname: '万俟', candidates }),
  ]) {
    assert.match(prompt, /出生记录：公历1904年1月20日 00:00:17/);
    assert.match(prompt, /四柱：癸卯 乙丑 癸丑 壬子/);
    assert.match(prompt, /增补喜用五行：金、水（部分判定）/);
    assert.match(prompt, /条件取用：丙火用于解冻（作用对象：癸）/);
    assert.match(prompt, /干级所忌：丁/);
  }
  const decided = analyzeChineseName({
    fullName: '李清和',
    birth: { gender: 'male', year: 2000, month: 8, day: 19, timeIndex: 0 },
  });
  assert.deepEqual(decided.birthContext?.pillars, ['庚辰', '甲申', '己酉', '甲子']);
  assert.equal(decided.birthContext?.incrementStatus, '已判定');
  assert.doesNotMatch(buildChineseNameAnalysisPrompt({ analysis: decided }), /（部分判定）/);
  assert.match(buildChineseNameAnalysisPrompt({ analysis: decided }), /格局成败：破格/);
});

test('稳定冬癸出生区间的共同喜用及各时段都保留部分判定', () => {
  const analysis = analyzeChineseName({
    fullName: '万俟清',
    surnameLength: 2,
    birth: {
      gender: 'male',
      year: 1904,
      month: 1,
      day: 20,
      timeIndex: 0,
      birthHour: 0,
      birthMinute: 0,
      birthSecond: 0,
      birthTimeRange: {
        startTimestamp: Date.parse('1904-01-20T00:00:00+08:00'),
        endTimestamp: Date.parse('1904-01-20T00:00:10+08:00'),
        endExclusive: true,
        timezone: 'Asia/Shanghai',
        offsetHours: 8,
        pillars: { year: '癸卯', month: '乙丑', day: '癸丑', hour: '壬子' },
      },
    },
  });
  assert.equal(analysis.birthContext?.birthRange?.totalSamples, 10);
  assert.equal(analysis.birthContext?.birthRange?.branches.length, 1);
  assert.equal(analysis.birthContext?.incrementStatus, '部分判定');
  const prompt = buildChineseNameAnalysisPrompt({ analysis });
  assert.match(prompt, /全段共同喜用：金、水（部分判定）/);
  assert.match(prompt, /增补喜用五行：金、水（部分判定）/);
  assert.match(prompt, /条件取用：丙火用于解冻（作用对象：癸）/);
});

test('缺时命名逐候选保留部分判定，无已定五行的候选仍显示取用状态', () => {
  const analysis = analyzeChineseName({
    fullName: '李清和',
    birth: { gender: 'male', year: 1904, month: 1, day: 20, timeIndex: '', isThreePillars: true },
  });
  const rooster = analysis.birthContext?.unknownTimeAnalysis?.scenarios.find(
    (scenario) => scenario.pillars.hour.ganZhi === '辛酉',
  );
  assert.ok(rooster);
  assert.equal(rooster.incrementStatus, '部分判定');
  assert.deepEqual(rooster.favorableWuxing, []);
  const prompt = buildChineseNameAnalysisPrompt({ analysis });
  assert.match(prompt, /^候选早子时候选：癸卯 乙丑 癸丑 壬子；.*增补喜用金、水（部分判定）$/m);
  assert.match(prompt, /^候选酉时候选：癸卯 乙丑 癸丑 辛酉；.*增补取用部分判定$/m);
});
