import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { MEIHUA_RELATION_JUDGEMENTS } from 'mingyu-core/classics';
import { TraditionalDivinationBoard } from '../src/components/DivinationPanel/TraditionalDivinationBoard';
import { buildDivinationPrompt, type DivinationSession } from '../src/lib/divination/engine';

test('梅花五种主卦体用关系仅展示命中原文，并附本盘月令、互变条件', () => {
  for (const [number, hour, relation] of [
    [10, '10:30', '用生体'],
    [7, '10:30', '体克用'],
    [3, '10:30', '用克体'],
    [1, '10:30', '体生用'],
    [7, '12:30', '体用比和'],
  ] as const) {
    const data = generateMeihua(new Date(`2025-06-18T${hour}:00+08:00`), {
      method: 'number',
      number,
    });
    assert.equal(data.analysis.tiYongRelation, relation);
    assert.equal(data.evidenceAnalysis?.stages[0]?.relation, data.analysis.tiYongRaw);
    const session: DivinationSession = {
      method: 'meihua',
      requestedMethod: 'meihua',
      question: '后续进展如何？',
      prompt: '',
      data,
    };
    const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
    const referenceStart = html.indexOf(`${relation} · 体用总诀参考`);
    const referenceEnd = html.indexOf('八卦万物类象', referenceStart);
    assert.ok(referenceStart >= 0 && referenceEnd > referenceStart, relation);
    const reference = html.slice(referenceStart, referenceEnd);
    assert.ok(reference.includes(MEIHUA_RELATION_JUDGEMENTS[relation].classicSummary), relation);
    assert.ok(reference.includes(data.analysis.tiYongSeasonEvaluation!), relation);
    assert.ok(
      reference.includes(`变卦${data.changedName}：${data.analysis.changedTiYongRelation}`),
      relation,
    );
    assert.match(reference, /原文为主卦体用关系的传统参考/u);
    for (const [otherRelation, other] of Object.entries(MEIHUA_RELATION_JUDGEMENTS)) {
      if (otherRelation !== relation)
        assert.ok(!reference.includes(other.classicSummary), relation);
    }

    const prompt = buildDivinationPrompt('meihua', '后续进展如何？', data);
    const seasonEvaluation = data.analysis.tiYongSeasonEvaluation!;
    const seasonPrefix = relation === '比和' ? '体用同五行，比和相应；' : `主卦${relation}，`;
    const displayedSeasonEvaluation = seasonEvaluation.startsWith(seasonPrefix)
      ? seasonEvaluation.slice(seasonPrefix.length)
      : seasonEvaluation;
    assert.ok(prompt.includes(`主卦体用月令条件：${displayedSeasonEvaluation}`), relation);
    assert.ok(
      prompt.includes(
        `体用：体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻；体用关系${relation}`,
      ),
      relation,
    );
    assert.ok(prompt.includes('主卦体用依据：主卦以动爻所在经卦为用、另一经卦为体。'), relation);
    for (const judgement of Object.values(MEIHUA_RELATION_JUDGEMENTS)) {
      assert.ok(!prompt.includes(judgement.classicSummary), relation);
    }
  }
});

test('梅花主卦生体而变卦克体时，参考卡保留结果阶段的反向条件', () => {
  const data = generateMeihua(new Date('2025-06-18T12:30:00+08:00'), {
    method: 'number',
    number: 42,
  });
  assert.equal(data.analysis.tiYongRelation, '用生体');
  assert.equal(data.analysis.changedTiYongRelation, '用克体');
  const session: DivinationSession = {
    method: 'meihua',
    requestedMethod: 'meihua',
    question: '后续进展如何？',
    prompt: '',
    data,
  };
  const html = renderToStaticMarkup(createElement(TraditionalDivinationBoard, { session }));
  assert.match(html, /变卦泽火革：用克体/u);
  assert.match(html, /原文为主卦体用关系的传统参考/u);

  const relationCards = html.slice(
    html.indexOf('traditional-meihua-detail'),
    html.indexOf('traditional-meihua-yaos'),
  );
  for (const label of ['主卦体用', '互卦体用', '变卦体用']) {
    assert.equal(relationCards.split(`<span>${label}</span>`).length - 1, 1);
  }
  assert.match(
    relationCards,
    /<span>主卦体用<\/span><strong>用生体<\/strong><small>体[^<]+ · 用[^<]+<\/small>/u,
  );
  assert.match(relationCards, /<span>变卦体用<\/span><strong>用克体<\/strong>/u);
  assert.doesNotMatch(relationCards, /<small>[^<]*用克体[^<]*<\/small>/u);
  assert.doesNotMatch(html, /变后格局|互卦关系/u);
});
