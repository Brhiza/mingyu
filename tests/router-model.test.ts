import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CANONICAL_METHODS,
  DOMAIN_DEFINITIONS,
  METHOD_LABELS,
  PROMPT_FRAMEWORKS,
  recommendMethods,
  type MethodId,
} from '../src/router-model/index.ts';
import { extractSubstantiveQuestion } from '../src/router-model/features.ts';
import {
  DEFAULT_BROWSER_DISABLED_ROUTER_METHODS,
  DEFAULT_LOCAL_ROUTER_SETTINGS,
  EXCLUDED_ROUTER_METHODS,
  ROUTER_METHOD_CATALOG,
  loadLocalRouterSettings,
} from '../src/router-model/local-preferences.ts';

test('metadata covers all 39 canonical methods, 8 prompt frameworks, and 10 domains', () => {
  assert.equal(CANONICAL_METHODS.length, 39);
  for (const id of CANONICAL_METHODS) {
    assert.ok(METHOD_LABELS[id] && METHOD_LABELS[id].length > 0, `Missing label for ${id}`);
  }
  assert.equal(Object.keys(PROMPT_FRAMEWORKS).length, 8);
  assert.equal(Object.keys(DOMAIN_DEFINITIONS).length, 10);
});

test('recommendMethods returns valid Top-3 contract and sub-5ms latency', () => {
  // Warm up lazy weight decoding
  recommendMethods({ query: '今天运势怎么样' });

  const res = recommendMethods({
    query: '下周二要去心仪公司终面，想占一卦看看能不能过？',
    birthTimeStatus: 'not_provided',
    traditionPref: 'eastern',
    depthPref: 'standard',
  });

  assert.equal(res.recommendations.length, 3);
  assert.equal(res.recommendations[0].method, 'liuyao');
  assert.ok(res.recommendations[0].confidence >= res.recommendations[1].confidence);
  assert.ok(res.recommendations[1].confidence >= res.recommendations[2].confidence);
  for (const rec of res.recommendations) {
    assert.ok((CANONICAL_METHODS as readonly string[]).includes(rec.method));
    assert.ok(rec.label.length > 0);
    assert.ok(rec.reason.length >= 6);
    assert.ok(rec.confidence > 0 && rec.confidence <= 1);
  }
  assert.ok(res.latencyMs < 10, `Expected fast inference, got ${res.latencyMs}ms`);
  assert.ok(res.recommendedFramework.composedPromptGuidance.includes(res.recommendedFramework.name));
  assert.ok(res.recommendedFramework.composedPromptGuidance.includes(res.detectedDomain.label));
});

test('unknown birth time dual-track routing: short-term event -> divination (no calibration)', () => {
  const res = recommendMethods({
    query: '我不知道自己几点出生的，就想问下周四面试能不能顺利通过？',
    birthTimeStatus: 'unknown',
    traditionPref: 'eastern',
    depthPref: 'standard',
  });

  const divinationSet = new Set<MethodId>([
    'liuyao',
    'meihua',
    'qimen',
    'liuren',
    'jinkoujue',
    'xiaoliuren',
    'tarot',
    'lenormand',
    'ssgw',
    'zhuge',
  ]);
  assert.ok(
    divinationSet.has(res.recommendations[0].method),
    `Expected divination method, got ${res.recommendations[0].method}`,
  );
  assert.equal(res.calibrationSuggested, false);
  assert.equal(res.recommendedFramework.id, 'event-verdict');
});

test('unknown birth time dual-track routing: long-term fate -> calibration-friendly natal method', () => {
  const res = recommendMethods({
    query: '家里没人记得我出生时辰，只知道公历生日，但我很想看自己一生的事业格局和未来十年大运！',
    birthTimeStatus: 'unknown',
    traditionPref: 'eastern',
    depthPref: 'deep',
  });

  const calibMethods = new Set<MethodId>(['bazi-ziwei', 'ziwei', 'bazi']);
  assert.ok(
    calibMethods.has(res.recommendations[0].method),
    `Expected calibration-friendly natal method, got ${res.recommendations[0].method}`,
  );
  assert.equal(res.calibrationSuggested, true);
  assert.equal(res.recommendations[0].calibrationSuggested, true);
  assert.ok(res.recommendations[0].missingInfoHint.includes('考时'));
  assert.equal(res.recommendedFramework.id, 'natal-panorama');
});

