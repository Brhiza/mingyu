import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMeihua } from '@core/divination/algorithms/meihua';
import { generateDivinationSession as generateCoreSession } from '@core/divination/session';
import {
  buildDivinationPrompt as buildCoreDivinationPrompt,
  formatDivinationInfo,
  getDivinationSummaryBlocks,
} from '@core/prompt/divination';
import { formatDetailedDivinationInfo } from '@core/prompt/divination-detail';
import { formatMeihuaFacts } from '@core/prompt/meihua-facts';
import { buildDivinationPrompt } from '../src/lib/divination/engine';
import { ZHOUYI_HEXAGRAMS_TEXT } from '@core/classics/zhouyi';
import { extractDivinationPromptFacts } from '../scripts/prompt-audit/divination-facts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts';

const fixedDateNumber42Chart = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), {
  method: 'number',
  number: 42,
});

test('梅花兼容起卦入口的在线提示只显示实际年月日时取数法', () => {
  const date = new Date('2026-05-19T10:30:00+08:00');
  const data = generateMeihua(date, { method: 'timeTrigram' });
  const summary = getDivinationSummaryBlocks('meihua', data);
  const core = generateCoreSession({
    method: 'meihua',
    question: '工作进展如何？',
    divinationTime: date,
    currentTime: date,
    meihua: { method: 'timeTrigram' },
  });
  for (const text of [
    summary.lines.join('\n'),
    buildCoreDivinationPrompt({ method: 'meihua', data, question: '工作进展如何？' }),
    buildDivinationPrompt('meihua', '工作进展如何？', data),
    core.aiPrompt,
  ]) {
    assert.match(text, /起卦法：年月日时起卦法/u);
    assert.doesNotMatch(text, /timeTrigram|兼容/u);
  }
});

test('梅花旧盘取数与卦数不一致时不输出错误算式', () => {
  const date = new Date('2026-05-19T10:30:00+08:00');
  const numberChart = structuredClone(fixedDateNumber42Chart);
  const cases = [
    {
      data: generateMeihua(date, { method: 'time' }),
      change: (data: ReturnType<typeof generateMeihua>) => {
        data.calculation!.day! += 1;
      },
    },
    {
      data: structuredClone(numberChart),
      change: (data: ReturnType<typeof generateMeihua>) => {
        data.calculation!.number! += 1;
      },
    },
    {
      data: generateMeihua(date, { method: 'sound', soundCount: 5 }),
      change: (data: ReturnType<typeof generateMeihua>) => {
        data.calculation!.soundCount! += 1;
      },
    },
    {
      data: generateMeihua(date, { method: 'direction', direction: 'north', objectType: 'earth' }),
      change: (data: ReturnType<typeof generateMeihua>) => {
        data.calculation!.objectType = 'heaven';
      },
    },
  ];
  for (const { data, change } of cases) {
    assert.match(formatMeihuaFacts(data).join('\n'), /起卦取数：/u);
    change(data);
    assert.doesNotMatch(formatMeihuaFacts(data).join('\n'), /起卦取数：|物象锚点：/u);
  }

  const mismatched = structuredClone(numberChart);
  mismatched.calculation!.movingYaoIndex = (mismatched.movingYao.position % 6) + 1;
  assert.doesNotMatch(formatMeihuaFacts(mismatched).join('\n'), /起卦取数：/u);
});

test('梅花盘面时柱与取数时支不一致时不输出旧取数算式', () => {
  const data = structuredClone(fixedDateNumber42Chart);
  assert.match(formatMeihuaFacts(data).join('\n'), /起卦取数：/u);
  data.ganzhi.hour = '甲子';
  assert.doesNotMatch(formatMeihuaFacts(data).join('\n'), /起卦取数：/u);
});

test('梅花最终提示词拒绝与时间戳冲突的结果时间和年日柱', () => {
  const baseChart = structuredClone(fixedDateNumber42Chart);

  const staleTimestamp = structuredClone(baseChart);
  staleTimestamp.timestamp += 24 * 60 * 60 * 1000;
  assert.throws(
    () =>
      buildCoreDivinationPrompt({ method: 'meihua', data: staleTimestamp, question: '请核验。' }),
    /起卦时间戳与结果元数据不一致/u,
  );

  for (const pillar of ['year', 'day'] as const) {
    const inconsistent = structuredClone(baseChart);
    inconsistent.ganzhi[pillar] = '甲子';
    assert.throws(
      () =>
        buildCoreDivinationPrompt({ method: 'meihua', data: inconsistent, question: '请核验。' }),
      /盘面(?:年|日)柱与时间戳重算结果不一致/u,
      `${pillar}柱与原始起卦时间冲突时不得生成最终提示词`,
    );
  }
});

