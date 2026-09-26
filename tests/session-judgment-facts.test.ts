import assert from 'node:assert/strict';
import test from 'node:test';

import { generateDivinationSession } from '../packages/core/src/divination/session';
import { formatTaiyiConditionSummary } from '../packages/core/src/taiyi';
import type { LiurenData, TaiyiResult } from '../packages/core/src/types/divination';

test('小六壬在线解读保留农历取数、口径与占得宫歌诀', () => {
  for (const rule of ['common', 'duoneng'] as const) {
    const session = generateDivinationSession({
      method: 'xiaoliuren',
      question: '核对时间起课',
      xiaoliuren: { rule },
      divinationTime: '2024-02-05T00:30:00+08:00',
      currentTime: '2024-02-05T00:30:00+08:00',
    });
    assert.match(session.aiPrompt, /农历12月26日/);
    assert.match(session.aiPrompt, /定月宫：12月从大安顺数/);
    assert.match(session.aiPrompt, /定日宫：从月宫/);
    assert.match(session.aiPrompt, /定时宫：从日宫/);
    assert.match(session.aiPrompt, /歌诀原文：/);
    assert.match(session.aiPrompt, /东八区民用日零点换日/);
    assert.match(session.aiPrompt, /闰月沿用同名月序/);
    assert.doesNotMatch(session.aiPrompt, /evidenceAnalysis|monthSeed|schemaVersion|资料来源/);
  }
});

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
    assert.ok(session.aiPrompt.includes(`，${item.level}：`));
    for (const evidence of item.evidence.filter(Boolean)) {
      assert.ok(session.aiPrompt.includes(evidence));
    }
    for (const limitation of item.limitations) {
      assert.ok(session.aiPrompt.includes(limitation));
    }
  }
  assert.ok(data.evidenceAnalysis!.counterEvidenceFacts.length > 0);
  for (const fact of data.evidenceAnalysis!.counterEvidenceFacts) {
    assert.ok(session.aiPrompt.includes(fact.promptText));
  }
  assert.ok(session.aiPrompt.includes(data.evidenceAnalysis!.counterSummaryFact.status));
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
  assert.equal(session.aiPrompt.split('三门：').length - 1, 1);
  assert.equal(session.aiPrompt.split('五将：').length - 1, 1);
  assert.equal(session.aiPrompt.split('阴阳和：').length - 1, 1);
  assert.equal(session.aiPrompt.split(`直使${data.conditions.threeGates.directGate}`).length - 1, 1);
  assert.ok(session.aiPrompt.includes(`攻守参考：主算${data.lordCount}`));
  assert.ok(session.aiPrompt.includes('主客吉凶条件相等时，再以算之长短比较'));
  assert.doesNotMatch(session.aiPrompt, /盘面条件：/);
  assert.ok(session.aiPrompt.includes(`主大将${data.lordGeneral}宫`));
  assert.ok(
    session.aiPrompt.includes(data.conditions.fiveGenerals.hostGuestElementRelation.relation),
  );
  const relation = data.conditions.fiveGenerals.hostGuestElementRelation;
  assert.ok(session.aiPrompt.includes(`文昌${relation.hostPosition}属${relation.hostElement}`));
  assert.ok(session.aiPrompt.includes(`始击${relation.guestPosition}属${relation.guestElement}`));
  assert.match(
    session.aiPrompt,
    /二目五行（位置关系）.*日计纳音另论.*五将发不发依同宫关等条件另判/,
  );
  assert.doesNotMatch(session.aiPrompt, /sourceUrl|evidenceAnalysis|https?:\/\//);
});

test('太乙 aiPrompt 保留主客定算性且只呈现一次', () => {
  const session = generateDivinationSession({
    method: 'taiyi',
    question: '核对主客定算性',
    taiyi: { scope: 'year', year: 1951 },
    currentTime: '1951-01-01T12:00:00+08:00',
  });
  const data = session.data as TaiyiResult;
  for (const [label, count, nature] of [
    ['主', data.lordCount, data.countNatures?.lord],
    ['客', data.guestCount, data.countNatures?.guest],
    ['定', data.setCount, data.countNatures?.set],
  ] as const) {
    assert.ok(nature);
    assert.equal(session.aiPrompt.split(`${label}算${count}（${nature}）`).length - 1, 1);
  }
  for (const judgment of data.judgments) {
    if (
      judgment !== formatTaiyiConditionSummary(data.conditions) &&
      !/^(主算|客算|定算)\s*\d+\s*为/u.test(judgment)
    ) {
      assert.ok(session.aiPrompt.includes(judgment), judgment);
    }
  }
});