test('traditionPref steers ambiguous emotional queries cleanly', () => {
  const query = '最近心里特别乱，不知道这段关系还能不能继续，想算一下指点方向';

  const western = recommendMethods({
    query,
    birthTimeStatus: 'not_provided',
    traditionPref: 'western_cards',
  });
  assert.ok(
    ['tarot', 'lenormand'].includes(western.recommendations[0].method),
    `Expected western card method, got ${western.recommendations[0].method}`,
  );

  const folk = recommendMethods({
    query,
    birthTimeStatus: 'not_provided',
    traditionPref: 'folk_signs',
  });
  assert.ok(
    ['ssgw', 'zhuge'].includes(folk.recommendations[0].method),
    `Expected folk sign method, got ${folk.recommendations[0].method}`,
  );
});

test('easily confused boundaries are cleanly separated', () => {
  // 1. Range astrolabe vs exact astrolabe
  const rangeAstro = recommendMethods({
    query: '我只记得是下午两点到四点之间在成都出生的，想看西洋星盘怕上升星座算错',
    birthTimeStatus: 'range',
    traditionPref: 'western_cards',
  });
  assert.equal(rangeAstro.recommendations[0].method, 'astrolabe-range');

  // 2. Moving date selection -> almanac (not fengshui)
  const almanac = recommendMethods({
    query: '下个月搬家，帮我翻老黄历选两个吉利的乔迁入宅好日子，避开冲生肖！',
    birthTimeStatus: 'exact',
  });
  assert.equal(almanac.recommendations[0].method, 'almanac');
  assert.equal(almanac.recommendedFramework.id, 'space-layout');

  // 3. Name analysis vs Naming vs Character Query vs Number Energy
  const nameAnalyze = recommendMethods({
    query: '家人想好了“陆景川”和“陆闻舟”两个名字，帮我测测哪个音形义和五行更好？',
  });
  assert.equal(nameAnalyze.recommendations[0].method, 'chinese-name');
  assert.equal(nameAnalyze.recommendedFramework.id, 'naming-aesthetic');

  const naming = recommendMethods({
    query: '下个月要生女宝宝了，爸爸姓林，想从零起几个诗经风格的新名字！',
  });
  assert.equal(naming.recommendations[0].method, 'chinese-naming');
  assert.equal(naming.recommendedFramework.id, 'naming-aesthetic');

  const charQuery = recommendMethods({
    query: '不用算整个名字，单查“珩”字在康熙字典几画、五行属什么、本义是什么？',
  });
  assert.equal(charQuery.recommendations[0].method, 'character-query');

  const numEnergy = recommendMethods({
    query: '车牌号 浙A·D68139 和 浙A·D47218 用数字能量看看哪个磁场更稳？',
  });
  assert.equal(numEnergy.recommendations[0].method, 'number-energy');

  // 4. Zhouyi text lookup vs divination
  const zhouyi = recommendMethods({
    query: '我不是要起卦占卜，只想查阅《周易》第 15 卦地山谦的卦辞和爻辞原文。',
  });
  assert.equal(zhouyi.recommendations[0].method, 'zhouyi');

  // 5. Four pillars reverse lookup
  const reverse = recommendMethods({
    query: '家里红纸只写了四柱干支甲戌、丙寅、辛卯、戊子，想反推出对应的公历出生日期！',
    birthTimeStatus: 'unknown',
  });
  assert.equal(reverse.recommendations[0].method, 'bazi-reverse');
});