test('梅花提示词重新核验逐爻、关系和卦爻辞，不采信旧证据缓存', () => {
  const baseChart = structuredClone(fixedDateNumber42Chart);
  const stale = structuredClone(baseChart);
  stale.evidenceAnalysis!.stages[0].promptText = '伪造的体用阶段';
  assert.doesNotMatch(buildDivinationPrompt('meihua', '请做整体解读。', stale), /伪造的体用阶段/u);

  const mutations = [
    (chart: typeof fixedDateNumber42Chart) => {
      chart.yaosDetail[0].yaoType = chart.yaosDetail[0].yaoType === '阳' ? '阴' : '阳';
    },
    (chart: typeof fixedDateNumber42Chart) => {
      chart.yaosDetail.push({ ...chart.yaosDetail[0] });
    },
    (chart: typeof fixedDateNumber42Chart) => {
      chart.analysis.tiYongRelation = '虚构关系';
    },
    (chart: typeof fixedDateNumber42Chart) => {
      chart.mainHexagram.description += '伪造卦辞';
    },
    (chart: typeof fixedDateNumber42Chart) => {
      chart.mainHexagram.movingYaoCi = '伪造爻辞';
    },
  ];
  for (const mutate of mutations) {
    const chart = structuredClone(baseChart);
    mutate(chart);
    assert.throws(
      () => buildDivinationPrompt('meihua', '请做整体解读。', chart),
      /梅花盘面与起卦资料不一致/u,
    );
  }

  const legacy = structuredClone(baseChart);
  delete legacy.calculation;
  assert.doesNotThrow(() => buildDivinationPrompt('meihua', '请做整体解读。', legacy));
  legacy.mainHexagram.description += '伪造卦辞';
  assert.throws(
    () => buildDivinationPrompt('meihua', '请做整体解读。', legacy),
    /梅花盘面与起卦资料不一致/u,
  );
});

test('梅花旧盘派生月令和走势文字不直接进入两种提示词', () => {
  const source = generateMeihua(new Date('2025-06-18T10:30:00+08:00'), {
    method: 'number',
    number: 1,
  });
  const data = structuredClone(source);
  delete data.calculation;
  const verifiedSeasonEvaluation = data.analysis.tiYongSeasonEvaluation;
  const completeInfo = formatDivinationInfo('meihua', data);
  const completeSummary = getDivinationSummaryBlocks('meihua', data);
  for (const fields of [
    ['monthBranch'],
    ['monthElement'],
    ['monthBranch', 'monthElement'],
  ] as const) {
    const legacy = structuredClone(data);
    for (const field of fields) delete legacy.analysis[field];
    const snapshot = structuredClone(legacy);
    assert.equal(formatDivinationInfo('meihua', legacy), completeInfo);
    assert.deepEqual(getDivinationSummaryBlocks('meihua', legacy), completeSummary);
    assert.match(formatDivinationInfo('meihua', legacy), /午月令火/u);
    assert.ok(
      getDivinationSummaryBlocks('meihua', legacy).lines.includes(
        '月令：午月（火令），体卦死，用卦囚',
      ),
    );
    assert.deepEqual(legacy, snapshot);
  }
  for (const field of ['monthBranch', 'monthElement'] as const) {
    const wrong = structuredClone(data);
    wrong.analysis[field] = field === 'monthBranch' ? '子' : '水';
    assert.throws(() => formatDivinationInfo('meihua', wrong), /梅花盘面与起卦资料不一致/u);
    assert.throws(() => getDivinationSummaryBlocks('meihua', wrong), /梅花盘面与起卦资料不一致/u);
  }
  data.analysis.tiYongSeasonEvaluation = '伪造的月令断语';
  data.analysis.timelineTrend = { trend: '始终受制', summary: '伪造的走势' };
  const prompt = buildCoreDivinationPrompt({
    method: 'meihua',
    data,
    question: '请分析后续进展。',
  });
  assert.doesNotMatch(prompt, /伪造的月令断语|伪造的走势|盘内关系走势始终受制/u);
  const expectedSeasonConditions = verifiedSeasonEvaluation.replace(
    `主卦${data.analysis.tiYongRelation}，`,
    '',
  );
  assert.ok(prompt.includes(`主卦体用月令条件：${expectedSeasonConditions}`));
  assert.match(prompt, /盘内关系走势先难后易/u);

  data.analysis.inter1Relation = '伪造的体互关系';
  assert.throws(() => getDivinationSummaryBlocks('meihua', data), /梅花盘面与起卦资料不一致/u);

  const forgedTiming = structuredClone(source);
  forgedTiming.analysis.yingQi = ['明日必然成功'];
  assert.throws(
    () =>
      buildCoreDivinationPrompt({
        method: 'meihua',
        data: forgedTiming,
        question: '请分析后续进展。',
      }),
    /梅花盘面与起卦资料不一致/u,
  );
  assert.throws(() => formatDivinationInfo('meihua', forgedTiming), /梅花盘面与起卦资料不一致/u);
  assert.throws(
    () => getDivinationSummaryBlocks('meihua', forgedTiming),
    /梅花盘面与起卦资料不一致/u,
  );
});

