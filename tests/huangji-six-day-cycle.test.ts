import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHuangjiSixDayCycle } from '@core/huangji-jingshi';
import { hexagramsData } from '@core/divination/hexagram-data';

test('书绪言六日逐爻复现复卦六日及次日颐卦的扫描例题', () => {
  // 《书绪言》中华书局聚珍仿宋本第二册第10页：复初变坤，次变临，历明夷震屯颐。
  const names = ['坤', '临', '明夷', '震', '屯', '颐', '剥'];
  for (const [elapsedDays, name] of names.entries()) {
    const result = calculateHuangjiSixDayCycle({ elapsedDays, hour: 0 });
    assert.equal(result.hexagrams.jing.shortName, elapsedDays < 6 ? '复' : '颐');
    assert.equal(result.hexagrams.daily.shortName, name);
  }
  const hours = ['复', '师', '谦', '豫', '比', '剥'];
  for (const [segment, name] of hours.entries()) {
    for (let hour = segment * 4; hour < segment * 4 + 4; hour++) {
      assert.equal(
        calculateHuangjiSixDayCycle({ elapsedDays: 0, hour }).hexagrams.hourly.shortName,
        name,
      );
    }
  }
});

test('六日逐爻完整三百六十日各六段保持经卦日卦时卦的单爻关系', () => {
  const binary = (id: number) => hexagramsData.find((item) => item.id === id)!.binarySymbol;
  const bitPositions = [3, 4, 5, 0, 1, 2];
  const changedPositions = (a: string, b: string) =>
    [...a].flatMap((bit, i) => (bit === b[i] ? [] : [i]));
  const jingIds = new Set<number>();
  for (let elapsedDays = 0; elapsedDays < 360; elapsedDays++) {
    for (let hour = 0; hour < 24; hour += 4) {
      const result = calculateHuangjiSixDayCycle({ elapsedDays, hour });
      const { jing, daily, hourly } = result.hexagrams;
      jingIds.add(jing.id);
      assert.equal(result.dayOfCycle, elapsedDays + 1);
      assert.deepEqual(changedPositions(binary(jing.id), binary(daily.id)), [
        bitPositions[elapsedDays % 6],
      ]);
      assert.deepEqual(changedPositions(binary(daily.id), binary(hourly.id)), [
        bitPositions[hour / 4],
      ]);
    }
  }
  assert.equal(jingIds.size, 60);
  assert.equal(
    calculateHuangjiSixDayCycle({ elapsedDays: 359, hour: 23 }).hexagrams.jing.shortName,
    '剥',
  );
});

test('六日逐爻拒绝越界及非整数坐标', () => {
  for (const elapsedDays of [-1, 360, 1.5, NaN, Infinity]) {
    assert.throws(() => calculateHuangjiSixDayCycle({ elapsedDays, hour: 0 }), /日数/);
  }
  for (const hour of [-1, 24, 1.5, NaN, Infinity]) {
    assert.throws(() => calculateHuangjiSixDayCycle({ elapsedDays: 0, hour }), /小时/);
  }
});
