import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarTerm, DefaultChildLimitProvider, EarthBranch, HeavenStem, SixtyCycleYear, SolarDay, SolarTime, TwentyEightStar } from 'tyme4ts';
import { calculate } from '../src/core';
import * as calendar from '../src/systems/calendar';
import { classifyAlmanacGodSource } from '../src/systems/almanac/gods';
import { lunar2097Warning, lunarDateDiscrepancy } from '../src/systems/birth-time';
import {
  UNIVERSAL_DEFAULTS,
  resolveBaziRules,
  resolveLiuyaoZiHourMode,
  resolveQizhengOptions,
  resolveXiaoliurenZiHourMode,
  resolveXuankongMode,
  resolveZiweiRules,
} from '../src/systems/defaults';
import { calculateBaziPillars } from '../src/systems/bazi/pillars';
import { calculateDecadalTimeline } from '../src/systems/luck';
import {
  getDailyDirections,
  getDayBranchRelations,
  getDayDuty,
  getDayTaboos,
  getDayTwelveStar,
  getDayTwentyEightStar,
  getFetusDayName,
  getHourTaboos,
  getHourTwelveStar,
  getSolarDayNineStar,
} from '../src/systems/almanac/rules';
import {
  BRANCH_HIDDEN_STEMS,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  NAYIN_MAP,
  SIXTY_CYCLE,
  TWENTY_EIGHT_STARS,
  getHiddenMainStem,
  getHiddenMediumStem,
  getHiddenResidualStem,
  getHiddenStems,
  getLifeStage,
  getMonthNineStar,
  getNayin,
  getNayinWuxing,
  getSanxingType,
  getSeasonState,
  getStemHeElement,
  getTenStar,
  getTwentyEightStarSevenStar,
  getVoidBranches,
  getWuxingStrengthProfile,
  getXunHead,
  getYearNineStar,
  getYearSixtyCycle,
  isHalfSanhe,
  isKe,
  isLiuchong,
  isLiuhai,
  isLiuhe,
  isLiupo,
  isSanhe,
  isSanhui,
  isSanxing,
  isSheng,
  isStemChong,
  isStemHe,
  stepSixtyCycle,
  tallyWuxing,
} from '../src/systems/ganzhi-foundation';

test('六十甲子、纳音五行与六旬空亡', () => {
  assert.equal(SIXTY_CYCLE.length, 60);
  assert.equal(SIXTY_CYCLE[0], '甲子');
  assert.equal(SIXTY_CYCLE[59], '癸亥');
  assert.equal(Object.keys(NAYIN_MAP).length, 60);

  assert.equal(getNayin('甲子'), '海中金');
  assert.equal(getNayinWuxing('甲子'), '金');
  assert.equal(getNayin('丙寅'), '炉中火');
  assert.equal(getNayinWuxing('丙寅'), '火');
  assert.equal(getNayin('癸亥'), '大海水');
  assert.equal(getNayinWuxing('癸亥'), '水');

  assert.equal(getXunHead('甲子'), '甲子');
  assert.deepEqual(getVoidBranches('甲子'), ['戌', '亥']);
  assert.equal(getXunHead('丙寅'), '甲子');
  assert.deepEqual(getVoidBranches('丙寅'), ['戌', '亥']);
  assert.equal(getXunHead('癸亥'), '甲寅');
  assert.deepEqual(getVoidBranches('癸亥'), ['子', '丑']);
});

test('十二长生支持火土同宫、水土同宫与五行顺行', () => {
  // 默认火土同宫、阳顺阴逆，与 tyme4ts 一致
  for (const stem of HEAVENLY_STEMS) {
    for (const branch of EARTHLY_BRANCHES) {
      const expected = HeavenStem.fromName(stem).getTerrain(EarthBranch.fromName(branch)).getName();
      assert.equal(getLifeStage(stem, branch), expected, `${stem}${branch}`);
    }
  }
  assert.equal(getLifeStage('戊', '寅'), '长生');
  assert.equal(getLifeStage('戊', '申', { earthRule: 'follow-water' }), '长生');
  assert.equal(getLifeStage('己', '卯', { earthRule: 'follow-water' }), '长生');
  assert.equal(getLifeStage('乙', '亥', { earthRule: 'independent' }), '长生');
  assert.equal(getLifeStage('乙', '午', { earthRule: 'follow-fire' }), '长生');
});

