import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  generateLiuyao,
  analyzeLiuyaoEvidence,
  evaluateLiuyaoHiddenSpiritInteraction,
  getLiuyaoChangeDirection,
  getLiuyaoChangeRelation,
  getLiuyaoChangeRelations,
  getLiuyaoFanFuRelations,
  getLiuyaoGuaShenBranch,
  getLiuyaoHexagramRelation,
  getLiuyaoHexagramRelations,
  getLiuyaoPalaceStage,
} from 'mingyu-core/divination/liuyao';
import {
  buildTimeInfoText,
  formatEnhancedDivinationInfo,
  getDivinationSummaryBlocks,
} from 'mingyu-core/prompt';
import type { LiuyaoYaoDetail } from 'mingyu-core/types';

// 子月：水旺木相金休土囚火死。
// 该日期的卦象固定，用于回归月令旺衰、暗动、回头生克冲的字段输出。
const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');
const SHAN_HUO_BI_YAOS = [7, 8, 7, 8, 8, 7] as const;
const XUN_WEI_FENG_YAOS = [8, 7, 7, 8, 7, 7] as const;
const DUI_WEI_ZE_YAOS = [7, 7, 8, 7, 7, 8] as const;
const FENG_SHUI_HUAN_YAOS = [8, 7, 8, 8, 7, 7] as const;
const KAN_WEI_SHUI_YAOS = [8, 7, 8, 8, 7, 8] as const;

test('六爻真太阳时跨立夏仍按实际交节确定月建旺衰和月破', () => {
  // 香港天文台 2024 年年历：立夏为 5 月 5 日 08:10（东八区）。
  const yaos = [7, 7, 7, 7, 7, 7] as const;
  const beforeTerm = generateLiuyao(new Date('2024-05-05T09:00:00+08:00'), {
    method: 'manual',
    yaos,
    termReferenceDate: new Date('2024-05-05T07:30:00+08:00'),
  });
  assert.equal(beforeTerm.originalName, '乾为天');
  assert.equal(beforeTerm.ganzhi.month.slice(1), '辰');
  assert.equal(beforeTerm.yaosDetail[1].najiaDizhi, '寅');
  assert.equal(beforeTerm.yaosDetail[1].seasonState, '囚');
  assert.equal(beforeTerm.yaosDetail[5].najiaDizhi, '戌');
  assert.equal(beforeTerm.yaosDetail[5].isMonthBreak, true);
  assert.match(buildTimeInfoText(beforeTerm), /节气：谷雨/);

  const afterTerm = generateLiuyao(new Date('2024-05-05T06:00:00+08:00'), {
    method: 'manual',
    yaos,
    termReferenceDate: new Date('2024-05-05T08:40:00+08:00'),
  });
  assert.equal(afterTerm.ganzhi.month.slice(1), '巳');
  assert.equal(afterTerm.yaosDetail[1].seasonState, '休');
  assert.equal(afterTerm.yaosDetail[5].isMonthBreak, false);
  assert.match(buildTimeInfoText(afterTerm), /节气：立夏/);
});

function generateSampleLiuyao(yaos: readonly number[] = SHAN_HUO_BI_YAOS) {
  return generateLiuyao(SAMPLE_DATE, { yaos });
}

test('六爻：山火贲的子月旺衰、三刑与静卦状态按实际纳支呈现', () => {
  const data = generateSampleLiuyao();
  const monthBranch = data.ganzhi.month.slice(1);
  assert.equal(monthBranch, '子', '样本日期应为子月');

  assert.equal(data.originalName, '山火贲');
  assert.deepEqual(
    data.yaosDetail.map((yao) => yao.najiaDizhi),
    ['卯', '丑', '亥', '戌', '子', '寅'],
  );
  assert.deepEqual(
    data.yaosDetail.map((yao) => yao.seasonState),
    ['相', '囚', '旺', '囚', '旺', '相'],
  );
  assert.ok(
    data.sanxingInYaos?.some(
      (item) => item.type === '恃势之刑' && item.branches.join('') === '丑戌',
    ),
  );
  assert.deepEqual(data.fanfuRelations, { fanyin: [], fuyin: [], labels: [] });
});

