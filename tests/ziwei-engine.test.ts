import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { buildZiweiAstrolabe, buildZiweiHoroscope } from '../src/systems/ziwei/index';
import {
  applyGlobalRulesToPayload,
  DEFAULT_GLOBAL_RULES,
  GLOBAL_RULE_SECTIONS,
  loadGlobalRules,
  saveGlobalRules,
} from '../src/web-settings';

test('自研紫微引擎：十四主星与十四辅星完整唯一，默认派与中州派规则准确区分', () => {
  const defaultChart = buildZiweiAstrolabe({
    solarDate: '1990-05-15',
    timeIndex: 7,
    gender: 'male',
    rules: { algorithm: 'default' },
  });
  const zhongzhouChart = buildZiweiAstrolabe({
    solarDate: '1990-05-15',
    timeIndex: 7,
    gender: 'male',
    rules: { algorithm: 'zhongzhou' },
  });

  const allMajors = defaultChart.palaces.flatMap((p) => p.majorStars.map((s) => s.name));
  const allMinors = defaultChart.palaces.flatMap((p) => p.minorStars.map((s) => s.name));
  assert.equal(allMajors.length, 14);
  assert.equal(new Set(allMajors).size, 14);
  assert.equal(allMinors.length, 14);
  assert.equal(new Set(allMinors).size, 14);

  const defaultAdj = new Set(defaultChart.palaces.flatMap((p) => p.adjectiveStars.map((s) => s.name)));
  const zhongzhouAdj = new Set(zhongzhouChart.palaces.flatMap((p) => p.adjectiveStars.map((s) => s.name)));
  assert.ok(defaultAdj.has('截路') && defaultAdj.has('空亡'));
  assert.ok(!defaultAdj.has('截空') && !defaultAdj.has('劫杀'));
  assert.ok(zhongzhouAdj.has('龙德') && zhongzhouAdj.has('截空') && zhongzhouAdj.has('劫杀') && zhongzhouAdj.has('大耗'));
  assert.ok(!zhongzhouAdj.has('截路') && !zhongzhouAdj.has('空亡'));

  // 1990 庚午年（阳年）未时男命：命宫戌(禄存)、年支午(破军)，中州派命主取年支
  assert.equal(defaultChart.earthlyBranchOfSoulPalace, '戌');
  assert.equal(defaultChart.soul, '禄存');
  assert.equal(zhongzhouChart.soul, '破军');
  assert.ok(defaultChart.palaces.some((p) => p.suiqian12 === '大耗'));
  assert.ok(zhongzhouChart.palaces.some((p) => p.suiqian12 === '岁破'));

  // 1991 辛未年（阴年）男命（阴男）：中州派天使天伤互换
  const yinMaleDefault = buildZiweiAstrolabe({ solarDate: '1991-06-15', timeIndex: 5, gender: 'male', rules: { algorithm: 'default' } });
  const yinMaleZhongzhou = buildZiweiAstrolabe({ solarDate: '1991-06-15', timeIndex: 5, gender: 'male', rules: { algorithm: 'zhongzhou' } });
  const findAdj = (chart: typeof yinMaleDefault, name: string) => chart.palaces.find((p) => p.adjectiveStars.some((s) => s.name === name))!.name;
  assert.equal(findAdj(yinMaleDefault, '天伤'), '仆役');
  assert.equal(findAdj(yinMaleDefault, '天使'), '疾厄');
  assert.equal(findAdj(yinMaleZhongzhou, '天伤'), '疾厄');
  assert.equal(findAdj(yinMaleZhongzhou, '天使'), '仆役');
});

test('自研紫微引擎：exact 口径按真实立春交节瞬时分界，与八字同源精确对齐', async () => {
  const beforeLichun = await calculate('ziwei', {
    question: '立春前',
    birth: { year: 2024, month: 2, day: 4, clock: { kind: 'exact', hour: 16, minute: 0, second: 0 }, timezone: 8 },
    gender: 'female',
    rules: { yearDivide: 'exact', horoscopeDivide: 'exact' },
  });
  const afterLichun = await calculate('ziwei', {
    question: '立春后',
    birth: { year: 2024, month: 2, day: 4, clock: { kind: 'exact', hour: 16, minute: 45, second: 0 }, timezone: 8 },
    gender: 'female',
    rules: { yearDivide: 'exact', horoscopeDivide: 'exact' },
  });

  assert.equal(beforeLichun.data.natal.chineseDate, '癸卯 乙丑 戊戌 庚申');
  assert.equal(afterLichun.data.natal.chineseDate, '甲辰 丙寅 戊戌 庚申');
});

