import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '@core/bazi/baziCalculator';
import { formatBaziForPrompt } from '@core/bazi/baziAnalysisFormatter';
import { analyzeShenShaWithTenGod } from '@core/bazi/baziShenSha/helpers/tenGodAnalysis';

test('命盘基础资料只输出命盘内的大运范围，不按系统当前年裁剪流年', () => {
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

  assert.match(text, /大运总览:/);
  assert.match(text, /含\d{4}-\d{4}年流年/);
  assert.doesNotMatch(text, /当前大运:|近年流年:/);
});

test('核心判断依据会输出旺衰条件与十神归类，不把内部权重外显为吉凶分', () => {
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

  assert.match(text, /【核心判断依据】/);
  assert.match(text, /旺衰依据: 月令.+ \| 司令.+ \| 成局.+ \| 通根.+ \| 帮扶.+ \| 克泄耗.+/);
  assert.doesNotMatch(text, /旺衰[^\n]*得分|旺衰拆分:[^\n]*[+-]?\d/);
  assert.match(text, /格局依据: /);
  assert.match(text, /用神: 主用/);
  assert.match(text, /主忌/);
  assert.match(text, /喜忌五行:/);
  assert.match(text, /喜忌十神:/);
  assert.match(text, /十神归类: 喜/);
  assert.match(text, /十神归类: 喜(比劫|食伤|财星|官杀|印星)/);
  assert.match(text, /忌(比劫|食伤|财星|官杀|印星)/);
  assert.doesNotMatch(text, /十神归类: 喜(正印|偏印|正官|七杀|正财|偏财|食神|伤官|比肩|劫财) /);
  assert.doesNotMatch(text, /忌(正印|偏印|正官|七杀|正财|偏财|食神|伤官|比肩|劫财)\n/);
  assert.match(text, /出现:.+ \| 结构比较优先:/);
  assert.doesNotMatch(text, /五行[\s\S]{0,80}\d+%/);
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
  assert.match(text, /特殊宫位: 命卦:坎1\(东四命\)/);
  assert.match(text, /特殊宫位: .*胎息:癸亥/);
  assert.match(text, /年柱: 乙亥[\s\S]*日主十二运: 绝 \| 旬空: 申酉/);
  assert.match(text, /月柱: 甲申[\s\S]*日主十二运: 病 \| 旬空: 午未/);
  assert.match(text, /日柱: 戊寅[\s\S]*日主十二运: 长生 \| 旬空: 申酉/);
  assert.match(text, /时柱: 庚申[\s\S]*日主十二运: 病 \| 旬空: 子丑/);
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

test('八字提示词资料包中的神煞互参应明确降级为传统旁证并避免强断语', () => {
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

  assert.match(
    text,
    /^\s{2}传统旁证: 桃花逢财星，传统多视为人缘、合作往来或商业资源更易被带动。$/m,
  );
  assert.doesNotMatch(text, /^\s{2}传统互参:/m);
  assert.doesNotMatch(text, /因色生灾|因妻致富|因色破财/);
});
