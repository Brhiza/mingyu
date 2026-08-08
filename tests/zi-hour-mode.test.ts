/**
 * §16 收敛：conservative 晚子时（23:00-24:00）日柱口径测试。
 *
 * 金标准四柱来自 team-lead 实测基准（tyme4ts / lunar-javascript 交叉验证），
 * 直接采用，不自行推算。
 *
 * 关键断言：
 * - 四柱全断 + timeIndex（五项齐断），不只断三项。
 * - 立春当日 23:30 一条同时抓「年/月柱被误改」与「日/时柱没改」两个反方向 bug。
 * - 五鼠遁一致性：时干必须由日干推出（戊日壬子、己日甲子），专门堵
 *   「日柱回退但时柱不随动」的破裂盘盲区。
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '@core/bazi/baziCalculator';

const ganZhi = (p: { gan: string; zhi: string }) => `${p.gan}${p.zhi}`;

// 五鼠遁：日干 → 子时（时辰索引 12）时柱。
const WUXU_DUN_ZI_SHI: Record<string, string> = {
  甲: '甲子',
  己: '甲子',
  乙: '丙子',
  庚: '丙子',
  丙: '戊子',
  辛: '戊子',
  丁: '庚子',
  壬: '庚子',
  戊: '壬子',
  癸: '壬子',
};

test('§16 晚子时:2024-03-15 23:30 standard=next-day / conservative=current-day', () => {
  const standard = baziCalculator.calculateBazi({
    year: 2024,
    month: 3,
    day: 15,
    timeIndex: 12,
    gender: 'male',
  });
  assert.equal(ganZhi(standard.pillars.year), '甲辰');
  assert.equal(ganZhi(standard.pillars.month), '丁卯');
  assert.equal(ganZhi(standard.pillars.day), '己卯'); // next-day
  assert.equal(ganZhi(standard.pillars.hour), '甲子');
  assert.equal(standard.timeInfo.index, 12); // 晚子时 = 子
  // 五鼠遁自洽：己日 → 甲子
  assert.equal(ganZhi(standard.pillars.hour), WUXU_DUN_ZI_SHI[standard.pillars.day.gan]);

  const conservative = baziCalculator.calculateBazi({
    year: 2024,
    month: 3,
    day: 15,
    timeIndex: 12,
    gender: 'male',
    ziHourMode: 'conservative',
  });
  assert.equal(ganZhi(conservative.pillars.year), '甲辰');
  assert.equal(ganZhi(conservative.pillars.month), '丁卯');
  assert.equal(ganZhi(conservative.pillars.day), '戊寅'); // 当日(回退)
  assert.equal(ganZhi(conservative.pillars.hour), '壬子'); // 戊日壬子
  assert.equal(conservative.timeInfo.index, 12);
  // 五鼠遁自洽：戊日 → 壬子（堵「日退时不退」破裂盘）
  assert.equal(ganZhi(conservative.pillars.hour), WUXU_DUN_ZI_SHI[conservative.pillars.day.gan]);
});

test('§16 立春当日晚子时:年/月柱不得误改(conservative 只换日/时两柱)', () => {
  // 2024 立春 = 2-4 16:27；23:30 已过节 → 年甲辰 月丙寅。
  // conservative 晚子时归当日 00:30（立春前）→ 日戊戌 时壬子，
  // 但年/月柱必须保留 23:30 的甲辰/丙寅，不得回退为癸卯/乙丑。
  const conservative = baziCalculator.calculateBazi({
    year: 2024,
    month: 2,
    day: 4,
    timeIndex: 12,
    gender: 'male',
    ziHourMode: 'conservative',
  });
  assert.equal(ganZhi(conservative.pillars.year), '甲辰'); // 不得回退为癸卯
  assert.equal(ganZhi(conservative.pillars.month), '丙寅'); // 不得回退为乙丑
  assert.equal(ganZhi(conservative.pillars.day), '戊戌');
  assert.equal(ganZhi(conservative.pillars.hour), '壬子');
  assert.equal(ganZhi(conservative.pillars.hour), WUXU_DUN_ZI_SHI[conservative.pillars.day.gan]);
});

test('§16 跨年晚子时:2024-12-31 23:30 conservative 当日', () => {
  const conservative = baziCalculator.calculateBazi({
    year: 2024,
    month: 12,
    day: 31,
    timeIndex: 12,
    gender: 'male',
    ziHourMode: 'conservative',
  });
  assert.equal(ganZhi(conservative.pillars.year), '甲辰');
  assert.equal(ganZhi(conservative.pillars.month), '丙子');
  assert.equal(ganZhi(conservative.pillars.day), '己巳');
  assert.equal(ganZhi(conservative.pillars.hour), '甲子');
  assert.equal(ganZhi(conservative.pillars.hour), WUXU_DUN_ZI_SHI[conservative.pillars.day.gan]);
});

test('§16 亥时不受影响:2024-03-15 22:30 conservative==standard', () => {
  // 22:30 是亥时（timeIndex 11），不属于晚子时，conservative 不改变任何柱。
  const standard = baziCalculator.calculateBazi({
    year: 2024,
    month: 3,
    day: 15,
    timeIndex: 11,
    gender: 'male',
  });
  const conservative = baziCalculator.calculateBazi({
    year: 2024,
    month: 3,
    day: 15,
    timeIndex: 11,
    gender: 'male',
    ziHourMode: 'conservative',
  });
  assert.equal(ganZhi(standard.pillars.day), '戊寅');
  assert.equal(ganZhi(standard.pillars.hour), '癸亥');
  assert.equal(ganZhi(conservative.pillars.day), ganZhi(standard.pillars.day));
  assert.equal(ganZhi(conservative.pillars.hour), ganZhi(standard.pillars.hour));
});
