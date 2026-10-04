import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAstrolabeFromInput,
  buildHoroscopeFromInput,
} from '../packages/core/src/ziwei/iztro/runtime-helpers';
import { buildAnalysisPayloadV1 } from '../packages/core/src/ziwei/iztro/build-analysis-payload';
import {
  buildZiweiReadableSnapshot,
  buildZiweiTaskBookSnapshot,
} from '../packages/core/src/ziwei/prompt/snapshot';
import type { ChartInput } from '../packages/core/src/types/chart';

test('本命提示词使用出生日期而非运限参考日期', async () => {
  const input: ChartInput = {
    name: '出生与运限日期核对',
    gender: '男',
    dateType: 'solar',
    birthDate: '1990-05-15',
    birthTimeIndex: 1,
  };
  const astrolabe = await buildAstrolabeFromInput(input);
  const horoscope = await buildHoroscopeFromInput(astrolabe, input, '2026-05-16', 1);
  const payload = buildAnalysisPayloadV1({
    astrolabe,
    horoscope,
    currentScope: 'origin',
    skipAnalysis: true,
  });

  assert.equal(payload.basic_info.solar_date, '1990-05-15');
  assert.equal(payload.active_scope.solar_date, '2026-05-16');
  for (const snapshot of [
    buildZiweiReadableSnapshot({ payload, reportContext: { scope: 'origin' } }),
    buildZiweiTaskBookSnapshot({ payload, reportContext: { scope: 'origin' } }),
  ]) {
    assert.match(snapshot, /分析对象：本命盘（出生日期1990-05-15）。/);
    assert.doesNotMatch(snapshot, /本命盘（2026-05-16）/);
  }
});
