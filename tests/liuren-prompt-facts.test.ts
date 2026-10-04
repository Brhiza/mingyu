import assert from 'node:assert/strict';
import test from 'node:test';
import { STEM_WUXING } from '../packages/core/src/ganzhi/data';
import {
  analyzeLiurenEvidence,
  generateLiuren,
} from '../packages/core/src/divination/algorithms/liuren';
import {
  buildDivinationPrompt,
  formatDivinationInfo,
  getDivinationSummaryBlocks,
} from '../packages/core/src/prompt/divination';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';
import { buildDivinationPrompt as buildAppDivinationPrompt } from '../src/lib/divination/engine';
import {
  formatLiurenLesson,
  formatLiurenTransmission,
  formatLiurenOrdinaryTransmissionAdjudication,
  omitRepeatedLiurenFocusMonthState,
  omitRepeatedLiurenRidingMonthState,
} from '../packages/core/src/prompt/liuren-facts';
import { formatLiurenJudgmentFacts } from '../packages/core/src/prompt/liuren-judgment';
import { extractDivinationPromptFacts } from '../scripts/prompt-audit/divination-facts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts';
import { resolveLiurenClassicalRules } from '../packages/core/src/divination/algorithms/liuren/helpers/classical-rules';

const fixedDate = '2026-05-19T10:30:00+08:00';
const fixedChart = generateLiuren(new Date(fixedDate));

function makeFixedChart() {
  return structuredClone(fixedChart);
}

test('大六壬四课和三传分别绑定实际上下位与前传，十二宫绑定天地盘及天将', () => {
  const data = makeFixedChart();
  assert.deepEqual(
    data.fourLessons.map((item) => [item.upper, item.lower]),
    [
      ['巳', '癸'],
      ['酉', '巳'],
      ['酉', '巳'],
      ['丑', '酉'],
    ],
  );
  assert.deepEqual(
    data.threeTransmissions.map((item) => item.branch),
    ['酉', '丑', '巳'],
  );
  const enhanced = formatEnhancedDivinationInfo('liuren', data);
  for (const text of [
    formatDivinationInfo('liuren', data),
    formatDetailedDivinationInfo('liuren', data),
    enhanced,
  ]) {
    assert.match(text, /下位癸水克上神巳火/);
    assert.match(text, /下位巳火克上神酉金/);
    assert.match(text, /上神丑土生下位酉金/);
    assert.match(text, /初传酉金生一课下位癸水/);
    assert.match(text, /中传丑土生初传酉金/);
    assert.match(text, /末传巳火生中传丑土/);
    assert.match(text, /初传取法：/);
    assert.doesNotMatch(text, /directKe|remoteKe|suppressedByPrior|deferredToSpecial/);
    assert.doesNotMatch(text, /上神酉金克下位巳火|初传酉金生中传丑土/);
  }
  assert.match(enhanced, /地盘卯上临天盘未乘朱雀/);
  assert.match(enhanced, /地盘未上临天盘亥乘天空/);
  assert.match(enhanced, /一课巳临癸乘贵人；下位癸水克上神巳火/u);
  assert.match(enhanced, /初传酉乘勾陈；初传酉金生一课下位癸水/u);
  assert.doesNotMatch(enhanced, /一课巳临癸乘贵人，水克火；|初传酉乘勾陈，金生水；/u);
  assert.match(
    formatLiurenLesson({ ...data.fourLessons[0], relation: '水克火，另有独立条件' }),
    /，水克火，另有独立条件；下位癸水克上神巳火/u,
  );
  assert.match(
    formatLiurenLesson({ ...data.fourLessons[0], upper: '', relation: '上下关系待核' }),
    /，上下关系待核$/u,
  );
  const extra = structuredClone(data);
  extra.threeTransmissions[0].relation = '金生水，另有独立条件';
  assert.match(
    formatLiurenTransmission(extra, 0),
    /，金生水，另有独立条件；初传酉金生一课下位癸水/u,
  );
  const capturePrompt = () => buildAppDivinationPrompt('liuren', '问合作进度', makeFixedChart());
  const baseline = capturePrompt();
  assert.match(baseline, /下位癸水克上神巳火/u);
  const original = STEM_WUXING.癸;
  try {
    STEM_WUXING.癸 = '土';
    assert.equal(STEM_WUXING.癸, '土');
    assert.equal(capturePrompt(), baseline);
  } finally {
    STEM_WUXING.癸 = original;
  }
  assert.equal(STEM_WUXING.癸, original);
  assert.equal(capturePrompt(), baseline);
});

