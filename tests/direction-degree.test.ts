import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeCompassDirection,
  BAGUA,
  TWENTY_FOUR_MOUNTAINS,
  direction,
  getBaguaNames,
  getTwentyFourMountainNames,
  getHouseTrigram,
  getHouseTrigramFromSitFacing,
  getBaZhaiPalace,
  getMountainFromDegree,
  getSitFacingFromFacingDegree,
} from '../packages/core/src/direction/index.ts';
import { analyzeBaZhai } from '../packages/core/src/ba_zhai/index.ts';
import { getFoundationCapabilities } from '../packages/core/src/foundation/index.ts';
import { generateXuanKong } from '../packages/core/src/xuan_kong/index.ts';
import { buildMetaphysicsPrompt } from '../src/lib/metaphysics-prompt.ts';

test('罗盘朝向度数应自动换算二十四山坐向', () => {
  assert.equal(getMountainFromDegree(0).mountain, '子');
  assert.equal(getMountainFromDegree(360).mountain, '子');
  assert.equal(getMountainFromDegree(90).mountain, '卯');
  assert.equal(getMountainFromDegree(225).mountain, '坤');

  const southFacing = getSitFacingFromFacingDegree(180);
  assert.equal(southFacing.facing.mountain, '午');
  assert.equal(southFacing.sit.mountain, '子');
  assert.equal(southFacing.label, '子山午向');

  const evidence = analyzeCompassDirection(180);
  assert.equal(evidence.key, 'foundation:direction:180');
  assert.equal(evidence.status, '已换算');
  assert.equal(evidence.facingBagua, '离');
  assert.equal(evidence.sitBagua, '坎');
  assert.equal(evidence.summaryFact.status, '映射稳定');
  assert.match(
    evidence.promptText,
    /【任务】[\s\S]*【罗盘资料】[\s\S]*【传统依据】[\s\S]*【输出要求】/,
  );
  assert.match(evidence.promptText, /朝向度数：180°\n向山：午，属离卦\n坐山：0°；子，属坎卦/);
  assert.match(evidence.promptText, /正北0°顺时针/);
  assert.match(evidence.promptText, /实际北向基准（真北或磁北）、磁偏角与仪器误差待核定/);
  assert.doesNotMatch(
    evidence.promptText,
    /计算步骤|方位事实|证据汇总|来源：|限制：|不应|不得|不自动|本项目|API|MCP/,
  );
  assert.equal(evidence.promptText.split('子，属坎卦').length - 1, 1);
  assert.match(analyzeCompassDirection(360).promptText, /朝向度数：360°（归一化为0°）/);
});

test('罗盘二十四山分界线应明确标记，不得静默当成普通度数', () => {
  const boundary = getMountainFromDegree(7.5);
  assert.equal(boundary.isBoundary, true);
  assert.deepEqual(boundary.boundaryMountains, ['子', '癸']);
  assert.equal(getMountainFromDegree(7.49).mountain, '子');
  assert.equal(getMountainFromDegree(7.51).mountain, '癸');
  const evidence = analyzeCompassDirection(7.5);
  assert.equal(evidence.status, '存在分界线');
  assert.equal(evidence.summaryFact.status, '坐向均位于分界线');
  assert.equal(evidence.facing.isBoundary, true);
  assert.equal(evidence.sit.isBoundary, true);
  assert.match(evidence.promptText, /向山：子、癸分界；均属坎卦；山位待复测核定/);
  assert.match(evidence.promptText, /坐山：187.5°；午、丁分界；均属离卦；山位待复测核定/);
});

test('跨卦分界线应保留两侧八卦候选，同卦分界线仍可确定八卦', () => {
  const crossBagua = analyzeCompassDirection(67.5);
  const crossFact = crossBagua.directionFacts.find((fact) => fact.type === '八卦归属');
  assert.equal(crossBagua.facing.mountain, '甲');
  assert.deepEqual(crossBagua.facing.boundaryMountains, ['寅', '甲']);
  assert.equal(crossFact?.status, '位于分界线');
  assert.match(crossFact?.promptText ?? '', /向卦候选为艮、震/);
  assert.match(crossFact?.promptText ?? '', /坐卦候选为坤、兑/);
  assert.match(crossBagua.promptText, /向山：寅、甲分界；寅属艮卦、甲属震卦/);
  assert.match(crossBagua.promptText, /坐山：247.5°；申、庚分界；申属坤卦、庚属兑卦/);
  assert.doesNotMatch(crossBagua.promptText, /当前按庚山甲向归位/);

  const sameBagua = analyzeCompassDirection(7.5);
  const sameFact = sameBagua.directionFacts.find((fact) => fact.type === '八卦归属');
  assert.deepEqual(sameBagua.facing.boundaryMountains, ['子', '癸']);
  assert.equal(sameFact?.status, '已确定');
  assert.match(sameFact?.promptText ?? '', /癸向属坎卦/);
});

test('罗盘度数应拒绝越界和非有限数字', () => {
  assert.throws(() => getMountainFromDegree(-0.1), /罗盘度数需在 0 到 360 之间/);
  assert.throws(() => getMountainFromDegree(360.1), /罗盘度数需在 0 到 360 之间/);
  assert.throws(() => getMountainFromDegree(Number.NaN), /罗盘度数需在 0 到 360 之间/);
});

test('宅卦与八宅查询拒绝对象原型键和非字符串坐山', () => {
  for (const value of ['toString', 'constructor', '__proto__', [], { toString: () => '子' }]) {
    assert.throws(() => getHouseTrigram(value as never), /坐山无效/);
    assert.throws(() => getBaZhaiPalace(value as never), /基准卦无效/);
  }
});

