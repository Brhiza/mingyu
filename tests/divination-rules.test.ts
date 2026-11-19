import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { getQimenJuShu } from '../src/systems/qimen/jushu';
import { getNoblemanBranch } from '../src/systems/liuren/plate';

const question = '此事吉凶如何？';

test('奇门茅山道人法：按交节瞬时每五日换元，不寻符头超神接气', async () => {
  // 2025年立春交节：2025-02-03 22:10:13（北京时间），立春阳遁 [8, 5, 2]
  const upper = getQimenJuShu({ year: 2025, month: 2, day: 4, hour: 12, minute: 0, second: 0 }, 'maoshan');
  assert.equal(upper.juMethod, 'maoshan');
  assert.equal(upper.isYangDun, true);
  assert.equal(upper.yuan, '上元');
  assert.equal(upper.juShu, 8);
  assert.equal(upper.fuTou, undefined);
  assert.equal(upper.chaoShenOrJieQi, undefined);
  assert.equal(upper.isZhiRun, false);

  const middle = getQimenJuShu({ year: 2025, month: 2, day: 9, hour: 12, minute: 0, second: 0 }, 'maoshan');
  assert.equal(middle.yuan, '中元');
  assert.equal(middle.juShu, 5);

  const lower = getQimenJuShu({ year: 2025, month: 2, day: 15, hour: 12, minute: 0, second: 0 }, 'maoshan');
  assert.equal(lower.yuan, '下元');
  assert.equal(lower.juShu, 2);

  const saved = JSON.parse(JSON.stringify(await calculate('qimen', {
    question,
    divinationTime: '2025-02-09T04:00:00Z',
    qimen: { juMethod: 'maoshan' },
  })));
  assert.equal(saved.data.juMethod, 'maoshan');
  assert.equal(saved.data.juShu, 5);
  const resumed = await reprompt({ method: 'qimen', result: saved, question: '再问', currentTime: '2025-02-09T05:00:00Z' });
  assert.match(resumed.prompt.text, /茅山道人法/);

  const tampered = structuredClone(saved);
  tampered.data.juMethod = 'chaibu';
  await assert.rejects(() => reprompt({ method: 'qimen', result: tampered, question }));
});

test('奇门中五宫寄宫口径：默认 kun2 寄坤二，yang-gen8-yin-kun2 阳遁寄艮八、阴遁寄坤二', async () => {
  const yangTime = '2025-02-04T04:00:00Z'; // 立春阳遁
  const defaultChart = await calculate('qimen', { question, divinationTime: yangTime });
  const explicitKun2 = await calculate('qimen', { question, divinationTime: yangTime, qimen: { juMethod: 'chaibu', centerPalace: 'kun2' } });
  assert.deepEqual(explicitKun2.data.jiuGongGe, defaultChart.data.jiuGongGe);
  assert.equal('centerPalace' in defaultChart.data, false);

  const kun2Companion = defaultChart.data.jiuGongGe.find((g: any) => g.tianPan.companionStar === '天禽');
  assert.equal(kun2Companion?.tianPan.star, '天芮');

  const yangGen8 = JSON.parse(JSON.stringify(await calculate('qimen', {
    question,
    divinationTime: yangTime,
    qimen: { centerPalace: 'yang-gen8-yin-kun2' },
  })));
  assert.equal(yangGen8.data.centerPalace, 'yang-gen8-yin-kun2');
  const gen8Companion = yangGen8.data.jiuGongGe.find((g: any) => g.tianPan.companionStar === '天禽');
  assert.equal(gen8Companion?.tianPan.star, '天任');

  // 阴遁仍寄坤二
  const yinGen8 = await calculate('qimen', {
    question,
    divinationTime: '2025-07-01T04:00:00Z',
    qimen: { centerPalace: 'yang-gen8-yin-kun2' },
  });
  assert.equal(yinGen8.data.isYangDun, false);
  const yinCompanion = yinGen8.data.jiuGongGe.find((g: any) => g.tianPan.companionStar === '天禽');
  assert.equal(yinCompanion?.tianPan.star, '天芮');

  const resumed = await reprompt({ method: 'qimen', result: yangGen8, question: '复核' });
  assert.ok(resumed.prompt.text.includes('奇门'));

  const tamperedDelete = structuredClone(yangGen8);
  delete tamperedDelete.data.centerPalace;
  await assert.rejects(() => reprompt({ method: 'qimen', result: tamperedDelete, question }));

  const tamperedInvalid = structuredClone(yangGen8);
  tamperedInvalid.data.centerPalace = 'kun2';
  await assert.rejects(() => reprompt({ method: 'qimen', result: tamperedInvalid, question }));
});