test('大六壬概览只列一组四课与三传，贵人临地仍保留', () => {
  const data = makeFixedChart();
  const lines = getDivinationSummaryBlocks('liuren', data).lines;
  assert.equal(lines.filter((line) => line.startsWith('四课：')).length, 1);
  assert.equal(lines.filter((line) => line.startsWith('三传：')).length, 1);
  assert.ok(
    lines.some((line) => line.includes(`贵人${data.noblemanBranch}临${data.noblemanGroundBranch}`)),
  );
  assert.ok(!lines.some((line) => line.startsWith('四课关系：') || line.startsWith('三传主线：')));
  const prompt = buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' });
  assert.doesNotMatch(prompt, /四课关系：|三传主线：/);
  assert.match(prompt, new RegExp(`贵人${data.noblemanBranch}临${data.noblemanGroundBranch}`));
});

test('大六壬遥克提示词应说明直接克未命中且不得夹带贼克身份', () => {
  const data = generateLiuren(new Date('2026-01-01T06:00:00+08:00'));
  assert.equal(data.transmissionRule, '遥克法');
  assert.deepEqual(
    data.classicalRules?.map((item) => item.rule),
    ['遥克'],
  );
  const structuredBefore = structuredClone(data);

  for (const text of [
    ...[formatDivinationInfo, formatEnhancedDivinationInfo].map((format) => format('liuren', data)),
    buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' }),
  ]) {
    assert.match(text, /四课没有直接上下克，进入遥克/);
    assert.match(text, /最终按遥克法取.+发用/);
    assert.doesNotMatch(text, /贼克法：|四课先察上下相克/);
    assert.match(text, /蒿矢酉（采用：唯一的神克日干蒿矢候选）/);
    assert.match(text, /神克日干的蒿矢候选前置成立，弹射候选不再参与取舍/);
    assert.doesNotMatch(text, /弹射未|被前置宗门压制/);
    assert.match(text, /初传酉乘玄武（空）；初传酉金克一课下位乙木/);
    if (text.includes('课传反证：')) {
      assert.doesNotMatch(text, /课传反证：[^\n]*初传酉与前位关系金克木/);
      assert.match(text, /课传反证：[^\n]*三课上神酉落日柱旬空/);
      assert.match(text, /课传反证：[^\n]*中传未与日支关系土克水/);
    }
  }
  assert.deepEqual(data, structuredBefore);
});

test('大六壬复合取传规则只列当前有克或无克条件，重复课对按不同上神计数', () => {
  const fuyinNoKe = resolveLiurenClassicalRules('伏吟法');
  const fuyinKe = resolveLiurenClassicalRules('伏吟重审法');
  const fanyinNoKe = resolveLiurenClassicalRules('返吟法');
  const fanyinKe = resolveLiurenClassicalRules('返吟元首法');
  assert.match(fuyinNoKe[0].summary, /四课无克/);
  assert.doesNotMatch(fuyinNoKe[0].summary, /四课有克/);
  assert.match(fuyinKe[0].summary, /四课有克/);
  assert.doesNotMatch(fuyinKe[0].summary, /四课无克/);
  assert.match(fanyinNoKe[0].summary, /四课无克/);
  assert.doesNotMatch(fanyinNoKe[0].summary, /四课有克/);
  assert.match(fanyinKe[0].summary, /四课有克/);
  assert.doesNotMatch(fanyinKe[0].summary, /四课无克/);

  const data = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));
  assert.equal(data.transmissionRule, '返吟重审法');
  assert.deepEqual(
    data.fourLessons.map((item) => item.upper),
    ['申', '寅', '申', '寅'],
  );
  const structuredBefore = structuredClone(data);
  const prompt = buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' });
  assert.match(prompt, /返吟课兼四课下贼上：天盘与地盘相冲；四课见下贼上/);
  assert.match(prompt, /四课下贼上候选只有一个不同上神/);
  assert.doesNotMatch(prompt, /四课只有一处下贼上|无克另按井栏射取传/);
  assert.match(prompt, /初传取法：按返吟重审法取寅发用/);
  assert.doesNotMatch(prompt, /初传取法：；|常用取传规则未定|候选取舍：/);
  assert.deepEqual(data, structuredBefore);
});

