import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { buildPillarFacts } from '../src/systems/bazi/pillars';
import { calculateBaziShensha } from '../src/systems/bazi/shensha';
import worker from '../src/worker';

test('本命神煞记录起例及命中柱，年支和日支可共同作为依据', () => {
  const pillars = buildPillarFacts({ year: '甲子', month: '丙寅', day: '丙申', hour: '己亥' });
  const result = calculateBaziShensha(pillars);
  assert.deepEqual(result.entries.find((entry) => entry.position === 'month' && entry.name === '驿马'), {
    name: '驿马', position: 'month', branch: '寅', targetKind: '支', target: '寅', basis: [
      { pillar: 'year', kind: '支', value: '子', target: '寅' },
      { pillar: 'day', kind: '支', value: '申', target: '寅' },
    ],
  });
  assert.deepEqual(result.entries.find((entry) => entry.position === 'hour' && entry.name === '天乙贵人')?.basis,
    [{ pillar: 'day', kind: '干', value: '丙', target: '亥' }]);
  assert.match(result.limitation, /仅列69项/);
});

test('天德查天干或地支时保留实际命中位置，福星贵人不混入年支福星', () => {
  const stems = buildPillarFacts({ year: '乙亥', month: '己亥', day: '乙丑', hour: '庚申' });
  const entries = calculateBaziShensha(stems).entries;
  assert.deepEqual(entries.find((item) => item.name === '天德贵人' && item.position === 'year'), {
    name: '天德贵人', position: 'year', branch: '亥', targetKind: '干', target: '乙',
    basis: [{ pillar: 'month', kind: '支', value: '亥', target: '乙' }],
  });
  assert.equal(entries.some((item) => item.name === '福星贵人' && item.position === 'hour'), false);
  const branches = calculateBaziShensha(buildPillarFacts({ year: '甲子', month: '丁卯', day: '丙申', hour: '己亥' })).entries;
  const branch = branches.find((item) => item.name === '天德贵人' && item.position === 'day');
  assert.equal(branch?.targetKind, '支'); assert.equal(branch?.target, '申');
});

test('整局神煞按真实四柱顺序记录；未提供性别不猜测元辰', () => {
  const ordered = buildPillarFacts({ year: '甲子', month: '戊寅', day: '庚辰', hour: '己亥' });
  const noGender = calculateBaziShensha(ordered);
  assert.equal(noGender.included.length, 69);
  assert.deepEqual(noGender.unavailable, [
    { name: '元辰', reason: '该查法需要性别，未提供时不推测。' },
    { name: '铁扫帚', reason: '该查法需要性别，未提供时不推测。' },
  ]);
  assert.deepEqual(noGender.global.find((item) => item.name === '三奇贵人')?.basis.map((item) => item.pillar), ['year', 'month', 'day']);
  const genderPillars = buildPillarFacts({ year: '甲子', month: '己巳', day: '庚午', hour: '癸未' });
  const male = calculateBaziShensha(genderPillars, 'male');
  const female = calculateBaziShensha(genderPillars, 'female');
  assert.equal(male.included.length, 71); assert.deepEqual(male.unavailable, []);
  // 阳男（甲子）冲前一辰为未；阳女冲后一辰为巳
  assert.equal(male.entries.find((item) => item.name === '元辰')?.target, '未');
  assert.equal(female.entries.find((item) => item.name === '元辰')?.target, '巳');
  const yinYearPillars = buildPillarFacts({ year: '乙丑', month: '戊寅', day: '丙午', hour: '庚申' });
  const yinMale = calculateBaziShensha(yinYearPillars, 'male');
  const yinFemale = calculateBaziShensha(yinYearPillars, 'female');
  // 阴男（乙丑）冲后一辰为午，阴女冲前一辰为申
  assert.equal(yinMale.entries.find((item) => item.name === '元辰')?.target, '午');
  assert.equal(yinFemale.entries.find((item) => item.name === '元辰')?.target, '申');
  // 四组三合局亡神、劫煞逐一核对：申子辰(亡亥劫巳)、亥卯未(亡寅劫申)、寅午戌(亡巳劫亥)、巳酉丑(亡申劫寅)
  const trineCases = [
    { year: '甲子', month: '乙亥', day: '丙寅', hour: '癸巳', wangshen: '亥', jiesha: '巳' },
    { year: '乙卯', month: '戊寅', day: '丙子', hour: '丙申', wangshen: '寅', jiesha: '申' },
    { year: '丙午', month: '癸巳', day: '甲子', hour: '乙亥', wangshen: '巳', jiesha: '亥' },
    { year: '癸酉', month: '甲寅', day: '丙子', hour: '丙申', wangshen: '申', jiesha: '寅' },
  ] as const;
  for (const item of trineCases) {
    const res = calculateBaziShensha(buildPillarFacts({ year: item.year, month: item.month, day: item.day, hour: item.hour }));
    const wang = res.entries.find((e) => e.name === '亡神' && e.basis.some((b) => b.pillar === 'year'));
    const jie = res.entries.find((e) => e.name === '劫煞' && e.basis.some((b) => b.pillar === 'year'));
    assert.equal(wang?.target, item.wangshen, `${item.year} 亡神应为 ${item.wangshen}`);
    assert.equal(jie?.target, item.jiesha, `${item.year} 劫煞应为 ${item.jiesha}`);
  }
  const gonglu = calculateBaziShensha(buildPillarFacts({ year: '甲子', month: '丙寅', day: '癸亥', hour: '癸丑' }));
  assert.deepEqual(gonglu.global.find((item) => item.name === '拱禄')?.basis.map((item) => item.value), ['癸亥', '癸丑']);
});