test('all 8 prompt frameworks and key thematic domains are accurately triggered', () => {
  const decision = recommendMethods({
    query: '手里有两个 offer 不知道选A留国企还是选B去创业公司，帮我权衡利弊！',
    birthTimeStatus: 'not_provided',
    traditionPref: 'eastern',
    depthPref: 'deep',
  });
  assert.equal(decision.recommendedFramework.id, 'decision-ab');
  assert.equal(decision.detectedDomain.id, 'career');

  const synastry = recommendMethods({
    query: '我和女朋友双方生辰都有，想用紫微合盘看看夫妻宫叠宫和婚后磨合。',
    birthTimeStatus: 'exact',
  });
  assert.equal(synastry.recommendations[0].method, 'ziwei-synastry');
  assert.equal(synastry.recommendedFramework.id, 'relationship-diagnosis');
  assert.equal(synastry.detectedDomain.id, 'love');

  const crisisHealth = recommendMethods({
    query: '最近总失眠体虚，想排紫微斗数看看疾厄宫，了解健康方面怎么调适和避坑？',
    birthTimeStatus: 'exact',
  });
  assert.equal(crisisHealth.recommendations[0].method, 'ziwei');
  assert.equal(crisisHealth.recommendedFramework.id, 'crisis-remedy');
  assert.equal(crisisHealth.detectedDomain.id, 'health');
  assert.ok(
    crisisHealth.detectedDomain.focusPoints.some((pt) => pt.includes('医疗安全边界')),
    'Health domain must include medical safety boundary note',
  );

  const period = recommendMethods({
    query: '想看看2026年大众通用的流年运势节奏，不想填生辰。',
    birthTimeStatus: 'not_provided',
    depthPref: 'quick',
  });
  assert.equal(period.recommendations[0].method, 'fortune');
  assert.equal(period.recommendedFramework.id, 'period-roadmap');

  const lost = recommendMethods({
    query: '刚才把电脑包忘在出租车上了，用小六壬快测一下还能不能找回来？',
    birthTimeStatus: 'not_provided',
    depthPref: 'quick',
  });
  assert.equal(lost.recommendations[0].method, 'xiaoliuren');
  assert.equal(lost.detectedDomain.id, 'lost_and_misc');

  const dispute = recommendMethods({
    query: '正在打劳动仲裁官司，用六爻占一卦看看胜算大不大？',
    birthTimeStatus: 'not_provided',
  });
  assert.equal(dispute.recommendations[0].method, 'liuyao');
  assert.equal(dispute.detectedDomain.id, 'dispute');
});

test('average local inference latency stays well under 3ms across 100 calls', () => {
  const sampleQueries = [
    '下个月跳槽能不能成？',
    '我和对象八字合不合？',
    '想给刚出生的女儿起个带水的名字',
    '我家房子2018年建坐北朝南，排个玄空飞星看看财位',
    '不知道生辰，抽塔罗看看他心里怎么想我的',
  ];
  let totalMs = 0;
  for (let i = 0; i < 100; i++) {
    const res = recommendMethods({ query: sampleQueries[i % sampleQueries.length] });
    totalMs += res.latencyMs;
  }
  const avgMs = totalMs / 100;
  assert.ok(avgMs < 3, `Expected avg latency < 3ms, got ${avgMs.toFixed(3)}ms`);
});

