import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveBirthPlace } from '../packages/core/src/location/index.ts';
import {
  analyzeChineseName,
  buildChineseNameAnalysisPrompt,
  buildChineseNamingPrompt,
  generateChineseNames,
} from '../packages/core/src/name-number/index.ts';

test('姓名出生事实区分地点代表坐标并列出实际校正经度和时区', () => {
  const birth = {
    gender: 'male' as const,
    year: 2000,
    month: 1,
    day: 1,
    timeIndex: 6,
    dateType: 'solar' as const,
    useTrueSolarTime: true,
    birthHour: 9,
    birthMinute: 0,
  };
  const district = resolveBirthPlace('110101')!;
  const districtAnalysis = analyzeChineseName({
    fullName: '李清和',
    birth: {
      ...birth,
      birthPlace: district.displayName,
      birthLongitude: district.longitude,
      timezone: 8,
      birthSecond: ' \t',
    },
  });
  const districtPrompt = buildChineseNameAnalysisPrompt({ analysis: districtAnalysis });
  assert.equal(districtAnalysis.birthContext?.timeBasis.locationLevel, 'district');
  assert.equal(
    districtAnalysis.birthContext?.timeBasis.coordinateAccuracy,
    'administrative-center',
  );
  assert.equal(districtAnalysis.birthContext?.timeBasis.timezone, 8);
  assert.equal(districtAnalysis.birthContext?.timeBasis.inputTime, '09:00');
  assert.match(districtAnalysis.birthContext!.timeBasis.calculatedTime, /^\d{2}:\d{2}$/);
  assert.match(
    districtPrompt,
    /地点记录：北京市 东城区；真太阳时校正经度：116\.416334°（区县行政中心代表点）；时区：UTC\+08:00/,
  );
  assert.doesNotMatch(districtPrompt, /出生地按经度定位|中国行政区地点数据|来源与精度未注明/);

  const approximatePlace = resolveBirthPlace('710246')!;
  const approximateAnalysis = analyzeChineseName({
    fullName: '李清和',
    birth: {
      ...birth,
      birthPlace: approximatePlace.displayName,
      birthLongitude: approximatePlace.longitude,
    },
  });
  assert.equal(
    approximateAnalysis.birthContext?.timeBasis.coordinateAccuracy,
    'province-approximation',
  );
  assert.match(buildChineseNameAnalysisPrompt({ analysis: approximateAnalysis }), /省级近似坐标/);

  const longitudeOnlyAnalysis = analyzeChineseName({
    fullName: '李清和',
    birth: {
      ...birth,
      birthPlace: '',
      birthLongitude: 75,
      timeZoneId: 'Asia/Kolkata',
    },
  });
  assert.equal(longitudeOnlyAnalysis.birthContext?.timeBasis.locationLevel, null);
  assert.equal(longitudeOnlyAnalysis.birthContext?.timeBasis.timezone, 5.5);
  assert.match(
    buildChineseNameAnalysisPrompt({ analysis: longitudeOnlyAnalysis }),
    /地点记录：未提供；真太阳时校正经度：75°；时区：Asia\/Kolkata，UTC\+05:30/,
  );
});

test('姓名出生钟表与中国历史夏令时别名的排盘时间一致', () => {
  const birth = {
    gender: 'male' as const,
    year: 1988,
    month: 7,
    day: 1,
    dateType: 'solar' as const,
    birthHour: 12,
    birthMinute: 30,
    birthSecond: 15,
  };
  const canonical = analyzeChineseName({
    fullName: '李清和',
    birth: { ...birth, timeZoneId: 'Asia/Shanghai' },
  }).birthContext!;
  for (const timeZoneId of ['Asia/Chongqing', 'Asia/Chungking', 'Asia/Harbin', 'PRC']) {
    const analysis = analyzeChineseName({ fullName: '李清和', birth: { ...birth, timeZoneId } });
    const context = analysis.birthContext!;
    assert.equal(context.timeBasis.inputTime, '12:30:15', timeZoneId);
    assert.equal(context.timeBasis.calculatedTime, '11:30:15', timeZoneId);
    assert.equal(context.timeBasis.mode, '中国历史夏令时钟表时间（已回拨为标准北京时间）');
    assert.equal(context.timeBasis.timeZoneId, timeZoneId);
    assert.deepEqual(context.pillars, canonical.pillars, timeZoneId);
    assert.equal(context.solarDate, canonical.solarDate, timeZoneId);
    const prompt = buildChineseNameAnalysisPrompt({ analysis });
    assert.match(prompt, /出生记录：公历1988年7月1日 12:30:15/);
    assert.match(prompt, /排盘公历：1988-07-01 11:30:15/);
    assert.ok(prompt.includes(`四柱：${canonical.pillars.join(' ')}`));
  }
  for (const options of [
    { timezone: 8, applyChinaDst: true },
    { timeZoneId: 'PRC', birthSecond: undefined },
    { timeZoneId: 'PRC', birthSecond: ' \t' },
    { timeZoneId: 'Asia/Tokyo' },
    { timezone: 8 },
  ]) {
    const context = analyzeChineseName({
      fullName: '李清和',
      birth: { ...birth, ...options },
    }).birthContext!;
    const corrected = options.applyChinaDst === true || options.timeZoneId === 'PRC';
    const withSeconds = options.timeZoneId !== 'PRC';
    assert.equal(
      context.timeBasis.calculatedTime,
      `${corrected ? '11' : '12'}:30${withSeconds ? ':15' : ''}`,
    );
    assert.equal(
      context.timeBasis.mode,
      corrected
        ? '中国历史夏令时钟表时间（已回拨为标准北京时间）'
        : 'timezone' in options
          ? '标准北京时间（精确到秒）'
          : '当地钟表时间（精确到秒）',
    );
  }
});

