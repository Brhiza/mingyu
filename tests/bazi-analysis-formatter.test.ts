import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '@core/bazi/baziCalculator';
import { formatBaziForPrompt } from '@core/bazi/baziAnalysisFormatter';
import { analyzeShenShaWithTenGod } from '@core/bazi/baziShenSha/helpers/tenGodAnalysis';

test('命盘基础提示词默认不展开完整大运流年', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 8,
    day: 15,
    timeIndex: 6,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const text = formatBaziForPrompt(result);

  assert.doesNotMatch(text, /【大运】|大运总览:|含\d{4}-\d{4}年流年|当前大运:|近年流年:/);
});

test('核心判断只保留旺衰、格局和一条取用结论', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 8,
    day: 15,
    timeIndex: 8,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const text = formatBaziForPrompt(result);

  assert.match(text, /【核心判断】/);
  assert.match(text, /旺衰: /);
  assert.match(text, /格局: /);
  assert.match(text, /取用: 主用/);
  assert.match(text, /；忌/);
  assert.doesNotMatch(text, /旺衰[^\n]*得分|旺衰拆分:[^\n]*[+-]?\d/);
  assert.doesNotMatch(text, /旺衰依据:|格局依据:|喜忌五行:|喜忌十神:|十神归类:|取用脉络:|【五行】/);
});

test('八字提示词资料包应输出已计算出的传统节令与柱位证据', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 8,
    day: 15,
    timeIndex: 8,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const text = formatBaziForPrompt(result);

  assert.match(text, /出生历法: 阳历1995年8月15日 \| 农历/);
  assert.doesNotMatch(text, /星座:/);
  assert.match(text, /节令: 秋令 \| 立秋后7天 \| 距处暑8天/);
  assert.match(text, /月令旺相: 木死 火囚 土休 金旺 水相/);
  assert.match(text, /年柱: 乙亥[\s\S]*十二运: 绝/);
  assert.match(text, /月柱: 甲申[\s\S]*十二运: 病/);
  assert.match(text, /日柱: 戊寅[\s\S]*十二运: 长生/);
  assert.match(text, /时柱: 庚申[\s\S]*十二运: 病/);
  assert.doesNotMatch(text, /特殊宫位:|纳音|日主十二运:|旬空:/);
  assert.doesNotMatch(text, /自坐:/);
});

test('神煞互参文案应改为传统辅助提示，避免直接断语', () => {
  const peachKill = analyzeShenShaWithTenGod(['桃花'], '七杀').join('\n');
  const peachOfficer = analyzeShenShaWithTenGod(['桃花'], '正官').join('\n');
  const peachCompanion = analyzeShenShaWithTenGod(['桃花'], '比肩').join('\n');
  const peachWealth = analyzeShenShaWithTenGod(['桃花'], '偏财').join('\n');

  assert.match(peachKill, /传统多视为情感吸引与压力并见/);
  assert.match(peachOfficer, /传统多视为关系正式化/);
  assert.match(peachCompanion, /传统多视为社交竞争/);
  assert.match(peachWealth, /传统多视为人缘、合作往来或商业资源更易被带动/);

  assert.doesNotMatch(peachKill, /因色生灾/);
  assert.doesNotMatch(peachOfficer, /因妻致富/);
  assert.doesNotMatch(peachCompanion, /因色破财/);
});

test('八字提示词不默认展开神煞旁证', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 1,
    day: 8,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const text = formatBaziForPrompt(result);

  assert.doesNotMatch(text, /传统旁证:|传统互参:/);
  assert.doesNotMatch(text, /因色生灾|因妻致富|因色破财/);
});