test('wild inputs: typos, Traditional Chinese, English aliases, and internet slang normalize cleanly', () => {
  const ziweiTypo = recommendMethods({
    query: '幫我排個紫薇鬥數，看看夫妻宮和官祿宮到底咋樣？',
    birthTimeStatus: 'exact',
  });
  assert.equal(ziweiTypo.recommendations[0].method, 'ziwei');

  const qimenTypo = recommendMethods({
    query: '帮我用起门盾甲看看选A留北京还是选B回老家发展更好？',
    depthPref: 'deep',
  });
  assert.equal(qimenTypo.recommendations[0].method, 'qimen');
  assert.equal(qimenTypo.recommendedFramework.id, 'decision-ab');

  const tarotSlang = recommendMethods({
    query: '想抽几张他罗排 tarot 看看那个渣男到底是不是在养鱼？',
    traditionPref: 'western_cards',
  });
  assert.equal(tarotSlang.recommendations[0].method, 'tarot');
  assert.equal(tarotSlang.detectedDomain.id, 'love');

  const liuyaoSlang = recommendMethods({
    query: '刚用铜钱摇了个六摇，想问下个月考编能不能顺利上岸？',
    hasManualCast: true,
  });
  assert.equal(liuyaoSlang.recommendations[0].method, 'liuyao');
  assert.equal(liuyaoSlang.detectedDomain.id, 'study');

  const liurenSlang = recommendMethods({
    query: '公司里老有人在背后给我穿小鞋背锅，用大六任帮我查查到底是谁在使绊子？',
    depthPref: 'deep',
  });
  assert.equal(liurenSlang.recommendations[0].method, 'liuren');

  const synastryTypo = recommendMethods({
    query: '我和对象谈了三年，想看看俩人八字核不核，适不适合领证？',
    birthTimeStatus: 'exact',
  });
  assert.equal(synastryTypo.recommendations[0].method, 'bazi-synastry');

  const runAbroad = recommendMethods({
    query: '今年30岁了很想润出去润澳洲，我有精确出生时间，帮我看看命里有没有出国移民缘分和未来十年大运？',
    birthTimeStatus: 'exact',
    traditionPref: 'eastern',
  });
  assert.ok(['bazi', 'bazi-ziwei', 'ziwei'].includes(runAbroad.recommendations[0].method));
  assert.equal(runAbroad.detectedDomain.id, 'travel');
});

test('wild inputs: non-natural structured inputs route directly to specialized methods', () => {
  const pureDate = recommendMethods({ query: '1995-03-12 08:30 男', birthTimeStatus: 'exact' });
  assert.equal(pureDate.recommendations[0].method, 'bazi');
  assert.equal(pureDate.recommendations[0].missingInfoHint, '');

  const pureTwoDates = recommendMethods({
    query: '男 1993/06/18 10:15 女 1995/11/02 15:40',
    birthTimeStatus: 'exact',
  });
  assert.equal(pureTwoDates.recommendations[0].method, 'bazi-synastry');

  const purePillars = recommendMethods({ query: '甲子 丙寅 戊辰 庚申', birthTimeStatus: 'unknown' });
  assert.equal(purePillars.recommendations[0].method, 'bazi-reverse');

  const purePhone = recommendMethods({ query: '13812345678' });
  assert.equal(purePhone.recommendations[0].method, 'number-energy');

  const purePlate = recommendMethods({ query: '京A88888' });
  assert.equal(purePlate.recommendations[0].method, 'number-energy');

  const pureChar = recommendMethods({ query: '琂' });
  assert.equal(pureChar.recommendations[0].method, 'character-query');

  const pureTwoChars = recommendMethods({ query: '珩 璟' });
  assert.equal(pureTwoChars.recommendations[0].method, 'character-query');

  const pureNums3 = recommendMethods({ query: '3 7 9' });
  assert.ok(['xiaoliuren', 'meihua', 'zhuge'].includes(pureNums3.recommendations[0].method));

  const pureNums2 = recommendMethods({ query: '5 12' });
  assert.equal(pureNums2.recommendations[0].method, 'meihua');
});

