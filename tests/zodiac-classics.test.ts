import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPromptHasAnswerFramework,
  assertPromptIsPortableTaskText,
} from './prompt-assertions';
import {
  calculateZodiacYearFortune,
  getZodiacYearFortune,
} from '../packages/core/src/zodiac/index.ts';

const stems = [...'甲乙丙丁戊己庚辛壬癸'];
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const animals = [...'鼠牛虎兔龙蛇马羊猴鸡狗猪'];
const hasPair = (pairs: string[], a: string, b: string) =>
  pairs.includes(a + b) || pairs.includes(b + a);

test('生肖六十流年七百二十组合保留全部刑冲害破与合会关系', () => {
  const chong = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
  const hai = ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'];
  const po = ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌'];
  const xing = [
    '子卯',
    '寅巳',
    '巳申',
    '申寅',
    '丑戌',
    '戌未',
    '未丑',
    '辰辰',
    '午午',
    '酉酉',
    '亥亥',
  ];
  const he = ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'];
  const sanhe = ['申子辰', '亥卯未', '寅午戌', '巳酉丑'];
  const sanhui = ['寅卯辰', '巳午未', '申酉戌', '亥子丑'];
  for (let cycle = 0; cycle < 60; cycle++) {
    const yearGanZhi = stems[cycle % 10] + branches[cycle % 12];
    const yearBranch = branches[cycle % 12];
    for (let i = 0; i < 12; i++) {
      const branch = branches[i];
      const result = getZodiacYearFortune(branch, yearGanZhi);
      const expected = [
        branch === yearBranch ? '值太岁' : '',
        hasPair(chong, branch, yearBranch) ? '冲太岁' : '',
        hasPair(xing, branch, yearBranch) ? '刑太岁' : '',
        hasPair(hai, branch, yearBranch) ? '害太岁' : '',
        hasPair(po, branch, yearBranch) ? '破太岁' : '',
      ].filter(Boolean);
      assert.equal(result.zodiac, animals[i]);
      assert.deepEqual(
        result.conflicts.map((item) => item.type),
        expected,
        `${branch}/${yearGanZhi}`,
      );
      assert.ok(result.conflicts.every((item) => item.with === yearBranch));
      const hasNoble =
        hasPair(he, branch, yearBranch) ||
        (branch !== yearBranch &&
          sanhe.some((group) => group.includes(branch) && group.includes(yearBranch)));
      assert.equal(result.noble !== null, hasNoble);
      assert.equal(
        result.meeting !== null,
        branch !== yearBranch &&
          sanhui.some((group) => group.includes(branch) && group.includes(yearBranch)),
      );
      assert.ok(result.prompt.includes(yearGanZhi));
      assert.match(result.prompt, /【任务】[\s\S]*【生肖与流年关系简析】/);
      assert.equal(result.prompt.match(/^【任务】$/gm)?.length, 1);
      assertPromptHasAnswerFramework(result.prompt);
      assertPromptIsPortableTaskText(result.prompt);
      assert.doesNotMatch(result.prompt, /证据链完整|结构化类型|证据汇总|来源：|MCP|API/);
      assert.equal(result.interpretationBoundary, '仅限生肖与流年关系');
    }
  }
});

test('生肖公历流年按甲子锚点循环且名称与地支入口一致', () => {
  for (let year = 1900; year <= 2200; year++) {
    const cycle = (((year - 1984) % 60) + 60) % 60;
    const expected = stems[cycle % 10] + branches[cycle % 12];
    assert.equal(calculateZodiacYearFortune({ zodiac: '鼠', year }).yearGanZhi, expected);
  }
  for (let i = 0; i < 12; i++) {
    assert.deepEqual(
      calculateZodiacYearFortune({ zodiac: animals[i], yearGanZhi: '丙午' }),
      getZodiacYearFortune(branches[i], '丙午'),
    );
  }
});