test('大六壬完整提示词写入课体判据、取用定位和应期依据', () => {
  const data = makeFixedChart();
  const prompt = formatDivinationInfo('liuren', data);
  assert.ok(data.guaTiFacts?.length);
  for (const fact of data.guaTiFacts) {
    assert.ok(prompt.includes(`${fact.name}：${fact.matchedConditions.join('；')}`));
    assert.ok(prompt.includes(fact.sourceTitle));
  }
  for (const focus of data.focusEvidence ?? []) {
    assert.ok(prompt.includes(`${focus.role}${focus.target}`));
  }
  for (const timing of data.timingEvidence ?? []) {
    if (timing.startsWith('未给出目标期限时')) {
      assert.match(prompt, /以问题期限、三传先后和现实触发条件核对应期/);
    } else {
      assert.ok(prompt.includes(timing));
    }
  }
  assert.doesNotMatch(prompt, /sourceUrl|stableKey|notApplicable/);
});

test('大六壬详细课体判据已含名称时省略重复摘要，旧数据仍保留摘要', () => {
  const data = makeFixedChart();
  const prompt = formatEnhancedDivinationInfo('liuren', data);

  assert.ok(data.guaTiFacts?.length);
  assert.match(prompt, /课体判据：/);
  assert.doesNotMatch(prompt, /^课体：/m);
  for (const fact of data.guaTiFacts ?? []) {
    assert.match(prompt, new RegExp(`${fact.name}：`));
  }

  const legacyPrompt = formatEnhancedDivinationInfo('liuren', {
    ...data,
    guaTiFacts: undefined,
  });
  assert.match(legacyPrompt, /^课体：/m);
});

test('大六壬旧盘天地盘缺口时不把未核验课体判据送入在线提示词', () => {
  const data = makeFixedChart();
  assert.ok(data.guaTiFacts?.length);
  data.heavenlyPlate = [];

  const analysis = analyzeLiurenEvidence(data);
  assert.equal(analysis.calculationFact.noblemanGroundBranch, undefined);
  assert.doesNotMatch(analysis.calculationFact.promptText, /临地盘/u);
  const prompt = buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' });
  assert.match(prompt, new RegExp(`月将${data.monthLeader}加占时${data.divinationBranch}`));
  assert.match(prompt, new RegExp(`${data.dayNight}，日干贵人${data.noblemanBranch}`));
  assert.match(prompt, new RegExp(`日柱旬空${data.xunKong?.join('、')}`));
  assert.match(prompt, /天地盘资料：当前结果仅保留0\/12位天地盘资料/u);
  assert.doesNotMatch(
    prompt,
    /课传主线：|取传法：|初传取法：|四课：|三传：|神煞：|课体|取用定位：|应期依据：|课传反证：/u,
  );
  assert.doesNotMatch(prompt, /课体判据：|课体条件：|取传条件：/);
  for (const fact of data.guaTiFacts ?? []) {
    assert.ok(!prompt.includes(`${fact.name}：${fact.matchedConditions.join('；')}`));
  }
});

test('大六壬旧盘天地盘缺口时不把未核验的昼夜与贵人写入在线提示词', () => {
  const data = makeFixedChart();
  data.heavenlyPlate = [];
  data.dayNight = data.dayNight === '昼占' ? '夜占' : '昼占';
  data.noblemanBranch = data.noblemanBranch === '子' ? '丑' : '子';

  const prompt = buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' });
  assert.match(prompt, /未列，日干贵人未列/u);
  assert.doesNotMatch(prompt, /昼占，日干贵人/u);
  assert.doesNotMatch(prompt, /夜占，日干贵人/u);
});

test('大六壬真实旬空状态在三传与应期提示词中一致', () => {
  for (const [date, expectedVoid] of [
    ['2026-05-19T10:30:00+08:00', false],
    ['2026-05-02T10:30:00+08:00', true],
  ] as const) {
    const data = date === fixedDate ? makeFixedChart() : generateLiuren(new Date(date));
    const initial = data.threeTransmissions[0];
    const evidence = analyzeLiurenEvidence(data);
    assert.equal(initial.isVoid, expectedVoid);
    const enhanced = formatEnhancedDivinationInfo('liuren', data);
    for (const prompt of [
      formatDivinationInfo('liuren', data),
      formatDetailedDivinationInfo('liuren', data),
      enhanced,
    ]) {
      assert.equal(prompt.includes(`初传${initial.branch}乘${initial.god}（空）；`), expectedVoid);
    }
    for (const prompt of [
      enhanced,
      buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' }),
    ]) {
      assert.ok(prompt.includes(evidence.timingFacts[0].promptText));
      assert.ok(prompt.includes(evidence.timingFacts[1].promptText));
      assert.ok(prompt.includes(`初传${initial.branch}${expectedVoid ? '空亡' : '不空'}`));
    }
  }
});