test('完整坐向文字以坐山取宅卦，并核对坐向相差一百八十度', () => {
  const mountains = [...'子癸丑艮寅甲卯乙辰巽巳丙午丁未坤申庚酉辛戌乾亥壬'];
  const expected = [...'坎坎艮艮艮震震震巽巽巽离离离坤坤坤兑兑兑乾乾乾坎'];
  for (let i = 0; i < 24; i += 1) {
    const sit = mountains[i];
    const facing = mountains[(i + 12) % 24];
    assert.equal(getHouseTrigramFromSitFacing(`${sit}山${facing}向`), expected[i]);
    assert.equal(getHouseTrigramFromSitFacing(sit), expected[i]);
  }
  assert.throws(() => getHouseTrigramFromSitFacing('子山卯向'), /坐向须为相对/);
  assert.throws(() => getHouseTrigramFromSitFacing('子山午'), /坐山无效/);
});

test('八宅六十四宫符合《阳宅真诀》大游年歌', () => {
  const sequence = [...'坎艮震巽离坤兑乾'];
  const songs: Record<string, string> = {
    乾: '六天五祸绝延生',
    坎: '五天生延绝祸六',
    艮: '六绝祸生延天五',
    震: '延生祸绝五天六',
    巽: '天五六祸生绝延',
    离: '六五绝延祸生天',
    坤: '天延绝生祸五六',
    兑: '生祸延绝六五天',
  };
  const names: Record<string, string> = {
    伏: '伏位',
    六: '六煞',
    天: '天医',
    五: '五鬼',
    祸: '祸害',
    绝: '绝命',
    延: '延年',
    生: '生气',
  };
  for (const base of sequence) {
    const palace = getBaZhaiPalace(base);
    const song = [...`伏${songs[base]}`];
    for (let offset = 0; offset < 8; offset += 1) {
      const index = (sequence.indexOf(base) + offset) % 8;
      assert.equal(palace[index].label, names[song[offset]], `${base}宅${sequence[index]}宫`);
    }
  }
});

test('公开八卦与二十四山数组排序不改变独立排盘和完整任务书', () => {
  const expectedBagua = [...'坎艮震巽离坤兑乾'];
  const expectedMountains = [...'子癸丑艮寅甲卯乙辰巽巳丙午丁未坤申庚酉辛戌乾亥壬'];
  const originalBagua = [...BAGUA];
  const originalMountains = [...TWENTY_FOUR_MOUNTAINS];
  const bazhai = analyzeBaZhai({ mingGua: '坎', sitMountain: '子' });
  const xuankong = generateXuanKong({ year: 2024, sitMountain: '子' });
  const currentTime = new Date('2026-10-04T00:00:00Z');
  const bazhaiOptions = { method: 'bazhai' as const, currentTime };
  const xuankongOptions = { method: 'xuankong' as const, currentTime };
  const bazhaiTask = buildMetaphysicsPrompt(bazhai.prompt, '核对命宅与八方', bazhaiOptions);
  const xuankongTask = buildMetaphysicsPrompt(xuankong.prompt, '核对山向飞星', xuankongOptions);

  try {
    assert.equal(BAGUA.sort(), BAGUA);
    assert.equal(TWENTY_FOUR_MOUNTAINS.sort(), TWENTY_FOUR_MOUNTAINS);
    assert.notDeepEqual(BAGUA, expectedBagua);
    assert.notDeepEqual(TWENTY_FOUR_MOUNTAINS, expectedMountains);
    assert.equal(direction.BAGUA, BAGUA);
    assert.equal(direction.TWENTY_FOUR_MOUNTAINS, TWENTY_FOUR_MOUNTAINS);

    getBaguaNames().sort();
    getTwentyFourMountainNames().sort();
    const baguaCopy = direction.getBaguaNames();
    const mountainCopy = direction.getTwentyFourMountainNames();
    baguaCopy[0] = '变造';
    mountainCopy[0] = '变造';
    assert.deepEqual(getBaguaNames(), expectedBagua);
    assert.deepEqual(getTwentyFourMountainNames(), expectedMountains);
    const capabilities = getFoundationCapabilities();
    assert.deepEqual(capabilities.constants.bagua, expectedBagua);
    assert.deepEqual(capabilities.constants.twentyFourMountains, expectedMountains);
    assert.equal(getMountainFromDegree(0).mountain, '子');
    assert.equal(getMountainFromDegree(360).mountain, '子');
    assert.equal(getHouseTrigramFromSitFacing('子山午向'), '坎');
    assert.deepEqual(
      getBaZhaiPalace('坎').map((palace) => `${palace.gua}:${palace.label}`),
      ['坎:伏位', '艮:五鬼', '震:天医', '巽:生气', '离:延年', '坤:绝命', '兑:祸害', '乾:六煞'],
    );

    const freshBazhai = analyzeBaZhai({ mingGua: '坎', sitMountain: '子' });
    const freshXuankong = generateXuanKong({ year: 2024, sitMountain: '子' });
    assert.deepEqual(freshBazhai, bazhai);
    assert.deepEqual(freshXuankong, xuankong);
    assert.equal(
      buildMetaphysicsPrompt(freshBazhai.prompt, '核对命宅与八方', bazhaiOptions),
      bazhaiTask,
    );
    assert.equal(
      buildMetaphysicsPrompt(freshXuankong.prompt, '核对山向飞星', xuankongOptions),
      xuankongTask,
    );
  } finally {
    BAGUA.splice(0, BAGUA.length, ...originalBagua);
    TWENTY_FOUR_MOUNTAINS.splice(0, TWENTY_FOUR_MOUNTAINS.length, ...originalMountains);
  }
});
