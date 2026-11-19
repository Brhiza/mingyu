import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calculate } from '../src/core';
import { calculateSolarTermEvidence } from '../src/systems/astronomy/solar-term-evidence';
import { CHINA_DST_RANGES, checkChinaDst, resolveBirthClock } from '../src/systems/birth-time';

test('历法与历史夏令时：1986–1991 全部 6 个起止边界与 2000–2050 闰月及立春分钟边界', async () => {
  // 1. 1986–1991 中国夏令时全部 6 个起止边界
  assert.equal(CHINA_DST_RANGES.length, 6);
  for (const { start, end } of CHINA_DST_RANGES) {
    const [sy, sm, sd, sh] = start;
    const [ey, em, ed, eh] = end;

    // 入夏令时前 1 分钟（正常标准时）
    assert.deepEqual(checkChinaDst(sy, sm, sd, sh - 2, 59), {
      inDst: false,
      offsetMinutes: 0,
      ambiguous: false,
      nonexistent: false,
    });
    // 入夏令时跳时缺口（02:00–02:59 不存在）
    assert.equal(checkChinaDst(sy, sm, sd, sh - 1, 30).nonexistent, true);
    assert.throws(() =>
      resolveBirthClock({ year: sy, month: sm, day: sd, hour: sh - 1, minute: 30, second: 0, applyChinaDst: true }),
    );
    // 入夏令时生效（03:00）
    assert.deepEqual(checkChinaDst(sy, sm, sd, sh, 0), {
      inDst: true,
      offsetMinutes: -60,
      ambiguous: false,
      nonexistent: false,
    });

    // 正常夏令时区间（7 月 15 日 12:00）回拨 1 小时
    const summerClock = resolveBirthClock({ year: sy, month: 7, day: 15, hour: 12, minute: 0, second: 0, applyChinaDst: true });
    assert.equal(summerClock.localDateTime, `${sy}-07-15T11:00:00`);

    // 出夏令时回拨重复时段（01:00–01:59 歧义）
    assert.equal(checkChinaDst(ey, em, ed, eh - 1, 30).ambiguous, true);
    assert.throws(() =>
      resolveBirthClock({ year: ey, month: em, day: ed, hour: eh - 1, minute: 30, second: 0, applyChinaDst: true }),
    );
    // 出夏令时恢复标准时（02:00）
    assert.deepEqual(checkChinaDst(ey, em, ed, eh, 0), {
      inDst: false,
      offsetMinutes: 0,
      ambiguous: false,
      nonexistent: false,
    });
  }

  // 2. 2000–2050 典型闰月初一公历映射核验（2020闰四月、2023闰二月、2025闰六月、2033闰十一月、2050闰三月）
  const leapCases = [
    { year: 2020, month: 4, day: 1, expectedDate: '2020-05-23' },
    { year: 2023, month: 2, day: 1, expectedDate: '2023-03-22' },
    { year: 2025, month: 6, day: 1, expectedDate: '2025-07-25' },
    { year: 2033, month: 11, day: 1, expectedDate: '2033-12-22' },
    { year: 2050, month: 3, day: 1, expectedDate: '2050-04-21' },
  ] as const;
  for (const item of leapCases) {
    const resolved = resolveBirthClock({
      year: item.year,
      month: item.month,
      day: item.day,
      hour: 12,
      minute: 0,
      second: 0,
      timezone: 8,
      calendar: 'lunar',
      leapMonth: true,
    });
    assert.equal(resolved.localDateTime, `${item.expectedDate}T12:00:00`);
  }

  // 3. 2000–2050 立春交节分钟级边界：立春前 1 分钟 vs 立春后 1 分钟年柱与月柱必切换
  for (const year of [2000, 2024, 2033, 2050]) {
    const lichun = calculateSolarTermEvidence(year, 3);
    assert.equal(lichun.name, '立春');
    const before = new Date(lichun.utcTimestamp - 60_000 + 8 * 3_600_000);
    const after = new Date(lichun.utcTimestamp + 60_000 + 8 * 3_600_000);

    const makeBirth = (d: Date) => ({
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      clock: { kind: 'exact' as const, hour: d.getUTCHours(), minute: d.getUTCMinutes(), second: d.getUTCSeconds() },
      timezone: 8,
    });
    const baziBefore = await calculate('bazi', { question: '立春前', gender: 'male', birth: makeBirth(before) });
    const baziAfter = await calculate('bazi', { question: '立春后', gender: 'male', birth: makeBirth(after) });
    assert.notEqual(
      baziBefore.data.chart!.pillars.year.ganZhi,
      baziAfter.data.chart!.pillars.year.ganZhi,
      `${year} 立春前后年柱应切换`,
    );
    assert.notEqual(
      baziBefore.data.chart!.pillars.month.ganZhi,
      baziAfter.data.chart!.pillars.month.ganZhi,
      `${year} 立春前后月柱应切换`,
    );
  }
});