test('天干合冲与地支刑冲合害破、藏干', () => {
  assert.equal(isStemHe('甲', '己'), true);
  assert.equal(getStemHeElement('甲', '己'), '土');
  assert.equal(isStemHe('甲', '庚'), false);
  assert.equal(isStemChong('甲', '庚'), true);
  assert.equal(isStemChong('戊', '甲'), false);

  assert.equal(isLiuhe('子', '丑'), true);
  assert.equal(isLiuchong('子', '午'), true);
  assert.equal(isLiuhai('子', '未'), true);
  assert.equal(isLiupo('子', '酉'), true);

  assert.equal(isSanhe(['申', '子', '辰']), '水局');
  assert.equal(isHalfSanhe(['申', '子']), '水局');
  assert.equal(isSanhui(['寅', '卯', '辰']), '东方木');

  assert.equal(getSanxingType('子'), '无礼之刑');
  assert.equal(getSanxingType('寅'), '无恩之刑');
  assert.equal(getSanxingType('丑'), '恃势之刑');
  assert.equal(getSanxingType('辰'), '自刑');
  assert.equal(isSanxing('子', '卯'), true);
  assert.equal(isSanxing('寅', '巳'), true);
  assert.equal(isSanxing('辰', '辰'), true);
  assert.equal(isSanxing('子', '子'), false);

  assert.deepEqual(BRANCH_HIDDEN_STEMS['寅'], ['甲', '丙', '戊']);
  assert.deepEqual(getHiddenStems('丑'), ['己', '癸', '辛']);
  assert.equal(getHiddenMainStem('寅'), '甲');
  assert.equal(getHiddenMediumStem('寅'), '丙');
  assert.equal(getHiddenResidualStem('寅'), '戊');
  assert.equal(getHiddenMediumStem('子'), undefined);
});

test('带藏干权重的五行统计与旺相休囚死', () => {
  assert.deepEqual(tallyWuxing(['甲', '寅']), { 木: 2, 火: 0, 土: 0, 金: 0, 水: 0 });
  assert.deepEqual(tallyWuxing(['寅'], { weightHidden: true }), {
    木: 1,
    火: 0.5,
    土: 0.3,
    金: 0,
    水: 0,
  });
  assert.deepEqual(tallyWuxing(['甲子', '丙寅'], { weightHidden: true }), {
    木: 2,
    火: 1.5,
    土: 0.3,
    金: 0,
    水: 1,
  });

  const profile = getWuxingStrengthProfile(['甲子', '丙寅']);
  assert.equal(profile.dominant, '木');
  assert.deepEqual(profile.lacking, ['金']);

  assert.equal(isSheng('木', '火'), true);
  assert.equal(isKe('木', '土'), true);
  assert.equal(getSeasonState('木', '寅'), '旺');
  assert.equal(getSeasonState('火', '寅'), '相');
  assert.equal(getSeasonState('水', '寅'), '休');
  assert.equal(getSeasonState('金', '寅'), '囚');
  assert.equal(getSeasonState('土', '寅'), '死');
});

test('calendar.ts 保持原有导出兼容', () => {
  assert.equal(calendar.HEAVENLY_STEMS.length, 10);
  assert.equal(calendar.EARTHLY_BRANCHES.length, 12);
  assert.deepEqual(calendar.getVoidBranches('甲子'), ['戌', '亥']);
  assert.equal(calendar.getBranchIndex('子'), 0);
  assert.equal(calendar.getBranchWuxing('寅'), '木');
  assert.equal(calendar.getStemWuxing('甲'), '木');
  assert.equal(calendar.getStemYinYang('甲'), '阳');
  assert.equal(calendar.isSheng('木', '火'), true);
  assert.equal(calendar.isKe('木', '土'), true);
  assert.equal(calendar.getSeasonState('火', '寅'), '相');
});

