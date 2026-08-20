import assert from 'node:assert/strict';
import test from 'node:test';
import { SolarDay, SolarTerm } from 'tyme4ts';

import { getQimenJuShu } from '../../packages/core/src/divination/algorithms/qimen/helpers/jushu.ts';

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

  for (let year = 1900; year <= 2100; year += 1) {
    for (let termIndex = 0; termIndex < terms.length; termIndex += 1) {
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
