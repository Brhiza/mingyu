import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateWuyunLiuqi } from '@core/wuyun-liuqi';

test('平气条件覆盖古今医统大全司天制运六年及同气相佐例', () => {
  for (const yearGanZhi of ['戊辰', '戊戌', '庚子', '庚午', '庚寅', '庚申']) {
    const result = calculateWuyunLiuqi({ yearGanZhi }).pathomechanism!;
    assert.equal(result.pingQiType, '具平气条件');
    assert.match(result.pingQiConditions.join('；'), /司天制约/);
    assert.match(result.pingQiBasis, yearGanZhi[0] === '戊' ? /升明之纪/ : /审平之纪/);
  }
  for (const yearGanZhi of ['辛亥', '癸巳']) {
    const result = calculateWuyunLiuqi({ yearGanZhi }).pathomechanism!;
    assert.match(result.pingQiConditions.join('；'), /同气相佐/);
  }
});

test('六十年逐一保留太过不及之纪并区别年层条件与实际平气', () => {
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const regimes = ['敦阜', '从革', '流衍', '委和', '赫曦', '卑监', '坚成', '涸流', '发生', '伏明'];
  const conditions = new Set(
    '戊辰 戊戌 庚子 庚午 庚寅 庚申 丁卯 己丑 己未 乙酉 辛丑 辛未 癸卯 癸酉 癸巳 癸亥 辛亥 乙卯 丁巳 丁亥 乙丑 乙未 辛卯 辛酉'.split(
      ' ',
    ),
  );
  for (let i = 0; i < 60; i++) {
    const yearGanZhi = stems[i % 10] + branches[i % 12];
    const result = calculateWuyunLiuqi({ yearGanZhi }).pathomechanism!;
    assert.equal(result.isPingQi, null, yearGanZhi);
    assert.equal(result.movementRegime, `${regimes[i % 10]}之纪`, yearGanZhi);
    assert.equal(result.pingQiConditions.length > 0, conditions.has(yearGanZhi), yearGanZhi);
  }
});

test('运气要诀不及得助包含司天同气及相生，太过同气不混作资助', () => {
  for (const yearGanZhi of ['乙卯', '乙酉', '丁巳', '丁亥', '己丑', '己未']) {
    const result = calculateWuyunLiuqi({ yearGanZhi }).pathomechanism!;
    assert.match(result.pingQiConditions.join('；'), /司天与.运同气，资助岁运不及/);
    assert.equal(result.isPingQi, null);
  }
  for (const yearGanZhi of ['乙丑', '乙未', '辛卯', '辛酉', '癸巳', '癸亥']) {
    const result = calculateWuyunLiuqi({ yearGanZhi }).pathomechanism!;
    assert.match(result.pingQiConditions.join('；'), /司天生.运，资助岁运不及/);
    assert.equal(result.isPingQi, null);
  }
  for (const yearGanZhi of ['丙辰', '丙戌', '戊子', '戊午', '戊寅', '戊申']) {
    assert.doesNotMatch(
      calculateWuyunLiuqi({ yearGanZhi }).pathomechanism!.pingQiConditions.join('；'),
      /资助岁运不及/,
    );
  }
});
