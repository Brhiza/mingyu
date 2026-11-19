import assert from 'node:assert/strict';
import test from 'node:test';
import { baziIndependent } from '../src/systems/bazi';
import { baziSynastryIndependent } from '../src/systems/bazi-synastry';
import { ziweiIndependent } from '../src/systems/ziwei';
import { ziweiSynastryIndependent } from '../src/systems/ziwei-synastry';
import { baziZiweiIndependent } from '../src/systems/bazi-ziwei';
import { minglu } from '../src/systems/minglu';
import { qizheng } from '../src/systems/qizheng';
import { qizhengRange } from '../src/systems/qizheng-range';
import { astrolabeIndependent } from '../src/systems/astrolabe';
import { astrolabeRange } from '../src/systems/astrolabe-range';
import { astrolabeSynastryIndependent } from '../src/systems/astrolabe-synastry';

const solarBirth = {
  calendar: 'solar' as const,
  year: 1990,
  month: 5,
  day: 15,
  timezone: 8,
  clock: { kind: 'exact' as const, hour: 10, minute: 30, second: 0 },
};

const astroBirth = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 10,
  minute: 30,
  second: 0,
  latitude: 31.23,
  longitude: 121.47,
  timezone: 8,
};

test('bazi 与 bazi-synastry 按需输出【典籍片段】且默认不变', async () => {
  const without = await baziIndependent({ birth: solarBirth, gender: 'male', question: '总论' });
  assert.ok(!without.prompt.text.includes('【典籍片段】'));

  const withClassics = await baziIndependent({
    birth: solarBirth,
    gender: 'male',
    question: '总论',
    prompt: { includeClassics: true },
  });
  assert.ok(withClassics.prompt.text.includes('【典籍片段】'));
  assert.ok(withClassics.prompt.text.includes('《滴天髓·论天干》'));

  const syn = await baziSynastryIndependent({
    person1: solarBirth,
    person2: solarBirth,
    question: '合盘',
    prompt: { includeClassics: true },
  });
  assert.ok(syn.prompt.text.includes('【典籍片段】'));
  assert.equal(syn.prompt.text.match(/《滴天髓·论天干》/g)?.length, 1);
});

test('ziwei 与 ziwei-synastry 按需输出【典籍片段】', async () => {
  const without = await ziweiIndependent({ birth: solarBirth, gender: 'male', question: '总论' });
  assert.ok(!without.prompt.text.includes('【典籍片段】'));

  const withClassics = await ziweiIndependent({
    birth: solarBirth,
    gender: 'male',
    question: '总论',
    prompt: { includeClassics: true },
  });
  assert.ok(withClassics.prompt.text.includes('【典籍片段】'));
  assert.ok(withClassics.prompt.text.includes('《紫微斗数全书'));

  const syn = await ziweiSynastryIndependent({
    person1: { birth: solarBirth, gender: 'male' },
    person2: { birth: solarBirth, gender: 'female' },
    question: '合盘',
    prompt: { includeClassics: true },
  });
  assert.ok(syn.prompt.text.includes('【典籍片段】'));
});

test('bazi-ziwei 与 minglu 合并并去重典籍片段', async () => {
  const bzZw = await baziZiweiIndependent({
    birth: solarBirth,
    gender: 'male',
    question: '合参',
    prompt: { includeClassics: true },
  });
  assert.ok(bzZw.prompt.text.includes('【典籍片段】'));
  assert.ok(bzZw.prompt.text.includes('《滴天髓·论天干》'));
  assert.ok(bzZw.prompt.text.includes('《紫微斗数全书'));

  const ml = await minglu({
    birth: solarBirth,
    gender: 'male',
    question: '命录',
    house: { kind: 'mountain', sitMountain: '壬' },
    include: { ziwei: true, bazhai: true },
    prompt: { includeClassics: true },
  });
  assert.ok(ml.prompt.text.includes('【典籍片段】'));
  assert.ok(ml.prompt.text.includes('《滴天髓·论天干》'));
  assert.ok(ml.prompt.text.includes('《紫微斗数全书'));
  assert.ok(ml.prompt.text.includes('《八宅明镜'));
});

test('qizheng 与 qizheng-range 支持流派与典籍片段', async () => {
  const without = await qizheng({ birth: astroBirth, question: '本命' });
  assert.ok(!without.prompt.text.includes('【解读口径】'));
  assert.ok(!without.prompt.text.includes('【典籍片段】'));

  const withBoth = await qizheng({
    birth: astroBirth,
    question: '本命',
    prompt: { schools: ['guolao', 'qintang'], includeClassics: true },
  });
  assert.ok(withBoth.prompt.text.includes('【解读口径】'));
  assert.ok(withBoth.prompt.text.includes('果老星宗'));
  assert.ok(withBoth.prompt.text.includes('琴堂派'));
  assert.ok(withBoth.prompt.text.includes('【典籍片段】'));
  assert.ok(withBoth.prompt.text.includes('《果老星宗·十一曜定局》太阳'));

  const rangeRes = await qizhengRange({
    birth: astroBirth,
    range: { start: '1990-05-15T02:30:00Z', end: '1990-05-15T02:30:02Z' },
    question: '范围',
    prompt: { schools: ['guolao'], includeClassics: true },
  });
  assert.ok(rangeRes.prompt.text.includes('【解读口径】'));
  assert.equal(rangeRes.prompt.text.match(/【典籍片段】/g)?.length, 1);
});

test('astrolabe、astrolabe-range 与 astrolabe-synastry 按需输出西洋占星典籍片段', async () => {
  const without = await astrolabeIndependent({ birth: astroBirth, question: '本命' });
  assert.ok(!without.prompt.text.includes('【典籍片段】'));

  const withClassics = await astrolabeIndependent({
    birth: astroBirth,
    question: '本命',
    prompt: { includeClassics: true },
  });
  assert.ok(withClassics.prompt.text.includes('【典籍片段】'));
  assert.ok(withClassics.prompt.text.includes('《四书（Tetrabiblos）'));
  assert.ok(withClassics.prompt.text.includes('《基督教占星学（Christian Astrology）'));

  const rangeRes = await astrolabeRange({
    birth: astroBirth,
    range: { start: '1990-05-15T02:30:00Z', end: '1990-05-15T02:30:02Z' },
    question: '范围',
    prompt: { includeClassics: true },
  });
  assert.equal(rangeRes.prompt.text.match(/【典籍片段】/g)?.length, 1);

  const syn = await astrolabeSynastryIndependent({
    person1: astroBirth,
    person2: astroBirth,
    question: '合盘',
    prompt: { includeClassics: true },
  });
  assert.ok(syn.prompt.text.includes('【典籍片段】'));
  assert.ok(syn.prompt.text.includes('《四书（Tetrabiblos）'));
});
