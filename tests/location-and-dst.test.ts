import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHINA_DST_RANGES,
  checkChinaDst,
  resolveBirthClock,
} from '../src/systems/birth-time';
import {
  getChinaCityOptions,
  getChinaDistrictOptions,
  getChinaProvinceOptions,
  getOverseasLocations,
  resolveLocationCoordinates,
  searchLocations,
} from '../src/systems/location';

test('省市区县精确查找与级联选项', () => {
  const provinces = getChinaProvinceOptions();
  assert.equal(provinces.length, 34);
  assert.ok(getChinaCityOptions('广东省').some((c) => c.name === '广州市'));
  assert.ok(getChinaDistrictOptions('广东省', '广州市').some((d) => d.name === '天河区'));

  const tianhe = resolveLocationCoordinates('广东省', '广州市', '天河区');
  assert.ok(tianhe);
  assert.equal(tianhe.level, 'district');
  assert.equal(tianhe.timezone, 8);
  assert.ok(Math.abs(tianhe.longitude - 113.361597) < 1e-4);
  assert.ok(Math.abs((tianhe.latitude ?? 0) - 23.124817) < 1e-4);

  // 支持省略行政区后缀及直辖市简写
  const gzShort = resolveLocationCoordinates('广东', '广州');
  assert.ok(gzShort);
  assert.equal(gzShort.name, '广州市');
  assert.equal(gzShort.timezone, 8);

  const bjChaoyang = resolveLocationCoordinates('北京市', '朝阳区');
  assert.ok(bjChaoyang);
  assert.equal(bjChaoyang.displayName, '北京市 朝阳区');
  assert.ok(Math.abs(bjChaoyang.longitude - 116.443136) < 1e-4);

  // 原始数据中个别区县缺少纬度时应回退到上级城市/省级纬度
  const cqJiangbei = resolveLocationCoordinates('重庆市', '重庆城区', '江北区');
  assert.ok(cqJiangbei);
  assert.equal(typeof cqJiangbei.latitude, 'number');

  assert.equal(resolveLocationCoordinates('不存在省', '不存在市'), null);
});

test('模糊搜索支持中文、英文别名与数量限制', () => {
  assert.deepEqual(searchLocations('   '), []);

  const hz = searchLocations('杭州', 5);
  assert.ok(hz.length > 0 && hz.length <= 5);
  assert.ok(hz.some((item) => item.name === '杭州市' && item.timezone === 8));

  const limited = searchLocations('区', 3);
  assert.equal(limited.length, 3);
});

test('海外常用城市查找包含准确 IANA 时区与经纬度', () => {
  const overseas = getOverseasLocations();
  assert.ok(overseas.length >= 16);

  const expectedCities = [
    ['东京', 'Asia/Tokyo'],
    ['首尔', 'Asia/Seoul'],
    ['新加坡', 'Asia/Singapore'],
    ['吉隆坡', 'Asia/Kuala_Lumpur'],
    ['曼谷', 'Asia/Bangkok'],
    ['悉尼', 'Australia/Sydney'],
    ['墨尔本', 'Australia/Melbourne'],
    ['奥克兰', 'Pacific/Auckland'],
    ['伦敦', 'Europe/London'],
    ['巴黎', 'Europe/Paris'],
    ['法兰克福', 'Europe/Berlin'],
    ['纽约', 'America/New_York'],
    ['旧金山', 'America/Los_Angeles'],
    ['洛杉矶', 'America/Los_Angeles'],
    ['温哥华', 'America/Vancouver'],
    ['多伦多', 'America/Toronto'],
  ] as const;

  for (const [city, timeZoneId] of expectedCities) {
    const resolved = resolveLocationCoordinates(city);
    assert.ok(resolved, `应找到海外城市 ${city}`);
    assert.equal(resolved.level, 'overseas');
    assert.equal(resolved.timeZoneId, timeZoneId);
    assert.equal(resolved.timezone, undefined);
  }

  const sfByEnglish = searchLocations('San Francisco', 5);
  assert.equal(sfByEnglish[0]?.name, '旧金山');
  assert.equal(sfByEnglish[0]?.timeZoneId, 'America/Los_Angeles');

  const tokyoByCountry = resolveLocationCoordinates('日本', '东京');
  assert.equal(tokyoByCountry?.timeZoneId, 'Asia/Tokyo');
});