test('大六壬完整提示词只补充尚未在盘面显示的判断事实', () => {
  const data = makeFixedChart();
  const adjudication = formatLiurenOrdinaryTransmissionAdjudication(data);
  assert.ok(adjudication.includes('候选取舍：'));
  assert.ok(formatLiurenJudgmentFacts(data).includes(adjudication));
  for (const prompt of [
    buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' }),
    buildAppDivinationPrompt('liuren', '问合作进度', data),
  ]) {
    const expectations = extractDivinationPromptFacts('liuren', data);
    assert.equal(expectations.length, 8);
    assert.deepEqual(auditPromptFacts(prompt, expectations).missing, []);
    for (const [role, detail, id] of [
      ['一课巳临癸乘贵人', '下位癸水克上神巳火', 'liuren.four-lesson.0'],
      ['初传酉乘勾陈', '初传酉金生一课下位癸水', 'liuren.three-transmission.0'],
    ] as const) {
      const line = prompt.split('\n').find((item) => item.includes(role) && item.includes(detail));
      assert.ok(line);
      const wrong = prompt.replace(
        line,
        line.replace(
          detail,
          detail === '下位癸水克上神巳火' ? '上神巳火克下位癸水' : '一课下位癸水生初传酉金',
        ),
      );
      assert.ok(auditPromptFacts(wrong, expectations).missing.includes(id));
    }
    assert.match(prompt, /课传主线：传态递传/);
    assert.doesNotMatch(prompt, /课传主线：取传涉害法/);
    assert.match(prompt, /初传取法：/);
    assert.match(prompt, /取传条件：/);
    assert.match(prompt, /课体判据：/);
    assert.match(prompt, /取用定位：/);
    assert.match(prompt, /应期依据：/);
    assert.match(prompt, /课传反证：/);
    assert.match(prompt, /初传酉与日支关系火克金/);
    assert.doesNotMatch(prompt, /课传反证：[^\n]*一课巳临癸，上下神关系水克火/);
    assert.doesNotMatch(prompt, /课传反证：[^\n]*(?:二课酉临巳|三课酉临巳)，上下神关系火克金/);
    assert.doesNotMatch(prompt, /课传反证：[^\n]*初传酉月令状态死/);
    assert.doesNotMatch(prompt, /取传说明：|课体条件：|重点依据：|时令依据：/);
    assert.equal(prompt.split(adjudication).length - 1, 1);
    for (const fact of data.guaTiFacts ?? []) {
      assert.equal(prompt.split(fact.matchedConditions.join('；')).length - 1, 1);
    }
    for (const focus of data.focusEvidence ?? []) {
      assert.ok(prompt.includes(`${focus.role}${focus.target}（${focus.level}）`));
      for (const limitation of focus.limitations) assert.ok(prompt.includes(limitation));
    }
  }
  assert.match(formatLiurenJudgmentFacts(data).join('\n'), /一课巳临癸，上下神关系水克火/);
});

test('大六壬月令旺衰集中在应期段，取用与乘神仍保留各自依据', () => {
  const data = makeFixedChart();
  for (const prompt of [
    buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' }),
    buildAppDivinationPrompt('liuren', '问合作进度', data),
  ]) {
    assert.match(prompt, /发用主轴初传酉乘勾陈（主证）：涉害法取为初传、火克金/u);
    assert.match(prompt, /初传酉（月令死）→中传丑（月令相）→末传巳（月令旺）/u);
    assert.match(prompt, /乘神生克：初传勾陈乘天盘酉金，与日干癸水为乘神生日，不逢旬空/u);
    assert.equal(prompt.split('月令死）').length - 1, 1);
    assert.equal(prompt.split('月令相）').length - 1, 1);
    assert.equal(prompt.split('月令旺）').length - 1, 1);
  }
});

test('大六壬应期段未列同一初传月令状态时保留取用和乘神资料', () => {
  const transmission = { stage: '初传', branch: '酉', seasonState: '死' } as const;
  const focusEvidence = ['涉害法取为初传', '月令死', '火克金'];
  const ridingFact = '初传勾陈乘天盘酉金，与日干癸水为乘神生日，月令死，不逢旬空';

  assert.deepEqual(
    omitRepeatedLiurenFocusMonthState(focusEvidence, [], transmission),
    focusEvidence,
  );
  assert.equal(omitRepeatedLiurenRidingMonthState(ridingFact, [], transmission), ridingFact);
  assert.deepEqual(
    omitRepeatedLiurenFocusMonthState(
      focusEvidence,
      ['二级三传：初传酉（月令死）→中传丑（月令相）→末传巳（月令旺）'],
      transmission,
    ),
    ['涉害法取为初传', '火克金'],
  );
});

