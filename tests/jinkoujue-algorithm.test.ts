import { test } from 'node:test';
import { strict as assert } from 'node:assert';

import {
  analyzeJinkoujueEvidence,
  generateJinkoujue,
} from '../packages/core/src/divination/algorithms/jinkoujue.ts';

const SAMPLE_DATE = new Date('2025-01-01T08:00:00+08:00');
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

test('金口诀：数字起课 1-12 映射子至亥，大于 12 按 12 归一', () => {
  const zi = generateJinkoujue({ method: 'number', number: 1, customDate: SAMPLE_DATE });
  const hai = generateJinkoujue({ method: 'number', number: 12, customDate: SAMPLE_DATE });
  const wrap = generateJinkoujue({ method: 'number', number: 13, customDate: SAMPLE_DATE });

  assert.equal(zi.diFenBranch, '子');
  assert.equal(hai.diFenBranch, '亥');
  assert.equal(wrap.diFenBranch, '子');
});

test('金口诀：五子元遁应按日干起遁干', () => {
  const data = generateJinkoujue({ method: 'number', number: 1, customDate: SAMPLE_DATE });
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
          positions.map((position) => data.xunKong.includes(position.branch)),
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