test('传统典籍核验（八字）：经典正格与从格的四柱、格局、用神方向与大运顺逆', async () => {
  // 正格案例：1990-05-15 10:30 男命（阳男顺行），庚午 辛巳 庚辰 辛巳
  const zhengGe = await calculate('bazi', {
    question: '事业格局',
    gender: 'male',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 10, minute: 30, second: 0 }, timezone: 8 },
  });
  const zc = zhengGe.data.chart!;
  assert.deepEqual(
    [zc.pillars.year.ganZhi, zc.pillars.month.ganZhi, zc.pillars.day.ganZhi, zc.pillars.hour.ganZhi],
    ['庚午', '辛巳', '庚辰', '辛巳'],
  );
  assert.equal(zc.ordinaryPattern.candidate, '比肩格');
  assert.deepEqual(zc.usefulGod.favorableWuxing, ['水', '木', '火']);
  assert.equal(zhengGe.data.fortune.direction, 'forward');

  // 从格案例：1978-06-22 12:00 女命（阳女逆行），戊午 戊午 乙卯 壬午，从儿格
  const congGe = await calculate('bazi', {
    question: '格局喜忌',
    gender: 'female',
    birth: { year: 1978, month: 6, day: 22, clock: { kind: 'exact', hour: 12, minute: 0, second: 0 }, timezone: 8 },
  });
  const cc = congGe.data.chart!;
  assert.deepEqual(
    [cc.pillars.year.ganZhi, cc.pillars.month.ganZhi, cc.pillars.day.ganZhi, cc.pillars.hour.ganZhi],
    ['戊午', '戊午', '乙卯', '壬午'],
  );
  assert.equal(cc.patternOverview.pattern, '从儿格');
  assert.deepEqual(cc.usefulGod.favorableWuxing, ['土', '火']);
  assert.equal(congGe.data.fortune.direction, 'backward');
});

test('传统典籍核验（紫微斗数）：命宫星曜、庚年四化与破军子午经典格局', async () => {
  const ziwei = await calculate('ziwei', {
    question: '命盘格局',
    gender: 'male',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 10, minute: 30, second: 0 }, timezone: 8 },
  });
  const ming = ziwei.data.natal.palaces.find((p) => p.name === '命宫');
  assert.ok(ming);
  assert.equal(ming.earthlyBranch, '子');
  assert.ok(ming.majorStars.some((s) => s.name === '破军'));

  const mutagens = ziwei.data.natal.palaces.flatMap((p) =>
    [...p.majorStars, ...p.minorStars].filter((s) => s.mutagen).map((s) => `${s.name}:${s.mutagen}`),
  );
  // 庚年四化：太阳化禄、武曲化权、太阴化科、天同化忌
  for (const expected of ['太阳:禄', '武曲:权', '太阴:科', '天同:忌']) {
    assert.ok(mutagens.includes(expected), `应包含庚年四化 ${expected}`);
  }
  assert.ok(ziwei.data.natal.patterns.some((p) => p.name === '破军子午'));
});

