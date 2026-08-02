import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '@core/bazi/baziCalculator';
import { formatBaziForPrompt } from '@core/bazi/baziAnalysisFormatter';

test('核心判断依据会输出旺衰条件，待定时不伪造扶抑喜忌', () => {
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
  assert.match(text, /旺衰: 待综合判断/);
  assert.match(text, /用神: 自动规则尚未完成逐条校勘，取用待定/);
  assert.doesNotMatch(text, /用神: 主用|主忌|喜忌五行:|喜忌十神:|十神归类:/);
  assert.match(text, /【五行】\n出现:/);
  assert.doesNotMatch(text, /结构比较优先/);
  assert.doesNotMatch(text, /五行[\s\S]{0,80}\d+%/);
});

test('八字提示词应忽略旧缓存注入的完整用神与喜忌字段', () => {
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
  assert.equal('usefulGod' in result.analysis, false);
  Object.assign(result.analysis as unknown as Record<string, unknown>, {
    usefulGod: {
      favorable: [],
      unfavorable: [],
      useful: '正印',
      avoid: '七杀',
      primaryFavorableWuxing: '火',
      secondaryFavorableWuxing: ['木'],
      favorableWuxing: ['火', '木'],
      primaryUnfavorableWuxing: '水',
      secondaryUnfavorableWuxing: ['金'],
      unfavorableWuxing: ['水', '金'],
      primaryUseful: '正印',
      primaryAvoid: '七杀',
      primaryReason: '旧缓存取用结论',
      strategyTrace: ['旧缓存取用脉络'],
    },
  });

  const text = formatBaziForPrompt(result);

  assert.match(text, /用神: 自动规则尚未完成逐条校勘，取用待定/);
  assert.doesNotMatch(
    text,
    /主用火|主忌水|喜忌五行|喜忌十神|十神归类|旧缓存取用结论|旧缓存取用脉络/,
  );
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

test('八字新结果应省略未校神煞解释，并忽略旧缓存污染', () => {
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
  assert.equal('shenShaAnalysis' in result, false);
  Object.assign(result as unknown as Record<string, unknown>, {
    shenShaAnalysis: {
      year: ['旧缓存现实推断：事业必成'],
      month: ['旧缓存现实推断：婚恋有利'],
      day: ['旧缓存现实推断：贵人提携'],
      hour: ['旧缓存现实推断：外出求财'],
      global: ['旧缓存现实推断：必有机缘'],
    },
  });

  const text = formatBaziForPrompt(result);

  assert.ok(
    Object.values(result.shensha)
      .flat()
      .some((name) => name === '桃花'),
  );
  assert.doesNotMatch(text, /传统旁证|全局传统旁证|旧缓存现实推断/);
});