test('梅花字占保留原字及分笔，方位取象使用中文资料', () => {
  const date = new Date('2026-09-11T05:27:00+08:00');
  const character = generateMeihua(date, {
    method: 'character',
    characterText: '明',
    characterLeftStrokes: 4,
    characterRightStrokes: 4,
  });
  assert.match(formatMeihuaFacts(character).join('\n'), /文字「明」，字数1，左右分笔数为4、4/u);
  const direction = generateMeihua(date, {
    method: 'direction',
    direction: 'north',
    objectType: 'earth',
  });
  const facts = formatMeihuaFacts(direction).join('\n');
  assert.match(facts, /所见物类地（坤）取上卦数8，方位正北（坎）取下卦数6/u);
  assert.match(facts, /物象锚点：本次所选物类地（坤）、所记方位正北（坎）/u);
  assert.ok(facts.includes(`体卦${direction.tiGua.name}、用卦${direction.yongGua.name}`));
  assert.doesNotMatch(facts, /earth|north|objectType|direction/u);
  assert.doesNotMatch(direction.evidenceAnalysis?.promptText ?? '', /所见物类earth|方位north/u);
});

test('梅花在线提示词合并同经卦月令角色，保留不同经卦与独有条件', () => {
  for (const fixture of [
    {
      number: 42,
      origin: '体用：体卦坎（水）；用卦兑（金）；动爻第6爻；体用关系用生体',
      inter: '互卦：风火家人；原体克体互；原体生用互',
      process: '互卦风火家人：体卦离火，用卦巽木，关系用生体',
      misplacedProcess: '互卦风火家人：体卦巽木，用卦离火，关系用生体',
      misplacedOriginalRelation: '互卦：风火家人；体互克原体；原体生用互',
      result: '变卦天水讼：体卦坎水，用卦乾金，关系用生体',
      seasonCondition: '主卦体用月令条件：体卦月令囚、用卦月令死；用卦休囚死，生体条件较弱',
      monthFacts: [
        '月令作用：原体、变后体卦坎水克巳月令火，卦气耗用，原体、变后体卦为囚',
        '月令作用：巳月令火克原用兑金，原用为死',
        '月令作用：体互离火与巳月令火同类，体互为旺',
        '月令作用：用互巽木生巳月令火，卦气泄出，用互为休',
        '月令作用：巳月令火克变后用卦乾金，变后用卦为死',
      ],
    },
    {
      number: 123,
      origin: '体用：体卦离（火）；用卦坎（水）；动爻第3爻；体用关系用克体',
      inter: '互卦：水火既济；体互克原体；用互与原体比和',
      process: '互卦水火既济：体卦坎水，用卦离火，关系体克用',
      misplacedProcess: '互卦水火既济：体卦离火，用卦坎水，关系体克用',
      misplacedOriginalRelation: '互卦：水火既济；原体克体互；用互与原体比和',
      result: '变卦火风鼎：体卦离火，用卦巽木，关系用生体',
      seasonCondition: '主卦体用月令条件：体卦月令旺、用卦月令囚；体旺用衰，克体条件较轻',
      monthFacts: [
        '月令作用：原体、用互、变后体卦离火与巳月令火同类，原体、用互、变后体卦为旺',
        '月令作用：原用、体互坎水克巳月令火，卦气耗用，原用、体互为囚',
        '月令作用：变后用卦巽木生巳月令火，卦气泄出，变后用卦为休',
      ],
    },
  ]) {
    const data =
      fixture.number === 42
        ? structuredClone(fixedDateNumber42Chart)
        : generateMeihua(new Date('2026-05-19T10:30:00+08:00'), {
            method: 'number',
            number: fixture.number,
          });
    const structuredBefore = structuredClone(data);
    const prompt = buildCoreDivinationPrompt({
      method: 'meihua',
      data,
      question: '请做整体解读。',
      currentTime: new Date('2026-05-19T10:30:00+08:00'),
    });
    assert.ok(data.evidenceAnalysis?.stages.length);
    for (const stage of data.evidenceAnalysis.stages) {
      const displayedStage =
        stage.stage === 'origin'
          ? '主卦体用依据：主卦以动爻所在经卦为用、另一经卦为体。'
          : stage.promptText;
      assert.ok(prompt.includes(displayedStage));
      assert.doesNotMatch(stage.promptText, /月令|支持：|限制：/u);
    }
    const stageSection = prompt.split('体用阶段：\n')[1]?.split('\n起卦法：')[0] ?? '';
    assert.ok(stageSection);
    assert.doesNotMatch(stageSection, /月令|支持：|限制：/u);
    assert.ok(stageSection.startsWith('主卦体用依据：主卦以动爻所在经卦为用、另一经卦为体。'));
    assert.doesNotMatch(stageSection, /主卦[^\n]*：体卦/u);
    for (const text of [fixture.origin, fixture.inter, fixture.process, fixture.result]) {
      assert.equal(prompt.split(text).length - 1, 1, text);
    }
    assert.doesNotMatch(prompt, /^互卦：[^\n]*；体互.+（.+）；用互/u);
    const monthFacts = formatMeihuaFacts(data).filter((fact) => fact.startsWith('月令作用：'));
    assert.deepEqual(monthFacts, fixture.monthFacts);
    for (const fact of monthFacts) assert.equal(prompt.split(fact).length - 1, 1, fact);
    const origin = data.evidenceAnalysis.stages.find((stage) => stage.stage === 'origin');
    assert.ok(origin);
    assert.match(prompt, new RegExp(`体用关系${origin.relation}`, 'u'));
    assert.doesNotMatch(prompt, new RegExp(`主卦${origin.relation}，体卦月令`, 'u'));
    assert.ok(prompt.includes(fixture.seasonCondition));
    for (const [role, state] of [
      ['体', origin.ti.seasonState],
      ['用', origin.yong.seasonState],
    ] as const) {
      if (state === '旺' || state === '相') {
        assert.ok(origin.support.includes(`${role}卦得月令${state}`));
      } else {
        assert.ok(origin.constraints.includes(`${role}卦月令${state}`));
      }
    }
    assert.doesNotMatch(prompt, /ownerFactKeys|limitationFacts|sourceStatus/);
    const expectations = extractDivinationPromptFacts('meihua', data);
    assert.deepEqual(auditPromptFacts(prompt, expectations).missing, []);
    assert.ok(
      auditPromptFacts(
        prompt.replace(fixture.process, fixture.misplacedProcess),
        expectations,
      ).missing.includes('meihua.inter'),
    );
    assert.ok(
      auditPromptFacts(
        prompt.replace(fixture.inter, fixture.misplacedOriginalRelation),
        expectations,
      ).missing.includes('meihua.inter-original-relations'),
    );
    assert.deepEqual(data, structuredBefore);
  }
});