test('自研十神、二十八宿七曜、年/月九星及八字起运与历表基线一致', () => {
  for (const dayStem of HEAVENLY_STEMS) {
    for (const targetStem of HEAVENLY_STEMS) {
      assert.equal(
        getTenStar(dayStem, targetStem),
        HeavenStem.fromName(dayStem).getTenStar(HeavenStem.fromName(targetStem)).getName(),
      );
    }
  }
  for (const star of TWENTY_EIGHT_STARS) {
    assert.equal(
      getTwentyEightStarSevenStar(star),
      TwentyEightStar.fromName(star).getSevenStar().getName(),
    );
  }
  for (let year = 1864; year <= 2100; year += 17) {
    assert.equal(getYearSixtyCycle(year), SixtyCycleYear.fromYear(year).getSixtyCycle().getName());
    assert.equal(getYearNineStar(year), SixtyCycleYear.fromYear(year).getNineStar().getIndex() + 1);
  }
  assert.equal(stepSixtyCycle('癸亥', 1), '甲子');
  assert.equal(stepSixtyCycle('甲子', -1), '癸亥');
  assert.equal(getMonthNineStar('辰', '卯'), 4);
  for (let month = 1; month <= 12; month++) {
    const cm = SolarTime.fromYmdHms(2024, month, 15, 12, 0, 0).getSolarDay().getSixtyCycleDay().getSixtyCycleMonth();
    assert.equal(
      getMonthNineStar(cm.getSixtyCycleYear().getSixtyCycle().getEarthBranch().getName(), cm.getSixtyCycle().getEarthBranch().getName()),
      cm.getNineStar().getIndex() + 1,
    );
  }

  const birthUtc = Date.UTC(1990, 4, 15, 6, 30, 17);
  const timeline = calculateDecadalTimeline(birthUtc, 'male');
  const solar = SolarTime.fromYmdHms(1990, 5, 15, 14, 30, 17);
  const term = solar.getTerm().isJie() ? solar.getTerm().next(2) : solar.getTerm().next(1);
  const info = new DefaultChildLimitProvider().getInfo(solar, term);
  assert.deepEqual(timeline.startAge, {
    years: info.getYearCount(),
    months: info.getMonthCount(),
    days: info.getDayCount(),
    hours: info.getHourCount(),
    minutes: info.getMinuteCount(),
  });
});

test('自研黄历建除、黄黑道、胎神、九星与宜忌规则表与基线一致', () => {
  for (const [y, m, d] of [[2024, 2, 4], [2024, 6, 21], [2024, 12, 22], [2026, 11, 19]] as const) {
    const solarDay = SolarDay.fromYmd(y, m, d);
    const cycleDay = solarDay.getSixtyCycleDay();
    const monthBranch = cycleDay.getMonth().getEarthBranch().getName();
    const dayGanZhi = cycleDay.getSixtyCycle().getName();
    const dayBranch = dayGanZhi[1];
    const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    assert.equal(getDayDuty(monthBranch, dayBranch), cycleDay.getDuty().getName());
    assert.equal(getDayTwelveStar(monthBranch, dayBranch), cycleDay.getTwelveStar().getName());
    assert.equal(getFetusDayName(dayGanZhi), cycleDay.getFetusDay().getName());
    assert.equal(getSolarDayNineStar(solarDay).fullName, solarDay.getLunarDay().getNineStar().toString());
    assert.equal(getDayTwentyEightStar(weekday, dayBranch).name, solarDay.getLunarDay().getTwentyEightStar().getName());
    assert.equal(getDailyDirections(dayGanZhi[0]).joy, cycleDay.getSixtyCycle().getHeavenStem().getJoyDirection().getName());
    assert.equal(getDayBranchRelations(dayBranch).ominous, cycleDay.getSixtyCycle().getEarthBranch().getOminous().getName());
    assert.deepEqual(
      getDayTaboos(monthBranch, dayGanZhi).recommends,
      cycleDay.getRecommends().map((item) => item.getName()),
    );
    assert.deepEqual(
      getHourTaboos(dayGanZhi, '午').avoids,
      solarDay.getLunarDay().getHours()[6].getAvoids().map((item) => item.getName()),
    );
    assert.equal(
      getHourTwelveStar(dayBranch, '午'),
      solarDay.getLunarDay().getHours()[6].getTwelveStar().getName(),
    );
  }
});

