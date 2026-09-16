import assert from 'node:assert/strict';
import test from 'node:test';

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type {
  AstrolabeBirthRange,
  AstrolabeBirthRangeBranch,
} from 'mingyu-core/divination/astrolabe-birth-range';
import { AstrolabeBirthRangePanel } from '../src/pages/ResultPage/components/AstrolabeBirthRangePanel';

const BASE_TIMESTAMP = Date.parse('1990-05-20T04:30:00.000Z');

function buildBranch(
  data: ReturnType<typeof generateAstrolabe>,
  startTimestamp: number,
  endTimestamp: number,
): AstrolabeBirthRangeBranch {
  const sun = data.planets.find((point) => point.name === 'Sun');
  assert.ok(sun);
  return {
    startTimestamp,
    endTimestamp,
    endExclusive: true,
    sampleCount: (endTimestamp - startTimestamp) / 1000,
    representative: data,
    last: data,
    continuous: [
      {
        path: 'planets[Sun].longitude',
        label: 'Sun黄经',
        unit: '度',
        first: sun.longitude,
        last: sun.longitude,
        min: sun.longitude,
        max: sun.longitude,
        sampleCount: (endTimestamp - startTimestamp) / 1000,
      },
      {
        path: 'aspects[Sun↔conjunction↔Moon].actualAngle',
        label: 'Sun↔conjunction↔Moon实际夹角',
        unit: '度',
        first: 0,
        last: 0,
        min: 0,
        max: 0,
        sampleCount: (endTimestamp - startTimestamp) / 1000,
      },
    ],
  };
}

test('本命区间面板显示完整范围并以所选分段起点作为代表时刻', () => {
  const data = generateAstrolabe({
    name: '合成区间样本',
    gender: '女',
    year: '1990',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    second: '0',
    latitude: '31.2304',
    longitude: '121.4737',
    timezone: '8',
    locationName: '上海',
  });
  const range: AstrolabeBirthRange = {
    coverage: 'natal',
    status: 'conditional',
    source: {
      startTimestamp: BASE_TIMESTAMP,
      endTimestamp: BASE_TIMESTAMP + 3_000,
      endExclusive: true,
      timezone: 'Asia/Shanghai',
      offsetHours: 8,
    },
    resolutionSeconds: 1,
    sampleCount: 3,
    branches: [
      buildBranch(data, BASE_TIMESTAMP, BASE_TIMESTAMP + 1_000),
      buildBranch(data, BASE_TIMESTAMP + 1_000, BASE_TIMESTAMP + 3_000),
    ],
  };

  const html = renderToStaticMarkup(
    createElement(AstrolabeBirthRangePanel, {
      range,
      loading: false,
      error: null,
      progress: { completed: 3, total: 3 },
      cancel: () => undefined,
      retry: () => undefined,
      selectedIndex: 1,
      onSelect: () => undefined,
    }),
  );

  assert.match(html, /出生时刻边界核对/);
  assert.match(html, /3 个整秒样本/);
  assert.match(html, /时段 2 · 2 秒/);
  assert.match(html, /1990-05-20 12:30:01/);
  assert.match(html, /代表时刻：1990-05-20 12:30:01/);
  assert.match(html, /连续事实（2 项）/);
  assert.match(html, /<span>太阳黄经<\/span>/);
  assert.match(html, /太阳↔合相↔月亮实际夹角/);
  assert.doesNotMatch(html, /<span>Sun黄经<\/span>/);
  assert.doesNotMatch(html, /<span>Sun↔conjunction↔Moon实际夹角<\/span>/);
});
