import assert from 'node:assert/strict';
import test from 'node:test';
import { getQimenJuShu } from '../../packages/core/src/divination/algorithms/qimen/helpers/jushu.ts';
import { LunarUtil, calculateSolarTermsForYear } from '../../packages/core/src/calendar/index.ts';

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
  const getResult = (solarDay: Date) => {
    const info = LunarUtil.getTimeInfo(solarDay);
    return {
      dayGanZhi: info.ganzhi.day,
      result: getQimenJuShu(
        {
          solar: info.solar,
          jieQi: info.jieQi,
          ganzhi: { day: info.ganzhi.day },
        },
        'zhirun',
      ),
    };
  };
  const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  };
  const describeDate = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  let segmentDay = new Date(1900, 0, 1, 12, 0, 0);
  while (!upperFuTou.has(getResult(segmentDay).dayGanZhi)) {
    segmentDay = addDays(segmentDay, 1);
  }

  let previous: ReturnType<typeof getResult>['result'] | undefined;
  const insertedTerms = new Set<string>();
  const endDay = new Date(2100, 11, 31, 12, 0, 0);
  while (segmentDay <= endDay) {
    const { result: current, dayGanZhi } = getResult(segmentDay);
    const dateText = describeDate(segmentDay);
    assert.equal(current.yuan, '上元', dateText);
    assert.equal(current.fuTou, dayGanZhi);

    if (current.isZhiRun) {
      assert.ok(zhirunTerms.has(current.jieQi), `${dateText}不得在${current.jieQi}置闰`);
      insertedTerms.add(current.jieQi);
    }

    if (previous) {
      const previousIndex = terms.indexOf(previous.jieQi);
      const currentIndex = terms.indexOf(current.jieQi);
      const advance = (currentIndex - previousIndex + terms.length) % terms.length;
      if (advance === 0) {
        assert.equal(current.isZhiRun, true, `${dateText}重复节气必须是闰奇`);
        assert.equal(previous.isZhiRun, false, `${dateText}不得连续重复两次`);
      } else {
        assert.equal(advance, 1, `${dateText}定局节气不得跳跃`);
        assert.equal(current.isZhiRun, false, `${dateText}换节后不得仍标闰奇`);
      }
    }

    previous = current;
    segmentDay = addDays(segmentDay, 15);
  }
  assert.deepEqual([...insertedTerms].sort(), ['大雪', '芒种']);

  for (let year = 1900; year <= 2100; year += 1) {
    for (const term of calculateSolarTermsForYear(year)) {
      const chinaTime = new Date(new Date(term.utcDateTime).getTime() + 8 * 60 * 60 * 1000);
      const termDay = new Date(
        chinaTime.getUTCFullYear(),
        chinaTime.getUTCMonth(),
        chinaTime.getUTCDate() + (chinaTime.getUTCHours() >= 23 ? 1 : 0),
        12,
      );
      const { result, dayGanZhi } = getResult(termDay);
      if (!upperFuTou.has(dayGanZhi)) continue;

      const dateText = describeDate(termDay);
      assert.equal(result.jieQi, term.name, `${dateText}天然正授节气`);
      assert.equal(result.yuan, '上元', `${dateText}天然正授三元`);
      assert.equal(result.chaoShenOrJieQi, '正授', `${dateText}天然正授状态`);
      assert.equal(result.isZhiRun, false, `${dateText}天然正授不得标为置闰`);
    }
  }
});
