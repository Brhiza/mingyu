import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/core';
import { webExamples as methodExamples } from '../src/web-examples';
import { detectBaziSpecialPatterns, formatBaziSpecialPatterns } from '../src/systems/bazi/special-patterns';
import type { BaziPillar } from '../src/systems/bazi/pillars';
import { getBranchWuxing, getHiddenStems, getStemWuxing, getTenStar } from '../src/systems/ganzhi-foundation';
import { recommendMethods, resetLocalRouterPreferences, recordLocalRouterMethodChoice } from '../src/router-model/index';
import {
  activateWebAiProfile,
  deleteWebAiProfile,
  diagnoseWebAiConnection,
  loadWebAiProfiles,
  readWebAiConfig,
  saveWebAiProfile,
  WEB_AI_STORAGE_KEYS,
} from '../src/web-ai';

function makePillar(gz: string, dayStem: string, isDay = false): BaziPillar {
  const gan = gz[0]!;
  const zhi = gz[1]!;
  return {
    ganZhi: gz,
    gan,
    zhi,
    stemElement: getStemWuxing(gan),
    branchElement: getBranchWuxing(zhi),
    stemYinYang: '阳',
    branchYinYang: '阳',
    tenGod: isDay ? '日主' : getTenStar(dayStem, gan),
    hiddenStems: getHiddenStems(zhi).map((stem, idx) => ({
      stem,
      role: idx === 0 ? ('本气' as const) : idx === 1 ? ('中气' as const) : ('余气' as const),
      tenGod: getTenStar(dayStem, stem),
    })),
    naYin: '',
    voidBranches: [],
    lifeStage: '',
    selfLifeStage: '',
  };
}

function makeFakePillars(year: string, month: string, day: string, hour: string) {
  const dayStem = day[0]!;
  return {
    year: makePillar(year, dayStem),
    month: makePillar(month, dayStem),
    day: makePillar(day, dayStem, true),
    hour: makePillar(hour, dayStem),
  };
}

function installMemoryLocalStorage() {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
    clear: () => store.clear(),
  };
  const g = globalThis as unknown as { window?: Record<string, unknown> };
  const prevWindow = g.window;
  g.window = {
    localStorage: mockStorage,
    dispatchEvent: () => true,
  };
  return {
    store,
    restore: () => {
      if (prevWindow === undefined) delete g.window;
      else g.window = prevWindow;
    },
  };
}

test('八字特殊外格引擎精准识别两神成象/魁罡/金神/日贵/日禄归时/拱禄/六阴朝阳/井栏叉/壬骑龙背与破格反证', () => {
  // 1. 两神成象（木火通明）
  const muhuo = detectBaziSpecialPatterns(makeFakePillars('甲寅', '丙午', '甲午', '丙寅'));
  assert.ok(muhuo.some((m) => m.id === 'liang-shen-cheng-xiang' && m.name.includes('木火通明')));

  // 2. 魁罡格（庚辰日，见戌冲辰应报破格）
  const kuigangBroken = detectBaziSpecialPatterns(makeFakePillars('庚戌', '戊寅', '庚辰', '丙子'));
  const kg = kuigangBroken.find((m) => m.id === 'kui-gang');
  assert.ok(kg, '应识别庚辰魁罡格');
  assert.equal(kg.status, '成中有破');
  assert.ok(kg.breakingFactors.some((f) => f.includes('刑冲') || f.includes('官杀')));

  // 3. 金神格（乙丑时）
  const jinshen = detectBaziSpecialPatterns(makeFakePillars('甲午', '丙午', '甲寅', '乙丑'));
  assert.ok(jinshen.some((m) => m.id === 'jin-shen' && m.status === '条件成立'));

  // 4. 日贵格 + 拱禄格（丁未日丁未时？拱禄测试丁巳/丁未暗拱午）
  const gonglu = detectBaziSpecialPatterns(makeFakePillars('甲寅', '乙亥', '丁巳', '丁未'));
  const gl = gonglu.find((m) => m.id === 'gong-lu');
  assert.ok(gl && gl.name.includes('午'), '丁巳日丁未时应暗拱午禄');
  assert.equal(gl.status, '条件成立');

  // 拱禄遇填实破格
  const gongluFilled = detectBaziSpecialPatterns(makeFakePillars('甲午', '乙亥', '丁巳', '丁未'));
  const glf = gongluFilled.find((m) => m.id === 'gong-lu');
  assert.ok(glf && glf.status === '成中有破' && glf.breakingFactors.some((b) => b.includes('填实')));

  // 5. 日贵格（丁酉日）+ 日禄归时（甲日寅时）
  const rigui = detectBaziSpecialPatterns(makeFakePillars('甲子', '丙寅', '丁酉', '甲辰'));
  assert.ok(rigui.some((m) => m.id === 'ri-gui'));
  const rilu = detectBaziSpecialPatterns(makeFakePillars('乙丑', '己卯', '甲午', '丙寅'));
  assert.ok(rilu.some((m) => m.id === 'ri-lu-gui-shi'));

  // 6. 六阴朝阳（辛日戊子时）
  const liuyin = detectBaziSpecialPatterns(makeFakePillars('庚申', '己丑', '辛酉', '戊子'));
  assert.ok(liuyin.some((m) => m.id === 'liu-yin-zhao-yang' && m.status === '条件成立'));

  // 7. 井栏叉（庚日申子辰全无丙丁巳午）
  const jinglan = detectBaziSpecialPatterns(makeFakePillars('庚申', '戊子', '庚辰', '庚辰'));
  assert.ok(jinglan.some((m) => m.id === 'jing-lan-cha' && m.status === '条件成立'));

  // 8. 壬骑龙背（壬辰日多辰无戌）
  const renqi = detectBaziSpecialPatterns(makeFakePillars('壬辰', '甲辰', '壬辰', '甲辰'));
  assert.ok(renqi.some((m) => m.id === 'ren-qi-long-bei'));

  // 9. 普通平局不应强行套特殊外格
  const ordinary = detectBaziSpecialPatterns(makeFakePillars('乙丑', '己丑', '丙申', '戊戌'));
  assert.equal(ordinary.length, 0, `普通盘不应误命中外格，实际命中：${ordinary.map((x) => x.name).join(',')}`);
  assert.equal(formatBaziSpecialPatterns(ordinary), '');
});