test('精确和未知时辰可查看神煞并追问，HTTP 与 MCP 返回相同数据', async () => {
  const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact', hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const input = { birth, gender: 'female', question: '事业如何？' };
  const result = await calculate('bazi', input);
  assert.match(result.prompt.text, /本命神煞（71项）/);
  assert.equal(result.data.chart!.shensha.included.length, 71);
  const follow = await reprompt({ method: 'bazi', result, question: '继续问' });
  assert.match(follow.prompt.text, /本命神煞（71项）/);
  const altered = structuredClone(result); altered.data.chart!.shensha.entries.pop();
  await assert.rejects(() => reprompt({ method: 'bazi', result: altered, question: '继续问' }), /不一致/);
  const uncertain = await calculate('bazi', { ...input, birth: { ...birth, clock: { kind: 'unknown' } } });
  assert.ok(uncertain.data.unknown!.segments.every((segment) => segment.shensha.included.length === 71));
  assert.match(uncertain.prompt.text, /仅列71项本命神煞/);
  const withoutGender = await calculate('bazi', { birth, question: '问题' });
  assert.deepEqual(withoutGender.data.chart!.shensha.unavailable.map((item) => item.name), ['元辰', '铁扫帚']);
  assert.match(withoutGender.prompt.text, /元辰、铁扫帚因未提供性别未计算/);
  const first = uncertain.data.unknown!.segments[0];
  assert.deepEqual(first.shensha, calculateBaziShensha(first.pillars, 'female'));
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const http = await send('/api/calculate', { method: 'bazi', input });
  assert.equal(http.status, 200);
  const httpValue: any = await http.json();
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi', arguments: input } });
  const mcpValue: any = await mcp.json();
  assert.deepEqual(httpValue.data.chart.shensha, mcpValue.result.structuredContent.data.chart.shensha);
});

