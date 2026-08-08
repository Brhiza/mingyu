/**
 * §16 收敛：dayDivide 测试盲区补充（Commit C）。
 *
 * A' / B 已覆盖：八字四柱 + 五鼠遁自洽、紫微 profile 路径联动、draft 路径三层联证。
 * 本文件补齐此前未打到的盲区：
 *
 *   1) 农历 dateType —— buildBaziPersonInput 走 lunar + dayDivide 的路径此前未测。
 *   2) 真太阳时 × dayDivide 经度交互 —— dayDivide 必须作用在「真太阳时校正后的时辰」上；
 *      同钟点、同 dayDivide，在不同经度得到不同日/时柱（120°E 晚子时回退、105°E 亥时不回退）。
 *   3) 亥时用例救活 + 子时对照 —— 亥时/子时都不是晚子时，dayDivide 无副作用；补一组
 *      assert.notEqual 子时对照，证明「无副作用」断言不是空转（fixture 确有区分度）。
 *   4) 紫微不变量 —— 五行局 / 命主 / 身主 / 命宫位置 在 forward 与 current 下都结构稳定。
 *
 * 金标准数值均由本地探针（tests/_probe_c.ts 同口径）实测，非推算。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '@core/bazi/baziCalculator';
import { buildBaziPersonInput } from '@core/bazi/input';
import { buildZiweiChartInput, calculateZiweiChartForScopes } from '@core/ziwei/runtime';
import { buildSerializableZiweiResult } from '@core/prompt/ziwei';

const gz = (p: { gan: string; zhi: string }) => `${p.gan}${p.zhi}`;

// 五鼠遁：日干 → 子时（时辰索引 12）时柱。
const WUXU_DUN_ZI_SHI: Record<string, string> = {
  甲: '甲子', 己: '甲子', 乙: '丙子', 庚: '丙子', 丙: '戊子', 辛: '戊子',
  丁: '庚子', 壬: '庚子', 戊: '壬子', 癸: '壬子',
};

test('C-盲区1 农历 dateType + dayDivide:lunar 晚子时透传并产出有效八字', () => {
  const person = buildBaziPersonInput({
    gender: 'male', year: 2024, month: 3, day: 15, timeIndex: 12,
    dateType: 'lunar', dayDivide: 'current', useTrueSolarTime: false, isLeapMonth: false,
  });
  // draft → Person 透传（A' 新增路径盲区）
  assert.equal(person.dayDivide, 'current');
  const r = baziCalculator.calculateBazi(person);
  // 农历晚子时仍是子时（时辰轴恒定 23:00 归子）
  assert.equal(r.timeInfo.index, 12);
  assert.ok(r.pillars.year.ganZhi && r.pillars.day.ganZhi && r.pillars.hour.ganZhi);
  // dayDivide=current 同步回退日/时柱，五鼠遁自洽（丁日→庚子）
  assert.equal(gz(r.pillars.hour), WUXU_DUN_ZI_SHI[r.pillars.day.gan]);
});

test('C-盲区2 真太阳时×dayDivide 经度交互:120°E 晚子时回退 / 105°E 亥时不回退', () => {
  const calc = (lon: number, div: 'forward' | 'current') =>
    baziCalculator.calculateBazi({
      year: 2024, month: 3, day: 15, timeIndex: 0, gender: 'male',
      useTrueSolarTime: true, birthHour: 23, birthMinute: 30, birthLongitude: lon, dayDivide: div,
    });

  const aCur = calc(120, 'current');
  const aFwd = calc(120, 'forward');
  const bCur = calc(105, 'current');
  const bFwd = calc(105, 'forward');

  // 120°E：真太阳时≈23:20 → 晚子时，dayDivide 生效
  assert.equal(aCur.timeInfo.index, 12);
  assert.equal(gz(aCur.pillars.day), '戊寅'); // current 回退当日
  assert.equal(gz(aFwd.pillars.day), '己卯'); // forward 取次日
  assert.equal(gz(aCur.pillars.hour), '壬子');
  assert.notEqual(gz(aCur.pillars.day), gz(aFwd.pillars.day)); // 回退确实发生

  // 105°E：真太阳时≈22:20 → 亥时，dayDivide 不影响
  assert.equal(bCur.timeInfo.index, 11);
  assert.equal(gz(bCur.pillars.day), '戊寅');
  assert.equal(gz(bFwd.pillars.day), '戊寅'); // 亥时无回退
  assert.equal(gz(bCur.pillars.hour), '癸亥');

  // 经度交互：同钟点同口径，不同经度得到不同「时辰」→ 不同日/时柱
  assert.notEqual(aCur.timeInfo.index, bCur.timeInfo.index); // 12 vs 11
  assert.notEqual(gz(aCur.pillars.hour), gz(bCur.pillars.hour)); // 壬子 vs 癸亥
  assert.notEqual(gz(aFwd.pillars.day), gz(bFwd.pillars.day)); // 己卯 vs 戊寅（经度改变日界）
});

test('C-盲区3 亥时/子时均非晚子时:dayDivide 无副作用,且子时对照证明 fixture 有区分度', () => {
  const hai = (div: 'forward' | 'current') =>
    baziCalculator.calculateBazi({ year: 2024, month: 3, day: 15, timeIndex: 11, gender: 'male', dayDivide: div });
  const zi = (div: 'forward' | 'current') =>
    baziCalculator.calculateBazi({ year: 2024, month: 3, day: 16, timeIndex: 0, gender: 'male', dayDivide: div });

  const haiF = hai('forward');
  const haiC = hai('current');
  const ziF = zi('forward');
  const ziC = zi('current');

  // 亥时(22:30)与子时(00:30)都不是晚子时 → dayDivide 不改变日/时柱
  assert.equal(gz(haiF.pillars.day), gz(haiC.pillars.day));
  assert.equal(gz(haiF.pillars.hour), gz(haiC.pillars.hour));
  assert.equal(gz(ziF.pillars.day), gz(ziC.pillars.day));
  assert.equal(gz(ziF.pillars.hour), gz(ziC.pillars.hour));

  // 区分度对照：亥时(戊寅/癸亥)与子时(己卯/甲子)日柱时柱都不同，
  // 证明上面的「无副作用」断言不是空转（fixture 确实能区分时辰）
  assert.notEqual(gz(haiF.pillars.day), gz(ziF.pillars.day));
  assert.notEqual(gz(haiF.pillars.hour), gz(ziF.pillars.hour));
  assert.equal(gz(haiF.pillars.day), '戊寅');
  assert.equal(gz(haiF.pillars.hour), '癸亥');
});

test('C-盲区4 紫微不变量:五行局/命主/身主/命宫位置在 forward 与 current 下都结构稳定', async () => {
  for (const div of ['forward', 'current'] as const) {
    const input = buildZiweiChartInput({
      name: '', gender: 'male', dateType: 'solar',
      year: '2024', month: '3', day: '15', timeIndex: 12, isLeapMonth: false, dayDivide: div,
    });
    const runtime = await calculateZiweiChartForScopes(input);
    const serial = buildSerializableZiweiResult(runtime);

    // 五行局（如「水二局」）
    assert.match(serial.五行局, /^[木火土金水][二三四五六]局$/);
    // 命宫（地支）、身宫（宫名）
    assert.ok(serial.命宫 && serial.命宫.length > 0);
    assert.ok(serial.身宫 && serial.身宫.length > 0);
    // 命主 / 身主（星名）
    assert.ok(serial.basicInfo.soul && serial.basicInfo.soul.length > 0);
    assert.ok(serial.basicInfo.body && serial.basicInfo.body.length > 0);

    // 十二宫结构：恰一命宫、恰一身宫
    assert.equal(serial.gongList.length, 12);
    assert.equal(serial.gongList.filter((g) => g.isLifePalace).length, 1);
    assert.equal(serial.gongList.filter((g) => g.isBodyPalace).length, 1);
    // 命宫位置自洽：earthlyBranch 等于 serial.命宫 的宫必为命宫
    const lifeGong = serial.gongList.find((g) => g.earthlyBranch === serial.命宫);
    assert.ok(lifeGong && lifeGong.isLifePalace === true);
  }
});
