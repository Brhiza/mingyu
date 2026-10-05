import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAstrolabePrompt } from 'mingyu-core/prompt';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { AstrolabeBirthInput, AstrolabeData } from 'mingyu-core/types';
import { getApparentPosition, toJulianDate } from '../packages/core/src/astrology/engine';
import { defaultDraft } from '../src/components/DivinationPanel/constants';
import type { DivinationDraft, DivinationSession } from '../src/lib/divination/engine';
import { addDivinationHistory, getDivinationHistoryById } from '../src/lib/history-records';

// 参考值取自 Swiss Ephemeris 2.10（se1 星历文件，SE_OSCU_APOG=13、SE_TRUE_NODE=11）。
// 容差为不同星历模型保留余量，并远小于会造成占星落位误判的角度。
const LILITH_TOLERANCE_DEG = 0.25;
const NODE_TOLERANCE_DEG = 0.01;

const baseInput = {
  name: '参考用例',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
};

const cases: Array<{
  label: string;
  input: AstrolabeBirthInput;
  lilith: number;
  northNode: number;
}> = [
  {
    label: '1990-01-01 10:30 UTC',
    input: { ...baseInput, year: '1990', month: '1', day: '1', hour: '18', minute: '30' },
    lilith: 230.1155,
    northNode: 316.8689,
  },
  {
    label: '2008-08-08 12:00 UTC',
    input: { ...baseInput, year: '2008', month: '8', day: '8', hour: '20', minute: '0' },
    lilith: 252.3543,
    northNode: 318.5629,
  },
  {
    label: '1937-07-07 15:30 UTC',
    input: { ...baseInput, year: '1937', month: '7', day: '7', hour: '23', minute: '30' },
    lilith: 257.2845,
    northNode: 254.9239,
  },
  {
    label: '2026-08-31 00:00 UTC',
    input: { ...baseInput, year: '2026', month: '8', day: '31', hour: '8', minute: '0' },
    lilith: 267.6543,
    northNode: 329.8161,
  },
];

function angularDifference(first: number, second: number): number {
  const difference = Math.abs(first - second) % 360;
  return difference > 180 ? 360 - difference : difference;
}

for (const reference of cases) {
  test(`真莉莉丝与真交点应对齐 Swiss Ephemeris：${reference.label}`, () => {
    const chart = generateAstrolabe(reference.input);
    const lilith = chart.planets.find((point) => point.name === 'True Lilith');
    const northNode = chart.planets.find((point) => point.name === 'North Node');
    const southNode = chart.planets.find((point) => point.name === 'South Node');

    assert.ok(lilith);
    assert.ok(northNode);
    assert.ok(southNode);
    assert.ok(angularDifference(lilith.longitude, reference.lilith) <= LILITH_TOLERANCE_DEG);
    assert.ok(angularDifference(northNode.longitude, reference.northNode) <= NODE_TOLERANCE_DEG);
    assert.ok(angularDifference(southNode.longitude, northNode.longitude + 180) <= 1e-6);
  });
}

test('相位几何量应由最终真莉莉丝和真交点黄经计算', () => {
  const chart = generateAstrolabe({
    ...baseInput,
    year: '1949',
    month: '10',
    day: '1',
    hour: '15',
    minute: '0',
  });
  const points = new Map(chart.planets.map((point) => [point.label, point]));

  for (const aspect of chart.aspects) {
    const first = points.get(aspect.body1);
    const second = points.get(aspect.body2);
    assert.ok(first, `缺少相位主体 ${aspect.body1}`);
    assert.ok(second, `缺少相位主体 ${aspect.body2}`);
    assert.notEqual(aspect.actualAngle, undefined);
    assert.notEqual(aspect.exactAngle, undefined);
    const actualAngle = angularDifference(first.longitude, second.longitude);
    assert.ok(Math.abs((aspect.actualAngle as number) - actualAngle) <= 0.0001);
    assert.equal(
      aspect.orb,
      Number(Math.abs(actualAngle - (aspect.exactAngle as number)).toFixed(2)),
    );
  }
});