test('kongWangMode 与 yangRenMode 口径在本命神煞与岁运神煞中完全同步', async () => {
  // 1990-05-15 14:30: 庚午 辛巳 庚辰 癸未；庚午年空戌亥，庚辰日空申酉
  const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const ref = '2026-06-15T04:00:00Z';
  const dayOnly = await calculate('bazi', { birth, gender: 'female', referenceTime: ref, question: '测试' });
  assert.match(dayOnly.data.chart!.shensha.rule, /空亡仅采用日柱旬空/);
  assert.ok(dayOnly.data.chart!.shensha.entries.filter((e) => e.name === '空亡').every((e) => e.basis.every((b) => b.pillar === 'day')));

  const dayAndYear = await calculate('bazi', { birth, gender: 'female', referenceTime: ref, rules: { kongWangMode: 'day-and-year' }, question: '测试' });
  assert.match(dayAndYear.data.chart!.shensha.rule, /空亡同时采用年柱与日柱旬空/);

  // 阴干日主（1990-05-16 14:30 辛巳日）测试 yang-only 同步至岁运神煞
  const yinBirth = { year: 1990, month: 5, day: 16, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const yangOnly = await calculate('bazi', { birth: yinBirth, gender: 'female', referenceTime: ref, rules: { yangRenMode: 'yang-only' }, question: '测试' });
  assert.equal(yangOnly.data.chart!.shensha.entries.some((e) => e.name === '羊刃'), false);
  const fortuneHasYangRen = yangOnly.data.located!.shensha.layers.some((layer) => layer.entries.some((e) => e.name === '羊刃'));
  assert.equal(fortuneHasYangRen, false);
});

test('多流派神煞口径：学堂词馆（含丁酉学堂）、起例基准柱、天乙贵人、红艳煞与童子煞准确区分且默认保持最主流', async () => {
  // 1. 学堂与词馆多流派：甲子年(海中金，纳音学堂在巳、词馆在申)、丁酉日(丁干长生在酉、临官在午)、庚午时
  const xuetangPillars = buildPillarFacts({ year: '甲子', month: '乙巳', day: '丁酉', hour: '庚午' });
  // 默认 nayin：月支巳为纳音学堂；日支酉不是纳音学堂
  const xtDefault = calculateBaziShensha(xuetangPillars);
  assert.deepEqual(
    xtDefault.entries.filter((e) => e.name === '学堂').map((e) => `${e.position}:${e.target}`),
    ['month:巳'],
  );
  // stem-changsheng：丁酉日自坐丁干长生酉为学堂，时支午为丁干临官词馆
  const xtStem = calculateBaziShensha(xuetangPillars, undefined, undefined, { xueTangMode: 'stem-changsheng' });
  assert.ok(xtStem.entries.some((e) => e.name === '学堂' && e.position === 'day' && e.target === '酉'));
  assert.ok(xtStem.entries.some((e) => e.name === '词馆' && e.position === 'hour' && e.target === '午'));
  assert.match(xtStem.rule, /十天干十二长生/);

  // zheng-xuetang：甲子金命正学堂在辛巳、正词馆在壬申；普通乙巳不命中正学堂
  const xtZhengMiss = calculateBaziShensha(xuetangPillars, undefined, undefined, { xueTangMode: 'zheng-xuetang' });
  assert.equal(xtZhengMiss.entries.some((e) => e.name === '学堂'), false);
  const zhengHitPillars = buildPillarFacts({ year: '甲子', month: '辛巳', day: '壬申', hour: '丙午' });
  const xtZhengHit = calculateBaziShensha(zhengHitPillars, undefined, undefined, { xueTangMode: 'zheng-xuetang' });
  assert.deepEqual(
    xtZhengHit.entries.filter((e) => e.name === '学堂').map((e) => `${e.position}:${e.target}`),
    ['month:辛巳'],
  );
  assert.deepEqual(
    xtZhengHit.entries.filter((e) => e.name === '词馆').map((e) => `${e.position}:${e.target}`),
    ['day:壬申'],
  );

  // nayin-and-stem：同时命中月支巳（纳音）与日支酉（天干长生）
  const xtBoth = calculateBaziShensha(xuetangPillars, undefined, undefined, { xueTangMode: 'nayin-and-stem' });
  assert.deepEqual(
    xtBoth.entries.filter((e) => e.name === '学堂').map((e) => `${e.position}:${e.target}`),
    ['month:巳', 'day:酉'],
  );

  // 2. 起例基准柱（shenshaBaseMode）：甲子年(甲天乙丑未，申子辰桃花酉) 丙寅月 丁卯日(丁天乙亥酉，亥卯未桃花子) 己酉时
  const basePillars = buildPillarFacts({ year: '甲子', month: '丙寅', day: '丁卯', hour: '己酉' });
  const baseDayOnly = calculateBaziShensha(basePillars, undefined, undefined, { shenshaBaseMode: 'day-only' });
  const baseYearOnly = calculateBaziShensha(basePillars, undefined, undefined, { shenshaBaseMode: 'year-only' });
  // 时支酉：按年支子为桃花、按日干丁为天乙贵人
  assert.equal(baseDayOnly.entries.some((e) => e.name === '桃花' && e.position === 'hour'), false);
  assert.equal(baseDayOnly.entries.some((e) => e.name === '天乙贵人' && e.position === 'hour'), true);
  assert.equal(baseYearOnly.entries.some((e) => e.name === '桃花' && e.position === 'hour'), true);
  assert.equal(baseYearOnly.entries.some((e) => e.name === '天乙贵人' && e.position === 'hour'), false);

  // 3. 天乙贵人口诀（tianYiMode）：庚日见丑未 vs 庚日见寅午
  const tyPillars = buildPillarFacts({ year: '丙子', month: '己丑', day: '庚寅', hour: '壬午' });
  const tyStd = calculateBaziShensha(tyPillars, undefined, undefined, { shenshaBaseMode: 'day-only', tianYiMode: 'standard' });
  const tyClassical = calculateBaziShensha(tyPillars, undefined, undefined, { shenshaBaseMode: 'day-only', tianYiMode: 'classical-geng-yinwu' });
  assert.deepEqual(tyStd.entries.filter((e) => e.name === '天乙贵人').map((e) => e.branch), ['丑']);
  assert.deepEqual(tyClassical.entries.filter((e) => e.name === '天乙贵人').map((e) => e.branch), ['寅', '午']);

  // 4. 红艳煞（hongYanMode）：乙日见午(默认) vs 乙日见申(古诀) vs 年日同查
  const validHyPillars = buildPillarFacts({ year: '丙子', month: '壬午', day: '乙亥', hour: '甲申' });
  const hyStd = calculateBaziShensha(validHyPillars);
  const hyYiShen = calculateBaziShensha(validHyPillars, undefined, undefined, { hongYanMode: 'yi-shen' });
  const hyYearDay = calculateBaziShensha(buildPillarFacts({ year: '丙子', month: '庚寅', day: '乙亥', hour: '壬午' }), undefined, undefined, { hongYanMode: 'year-and-day' });
  assert.deepEqual(hyStd.entries.filter((e) => e.name === '红艳煞').map((e) => e.branch), ['午']);
  assert.deepEqual(hyYiShen.entries.filter((e) => e.name === '红艳煞').map((e) => e.branch), ['申']);
  assert.deepEqual(hyYearDay.entries.filter((e) => e.name === '红艳煞').map((e) => e.branch), ['寅', '午']);

  // 5. 童子煞（tongZiMode）：甲子年(金命，纳音童子午卯) 丁卯月(春，季节童子寅子) 庚子日(仅中季节) 辛卯时(仅中纳音)
  const tzPillars = buildPillarFacts({ year: '甲子', month: '丁卯', day: '庚子', hour: '辛卯' });
  const tzStd = calculateBaziShensha(tzPillars);
  const tzHourOnly = calculateBaziShensha(tzPillars, undefined, undefined, { tongZiMode: 'hour-only' });
  const tzStrictMiss = calculateBaziShensha(tzPillars, undefined, undefined, { tongZiMode: 'strict-both' });
  assert.deepEqual(tzStd.entries.filter((e) => e.name === '童子煞').map((e) => e.position), ['day', 'hour']);
  assert.deepEqual(tzHourOnly.entries.filter((e) => e.name === '童子煞').map((e) => e.position), ['hour']);
  assert.deepEqual(tzStrictMiss.entries.filter((e) => e.name === '童子煞'), []);
  // 夏月(巳午未)季节童子卯未辰 + 金命纳音童子午卯 => 卯为季节与纳音同中（真童子）
  const tzStrictHit = calculateBaziShensha(buildPillarFacts({ year: '甲子', month: '己巳', day: '辛卯', hour: '甲午' }), undefined, undefined, { tongZiMode: 'strict-both' });
  assert.deepEqual(tzStrictHit.entries.filter((e) => e.name === '童子煞').map((e) => `${e.position}:${e.branch}`), ['day:卯']);

  // 6. 端到端 calculate('bazi') 同步至本命与岁运神煞及提示词规则摘要
  const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const e2e = await calculate('bazi', {
    birth,
    gender: 'female',
    referenceTime: '2026-06-15T04:00:00Z',
    rules: { xueTangMode: 'stem-changsheng', tianYiMode: 'classical-geng-yinwu', shenshaBaseMode: 'day-only' },
    question: '测试多流派神煞',
  });
  assert.match(e2e.prompt.text, /学堂=天干长生/);
  assert.match(e2e.prompt.text, /天乙=古诀甲戊丑未庚辛寅午/);
  assert.match(e2e.prompt.text, /神煞基准=仅查日支/);
  // 1990-05-15 为庚辰日，庚干长生在巳，月柱为辛巳 -> stem-changsheng 下月支巳必中天干学堂
  assert.ok(e2e.data.chart!.shensha.entries.some((e) => e.name === '学堂' && e.position === 'month' && e.basis.some((b) => b.kind === '干' && b.value === '庚')));
  // 2026 丙午流年，classical-geng-yinwu 下庚日见午必中岁运天乙贵人
  const yearLayer = e2e.data.located!.shensha.layers.find((l) => l.id === 'year');
  assert.ok(yearLayer?.entries.some((e) => e.name === '天乙贵人' && e.target === '午'));

  // 7. 岁煞（三煞之一）：年支辰、月支未必中岁煞（申子辰见未、亥卯未见戌、寅午戌见丑、巳酉丑见辰）
  const suishaCases = [
    { year: '庚辰', month: '癸未', expectedBranch: '未' },
    { year: '乙亥', month: '丙戌', expectedBranch: '戌' },
    { year: '丙寅', month: '己丑', expectedBranch: '丑' },
    { year: '己巳', month: '戊辰', expectedBranch: '辰' },
  ];
  for (const item of suishaCases) {
    const res = calculateBaziShensha(buildPillarFacts({ year: item.year, month: item.month, day: '甲子', hour: '甲子' }));
    assert.ok(
      res.entries.some((e) => e.name === '岁煞' && e.position === 'month' && e.branch === item.expectedBranch),
      `${item.year}年${item.month}月应命中岁煞`,
    );
  }
});

test('新增 15 项高实用神煞：暗禄、天官贵人双流派、日德日贵、进神、六厄、太岁十二神、铁扫帚与隔角煞', async () => {
  // 1. 暗禄（甲日禄寅合亥）、日德（甲寅日）、隔角煞（日支寅隔一位见时支辰）
  const p1 = buildPillarFacts({ year: '庚申', month: '丁亥', day: '甲寅', hour: '戊辰' });
  const r1 = calculateBaziShensha(p1, 'male');
  assert.ok(r1.entries.some((e) => e.name === '暗禄' && e.position === 'month' && e.branch === '亥'));
  assert.ok(r1.entries.some((e) => e.name === '日德' && e.position === 'day' && e.target === '甲寅'));
  assert.ok(r1.entries.some((e) => e.name === '隔角煞' && e.position === 'hour' && e.branch === '辰'));

  // 2. 日贵（丁酉日）、进神（己卯时）
  const p2 = buildPillarFacts({ year: '甲子', month: '丙寅', day: '丁酉', hour: '己卯' });
  const r2 = calculateBaziShensha(p2, 'male');
  assert.ok(r2.entries.some((e) => e.name === '日贵' && e.position === 'day' && e.target === '丁酉'));
  assert.ok(r2.entries.some((e) => e.name === '进神' && e.position === 'hour' && e.target === '己卯'));
  // 甲子年（申子辰）见卯为六厄，见寅(正月)男命犯铁扫帚
  assert.ok(r2.entries.some((e) => e.name === '六厄' && e.position === 'hour' && e.branch === '卯'));
  assert.ok(r2.entries.some((e) => e.name === '铁扫帚' && e.position === 'month' && e.branch === '寅'));
  // 同盘女命正月寅不犯铁扫帚，十二月丑才犯铁扫帚
  const r2Female = calculateBaziShensha(p2, 'female');
  assert.equal(r2Female.entries.some((e) => e.name === '铁扫帚'), false);
  const r2FemaleHit = calculateBaziShensha(buildPillarFacts({ year: '甲子', month: '丁丑', day: '丁酉', hour: '己卯' }), 'female');
  assert.ok(r2FemaleHit.entries.some((e) => e.name === '铁扫帚' && e.position === 'month' && e.branch === '丑'));

  // 3. 天官贵人双流派：丁干标准版见寅、五行精纪别本见酉
  const tgStd = calculateBaziShensha(p2, 'male', undefined, { shenshaBaseMode: 'day-only', tianGuanMode: 'standard' });
  const tgJingji = calculateBaziShensha(p2, 'male', undefined, { shenshaBaseMode: 'day-only', tianGuanMode: 'jingji-variant' });
  assert.deepEqual(tgStd.entries.filter((e) => e.name === '天官贵人').map((e) => e.branch), ['寅']);
  assert.deepEqual(tgJingji.entries.filter((e) => e.name === '天官贵人').map((e) => e.branch), ['酉']);

  // 4. 太岁十二神（子年基准：+4辰官符、+6午岁破、+7未龙德/紫微、+8申白虎、+9酉福德、+11亥病符）
  const pTaisuiA = buildPillarFacts({ year: '甲子', month: '戊辰', day: '庚午', hour: '癸未' });
  const rTaisuiA = calculateBaziShensha(pTaisuiA, 'male');
  assert.ok(rTaisuiA.entries.some((e) => e.name === '官符' && e.position === 'month' && e.branch === '辰'));
  assert.ok(rTaisuiA.entries.some((e) => e.name === '岁破' && e.position === 'day' && e.branch === '午'));
  assert.ok(rTaisuiA.entries.some((e) => e.name === '龙德' && e.position === 'hour' && e.branch === '未'));
  assert.ok(rTaisuiA.entries.some((e) => e.name === '紫微' && e.position === 'hour' && e.branch === '未'));

  const pTaisuiB = buildPillarFacts({ year: '甲子', month: '壬申', day: '癸酉', hour: '癸亥' });
  const rTaisuiB = calculateBaziShensha(pTaisuiB, 'male');
  assert.ok(rTaisuiB.entries.some((e) => e.name === '白虎' && e.position === 'month' && e.branch === '申'));
  assert.ok(rTaisuiB.entries.some((e) => e.name === '福德' && e.position === 'day' && e.branch === '酉'));
  assert.ok(rTaisuiB.entries.some((e) => e.name === '病符' && e.position === 'hour' && e.branch === '亥'));

  // 5. 岁运同步验证：1990庚午年(年支午，2026丙午不冲；改查2020庚子流年则子午冲命中岁破！)
  const birth = { year: 1990, month: 5, day: 15, clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 }, timezone: 8 };
  const flow = await calculate('bazi', {
    birth,
    gender: 'female',
    referenceTime: '2020-06-15T04:00:00Z',
    rules: { tianGuanMode: 'jingji-variant' },
    question: '测试新增神煞岁运同步',
  });
  assert.match(flow.prompt.text, /天官=京氏变例/);
  const yearLayer = flow.data.located!.shensha.layers.find((l) => l.id === 'year');
  assert.ok(yearLayer?.entries.some((e) => e.name === '岁破' && e.target === '子'));
});