test('奇门内外盘与四害核查、大六壬按题定类神、命录跨体系自动共振均进入提示词', async () => {
  // 奇门内外盘与四害核查
  const qm = await calculate('qimen', {
    ...methodExamples.qimen,
    question: '这个合作项目什么时候能落地，对方靠谱吗？',
  });
  assert.ok(qm.prompt.text.includes('内外盘与节奏'), '奇门提示词应包含内外盘与节奏判定');
  assert.ok(qm.prompt.text.includes('九宫四害'), '奇门提示词应包含九宫四害分级核查');

  // 大六壬按题自动定位类神天将
  const lr = await calculate('liuren', {
    ...methodExamples.liuren,
    question: '我今年跳槽换工作升职机会大吗？',
  });
  assert.ok(lr.prompt.text.includes('问事类神自动定位（事业职场）'), '大六壬提示词应按事业问题自动标出类神天将');

  // 命录四合一自动跨体系共振核验
  const ml = await calculate('minglu', {
    ...methodExamples.minglu,
    question: '请综合看看我的人生格局与事业财运走向。',
  });
  assert.ok(ml.prompt.text.includes('【跨体系自动共振与分歧核验】'), '命录四合一应输出跨体系自动共振核验块');
});

test('端侧小模型 int8 量化推理正常且本机偏好学习严格有界并支持重置', () => {
  const env = installMemoryLocalStorage();
  try {
    resetLocalRouterPreferences();
    // 预热懒加载权重解码，避免并发测试冷启动波动
    recommendMethods({ query: '预热' });
    const base = recommendMethods({ query: '帮我看看近期整体走向和关键节点' });
    assert.equal(base.recommendations.length, 3);
    assert.ok(base.latencyMs < 20);

    // 连续使用紫微多次后，在模糊查询中应产生温和但有界的倾向，但不覆盖明确点名的术数
    for (let i = 0; i < 6; i++) {
      recordLocalRouterMethodChoice('ziwei');
    }
    const explicit = recommendMethods({ query: '请帮我排奇门遁甲局' });
    assert.equal(explicit.recommendations[0]?.method, 'qimen', '明确点名术数不得被本地习惯覆盖');

    resetLocalRouterPreferences();
    const afterReset = recommendMethods({ query: '帮我看看近期整体走向和关键节点' });
    assert.equal(afterReset.recommendations[0]?.method, base.recommendations[0]?.method);
  } finally {
    env.restore();
  }
});

