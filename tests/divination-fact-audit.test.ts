import assert from 'node:assert/strict';
import test from 'node:test';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateQimenLifetimePrompt } from '../packages/core/src/divination/algorithms/qimen';
import { generateXuanKong } from '../packages/core/src/xuan_kong';
import { calculateWuyunLiuqi } from '../packages/core/src/wuyun-liuqi';
import { buildDivinationPrompt } from '../src/lib/divination/engine';
import { extractDivinationPromptFacts } from '../scripts/prompt-audit/divination-facts';
import { auditPromptFacts } from '../scripts/prompt-audit/facts';

function swapRowValues(prompt: string, rows: number[], pattern: RegExp) {
  const lines = prompt.split('\n');
  const first = lines[rows[0]].match(pattern)?.[0];
  const second = lines[rows[1]].match(pattern)?.[0];
  assert.ok(first && second);
  assert.notEqual(first, second);
  lines[rows[0]] = lines[rows[0]].replace(first, second);
  lines[rows[1]] = lines[rows[1]].replace(second, first);
  const changed = lines.join('\n');
  assert.ok(changed.includes(first) && changed.includes(second));
  return changed;
}

test('实际奇门九宫的天地盘归属互换后，同样的奇仪仍在也应检出错位', () => {
  const data = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
  const prompt = buildDivinationPrompt('qimen', '请分析合作。', data);
  const facts = extractDivinationPromptFacts('qimen', data);
  assert.deepEqual(auditPromptFacts(prompt, facts).missing, []);
  const rows = prompt
    .split('\n')
    .flatMap((line, index) => (line.includes('）：门') ? [index] : []));
  assert.equal(rows.length, 9);
  const changed = swapRowValues(prompt, rows, /天盘[^，]+/u);
  assert.ok(auditPromptFacts(changed, facts).missing.some((id) => id.startsWith('qimen.palace.')));
});

test('奇门终身局精简后仍逐日核对干支与关系归属', () => {
  const { data, prompt } = generateQimenLifetimePrompt({
    birthDateTime: '1990-05-15T14:30:00+08:00',
    periodRange: { startDate: '2026-01-01', endDate: '2026-12-31' },
  });
  const facts = extractDivinationPromptFacts('qimen-lifetime', data);
  assert.deepEqual(auditPromptFacts(prompt, facts).missing, []);

  const cluster = data.eventClusters?.find((item) => item.key.includes(':day:'));
  const date = cluster?.triggerDates?.[0];
  assert.ok(date?.ganzhi && date.relation);
  const [year, month, day] = date.date.split('-');
  const dateLine = prompt
    .split('\n')
    .find(
      (line) =>
        line.includes(`可复核日期：${year}年${month}月`) &&
        line.includes(`${day}日（${date.ganzhi}）`) &&
        line.includes(`日干支关系：${date.relation}`),
    );
  assert.ok(dateLine);
  const changed = prompt.replace(
    dateLine,
    dateLine.replace(`${day}日（${date.ganzhi}）`, `${day}日（虚构干支）`),
  );
  assert.ok(
    auditPromptFacts(changed, facts).missing.some((id) => id.startsWith('qimen-lifetime.event.')),
  );
});

test('实际六爻的六神换到另一爻后不能通过全表事实核验', () => {
  const data = generateLiuyao(new Date('2026-05-19T10:30:00+08:00'));
  const prompt = buildDivinationPrompt('liuyao', '请分析事业。', data);
  const facts = extractDivinationPromptFacts('liuyao', data);
  assert.deepEqual(auditPromptFacts(prompt, facts).missing, []);
  const rows = prompt
    .split('\n')
    .flatMap((line, index) => (/第\d爻.+六神/u.test(line) ? [index] : []));
  assert.equal(rows.length, 6);
  const changed = swapRowValues(prompt, rows, /六神[\u4e00-\u9fff]{2}/u);
  assert.ok(auditPromptFacts(changed, facts).missing.some((id) => id.startsWith('liuyao.yao.')));
});

test('实际玄空飞星和五运六气按宫位及步序绑定，交换数字或客运不能蒙混通过', () => {
  const house = generateXuanKong({ year: 2024, facingDegree: 0 });
  const houseFacts = extractDivinationPromptFacts('xuankong', house);
  assert.deepEqual(auditPromptFacts(house.prompt, houseFacts).missing, []);
  const houseRows = house.prompt
    .split('\n')
    .flatMap((line, index) => (/）：运\d/u.test(line) ? [index] : []));
  const changedHouse = swapRowValues(house.prompt, houseRows, /山\d/u);
  assert.ok(
    auditPromptFacts(changedHouse, houseFacts).missing.some((id) =>
      id.startsWith('xuankong.palace.'),
    ),
  );
  const climate = calculateWuyunLiuqi({ year: 2026 });
  const climateFacts = extractDivinationPromptFacts('wuyun-liuqi', climate);
  assert.deepEqual(auditPromptFacts(climate.prompt, climateFacts).missing, []);
  const movementRows = climate.prompt
    .split('\n')
    .flatMap((line, index) => (/^\d\. .+主运.+客运/u.test(line) ? [index] : []));
  const changedClimate = swapRowValues(climate.prompt, movementRows, /客运[^（；]+/u);
  assert.ok(
    auditPromptFacts(changedClimate, climateFacts).missing.some((id) =>
      id.startsWith('wuyun.movement.'),
    ),
  );
});