test('姓名出生空白时分与省略一致，空白秒不冒领显式零秒精度', () => {
  const birth = {
    gender: 'male' as const,
    year: 1990,
    month: 6,
    day: 15,
    timeIndex: 6,
    dateType: 'solar' as const,
  };
  const omitted = analyzeChineseName({ fullName: '李明', birth });
  const blank = analyzeChineseName({
    fullName: '李明',
    birth: { ...birth, birthHour: ' \t', birthMinute: '\n', birthSecond: ' ' },
  });
  assert.deepEqual(blank.birthContext, omitted.birthContext);
  assert.equal(blank.birthContext?.timeBasis.inputTime, '午时（11:00-13:00）');
  assert.equal(blank.birthContext?.timeBasis.calculatedTime, '午时（11:00-13:00）');
  assert.equal(blank.birthContext?.timeBasis.mode, '时辰');
  const analysisPrompt = buildChineseNameAnalysisPrompt({ analysis: blank });
  assert.match(analysisPrompt, /出生记录：公历1990年6月15日 午时（11:00-13:00）/);
  assert.doesNotMatch(analysisPrompt, /00:00|精确到分|精确到秒/);

  const clock = { ...birth, birthHour: 12, birthMinute: 30 };
  const minute = analyzeChineseName({ fullName: '李明', birth: clock });
  const blankSecond = analyzeChineseName({
    fullName: '李明',
    birth: { ...clock, birthSecond: ' \t' },
  });
  assert.deepEqual(blankSecond.birthContext, minute.birthContext);
  assert.equal(blankSecond.birthContext?.timeBasis.inputTime, '12:30');
  assert.equal(blankSecond.birthContext?.timeBasis.calculatedTime, '12:30');
  assert.equal(blankSecond.birthContext?.timeBasis.mode, '标准北京时间（精确到分）');
  const zeroSecond = analyzeChineseName({
    fullName: '李明',
    birth: { ...clock, birthSecond: 0 },
  });
  assert.equal(zeroSecond.birthContext?.timeBasis.inputTime, '12:30:00');
  assert.equal(zeroSecond.birthContext?.timeBasis.calculatedTime, '12:30:00');
  assert.equal(zeroSecond.birthContext?.timeBasis.mode, '标准北京时间（精确到秒）');
  assert.deepEqual(zeroSecond.birthContext?.pillars, minute.birthContext?.pillars);
  const midnight = analyzeChineseName({
    fullName: '李明',
    birth: { ...birth, birthHour: 0, birthMinute: '0', birthSecond: '0' },
  });
  assert.equal(midnight.birthContext?.timeBasis.inputTime, '00:00:00');
  assert.equal(midnight.birthContext?.timeBasis.calculatedTime, '00:00:00');
  assert.equal(midnight.birthContext?.timeBasis.mode, '标准北京时间（精确到秒）');

  const unknown = analyzeChineseName({
    fullName: '李明',
    birth: {
      ...birth,
      isThreePillars: true,
      timeIndex: '',
      birthHour: ' ',
      birthMinute: '\t',
      birthSecond: ' ',
    },
  });
  assert.equal(unknown.birthContext?.timeBasis.inputTime, '时辰未知（待补时）');
  assert.equal(unknown.birthContext?.timeBasis.calculatedTime, '时辰未知（待补时）');
  assert.equal(unknown.birthContext?.timeBasis.mode, '待补时');
  assert.match(
    buildChineseNameAnalysisPrompt({ analysis: unknown }),
    /出生记录：公历1990年6月15日 时辰未知（待补时）/,
  );

  const candidates = generateChineseNames({
    surname: '李',
    givenNameLength: 1,
    generationCharacter: '明',
    limit: 1,
    birth: { ...birth, birthHour: ' ', birthMinute: '\t' },
  });
  assert.deepEqual(candidates[0].analysis.birthContext, omitted.birthContext);
  assert.match(
    buildChineseNamingPrompt({ surname: '李', candidates }),
    /排盘公历：1990-06-15 午时（11:00-13:00）/,
  );
});

test('姓名生成任务书保留夏令时别名跨日的原记录与标准排盘日期', () => {
  const candidates = generateChineseNames({
    surname: '李',
    givenNameLength: 1,
    generationCharacter: '和',
    limit: 1,
    birth: {
      gender: 'male',
      year: 1990,
      month: 5,
      day: 15,
      dateType: 'solar',
      birthHour: 0,
      birthMinute: 20,
      birthSecond: 17,
      timeZoneId: 'Asia/Chongqing',
    },
  });
  const context = candidates[0].analysis.birthContext!;
  assert.equal(context.timeBasis.inputTime, '00:20:17');
  assert.equal(context.timeBasis.calculatedTime, '23:20:17');
  assert.equal(context.timeBasis.mode, '中国历史夏令时钟表时间（已回拨为标准北京时间）');
  const prompt = buildChineseNamingPrompt({ surname: '李', candidates });
  assert.match(prompt, /出生记录：公历1990年5月15日 00:20:17/);
  assert.equal(context.solarDate, '1990-05-14');
  assert.match(prompt, /排盘公历：1990-05-14 23:20:17/);
  assert.ok(prompt.includes(`四柱：${context.pillars.join(' ')}`));
});
