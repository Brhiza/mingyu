import test from 'node:test';
import assert from 'node:assert/strict';
import { SolarDay, SolarTerm } from 'tyme4ts';
import { jiazi } from '../packages/core/src/divination/divination-data.ts';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';
import { getDunJiaStem } from '../packages/core/src/divination/algorithms/qimen/helpers/palace-utils.ts';
import {
  getDayOfficerInfo,
  getDaySeasonRelation,
  getLunarPhase,
  getLunarPhaseByIndex,
  getSeasonalElement,
} from '../packages/core/src/divination/algorithms/qimen/helpers/seasonality.ts';
import { getQimenJuShu } from '../packages/core/src/divination/algorithms/qimen/helpers/jushu.ts';
import {
  getMonthQimenJuShu,
  getYearQimenJuShu,
} from '../packages/core/src/divination/algorithms/qimen/helpers/jushu-extended.ts';
import { getQimenPatternTags } from '../packages/core/src/divination/algorithms/qimen/helpers/patterns.ts';
import {
  getNamedStemPairPattern,
  getStemPairPattern,
} from '../packages/core/src/divination/algorithms/qimen/helpers/stem-pair-patterns.ts';

test('奇门拆补法在交节当天应按具体时刻换节气，不应按整日提前换局', () => {
  const beforeXiaoman = generateQimen(new Date('2024-05-20T10:00:00+08:00'));
  assert.equal(beforeXiaoman.timeInfo.solarTerm, '立夏');
  assert.equal(beforeXiaoman.seasonality?.currentJieQi, '立夏');
  assert.equal(beforeXiaoman.timeInfo.epoch, '中元');
  assert.equal(beforeXiaoman.juShu, 1);

  const afterXiaoman = generateQimen(new Date('2024-05-20T21:30:00+08:00'));
  assert.equal(afterXiaoman.timeInfo.solarTerm, '小满');
  assert.equal(afterXiaoman.seasonality?.currentJieQi, '小满');
  assert.equal(afterXiaoman.timeInfo.epoch, '中元');
  assert.equal(afterXiaoman.juShu, 2);
});

test('奇门拆补法定三元应按晚子时日柱推进符头日', () => {
  const beforeLateZi = generateQimen(new Date('2024-02-19T22:30:00+08:00'));
  assert.equal(beforeLateZi.ganzhi.day, '癸丑');
  assert.equal(beforeLateZi.timeInfo.solarTerm, '雨水');
  assert.equal(beforeLateZi.timeInfo.epoch, '上元');
  assert.equal(beforeLateZi.juShu, 9);

  const lateZi = generateQimen(new Date('2024-02-19T23:30:00+08:00'));
  assert.equal(lateZi.ganzhi.day, '甲寅');
  assert.equal(lateZi.timeInfo.solarTerm, '雨水');
  assert.equal(lateZi.timeInfo.epoch, '中元');
  assert.equal(lateZi.juShu, 6);

  const jingzheLateZi = generateQimen(new Date('2024-03-10T23:30:00+08:00'));
  assert.equal(jingzheLateZi.ganzhi.day, '甲戌');
  assert.equal(jingzheLateZi.timeInfo.solarTerm, '惊蛰');
  assert.equal(jingzheLateZi.timeInfo.epoch, '下元');
  assert.equal(jingzheLateZi.juShu, 4);
});

test('奇门拆补法应识别甲己符头并按符头五日段定三元', () => {
  const chart = generateQimen(new Date('2024-06-15T14:30:00+08:00'));

  assert.equal(chart.ganzhi.day, '庚戌');
  assert.equal(chart.timeInfo.solarTerm, '芒种');
  assert.equal(chart.timeInfo.epoch, '上元');
  assert.equal(chart.juShu, 6);
  assert.equal(chart.timeInfo.fuTou, '己酉');
  assert.equal(chart.timeInfo.fuTouDate, '2024-06-14');
});

test('奇门排盘：未知排盘级别应明确报错，不应静默当作时家盘', () => {
  assert.throws(
    () =>
      generateQimen(
        new Date('2025-01-01T08:00:00+08:00'),
        'zhuanpan',
        'quarter' as Parameters<typeof generateQimen>[2],
      ),
    /未知的奇门排盘级别/,
  );
});