test('大六壬贵人起例口诀：默认甲戊庚牛羊，古本甲羊戊庚牛，追问核验防篡改', async () => {
  assert.equal(getNoblemanBranch('甲', '昼占'), '丑');
  assert.equal(getNoblemanBranch('甲', '夜占'), '未');
  assert.equal(getNoblemanBranch('甲', '昼占', 'jia-yang-wu-geng-niu'), '未');
  assert.equal(getNoblemanBranch('甲', '夜占', 'jia-yang-wu-geng-niu'), '丑');
  assert.equal(getNoblemanBranch('戊', '昼占', 'jia-yang-wu-geng-niu'), '丑');
  assert.equal(getNoblemanBranch('庚', '夜占', 'jia-yang-wu-geng-niu'), '未');

  // 2025-01-05 为甲日（需昼占时辰，北京时间 12:00）
  const dayTime = '2025-01-05T04:00:00Z';
  const def = await calculate('liuren', { question, divinationTime: dayTime });
  assert.equal(def.data.ganzhi.day[0], '甲');
  assert.equal(def.data.dayNight, '昼占');
  assert.equal(def.data.noblemanBranch, '丑');
  assert.equal('guiRenTable' in def.data, false);

  const old = JSON.parse(JSON.stringify(await calculate('liuren', {
    question,
    divinationTime: dayTime,
    liuren: { guiRenTable: 'jia-yang-wu-geng-niu' },
  })));
  assert.equal(old.data.guiRenTable, 'jia-yang-wu-geng-niu');
  assert.equal(old.data.noblemanBranch, '未');

  const resumed = await reprompt({ method: 'liuren', result: old, question: '追问' });
  assert.ok(resumed.prompt.text.includes('未'));

  const tampered = structuredClone(old);
  delete tampered.data.guiRenTable;
  await assert.rejects(() => reprompt({ method: 'liuren', result: tampered, question }));

  const tamperedInvalid = structuredClone(old);
  tamperedInvalid.data.guiRenTable = 'unknown';
  await assert.rejects(() => reprompt({ method: 'liuren', result: tamperedInvalid, question }));
});

test('六爻早晚子时换日口径：默认 23:00 换日柱，00:00 在23点仍用当日日柱，追问核验防篡改', async () => {
  // 2025-01-01T15:30:00Z = 北京时间 2025-01-01 23:30:00
  const lateZi = '2025-01-01T15:30:00Z';
  const earlierSameDay = '2025-01-01T13:30:00Z'; // 21:30 UTC+8

  const sameDayChart = await calculate('liuyao', { question, divinationTime: earlierSameDay, liuyao: { method: 'manual', yaos: [7, 8, 7, 8, 7, 8] } });
  const defaultLateZi = await calculate('liuyao', { question, divinationTime: lateZi, liuyao: { method: 'manual', yaos: [7, 8, 7, 8, 7, 8] } });
  assert.notEqual(defaultLateZi.data.ganzhi.day, sameDayChart.data.ganzhi.day);
  assert.equal('ziHourMode' in defaultLateZi.data, false);

  const zeroHourLateZi = JSON.parse(JSON.stringify(await calculate('liuyao', {
    question,
    divinationTime: lateZi,
    liuyao: { method: 'manual', yaos: [7, 8, 7, 8, 7, 8], ziHourMode: '00:00' },
  })));
  assert.equal(zeroHourLateZi.data.ziHourMode, '00:00');
  assert.equal(zeroHourLateZi.data.ganzhi.day, sameDayChart.data.ganzhi.day);

  const resumed = await reprompt({ method: 'liuyao', result: zeroHourLateZi, question: '追问' });
  assert.ok(resumed.prompt.text.includes(sameDayChart.data.ganzhi.day));

  const tampered = structuredClone(zeroHourLateZi);
  delete tampered.data.ziHourMode;
  await assert.rejects(() => reprompt({ method: 'liuyao', result: tampered, question }));

  const tamperedInvalid = structuredClone(zeroHourLateZi);
  tamperedInvalid.data.ziHourMode = '23:30';
  await assert.rejects(() => reprompt({ method: 'liuyao', result: tamperedInvalid, question }));
});