test('统一通用默认配置零选择开箱即用，且八字支持按需切换长生土寄口径', async () => {
  assert.equal(resolveBaziRules().earthRule, UNIVERSAL_DEFAULTS.bazi.earthRule);
  assert.equal(resolveZiweiRules().leapMonthMode, 'split-15');
  assert.equal(resolveZiweiRules({ fixLeap: false }).leapMonthMode, 'same');
  assert.equal(resolveXuankongMode(), '下卦');
  assert.deepEqual(resolveQizhengOptions(), { mingGongMethod: 'mao-palace', nodeModel: 'true' });
  assert.equal(resolveLiuyaoZiHourMode(), '23:00');
  assert.equal(resolveXiaoliurenZiHourMode(), '00:00');

  const birth = {
    year: 1990,
    month: 5,
    day: 15,
    clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 },
    timezone: 8,
  };
  const fireEarth = await calculateBaziPillars(birth, 'male');
  const waterEarth = await calculateBaziPillars(birth, 'male', { earthRule: 'follow-water' });
  // 甲木日主在 1990-05-15（日主按实际干支检验戊己土在巳/申长生差异）
  assert.equal(fireEarth.pillars.month.ganZhi, waterEarth.pillars.month.ganZhi);
  assert.equal(fireEarth.pillars.day.lifeStage, getLifeStage(fireEarth.pillars.day.gan, fireEarth.pillars.day.zhi, { earthRule: 'follow-fire' }));
  assert.equal(waterEarth.pillars.day.lifeStage, getLifeStage(waterEarth.pillars.day.gan, waterEarth.pillars.day.zhi, { earthRule: 'follow-water' }));
});

test('自研四柱算子在跨世纪立春秒级边界与黄历神煞溯源、2097 近午夜预警准确生效', async () => {
  // 2024 立春精确交节前1秒与交节秒对比
  const lichun2024 = SolarTerm.fromIndex(2024, 3).getJulianDay().getSolarTime();
  const prev = lichun2024.next(-1);
  const before = calendar.getSolarYmdHmsPillars(prev.getYear(), prev.getMonth(), prev.getDay(), prev.getHour(), prev.getMinute(), prev.getSecond());
  const at = calendar.getSolarYmdHmsPillars(lichun2024.getYear(), lichun2024.getMonth(), lichun2024.getDay(), lichun2024.getHour(), lichun2024.getMinute(), lichun2024.getSecond());
  assert.equal(before.year, '癸卯');
  assert.equal(before.month, '乙丑');
  assert.equal(at.year, '甲辰');
  assert.equal(at.month, '丙寅');

  // 公元1年立春边界同样精确切换年月
  const lichun1 = SolarTerm.fromIndex(1, 3).getJulianDay().getSolarTime();
  const p1Before = lichun1.next(-1);
  const y1Before = calendar.getSolarYmdHmsPillars(p1Before.getYear(), p1Before.getMonth(), p1Before.getDay(), p1Before.getHour(), p1Before.getMinute(), p1Before.getSecond());
  const y1At = calendar.getSolarYmdHmsPillars(lichun1.getYear(), lichun1.getMonth(), lichun1.getDay(), lichun1.getHour(), lichun1.getMinute(), lichun1.getSecond());
  assert.equal(y1Before.year, '庚申');
  assert.equal(y1Before.month, '己丑');
  assert.equal(y1At.year, '辛酉');
  assert.equal(y1At.month, '庚寅');

  // 八字 schema 已支持 earthRule，同时默认无需传参保持 follow-fire
  const baziDefault = await calculate('bazi', {
    question: '长生口径',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
  });
  const baziWater = await calculate('bazi', {
    question: '长生口径',
    birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    rules: { earthRule: 'follow-water' },
  });
  assert.equal(baziWater.data.chart.pillars.day.lifeStage, getLifeStage(baziWater.data.chart.pillars.day.gan, baziWater.data.chart.pillars.day.zhi, { earthRule: 'follow-water' }));
  assert.match(baziWater.prompt.text, /土行长生=土随水行/);
  assert.doesNotMatch(baziDefault.prompt.text, /土行长生=/);

  // 黄历神煞出处分类与 2097-08-07 近午夜朔日提示
  assert.equal(classifyAlmanacGodSource('天德'), 'xiejibianfang');
  assert.equal(classifyAlmanacGodSource('十恶大败'), 'tongshu-folk');
  assert.equal(lunarDateDiscrepancy({ year: 2097, month: 8, day: 7 }), lunar2097Warning);
  const almanac2097 = await calculate('almanac', {
    question: '看神煞与边界',
    topic: 'move',
    startDate: '2097-08-07',
    endDate: '2097-08-07',
  });
  assert.equal(almanac2097.data.days[0].lunarDateWarning, lunar2097Warning);
  assert.ok(almanac2097.data.days[0].gods.every((g: any) => g.source === 'xiejibianfang' || g.source === 'tongshu-folk'));
});
