import assert from 'node:assert/strict';
import test from 'node:test';

import { generateTaiyi } from '../packages/core/src/taiyi/index.ts';

// 《武经总要》后集卷二十、《太乙秘书》与《太乙金镜式经》阴局立成：
// https://zh.wikisource.org/wiki/武經總要/後集/卷二十
// https://zh.wikisource.org/wiki/太乙秘書
// https://www.kanripo.org/text/KR3g0047/003
test('夏至后实际时计的阴遁局式按宫目、算数和将参逐项校核', () => {
  const first = Date.parse('2026-06-25T00:30:00+08:00');
  const examples = [
    // 局数、太乙宫、天目、始击、主算、客算、主将参、客将参、计神。
    [4, 8, '巽', '丑', 25, 33, 5, 5, 3, 9, '巳'],
    [30, 8, '戌', '申', 2, 8, 2, 6, 8, 4, '卯'],
    [33, 7, '子', '艮', 26, 18, 6, 8, 8, 4, '子'],
    [34, 6, '丑', '卯', 26, 22, 6, 8, 2, 6, '亥'],
    [48, 1, '戌', '寅', 1, 29, 1, 3, 9, 7, '酉'],
    [51, 9, '子', '坤', 15, 29, 5, 5, 9, 7, '午'],
    [52, 8, '丑', '酉', 33, 7, 3, 9, 7, 1, '巳'],
    [61, 4, '午', '亥', 27, 12, 7, 1, 2, 6, '申'],
    [62, 4, '未', '艮', 26, 3, 6, 8, 3, 9, '未'],
    [64, 3, '申', '巽', 16, 33, 6, 8, 3, 9, '巳'],
    [66, 3, '戌', '申', 10, 16, 1, 3, 6, 8, '卯'],
    [72, 1, '艮', '午', 31, 15, 1, 3, 5, 5, '酉'],
  ] as const;

  for (const [
    bureau,
    taiyiPalace,
    wenChangPosition,
    shiJiPosition,
    lordCount,
    guestCount,
    lordGeneral,
    lordAssistant,
    guestGeneral,
    guestAssistant,
    jiShenPosition,
  ] of examples) {
    const date = new Date(first + (bureau - 1) * 2 * 60 * 60 * 1000);
    const result = generateTaiyi({ scope: 'hour', date });
    assert.equal(result.yinYang, '阴遁', date.toISOString());
    assert.deepEqual(
      [
        result.bureau,
        result.taiyiPalace,
        result.wenChangPosition,
        result.shiJiPosition,
        result.lordCount,
        result.guestCount,
        result.lordGeneral,
        result.lordAssistant,
        result.guestGeneral,
        result.guestAssistant,
        result.jiShenPosition,
      ],
      [
        bureau,
        taiyiPalace,
        wenChangPosition,
        shiJiPosition,
        lordCount,
        guestCount,
        lordGeneral,
        lordAssistant,
        guestGeneral,
        guestAssistant,
        jiShenPosition,
      ],
      date.toISOString(),
    );
    assert.ok(result.prompt.includes(`阴遁第 ${bureau} 局`));
    assert.ok(result.prompt.includes(`文昌（主目）在${wenChangPosition}`));
    assert.ok(result.prompt.includes(`始击（客目）在${shiJiPosition}`));
    assert.ok(result.prompt.includes(`主算 ${lordCount}`));
    assert.ok(result.prompt.includes(`客算 ${guestCount}`));
  }
});

// 《太乙金镜式经》卷二的逐宫行算与卷三阴局立成：
// https://www.kanripo.org/text/KR3g0047/002
// https://www.kanripo.org/text/KR3g0047/003
test('阴九、十局按客目至太乙宫逐宫计数并同步客将参', () => {
  for (const [
    date,
    bureau,
    taiyiPalace,
    shiJiPosition,
    guestCount,
    guestGeneral,
    guestAssistant,
  ] of [
    ['2026-06-25T08:30:00Z', 9, 7, '酉', 33, 3, 9],
    ['2026-06-25T10:30:00Z', 10, 6, '乾', 34, 4, 2],
  ] as const) {
    const result = generateTaiyi({ scope: 'hour', date: new Date(date) });
    assert.equal(result.yinYang, '阴遁');
    assert.equal(result.bureau, bureau);
    assert.equal(result.taiyiPalace, taiyiPalace);
    assert.equal(result.shiJiPosition, shiJiPosition);
    assert.equal(result.guestCount, guestCount);
    assert.equal(result.guestGeneral, guestGeneral);
    assert.equal(result.guestAssistant, guestAssistant);
    assert.ok(result.prompt.includes(`客算 ${guestCount}`));
    assert.ok(result.prompt.includes(`客大将${guestGeneral}宫`));
    assert.ok(result.prompt.includes(`客参将${guestAssistant}宫`));
  }
});

test('阳四十四局按天目丑至太乙子逐宫计主算三十三', () => {
  const result = generateTaiyi({ scope: 'hour', date: new Date('2025-12-24T05:00:00Z') });
  assert.equal(result.yinYang, '阳遁');
  assert.equal(result.bureau, 44);
  assert.equal(result.taiyiPalace, 8);
  assert.equal(result.wenChangPosition, '丑');
  assert.equal(result.lordCount, 33);
  assert.equal(result.lordGeneral, 3);
  assert.equal(result.lordAssistant, 9);
  assert.ok(result.prompt.includes('主算 33'));
});

test('阳遁三十和六十六局的始击也按《太乙秘书》武德定位', () => {
  for (const [year, bureau] of [
    [2001, 30],
    [1965, 66],
  ] as const) {
    const result = generateTaiyi({ scope: 'year', year });
    assert.equal(result.yinYang, '阳遁');
    assert.equal(result.bureau, bureau);
    assert.equal(result.shiJiPosition, '申');
    assert.ok(result.prompt.includes('始击（客目）在申'));
  }
});