test('六爻：月建为墓库支时不得直接判作入月墓', () => {
  // 辰月水爻只按月令判断旺衰；《增删卜易》三墓为日墓、动墓、化墓，不含月墓。
  const data = generateLiuyao(new Date('2025-04-10T08:00:00+08:00'), {
    yaos: SHAN_HUO_BI_YAOS,
  });

  assert.equal(data.ganzhi.month.slice(1), '辰');
  assert.notEqual(data.ganzhi.day.slice(1), '辰');
  const waterYaos = data.yaosDetail.filter((yao) => yao.wuxing === '水');
  assert.ok(waterYaos.length > 0, '样本卦应包含水爻');
  for (const yao of waterYaos) {
    assert.equal(yao.isYueMu, false, `第${yao.position}爻不得因辰月直接判作入月墓`);
    assert.equal(yao.isRiMu, false, `第${yao.position}爻未逢日墓时不得判作入日墓`);
  }
  assert.doesNotMatch(data.evidenceAnalysis?.promptText ?? '', /入月墓/);
});

test('六爻：日辰、明动与变爻分别核验生旺墓绝，并可补成完整三合三支', () => {
  const data = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
    yaos: [7, 6, 7, 7, 7, 6],
  });

  assert.equal(data.ganzhi.day.slice(1), '午');
  assert.equal(data.originalName, '泽火革');
  assert.equal(data.changedName, '乾为天');
  assert.deepEqual(
    data.yaosDetail
      .filter((yao) => yao.isChanging)
      .map((yao) => [yao.najiaDizhi, yao.changedYao?.dizhi]),
    [
      ['丑', '寅'],
      ['未', '戌'],
    ],
  );
  assert.equal(data.sanheWithDay?.group, '火局');
  assert.deepEqual(data.sanheWithDay?.members, ['寅', '午', '戌']);
  assert.match(data.sanheWithDay?.description || '', /日辰午与动变爻同见三合火局三支/);
  assert.equal(data.sanheWithMonth, null);

  const woodYao = data.yaosDetail.find((yao) => yao.wuxing === '木');
  assert.ok(woodYao, '样本卦应包含木爻');
  assert.equal(woodYao.dayLifeStage, '死');
  assert.ok(
    woodYao.movingLifeStages?.some(
      (item) => item.position === 6 && item.branch === '未' && item.stage === '墓',
    ),
  );
  assert.equal(woodYao.isDongMu, true);
  assert.equal(woodYao.isRuMu, true);
  const detailedPrompt = formatEnhancedDivinationInfo('liuyao', data);
  assert.match(detailedPrompt, /本爻木在日辰支十二长生死/);
  assert.match(detailedPrompt, /本爻木在明动爻支十二长生[^，]*第6爻未墓/);

  const changingYaos = data.yaosDetail.filter((yao) => yao.isChanging);
  assert.ok(changingYaos.every((yao) => yao.changedLifeStage));
  assert.ok(
    data.evidenceAnalysis?.promptText.includes('入动墓'),
    '提示词证据应明确输出入动墓，供后续结合旺衰与生扶判断',
  );

  const huaMuData = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
    yaos: [7, 7, 6, 6, 6, 6],
  });
  const huaMuYao = huaMuData.yaosDetail[2];
  assert.equal(huaMuData.originalName, '地泽临');
  assert.equal(huaMuYao.najiaDizhi, '丑');
  assert.equal(huaMuYao.changedYao?.dizhi, '辰');
  assert.equal(huaMuYao.changedLifeStage, '墓');
  assert.equal(huaMuYao.isHuaMu, true);
  assert.match(huaMuData.evidenceAnalysis?.promptText ?? '', /动而化墓|化墓/);

  for (const source of [data, huaMuData]) {
    const oldResult = structuredClone(source);
    for (const yao of oldResult.yaosDetail) {
      for (const field of [
        'dayLifeStage',
        'movingLifeStages',
        'changedLifeStage',
        'isDongMu',
        'isHuaMu',
        'isRiMu',
        'isRuMu',
        'shiErGong',
        'isYueMu',
        'isSanxing',
        'sanxingType',
        'isLiuhe',
        'liuhePartner',
        'isLiuhai',
        'changeRelation',
        'changeRelations',
        'changeDirection',
      ] as const)
        delete yao[field];
    }
    const snapshot = structuredClone(oldResult);
    const restored = analyzeLiuyaoEvidence(oldResult);
    assert.deepEqual(restored, analyzeLiuyaoEvidence(source));
    assert.equal(
      formatEnhancedDivinationInfo('liuyao', oldResult),
      formatEnhancedDivinationInfo('liuyao', source),
    );
    assert.deepEqual(
      getDivinationSummaryBlocks('liuyao', oldResult),
      getDivinationSummaryBlocks('liuyao', source),
    );
    assert.deepEqual(oldResult, snapshot);
    if (source === data) {
      const restoredWood = restored.lineFacts.find((yao) => yao.najia.wuxing === '木')!;
      assert.equal(restoredWood.traditionalRelations.dayLifeStage, '死');
      assert.ok(
        restoredWood.traditionalRelations.movingLifeStages?.some(
          (item) => item.position === 6 && item.branch === '未' && item.stage === '墓',
        ),
      );
      assert.ok(restoredWood.constraints.includes('入动墓'));
    } else {
      const restoredHuaMu = restored.lineFacts[2];
      assert.equal(restoredHuaMu.traditionalRelations.changedLifeStage, '墓');
      assert.ok(restoredHuaMu.constraints.includes('动而化墓'));
    }
  }
});