test('梅花在线提示词对缺少卦象结构的阶段使用中性事实', () => {
  const data = structuredClone(fixedDateNumber42Chart);
  delete data.changedHexagram;
  delete data.evidenceAnalysis;

  const prompt = buildCoreDivinationPrompt({
    method: 'meihua',
    data,
    question: '请做整体解读。',
    currentTime: new Date('2026-05-19T10:30:00+08:00'),
  });
  const resultStage =
    prompt
      .split('体用阶段：\n')[1]
      ?.split('\n起卦法：')[0]
      .split('\n')
      .find((line) => line.startsWith('变卦')) ?? '';

  assert.match(resultStage, /卦象结构资料未记录/u);
  assert.doesNotMatch(resultStage, /不得|禁止|不要|不能/u);
});

test('梅花逐爻体用只补充归属与动爻，不重复主卦阴阳爻象', () => {
  const data = generateMeihua(new Date('2025-06-18T10:30:00+08:00'), {
    method: 'number',
    number: 1,
  });
  const prompt = buildDivinationPrompt('meihua', '工作进展如何？', data);
  assert.match(prompt, /主卦爻象：[^\n]*第1爻阴/);
  assert.match(prompt, /逐爻体用：第1爻属用（动爻）、第2爻属用/);
  assert.doesNotMatch(prompt, /逐爻体用：[^\n]*第[1-6]爻[阴阳]属/u);
});