test('完整星盘交点与莉莉丝逆行标志保留底层星历方向', () => {
  const chart = generateAstrolabe({
    ...baseInput,
    year: '2026',
    month: '1',
    day: '1',
    hour: '20',
    minute: '0',
  });
  assert.equal(chart.lunarNodeType, 'true');
  const jd = toJulianDate({ year: 2026, month: 1, day: 1, hour: 20, minute: 0, timezone: 8 });
  for (const [name, id] of [
    ['North Node', 'true_node'],
    ['South Node', 'true_node'],
    ['True Lilith', 'true_lilith'],
  ] as const) {
    const point = chart.planets.find((item) => item.name === name)!;
    assert.equal(point.retrograde, getApparentPosition(id, jd).speed < 0, name);
  }

  const modelFactLine = '交点口径：月球真交点';
  const modelFactLines = (prompt: string) =>
    prompt.split('\n').filter((line) => line === modelFactLine);
  const removeModelFactLine = (prompt: string) =>
    prompt
      .split('\n')
      .filter((line) => line !== modelFactLine)
      .join('\n');
  const currentTime = new Date(chart.timestamp);
  const question = '交点口径与这份星盘的关系如何？';
  const completePrompt = buildAstrolabePrompt({ chart, currentTime, question });
  assert.equal(modelFactLines(completePrompt).length, 1);

  const nodePlanets = chart.planets.filter((point) => point.name.includes('Node'));
  assert.deepEqual(nodePlanets.map((point) => point.name).sort(), ['North Node', 'South Node']);
  assert.ok(nodePlanets.every((point) => /^[\u4e00-\u9fff]+$/u.test(point.label)));
  const nodeLabels = new Set(nodePlanets.map((point) => point.label));
  const chartLabels = new Set([...chart.planets, ...chart.angles].map((point) => point.label));
  const nodeAspects = chart.aspects.filter(
    (aspect) => nodeLabels.has(aspect.body1) || nodeLabels.has(aspect.body2),
  );
  assert.ok(nodeAspects.length > 0, '固定星盘应包含交点参与的真实相位');
  for (const aspect of nodeAspects) {
    assert.ok(chartLabels.has(aspect.body1), `相位主体应使用现存中文标签：${aspect.body1}`);
    assert.ok(chartLabels.has(aspect.body2), `相位主体应使用现存中文标签：${aspect.body2}`);
    assert.ok(nodeLabels.has(aspect.body1) || nodeLabels.has(aspect.body2));
    assert.ok(completePrompt.includes(`${aspect.body1}与${aspect.body2}：${aspect.type}`));
  }

  const withoutNodeBodies = JSON.parse(JSON.stringify(chart)) as AstrolabeData;
  assert.equal(withoutNodeBodies.lunarNodeType, 'true');
  withoutNodeBodies.planets = withoutNodeBodies.planets.filter(
    (point) => !nodePlanets.some((node) => node.name === point.name),
  );
  withoutNodeBodies.aspects = withoutNodeBodies.aspects.filter(
    (aspect) => !nodeLabels.has(aspect.body1) && !nodeLabels.has(aspect.body2),
  );
  delete withoutNodeBodies.evidenceAnalysis;
  const withoutNodePrompt = buildAstrolabePrompt({
    chart: withoutNodeBodies,
    currentTime,
    question,
  });
  assert.deepEqual(modelFactLines(withoutNodePrompt), []);

  const legacyChart = JSON.parse(JSON.stringify(chart)) as AstrolabeData;
  delete legacyChart.lunarNodeType;
  const legacyPrompt = buildAstrolabePrompt({ chart: legacyChart, currentTime, question });
  assert.deepEqual(modelFactLines(legacyPrompt), []);
  assert.equal(legacyPrompt, removeModelFactLine(completePrompt));

  const historyQuestion = question;
  const draft: DivinationDraft = {
    ...defaultDraft,
    method: 'astrolabe',
    question: historyQuestion,
    questionSource: 'custom',
    astrolabeName: chart.birth.name,
    astrolabeGender: chart.birth.gender,
    astrolabeYear: '2026',
    astrolabeMonth: '1',
    astrolabeDay: '1',
    astrolabeHour: '20',
    astrolabeMinute: '0',
    astrolabeLatitude: String(chart.birth.latitude ?? ''),
    astrolabeLongitude: String(chart.birth.longitude ?? ''),
    astrolabeTimezone: String(chart.birth.timezone),
  };
  const session: DivinationSession = {
    method: 'astrolabe',
    requestedMethod: 'astrolabe',
    question: historyQuestion,
    prompt: completePrompt,
    data: chart,
  };

  const storageValues = new Map<string, string>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => storageValues.get(key) ?? null,
        setItem: (key: string, value: string) => storageValues.set(key, value),
        removeItem: (key: string) => storageValues.delete(key),
      },
      dispatchEvent: () => true,
    },
  });
  try {
    const saved = addDivinationHistory(draft, session);
    assert.ok(saved);
    const storageKey = 'prompt_studio_divination_history_v1';
    const savedJson = storageValues.get(storageKey);
    assert.ok(savedJson);
    const storedRecord = JSON.parse(savedJson).find(
      (record: { id: string }) => record.id === saved.id,
    );
    assert.equal(storedRecord.session.data.lunarNodeType, 'true');
    const savedJsonBeforeRead = storageValues.get(storageKey);
    const restored = getDivinationHistoryById(saved.id);
    assert.ok(restored);
    const restoredChart = restored.session.data as AstrolabeData;
    assert.equal(restoredChart.lunarNodeType, 'true');
    assert.equal(
      modelFactLines(
        buildAstrolabePrompt({ chart: restoredChart, currentTime, question: historyQuestion }),
      ).length,
      1,
    );
    assert.equal(storageValues.get(storageKey), savedJsonBeforeRead);

    const legacySession: DivinationSession = {
      ...session,
      prompt: completePrompt,
      data: legacyChart,
    };
    const legacySaved = addDivinationHistory(draft, legacySession);
    assert.ok(legacySaved);
    const legacyJsonBeforeRead = storageValues.get(storageKey);
    assert.ok(legacyJsonBeforeRead);
    const storedLegacyRecord = JSON.parse(legacyJsonBeforeRead).find(
      (record: { id: string }) => record.id === legacySaved.id,
    );
    assert.equal(Object.hasOwn(storedLegacyRecord.session.data, 'lunarNodeType'), false);
    assert.equal(modelFactLines(storedLegacyRecord.session.prompt).length, 1);

    const restoredLegacy = getDivinationHistoryById(legacySaved.id);
    assert.ok(restoredLegacy);
    const restoredLegacyChart = restoredLegacy.session.data as AstrolabeData;
    assert.equal(Object.hasOwn(restoredLegacyChart, 'lunarNodeType'), false);
    assert.deepEqual(
      restoredLegacyChart.planets.filter((point) => point.name.includes('Node')),
      legacyChart.planets.filter((point) => point.name.includes('Node')),
    );
    assert.deepEqual(modelFactLines(restoredLegacy.session.prompt), []);
    assert.deepEqual(
      modelFactLines(
        buildAstrolabePrompt({
          chart: restoredLegacyChart,
          currentTime,
          question: historyQuestion,
        }),
      ),
      [],
    );
    assert.equal(storageValues.get(storageKey), legacyJsonBeforeRead);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
