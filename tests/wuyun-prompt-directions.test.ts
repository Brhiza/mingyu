import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateWuyunLiuqi } from '@core/wuyun-liuqi';
import { SIXTY_CYCLE } from '@core/ganzhi';

test('五运六气原生正文按六十甲子保留中运与司天实际五行方向', () => {
  const sheng: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const ke: Record<string, string> = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
  const seen = new Set<string>();
  for (const yearGanZhi of SIXTY_CYCLE) {
    const result = calculateWuyunLiuqi({ yearGanZhi });
    const source = result.annualMovement.element;
    const target = result.sitian.element;
    const from = `中运（${source}）`;
    const to = `司天${result.sitian.name}（${target}）`;
    const direction =
      source === target
        ? `${from}与${to}同气`
        : sheng[source] === target
          ? `${from}生${to}`
          : sheng[target] === source
            ? `${to}生${from}`
            : ke[source] === target
              ? `${from}克${to}`
              : `${to}克${from}`;
    const category =
      source === target
        ? '同气'
        : sheng[source] === target
          ? '运生气'
          : sheng[target] === source
            ? '气生运'
            : ke[source] === target
              ? '运克气'
              : '气克运';
    seen.add(category);
    assert.ok(result.prompt.includes(`年度五行作用：${direction}`), yearGanZhi);
  }
  assert.equal(seen.size, 5);
});

test('丙午年保留运克气、客生主与客克主的施受双方', () => {
  const { prompt } = calculateWuyunLiuqi({ yearGanZhi: '丙午' });
  assert.match(prompt, /中运（水）克司天少阴君火（火）/);
  assert.match(prompt, /在泉阳明燥金（金）生中运（水）/);
  assert.match(prompt, /客运太羽（水）生主运太角（木）/);
  assert.match(prompt, /客气太阳寒水（水）生主气厥阴风木（木）/);
  assert.match(prompt, /客气少阳相火（火）克主气阳明燥金（金）/);
  assert.doesNotMatch(prompt, /司天少阴君火（火）克中运（水）/);
});