test('六爻：变爻地支的十二长生阶段以本爻五行为参照', () => {
  const data = generateLiuyao(SAMPLE_DATE, { yaos: [7, 9, 7, 7, 7, 7] });
  const movingYao = data.yaosDetail[1];

  assert.equal(data.originalName, '乾为天');
  assert.equal(data.changedName, '天火同人');
  assert.equal(movingYao.najiaDizhi, '寅');
  assert.equal(movingYao.wuxing, '木');
  assert.equal(movingYao.changedYao?.dizhi, '丑');
  assert.equal(movingYao.changedYao?.wuxing, '土');
  assert.equal(movingYao.changedLifeStage, '冠带');

  const prompt = formatEnhancedDivinationInfo('liuyao', data);
  assert.match(prompt, /本爻木在变爻丑支十二长生冠带/);
  assert.doesNotMatch(prompt, /变爻十二长生冠带/);
});

test('六爻：单个辰土爻发动不因自身辰支判作入动墓', () => {
  const data = generateLiuyao(SAMPLE_DATE, { yaos: [7, 8, 6, 8, 8, 8] });
  const movingYao = data.yaosDetail[2];
  const lineFact = data.evidenceAnalysis?.lineFacts[2];

  assert.equal(data.originalName, '地雷复');
  assert.equal(movingYao.najiaDizhi, '辰');
  assert.equal(movingYao.shiErGong, '墓');
  assert.equal(movingYao.isChanging, true);
  assert.equal(movingYao.isRiMu, false);
  assert.equal(movingYao.isHuaMu, false);
  assert.deepEqual(movingYao.movingLifeStages, []);
  assert.equal(movingYao.isDongMu, false);
  assert.equal(movingYao.isRuMu, false);
  assert.ok(!lineFact?.constraints.includes('入动墓'));
  assert.doesNotMatch(lineFact?.promptText ?? '', /入动墓|动爻生旺墓绝第3爻辰墓/);
});