test('大六壬在线提示词用取传依据和期限条件表达候选取舍', () => {
  const data = makeFixedChart();
  const legacyTiming = '未给出目标期限时，只判断先后、快慢和触发条件，不硬换成唯一日期';
  data.timingEvidence = [...(data.timingEvidence ?? []).slice(0, 3), legacyTiming];

  const analysis = analyzeLiurenEvidence(data);
  assert.equal(analysis.timingFacts[3].rawText, legacyTiming);
  assert.equal(analysis.timingFacts[3].promptText, '以问题期限、三传先后和现实触发条件核对应期');
  assert.ok(analysis.ordinaryTransmissionAdjudicationFact.candidateFacts.length > 0);
  assert.ok(analysis.counterEvidenceFacts.length > 0);
  const structuredBefore = structuredClone(data);

  for (const prompt of [
    buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' }),
    buildAppDivinationPrompt('liuren', '问合作进度', data),
    formatLiurenJudgmentFacts(data).join('\n'),
  ]) {
    assert.match(prompt, /四课直接上下克前置成立，取传采用直接克候选/);
    assert.match(prompt, /以问题期限、三传先后和现实触发条件核对应期/);
    assert.match(prompt, /课传反证：/);
    assert.doesNotMatch(prompt, /遥克不得抢占|未给出目标期限时|不硬换成唯一日期/);
    assert.equal(prompt.split('四课直接上下克前置成立，取传采用直接克候选').length - 1, 1);
    assert.match(prompt, /下贼上巳（排除：涉害深度0低于最大深度2）/);
    assert.match(prompt, /下贼上酉（采用：涉害深度及所临孟仲季复等，先取支上神）/);
    assert.doesNotMatch(prompt, /蒿矢丑|被前置宗门压制/);
  }
  assert.deepEqual(data, structuredBefore);
});

test('初传不空及空亡古诀只列发端条件，不直接断定现实进展', () => {
  const nonVoid = makeFixedChart();
  assert.equal(nonVoid.threeTransmissions[0].isVoid, false);
  assert.equal(nonVoid.threeTransmissions[0].seasonState, '死');
  const nonVoidPrompt = buildDivinationPrompt({
    method: 'liuren',
    data: nonVoid,
    question: '问合作进度',
  });
  assert.match(nonVoidPrompt, /初传酉不空，按月令旺衰、日支关系和事项类神核对发端条件/);
  assert.doesNotMatch(nonVoidPrompt, /可直接作为起始信号|为当前起始信号/);

  const recomputed = analyzeLiurenEvidence({ ...nonVoid, timingEvidence: [] });
  assert.match(recomputed.timingFacts[0].promptText, /按月令旺衰、日支关系和事项类神核对发端条件/);
  assert.deepEqual(
    recomputed.timingConditions,
    recomputed.timingFacts.map((item) => item.promptText),
  );
  assert.doesNotMatch(recomputed.promptText, /原结果提供|由盘面补齐|应期边界|不得|不换算/);

  const legacy = structuredClone(nonVoid);
  legacy.timingEvidence![0] = '一级发用：先看初传酉不空，可直接作为起始信号';
  const legacyAnalysis = analyzeLiurenEvidence(legacy);
  assert.equal(legacyAnalysis.timingFacts[0].rawText, legacy.timingEvidence![0]);
  const legacyPrompt = buildDivinationPrompt({
    method: 'liuren',
    data: legacy,
    question: '问合作进度',
  });
  assert.match(legacyPrompt, /初传酉不空，按月令旺衰、日支关系和事项类神核对发端条件/);
  assert.doesNotMatch(legacyPrompt, /可直接作为起始信号/);

  const voidData = generateLiuren(new Date('2026-05-02T10:30:00+08:00'));
  assert.equal(voidData.threeTransmissions[0].isVoid, true);
  const voidPrompt = buildDivinationPrompt({
    method: 'liuren',
    data: voidData,
    question: '问合作进度',
  });
  assert.match(voidPrompt, /毕法断诀：【旬在空亡发用虚】；初传空亡/);
  assert.doesNotMatch(voidPrompt, /发端有声无实|谋事防中途落空/);
});

test('大六壬未在四课行标明的空亡反证仍保留', () => {
  const data = generateLiuren(new Date('2026-05-01T10:30:00+08:00'));
  assert.equal(data.fourLessons[0].upper, '申');
  assert.ok(data.xunKong?.includes('申'));
  const prompt = buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' });
  assert.match(prompt, /课传反证：[^\n]*一课上神申落日柱旬空/);
});