test('梅花主卦生体而变卦克体时保留条件，不把旺衰写成吉凶或固定快慢', () => {
  const settings = { method: 'number' as const, number: 42 };
  for (const [date, state, speed, strength] of [
    ['2025-06-18', '死', '偏缓', '较强'],
    ['2025-08-18', '旺', '偏快', '较弱'],
  ]) {
    const data = generateMeihua(new Date(`${date}T12:30:00+08:00`), settings);
    const prompt = buildDivinationPrompt('meihua', '请分析后续进展。', data, {
      meihuaSettings: settings,
    });

    assert.equal(data.originalName, '泽山咸');
    assert.equal(data.changedName, '泽火革');
    assert.equal(data.analysis.tiYongRaw, '用生体');
    assert.equal(data.analysis.changedTiYongRelation, '用克体');
    assert.equal(data.analysis.tiSeasonState, state);
    assert.ok(data.analysis.tiYongSeasonEvaluation?.includes(`生体条件${strength}`));
    assert.ok(data.analysis.yingQi?.includes(`体卦月令${state}，可作应期${speed}的盘内参考`));
    assert.match(prompt, /体用关系用生体/u);
    assert.match(
      prompt,
      new RegExp(`主卦体用月令条件：体卦月令${state}、用卦月令${data.analysis.yongSeasonState}`),
    );
    assert.doesNotMatch(prompt, /主卦体用月令条件：主卦用生体/u);
    assert.match(prompt, /变卦泽火革：.*关系用克体/u);
    assert.doesNotMatch(prompt, /起因泽山咸|过程泽山咸|结果泽火革/u);
    assert.match(prompt, /盘内关系走势先顺后阻；体用强弱与应期合参主互变、所问事项及现实进展/u);
    assert.equal(prompt.split('体用强弱与应期合参主互变').length - 1, 1);
    assert.match(prompt, /起卦取数：数字42除8取余/u);
    assert.match(prompt, /起卦法：数字起卦法/u);
    assert.match(
      prompt,
      new RegExp(
        `时支${data.calculation.timeZhi}序数${data.calculation.timeZhiIndex}除8取余得下卦数${data.calculation.lowerTrigramIndex}；数字42与时支序数相加除6取余得动爻${data.calculation.movingYaoIndex}`,
      ),
    );
    assert.doesNotMatch(prompt, /应期线索：|月令与起卦：|阶段关系：主卦用\/体：/u);
    assert.doesNotMatch(prompt, /上下卦数和/u);
    assert.equal(data.calculation.totalWithTime, 49);
    assert.equal(data.calculation.movingYaoIndex, 1);
    assert.equal(data.calculation.upperTrigramIndex! + data.calculation.lowerTrigramIndex!, 9);
    assert.doesNotMatch(prompt, /贵人相助，大吉之象|应期迟缓|应期快于常规|体用吉凶实效/u);
  }
});

test('梅花各类体用关系的月令描述保持盘面条件', () => {
  for (const [number, hour, relation] of [
    [10, '10:30', '用生体'],
    [7, '10:30', '体克用'],
    [3, '10:30', '用克体'],
    [1, '10:30', '体生用'],
    [7, '12:30', '比和'],
  ] as const) {
    const data = generateMeihua(new Date(`2025-06-18T${hour}:00+08:00`), {
      method: 'number',
      number,
    });
    assert.equal(data.analysis.tiYongRaw, relation);
    assert.ok(
      data.analysis.tiYongSeasonEvaluation?.includes(
        relation === '比和' ? '体用同五行' : `主卦${relation}`,
      ),
    );
    assert.doesNotMatch(
      data.analysis.tiYongSeasonEvaluation ?? '',
      /有惊无险|受制受损|诸事受阻|胜任其事|贵人相助|大吉之象|亦可受益|破耗消耗/u,
    );
  }
});

test('梅花用克体保留体旺用衰与用旺体衰的局部强弱差异', () => {
  for (const [date, expected] of [
    ['2025-08-18', '体旺用衰，克体条件较轻'],
    ['2025-05-18', '用旺体衰，克体条件较重'],
  ]) {
    const data = generateMeihua(new Date(`${date}T04:30:00+08:00`), {
      method: 'number',
      number: 17,
    });
    assert.equal(data.analysis.tiYongRaw, '用克体');
    assert.ok(data.analysis.tiYongSeasonEvaluation?.includes(expected));
    assert.doesNotMatch(data.analysis.tiYongSeasonEvaluation ?? '', /有惊无险|受制受损/u);
  }
});

test('梅花旧盘缺少互变与应期时不输出空内容行', () => {
  const complete = generateMeihua(new Date('2025-06-18T10:30:00+08:00'), {
    method: 'number',
    number: 1,
  });
  const data = {
    ...complete,
    interName: '',
    changedName: '',
    interHexagram: undefined,
    changedHexagram: undefined,
    interTiGua: undefined,
    interYongGua: undefined,
    changedTiGua: undefined,
    changedYongGua: undefined,
    evidenceAnalysis: undefined,
    analysis: {
      ...complete.analysis,
      tiYongSeasonEvaluation: undefined,
      timelineTrend: undefined,
      yingQi: undefined,
    },
  };
  const prompt = buildDivinationPrompt('meihua', '请分析当前情境。', data);

  assert.match(prompt, /核心结构：主卦天水讼/u);
  assert.doesNotMatch(prompt, /互卦：无|变卦：无|阶段关系：|应期条件：|起卦法：未给出|undefined/u);

  const nameOnly = buildDivinationPrompt('meihua', '请分析当前情境。', {
    ...data,
    interName: complete.interName,
    changedName: complete.changedName,
  });
  assert.match(nameOnly, /^核心结构：主卦天水讼$/mu);
  assert.match(nameOnly, /互卦体用资料未列/u);
  assert.match(nameOnly, /变卦体用资料未列/u);
  assert.doesNotMatch(nameOnly, /风火家人|天泽履|原体克体互|用互克原体/u);
  assert.doesNotMatch(nameOnly, /变后体用(?:为)?【?体用比和|结果关系体用比和/u);
  assert.doesNotMatch(nameOnly, /^互卦：|^变卦：/mu);
});