test('六爻：日冲应按旺相静爻、休囚静爻与动爻分别处理', () => {
  const assertRestoredDayState = (source: ReturnType<typeof generateLiuyao>) => {
    const legacy = structuredClone(source);
    for (const yao of legacy.yaosDetail) {
      delete yao.isHiddenMove;
      delete yao.isDayBreak;
      delete yao.isDayClash;
      delete yao.isMonthBreak;
      delete yao.seasonState;
    }
    const before = structuredClone(legacy);
    assert.deepEqual(analyzeLiuyaoEvidence(legacy), analyzeLiuyaoEvidence(source));
    assert.equal(
      formatEnhancedDivinationInfo('liuyao', legacy),
      formatEnhancedDivinationInfo('liuyao', source),
    );
    assert.deepEqual(
      getDivinationSummaryBlocks('liuyao', legacy),
      getDivinationSummaryBlocks('liuyao', source),
    );
    assert.deepEqual(legacy, before);
    const wrongSeason = structuredClone(legacy);
    wrongSeason.yaosDetail[0].seasonState = source.yaosDetail[0].seasonState === '旺' ? '死' : '旺';
    assert.throws(() => analyzeLiuyaoEvidence(wrongSeason), /月日空破与盘面不一致/u);
    assert.throws(
      () => formatEnhancedDivinationInfo('liuyao', wrongSeason),
      /月日空破与盘面不一致/u,
    );
    assert.throws(() => getDivinationSummaryBlocks('liuyao', wrongSeason), /月日空破与盘面不一致/u);
    const dayClash = source.yaosDetail.find((yao) => yao.isDayClash);
    assert.ok(dayClash);
    for (const flag of ['isHiddenMove', 'isDayBreak', 'isDayClash', 'isMonthBreak'] as const) {
      const conflict = structuredClone(legacy);
      conflict.yaosDetail[dayClash.position - 1][flag] = !dayClash[flag];
      assert.throws(() => analyzeLiuyaoEvidence(conflict), /月日空破与盘面不一致/u);
      assert.throws(
        () => formatEnhancedDivinationInfo('liuyao', conflict),
        /月日空破与盘面不一致/u,
      );
      assert.throws(() => getDivinationSummaryBlocks('liuyao', conflict), /月日空破与盘面不一致/u);
    }
  };
  const hiddenMoveData = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
    yaos: KAN_WEI_SHUI_YAOS,
  });
  const hiddenMoveYao = hiddenMoveData.yaosDetail.find((yao) => yao.najiaDizhi === '子');
  assert.equal(hiddenMoveData.ganzhi.month.slice(1), '子');
  assert.equal(hiddenMoveData.ganzhi.day.slice(1), '午');
  assert.equal(hiddenMoveYao?.seasonState, '旺');
  assert.equal(hiddenMoveYao?.isDayClash, true);
  assert.equal(hiddenMoveYao?.isHiddenMove, true);
  assert.equal(hiddenMoveYao?.isDayBreak, false);
  assert.match(formatEnhancedDivinationInfo('liuyao', hiddenMoveData), /暗动/);

  const dayClashDate = new Date('2025-01-07T08:00:00+08:00');
  const dayBreakData = generateLiuyao(dayClashDate, { yaos: [7, 7, 7, 7, 7, 7] });
  const dayBreakYao = dayBreakData.yaosDetail.find((yao) => yao.najiaDizhi === '午');
  assert.equal(dayBreakData.ganzhi.month.slice(1), '丑');
  assert.equal(dayBreakData.ganzhi.day.slice(1), '子');
  assert.equal(dayBreakYao?.seasonState, '休');
  assert.equal(dayBreakYao?.isDayClash, true);
  assert.equal(dayBreakYao?.isHiddenMove, false);
  assert.equal(dayBreakYao?.isDayBreak, true);

  const movingData = generateLiuyao(dayClashDate, { yaos: [7, 7, 7, 9, 7, 7] });
  const movingYao = movingData.yaosDetail.find((yao) => yao.najiaDizhi === '午');
  assert.equal(movingYao?.isChanging, true);
  assert.equal(movingYao?.isDayClash, true);
  assert.equal(movingYao?.isHiddenMove, false);
  assert.equal(movingYao?.isDayBreak, false);
  const movingFact = movingData.evidenceAnalysis?.lineFacts.find((item) => item.position === 4);
  assert.ok(movingFact?.dayState.relations.includes('日辰冲动'));
  assert.ok(!movingFact?.dayState.relations.includes('日冲成破'));
  assert.match(formatEnhancedDivinationInfo('liuyao', movingData), /日辰冲动/);
  for (const source of [hiddenMoveData, dayBreakData, movingData]) assertRestoredDayState(source);

  // 《增删卜易》固定原例；现代日期只定位相同月支、日柱及手录爻值。
  // 暗动章：寅月己未日坤之师，第四丑土旬空而被未日冲动。
  // 用神元神忌神仇神章：辰月戊申日乾之小畜，第二寅木旬空而被申日冲动。
  for (const input of [
    {
      date: '2025-02-19T08:00:00+08:00',
      yaos: [8, 6, 8, 8, 8, 8],
      month: '寅',
      day: '己未',
      original: '坤为地',
      changed: '地水师',
      position: 4,
      branch: '丑',
      season: '死',
      voids: ['子', '丑'],
    },
    {
      date: '2025-04-09T08:00:00+08:00',
      yaos: [7, 7, 7, 9, 7, 7],
      month: '辰',
      day: '戊申',
      original: '乾为天',
      changed: '风天小畜',
      position: 2,
      branch: '寅',
      season: '囚',
      voids: ['寅', '卯'],
    },
  ]) {
    const data = generateLiuyao(new Date(input.date), { method: 'manual', yaos: input.yaos });
    const yao = data.yaosDetail[input.position - 1];
    assert.equal(data.ganzhi.month.slice(1), input.month);
    assert.equal(data.ganzhi.day, input.day);
    assert.equal(data.originalName, input.original);
    assert.equal(data.changedName, input.changed);
    assert.deepEqual(data.voidBranches, input.voids);
    assert.equal(yao.najiaDizhi, input.branch);
    assert.equal(yao.isChanging, false);
    assert.equal(yao.seasonState, input.season);
    assert.equal(yao.isVoid, true);
    assert.equal(yao.isMonthBreak, false);
    assert.equal(yao.isDayClash, true);
    assert.equal(yao.isHiddenMove, true);
    assert.equal(yao.isDayBreak, false);
    const evidence = analyzeLiuyaoEvidence(data);
    const fact = evidence.lineFacts[input.position - 1];
    assert.equal(fact.activity, '暗动');
    assert.ok(fact.dayState.relations.includes('日冲暗动'));
    assert.ok(fact.constraints.includes('本爻空亡'));
    assert.ok(!fact.constraints.includes('日破'));
    assert.ok(
      evidence.timingFacts
        .find((item) => item.key === 'liuyao:timing:void')
        ?.ownerFactKeys.includes(`本卦:第${input.position}爻`),
    );
    const prompt = formatEnhancedDivinationInfo('liuyao', data);
    const displayedLine = prompt
      .split('\n')
      .find((line) => line.startsWith(`  第${input.position}爻`));
    assert.ok(displayedLine?.includes(`${yao.sixRelative}${input.branch}${yao.wuxing}`));
    assert.match(displayedLine ?? '', /旬空/u);
    assert.match(displayedLine ?? '', /日冲暗动/u);
    assert.doesNotMatch(displayedLine ?? '', /日冲成破/u);
    assertRestoredDayState(data);

    const stale = structuredClone(data);
    stale.yaosDetail[input.position - 1].isHiddenMove = false;
    stale.yaosDetail[input.position - 1].isDayBreak = true;
    assert.throws(() => analyzeLiuyaoEvidence(stale), /月日空破与盘面不一致/u);
    assert.throws(() => formatEnhancedDivinationInfo('liuyao', stale), /月日空破与盘面不一致/u);
  }

  // 天时章：辰月蹇卦戌父月破，翌辰日再冲不使静爻起用。
  const monthBroken = generateLiuyao(new Date('2025-04-05T08:00:00+08:00'), {
    method: 'manual',
    yaos: [8, 8, 7, 8, 7, 8],
  });
  assert.equal(monthBroken.originalName, '水山蹇');
  assert.equal(monthBroken.ganzhi.month.slice(1), '辰');
  assert.equal(monthBroken.ganzhi.day, '甲辰');
  const brokenYao = monthBroken.yaosDetail[4];
  assert.equal(brokenYao.najiaDizhi, '戌');
  assert.equal(brokenYao.seasonState, '旺');
  assert.equal(brokenYao.isMonthBreak, true);
  assert.equal(brokenYao.isDayClash, true);
  assert.equal(brokenYao.isHiddenMove, false);
  assert.equal(monthBroken.evidenceAnalysis?.lineFacts[4].activity, '静爻');
  assert.ok(monthBroken.evidenceAnalysis?.lineFacts[4].constraints.includes('月破'));
  assert.ok(monthBroken.evidenceAnalysis?.lineFacts[4].constraints.includes('日破'));
  assertRestoredDayState(monthBroken);
});