test('传统典籍核验（奇门遁甲）：冬至阳遁、夏至阴遁、拆补与茅山定局边界', async () => {
  // 冬至后阳遁：拆补四局 vs 茅山一局
  const winterCB = await calculate('qimen', {
    question: '冬至拆补',
    divinationTime: '2024-12-22T00:00:00Z',
    qimen: { scope: 'hour', method: 'zhuanpan', juMethod: 'chaibu' },
  });
  const winterMS = await calculate('qimen', {
    question: '冬至茅山',
    divinationTime: '2024-12-22T00:00:00Z',
    qimen: { scope: 'hour', method: 'zhuanpan', juMethod: 'maoshan' },
  });
  assert.equal(winterCB.data.isYangDun, true);
  assert.equal(winterCB.data.juShu, 4);
  assert.equal(winterMS.data.isYangDun, true);
  assert.equal(winterMS.data.juShu, 1);

  // 夏至后阴遁：拆补三局 vs 茅山九局
  const summerCB = await calculate('qimen', {
    question: '夏至拆补',
    divinationTime: '2024-06-21T00:00:00Z',
    qimen: { scope: 'hour', method: 'zhuanpan', juMethod: 'chaibu' },
  });
  const summerMS = await calculate('qimen', {
    question: '夏至茅山',
    divinationTime: '2024-06-21T00:00:00Z',
    qimen: { scope: 'hour', method: 'zhuanpan', juMethod: 'maoshan' },
  });
  assert.equal(summerCB.data.isYangDun, false);
  assert.equal(summerCB.data.juShu, 3);
  assert.equal(summerMS.data.isYangDun, false);
  assert.equal(summerMS.data.juShu, 9);

  // 立春交节分钟级边界：2024-02-04T08:25:00Z（大寒）vs 08:30:00Z（立春）
  const preLichun = await calculate('qimen', {
    question: '节前',
    divinationTime: '2024-02-04T08:25:00Z',
    qimen: { scope: 'hour', method: 'zhuanpan', juMethod: 'chaibu' },
  });
  const postLichun = await calculate('qimen', {
    question: '节后',
    divinationTime: '2024-02-04T08:30:00Z',
    qimen: { scope: 'hour', method: 'zhuanpan', juMethod: 'chaibu' },
  });
  assert.equal(preLichun.data.timeInfo.solarTerm, '大寒');
  assert.equal(postLichun.data.timeInfo.solarTerm, '立春');
});

test('传统典籍核验（大六壬）：伏吟、反吟与九宗门贼克取传案例', async () => {
  const fuyin = await calculate('liuren', { question: '伏吟', divinationTime: '2025-01-15T18:00:00Z' });
  assert.equal(fuyin.data.transmissionRule, '伏吟重审法');
  assert.ok(fuyin.data.patternTags.includes('伏吟'));
  assert.deepEqual(fuyin.data.threeTransmissions.map((t) => t.branch), ['辰', '酉', '卯']);

  const fanyin = await calculate('liuren', { question: '反吟', divinationTime: '2025-01-15T06:00:00Z' });
  assert.equal(fanyin.data.transmissionRule, '返吟重审法');
  assert.ok(fanyin.data.patternTags.includes('反吟'));
  assert.deepEqual(fanyin.data.threeTransmissions.map((t) => t.branch), ['寅', '申', '寅']);

  const zeike = await calculate('liuren', { question: '贼克', divinationTime: '2025-01-01T00:00:00Z' });
  assert.equal(zeike.data.transmissionRule, '元首法');
  assert.equal(zeike.data.threeTransmissions.length, 3);
});

test('传统典籍核验（六爻）：六冲卦、六合卦、动爻化回头克/生及应期线索', async () => {
  // 六冲卦 + 动爻化回头克：乾为天初爻老阳动化丑土克子水
  const chong = await calculate('liuyao', {
    question: '求财如何',
    currentTime: '2025-01-01T00:00:00Z',
    liuyao: { method: 'manual', yaos: [9, 7, 7, 7, 7, 7] },
  });
  assert.equal(chong.data.originalName, '乾为天');
  assert.equal(chong.data.changedName, '天风姤');
  assert.equal(chong.data.hexagramRelations.original, '六冲卦');
  assert.equal(chong.data.yaosDetail[0].changeRelation, '回头克');
  assert.ok(chong.data.evidenceAnalysis.timingFacts.length > 0);
  assert.ok(chong.prompt.text.includes('应期'));

  // 六合卦 + 动爻化回头生：天地否五爻老阳动化未土生申金
  const he = await calculate('liuyao', {
    question: '合作如何',
    currentTime: '2025-01-01T00:00:00Z',
    liuyao: { method: 'manual', yaos: [8, 8, 8, 7, 9, 7] },
  });
  assert.equal(he.data.originalName, '天地否');
  assert.equal(he.data.changedName, '火地晋');
  assert.equal(he.data.hexagramRelations.original, '六合卦');
  assert.equal(he.data.yaosDetail[4].changeRelation, '回头生');
  assert.ok(he.data.evidenceAnalysis.timingFacts.length > 0);
});

test('传统典籍核验（梅花易数）：体用生克、互卦与《说卦传》《焦氏易林》引用', async () => {
  const meihua = await calculate('meihua', {
    question: '合作如何',
    currentTime: '2025-01-01T00:00:00Z',
    meihua: { method: 'number', number: 135 },
    prompt: { includeClassics: true },
  });
  assert.equal(meihua.data.originalName, '山风蛊');
  assert.equal(meihua.data.interName, '雷泽归妹');
  assert.equal(meihua.data.changedName, '艮为山');
  assert.equal(meihua.data.tiGua.name, '艮');
  assert.equal(meihua.data.yongGua.name, '巽');
  assert.equal(meihua.data.analysis.tiYongRelation, '用克体');
  assert.ok(meihua.prompt.text.includes('周易·说卦传'));
  assert.ok(meihua.prompt.text.includes('《焦氏易林》'));
});