test('梅花旧盘应期为空数组时拒绝把缺失记录当作完整盘面', () => {
  const data = generateMeihua(new Date('2025-06-18T10:30:00+08:00'), {
    method: 'number',
    number: 1,
  });
  data.analysis.yingQi = [];
  assert.throws(
    () =>
      buildCoreDivinationPrompt({
        method: 'meihua',
        data,
        question: '请分析当前情境。',
      }),
    /原应期条件与动爻、体用和月令重算结果不一致/u,
  );
  assert.throws(
    () => getDivinationSummaryBlocks('meihua', data),
    /原应期条件与动爻、体用和月令重算结果不一致/u,
  );
});

test('梅花物象锚点只由完整方位起卦资料形成', () => {
  const date = new Date('2026-09-11T05:27:00+08:00');
  const number = generateMeihua(date, { method: 'number', number: 42 });
  assert.doesNotMatch(formatMeihuaFacts(number).join('\n'), /物象锚点/);
  const direction = generateMeihua(date, {
    method: 'direction',
    direction: 'north',
    objectType: 'earth',
  });
  const before = structuredClone(direction);
  formatMeihuaFacts(direction);
  assert.deepEqual(direction, before);
  delete direction.calculation!.objectType;
  const incompleteFacts = formatMeihuaFacts(direction).join('\n');
  assert.doesNotMatch(incompleteFacts, /物象锚点|所见物类|起卦取数：|undefined/u);
});

test('纯乾纯坤互卦取爻事实与变卦来源及阴阳一致', () => {
  const date = new Date('2025-01-01T14:00:00+08:00');
  for (const [replay, expected] of [
    [[0, 0, 0.4], '变卦第2至4爻阳阴阳为下卦离；第3至5爻阴阳阳为上卦巽，合为风火家人'],
    [[0.99, 0.99, 0.55], '变卦第2至4爻阴阴阳为下卦艮；第3至5爻阴阳阴为上卦坎，合为水山蹇'],
  ] as const) {
    const data = generateMeihua(date, { method: 'random', replay });
    const fact = formatMeihuaFacts(data).find((item) => item.startsWith('互卦取爻：'));
    assert.ok(fact);
    assert.equal(fact, `互卦取爻：乾坤无互，改取${expected}`);
    assert.ok(buildDivinationPrompt('meihua', '请做整体解读。', data).includes(fact));
  }
});

test('梅花提示词保留三卦卦辞与本次动爻，不送入未发动爻辞', () => {
  const data = structuredClone(fixedDateNumber42Chart);
  const prompt = buildDivinationPrompt('meihua', '请做整体解读。', data);
  assert.equal((prompt.match(/动爻爻辞：/gu) ?? []).length, 1);
  assert.doesNotMatch(prompt, /其他爻辞：|特殊用辞：/u);
  assert.ok(data.mainHexagram.movingYaoCi);
  assert.ok(prompt.includes(data.mainHexagram.movingYaoCi));
  for (const gua of [data.mainHexagram, data.interHexagram, data.changedHexagram]) {
    if (!gua) continue;
    assert.ok(prompt.includes(`卦辞：${gua.name}，${gua.description}`));
  }
  const unusedLine = data.mainHexagram.yaoCi?.find(
    (_, index) => index + 1 !== data.movingYao.position,
  );
  assert.ok(unusedLine);
  assert.ok(!prompt.includes(unusedLine));
});

test('梅花旧盘缺少卦象详情时仍核对互卦与变卦别名', () => {
  const source = structuredClone(fixedDateNumber42Chart);
  for (const [detailField, aliasField] of [
    ['interHexagram', 'interName'],
    ['changedHexagram', 'changedName'],
  ] as const) {
    const changed = structuredClone(source);
    delete changed[detailField];
    changed[aliasField] = changed[aliasField] === '乾为天' ? '坤为地' : '乾为天';
    assert.throws(
      () => buildDivinationPrompt('meihua', '请做整体解读。', changed),
      /梅花盘面与起卦资料不一致/u,
    );
  }
});