test('六爻：动爻变爻应完整输出回头、化泄、化耗等五行关系', () => {
  const data = generateSampleLiuyao([9, 6, 9, 6, 9, 6]);
  const changingYaos = data.yaosDetail.filter((y) => y.isChanging);

  for (const yao of changingYaos as LiuyaoYaoDetail[]) {
    if (yao.changedYao) {
      assert.ok(
        yao.changeRelation,
        `第${yao.position}爻动变应输出 changeRelation，实际 ${yao.changeRelation}`,
      );
      assert.ok(
        ['回头生', '回头克', '回头冲', '化空', '比和', '化泄', '化耗'].includes(
          yao.changeRelation!,
        ),
        `第${yao.position}爻 changeRelation 值非法：${yao.changeRelation}`,
      );
      assert.ok(yao.changeRelations?.length, `第${yao.position}爻应输出完整 changeRelations`);
      assert.ok(
        yao.changeRelations?.includes(yao.changeRelation!),
        `第${yao.position}爻兼容单值应包含在完整关系列表中`,
      );
    }
  }
});

test('六爻：变爻旬空与回头生克等基础动变条件可以并见', () => {
  assert.deepEqual(getLiuyaoChangeRelations('木', '水', '寅', '子', true), ['回头生', '化空']);
  assert.deepEqual(getLiuyaoChangeRelations('木', '金', '卯', '酉', true), [
    '回头冲',
    '回头克',
    '化空',
  ]);
  assert.deepEqual(getLiuyaoChangeRelations('木', '土', '寅', '辰', true), ['化耗', '化空']);

  // 旧单值入口继续保持既有口径，避免已有调用方升级后结果突变。
  assert.equal(getLiuyaoChangeRelation('木', '水', '寅', '子', true), '化空');
});