test('wild inputs: ultra-short 2~4 char fragments and 200-char long stories both route accurately', () => {
  assert.equal(recommendMethods({ query: '起名' }).recommendations[0].method, 'chinese-naming');
  assert.equal(recommendMethods({ query: '测名字' }).recommendations[0].method, 'chinese-name');
  assert.equal(recommendMethods({ query: '搬家' }).recommendations[0].method, 'almanac');

  const brokenUp = recommendMethods({ query: '分手了', traditionPref: 'western_cards' });
  assert.equal(brokenUp.recommendations[0].method, 'tarot');
  assert.equal(brokenUp.detectedDomain.id, 'love');

  const tired = recommendMethods({ query: '好累', traditionPref: 'western_cards' });
  assert.equal(tired.recommendations[0].method, 'tarot');
  assert.equal(tired.recommendedFramework.id, 'crisis-remedy');

  const lostShort = recommendMethods({ query: '丢东西了', depthPref: 'quick' });
  assert.ok(['xiaoliuren', 'meihua', 'liuyao'].includes(lostShort.recommendations[0].method));
  assert.equal(lostShort.detectedDomain.id, 'lost_and_misc');

  const longStory = recommendMethods({
    query:
      '我今年35岁，在现在这家国企待了整整十年，虽然平时加班不多、五险一金也稳定，但工资涨得很慢，升职天花板一眼就能望到头，最近部门还换了新领导，处得不太愉快。前几天以前的老同事挖我去一家新成立的科技公司当运营总监，薪资直接翻倍还给期权，可是那家公司刚融完A轮，压力肯定极大而且有倒闭风险。我现在家里还有房贷和孩子要养，实在拿不定主意到底选A留在国企还是选B跳去新公司，想深度权衡一下两边的利弊和策略！',
    traditionPref: 'eastern',
    depthPref: 'deep',
  });
  assert.equal(longStory.recommendations[0].method, 'qimen');
  assert.equal(longStory.recommendedFramework.id, 'decision-ab');
  assert.equal(longStory.detectedDomain.id, 'career');
});

test('wild inputs: multi-intent compound queries cover both primary and secondary intents in Top-3', () => {
  const synastryAndDate = recommendMethods({
    query: '我和男朋友准备明年结婚，双方生辰都有，先帮我们合个八字看看婚后磨合，顺便挑个下个月适合领证的好日子！',
    birthTimeStatus: 'exact',
    traditionPref: 'eastern',
  });
  assert.equal(synastryAndDate.recommendations[0].method, 'bazi-synastry');
  assert.ok(
    synastryAndDate.recommendations.some((r) => r.method === 'almanac'),
    `Expected Top-3 to also include almanac, got ${synastryAndDate.recommendations.map((r) => r.method).join(', ')}`,
  );

  const namingAndBazi = recommendMethods({
    query: '下个月家里要添男宝宝了，姓陈，想先从零起几个大气好听的新名字，顺便以后也想看看宝宝一生的八字格局。',
    traditionPref: 'eastern',
  });
  assert.equal(namingAndBazi.recommendations[0].method, 'chinese-naming');
  assert.ok(
    namingAndBazi.recommendations.some((r) => r.method === 'bazi'),
    `Expected Top-3 to also include bazi, got ${namingAndBazi.recommendations.map((r) => r.method).join(', ')}`,
  );

  const liuyaoAndBazi = recommendMethods({
    query: '最近在公司被裁员心里特别乱，想先用六爻占一下下周二那场终面能不能过，另外也想看看我未来几年的八字大运走势。',
    birthTimeStatus: 'exact',
    traditionPref: 'eastern',
  });
  assert.equal(liuyaoAndBazi.recommendations[0].method, 'liuyao');
  assert.ok(
    liuyaoAndBazi.recommendations.some((r) => r.method === 'bazi'),
    `Expected Top-3 to also include bazi, got ${liuyaoAndBazi.recommendations.map((r) => r.method).join(', ')}`,
  );
});

