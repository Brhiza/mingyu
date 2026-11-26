import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';

import { formatAstroHouseSystem } from '../src/systems/prompt-format';

const birth = {
  year: 1990,
  month: 5,
  day: 15,
  hour: 14,
  minute: 30,
  latitude: 39.9,
  longitude: 116.4,
  timezone: 8,
};

test('西洋星盘支持 koch、regiomontanus、alcabitius 等 12 种宫位制及追问', async () => {
  for (const houseSystem of ['koch', 'regiomontanus', 'alcabitius'] as const) {
    const result = await calculate('astrolabe', {
      question: '宫位制对比',
      birth,
      options: { houseSystem },
    });
    assert.equal(result.data.basis.houseSystem, houseSystem);
    assert.match(result.prompt.text, new RegExp(`${formatAstroHouseSystem(houseSystem)}宫位制`));
    const followed = await reprompt({
      method: 'astrolabe',
      result: JSON.parse(JSON.stringify(result)),
      question: '继续看事业',
    });
    assert.match(followed.prompt.text, new RegExp(`${formatAstroHouseSystem(houseSystem)}宫位制`));
  }
});