test('梅花旧盘缺少取数输入时不把卦象反填为起卦输入', () => {
  const date = new Date('2026-05-19T10:30:00+08:00');
  const number = structuredClone(fixedDateNumber42Chart);
  delete number.calculation!.timeZhi;
  assert.doesNotMatch(formatMeihuaFacts(number).join('\n'), /起卦取数：|undefined/u);

  const character = generateMeihua(date, {
    method: 'character',
    characterText: '明',
    characterLeftStrokes: 4,
    characterRightStrokes: 4,
  });
  delete character.calculation!.characterRightStrokes;
  assert.doesNotMatch(formatMeihuaFacts(character).join('\n'), /起卦取数：|undefined/u);
});

test('梅花字占旧盘缺少逐字笔画或声类时不输出缓存卦数算式', () => {
  const date = new Date('2026-05-19T10:30:00+08:00');
  const strokeSource = generateMeihua(date, {
    method: 'character',
    characterText: '西林',
    characterStrokeCounts: [6, 8],
  });
  const strokes = structuredClone(strokeSource);
  delete strokes.calculation!.characterStrokeCounts;
  assert.doesNotMatch(formatMeihuaFacts(strokes).join('\n'), /起卦取数：/u);

  const tones = generateMeihua(date, {
    method: 'character',
    characterText: '今日动静如何',
    characterTones: [1, 4, 3, 3, 1, 1],
  });
  delete tones.calculation!.characterTones;
  assert.doesNotMatch(formatMeihuaFacts(tones).join('\n'), /起卦取数：/u);

  const inconsistent = structuredClone(strokeSource);
  inconsistent.calculation!.characterStrokeCounts = [7, 8];
  assert.doesNotMatch(formatMeihuaFacts(inconsistent).join('\n'), /起卦取数：/u);
});

test('梅花旧盘缺少动爻取数结果时不输出不完整算式', () => {
  const date = new Date('2026-05-19T10:30:00+08:00');
  const cases = [
    generateMeihua(date, { method: 'time' }),
    structuredClone(fixedDateNumber42Chart),
    generateMeihua(date, { method: 'sound', soundCount: 4 }),
    generateMeihua(date, {
      method: 'character',
      characterText: '明',
      characterLeftStrokes: 4,
      characterRightStrokes: 4,
    }),
    generateMeihua(date, { method: 'direction', direction: 'north', objectType: 'earth' }),
  ];
  for (const data of cases) {
    delete data.calculation!.movingYaoIndex;
    assert.doesNotMatch(formatMeihuaFacts(data).join('\n'), /起卦取数：|undefined/u);
  }
});

test('梅花比和判辞保留同盘在五种月令中的实际旺衰', () => {
  const settings = { method: 'number' as const, number: 7 };
  for (const [date, state] of [
    ['2026-01-19', '旺'],
    ['2026-02-19', '死'],
    ['2026-05-19', '相'],
    ['2026-08-19', '休'],
    ['2026-11-19', '囚'],
  ]) {
    const data = generateMeihua(new Date(`${date}T12:30:00+08:00`), settings);
    assert.equal(data.originalName, '艮为山');
    assert.equal(data.analysis.tiSeasonState, state);
    assert.equal(data.analysis.yongSeasonState, state);
    const prompt = buildDivinationPrompt('meihua', '请做整体解读。', data, {
      meihuaSettings: settings,
    });
    assert.ok(prompt.includes(`体用同五行，比和相应；体卦${state}、用卦${state}`));
    assert.doesNotMatch(prompt, /百事顺遂无逆/);
  }
});

test('履六三动爻原文保留咥人凶与对应小象，卦辞和动爻辞分别输出', () => {
  const settings = { method: 'random' as const, seed: '梅花原生边界20260909' };
  const data = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), settings);
  assert.equal(data.originalName, '天泽履');
  assert.equal(data.movingYao.position, 3);
  const prompt = buildDivinationPrompt('meihua', '请做整体解读。', data, {
    meihuaSettings: settings,
  });
  const fullText = '眇能视，跛能履，履虎尾，咥人，凶。武人为于大君';
  assert.ok(prompt.includes(`动爻爻辞：第3爻，${fullText}`));
  assert.match(prompt, /主卦卦辞：天泽履，履虎尾，不咥人，亨/);
  assert.equal(ZHOUYI_HEXAGRAMS_TEXT[10].yaos[2].yaoCi, fullText);
  assert.match(ZHOUYI_HEXAGRAMS_TEXT[10].yaos[2].xiaoXiang, /咥人之凶，位不当也/);
});