test('1986–1991 中国历史夏令时区间边界检测', () => {
  for (const { start, end } of CHINA_DST_RANGES) {
    const [sy, sm, sd, sh] = start;
    const [ey, em, ed, eh] = end;

    // 开始前 1 分钟（01:59）：非夏令时
    assert.deepEqual(checkChinaDst(sy, sm, sd, sh - 2, 59), {
      inDst: false,
      offsetMinutes: 0,
      ambiguous: false,
      nonexistent: false,
    });

    // 开始跳时缺口（02:00 - 02:59）：不存在时段
    assert.deepEqual(checkChinaDst(sy, sm, sd, sh - 1, 0), {
      inDst: true,
      offsetMinutes: -60,
      ambiguous: false,
      nonexistent: true,
    });
    assert.deepEqual(checkChinaDst(sy, sm, sd, sh - 1, 59), {
      inDst: true,
      offsetMinutes: -60,
      ambiguous: false,
      nonexistent: true,
    });

    // 开始生效（03:00）：正常夏令时
    assert.deepEqual(checkChinaDst(sy, sm, sd, sh, 0), {
      inDst: true,
      offsetMinutes: -60,
      ambiguous: false,
      nonexistent: false,
    });

    // 结束前重复时段（01:00 - 01:59）：回拨歧义
    assert.deepEqual(checkChinaDst(ey, em, ed, eh - 1, 0), {
      inDst: true,
      offsetMinutes: -60,
      ambiguous: true,
      nonexistent: false,
    });
    assert.deepEqual(checkChinaDst(ey, em, ed, eh - 1, 59), {
      inDst: true,
      offsetMinutes: -60,
      ambiguous: true,
      nonexistent: false,
    });

    // 结束时刻（02:00）：非夏令时
    assert.deepEqual(checkChinaDst(ey, em, ed, eh, 0), {
      inDst: false,
      offsetMinutes: 0,
      ambiguous: false,
      nonexistent: false,
    });
  }

  // 非夏令时年份与非夏令时日期
  assert.equal(checkChinaDst(1985, 7, 15, 12, 0).inDst, false);
  assert.equal(checkChinaDst(1992, 7, 15, 12, 0).inDst, false);
  assert.equal(checkChinaDst(1988, 1, 15, 12, 0).inDst, false);
});

test('resolveBirthClock 保持默认行为不变并支持可选 applyChinaDst', () => {
  const baseInput = { year: 1988, month: 7, day: 15, hour: 12, minute: 0, second: 0 };

  // 不传 applyChinaDst：100% 保持原行为
  const withoutFlag = resolveBirthClock(baseInput);
  assert.equal(withoutFlag.localDateTime, '1988-07-15T12:00:00');
  assert.equal('usedChinaDstCorrection' in withoutFlag, false);

  // 传 applyChinaDst: true：夏令时内回拨 1 小时至标准北京时间
  const withFlag = resolveBirthClock({ ...baseInput, applyChinaDst: true });
  assert.equal(withFlag.localDateTime, '1988-07-15T11:00:00');
  assert.equal(withFlag.utcTimestamp, withoutFlag.utcTimestamp - 3_600_000);
  assert.equal((withFlag as { usedChinaDstCorrection?: boolean }).usedChinaDstCorrection, true);

  // 非夏令时日期传 applyChinaDst: true：不作偏移
  const nonDst = resolveBirthClock({ year: 1988, month: 1, day: 15, hour: 12, minute: 0, second: 0, applyChinaDst: true });
  assert.equal(nonDst.localDateTime, '1988-01-15T12:00:00');
  assert.equal((nonDst as { usedChinaDstCorrection?: boolean }).usedChinaDstCorrection, false);

  // 跳时缺口、重复时段与参数冲突校验
  assert.throws(() =>
    resolveBirthClock({ year: 1986, month: 5, day: 4, hour: 2, minute: 30, second: 0, applyChinaDst: true }),
  );
  assert.throws(() =>
    resolveBirthClock({ year: 1986, month: 9, day: 14, hour: 1, minute: 30, second: 0, applyChinaDst: true }),
  );
  assert.throws(() =>
    resolveBirthClock({ ...baseInput, timeZoneId: 'Asia/Shanghai', applyChinaDst: true }),
  );
  assert.throws(() =>
    resolveBirthClock({ ...baseInput, timezone: 9, applyChinaDst: true }),
  );
});

test('八字与紫微主流程支持 applyChinaDst 且未开启时对 1986–1991 夏令时出生给出提醒', async () => {
  const { calculate } = await import('../src/core');
  const baseBirth = {
    year: 1988, month: 7, day: 1,
    clock: { kind: 'exact' as const, hour: 1, minute: 30, second: 0 },
    timezone: 8,
  };
  const baziNoDst = await calculate('bazi', { birth: baseBirth, gender: 'male', question: '事业' });
  assert.match(baziNoDst.data.chart!.basis.chinaDstWarning ?? '', /1986–1991/);
  assert.match(baziNoDst.prompt.text, /1986–1991 年中国大陆历史夏令时/);
  const baziWithDst = await calculate('bazi', { birth: { ...baseBirth, applyChinaDst: true }, gender: 'male', question: '事业' });
  assert.equal(baziWithDst.data.chart!.basis.usedChinaDstCorrection, true);
  assert.equal(baziWithDst.data.chart!.basis.chinaDstWarning, undefined);
  // 01:30 丑时减 1 小时为 00:30 子时
  assert.equal(baziNoDst.data.chart!.pillars.hour.zhi, '丑');
  assert.equal(baziWithDst.data.chart!.pillars.hour.zhi, '子');

  const ziweiNoDst = await calculate('ziwei', { birth: baseBirth, gender: 'male', question: '事业' });
  assert.ok(ziweiNoDst.data.limitations.some((line: string) => line.includes('1986–1991')));
  const ziweiWithDst = await calculate('ziwei', { birth: { ...baseBirth, applyChinaDst: true }, gender: 'male', question: '事业' });
  assert.equal(ziweiWithDst.data.basis.usedChinaDstCorrection, true);
  assert.equal(ziweiWithDst.data.basis.timeIndex, 0);
  assert.ok(!ziweiWithDst.data.limitations.some((line: string) => line.includes('1986–1991')));
});
