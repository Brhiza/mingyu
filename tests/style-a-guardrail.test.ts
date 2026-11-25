import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStyleACompactCard } from '../src/style-a/compact-card';
import { runWithStyleAGuardrail, verifyStyleAOutput } from '../src/style-a/guardrail';
import {
  buildAstrolabeCompactCard,
  buildLiuyaoCompactCard,
  buildQimenCompactCard,
  buildQizhengCompactCard,
  verifyExtraStyleAOutput,
} from '../src/style-a/extra-systems';

const BIRTH = {
  calendar: 'solar' as const,
  year: 1992,
  month: 5,
  day: 16,
  timezone: 8,
  timeStandard: 'civil' as const,
  clock: { kind: 'exact' as const, hour: 10, minute: 30, second: 0 },
};

test('生产级浓缩输入卡（含当日四层基准锚点）与 60 甲子自主顺推校验', async () => {
  const card = await buildStyleACompactCard({
    system: 'bazi',
    birth: BIRTH,
    gender: 'male',
    referenceTime: '2026-11-24T12:00:00+08:00',
    question: '请从当日四层基准顺推未来三年流年及接下来几天流日，看事业走势',
    anchorOnly: true,
  });

  assert.equal(card.system, 'bazi');
  assert.match(card.userPrompt, /当日四层基准（2026-11-24）/);
  assert.match(card.userPrompt, /后续大运\/流年\/流月\/流日请按60甲子自行顺推/);
  assert.equal(card.facts.system, 'bazi');
  assert.equal(card.facts.dayMaster, '壬');

  // 1. 模型自主顺推真实 2029己酉、2030庚戌，以及当日流日后的顺推日柱，应 100% 放行
  const goodAnswer = [
    '【定格与强弱】日主壬生于巳月绝地，四柱壬申/乙巳/壬寅/乙巳，得申金长生之根而仍偏弱；立偏印格，调候与扶抑一致，先顾印比扶身。',
    '【病药与喜忌】主病在巳火财旺耗身兼双乙伤官泄气，喜用：金、水（主用印星）；忌：木、火、土（主忌食伤）。',
    '【核心象义】事业看官杀印绶与职场平台：原局伤官明透泄秀，身弱须靠金印制伤护官，方能将专业创意落地为职权与稳定成果。',
    '【岁运引动】当前戊申大运忌土喜金，申金印星托底；自主顺推2026丙午忌火、2027丁未忌火土、2028戊申喜金转稳、2029己酉正印旺地利晋升、2030庚戌偏印透干可破局。',
    '【边界核验】须核验出生地真太阳时与时柱乙巳准确性；具体职场跃升幅度受行业五行与现实平台条件约束。',
  ].join('\n');

  const okReport = verifyStyleAOutput(goodAnswer, card.facts, card.topic);
  assert.equal(okReport.passed, true, `预期放行，实际失败：${okReport.failures.join(' | ')}`);

  // 2. 模型把 2029 年干支算错成 戊酉，护栏应 1 毫秒精准拦截并给出真实答案 己酉
  const badAnswer = goodAnswer.replace('2029己酉', '2029戊酉');
  const badReport = verifyStyleAOutput(badAnswer, card.facts, card.topic);
  assert.equal(badReport.passed, false);
  assert.match(badReport.correctionPrompt, /2029年真实干支应为己酉/);
});