test('自研紫微引擎：突破 1900–2100 限制，支持古代日期及 2101+ 十年流年时间线无截断', async () => {
  const ancient = buildZiweiAstrolabe({ solarDate: '1850-05-15', timeIndex: 6, gender: 'male' });
  assert.equal(ancient.zodiac, '狗');
  assert.equal(ancient.palaces.length, 12);
  const ancientHoro = buildZiweiHoroscope(ancient, '1880-05-15', 6);
  assert.equal(ancientHoro.age.nominalAge, 31);

  const future = await calculate('ziwei', {
    question: '2105 年流年如何？',
    birth: { year: 1995, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
    gender: 'female',
    referenceTime: '2105-05-15T06:00:00Z',
    includeTimeline: true,
  });
  const yearlyTimeline = future.data.reference!.yearlyTimeline!;
  assert.equal(yearlyTimeline.length, 10);
  const uniqueGanZhi = new Set(yearlyTimeline.map((item) => item.ganZhi));
  assert.equal(uniqueGanZhi.size, 10);
  assert.ok(yearlyTimeline.some((item) => item.solarYear === 2105 && item.isReferenceAge));
});

test('自研紫微引擎：完全无全局状态，多口径并发交叉调用互不干扰', async () => {
  const results = await Promise.all([
    calculate('ziwei', {
      question: '并发默认',
      birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
      gender: 'female',
      rules: { algorithm: 'default', yearDivide: 'normal' },
    }),
    calculate('ziwei', {
      question: '并发中州',
      birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
      gender: 'female',
      rules: { algorithm: 'zhongzhou', yearDivide: 'exact' },
    }),
    calculate('ziwei', {
      question: '并发默认对照',
      birth: { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 },
      gender: 'female',
      rules: { algorithm: 'default', yearDivide: 'normal' },
    }),
  ]);
  assert.deepEqual(results[0].data.natal, results[2].data.natal);
  assert.notDeepEqual(results[0].data.natal.soul, results[1].data.natal.soul);
});

test('多流派四化表、闰月折算、三盘与月马扩展规则准确生效且支持追问', async () => {
  const birth = { year: 2023, month: 3, day: 22, clock: { kind: 'exact' as const, hour: 12, minute: 0, second: 0 }, timezone: 8 };
  // 2023-03-22 为农历闰二月初一：split-15 与 same 按二月，next 按三月
  const [splitChart, sameFalse, nextChart] = await Promise.all([
    calculate('ziwei', { question: '闰月分界', birth, gender: 'female', rules: { leapMonthMode: 'split-15' } }),
    calculate('ziwei', { question: '旧参数兼容', birth, gender: 'female', rules: { fixLeap: false } }),
    calculate('ziwei', { question: '闰月归下月', birth, gender: 'female', rules: { leapMonthMode: 'next' } }),
  ]);
  assert.equal(splitChart.data.natal.soulBranch, sameFalse.data.natal.soulBranch);
  assert.equal(sameFalse.data.basis.rules.leapMonthMode, 'same');
  assert.notEqual(nextChart.data.natal.soulBranch, splitChart.data.natal.soulBranch);
  assert.match(nextChart.prompt.text, /闰月按次月处理/);

  // 1990 庚午年：比较通行四化（庚：阳武阴同）与中州四化（庚：阳武同相）、全书四化（庚：阳武同阴）、天府科四化（庚：阳武府同）
  const base1990 = { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const [defM, zzM, qsM, tfM] = await Promise.all(['default', 'zhongzhou', 'quanshu', 'tianfu'].map((mutagenSchool) =>
    calculate('ziwei', { question: '四化流派', birth: base1990, gender: 'male', rules: { mutagenSchool: mutagenSchool as any } }),
  ));
  const findStarMutagen = (res: typeof defM, name: string) =>
    res.data.natal.palaces.flatMap((p: any) => [...p.majorStars, ...p.minorStars]).find((s: any) => s.name === name)?.mutagen;
  assert.equal(findStarMutagen(defM, '太阴'), '科');
  assert.equal(findStarMutagen(defM, '天同'), '忌');
  assert.equal(findStarMutagen(zzM, '天同'), '科');
  assert.equal(findStarMutagen(zzM, '天相'), '忌');
  assert.equal(findStarMutagen(qsM, '太阴'), '忌');
  assert.equal(findStarMutagen(tfM, '天府'), '科');

  // 天地人三盘：地盘命宫落在原身宫地支，人盘命宫落在原福德宫地支
  const [heaven, earth, human] = await Promise.all(['heaven', 'earth', 'human'].map((plateType) =>
    calculate('ziwei', { question: '三盘校验', birth: base1990, gender: 'male', rules: { plateType: plateType as any } }),
  ));
  assert.equal(earth.data.natal.soulBranch, heaven.data.natal.bodyBranch);
  const fudeBranch = heaven.data.natal.palaces.find((p: any) => p.name === '福德')!.earthlyBranch;
  assert.equal(human.data.natal.soulBranch, fudeBranch);
  assert.match(earth.prompt.text, /地盘（身宫立极）/);
  assert.match(human.prompt.text, /人盘（福德立极）/);

  // 月马、北派及追问核对
  const [yearMa, monthMa, beipai] = await Promise.all([
    calculate('ziwei', { question: '年马', birth: base1990, gender: 'male', rules: { tianmaMode: 'year' } }),
    calculate('ziwei', { question: '月马', birth: base1990, gender: 'male', rules: { tianmaMode: 'month' } }),
    calculate('ziwei', {
      question: '北派飞星',
      birth: base1990,
      gender: 'male',
      referenceTime: '2025-05-15T06:00:00Z',
      rules: { algorithm: 'beipai' },
      prompt: { scope: 'yearly', schools: ['feixing'] },
    }),
  ]);
  const maBranch = (res: typeof yearMa) => res.data.natal.palaces.find((p: any) => p.minorStars.some((s: any) => s.name === '天马'))!.earthlyBranch;
  assert.equal(maBranch(yearMa), '申');
  assert.equal(maBranch(monthMa), '亥');
  assert.ok(beipai.data.natal.palaces.some((p: any) => p.adjectiveStars.some((s: any) => s.name === '截空')));
  assert.match(beipai.prompt.text, /生年四化叠自化：/);
  assert.match(beipai.prompt.text, /流年重点引动/);

  const saved = JSON.parse(JSON.stringify(beipai));
  const follow = await reprompt({ method: 'ziwei', result: saved, question: '继续看流年飞化' });
  assert.match(follow.prompt.text, /北派安星/);
});

test('排盘与起卦偏好口径完整接入紫微扩展规则与旧缓存平滑迁移', async () => {
  const prevWindow = (globalThis as Record<string, unknown>).window;
  const prevStorage = (globalThis as Record<string, unknown>).localStorage;
  const map = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (map.has(k) ? (map.get(k) ?? null) : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
  };
  (globalThis as Record<string, unknown>).localStorage = storage;
  (globalThis as Record<string, unknown>).window = { localStorage: storage, dispatchEvent: () => true };

  try {
    // 1. UI 描述符覆盖所有新字段
    const fieldIds = new Set(GLOBAL_RULE_SECTIONS.flatMap((s) => s.fields.map((f) => f.id)));
    for (const id of ['gs-ziwei-algorithm', 'gs-ziwei-mutagenSchool', 'gs-ziwei-leapMonthMode', 'gs-ziwei-plateType', 'gs-ziwei-tianmaMode']) {
      assert.ok(fieldIds.has(id), id);
    }

    // 2. 旧版 fixLeap: false 自动迁移成 leapMonthMode: 'same'
    storage.setItem('mingyu:global-rules:v1', JSON.stringify({ ziwei: { fixLeap: false } }));
    const migrated = loadGlobalRules();
    assert.equal(migrated.ziwei.leapMonthMode, 'same');

    // 3. 保存多流派偏好并注入各类紫微接口
    const custom = structuredClone(DEFAULT_GLOBAL_RULES);
    custom.ziwei.algorithm = 'beipai';
    custom.ziwei.mutagenSchool = 'zhongzhou';
    custom.ziwei.leapMonthMode = 'next';
    custom.ziwei.plateType = 'earth';
    custom.ziwei.tianmaMode = 'month';
    saveGlobalRules(custom);

    const baseBirth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
    const injectedZiwei = applyGlobalRulesToPayload('ziwei', { question: '测试', birth: baseBirth, gender: 'male' }, false) as any;
    assert.deepEqual(injectedZiwei.rules, {
      algorithm: 'beipai',
      mutagenSchool: 'zhongzhou',
      leapMonthMode: 'next',
      plateType: 'earth',
      tianmaMode: 'month',
    });

    const calculated = await calculate('ziwei', injectedZiwei);
    assert.equal(calculated.data.basis.rules.mutagenSchool, 'zhongzhou');
    assert.equal(calculated.data.basis.rules.plateType, 'earth');
    assert.equal(calculated.data.basis.rules.tianmaMode, 'month');

    const injectedSynastry = applyGlobalRulesToPayload('ziwei-synastry', {
      question: '合盘',
      person1: { birth: baseBirth, gender: 'female' },
      person2: { birth: baseBirth, gender: 'male', rules: { plateType: 'heaven' } },
    }, false) as any;
    assert.equal(injectedSynastry.person1.rules.plateType, 'earth');
    assert.equal(injectedSynastry.person2.rules.plateType, 'heaven'); // 显式传入不被覆盖

    const injectedBaziZiwei = applyGlobalRulesToPayload('bazi-ziwei', { question: '合参', birth: baseBirth, gender: 'male' }, false) as any;
    assert.equal(injectedBaziZiwei.ziweiRules.mutagenSchool, 'zhongzhou');

    const injectedInstant = applyGlobalRulesToPayload('instant', { type: 'ziwei', question: '即时' }, false) as any;
    assert.equal(injectedInstant.ziweiAlgorithm, 'beipai');

    // 4. 恢复默认后保持零注入
    saveGlobalRules(structuredClone(DEFAULT_GLOBAL_RULES));
    const clean = applyGlobalRulesToPayload('ziwei', { question: '默认', birth: baseBirth, gender: 'male' }, false) as any;
    assert.equal(clean.rules, undefined);
  } finally {
    if (prevWindow === undefined) delete (globalThis as Record<string, unknown>).window;
    else (globalThis as Record<string, unknown>).window = prevWindow;
    if (prevStorage === undefined) delete (globalThis as Record<string, unknown>).localStorage;
    else (globalThis as Record<string, unknown>).localStorage = prevStorage;
  }
});