test('六爻：伏神旬空应单独保留出伏边界，不得与实伏得到相同结论', () => {
  const solidHidden = evaluateLiuyaoHiddenSpiritInteraction({
    hiddenWuxing: '木',
    hiddenVoid: false,
    flyingWuxing: '水',
    flyingDizhi: '亥',
    flyingVoid: false,
    monthBranch: '子',
  });
  const voidHidden = evaluateLiuyaoHiddenSpiritInteraction({
    hiddenWuxing: '木',
    hiddenVoid: true,
    flyingWuxing: '水',
    flyingDizhi: '亥',
    flyingVoid: false,
    monthBranch: '子',
  });

  assert.match(solidHidden, /^飞神生伏，存在飞神生扶条件；/);
  assert.match(voidHidden, /^伏神旬空，出伏需核日月、动爻、旺衰及出空条件；/);
  assert.match(voidHidden, /飞神生伏，存在飞神生扶条件/);
  assert.match(voidHidden, /出伏仍需结合日月、动爻及旺衰综合核验/);
  assert.notEqual(voidHidden, solidHidden);
});

test('六爻伏神克飞只记录五行克制，不补造地支相冲', () => {
  const relation = evaluateLiuyaoHiddenSpiritInteraction({
    hiddenWuxing: '木',
    hiddenVoid: false,
    flyingWuxing: '土',
    flyingDizhi: '辰',
    flyingVoid: false,
  });
  assert.match(relation, /伏神克飞，存在伏神克制飞神条件/);
  assert.doesNotMatch(relation, /冲破/);
});

test('六爻：回头冲与五行生克应分别保存', () => {
  assert.deepEqual(getLiuyaoChangeRelations('木', '金', '卯', '酉', false), ['回头冲', '回头克']);
  assert.deepEqual(getLiuyaoChangeRelations('金', '木', '酉', '卯', false), ['回头冲', '化耗']);
  assert.equal(getLiuyaoChangeRelation('金', '木', '酉', '卯', false), '回头冲');
});

