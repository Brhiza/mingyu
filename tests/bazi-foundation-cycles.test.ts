import assert from 'node:assert/strict';
import test from 'node:test';
import { getTenGod } from '@core/bazi/baziUtils';
import { TWELVE_STAGES_MAP, LU_BRANCH_MAP, REN_BRANCH_MAP } from '@core/bazi/baziMappingsData';
import { calculateKongWangBranches } from '@core/bazi/kongWang';
import { calculateNayin } from '@core/bazi/baziCalculatorHelpers';
import { analyzeNayinProfile } from '@core/bazi/nayinAnalysis';
import type { Pillars } from '@core/bazi/baziTypes';

const stems = [...'甲乙丙丁戊己庚辛壬癸'];
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];

test('十干相互十神符合五行循环和阴阳关系，覆盖全部一百组', () => {
  const families = [
    ['比肩', '劫财'],
    ['食神', '伤官'],
    ['偏财', '正财'],
    ['七杀', '正官'],
    ['偏印', '正印'],
  ];
  for (let day = 0; day < stems.length; day++) {
    const gods: string[] = [];
    for (let target = 0; target < stems.length; target++) {
      const relation = (Math.floor(target / 2) - Math.floor(day / 2) + 5) % 5;
      const expected = families[relation][day % 2 === target % 2 ? 0 : 1];
      const actual = getTenGod(stems[target], stems[day]);
      assert.equal(actual, expected, `${stems[day]}日见${stems[target]}`);
      gods.push(actual);
    }
    assert.equal(new Set(gods).size, 10, `${stems[day]}日十神应各出现一次`);
  }
});

test('十二长生按阳顺阴逆完整轮转，禄刃与对应阶段一致', () => {
  const birthBranches = [...'亥午寅酉寅酉巳子申卯'];
  const stages = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
  for (let index = 0; index < stems.length; index++) {
    const stem = stems[index];
    const start = branches.indexOf(birthBranches[index]);
    const direction = index % 2 === 0 ? 1 : -1;
    for (let step = 0; step < 12; step++) {
      const branch = branches[(start + direction * step + 12) % 12];
      assert.equal(TWELVE_STAGES_MAP[stem][branch], stages[step], `${stem}在${branch}`);
      if (step === 3) assert.equal(LU_BRANCH_MAP[stem], branch);
      if (step === 4 && direction === 1) assert.equal(REN_BRANCH_MAP[stem], branch);
    }
    if (direction === -1) assert.equal(REN_BRANCH_MAP[stem], undefined);
    assert.equal(Object.keys(TWELVE_STAGES_MAP[stem]).length, 12);
  }
});

test('六十甲子旬空恰为本旬十日未使用的两个地支', () => {
  for (let cycle = 0; cycle < 60; cycle++) {
    const start = Math.floor(cycle / 10) * 10;
    const occupied = new Set(Array.from({ length: 10 }, (_, day) => branches[(start + day) % 12]));
    const expected = branches.filter((branch) => !occupied.has(branch));
    const actual = calculateKongWangBranches(stems[cycle % 10], branches[cycle % 12]);
    assert.deepEqual([...actual].sort(), expected.sort());
    assert.equal(actual.length, 2);
  }
});

test('六十甲子纳音在基础与画像入口一致，并对照三命通会三十组取象', () => {
  // 《三命通会》卷一“论纳音取象”，每组连续两干支共用一个纳音。
  // https://zh.wikisource.org/zh-hans/三命通會/卷一
  const sounds = [
    '海中金',
    '炉中火',
    '大林木',
    '路旁土',
    '剑锋金',
    '山头火',
    '涧下水',
    '城头土',
    '白蜡金',
    '杨柳木',
    '井泉水',
    '屋上土',
    '霹雳火',
    '松柏木',
    '长流水',
    '砂中金',
    '山下火',
    '平地木',
    '壁上土',
    '金箔金',
    '覆灯火',
    '天河水',
    '大驿土',
    '钗钏金',
    '桑柘木',
    '大溪水',
    '砂中土',
    '天上火',
    '石榴木',
    '大海水',
  ];
  const canonicalSound = (value: string) =>
    value.replace('沙', '砂').replace('佛灯', '覆灯').replace('泉中', '井泉');
  for (let cycle = 0; cycle < 60; cycle++) {
    const gan = stems[cycle % 10];
    const zhi = branches[cycle % 12];
    const ganZhi = `${gan}${zhi}`;
    const row = { gan, zhi, ganZhi };
    const pillars: Pillars = { year: row, month: row, day: row, hour: row };
    const base = calculateNayin(pillars);
    const profile = analyzeNayinProfile([row, row, row, row]);
    const expected = sounds[Math.floor(cycle / 2)];
    for (const item of profile.items) {
      assert.equal(item.nayin, base[item.pillar as keyof Pillars]);
      assert.equal(canonicalSound(item.nayin), expected, ganZhi);
      assert.equal(item.element, expected.slice(-1));
    }
  }
});
