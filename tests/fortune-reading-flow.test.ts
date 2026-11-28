import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../src/core';
import {
  DAILY_HEXAGRAM_DIRECTIONS,
  DAILY_HEXAGRAM_DIRECTION_KEYS,
} from '../src/systems/daily-hexagram-directions';
import { applyGlobalRulesToPayload } from '../src/web-settings';
import {
  buildFortuneDecisionFlow,
  computeSevenDayRhythm,
  type FortuneFlowInput,
} from '../src/systems/fortune/reading-flow';

test('computeSevenDayRhythm returns 7 consecutive days with valid status & tone', () => {
  const days = computeSevenDayRhythm(2026, 11, 28, {
    dayMaster: '甲',
    favorableWuxing: ['水', '木'],
    unfavorableWuxing: ['金'],
  });

  assert.equal(days.length, 7);
  assert.equal(days[0]?.title, '明天');
  assert.equal(days[0]?.dateKey, '2026-11-29');
  assert.equal(days[6]?.dateKey, '2026-12-05');
  for (const item of days) {
    assert.ok(['good', 'neutral', 'caution'].includes(item.tone));
    assert.ok(['偏顺', '平稳', '宜稳'].includes(item.status));
    assert.ok(item.focus.length > 4);
  }
});

test('buildFortuneDecisionFlow groups daily windows and deduplicates headline phrases', () => {
  const sample: FortuneFlowInput = {
    scope: 'daily',
    mode: 'general',
    calendar: {
      year: 2026,
      month: 11,
      day: 28,
      ganzhi: { year: '丙午', month: '己亥', day: '甲辰' },
    },
    overview: {
      overallScore: 81,
      overallTier: '畅达',
      headline: '今日宜收放自如，核心事宜适合上午优先推进。',
      scoreFactors: [
        {
          label: '青龙值日',
          category: 'calendar',
          impact: 6,
          sentiment: 'positive',
          detail: '黄道主事，推动新事项阻力较小。',
        },
        {
          label: '辰戌暗冲',
          category: 'branch',
          impact: -4,
          sentiment: 'caution',
          detail: '晚间沟通容易急躁，涉及合约多核对一次。',
        },
      ],
      dimensions: [
        { id: 'career', label: '事业', score: 86, trend: '旺', summary: '今日宜收放自如，核心事宜适合上午优先推进。' },
        { id: 'wealth', label: '财运', score: 78, trend: '平', summary: '正财稳当，偏财先观望。' },
        { id: 'love', label: '感情', score: 74, trend: '平', summary: '坦诚交流可减少误解。' },
        { id: 'health', label: '身心', score: 66, trend: '谨', summary: '注意用眼与晚间休息节奏。' },
      ],
      actionGuide: {
        suitable: ['签约', '规划', '会友'],
        caution: ['熬夜', '大额冲动消费'],
        luckyElements: {
          wuxing: ['水', '木'],
          colors: ['青蓝', '墨绿'],
          directions: ['正北', '正东'],
          hours: ['巳时', '午时'],
        },
      },
    },
    timeline: {
      hours: [
        { name: '辰时', range: '07:00-09:00', ganzhi: '戊辰', twelveStar: '司命', rating: '平', note: '整理待办' },
        { name: '巳时', range: '09:00-11:00', ganzhi: '己巳', twelveStar: '青龙', rating: '吉', note: '宜对接重点' },
        { name: '午时', range: '11:00-13:00', ganzhi: '庚午', twelveStar: '明堂', rating: '吉', note: '宜决策敲定' },
        { name: '戌时', range: '19:00-21:00', ganzhi: '甲戌', twelveStar: '天刑', rating: '慎', note: '避免争执' },
      ],
    },
  };

  const flow = buildFortuneDecisionFlow(sample, { isCurrentTarget: true });
  assert.equal(flow.actionTitle, '今天先做什么');
  assert.equal(flow.actions.length, 3);
  assert.deepEqual(flow.actions.map((a) => a.badge), ['先', '辅', '查']);
  assert.ok(!flow.actions[0]!.detail.includes('今日宜收放自如，核心事宜适合上午优先推进。'));
  assert.ok(flow.keyWindows.some((w) => w.tone === 'good' && w.label === '巳时–午时' && w.range === '09:00–13:00'));
  assert.ok(flow.keyWindows.some((w) => w.tone === 'caution' && w.label.includes('戌时')));
  assert.equal(flow.rhythmCards.length, 7);
  assert.equal(flow.evidenceGroups.support[0]?.label, '青龙值日');
  assert.equal(flow.evidenceGroups.caution[0]?.label, '辰戌暗冲');
});