test('奇门排盘：未知排盘方法应明确报错，不应静默当作飞盘', () => {
  assert.throws(
    () =>
      generateQimen(
        new Date('2025-01-01T08:00:00+08:00'),
        'unknown-method' as Parameters<typeof generateQimen>[1],
      ),
    /未知的奇门排盘方法/,
  );
});

test('奇门遁干：非法干支应明确报错，不应把未知六甲默认遁戊', () => {
  assert.equal(getDunJiaStem('甲子'), '戊');
  assert.equal(getDunJiaStem('乙丑'), '乙');
  assert.throws(() => getDunJiaStem('甲丑'), /无法识别干支/);
});

test('月家与年家奇门应校验完整干支，不应只读取单个天干或地支', () => {
  assert.deepEqual(getMonthQimenJuShu('丙寅', '甲辰'), {
    isYangDun: false,
    juShu: 7,
    yuan: '下元',
  });
  assert.throws(() => getMonthQimenJuShu('甲丑', '甲辰'), /月干支不是有效六十甲子/);
  assert.throws(() => getMonthQimenJuShu('丙寅', '甲丑'), /年干支不是有效六十甲子/);
  assert.throws(() => getYearQimenJuShu('甲丑', 1864), /年干支不是有效六十甲子/);
  assert.throws(() => getYearQimenJuShu('甲子', Number.NaN), /无法识别公历年份/);
  assert.throws(() => getYearQimenJuShu('甲子', 1863), /公历年.*与年干支.*不匹配/);
  assert.throws(() => getYearQimenJuShu('甲子', 1866), /公历年.*与年干支.*不匹配/);
});

test('月家奇门应穷举六十行年与六十月干支并固定采用五年段阴遁一四七局', () => {
  for (let yearIndex = 0; yearIndex < jiazi.length; yearIndex += 1) {
    const segment = Math.floor(yearIndex / 5) % 3;
    const expected = {
      isYangDun: false,
      juShu: [1, 4, 7][segment],
      yuan: ['上元', '中元', '下元'][segment],
    };
    for (const monthGanZhi of jiazi) {
      assert.deepEqual(
        getMonthQimenJuShu(monthGanZhi, jiazi[yearIndex]),
        expected,
        `${jiazi[yearIndex]}年${monthGanZhi}月定局错误`,
      );
    }
  }
});

test('年家奇门应穷举完整一百八十年三元周期并固定采用阴遁一四七局', () => {
  for (let offset = 0; offset < 180; offset += 1) {
    const solarYear = 1864 + offset;
    const segment = Math.floor(offset / 60);
    assert.deepEqual(getYearQimenJuShu(jiazi[offset % 60], solarYear), {
      isYangDun: false,
      juShu: [1, 4, 7][segment],
      yuan: ['上元', '中元', '下元'][segment],
    });
  }
});

test('日家奇门在版本与完整布局未校勘前应失败关闭', () => {
  assert.throws(
    () => generateQimen(new Date('2025-01-01T08:00:00+08:00'), 'zhuanpan', 'day'),
    /日家奇门存在多套互相冲突的古法.*不开放/,
  );
});

test('年月家奇门不应静默接受时家置闰法', () => {
  for (const scope of ['month', 'year'] as const) {
    assert.throws(
      () => generateQimen(new Date('2025-01-01T08:00:00+08:00'), 'zhuanpan', scope, 'zhirun'),
      /[月年]家奇门不接受时家置闰法.*三元定局法/,
    );
  }
});

test('奇门格局应拒绝未知值符和值使，不应按零宫位继续判断', () => {
  const baseParams = {
    zhiFu: '天蓬',
    zhiShi: '休门',
    zhiFuLandingPalace: 1,
    zhiShiLandingPalace: 1,
    jiuGongGe: [],
    hourGanForFind: '戊',
  };

  assert.throws(
    () => getQimenPatternTags({ ...baseParams, zhiFu: '假星' }),
    /值符星 "假星" 无法识别/,
  );
  assert.throws(
    () => getQimenPatternTags({ ...baseParams, zhiShi: '假门' }),
    /值使门 "假门" 无法识别/,
  );
});

test('奇门节令：未知节气或日干应明确报错，不应降级成无法判定', () => {
  assert.equal(getSeasonalElement('立春'), '木');
  assert.equal(getDaySeasonRelation('甲', '木').relation, '得时');
  assert.throws(() => getSeasonalElement('假节气'), /无法识别节气 "假节气" 的五行属性/);
  assert.throws(() => getDaySeasonRelation('假', '木'), /无法识别日干 "假" 的五行属性/);
  assert.throws(() => getDaySeasonRelation('甲', ''), /节令五行不能为空/);
});