test('本地排盘护栏自动纠错重试闭环：第1次幻觉被拦 -> 注入纠错提示 -> 第2次修正放行', async () => {
  const card = await buildStyleACompactCard({
    system: 'ziwei',
    birth: BIRTH,
    gender: 'male',
    referenceTime: '2026-11-24T12:00:00+08:00',
    question: '明年事业适合跳槽还是晋升？',
  });

  let seenCorrection = '';
  const res = await runWithStyleAGuardrail({
    systemPrompt: card.systemPrompt,
    userPrompt: card.userPrompt,
    facts: card.facts,
    topic: card.topic,
    maxRetries: 2,
    generate: async (messages, attempt) => {
      if (attempt === 1) {
        // 模拟第 1 次模型犯两个错：算错 2027 年干支 + 夹带鸡汤词
        return [
          '【定格与强弱】命宫子水二局，成水澄桂萼与君子在野，格局清奇而带擎羊陷煞，先稳后动。',
          '【病药与喜忌】病在擎羊陷守命与流忌冲动，药在太阴庙旺与三方禄权制衡，放宽心加油。',
          '【核心象义】事业看官禄宫与职权变动节奏，明年适合稳中求进，忌盲目折腾。',
          '【岁运引动】2026丙午叠宫变动，2027丙申流年宜守成，2028戊申再图进取。',
          '【边界核验】须核对出生时辰准确性，具体晋升需结合现实职场条件。',
        ].join('\n');
      }
      // 第 2 次应收到精准纠错提示
      seenCorrection = messages[messages.length - 1].content;
      return [
        '【定格与强弱】命宫子水二局，成水澄桂萼与君子在野，格局清奇而带擎羊陷煞，底盘外静内刚。',
        '【病药与喜忌】病在擎羊陷守命易生摩擦耗损，药在太阴庙旺与禄权制衡，最怕流忌叠冲官禄。',
        '【核心象义】事业看官禄宫与职权平台，明年利依托既有积累争取晋升，忌情绪化仓促跳槽。',
        '【岁运引动】当前大限稳中带变；2026丙午防职场人际消耗，2027丁未流禄太阴利晋升，2028戊申再图外拓。',
        '【边界核验】须核对出生时辰（跨时辰即改命宫立极）与现实行业环境约束。',
      ].join('\n');
    },
  });

  assert.equal(res.ok, true);
  assert.equal(res.attempts, 2);
  assert.match(seenCorrection, /2027年真实干支应为丁未/);
  assert.match(seenCorrection, /禁用通俗安抚词/);
});

test('八字第8项十神实时数学验算 + 紫微第9项流年四化实时查表验算', async () => {
  const baziCard = await buildStyleACompactCard({
    system: 'bazi',
    birth: BIRTH,
    gender: 'male',
    referenceTime: '2026-11-24T12:00:00+08:00',
    question: '今年事业走势如何？',
  });
  // 确认前置输入卡已自动标出大运和流年的天干十神
  assert.match(baziCard.userPrompt, /戊七杀|丙偏财/);

  // 模拟把壬日主见乙木错写成“乙木偏财”（实际壬见乙为伤官）
  const wrongTenGod = [
    '【定格与强弱】日主壬生于巳月，偏弱立偏印格，调候与扶抑一致，先顾印比扶身。',
    '【病药与喜忌】主病在乙木偏财泄气过重，喜用：金、水（主用印星）；忌：木、火、土。',
    '【核心象义】事业看官杀印绶，身弱需金印护官以稳职场平台。',
    '【岁运引动】当前戊申大运喜金托底，2026丙午忌火、2027丁未防耗损。',
    '【边界核验】须核验出生时辰准确性及现实行业五行属性。',
  ].join('\n');
  const r1 = verifyStyleAOutput(wrongTenGod, baziCard.facts, baziCard.topic);
  assert.equal(r1.passed, false);
  assert.match(r1.correctionPrompt, /日主壬见乙应为伤官/);

  const ziweiCard = await buildStyleACompactCard({
    system: 'ziwei',
    birth: BIRTH,
    gender: 'male',
    referenceTime: '2026-11-24T12:00:00+08:00',
    question: '顺推2029年流年四化看事业',
  });
  const wrongSihua = [
    '【定格与强弱】命宫子水二局，成水澄桂萼与君子在野，格局清奇而带擎羊陷煞。',
    '【病药与喜忌】病在擎羊陷守命，药在太阴庙旺与禄权制衡。',
    '【核心象义】事业看官禄宫与职权变动节奏，宜稳中求进。',
    '【岁运引动】2026丙午廉贞忌防耗，2029己酉贪狼化忌冲官禄须防文书失误。',
    '【边界核验】须核对出生时辰与现实条件。',
  ].join('\n');
  const r2 = verifyStyleAOutput(wrongSihua, ziweiCard.facts, ziweiCard.topic);
  assert.equal(r2.passed, false);
  assert.match(r2.correctionPrompt, /2029己干化忌应为文曲/);
});