test('奇门全飞盘（feipanMode=all-fly）、小六壬三数与换日闰月口径、金口诀古本贵人及七政立命交点口径', async () => {
  const time = '2025-02-04T04:00:00Z';
  const feipanStarOnly = await calculate('qimen', { question, divinationTime: time, qimen: { method: 'feipan', feipanMode: 'star-only' } });
  const feipanAllFly = JSON.parse(JSON.stringify(await calculate('qimen', { question, divinationTime: time, qimen: { method: 'feipan', feipanMode: 'all-fly' } })));
  assert.equal(feipanAllFly.data.feipanMode, 'all-fly');
  assert.equal(feipanAllFly.data.jiuGongGe.some((g: any) => g.shenPan.god === '太常'), true);
  assert.equal(feipanStarOnly.data.jiuGongGe.some((g: any) => g.shenPan.god === '太常'), false);
  const qimenResumed = await reprompt({ method: 'qimen', result: feipanAllFly, question: '追问' });
  assert.ok(qimenResumed.prompt.text.includes('飞盘法'));

  // 小六壬三数起课法与晚子时换日
  const xlrNumbers = JSON.parse(JSON.stringify(await calculate('xiaoliuren', {
    question,
    divinationTime: '2025-01-01T15:30:00Z',
    xiaoliuren: { numbers: [3, 5, 2], ziHourMode: '23:00', leapMonthMode: 'split-15' },
  })));
  assert.equal(xlrNumbers.data.method, 'numbers');
  assert.equal(xlrNumbers.data.calculation.monthCount, 3);
  assert.equal(xlrNumbers.data.calculation.dayCount, 7);
  assert.equal(xlrNumbers.data.calculation.hourCount, 8);
  const xlrResumed = await reprompt({ method: 'xiaoliuren', result: xlrNumbers, question: '追问' });
  assert.ok(xlrResumed.prompt.text.includes('晚子时'));

  // 金口诀古本贵人口诀
  const jkjOld = JSON.parse(JSON.stringify(await calculate('jinkoujue', {
    question,
    divinationTime: '2025-01-05T04:00:00Z', // 甲日昼占
    jinkoujue: { guiRenTable: 'jia-yang-wu-geng-niu' },
  })));
  assert.equal(jkjOld.data.guiRenTable, 'jia-yang-wu-geng-niu');
  assert.equal(jkjOld.data.noblemanBranch, '未');
  const jkjResumed = await reprompt({ method: 'jinkoujue', result: jkjOld, question: '追问' });
  assert.ok(jkjResumed.prompt.text.includes('未'));

  // 七政四余真/平交点与地平上升点（ASC）立命
  const qizhengAsc = JSON.parse(JSON.stringify(await calculate('qizheng', {
    question,
    birth: { year: 1990, month: 5, day: 15, hour: 14, minute: 30, second: 0, latitude: 39.9042, longitude: 116.4074, timezone: 8 },
    options: { mingGongMethod: 'ascendant', nodeModel: 'mean' },
  })));
  assert.equal(qizhengAsc.data.mingDu.method, '地平真上升点（ASC）立命');
  assert.equal(qizhengAsc.data.stars.find((s: any) => s.name === '罗睺(火余)').source, 'Moshier 平均月交点');
  const qizhengResumed = await reprompt({ method: 'qizheng', result: qizhengAsc, question: '追问' });
  assert.match(qizhengResumed.prompt.text, /地平真上升点（ASC）立命度/);
});
