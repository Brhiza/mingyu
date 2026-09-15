import assert from 'node:assert/strict';
import test from 'node:test';

import { generateDivinationSession } from '../packages/core/src/divination/session';
import type { LiurenData, TaiyiResult } from '../packages/core/src/types/divination';

test('六壬 aiPrompt 应保留取传与课体判断依据', () => {
  const session = generateDivinationSession({
    method: 'liuren',
    question: '验证六壬判断依据传播',
    divinationTime: '2024-01-02T12:00:00+08:00',
    currentTime: '2024-01-02T12:00:00+08:00',
  });
  const data = session.data as LiurenData;
  const classicalRules = data.classicalRules ?? [];
  const guaTiFacts = data.guaTiFacts ?? [];

  assert.ok(data.transmissionRule);
  assert.ok(data.transmissionDetail);
  assert.ok(classicalRules.length > 0);
  assert.ok(guaTiFacts.length > 0);
  assert.match(session.aiPrompt, /六壬判断依据：/);
  assert.ok(session.aiPrompt.includes('取传说明：取传采用'));
  assert.ok(session.aiPrompt.includes(data.transmissionRule));
  for (const rule of classicalRules) {
    assert.ok(session.aiPrompt.includes(rule.summary));
  }
  for (const fact of guaTiFacts) {
    assert.ok(fact.matchedConditions.length > 0);
    for (const condition of fact.matchedConditions) {
      assert.ok(session.aiPrompt.includes(condition));
    }
  }
  for (const item of data.focusEvidence ?? []) {
    for (const evidence of item.evidence.filter(Boolean)) {
      assert.ok(session.aiPrompt.includes(evidence));
    }
  }
  for (const evidence of data.timingEvidence ?? []) {
    if (evidence) assert.ok(session.aiPrompt.includes(evidence));
  }
  for (const lesson of data.fourLessons) {
    assert.ok(
      session.aiPrompt.includes(`${lesson.name}${lesson.upper}临${lesson.lower}乘${lesson.god}`),
    );
  }
  for (const transmission of data.threeTransmissions) {
    assert.ok(
      session.aiPrompt.includes(`${transmission.stage}${transmission.branch}乘${transmission.god}`),
    );
  }
  assert.doesNotMatch(session.aiPrompt, /古籍依据依次为：|sourceUrl|evidenceAnalysis/);
});

test('太乙 aiPrompt 应保留三门、五将与阴阳和判断条件', () => {
  const session = generateDivinationSession({
    method: 'taiyi',
    question: '验证太乙判断条件传播',
    taiyi: { scope: 'year', year: 2024 },
    currentTime: '2024-01-01T12:00:00+08:00',
  });
  const data = session.data as TaiyiResult;

  assert.match(session.aiPrompt, /太乙判断依据：/);
  assert.ok(session.aiPrompt.includes(`三门：${data.conditions.threeGates.status}`));
  assert.ok(
    session.aiPrompt.includes(`五将：${data.conditions.fiveGenerals.launched ? '发' : '不发'}`),
  );
  assert.ok(
    session.aiPrompt.includes(`阴阳和：${data.conditions.yinYangHarmony.matched ? '和' : '不和'}`),
  );
  assert.ok(session.aiPrompt.includes(`主大将${data.lordGeneral}宫`));
  assert.ok(
    session.aiPrompt.includes(
      `主客五行：${data.conditions.fiveGenerals.hostGuestElementRelation.relation}`,
    ),
  );
  assert.doesNotMatch(session.aiPrompt, /sourceUrl|evidenceAnalysis|https?:\/\//);
});
