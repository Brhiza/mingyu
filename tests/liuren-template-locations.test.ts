import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuren } from '../packages/core/src/divination/algorithms/liuren';
import { buildLiurenTemplateText } from '../packages/core/src/divination/engine/liuren-template';

const fixtureDate = new Date('2026-05-19T10:30:00+08:00');

function assertGodLocations(text: string, data: ReturnType<typeof generateLiuren>, god: string) {
  const plateHits = data.heavenlyPlate.filter((item) => item.god === god);
  const lessonHits = data.fourLessons.filter((item) => item.god === god);
  const transmissionHits = data.threeTransmissions.filter((item) => item.god === god);

  assert.ok(text.includes(`${god}：天地盘`));
  assert.equal(
    plateHits.every((item) => text.includes(`天盘${item.branch}下临地盘${item.under}`)),
    true,
  );
  assert.equal(
    lessonHits.every((item) => text.includes(`${item.name}${item.upper}临${item.lower}`)),
    true,
  );
  assert.equal(
    transmissionHits.every((item) =>
      text.includes(
        `${item.stage}${item.branch}${item.seasonState || item.isVoid !== undefined || item.dayRelation ? '（' : ''}`,
      ),
    ),
    true,
  );
  if (!plateHits.length) assert.match(text, new RegExp(`${god}：天地盘未见`));
  if (!lessonHits.length) assert.match(text, new RegExp(`${god}：[^；]*；四课命中未见`));
  if (!transmissionHits.length)
    assert.match(text, new RegExp(`${god}：[^；]*；[^；]*；三传命中未见`));
}

test('大六壬主题类神定位应保留天地盘、四课、三传与已有条件', () => {
  const data = generateLiuren(fixtureDate);
  const text = buildLiurenTemplateText('caifu', data);

  assert.match(text, /财富财运；类神：财运看青龙、太常、天空/);
  assert.match(text, /事项类神盘面定位：/);
  assert.match(text, /初传保持发用结构/);
  for (const god of ['青龙', '太常', '天空']) assertGodLocations(text, data, god);

  const transmission = data.threeTransmissions.find((item) => item.god === '青龙');
  if (transmission) {
    if (transmission.seasonState)
      assert.match(
        text,
        new RegExp(`${transmission.stage}${transmission.branch}（月令${transmission.seasonState}`),
      );
    if (transmission.isVoid !== undefined) {
      assert.match(
        text,
        new RegExp(
          `${transmission.stage}${transmission.branch}（[^）]*${transmission.isVoid ? '旬空' : '不逢旬空'}`,
        ),
      );
    }
  }
});

test('大六壬类神定位应完整保留多命中并对零命中明确写未见', () => {
  const source = generateLiuren(fixtureDate);
  const multiple = {
    ...source,
    heavenlyPlate: source.heavenlyPlate.map((item, index) =>
      index < 2 ? { ...item, god: '青龙' } : item,
    ),
    fourLessons: source.fourLessons.map((item, index) =>
      index < 2 ? { ...item, god: '青龙' } : item,
    ),
    threeTransmissions: source.threeTransmissions.map((item, index) =>
      index < 2 ? { ...item, god: '青龙' } : item,
    ),
  };
  const multipleText = buildLiurenTemplateText('caifu', multiple);
  assertGodLocations(multipleText, multiple, '青龙');
  for (const item of multiple.heavenlyPlate.slice(0, 2)) {
    assert.ok(multipleText.includes(`天盘${item.branch}下临地盘${item.under}`));
  }
  for (const item of multiple.fourLessons.slice(0, 2)) {
    assert.ok(multipleText.includes(`${item.name}${item.upper}临${item.lower}`));
  }
  for (const item of multiple.threeTransmissions.slice(0, 2)) {
    assert.ok(multipleText.includes(`${item.stage}${item.branch}`));
  }

  const missing = {
    ...source,
    heavenlyPlate: source.heavenlyPlate.map((item) => ({ ...item, god: '其他' })),
    fourLessons: source.fourLessons.map((item) => ({ ...item, god: '其他' })),
    threeTransmissions: source.threeTransmissions.map((item) => ({ ...item, god: '其他' })),
  };
  const missingText = buildLiurenTemplateText('caifu', missing);
  for (const god of ['青龙', '太常', '天空']) assertGodLocations(missingText, missing, god);
});

test('大六壬通用模板保持原有类神语义', () => {
  const data = generateLiuren(fixtureDate);
  assert.equal(
    buildLiurenTemplateText('general', data),
    '通用；类神：日干为我、日支为事；三传看发端、转折和归结',
  );
});