test('六爻：进退神按增删卜易明表判定，不按地支循环外推', () => {
  const advancingChanges: Array<[string, string]> = [
    ['亥', '子'],
    ['寅', '卯'],
    ['巳', '午'],
    ['申', '酉'],
    ['丑', '辰'],
    ['辰', '未'],
    ['未', '戌'],
  ];
  const retreatingChanges: Array<[string, string]> = [
    ['子', '亥'],
    ['卯', '寅'],
    ['午', '巳'],
    ['酉', '申'],
    ['辰', '丑'],
    ['未', '辰'],
    ['戌', '未'],
  ];

  for (const [originalBranch, changedBranch] of advancingChanges) {
    assert.equal(getLiuyaoChangeDirection(originalBranch, changedBranch), '化进神');
  }
  for (const [originalBranch, changedBranch] of retreatingChanges) {
    assert.equal(getLiuyaoChangeDirection(originalBranch, changedBranch), '化退神');
  }

  assert.equal(getLiuyaoChangeDirection('戌', '丑'), null);
  assert.equal(getLiuyaoChangeDirection('丑', '戌'), null);

  for (const [rawValue, originalName, changedName, originalBranch, changedBranch, direction] of [
    [6, '天泽履', '乾为天', '丑', '辰', '化进神'],
    [9, '乾为天', '天泽履', '辰', '丑', '化退神'],
  ] as const) {
    const data = generateLiuyao(SAMPLE_DATE, {
      method: 'manual',
      yaos: [7, 7, rawValue, 7, 7, 7],
    });
    assert.equal(data.originalName, originalName);
    assert.equal(data.changedName, changedName);
    assert.deepEqual(
      data.yaosDetail.filter((yao) => yao.isChanging).map((yao) => yao.position),
      [3],
    );
    assert.equal(data.yaosDetail[2].najiaDizhi, originalBranch);
    assert.equal(data.yaosDetail[2].changedYao?.dizhi, changedBranch);
    assert.equal(data.yaosDetail[2].changeDirection, direction);
    assert.equal(data.evidenceAnalysis?.lineFacts[2]?.changedYao?.direction, direction);
    assert.match(formatEnhancedDivinationInfo('liuyao', data), new RegExp(direction, 'u'));
    const oldResult = structuredClone(data);
    for (const yao of oldResult.yaosDetail) {
      delete yao.changeRelation;
      delete yao.changeRelations;
      delete yao.changeDirection;
    }
    const snapshot = structuredClone(oldResult);
    assert.equal(analyzeLiuyaoEvidence(oldResult).lineFacts[2].changedYao?.direction, direction);
    assert.match(formatEnhancedDivinationInfo('liuyao', oldResult), new RegExp(direction, 'u'));
    assert.ok(
      getDivinationSummaryBlocks('liuyao', oldResult).lines.some((line) =>
        line.includes(direction),
      ),
    );
    assert.deepEqual(oldResult, snapshot);
  }
});

test('六爻：整卦六合六冲应按初四二五三上爻支成组判断', () => {
  assert.equal(getLiuyaoHexagramRelation('乾为天'), '六冲卦');
  assert.equal(getLiuyaoHexagramRelation('巽为风'), '六冲卦');
  assert.equal(getLiuyaoHexagramRelation('天地否'), '六合卦');
  assert.equal(getLiuyaoHexagramRelation('地天泰'), '六合卦');
  assert.equal(getLiuyaoHexagramRelation('风水涣'), null);

  assert.deepEqual(getLiuyaoHexagramRelations('乾为天', '地天泰', true), {
    original: '六冲卦',
    changed: '六合卦',
    transition: '六冲变六合',
  });
  assert.deepEqual(getLiuyaoHexagramRelations('天地否', '坤为地', true), {
    original: '六合卦',
    changed: '六冲卦',
    transition: '六合变六冲',
  });

  const data = generateLiuyao(new Date('2025-01-01T01:00:00+08:00'), {
    yaos: XUN_WEI_FENG_YAOS,
  });
  assert.equal(data.originalName, '巽为风');
  assert.equal(data.hexagramRelations?.original, '六冲卦');
});

test('六爻：公开关系助手应拒绝未知卦名，不应返回空关系掩盖输入错误', () => {
  assert.throws(() => getLiuyaoHexagramRelation('不存在的卦'), /找不到卦象/);
  assert.throws(() => getLiuyaoHexagramRelations('不存在的卦', '乾为天', true), /找不到卦象/);
  assert.throws(() => getLiuyaoFanFuRelations('乾为天', '不存在的卦', true), /找不到卦象/);
  assert.throws(() => getLiuyaoFanFuRelations('不存在的卦', undefined, false), /找不到卦象/);
});

test('六爻：反吟伏吟应按卦变和纳甲地支判断', () => {
  const guaFanyin = getLiuyaoFanFuRelations('乾为天', '巽为风', true);
  assert.deepEqual(
    guaFanyin.fanyin.map(({ kind, scope, label }) => ({ kind, scope, label })),
    [{ kind: '卦反吟', scope: '内外', label: '内外反吟' }],
  );
  assert.deepEqual(guaFanyin.fuyin, []);
  assert.deepEqual(guaFanyin.labels, ['内外反吟']);

  const yaoFanyin = getLiuyaoFanFuRelations('风地观', '地风升', true);
  assert.deepEqual(
    yaoFanyin.fanyin.map(({ kind, scope, label }) => ({ kind, scope, label })),
    [{ kind: '爻反吟', scope: '内外', label: '内外爻反吟' }],
  );
  assert.deepEqual(yaoFanyin.labels, ['内外爻反吟']);

  const outerFuyin = getLiuyaoFanFuRelations('天风姤', '雷风恒', true);
  assert.deepEqual(
    outerFuyin.fuyin.map(({ kind, scope, label }) => ({ kind, scope, label })),
    [{ kind: '伏吟', scope: '外卦', label: '外卦伏吟' }],
  );
  assert.deepEqual(outerFuyin.fanyin, []);

  const innerFuyin = getLiuyaoFanFuRelations('风天小畜', '风雷益', true);
  assert.deepEqual(
    innerFuyin.fuyin.map(({ kind, scope, label }) => ({ kind, scope, label })),
    [{ kind: '伏吟', scope: '内卦', label: '内卦伏吟' }],
  );

  const staticHexagram = getLiuyaoFanFuRelations('乾为天', '乾为天', false);
  assert.deepEqual(staticHexagram.labels, []);
});

