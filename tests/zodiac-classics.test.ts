import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPromptHasAnswerFramework,
  assertPromptIsPortableTaskText,
} from './prompt-assertions';
import {
  calculateZodiacYearFortune,
  getZodiacYearFortune,
  getYearTaiSui,
} from '../packages/core/src/zodiac/index.ts';
import { buildMetaphysicsPrompt } from '@core/prompt';

const stems = [...'甲乙丙丁戊己庚辛壬癸'];
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const animals = [...'鼠牛虎兔龙蛇马羊猴鸡狗猪'];
const hasPair = (pairs: string[], a: string, b: string) =>
  pairs.includes(a + b) || pairs.includes(b + a);
const matrixFixtures = new Map<string, ReturnType<typeof getZodiacYearFortune>>();

function getMatrixFixture(branch: string, yearGanZhi: string) {
  return matrixFixtures.get(`${branch}/${yearGanZhi}`) ?? getZodiacYearFortune(branch, yearGanZhi);
}

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
      if (branch === '子' && (yearGanZhi === '丙午' || yearGanZhi === '丙寅')) {
        matrixFixtures.set(`${branch}/${yearGanZhi}`, result);
      }
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
      assert.ok(
        result.conflicts.every(
          (item) =>
            item.desc.includes(`生肖年支${branch}与流年年支${yearBranch}`) &&
            item.desc.endsWith(`传统分类为${item.type}。`),
        ),
      );
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
      assert.doesNotMatch(result.prompt, /十神|出生日干/);
      assert.match(result.prompt, /五行关系：流年年干.*生肖地支/);
      if (result.noble?.startsWith('三合组成员关系')) {
        const group = sanhe.find(
          (members) => members.includes(branch) && members.includes(yearBranch),
        )!;
        const missing = [...group].find((member) => member !== branch && member !== yearBranch);
        assert.ok(
          result.prompt.includes(`三合组成员：生肖年支${branch}与流年年支${yearBranch}同属`),
        );
        assert.ok(
          result.prompt.includes(`另一成员为${missing}，三支齐备及成化条件结合完整命盘核验`),
        );
      }
      if (result.meeting) {
        const group = sanhui.find(
          (members) => members.includes(branch) && members.includes(yearBranch),
        )!;
        const missing = [...group].find((member) => member !== branch && member !== yearBranch);
        assert.ok(
          result.prompt.includes(
            `三会组成员：${[...group].join('、')}为一组，本次可见${branch}、${yearBranch}两支；另一成员${missing}`,
          ),
        );
      }
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
    const expected =
      branches[i] === '子'
        ? getMatrixFixture(branches[i], '丙午')
        : getZodiacYearFortune(branches[i], '丙午');
    assert.deepEqual(
      calculateZodiacYearFortune({ zodiac: animals[i], yearGanZhi: '丙午' }),
      expected,
    );
  }
});

test('丁卯值年太岁星君应使用常见名沉兴', () => {
  // 道教总庙三清宫“六十甲子太岁星君名称”列丁卯太岁沉兴大将军。
  // https://www.sanching.org.tw/me70
  assert.deepEqual(getYearTaiSui('丁卯'), { yearBranch: '卯', star: '沉兴' });
});

test('生肖提示词只列实际命中的太岁关系', () => {
  const noConflict = getMatrixFixture('子', '丙寅');
  assert.deepEqual(noConflict.conflicts, []);
  assert.doesNotMatch(noConflict.prompt, /太岁关系：|未命中值、冲、刑、害、破|信息范围：/);
  assert.doesNotMatch(noConflict.prompt, /参与关系的资料：/);

  const conflict = getMatrixFixture('子', '丙午');
  assert.deepEqual(
    conflict.conflicts.map((item) => item.type),
    ['冲太岁'],
  );
  assert.match(conflict.prompt, /太岁关系：冲太岁（生肖年支子与流年年支午相冲）/);
});

test('生肖流年描述只列传统关系类别，提示词要求结合资料核对条件', () => {
  const result = getMatrixFixture('子', '丙午');
  assert.equal(result.conflicts.length, 1);
  assert.match(result.conflicts[0].desc, /生肖年支子与流年年支午命中六冲，传统分类为冲太岁/);
  assert.doesNotMatch(result.conflicts[0].desc, /象征|主题|容易增加|容易出现|值得留意/);
  assert.match(result.riskRelations[0], /命中六冲/);

  const prompt = buildMetaphysicsPrompt(result.prompt, '今年的关系如何理解？', {
    method: 'zodiac',
    schools: ['ganzhi', 'sanhe'],
  });
  assert.match(prompt, /实际命中的.*五行关系和参与条件/);
  assert.match(prompt, /结合问题与已提供资料核对适用条件/);
  assert.equal(prompt.split('资料不足则说明待核对项').length - 1, 1);
  assert.doesNotMatch(prompt, /形成年度判断|观察助力、牵制与环境变化/);
  assert.doesNotMatch(
    prompt,
    /象义|象征.*主题|容易增加|容易出现|规则、责任|合作破损|环境变化与自我要求/,
  );
});