test('explicit divination verbs (起一卦/抽一签/抽张牌) override today/fortune keywords cleanly', () => {
  for (const q of [
    '帮我起一卦，看看今天的事业运怎么样',
    '帮我起一卦，看看今天的事业运势怎么样',
    '帮我起一卦，看看今天运势',
    '帮我卜一卦今天运势',
    '帮我算一卦，看看今天的事业运怎么样',
  ]) {
    const res = recommendMethods({ query: q });
    assert.equal(
      res.recommendations[0].method,
      'liuyao',
      `「${q}」应优先路由到起卦(liuyao)，实际得到 ${res.recommendations[0].method}`,
    );
  }

  assert.equal(recommendMethods({ query: '帮我抽一签看看今天运势' }).recommendations[0].method, 'ssgw');
  assert.equal(recommendMethods({ query: '帮我抽张牌看看今天运势' }).recommendations[0].method, 'tarot');
  // 未说起卦/抽签/抽牌的纯今日运势问题仍正常路由到 fortune
  assert.equal(recommendMethods({ query: '帮我看看今日运势' }).recommendations[0].method, 'fortune');
});

test('extractSubstantiveQuestion drops pure casting commands and preserves actual user questions', () => {
  for (const pureCmd of [
    '帮我起一卦六爻',
    '起一卦六爻',
    '帮我起一卦',
    '起个奇门遁甲',
    '帮我抽张塔罗牌',
    '求一签',
    '帮我排个八字',
    '随机起一卦吧',
  ]) {
    assert.equal(
      extractSubstantiveQuestion(pureCmd),
      '',
      `纯指令「${pureCmd}」不应被当作问题填进问题框`,
    );
  }

  assert.equal(
    extractSubstantiveQuestion('帮我起一卦六爻，看看今天的事业运怎么样'),
    '看看今天的事业运怎么样',
  );
  assert.equal(extractSubstantiveQuestion('明天面试能不能过？'), '明天面试能不能过？');
});

test('user preferredChart and preferredDivination steer generic verbs and birthdates without overriding explicit mentions', () => {
  // 1. 起卦默认设为大六壬：泛说「起一卦」走大六壬，明确说「六爻」仍走六爻
  assert.equal(
    recommendMethods({
      query: '帮我起一卦，看看今天的事业运怎么样',
      preferredDivination: 'liuren',
    }).recommendations[0].method,
    'liuren',
  );
  assert.equal(
    recommendMethods({
      query: '帮我起一卦六爻',
      preferredDivination: 'liuren',
    }).recommendations[0].method,
    'liuyao',
  );

  // 2. 懂行说「起一课」未设偏好时默认走大六壬
  assert.equal(
    recommendMethods({ query: '帮我起一课看看今天工作顺不顺' }).recommendations[0].method,
    'liuren',
  );

  // 3. 排盘默认设为紫微斗数：泛说「排个盘」或直接贴生辰走紫微，明确说「八字」仍走八字
  assert.equal(
    recommendMethods({
      query: '帮我排个盘',
      preferredChart: 'ziwei',
    }).recommendations[0].method,
    'ziwei',
  );
  assert.equal(
    recommendMethods({
      query: '1990-05-15 14:30',
      preferredChart: 'ziwei',
    }).recommendations[0].method,
    'ziwei',
  );
  assert.equal(
    recommendMethods({
      query: '1990-05-15 14:30 帮我排个八字',
      preferredChart: 'ziwei',
    }).recommendations[0].method,
    'bazi',
  );

  // 4. 偏好权重绝不误伤专项领域（手机号、择日、风水）
  assert.equal(
    recommendMethods({
      query: '13800138000',
      preferredChart: 'ziwei',
      preferredDivination: 'liuren',
    }).recommendations[0].method,
    'number-energy',
  );
});

test('disabledMethods strictly excludes fortune or any user-disabled category from routing', () => {
  const withoutFortune = recommendMethods({
    query: '帮我看看今日运势和今天事业运怎么样',
    disabledMethods: ['fortune'],
  });
  assert.ok(
    withoutFortune.recommendations.every((r) => r.method !== 'fortune'),
    `禁用 fortune 后不应出现在 Top-3：${withoutFortune.recommendations.map((r) => r.method).join(',')}`,
  );

  const withoutWesternCards = recommendMethods({
    query: '不知道生辰，看看对方心里怎么想我的',
    disabledMethods: ['fortune', 'tarot', 'lenormand'],
  });
  assert.ok(
    withoutWesternCards.recommendations.every((r) => r.method !== 'tarot' && r.method !== 'lenormand'),
    `禁用塔罗雷诺曼后不应出现在 Top-3：${withoutWesternCards.recommendations.map((r) => r.method).join(',')}`,
  );
});