test('六爻：静卦不能仅凭静态纳甲支凑成三合局', () => {
  const data = generateLiuyao(new Date('2025-01-01T00:00:00+08:00'), {
    yaos: KAN_WEI_SHUI_YAOS,
  });

  assert.equal(data.ganzhi.month.slice(1), '子');
  assert.equal(data.ganzhi.day.slice(1), '午');
  assert.deepEqual(data.najiaDizhi, ['寅', '辰', '午', '申', '戌', '子']);

  assert.equal(data.changingYaos.length, 0);
  assert.equal(data.sanheWithDay, null);
  assert.equal(data.sanheWithMonth, null);
});

test('六爻：八宫卦位与月卦身分别按卦序及阳世起子、阴世起午确定', () => {
  assert.equal(getLiuyaoPalaceStage('乾为天'), '首卦');
  assert.equal(getLiuyaoPalaceStage('天风姤'), '一世');
  assert.equal(getLiuyaoPalaceStage('山地剥'), '五世');
  assert.equal(getLiuyaoPalaceStage('火地晋'), '游魂');
  assert.equal(getLiuyaoPalaceStage('火天大有'), '归魂');

  const yangShi = generateLiuyao(new Date('2025-01-01T16:00:00+08:00'), {
    yaos: FENG_SHUI_HUAN_YAOS,
  });
  assert.equal(yangShi.originalName, '风水涣');
  assert.equal(yangShi.palaceStage, '五世');
  assert.equal(yangShi.worldAndResponse.indexOf('世') + 1, 5);
  assert.equal(yangShi.yaosDetail[4].yaoType, '阳');
  assert.equal(yangShi.guaShen?.branch, '辰');
  assert.equal(yangShi.guaShen?.position, 2);

  const yinShi = generateLiuyao(new Date('2025-01-01T01:00:00+08:00'), {
    yaos: DUI_WEI_ZE_YAOS,
  });
  assert.equal(yinShi.originalName, '兑为泽');
  assert.equal(yinShi.worldAndResponse.indexOf('世') + 1, 6);
  assert.equal(yinShi.yaosDetail[5].yaoType, '阴');
  assert.equal(yinShi.guaShen?.branch, '亥');
  assert.equal(yinShi.guaShen?.position, 4);
});

test('六爻：动变关系与月卦身应拒绝非法资料', () => {
  assert.throws(() => getLiuyaoChangeRelation('', '火', '子', '午', false), /动变五行无效/);
  assert.throws(() => getLiuyaoChangeRelation('水', '火', '无', '午', false), /动变地支无效/);
  assert.throws(
    () => getLiuyaoChangeRelation('水', '火', '子', '午', undefined as never),
    /旬空标记必须是布尔值/,
  );
  assert.throws(() => getLiuyaoGuaShenBranch(0, true), /世爻位置无效/);
  assert.throws(() => getLiuyaoGuaShenBranch(7, false), /世爻位置无效/);
  assert.throws(() => getLiuyaoGuaShenBranch(1, undefined as never), /阴阳标记必须是布尔值/);
});

test('六爻：手工三钱法爻值应严格校验长度与取值', () => {
  assert.throws(() => generateLiuyao(SAMPLE_DATE, { yaos: [7, 8, 7] }), /必须恰好包含 6 爻/);
  assert.throws(
    () => generateLiuyao(SAMPLE_DATE, { yaos: [7, 8, 7, 8, 8, 5] }),
    /只能是 6、7、8、9/,
  );
});
