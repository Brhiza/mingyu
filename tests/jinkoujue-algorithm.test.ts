import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  analyzeJinkoujueEvidence,
  evaluateJinkoujueBihePoems,
  generateJinkoujue,
} from '../packages/core/src/divination/algorithms/jinkoujue.ts';
import { TimeManager } from '../packages/core/src/calendar/timeManager.ts';
import { buildDivinationPrompt } from '../packages/core/src/prompt/divination.ts';
import { formatJinkoujueJudgmentFacts } from '../packages/core/src/prompt/jinkoujue-facts.ts';
import {
  JINKOU_POSITION_ROLES,
  formatJinkoujuePositionPromptText,
} from '../packages/core/src/divination/jinkoujue-utils.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');
const fixedShenChart = generateJinkoujue({
  method: 'branch',
  branch: '申',
  customDate: SAMPLE_DATE,
});

const fixedDefaultChart = generateJinkoujue({ customDate: SAMPLE_DATE });
const fixedNumberOneChart = generateJinkoujue({
  method: 'number',
  number: 1,
  customDate: SAMPLE_DATE,
});
const twoWaterShenChart = generateJinkoujue({
  customDate: new Date('2025-03-28T12:00:00+08:00'),
  method: 'branch',
  branch: '申',
});

function createShenChart() {
  return structuredClone(fixedShenChart);
}

test('金口诀判断依据不读取旧反证缓存', () => {
  const data = createShenChart();
  assert.ok(data.evidenceAnalysis);
  Object.assign(data.evidenceAnalysis, {
    counterEvidenceFacts: [{ promptText: '伪造的旧反证' }],
  });
  assert.doesNotMatch(formatJinkoujueJudgmentFacts(data).join('\n'), /伪造的旧反证/u);
});

test('金口诀旧盘证据拒绝与结果时间元数据矛盾的起课时刻', () => {
  const data = createShenChart();
  const stale = structuredClone(data);
  stale.timestamp += 24 * 60 * 60 * 1000;

  assert.equal(data.meta?.calculatedAt, new Date(data.timestamp).toISOString());
  assert.equal(stale.monthLeader, data.monthLeader);
  assert.throws(() => analyzeJinkoujueEvidence(stale), /起课时间戳与结果元数据不一致/u);
  assert.throws(
    () => buildDivinationPrompt({ method: 'jinkoujue', data: stale, question: '核对旧盘' }),
    /起课时间戳与结果元数据不一致/u,
  );
});

test('金口诀新盘去掉结果元数据后仍按保存的时区复核起课时刻与四柱', () => {
  const source = createShenChart();
  const stale = structuredClone(source);
  delete stale.meta;
  stale.timestamp += 24 * 60 * 60 * 1000;

  assert.equal(source.timezoneOffsetMinutes, 480);
  assert.throws(() => analyzeJinkoujueEvidence(stale), /起课时刻与四柱不一致/u);
  assert.throws(
    () => buildDivinationPrompt({ method: 'jinkoujue', data: stale, question: '核对课盘' }),
    /起课时刻与四柱不一致/u,
  );

  const legacy = structuredClone(source);
  delete legacy.meta;
  delete legacy.timezoneOffsetMinutes;
  assert.equal(analyzeJinkoujueEvidence(legacy).calculationFact.status, '完整');
});