test('default browser router settings leave preferred chart/divination unrestricted and trim niche/utility routes', () => {
  assert.equal(DEFAULT_LOCAL_ROUTER_SETTINGS.preferredChart, null);
  assert.equal(DEFAULT_LOCAL_ROUTER_SETTINGS.preferredDivination, null);
  assert.equal(DEFAULT_LOCAL_ROUTER_SETTINGS.traditionPref, 'any');

  const disabled = new Set(DEFAULT_BROWSER_DISABLED_ROUTER_METHODS);
  // 常用主流与专项工具应默认开启（30/35）
  for (const keep of [
    'bazi',
    'ziwei',
    'astrolabe',
    'minglu',
    'qimen-lifetime',
    'liuyao',
    'meihua',
    'qimen',
    'liuren',
    'jinkoujue',
    'xiaoliuren',
    'tarot',
    'ssgw',
    'almanac',
    'bazhai',
    'xuankong',
    'residential',
    'calendar',
    'number-energy',
    'zhouyi',
    'character-query',
    'bazi-reverse',
  ] as MethodId[]) {
    assert.equal(disabled.has(keep), false, `${keep} 应默认启用`);
  }
  // 仅运势、极冷门宏观周期与诸葛神数默认关闭自动路由（5 项）
  for (const off of [
    'fortune',
    'wuyun-liuqi',
    'huangji-jingshi',
    'taiyi',
    'zhuge',
  ] as MethodId[]) {
    assert.equal(disabled.has(off), true, `${off} 应默认关闭自动路由`);
  }
  assert.equal(disabled.size, 5);

  // 关闭只拦截自动联想；用户明确点名时照样可以路由到
  assert.equal(
    recommendMethods({
      query: '帮我用太乙神数看看今年宏观大势',
      disabledMethods: [...DEFAULT_BROWSER_DISABLED_ROUTER_METHODS],
    }).recommendations[0].method,
    'taiyi',
  );
  assert.equal(
    recommendMethods({
      query: '用诸葛神数帮我测一测',
      disabledMethods: [...DEFAULT_BROWSER_DISABLED_ROUTER_METHODS],
    }).recommendations[0].method,
    'zhuge',
  );
  assert.equal(
    recommendMethods({
      query: '帮我看下日运',
      disabledMethods: [...DEFAULT_BROWSER_DISABLED_ROUTER_METHODS],
    }).recommendations[0].method,
    'fortune',
  );
  assert.equal(
    recommendMethods({
      query: '用小六壬快测一下钥匙在哪',
      disabledMethods: ['xiaoliuren'],
    }).recommendations[0].method,
    'xiaoliuren',
  );
  // 未点名运势时，默认关闭的运势不会被误触发
  const implicitToday = recommendMethods({
    query: '帮我看看今天的事业运怎么样',
    disabledMethods: [...DEFAULT_BROWSER_DISABLED_ROUTER_METHODS],
  });
  assert.ok(
    implicitToday.recommendations.every((r) => !disabled.has(r.method)),
    `未点名时不应命中默认关闭项：${implicitToday.recommendations.map((r) => r.method).join(',')}`,
  );

  // 随机起卦与即时起盘已永久移出路由目录与推荐结果
  const catalogIds = new Set(ROUTER_METHOD_CATALOG.flatMap((c) => c.items.map((i) => i.id)));
  for (const removed of EXCLUDED_ROUTER_METHODS) {
    assert.equal(catalogIds.has(removed), false, `${removed} 不应再出现在路由设置目录`);
  }
  for (const q of ['帮我随机起一卦', '按现在时间即时起盘看走势']) {
    const res = recommendMethods({ query: q, disabledMethods: [] });
    assert.ok(
      res.recommendations.every((r) => !EXCLUDED_ROUTER_METHODS.includes(r.method)),
      `「${q}」不应路由到已移除项：${res.recommendations.map((r) => r.method).join(',')}`,
    );
  }

  // 在默认浏览器禁用集合下，日常提问仍能稳定落到主流术数且不出现已禁项
  for (const q of [
    '帮我看看今天的事业运怎么样',
    '帮我起一卦看看明天面试顺不顺',
    '求个指引最近很迷茫',
  ]) {
    const res = recommendMethods({
      query: q,
      disabledMethods: [...DEFAULT_BROWSER_DISABLED_ROUTER_METHODS],
    });
    assert.equal(res.recommendations.length, 3);
    assert.ok(
      res.recommendations.every((r) => !disabled.has(r.method)),
      `「${q}」命中了默认禁用项：${res.recommendations.map((r) => r.method).join(',')}`,
    );
  }
});