test('梅花年月日时原生提示词保留初三取数、屯二爻阴变阳及互卦上下身份', () => {
  const settings = { method: 'time' as const };
  const data = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), settings);
  const prompt = buildDivinationPrompt('meihua', '请做整体解读。', data, {
    meihuaSettings: settings,
  });
  assert.match(prompt, /农历年支午序数7、农历月数4、农历日数3、时支巳序数6/);
  assert.match(prompt, /上卦数6.*下卦数4.*动爻2/);
  assert.match(prompt, /主卦第2爻阴变阳.*变卦上卦坎、下卦兑，合为水泽节/);
  assert.match(prompt, /第2至4爻阴阴阴为下卦坤；第3至5爻阴阴阳为上卦艮，合为山地剥/);
});

test('梅花午时数字卦保留变后月令关系、上卦动与余零结果', () => {
  const noon = generateMeihua(new Date('2026-05-19T12:30:00+08:00'), {
    method: 'number',
    number: 42,
  });
  const prompt = formatMeihuaFacts(noon).join('\n');
  assert.match(prompt, /变后用卦离火与巳月令火同类，变后用卦为旺/);
  assert.match(prompt, /主卦第1爻阴变阳；动爻位于下卦/);
  const morning = structuredClone(fixedDateNumber42Chart);
  assert.match(formatMeihuaFacts(morning).join('\n'), /主卦第6爻阴变阳；动爻位于上卦/);
  const zero = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), {
    method: 'number',
    number: 8,
  });
  assert.match(formatMeihuaFacts(zero).join('\n'), /数字8除8取余得上卦数8/);
});

test('梅花各卦月令作用覆盖火令下五种关系，随机法保留自身起卦身份', () => {
  const cases = [
    ['离', '火', '与巳月令火同类', '旺'],
    ['坤', '土', '巳月令火生原体坤土', '相'],
    ['震', '木', '原体震木生巳月令火，卦气泄出', '休'],
    ['坎', '水', '原体坎水克巳月令火，卦气耗用', '囚'],
    ['兑', '金', '巳月令火克原体兑金', '死'],
  ];
  for (const [name, element, relation, state] of cases) {
    const data = generateMeihua(new Date('2026-05-19T10:30:00+08:00'), {
      method: 'random',
      seed: '梅花月令关系',
    });
    data.tiGua = { ...data.tiGua, name, element };
    const facts = formatMeihuaFacts(data).join('\n');
    const originalRole = '原体(?:、(?:原用|体互|用互|变后体卦|变后用卦))*';
    assert.match(facts, new RegExp(relation.replace('原体', originalRole), 'u'));
    assert.match(facts, new RegExp(`${originalRole}为${state}`, 'u'));
    assert.doesNotMatch(facts, /起卦取数：/);
  }
});

test('梅花旧盘缺失互变结构时摘要与完整任务书保留阶段待核而不借缓存关系', () => {
  const source = generateMeihua(new Date('2025-06-18T10:30:00+08:00'), {
    method: 'number',
    number: 123,
  });
  assert.deepEqual(
    [source.originalName, source.interName, source.changedName],
    ['火水未济', '水火既济', '火风鼎'],
  );
  assert.equal(source.movingYao.position, 3);
  assert.equal(source.analysis.inter1Relation, '体互克原体');
  assert.equal(source.analysis.changedTiYongRelation, '用生体');
  for (const removePairs of [false, true]) {
    const partial = structuredClone(source);
    partial.interHexagram = null;
    partial.changedHexagram = null;
    if (removePairs) {
      partial.interTiGua = undefined;
      partial.interYongGua = undefined;
      partial.changedTiGua = undefined;
      partial.changedYongGua = undefined;
    }
    partial.evidenceAnalysis = undefined;
    const summary = getDivinationSummaryBlocks('meihua', partial);
    assert.deepEqual(summary.tags.slice(0, 3), ['主卦：火水未济', '互卦：未列', '变卦：未列']);
    for (const text of [
      summary.lines.join('\n'),
      formatDivinationInfo('meihua', partial),
      formatDetailedDivinationInfo('meihua', partial),
      buildCoreDivinationPrompt({ method: 'meihua', data: partial, question: '工作进展如何？' }),
      buildDivinationPrompt('meihua', '工作进展如何？', partial),
    ]) {
      assert.match(text, /体卦离/u);
      assert.match(text, /互卦体用资料未列/u);
      assert.doesNotMatch(text, /体互克原体|用互与原体比和|变后体用为【用生体】|结果关系用生体/u);
      assert.doesNotMatch(text, /月令作用：(?:体互|用互|变后体卦|变后用卦)/u);
    }
  }
  const complete = formatDivinationInfo('meihua', source);
  assert.match(complete, /互卦：水火既济/u);
  assert.match(complete, /体互克原体/u);
  assert.match(complete, /变卦火风鼎/u);
});