test('奇门、六爻、星盘、七政四大扩展术数浓缩输入卡与本地基础题硬核护栏', async () => {
  const qm = await buildQimenCompactCard({
    divinationTime: '2026-11-24T10:30:00+08:00',
    question: '这个合作项目能谈成吗？',
  });
  assert.match(qm.userPrompt, /【奇门遁甲核心事实】/);
  const qmBad = [
    '【定格与强弱】本局阳遁8局，值符天辅，整体格局偏稳。',
    '【病药与喜忌】病在门迫空亡，药在三奇得使。',
    '【核心象义】合作看六合与生门，短期沟通多磨合。',
    '【岁运引动】待填实冲空之日见分晓，宜先稳后进。',
    '【边界核验】须结合双方实际合同条款与预算核验。',
  ].join('\n');
  const qmRep = verifyExtraStyleAOutput(qmBad, qm.facts);
  assert.equal(qmRep.passed, false);
  assert.match(qmRep.correctionPrompt, /阴阳遁写反/);

  const ly = await buildLiuyaoCompactCard({
    divinationTime: '2026-11-24T10:30:00+08:00',
    question: '近期跳槽去新公司发展如何？',
  });
  assert.match(ly.userPrompt, /【六爻纳甲核心事实】/);
  if (ly.facts.system === 'liuyao' && ly.facts.isStatic) {
    const lyBad = [
      `【定格与强弱】本卦${ly.facts.originalName}，初爻动化回头克，格局多变。`,
      '【病药与喜忌】病在官鬼伏藏，药在月日生扶。',
      '【核心象义】跳槽看官鬼与父母，近期平台变动受阻。',
      '【岁运引动】逢冲飞露伏之日方有新机会。',
      '【边界核验】须结合实际面试进度核验。',
    ].join('\n');
    const lyRep = verifyExtraStyleAOutput(lyBad, ly.facts);
    assert.equal(lyRep.passed, false);
    assert.match(lyRep.correctionPrompt, /六爻静卦/);
  }

  const flatBirth = { year: 1992, month: 5, day: 16, hour: 10, minute: 30, second: 0, timezone: 8, longitude: 116.4, latitude: 39.9 };
  const as = await buildAstrolabeCompactCard({ birth: flatBirth, question: '明年事业如何？' });
  assert.match(as.userPrompt, /【西洋星盘核心事实】/);
  const asBad = [
    '【定格与强弱】上升狮子，太阳双子落10宫，月亮天蝎落4宫，格局外放内敛。',
    '【病药与喜忌】核心矛盾在日月对冲，须平衡事业野心与情绪安全感。',
    '【核心象义】事业看10宫与官禄主，明年利稳扎稳打。',
    '【岁运引动】2026丙午至2027丁未小限切宫，利团队协作。',
    '【边界核验】须核对出生经纬度与分秒精度。',
  ].join('\n');
  const asRep = verifyExtraStyleAOutput(asBad, as.facts);
  assert.equal(asRep.passed, false);
  assert.match(asRep.correctionPrompt, /太阳星座写错/);

  const qz = await buildQizhengCompactCard({ birth: flatBirth, gender: 'male', question: '今年事业财运走势如何？' });
  assert.match(qz.userPrompt, /【七政四余核心事实】/);
  const qzBad = [
    '【定格与强弱】昼生命主月，五行属水，格局清润。',
    '【病药与喜忌】金星为难星克身，须防破耗反复。',
    '【核心象义】事业财运看官禄与财帛宫主，宜守正出奇。',
    '【岁运引动】2026丙午流年小限引动，下半年渐趋平稳。',
    '【边界核验】须核对真太阳时与出生地经纬度。',
  ].join('\n');
  const qzRep = verifyExtraStyleAOutput(qzBad, qz.facts);
  assert.equal(qzRep.passed, false);
  assert.match(qzRep.correctionPrompt, /恩难反转/);
});