test('buildFortuneDecisionFlow synthesizes monthly weekly rhythm and yearly seasonal rhythm', () => {
  const monthly = buildFortuneDecisionFlow(
    {
      scope: 'monthly',
      calendar: { year: 2026, month: 11, day: 1, ganzhi: { year: '丙午', month: '己亥', day: '丙子' } },
      overview: {
        overallScore: 76,
        overallTier: '平稳',
        headline: '本月前稳后进。',
        scoreFactors: [],
        dimensions: [
          { id: 'career', label: '事业', score: 80, trend: '旺', summary: '团队协作为主。' },
          { id: 'wealth', label: '财运', score: 70, trend: '平', summary: '预算先行。' },
        ],
        actionGuide: {
          suitable: ['复盘'],
          caution: ['盲目扩张'],
          luckyElements: { wuxing: ['木'], colors: ['青绿'], directions: ['东'] },
        },
      },
      timeline: {
        days: Array.from({ length: 14 }, (_, i) => ({
          date: `2026-11-${String(i + 1).padStart(2, '0')}`,
          day: i + 1,
          weekday: '周一',
          lunarDate: '十月',
          dayGanZhi: '甲子',
          score: i < 7 ? 80 : 62,
          rating: i < 7 ? '优选' : '慎用',
          tag: i < 7 ? '签约' : '休整',
        })),
      },
    },
    { isCurrentTarget: false },
  );

  assert.equal(monthly.actionTitle, '该月先做什么');
  assert.equal(monthly.rhythmTitle, '该月分周节奏');
  assert.equal(monthly.rhythmCards.length, 2);
  assert.equal(monthly.rhythmCards[0]?.tone, 'good');
  assert.equal(monthly.rhythmCards[1]?.tone, 'caution');

  const yearly = buildFortuneDecisionFlow(
    {
      scope: 'yearly',
      calendar: { year: 2026, month: 1, day: 1, ganzhi: { year: '丙午', month: '己丑', day: '甲子' } },
      overview: {
        overallScore: 79,
        overallTier: '畅达',
        headline: '全年先夯实根基。',
        scoreFactors: [],
        dimensions: [{ id: 'career', label: '事业', score: 82, trend: '旺', summary: '主线明朗。' }],
        actionGuide: {
          suitable: ['蓄力'],
          caution: ['急躁'],
          luckyElements: { wuxing: ['水'], colors: ['黑'], directions: ['北'] },
        },
      },
      timeline: {
        months: Array.from({ length: 12 }, (_, idx) => ({
          monthIndex: idx + 1,
          jieName: `节${idx + 1}`,
          startDate: `2026-${String(idx + 1).padStart(2, '0')}-05`,
          endDate: `2026-${String(idx + 1).padStart(2, '0')}-28`,
          monthGanZhi: '甲寅',
          score: idx < 3 ? 82 : 70,
          trend: idx < 3 ? '旺' : '平',
          note: '稳步推进',
        })),
      },
    },
    { isCurrentTarget: true },
  );

  assert.equal(yearly.actionTitle, '今年先做什么');
  assert.equal(yearly.rhythmTitle, '今年四季节奏');
  assert.equal(yearly.rhythmCards.length, 4);
  assert.equal(yearly.rhythmCards[0]?.tone, 'good');
});

test('DailyHexagramCard liuyao coins payload passes calculate and maps to 8 daily directions', async () => {
  const payload = applyGlobalRulesToPayload(
    'liuyao',
    {
      question: '今日行动指引与吉凶注意事项？',
      liuyao: { method: 'coins' },
      prompt: { includeClassics: false },
    },
    true,
  );
  const res = (await calculate('liuyao', payload)) as {
    data: { originalName: string; changedName?: string; palace?: { name?: string } };
    prompt: { text: string };
  };
  const originalName = res.data.originalName;
  assert.ok(originalName.length > 0);
  const directions = DAILY_HEXAGRAM_DIRECTIONS[originalName];
  assert.ok(directions, `Missing daily directions for hexagram ${originalName}`);
  for (const key of DAILY_HEXAGRAM_DIRECTION_KEYS) {
    assert.ok(typeof directions[key] === 'string' && directions[key].trim().length > 0);
  }
  assert.ok(res.prompt.text.trim().length > 0);
});