test('奇门月相与建除映射缺失时应报错，不得默认新月或平', () => {
  assert.equal(getLunarPhaseByIndex(0), '新月');
  assert.equal(getLunarPhaseByIndex(7), '下弦');
  assert.equal(getDayOfficerInfo('成').fortune, '吉');
  assert.throws(() => getLunarPhaseByIndex(8), /无法识别历法月相索引/);
  assert.throws(() => getLunarPhase(new Date(Number.NaN)), /月相日期必须是有效日期/);
  assert.throws(() => getDayOfficerInfo('未知'), /无法识别建除十二神/);
});

test('奇门十干格局应正常返回合法组合并拒绝非法输入', () => {
  const pattern = getStemPairPattern('壬', '癸');
  assert.ok(pattern);
  assert.ok(!('score' in pattern));
  assert.equal(getStemPairPattern('甲', '癸').name, '五行结构事实');
  assert.match(getStemPairPattern('甲', '癸').summary, /地盘癸.*生天盘甲/);
  assert.equal(getNamedStemPairPattern('壬', '癸'), null);
  assert.throws(() => getStemPairPattern('A', '癸'), /合法十天干/);
  assert.throws(() => getNamedStemPairPattern('A', '癸'), /合法十天干/);
});

test('奇门定局方法应支持拆补与置闰，并在结果中标明', () => {
  const date = new Date('2024-05-20T21:30:00+08:00');
  const chaibu = generateQimen(date, 'zhuanpan', 'hour', 'chaibu');
  const zhirun = generateQimen(date, 'zhuanpan', 'hour', 'zhirun');

  assert.equal(chaibu.juMethod, 'chaibu');
  assert.equal(zhirun.juMethod, 'zhirun');
  assert.equal(chaibu.timeInfo.juMethod, 'chaibu');
  assert.equal(zhirun.timeInfo.juMethod, 'zhirun');
  assert.match(String(chaibu.timeInfo.juMethodNote ?? ''), /拆补/);
  assert.match(String(zhirun.timeInfo.juMethodNote ?? ''), /置闰|符头|接气|超神|正授/);
  // 不得静默退回拆补标签
  assert.notEqual(zhirun.juMethod, 'chaibu');
});

test('奇门置闰法应复现《奇门遁甲统宗》康熙五十七年芒种闰奇古例', () => {
  const cases = [
    ['1718-05-30', '己酉', '小满', '芒种', '上元', 6, false, '超神'],
    ['1718-06-04', '甲寅', '小满', '芒种', '中元', 3, false, '超神'],
    ['1718-06-09', '己未', '芒种', '芒种', '下元', 9, false, '超神'],
    ['1718-06-14', '甲子', '芒种', '芒种', '上元', 6, true, '超神'],
    ['1718-06-19', '己巳', '芒种', '芒种', '中元', 3, true, '超神'],
    ['1718-06-24', '甲戌', '夏至', '芒种', '下元', 9, true, '超神'],
    ['1718-06-29', '己卯', '夏至', '夏至', '上元', 9, false, '接气'],
    ['1719-08-08', '甲子', '大暑', '立秋', '上元', 2, false, '正授'],
  ] as const;

  for (const [dateText, dayGanZhi, actualTerm, juTerm, yuan, juShu, isZhiRun, state] of cases) {
    const [year, month, day] = dateText.split('-').map(Number);
    const result = getQimenJuShu(
      {
        solar: { year, month, day, hour: 12 },
        jieQi: actualTerm,
        ganzhi: { day: dayGanZhi },
      },
      'zhirun',
    );

    assert.equal(result.actualJieQi, actualTerm, dateText);
    assert.equal(result.jieQi, juTerm, dateText);
    assert.equal(result.yuan, yuan, dateText);
    assert.equal(result.juShu, juShu, dateText);
    assert.equal(result.fuTou, dayGanZhi, dateText);
    assert.equal(result.isZhiRun, isZhiRun, dateText);
    assert.equal(result.chaoShenOrJieQi, state, dateText);
  }
});