test('金口诀四柱复核沿用生成时的时区与节气参考时刻', () => {
  const corrected = new Date('2024-02-19T11:30:00+08:00');
  const actual = new Date('2024-02-19T12:40:00+08:00');
  try {
    TimeManager.setTimezoneOffsetMinutesOverride(-300);
    const source = generateJinkoujue({ customDate: corrected, termReferenceDate: actual });
    assert.equal(source.timezoneOffsetMinutes, -300);
    TimeManager.setTimezoneOffsetMinutesOverride(480);
    assert.equal(analyzeJinkoujueEvidence(source).calculationFact.status, '完整');

    const stale = structuredClone(source);
    stale.ganzhi.day = '甲子';
    assert.throws(() => analyzeJinkoujueEvidence(stale), /起课时刻与四柱不一致/u);
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});

test('金口诀证据与提示词拒绝四位关系和阴阳发用错位', () => {
  const source = createShenChart();
  const wrongRelation = structuredClone(source);
  wrongRelation.relations.guiToJiang = wrongRelation.relations.guiToJiang === '克' ? '生' : '克';
  assert.throws(() => analyzeJinkoujueEvidence(wrongRelation), /四位关系与五行不一致/);
  assert.throws(
    () => buildDivinationPrompt({ method: 'jinkoujue', data: wrongRelation, question: '进展如何' }),
    /四位关系与五行不一致/,
  );

  const wrongHumanGeneralRelation = structuredClone(source);
  wrongHumanGeneralRelation.relations.renToJiang =
    wrongHumanGeneralRelation.relations.renToJiang === '克' ? '生' : '克';
  assert.throws(() => analyzeJinkoujueEvidence(wrongHumanGeneralRelation), /四位关系与五行不一致/);

  const wrongUse = structuredClone(source);
  wrongUse.yinYangUse.usePosition = source.yinYangUse.usePosition === '贵神' ? '将神' : '贵神';
  assert.throws(() => analyzeJinkoujueEvidence(wrongUse), /阴阳发用与四位不一致/);
});

test('金口诀证据按五子元遁复核人元，并拒绝四位结构字段与提示文本错配', () => {
  const source = createShenChart();
  const wrongHumanStem = structuredClone(source);
  const alternateStem: Record<string, string> = {
    甲: '乙',
    乙: '甲',
    丙: '丁',
    丁: '丙',
    戊: '己',
    己: '戊',
    庚: '辛',
    辛: '庚',
    壬: '癸',
    癸: '壬',
  };
  const renYuan = wrongHumanStem.positions.renYuan;
  renYuan.stem = alternateStem[renYuan.stem!];
  renYuan.yinYang = STEMS.indexOf(renYuan.stem) % 2 === 0 ? '阳' : '阴';
  renYuan.promptText = formatJinkoujuePositionPromptText(renYuan);
  assert.throws(() => analyzeJinkoujueEvidence(wrongHumanStem), /人元五子元遁与四位不一致/);
  assert.throws(() => formatJinkoujueJudgmentFacts(wrongHumanStem), /人元五子元遁与四位不一致/);

  const stalePromptText = structuredClone(source);
  stalePromptText.positions.diFen.promptText += '；错误地分信息';
  assert.throws(
    () => analyzeJinkoujueEvidence(stalePromptText),
    /四位结构化字段与提示文本不一致|主线或焦点依据与四位课值不一致/,
  );
});

test('金口诀证据从日干、昼夜、地分复核贵神本属并拒绝改写后的焦点依据', () => {
  const source = createShenChart();
  const evidence = analyzeJinkoujueEvidence(source);
  assert.ok(evidence.focusFacts.length === 4);
  assert.equal(evidence.summaryFact.focusCount, 4);
  assert.deepEqual(
    evidence.focusFacts.map((item) => item.target.slice(0, 2)),
    ['地分', '将神', '贵神', '人元'],
  );

  for (const index of [0, 1, 2, 3]) {
    const missingFocus = structuredClone(source);
    delete missingFocus.focusEvidence![index];
    const snapshot = structuredClone(missingFocus);
    assert.equal(missingFocus.focusEvidence!.length, 4);
    assert.throws(() => analyzeJinkoujueEvidence(missingFocus), /主线或焦点依据与四位课值不一致/);
    assert.throws(
      () => formatJinkoujueJudgmentFacts(missingFocus),
      /主线或焦点依据与四位课值不一致/,
    );
    assert.throws(
      () =>
        buildDivinationPrompt({ method: 'jinkoujue', data: missingFocus, question: '核对焦点' }),
      /主线或焦点依据与四位课值不一致/,
    );
    assert.deepEqual(missingFocus, snapshot);
  }

  const nullFocus = structuredClone(source);
  (nullFocus.focusEvidence as unknown[])[1] = null;
  assert.throws(() => analyzeJinkoujueEvidence(nullFocus), /主线或焦点依据与四位课值不一致/);

  const wrongGod = structuredClone(source);
  wrongGod.positions.guiShen.god = wrongGod.positions.guiShen.god === '青龙' ? '白虎' : '青龙';
  wrongGod.positions.guiShen.promptText = formatJinkoujuePositionPromptText(
    wrongGod.positions.guiShen,
  );
  assert.throws(() => analyzeJinkoujueEvidence(wrongGod), /贵人贵神与日干、昼夜和地分不一致/);
  assert.throws(() => formatJinkoujueJudgmentFacts(wrongGod), /贵人贵神与日干、昼夜和地分不一致/);
  assert.throws(
    () => buildDivinationPrompt({ method: 'jinkoujue', data: wrongGod, question: '进展如何' }),
    /贵人贵神与日干、昼夜和地分不一致/,
  );

  const wrongDayNight = structuredClone(source);
  wrongDayNight.dayNight = source.dayNight === '昼占' ? '夜占' : '昼占';
  assert.throws(() => analyzeJinkoujueEvidence(wrongDayNight), /贵人贵神与日干、昼夜和地分不一致/);

  const wrongMainLine = structuredClone(source);
  wrongMainLine.mainLine = '伪造主线';
  assert.throws(() => analyzeJinkoujueEvidence(wrongMainLine), /主线或焦点依据与四位课值不一致/);

  const wrongFocus = structuredClone(source);
  wrongFocus.focusEvidence![0].evidence = ['伪造的贵神依据'];
  assert.throws(() => analyzeJinkoujueEvidence(wrongFocus), /主线或焦点依据与四位课值不一致/);

  const wrongCalculation = structuredClone(source);
  wrongCalculation.calculation.guiShenRule = '伪造贵神起例';
  assert.throws(() => analyzeJinkoujueEvidence(wrongCalculation), /起课计算说明与四位课值不一致/);
});

test('金口诀真太阳时跨雨水仍以实际占时定月将与月建', () => {
  const corrected = new Date('2024-02-19T11:30:00+08:00');
  const actual = new Date('2024-02-19T12:40:00+08:00');
  const chart = generateJinkoujue({ customDate: corrected, termReferenceDate: actual });
  const clockOnly = generateJinkoujue({ customDate: corrected });

  assert.equal(clockOnly.monthLeader, '子');
  assert.equal(chart.monthLeader, '亥');
  assert.equal(chart.ganzhi.month, clockOnly.ganzhi.month);
  assert.equal(chart.ganzhi.day, clockOnly.ganzhi.day);
  assert.equal(chart.ganzhi.hour, clockOnly.ganzhi.hour);
  assert.equal(chart.termReferenceTimestamp, actual.getTime());
});

test('金口诀月将按节气真实瞬时切换，不随占卜时区覆盖延后', () => {
  const before = new Date('2024-02-19T12:13:11+08:00');
  const at = new Date('2024-02-19T12:13:12+08:00');
  try {
    for (const offset of [480, 0, -300, 840]) {
      TimeManager.setTimezoneOffsetMinutesOverride(offset);
      assert.equal(generateJinkoujue({ customDate: before }).monthLeader, '子');
      assert.equal(generateJinkoujue({ customDate: at }).monthLeader, '亥');
    }
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});

test('金口诀旧盘月将与将神自洽时仍须按实际中气时刻复核', () => {
  const before = new Date('2024-02-19T12:13:11+08:00');
  const at = new Date('2024-02-19T12:13:12+08:00');
  const source = generateJinkoujue({
    method: 'branch',
    branch: '申',
    customDate: before,
    termReferenceDate: at,
  });
  assert.equal(source.monthLeader, '亥');
  assert.equal(analyzeJinkoujueEvidence(source).calculationFact.status, '完整');

  const staleReference = structuredClone(source);
  staleReference.termReferenceTimestamp = before.getTime();
  assert.throws(() => analyzeJinkoujueEvidence(staleReference), /月将与实际占时已交中气不一致/u);
  assert.throws(
    () =>
      buildDivinationPrompt({ method: 'jinkoujue', data: staleReference, question: '进展如何' }),
    /月将与实际占时已交中气不一致/u,
  );

  const staleWithoutReference = structuredClone(source);
  delete staleWithoutReference.termReferenceTimestamp;
  assert.throws(
    () => analyzeJinkoujueEvidence(staleWithoutReference),
    /月将与实际占时已交中气不一致/u,
  );
});

test('金口诀目标年末只查当前与下一轮冬至，避免预取越过历表上界', () => {
  const result = generateJinkoujue({ customDate: new Date('9999-12-31T00:00:00Z') });
  assert.equal(result.monthLeader, '丑');
});

test('金口诀随机记录应重放拒绝采样并核对起课数字与地分', () => {
  const samples = [0xffffffff / 0x100000000, 0.5];
  const data = generateJinkoujue({ customDate: SAMPLE_DATE, method: 'random', replay: samples });
  assert.equal(data.calculation.inputBase, 7);
  assert.equal(data.positions.diFen.branch, '午');
  assert.equal(analyzeJinkoujueEvidence(data).randomTraceFact.sampleCount, 2);
  for (const invalid of [samples.slice(0, 1), [...samples, 0], [0]]) {
    const changed = structuredClone(data);
    changed.randomTrace!.samples = invalid;
    assert.throws(
      () => analyzeJinkoujueEvidence(changed),
      /随机重放样本已用尽|随机轨迹与起课数字或地分不一致/,
    );
  }
  const changed = structuredClone(data);
  changed.positions.diFen.branch = '子';
  assert.throws(() => analyzeJinkoujueEvidence(changed), /随机轨迹与起课数字或地分不一致/);
});

test('金口诀证据拒绝地分与人元、月将加时及五动条件错位', () => {
  const source = createShenChart();
  const wrongDiFen = structuredClone(source);
  wrongDiFen.positions.diFen.branch = '子';
  assert.throws(() => analyzeJinkoujueEvidence(wrongDiFen), /地分与四位不一致/);

  const wrongJiang = structuredClone(source);
  wrongJiang.positions.jiangShen.branch = '子';
  assert.throws(
    () => analyzeJinkoujueEvidence(wrongJiang),
    /将神与月将加时不一致|四位本属与地支、遁干不一致/,
  );

  const wrongMovement = structuredClone(source);
  wrongMovement.movements.push({
    category: '五动',
    name: '鬼动',
    from: '地分',
    to: '人元',
    relation: '克',
    trigger: '地分金克人元木',
    source: '《六壬神课金口诀古本》“五动爻诵”',
  });
  assert.throws(() => analyzeJinkoujueEvidence(wrongMovement), /动爻与四位五行不一致/);
});

test('金口诀证据拒绝旬空和月令旺衰与日月柱错位', () => {
  const source = createShenChart();
  const wrongXunKong = structuredClone(source);
  wrongXunKong.xunKong = [];
  assert.throws(() => analyzeJinkoujueEvidence(wrongXunKong), /旬空或月令旺衰/);

  const wrongPositionVoid = structuredClone(source);
  wrongPositionVoid.positions.guiShen.isVoid = !wrongPositionVoid.positions.guiShen.isVoid;
  assert.throws(() => analyzeJinkoujueEvidence(wrongPositionVoid), /旬空或月令旺衰/);
  assert.throws(
    () =>
      buildDivinationPrompt({
        method: 'jinkoujue',
        data: wrongPositionVoid,
        question: '进展如何',
      }),
    /旬空或月令旺衰/,
  );

  const wrongSeason = structuredClone(source);
  wrongSeason.positions.renYuan.seasonState =
    wrongSeason.positions.renYuan.seasonState === '旺' ? '囚' : '旺';
  assert.throws(() => analyzeJinkoujueEvidence(wrongSeason), /旬空或月令旺衰/);
});

const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const TIANJIANG = [
  '贵人',
  '螣蛇',
  '朱雀',
  '六合',
  '勾陈',
  '青龙',
  '天空',
  '白虎',
  '太常',
  '玄武',
  '太阴',
  '天后',
];
const WUXING = ['木', '火', '土', '金', '水'];
const SEASON_STATES = ['旺', '相', '休', '囚', '死'];
const FORWARD_NOBLEMAN_BRANCHES = new Set(['亥', '子', '丑', '寅', '卯', '辰']);
const NOBLEMAN_BRANCH_BY_STEM: Record<string, { day: string; night: string }> = {
  甲: { day: '丑', night: '未' },
  戊: { day: '丑', night: '未' },
  庚: { day: '丑', night: '未' },
  乙: { day: '子', night: '申' },
  己: { day: '子', night: '申' },
  丙: { day: '亥', night: '酉' },
  丁: { day: '亥', night: '酉' },
  壬: { day: '巳', night: '卯' },
  癸: { day: '巳', night: '卯' },
  辛: { day: '午', night: '寅' },
};
const GUI_SHEN_ATTRIBUTES: Record<
  string,
  { branch: string; element: string; yinYang: '阳' | '阴' }
> = {
  贵人: { branch: '丑', element: '土', yinYang: '阴' },
  螣蛇: { branch: '巳', element: '火', yinYang: '阴' },
  朱雀: { branch: '午', element: '火', yinYang: '阳' },
  六合: { branch: '卯', element: '木', yinYang: '阴' },
  勾陈: { branch: '辰', element: '土', yinYang: '阳' },
  青龙: { branch: '寅', element: '木', yinYang: '阳' },
  天空: { branch: '戌', element: '土', yinYang: '阳' },
  白虎: { branch: '申', element: '金', yinYang: '阳' },
  太常: { branch: '未', element: '土', yinYang: '阴' },
  玄武: { branch: '子', element: '水', yinYang: '阳' },
  太阴: { branch: '酉', element: '金', yinYang: '阴' },
  天后: { branch: '亥', element: '水', yinYang: '阴' },
};
const BRANCH_ELEMENT: Record<string, string> = {
  子: '水',
  丑: '土',
  寅: '木',
  卯: '木',
  辰: '土',
  巳: '火',
  午: '火',
  未: '土',
  申: '金',
  酉: '金',
  戌: '土',
  亥: '水',
};
const STEM_ELEMENT: Record<string, string> = {
  甲: '木',
  乙: '木',
  丙: '火',
  丁: '火',
  戊: '土',
  己: '土',
  庚: '金',
  辛: '金',
  壬: '水',
  癸: '水',
};
const GENERATES: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLS: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

function expectedYuanStem(dayStem: string, branchIndex: number) {
  const startStemByDayStem: Record<string, string> = {
    甲: '甲',
    己: '甲',
    乙: '丙',
    庚: '丙',
    丙: '戊',
    辛: '戊',
    丁: '庚',
    壬: '庚',
    戊: '壬',
    癸: '壬',
  };
  const startIndex = STEMS.indexOf(startStemByDayStem[dayStem]);
  assert.notEqual(startIndex, -1, `缺少日干 ${dayStem} 的五子元遁真值`);
  return STEMS[(startIndex + branchIndex) % STEMS.length];
}

function expectedGuiShen(dayStem: string, dayNight: '昼占' | '夜占', diFen: string) {
  const nobleman = NOBLEMAN_BRANCH_BY_STEM[dayStem][dayNight === '昼占' ? 'day' : 'night'];
  const noblemanIndex = BRANCHES.indexOf(nobleman);
  const diFenIndex = BRANCHES.indexOf(diFen);
  const forward = FORWARD_NOBLEMAN_BRANCHES.has(nobleman);
  const step = forward
    ? (diFenIndex - noblemanIndex + 12) % 12
    : (noblemanIndex - diFenIndex + 12) % 12;
  const god = TIANJIANG[step];
  return { nobleman, god, direction: forward ? '顺布' : '逆布', ...GUI_SHEN_ATTRIBUTES[god] };
}

function expectedYinYangUse(yinYang: Array<'阳' | '阴'>) {
  const yinCount = yinYang.filter((item) => item === '阴').length;
  if (yinCount === 3) return { pattern: '三阴一阳', index: yinYang.indexOf('阳') };
  if (yinCount === 1) return { pattern: '三阳一阴', index: yinYang.indexOf('阴') };
  if (yinCount === 2) return { pattern: '二阴二阳', index: 1 };
  if (yinCount === 4) return { pattern: '纯阴', index: 1 };
  return { pattern: '纯阳', index: 2 };
}

function expectedMovements(elements: {
  renYuan: string;
  guiShen: string;
  jiangShen: string;
  diFen: string;
}) {
  const result: string[] = [];
  if (CONTROLS[elements.renYuan] === elements.diFen) result.push('妻动');
  if (CONTROLS[elements.guiShen] === elements.renYuan) result.push('官动');
  if (CONTROLS[elements.guiShen] === elements.jiangShen) result.push('贼动');
  if (CONTROLS[elements.jiangShen] === elements.guiShen) result.push('财动');
  if (CONTROLS[elements.diFen] === elements.renYuan) result.push('鬼动');
  if (GENERATES[elements.diFen] === elements.renYuan) result.push('父母动');
  if (GENERATES[elements.renYuan] === elements.diFen) result.push('子孙动');
  if (elements.renYuan === elements.diFen) result.push('兄弟动');
  return result.sort();
}

test('金口诀：时间起课应形成四位、阴阳发用与动爻', () => {
  const data = generateJinkoujue({ method: 'time', customDate: SAMPLE_DATE });

  assert.equal(data.method, 'time');
  assert.equal(data.diFenBranch, data.positions.diFen.branch);
  assert.ok(data.positions.jiangShen.branch);
  assert.ok(data.positions.guiShen.god);
  assert.ok(data.positions.renYuan.stem);
  assert.match(data.mainLine, /阴阳发用：/);
  assert.match(data.mainLine, /动爻：/);
  assert.equal(data.calculation.yuanDunRule, '五子元遁分别求人元、神干与将干');
  assert.ok(data.evidenceAnalysis);
  assert.match(data.evidenceAnalysis?.promptText || '', /【金口诀阴阳发用结构化证据】/);

  const currentTime = new Date('2026-10-04T12:00:00+08:00');
  const promptOptions = { method: 'jinkoujue' as const, question: '核对本次四位', currentTime };
  const expectedPrompt = buildDivinationPrompt({ ...promptOptions, data });
  const role = '四象中的田宅、子孙、奴仆、鞍马与六畜位';
  assert.equal(data.positions.diFen.role, role);
  assert.ok(expectedPrompt.includes(`四位取象：地分${role}`));
  assert.ok(expectedPrompt.includes('占法：金口诀'));
  const originalRole = JINKOU_POSITION_ROLES.地分;
  try {
    JINKOU_POSITION_ROLES.地分 = '变造角色';
    assert.equal(JINKOU_POSITION_ROLES.地分, '变造角色');
    const fresh = generateJinkoujue({ method: 'time', customDate: SAMPLE_DATE });
    assert.deepEqual(fresh, data);
    assert.equal(fresh.positions.diFen.role, role);
    assert.equal(buildDivinationPrompt({ ...promptOptions, data: fresh }), expectedPrompt);
  } finally {
    JINKOU_POSITION_ROLES.地分 = originalRole;
  }
});

test('金口诀：指定地分应直接采用所选地支并保留起课时间规则', () => {
  const data = createShenChart();

  assert.equal(data.method, 'branch');
  assert.equal(data.diFenBranch, '申');
  assert.equal(data.positions.diFen.branch, '申');
  assert.equal(data.calculation.inputBaseSource, '指定地分');
  assert.match(data.calculation.diFenNote, /指定地分申/);
  assert.equal(data.divinationBranch, data.ganzhi.hour.charAt(1));
  assert.throws(
    () => generateJinkoujue({ method: 'branch', branch: '甲', customDate: SAMPLE_DATE }),
    /指定地分必须是/,
  );
});

test('金口诀：闲置起课字段不改变实际采用输入的结果身份', () => {
  const cases = [
    [fixedDefaultChart, generateJinkoujue({ branch: '子', number: 1, customDate: SAMPLE_DATE })],
    [
      createShenChart(),
      generateJinkoujue({
        method: 'branch',
        branch: '申',
        number: 9,
        customDate: SAMPLE_DATE,
      }),
    ],
    [
      generateJinkoujue({ method: 'number', number: 9, customDate: SAMPLE_DATE }),
      generateJinkoujue({
        method: 'number',
        branch: '申',
        number: 9,
        customDate: SAMPLE_DATE,
      }),
    ],
    [
      generateJinkoujue({ method: 'random', seed: 'unused-fields', customDate: SAMPLE_DATE }),
      generateJinkoujue({
        method: 'random',
        seed: 'unused-fields',
        branch: '申',
        number: 9,
        customDate: SAMPLE_DATE,
      }),
    ],
  ] as const;

  for (const [usedInput, withUnusedFields] of cases) {
    assert.equal(withUnusedFields.diFenBranch, usedInput.diFenBranch);
    assert.equal(withUnusedFields.meta.inputHash, usedInput.meta.inputHash);
    assert.equal(withUnusedFields.meta.resultId, usedInput.meta.resultId);
  }
});

test('金口诀：古本二月戌将丙寅日午时申地原例应得子将、玄武与丙人元', () => {
  const data = generateJinkoujue({
    method: 'number',
    number: 9,
    customDate: new Date('2020-03-24T12:00:00+08:00'),
  });

  assert.equal(data.ganzhi.day, '丙寅');
  assert.equal(data.ganzhi.hour, '甲午');
  assert.equal(data.monthLeader, '戌');
  assert.equal(data.diFenBranch, '申');
  assert.equal(data.positions.jiangShen.branch, '子');
  assert.equal(data.positions.jiangShen.stem, '戊');
  assert.equal(data.positions.guiShen.god, '玄武');
  assert.equal(data.positions.guiShen.branch, '子');
  assert.equal(data.positions.guiShen.stem, '戊');
  assert.equal(data.positions.guiShen.elementBasis, '贵神本属');
  assert.equal(data.positions.renYuan.stem, '丙');
  assert.equal(data.positions.renYuan.branch, '申');
  assert.equal(data.yinYangUse.pattern, '纯阳');
  assert.equal(data.yinYangUse.usePosition, '贵神');
  assert.deepEqual(
    data.movements.map((item) => item.name),
    ['妻动', '官动'],
  );
});

test('金口诀：丙寅日亥地旬空只记地分，不把遁出的人元干重复判空', () => {
  const data = generateJinkoujue({
    method: 'branch',
    branch: '亥',
    customDate: new Date('2020-03-24T12:00:00+08:00'),
  });

  assert.equal(data.ganzhi.day, '丙寅');
  assert.deepEqual(new Set(data.xunKong), new Set(['戌', '亥']));
  assert.equal(data.positions.diFen.isVoid, true);
  assert.equal(data.positions.renYuan.stem, '己');
  assert.equal(data.positions.renYuan.branch, '亥');
  assert.equal(data.positions.renYuan.isVoid, false);
  assert.ok(!data.positions.renYuan.constraints.includes('落日旬空'));
  assert.doesNotMatch(data.positions.renYuan.promptText, /旬空|不空/u);
  assert.deepEqual(
    data.evidenceAnalysis?.counterEvidenceFacts
      .filter((item) => item.type === '旬空')
      .map((item) => item.detail),
    ['地分亥落日旬空'],
  );
  assert.doesNotMatch(data.evidenceAnalysis?.promptText ?? '', /人元亥落日旬空/u);
  assert.doesNotMatch(formatJinkoujueJudgmentFacts(data).join('\n'), /人元亥落日旬空/u);

  const falseVoid = structuredClone(data);
  falseVoid.positions.renYuan.isVoid = true;
  assert.throws(() => analyzeJinkoujueEvidence(falseVoid), /旬空或月令旺衰与日月柱及四位不一致/u);
});

test('金口诀：数字起课 1-12 映射子至亥，大于 12 按 12 归一', () => {
  const zi = fixedNumberOneChart;
  const hai = generateJinkoujue({ method: 'number', number: 12, customDate: SAMPLE_DATE });
  const wrap = generateJinkoujue({ method: 'number', number: 13, customDate: SAMPLE_DATE });

  assert.equal(zi.diFenBranch, '子');
  assert.equal(hai.diFenBranch, '亥');
  assert.equal(wrap.diFenBranch, '子');
});

test('金口诀：数字起课拒绝超出安全整数的直接输入', () => {
  assert.throws(
    () =>
      generateJinkoujue({
        method: 'number',
        number: 18_014_398_509_481_984,
        customDate: SAMPLE_DATE,
      }),
    /安全整数/,
  );
});

test('金口诀：五子元遁应按日干起遁干', () => {
  const data = fixedNumberOneChart;
  const dayStem = data.ganzhi.day.charAt(0);
  const startMap: Record<string, string> = {
    甲: '甲',
    己: '甲',
    乙: '丙',
    庚: '丙',
    丙: '戊',
    辛: '戊',
    丁: '庚',
    壬: '庚',
    戊: '壬',
    癸: '壬',
  };
  const stems = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
  const start = startMap[dayStem];
  const expected = stems[(stems.indexOf(start) + 0) % 10]; // 地分子

  assert.ok(start);
  assert.equal(data.positions.renYuan.branch, '子');
  assert.equal(data.positions.renYuan.stem, expected);
});

test('金口诀：同种子随机起课可复现，并保留随机轨迹', () => {
  const a = generateJinkoujue({
    method: 'random',
    seed: 'jinkoujue-seed',
    customDate: SAMPLE_DATE,
  });
  const b = generateJinkoujue({
    method: 'random',
    seed: 'jinkoujue-seed',
    customDate: SAMPLE_DATE,
  });

  assert.equal(a.diFenBranch, b.diFenBranch);
  assert.ok(a.randomTrace?.samples.length);
  assert.deepEqual(a.randomTrace?.samples, b.randomTrace?.samples);
});

test('金口诀：证据层应以阴阳发用位为唯一四位主证，生克保持中性', () => {
  const data = generateJinkoujue({ method: 'number', number: 5, customDate: SAMPLE_DATE });
  const evidence = analyzeJinkoujueEvidence(data);

  assert.equal(evidence.positions.length, 4);
  assert.ok(evidence.relations.length >= 4);
  assert.equal(evidence.focusFacts.length, 4);
  assert.equal(evidence.focusFacts.filter((item) => item.level === '主证').length, 1);
  assert.equal(evidence.focusFacts.find((item) => item.level === '主证')?.role, '阴阳次第发用位');
  assert.ok(evidence.relations.every((item) => item.status === '中性'));
  assert.match(evidence.mainLine, /阴阳发用/);
  assert.match(evidence.calculationFact.guiShenRule, /贵神本属/);
  assert.match(evidence.calculationFact.yinYangUseRule, /为用/);
  assert.doesNotMatch(JSON.stringify(evidence.evidence), /贵神主事、将神主事体/);
  assert.equal(evidence.calculationFact.status, '完整');
});

test('金口诀：十二地分的四位五行与天将必须完整，不得输出未定关系', () => {
  for (let number = 1; number <= 12; number += 1) {
    const data = generateJinkoujue({ method: 'number', number, customDate: SAMPLE_DATE });
    const positions = Object.values(data.positions);

    assert.ok(positions.every((item) => ['木', '火', '土', '金', '水'].includes(item.element)));
    assert.ok(data.positions.guiShen.god);
    assert.doesNotMatch(JSON.stringify(data.relations), /未定|未知|^$/);
  }
});

test('金口诀：六十日柱乘昼夜与十二地分的 1440 课应逐项符合古本真值', () => {
  const start = new Date('2024-01-01T12:00:00+08:00');
  const dayPillars = new Set<string>();
  const jiangBranches = new Set<string>();
  const tianjiang = new Set<string>();
  const yinYangPatterns = new Set<string>();
  const movementNames = new Set<string>();
  let hasDifferentGuiAndJiang = false;

  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    for (const hourOffset of [0, 8]) {
      const customDate = new Date(
        start.getTime() + dayOffset * 24 * 60 * 60 * 1000 + hourOffset * 60 * 60 * 1000,
      );

      for (let branchIndex = 0; branchIndex < BRANCHES.length; branchIndex += 1) {
        const data = generateJinkoujue({
          method: 'number',
          number: branchIndex + 1,
          customDate,
        });
        const dayStem = data.ganzhi.day.charAt(0);
        const positions = [
          data.positions.diFen,
          data.positions.jiangShen,
          data.positions.guiShen,
          data.positions.renYuan,
        ];
        const expectedGui = expectedGuiShen(dayStem, data.dayNight, BRANCHES[branchIndex]);
        const monthLeaderIndex = BRANCHES.indexOf(data.monthLeader);
        const hourBranchIndex = BRANCHES.indexOf(data.divinationBranch);
        const expectedJiangIndex = (monthLeaderIndex + branchIndex - hourBranchIndex + 12) % 12;
        const expectedJiangBranch = BRANCHES[expectedJiangIndex];
        const expectedRenStem = expectedYuanStem(dayStem, branchIndex);
        const expectedGuiStem = expectedYuanStem(dayStem, BRANCHES.indexOf(expectedGui.branch));
        const expectedJiangStem = expectedYuanStem(dayStem, expectedJiangIndex);
        const expectedPositionYinYang: Array<'阳' | '阴'> = [
          branchIndex % 2 === 0 ? '阳' : '阴',
          expectedJiangIndex % 2 === 0 ? '阳' : '阴',
          expectedGui.yinYang,
          STEMS.indexOf(expectedRenStem) % 2 === 0 ? '阳' : '阴',
        ];
        const expectedUse = expectedYinYangUse(expectedPositionYinYang);
        const expectedUsePosition = ['地分', '将神', '贵神', '人元'][expectedUse.index];

        dayPillars.add(data.ganzhi.day);
        jiangBranches.add(data.positions.jiangShen.branch);
        tianjiang.add(data.positions.guiShen.god || '');
        yinYangPatterns.add(data.yinYangUse.pattern);
        data.movements.forEach((item) => movementNames.add(item.name));
        if (data.positions.guiShen.branch !== data.positions.jiangShen.branch) {
          hasDifferentGuiAndJiang = true;
        }

        assert.equal(data.diFenBranch, BRANCHES[branchIndex]);
        assert.equal(data.noblemanBranch, expectedGui.nobleman);
        assert.equal(data.calculation.noblemanDirection, expectedGui.direction);
        assert.equal(data.positions.jiangShen.branch, expectedJiangBranch);
        assert.equal(data.positions.jiangShen.stem, expectedJiangStem);
        assert.equal(data.positions.guiShen.god, expectedGui.god);
        assert.equal(data.positions.guiShen.branch, expectedGui.branch);
        assert.equal(data.positions.guiShen.stem, expectedGuiStem);
        assert.equal(data.positions.guiShen.element, expectedGui.element);
        assert.equal(data.positions.guiShen.yinYang, expectedGui.yinYang);
        assert.equal(data.positions.guiShen.elementBasis, '贵神本属');
        assert.equal(data.positions.renYuan.branch, BRANCHES[branchIndex]);
        assert.equal(data.positions.renYuan.stem, expectedRenStem);
        assert.deepEqual(
          positions.map((position) => position.yinYang),
          expectedPositionYinYang,
        );
        assert.equal(data.yinYangUse.pattern, expectedUse.pattern);
        assert.equal(data.yinYangUse.usePosition, expectedUsePosition);
        assert.equal(data.yinYangUse.yinCount + data.yinYangUse.yangCount, 4);
        assert.deepEqual(
          data.movements.map((item) => item.name).sort(),
          expectedMovements({
            renYuan: STEM_ELEMENT[expectedRenStem],
            guiShen: expectedGui.element,
            jiangShen: BRANCH_ELEMENT[expectedJiangBranch],
            diFen: BRANCH_ELEMENT[BRANCHES[branchIndex]],
          }),
        );
        assert.deepEqual(
          positions.map((position) => position.isVoid),
          positions.map(
            (position) =>
              position.elementBasis !== '人元干' && data.xunKong.includes(position.branch),
          ),
        );
        assert.ok(positions.every((position) => BRANCHES.includes(position.branch)));
        assert.ok(positions.every((position) => WUXING.includes(position.element)));
        assert.ok(positions.every((position) => SEASON_STATES.includes(position.seasonState)));
      }
    }
  }

  assert.equal(dayPillars.size, 60, '连续六十日必须覆盖完整六十甲子');
  assert.deepEqual([...jiangBranches].sort(), [...BRANCHES].sort());
  assert.deepEqual([...tianjiang].sort(), [...TIANJIANG].sort());
  assert.deepEqual(
    [...yinYangPatterns].sort(),
    ['三阴一阳', '三阳一阴', '二阴二阳', '纯阴', '纯阳'].sort(),
  );
  assert.deepEqual(
    [...movementNames].sort(),
    ['妻动', '官动', '贼动', '财动', '鬼动', '父母动', '子孙动', '兄弟动'].sort(),
  );
  assert.equal(hasDifferentGuiAndJiang, true, '贵神本属支不得继续复制将神支');
});

test('金口诀二水比合保留实际神将位次，不直接定为盗耗', () => {
  const data = structuredClone(twoWaterShenChart);
  assert.equal(data.positions.guiShen.god, '玄武');
  assert.equal(data.positions.guiShen.element, '水');
  assert.equal(data.positions.jiangShen.element, '水');
  assert.equal(data.bihePoem, '水见二位（贵神、将神）');
  assert.doesNotMatch(data.bihePoem!, /为盗|暗耗|走失/);
});

test('金口诀四木实盘应按四位计数，不折作三木或扩成严重程度', () => {
  const data = generateJinkoujue({
    customDate: new Date('2025-08-02T12:00:00+08:00'),
    method: 'branch',
    branch: '寅',
  });
  assert.ok(Object.values(data.positions).every((position) => position.element === '木'));
  assert.equal(data.bihePoem, '木见四位（人元、贵神、将神、地分）');
});

test('金口诀双组比合保留各自位置，无同气组合时省略比合摘要', () => {
  const data = fixedDefaultChart;
  const p = data.positions;
  assert.equal(
    evaluateJinkoujueBihePoems({
      renYuan: { ...p.renYuan, element: '土' },
      guiShen: { ...p.guiShen, element: '土' },
      jiangShen: { ...p.jiangShen, element: '金' },
      diFen: { ...p.diFen, element: '金' },
    }),
    '土见二位（人元、贵神）；金见二位（将神、地分）',
  );
  assert.equal(
    evaluateJinkoujueBihePoems({
      renYuan: { ...p.renYuan, element: '金' },
      guiShen: { ...p.guiShen, element: '木' },
      jiangShen: { ...p.jiangShen, element: '水' },
      diFen: { ...p.diFen, element: '火' },
    }),
    '',
  );
});

test('金口诀详情与增强提示词按实盘复算比合，保留生克条件与传统依据', async () => {
  const { formatDetailedDivinationInfo } =
    await import('../packages/core/src/prompt/divination-detail');
  const { formatEnhancedDivinationInfo } =
    await import('../packages/core/src/prompt/divination-enhanced');
  const data = structuredClone(twoWaterShenChart);
  data.bihePoem = '二水为盗，多有暗耗漂流走失';
  for (const prompt of [
    formatDetailedDivinationInfo('jinkoujue', data),
    formatEnhancedDivinationInfo('jinkoujue', data),
  ]) {
    assert.match(prompt, /四位比合：水见二位（贵神、将神）/);
    assert.match(prompt, /入式歌解/);
    assert.match(prompt, /贵神水克人元火/);
    assert.doesNotMatch(prompt, /二水为盗|暗耗漂流走失/);
  }
});
