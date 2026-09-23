import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe.ts';
import {
  buildAstrolabePeriodEvents,
  buildAstrolabeScopeContext,
} from '../packages/core/src/divination/astrolabe-scope.ts';

const astrolabeData = generateAstrolabe({
  name: '命例四',
  gender: '男',
  year: '1993',
  month: '4',
  day: '8',
  hour: '23',
  minute: '34',
  latitude: '1.3521',
  longitude: '103.8198',
  timezone: '8',
  locationName: '新加坡',
  useTrueSolarTime: false,
});

function countOccurrences(text: string, value: string) {
  return value ? text.split(value).length - 1 : 0;
}

function compactAdvancedAspect(fact: {
  movingPoint: string;
  aspectName: string;
  natalPoint: string;
  deviation: number;
  closeness: string;
}) {
  return `${fact.movingPoint}${fact.aspectName}${fact.natalPoint}（偏差${fact.deviation.toFixed(2)}°，${fact.closeness}）`;
}

test('星盘周期提示词压缩保留真实 fixture 的全量事件且摘要不重复明细', () => {
  const collection = buildAstrolabePeriodEvents(astrolabeData, 'yearly', {
    year: 2022,
    month: 7,
    day: 1,
  });

  assert.equal(collection.events.length, 98);
  assert.ok(
    collection.promptText.length < 3324,
    `周期提示词应短于压缩前同一 fixture 的 3324 字符，实际为 ${collection.promptText.length}`,
  );
  assert.match(collection.promptText, /周期主轴：/);
  assert.match(collection.promptText, /关键窗口：/);
  assert.match(collection.promptText, /过境归组：/);
  assert.match(collection.promptText, /完整明细：/);

  for (const event of collection.events) {
    assert.ok(
      collection.promptText.includes(`${event.dateTime} ${event.promptText}`),
      `完整明细缺少事件：${event.dateTime} ${event.promptText}`,
    );
    assert.equal(
      collection.promptText.includes(event.key),
      false,
      `提示词不应暴露事件内部键：${event.key}`,
    );
  }

  for (const group of collection.groups) {
    assert.equal(
      countOccurrences(collection.promptText, group.promptText),
      1,
      `过境归组不应再次复制到周期主轴或完整明细：${group.promptText}`,
    );
  }
});

test('星盘流年提示词应列出高级时限的全部已筛选相位事实', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2022');
  const evidence = [
    ['太阳返照', context.solarReturnEvidence],
    ['次限相位', context.secondaryProgressionEvidence],
    ['太阳弧相位', context.solarArcEvidence],
  ] as const;

  for (const [label, item] of evidence) {
    assert.ok(item);
    const line =
      context.promptText.split('\n').find((value) => value.startsWith(`${label}：`)) ??
      context.promptText.split('\n').find((value) => value.startsWith(`${label}（`));
    assert.ok(line, `缺少高级时限提示词行：${label}`);
    const facts = line!
      .slice(line!.indexOf('：') + 1)
      .replace(/。$/, '')
      .split('；');
    assert.equal(facts.length, item.aspectFacts.length, `${label}不应静默截断相位事实`);
    for (const fact of item.aspectFacts) {
      assert.ok(
        line!.includes(compactAdvancedAspect(fact)),
        `${label}缺少相位事实：${compactAdvancedAspect(fact)}`,
      );
      assert.equal(line!.includes(fact.key), false, `${label}不应暴露事实内部键：${fact.key}`);
    }
  }

  assert.ok((context.solarReturnEvidence?.aspectFacts.length ?? 0) > 0);
  assert.ok((context.secondaryProgressionEvidence?.aspectFacts.length ?? 0) > 0);
  assert.ok((context.solarArcEvidence?.aspectFacts.length ?? 0) > 0);
  assert.ok(
    context.secondaryProgressionEvidence?.candidateAspectFacts.every(
      (fact) => fact.allowedOrb === (fact.movingPointKey.endsWith(':Moon') ? 1 : 0.5),
    ),
  );
  assert.ok(context.solarArcEvidence?.candidateAspectFacts.every((fact) => fact.allowedOrb === 1));
});