test('奇门置闰法在1900至2100年应保持十五日三元连续且只在芒种大雪置闰', () => {
  const terms = [
    '冬至',
    '小寒',
    '大寒',
    '立春',
    '雨水',
    '惊蛰',
    '春分',
    '清明',
    '谷雨',
    '立夏',
    '小满',
    '芒种',
    '夏至',
    '小暑',
    '大暑',
    '立秋',
    '处暑',
    '白露',
    '秋分',
    '寒露',
    '霜降',
    '立冬',
    '小雪',
    '大雪',
  ];
  const upperFuTou = new Set(['甲子', '己卯', '甲午', '己酉']);
  const zhirunTerms = new Set(['芒种', '大雪']);
  const getResult = (solarDay: ReturnType<typeof SolarDay.fromYmd>) =>
    getQimenJuShu(
      {
        solar: {
          year: solarDay.getYear(),
          month: solarDay.getMonth(),
          day: solarDay.getDay(),
          hour: 12,
        },
        jieQi: solarDay.getTermDay().getSolarTerm().getName(),
        ganzhi: { day: solarDay.getLunarDay().getSixtyCycle().getName() },
      },
      'zhirun',
    );

  let segmentDay = SolarDay.fromYmd(1900, 1, 1);
  while (!upperFuTou.has(segmentDay.getLunarDay().getSixtyCycle().getName())) {
    segmentDay = segmentDay.next(1);
  }

  let previous: ReturnType<typeof getResult> | undefined;
  const insertedTerms = new Set<string>();
  const endDay = SolarDay.fromYmd(2100, 12, 31);
  while (!segmentDay.isAfter(endDay)) {
    const current = getResult(segmentDay);
    assert.equal(current.yuan, '上元', segmentDay.toString());
    assert.equal(current.fuTou, segmentDay.getLunarDay().getSixtyCycle().getName());

    if (current.isZhiRun) {
      assert.ok(zhirunTerms.has(current.jieQi), `${segmentDay}不得在${current.jieQi}置闰`);
      insertedTerms.add(current.jieQi);
    }

    if (previous) {
      const previousIndex = terms.indexOf(previous.jieQi);
      const currentIndex = terms.indexOf(current.jieQi);
      const advance = (currentIndex - previousIndex + terms.length) % terms.length;
      if (advance === 0) {
        assert.equal(current.isZhiRun, true, `${segmentDay}重复节气必须是闰奇`);
        assert.equal(previous.isZhiRun, false, `${segmentDay}不得连续重复两次`);
      } else {
        assert.equal(advance, 1, `${segmentDay}定局节气不得跳跃`);
        assert.equal(current.isZhiRun, false, `${segmentDay}换节后不得仍标闰奇`);
      }
    }

    previous = current;
    segmentDay = segmentDay.next(15);
  }
  assert.deepEqual([...insertedTerms].sort(), ['大雪', '芒种']);

  for (let year = 1900; year <= 2100; year++) {
    for (let termIndex = 0; termIndex < terms.length; termIndex++) {
      const term = SolarTerm.fromIndex(year, termIndex);
      const termTime = term.getJulianDay().getSolarTime();
      const solarDay =
        termTime.getHour() >= 23 ? termTime.getSolarDay().next(1) : termTime.getSolarDay();
      const dayGanZhi = solarDay.getLunarDay().getSixtyCycle().getName();
      if (!upperFuTou.has(dayGanZhi)) continue;

      const result = getResult(solarDay);
      assert.equal(result.jieQi, term.getName(), `${solarDay}天然正授节气`);
      assert.equal(result.yuan, '上元', `${solarDay}天然正授三元`);
      assert.equal(result.chaoShenOrJieQi, '正授', `${solarDay}天然正授状态`);
      assert.equal(result.isZhiRun, false, `${solarDay}天然正授不得标为置闰`);
    }
  }
});

test('奇门置闰法缺少精确公历日期时应拒绝近似推算', () => {
  assert.throws(
    () => getQimenJuShu({ jieQi: '芒种', ganzhi: { day: '甲子' } }, 'zhirun'),
    /必须提供精确公历日期/,
  );
});

test('奇门未知定局方法应明确报错', () => {
  assert.throws(
    () =>
      generateQimen(
        new Date('2025-01-01T08:00:00+08:00'),
        'zhuanpan',
        'hour',
        'unknown' as 'chaibu',
      ),
    /未知的奇门定局方法/,
  );
});