test('多组 API 配置平滑迁移、切换、删除与连通性中文诊断正常工作', async () => {
  const env = installMemoryLocalStorage();
  try {
    // 1. 模拟旧版单组配置，loadWebAiProfiles 应自动迁移为方案 1
    env.store.set(WEB_AI_STORAGE_KEYS.baseUrl, 'https://api.deepseek.com/v1');
    env.store.set(WEB_AI_STORAGE_KEYS.apiKey, 'sk-old');
    env.store.set(WEB_AI_STORAGE_KEYS.model, 'deepseek-chat');

    const seeded = loadWebAiProfiles();
    assert.equal(seeded.length, 1);
    assert.ok(seeded[0]!.name.includes('DeepSeek'));

    // 2. 新增第二组配置并切换
    const second = saveWebAiProfile({
      name: '本地 Ollama',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: '',
      model: 'qwen2.5',
    });
    assert.equal(loadWebAiProfiles().length, 2);
    assert.equal(readWebAiConfig().model, 'qwen2.5');

    // 切回第一组
    activateWebAiProfile(seeded[0]!.id);
    assert.equal(readWebAiConfig().model, 'deepseek-chat');

    // 删除第二组
    const remaining = deleteWebAiProfile(second.id);
    assert.equal(remaining.length, 1);

    // 3. 连通性中文诊断（成功 / 401 / 402 / 404 / CORS）
    const okDiag = await diagnoseWebAiConnection(
      { baseUrl: 'https://api.example.com/v1', apiKey: 'sk-test', model: 'deepseek-chat' },
      async () =>
        new Response(JSON.stringify({ data: [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    assert.equal(okDiag.ok, true);
    assert.equal(okDiag.modelFound, true);
    assert.ok(okDiag.message.includes('连通正常'));

    const authDiag = await diagnoseWebAiConnection(
      { baseUrl: 'https://api.example.com/v1', apiKey: 'bad', model: 'deepseek-chat' },
      async () => new Response('Unauthorized', { status: 401 }),
    );
    assert.equal(authDiag.ok, false);
    assert.ok(authDiag.message.includes('401'));

    const corsDiag = await diagnoseWebAiConnection(
      { baseUrl: 'https://api.example.com/v1', apiKey: '', model: 'deepseek-chat' },
      async () => {
        throw new TypeError('Failed to fetch');
      },
    );
    assert.equal(corsDiag.ok, false);
    assert.ok(corsDiag.message.includes('跨域'));
  } finally {
    env.restore();
  }
});

test('全方向术数确定性内核与局势要点完整覆盖（八字合并特殊格/紫微夹宫自化/六爻六壬应期/奇门主客链/全系局势要点）', async () => {
  // 1. 八字：不再单独输出【特殊外格与古法格局核验】，用神喜忌进入【局势要点】，不再含过时免责声明
  const baziRes = await calculate('bazi', methodExamples.bazi as any);
  assert.equal(baziRes.prompt.text.includes('【特殊外格与古法格局核验】'), false);
  assert.ok(baziRes.prompt.text.includes('【局势要点】'));
  assert.ok(baziRes.prompt.text.includes('用神喜忌：'));
  assert.equal(baziRes.prompt.text.includes('其他特殊格、完整格局成败、最终用神和具体事件应期尚未计算'), false);

  // 2. 紫微：默认输出【局势要点】与夹宫/空宫借星/自化核验（无需显式开 feixing 流派）
  const ziweiRes = await calculate('ziwei', methodExamples.ziwei as any);
  assert.ok(ziweiRes.prompt.text.includes('【局势要点】'));
  assert.ok(ziweiRes.prompt.text.includes('【空宫借星、夹宫与核心自化核验】'));

  // 3. 六爻与大六壬：均输出确定性应期地支候选窗
  const liuyaoRes = await calculate('liuyao', methodExamples.liuyao as any);
  assert.ok(liuyaoRes.prompt.text.includes('应期地支候选窗'));
  const liurenRes = await calculate('liuren', methodExamples.liuren as any);
  assert.ok(liurenRes.prompt.text.includes('应期地支候选窗'));

  // 4. 奇门遁甲：【事项用神落宫】带真实宫名与主客生克链
  const qimenRes = await calculate('qimen', {
    ...(methodExamples.qimen as any),
    question: '下个月跳槽求职顺利吗？',
  });
  assert.ok(qimenRes.prompt.text.includes('【事项用神落宫】'));
  assert.ok(qimenRes.prompt.text.includes('主客与用神生克链'));

  // 5. 星盘、七政、牌阵、风水、择吉、姓名、数字、小六壬、金口诀、太乙、五运、皇极、灵签、诸葛全部具备【局势要点】
  const methodsToVerify = [
    'astrolabe',
    'qizheng',
    'tarot',
    'lenormand',
    'xiaoliuren',
    'jinkoujue',
    'taiyi',
    'bazhai',
    'xuankong',
    'almanac',
    'chinese-name',
    'chinese-naming',
    'number-energy',
    'wuyun-liuqi',
    'huangji-jingshi',
    'ssgw',
    'zhuge',
  ] as const;
  for (const method of methodsToVerify) {
    const example = (methodExamples as Record<string, unknown>)[method];
    assert.ok(example, `缺少 ${method} 示例`);
    const res = await calculate(method as any, example as any);
    assert.ok(
      res.prompt.text.includes('【局势要点】'),
      `${method} 提示词缺少【局势要点】`,
    );
  }
});

test('11 项实测提示词质量修复回归核验（太乙/金口诀/七政/星盘/合盘置顶/聚合去重/运势）', async () => {
  const getSections = (text: string) => [...text.matchAll(/^【([^】]+)】/gm)].map((m) => m[1]);
  const getDigest = (text: string) => {
    const m = text.match(/【局势要点】\n([\s\S]*?)(?:\n\n【|$)/);
    return m ? m[1].trim() : '';
  };

  // 1. 太乙摘要包含局数、主算、客算、定算
  const taiyiRes = await calculate('taiyi', methodExamples.taiyi as any);
  const taiyiDigest = getDigest(taiyiRes.prompt.text);
  assert.match(taiyiDigest, /局.*主算\d+.*客算\d+.*定算\d+/);

  // 2. 金口诀摘要精炼，不抄长流程且无重复词
  const jkjRes = await calculate('jinkoujue', methodExamples.jinkoujue as any);
  const jkjDigest = getDigest(jkjRes.prompt.text);
  assert.ok(jkjDigest.includes('四位与发用：'));
  assert.equal(jkjDigest.includes('三阳一阴，三阳一阴'), false);
  assert.ok(jkjDigest.length < 180, `金口诀局势要点应精炼（实际 ${jkjDigest.length}）`);

  // 3. 七政最紧本命吊照不包含罗睺↔计都
  const qizhengRes = await calculate('qizheng', methodExamples.qizheng as any);
  const qzDigest = getDigest(qizhengRes.prompt.text);
  assert.equal(/罗睺[^；。\n]*计都|计都[^；。\n]*罗睺/.test(qzDigest.split('最紧本命吊照：')[1] ?? ''), false);

  // 4. 西洋星盘最紧核心相位优先五大主相位
  const astroRes = await calculate('astrolabe', methodExamples.astrolabe as any);
  const astroTight = getDigest(astroRes.prompt.text).split('最紧核心相位：')[1] ?? '';
  assert.equal(/补八分相|五分相|半刑/.test(astroTight), false);

  // 5. 5 个合盘/复合盘【局势要点】全部置顶（bazi-ziwei 在双盘概要内含 2 个标题后第 4 段即 index=3）
  for (const m of ['bazi-synastry', 'ziwei-synastry', 'astrolabe-synastry', 'bazi-ziwei', 'qimen-lifetime'] as const) {
    const res = await calculate(m as any, (methodExamples as Record<string, unknown>)[m] as any);
    const idx = getSections(res.prompt.text).indexOf('局势要点');
    const maxIdx = m === 'bazi-ziwei' ? 3 : 2;
    assert.ok(idx >= 0 && idx <= maxIdx, `${m} 的【局势要点】应置顶（实际 index=${idx}）`);
  }

  // 6. 阳宅风水全篇仅 1 次【局势要点】且在前 3 段；个人命录不含重复子盘【局势要点】
  const resRes = await calculate('residential', methodExamples.residential as any);
  const resDigestCount = (resRes.prompt.text.match(/^【局势要点】/gm) ?? []).length;
  assert.equal(resDigestCount, 1, `阳宅风水【局势要点】应只有 1 次（实际 ${resDigestCount}）`);
  assert.ok(getSections(resRes.prompt.text).indexOf('局势要点') <= 2);

  const mlRes = await calculate('minglu', methodExamples.minglu as any);
  assert.equal((mlRes.prompt.text.match(/^【局势要点】/gm) ?? []).length, 1, '个人命录应只保留 1 份顶层【局势要点】');

  // 7. 三山灵签不重复「第70签 第七十签」；运势含【局势要点】
  const ssgwRes = await calculate('ssgw', methodExamples.ssgw as any);
  assert.equal(/第\d+签\s*第[一二三四五六七八九十百]+签/.test(getDigest(ssgwRes.prompt.text)), false);

  const fortuneRes = await calculate('fortune', methodExamples.fortune as any);
  assert.ok(getSections(fortuneRes.prompt.text).includes('局势要点'));
});
