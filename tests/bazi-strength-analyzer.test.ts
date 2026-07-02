import test from 'node:test';
import assert from 'node:assert/strict';

import {
  analyzeConstraint,
  analyzeDayMasterStrength,
  analyzeFormation,
  analyzeSupport,
} from '../src/utils/bazi/baziStrengthAnalyzer';

test('无根失令但仍有帮扶时，不应直接判为极弱', () => {
  const result = analyzeDayMasterStrength(
    { status: '休', score: 0, isTimely: false },
    { formations: [], totalStrength: 0 },
    { roots: [], totalStrength: 0, hasRoot: false, strongRoot: false },
    {
      supporters: [{ position: 'hour', stem: '丁', strength: 1 }],
      totalStrength: 1,
      hasSupport: true,
    },
    { constraints: [], totalStrength: 0, hasConstraint: false },
  );

  assert.equal(result.status, '身弱');
  assert.equal(result.score, 1);
  assert.equal(result.details.supportStrength, 1);
});

test('无根失令且无帮扶时，仍应判为极弱', () => {
  const result = analyzeDayMasterStrength(
    { status: '休', score: 0, isTimely: false },
    { formations: [], totalStrength: 0 },
    { roots: [], totalStrength: 0, hasRoot: false, strongRoot: false },
    { supporters: [], totalStrength: 0, hasSupport: false },
    { constraints: [], totalStrength: 0, hasConstraint: false },
  );

  assert.equal(result.status, '极弱');
  assert.equal(result.score, 0);
});

test('印星落在地支主气或藏干时，也应计入帮扶，但不应把主气与同支本气重复计分', () => {
  const result = analyzeSupport(
    '甲',
    {
      year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
      day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
      hour: { gan: '戊', zhi: '亥', ganZhi: '戊亥' },
    },
    {
      year: ['庚', '壬', '戊'],
      month: ['辛'],
      day: ['丁', '己'],
      hour: ['壬', '甲'],
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );

  assert.equal(result.hasSupport, true);
  assert.equal(result.totalStrength, 1.5);
  assert.ok(result.supporters.some((item) => item.stem === '申(壬)'));
  assert.ok(result.supporters.some((item) => item.stem === '亥'));
  assert.ok(!result.supporters.some((item) => item.stem === '亥(壬)'));
});

test('日支印星应计入帮扶，但日干自身不应重复计入', () => {
  const result = analyzeSupport(
    '甲',
    {
      year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
      day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      hour: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    },
    {
      year: ['庚', '壬', '戊'],
      month: ['辛'],
      day: ['癸'],
      hour: ['丁', '己'],
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );

  assert.equal(result.hasSupport, true);
  assert.equal(result.totalStrength, 1.5);
  assert.ok(result.supporters.some((item) => item.position === 'day' && item.stem === '子'));
  assert.ok(result.supporters.some((item) => item.stem === '申(壬)'));
  assert.ok(!result.supporters.some((item) => item.position === 'day' && item.stem === '甲'));
  assert.ok(!result.supporters.some((item) => item.stem === '子(癸)'));
});

test('极强判断不能无视克泄耗重压', () => {
  const result = analyzeDayMasterStrength(
    { status: '旺', score: 4, isTimely: true },
    { formations: [], totalStrength: 0 },
    {
      roots: [
        { position: 'month', branch: '寅', strength: 2 },
        { position: 'day', branch: '卯', strength: 2 },
      ],
      totalStrength: 4,
      hasRoot: true,
      strongRoot: true,
    },
    { supporters: [], totalStrength: 0, hasSupport: false },
    {
      constraints: [
        { position: 'year', stem: '庚', strength: 1.6 },
        { position: 'hour', stem: '辛', strength: 1.6 },
        { position: 'year', stem: '申', strength: 1.6 },
      ],
      totalStrength: 4.8,
      hasConstraint: true,
    },
  );

  assert.notEqual(result.status, '极强');
  assert.ok(result.details.constraintStrength > 0);
});

test('三合三会成局时，旺衰评分应额外计入成局助势，而不是只按单个地支零散计数', () => {
  const result = analyzeFormation(
    '甲',
    {
      year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
      month: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
      day: { gan: '甲', zhi: '未', ganZhi: '甲未' },
      hour: { gan: '甲', zhi: '亥', ganZhi: '甲亥' },
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );

  assert.equal(result.formations.length, 1);
  assert.equal(result.formations[0]?.type, '三合');
  assert.equal(result.formations[0]?.effect, '助身');
  assert.ok(result.totalStrength > 0);
});

test('克泄耗一方三合成局时，旺衰评分也应计入成局破势，不应仍按普通身弱看待', () => {
  const formation = analyzeFormation(
    '甲',
    {
      year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
      month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
      day: { gan: '甲', zhi: '巳', ganZhi: '甲巳' },
      hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );
  const result = analyzeDayMasterStrength(
    { status: '休', score: 0, isTimely: false },
    formation,
    { roots: [], totalStrength: 0, hasRoot: false, strongRoot: false },
    {
      supporters: [{ position: 'month', stem: '己', strength: 1 }],
      totalStrength: 1,
      hasSupport: true,
    },
    { constraints: [], totalStrength: 0, hasConstraint: false },
  );

  assert.ok(formation.totalStrength < 0);
  assert.ok(result.details.formationStrength < 0);
  assert.equal(result.status, '极弱');
});

test('财官食伤在天干地支成势时，也应计入克泄耗', () => {
  const result = analyzeConstraint(
    '甲',
    {
      year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
      day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
      hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    },
    {
      year: ['庚', '壬', '戊'],
      month: ['丁', '己'],
      day: ['甲', '丙', '戊'],
      hour: ['戊', '乙', '癸'],
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );

  assert.equal(result.hasConstraint, true);
  assert.ok(result.totalStrength > 0);
  assert.ok(result.constraints.some((item) => item.stem === '庚'));
  assert.ok(result.constraints.some((item) => item.stem === '申'));
  assert.ok(result.constraints.some((item) => item.stem === '午'));
  assert.ok(result.constraints.some((item) => item.stem === '戊'));
});

test('克泄耗统计不应把地支主气与同支本气藏干重复计入', () => {
  const result = analyzeConstraint(
    '甲',
    {
      year: { gan: '壬', zhi: '申', ganZhi: '壬申' },
      month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
      day: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
      hour: { gan: '己', zhi: '酉', ganZhi: '己酉' },
    },
    {
      year: ['庚', '壬', '戊'],
      month: ['丁', '己'],
      day: ['甲', '丙', '戊'],
      hour: ['辛'],
    },
    (value) => {
      const map: Record<string, '木' | '火' | '土' | '金' | '水'> = {
        甲: '木',
        乙: '木',
        寅: '木',
        卯: '木',
        丙: '火',
        丁: '火',
        巳: '火',
        午: '火',
        戊: '土',
        己: '土',
        辰: '土',
        戌: '土',
        丑: '土',
        未: '土',
        庚: '金',
        辛: '金',
        申: '金',
        酉: '金',
        壬: '水',
        癸: '水',
        子: '水',
        亥: '水',
      };

      return map[value];
    },
  );

  assert.ok(result.constraints.some((item) => item.stem === '申'));
  assert.ok(result.constraints.some((item) => item.stem === '酉'));
  assert.ok(!result.constraints.some((item) => item.stem === '申(庚)'));
  assert.ok(!result.constraints.some((item) => item.stem === '酉(辛)'));
});
