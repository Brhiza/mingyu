import test from 'node:test';
import assert from 'node:assert/strict';
import { getHuangliDayGods } from '../packages/core/src/shensha';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';

test('四季七神及九空五墓按古籍覆盖全部月日组合', () => {
  // 《协纪辨方书》最终从历神原始校正：春辰夏未秋戌冬丑为守日。
  // https://www.shidianguji.com/zh/mid-page/7430936675263709234
  // https://www.shidianguji.com/zh/mid-page/7430936675263692850
  // https://www.shidianguji.com/zh/book/CADAL01021280/chapter/1lmtiwd6bv5e1
  const seasonTables = {
    时德: ['午', '辰', '子', '寅'],
    王日: ['寅', '巳', '申', '亥'],
    官日: ['卯', '午', '酉', '子'],
    守日: ['辰', '未', '戌', '丑'],
    相日: ['巳', '申', '亥', '寅'],
    民日: ['午', '酉', '子', '卯'],
    四击: ['戌', '丑', '辰', '未'],
  };
  const nineVoid = [...'辰丑戌未辰丑戌未辰丑戌未'];
  const fiveTombs = [
    '乙未',
    '乙未',
    '戊辰',
    '丙戌',
    '丙戌',
    '戊辰',
    '辛丑',
    '辛丑',
    '戊辰',
    '壬辰',
    '壬辰',
    '戊辰',
  ];
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const pillar = (index: number) => stems[index % 10] + branches[index % 12];
  for (let month = 0; month < 12; month++)
    for (let day = 0; day < 60; day++) {
      const names = getHuangliDayGods(pillar(month + 2), pillar(day)).map((god) => god.getName());
      const label = `${month + 1}月/${pillar(day)}`;
      for (const [name, targets] of Object.entries(seasonTables)) {
        assert.equal(
          names.includes(name),
          targets[Math.floor(month / 3)] === branches[day % 12],
          `${label}/${name}`,
        );
      }
      assert.equal(names.includes('九空'), nineVoid[month] === branches[day % 12], `${label}/九空`);
      assert.equal(names.includes('五墓'), fiveTombs[month] === pillar(day), `${label}/五墓`);
    }
});

test('亥月己丑日保留守日九空并去除时德相日误列', () => {
  const day = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2026-11-11',
    endDate: '2026-11-11',
  }).days[0];
  assert.ok(day.gods.includes('守日'));
  assert.ok(day.gods.includes('九空'));
  assert.equal(day.gods.includes('时德'), false);
  assert.equal(day.gods.includes('相日'), false);
  assert.equal(day.godFacts?.find((fact) => fact.name === '守日')?.classification, '吉神');
  assert.equal(day.godFacts?.find((fact) => fact.name === '九空')?.classification, '凶神');
});