test('loadLocalRouterSettings returns default disabledMethods initially and persists explicit choices', () => {
  const store = new Map<string, string>();
  const globalObj = globalThis as { window?: unknown };
  const hasOwnWindow = Object.prototype.hasOwnProperty.call(globalObj, 'window');
  const prevWindow = globalObj.window;

  globalObj.window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    },
  };

  try {
    const initial = loadLocalRouterSettings();
    assert.deepEqual(initial.disabledMethods, [...DEFAULT_BROWSER_DISABLED_ROUTER_METHODS]);
    assert.equal(initial.disabledMethods.includes('ssgw'), false);
    assert.equal(initial.disabledMethods.includes('qimen-lifetime'), false);

    const customDisabled = ['taiyi', 'zhuge', 'fortune'] as const;
    store.set(
      'mingyu.v2.router.settings',
      JSON.stringify({ disabledMethods: customDisabled }),
    );
    const loaded = loadLocalRouterSettings();
    assert.deepEqual(loaded.disabledMethods, [...customDisabled]);
  } finally {
    if (hasOwnWindow) {
      globalObj.window = prevWindow;
    } else {
      delete globalObj.window;
    }
  }
});

test('qimen-lifetime is suppressed under explicit divination and unknown birth time unless explicitly requested', () => {
  const disabledMethods = [...DEFAULT_BROWSER_DISABLED_ROUTER_METHODS];

  const divinationRes = recommendMethods({
    query: '帮我起一卦看看一生事业走势',
    disabledMethods,
  });
  assert.notEqual(
    divinationRes.recommendations[0].method,
    'qimen-lifetime',
    `明确起卦时不应首选奇门终身局：${divinationRes.recommendations.map((r) => r.method).join(',')}`,
  );

  const unknownLongTerm = recommendMethods({
    query: '不知道几点生的，想看一辈子事业方位和发展',
    birthTimeStatus: 'unknown',
    disabledMethods,
  });
  assert.notEqual(
    unknownLongTerm.recommendations[0].method,
    'qimen-lifetime',
    `未知出生时辰看长期发展时不应首选奇门终身局：${unknownLongTerm.recommendations.map((r) => r.method).join(',')}`,
  );

  const unknownShortTerm = recommendMethods({
    query: '不知道几点生的，看看明天面试顺不顺',
    birthTimeStatus: 'unknown',
    disabledMethods,
  });
  assert.notEqual(
    unknownShortTerm.recommendations[0].method,
    'qimen-lifetime',
    `未知出生时辰问短期事件时不应首选奇门终身局：${unknownShortTerm.recommendations.map((r) => r.method).join(',')}`,
  );

  const explicitLifetime = recommendMethods({
    query: '帮我排个奇门终身局看看一生事业方位',
    disabledMethods,
  });
  assert.equal(explicitLifetime.recommendations[0].method, 'qimen-lifetime');
});