test('传统典籍核验（太乙神数）：年计七十二局与主客定算', async () => {
  const taiyi = await calculate('taiyi', {
    question: '年运如何',
    currentTime: '2025-01-01T00:00:00Z',
    taiyi: { scope: 'year', year: 2025 },
  });
  const chart = taiyi.data.chart;
  assert.equal(chart.ganZhi, '乙巳');
  assert.ok(chart.bureau >= 1 && chart.bureau <= 72);
  assert.equal(chart.bureau, 54);
  assert.equal(chart.yinYang, '阳遁');
  assert.equal(chart.lordCount, 38);
  assert.equal(chart.guestCount, 24);
  assert.equal(chart.setCount, 9);
  assert.deepEqual(chart.countNatures, { lord: '下和', guest: '杂重阴', set: '纯阳' });
});

test('基础数据库完整性校验：yilin.json、terms.json、wings.json 与 locations-cn.json', () => {
  const yilin = JSON.parse(readFileSync(new URL('../src/data/yilin.json', import.meta.url), 'utf8')) as {
    hexagrams: string[];
    entries: string[];
  };
  assert.equal(yilin.hexagrams.length, 64);
  assert.equal(yilin.entries.length, 4096);
  for (let i = 0; i < yilin.entries.length; i++) {
    assert.ok(typeof yilin.entries[i] === 'string' && yilin.entries[i].trim().length > 0, `缺少第 ${i} 条林辞`);
  }

  const terms = JSON.parse(readFileSync(new URL('../src/data/terms.json', import.meta.url), 'utf8')) as Array<
    Record<string, unknown>
  >;
  assert.equal(terms.length, 257);
  for (const item of terms) {
    for (const field of ['term', 'category', 'summary', 'positive', 'negative', 'advice', 'detail', 'classicRef']) {
      assert.ok(typeof item[field] === 'string' && item[field].trim().length > 0, `术语 ${String(item.term)} 缺少 ${field}`);
    }
    if (item.pinyin !== undefined) {
      assert.ok(typeof item.pinyin === 'string' && item.pinyin.trim().length > 0, `术语 ${String(item.term)} pinyin 无效`);
    }
    assert.ok(Array.isArray(item.aliases) && item.aliases.length > 0);
    assert.ok(Array.isArray(item.tags) && item.tags.length > 0);
  }

  const wings = JSON.parse(readFileSync(new URL('../src/data/zhouyi/wings.json', import.meta.url), 'utf8')) as Array<{
    id: string;
    wing: string;
    chapter: string;
    title: string;
    text: string;
  }>;
  assert.equal(wings.length, 40);
  for (const expectedWing of ['文言传', '系辞上传', '系辞下传', '说卦传', '序卦传', '杂卦传']) {
    assert.ok(wings.some((w) => w.wing === expectedWing), `十翼缺少 ${expectedWing}`);
  }
  for (const w of wings) {
    assert.ok(w.id && w.title && w.chapter && w.text.trim().length > 0, `十翼条目 ${w.id} 不完整`);
  }

  const locations = JSON.parse(readFileSync(new URL('../src/data/locations-cn.json', import.meta.url), 'utf8')) as {
    provinces: Array<{
      name: string;
      longitude?: number;
      latitude?: number;
      cities: Array<{
        name: string;
        longitude?: number;
        latitude?: number;
        districts: Array<{ name: string; longitude: number; latitude?: number }>;
      }>;
    }>;
  };
  assert.equal(locations.provinces.length, 34);
  let cityCount = 0;
  let districtCount = 0;
  for (const province of locations.provinces) {
    cityCount += province.cities.length;
    for (const city of province.cities) {
      districtCount += city.districts.length;
      for (const district of city.districts) {
        assert.ok(
          typeof district.longitude === 'number' && district.longitude >= 70 && district.longitude <= 140,
          `${province.name} ${city.name} ${district.name} 经度无效`,
        );
        const lat = district.latitude ?? city.latitude ?? province.latitude;
        assert.ok(
          typeof lat === 'number' && lat >= 3 && lat <= 55,
          `${province.name} ${city.name} ${district.name} 纬度无效`,
        );
      }
    }
  }
  assert.equal(cityCount, 392);
  assert.equal(districtCount, 3210);
});
