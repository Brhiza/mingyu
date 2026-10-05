import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFullZiweiChart, buildZiweiChartInput } from '../src/lib/full-chart-engine/ziwei';
import {
  buildInstantAstrolabePrompt,
  buildInstantBaziPrompt,
  buildInstantBaziZiweiPrompt,
  buildInstantZiweiPrompt,
} from '../src/lib/instant-prompt';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe';
import { buildFocusTaskBundle } from '../packages/core/src/ziwei/prompt/focus';
import {
  buildPalaceIndex,
  buildPalaceSummary,
  formatPalaceRelations,
} from '../packages/core/src/ziwei/prompt/builders';
import { formatZiweiPayloadForPrompt } from '../packages/core/src/prompt/ziwei';
import { formatZiweiEvidenceText } from '../packages/core/src/prompt/public-api';

const SHARED_INSTANT_BAZI_INPUT = {
  gender: 'male',
  year: 2026,
  month: 5,
  day: 19,
  timeIndex: 5,
  isLunar: false,
  isLeapMonth: false,
  useTrueSolarTime: false,
} as const;
let sharedInstantBaziChart: ReturnType<typeof baziCalculator.calculateBazi> | undefined;

function createSharedInstantBaziChart() {
  sharedInstantBaziChart ??= baziCalculator.calculateBazi(SHARED_INSTANT_BAZI_INPUT);
  return structuredClone(sharedInstantBaziChart);
}

test('即时八字按日旬核对落空，并区分藏干与明透柱位', () => {
  const stems = [...'甲乙丙丁戊己庚辛壬癸'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  const emptyByDecade = ['戌亥', '申酉', '午未', '辰巳', '寅卯', '子丑'];
  const cycle = Array.from({ length: 60 }, (_, i) => stems[i % 10] + branches[i % 12]);
  const keys = ['year', 'month', 'day', 'hour'] as const;
  const labels = ['年柱', '月柱', '日柱', '时柱'];
  const hitCounts = new Set<number>();
  const seenDecades = new Set<number>();
  for (let offset = 0; offset < 60; offset++) {
    const date = new Date(Date.UTC(2026, 4, 1 + offset));
    const chartInput = {
      gender: 'male',
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      timeIndex: 5,
      isLunar: false,
      isLeapMonth: false,
      useTrueSolarTime: false,
    } as const;
    const chart =
      chartInput.year === SHARED_INSTANT_BAZI_INPUT.year &&
      chartInput.month === SHARED_INSTANT_BAZI_INPUT.month &&
      chartInput.day === SHARED_INSTANT_BAZI_INPUT.day &&
      chartInput.timeIndex === SHARED_INSTANT_BAZI_INPUT.timeIndex
        ? createSharedInstantBaziChart()
        : baziCalculator.calculateBazi(chartInput);
    const prompt = buildInstantBaziPrompt(chart, '判断当前事件。', '当地民用时间');
    assert.match(prompt, /【解读对象】\n八字即时盘。盘面年月日时均为本次事件的起盘时间/);
    assert.ok(prompt.includes(`日元${chart.analysis.dayMasterStrength.status}`));
    assert.ok(prompt.includes(`格局${chart.analysis.mingGe.pattern}`));
    assert.ok(prompt.includes(`取用${chart.analysis.usefulGod.useful}`));
    if (chart.climate && chart.climate.nature !== '未见明显偏向') {
      assert.ok(prompt.includes(`水火分布参考：${chart.climate.summary}`));
      assert.doesNotMatch(prompt, /\n调候：/);
    } else {
      assert.doesNotMatch(prompt, /\n水火分布参考：|\n调候：/);
    }
    for (const relation of Object.values(chart.pillarRelations).flat()) {
      assert.ok(prompt.includes(relation.replace(/干支同为.+$/u, '干支相同')));
    }
    const decade = Math.floor(cycle.indexOf(chart.pillars.day.ganZhi) / 10);
    const empty = emptyByDecade[decade];
    seenDecades.add(decade);
    assert.doesNotMatch(prompt, /日柱[^：\n]+所属旬空：/);
    let hits = 0;
    for (const [index, key] of keys.entries()) {
      const pillar = chart.pillars[key];
      const isEmpty = empty.includes(pillar.zhi);
      if (isEmpty) hits++;
      const line = prompt.split('\n').find((item) => item.startsWith(`${labels[index]}：`))!;
      assert.equal(line.includes(`按日旬核对本柱${pillar.zhi}支：落空`), isEmpty);
      assert.doesNotMatch(line, /不落空/);
      const ownEmpty = emptyByDecade[Math.floor(cycle.indexOf(pillar.ganZhi) / 10)];
      assert.ok(line.includes(`该柱所属旬空：${[...ownEmpty].join('、')}`));
      for (const [stemIndex, stem] of chart.hiddenStems[key].entries()) {
        const visible = keys.flatMap((k, i) => (chart.pillars[k].gan === stem ? [labels[i]] : []));
        const state = visible.length ? `明透于${visible.join('、')}天干` : '仅藏于支';
        assert.ok(line.includes(`${stem}（${chart.hiddenTenGods[key][stemIndex]}）〔${state}〕`));
      }
    }
    hitCounts.add(hits);
  }
  assert.equal(seenDecades.size, 6);
  assert.ok(hitCounts.has(0));
  assert.ok(hitCounts.has(1));
  assert.ok([...hitCounts].some((count) => count > 1));
});

test('中性水火指标不占用即时八字盘面资料', () => {
  const chart = baziCalculator.calculateBazi({
    year: 1995,
    month: 8,
    day: 15,
    timeIndex: 6,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  assert.equal(chart.climate?.nature, '未见明显偏向');
  assert.doesNotMatch(formatBaziForPrompt(chart), /水火分布参考:|调候特征:/);
  assert.doesNotMatch(
    buildInstantBaziPrompt(chart, '判断当前事件。', '当地民用时间'),
    /水火分布参考：|调候：/,
  );
});

test('紫微即时盘与合参区分命主身主和命身宫内主星', async () => {
  const runtime = await calculateFullZiweiChart(
    buildZiweiChartInput({
      name: '即时盘',
      gender: 'male',
      dateType: 'solar',
      year: '2026',
      month: '5',
      day: '19',
      timeIndex: '5',
      isLeapMonth: false,
      useTrueSolarTime: false,
    }),
  );
  const payload = runtime.payloadByScope.origin;
  const bazi = createSharedInstantBaziChart();
  assert.equal(bazi.pillars.month.ganZhi, bazi.pillars.day.ganZhi);
  const baziPrompts = [
    buildInstantBaziPrompt(bazi, '请解读当前事件。', '2026年5月19日10:30'),
    buildInstantBaziZiweiPrompt(bazi, payload, '请解读当前事件。', '2026年5月19日10:30'),
  ];
  const compactFuxin = bazi.pillarRelations.fuxin.map((relation) =>
    relation.replace(/干支同为.+$/u, '干支相同'),
  );
  for (const prompt of baziPrompts) {
    assert.ok(prompt.includes(`月柱：${bazi.pillars.month.ganZhi}；`));
    assert.ok(prompt.includes(`日柱：${bazi.pillars.day.ganZhi}；`));
    assert.ok(prompt.includes(`伏吟：${compactFuxin.join('、')}`));
    for (const relation of bazi.pillarRelations.fuxin) assert.ok(!prompt.includes(relation));
  }
  const prompts = [
    buildInstantZiweiPrompt(payload, '请解读当前事件。', '2026年5月19日10:30'),
    buildInstantBaziZiweiPrompt(bazi, payload, '请解读当前事件。', '2026年5月19日10:30'),
  ];
  for (const prompt of prompts) {
    assert.match(prompt, /盘面年月日时均为本次事件的起盘时间/);
    assert.doesNotMatch(prompt, /起盘年干四化：/);
    assert.doesNotMatch(prompt, /生年四化：/);
    assert.match(prompt, /命主星：贪狼；身主星：火星/);
    assert.match(prompt, /命宫（庚子）：武曲（旺）、天府（庙）/);
    assert.match(prompt, /夫妻（戊戌），身宫：破军（旺）/);
    assert.doesNotMatch(prompt, /命宫主星：贪狼|身宫主星：火星/);
    assert.match(prompt, /本宫命宫（子）；三合会照[^\n]*财帛宫（申）/);
    assert.match(
      prompt,
      /本宫官禄宫（辰）；三合会照[^\n]*；对宫夫妻宫（戌）；两侧邻宫田宅宫（卯）、仆役宫（巳）/,
    );
    for (const palace of payload.palaces) {
      const palaceLine = prompt.split('\n').find((line) => line.startsWith(`${palace.name}（`))!;
      for (const star of [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars]) {
        if (star.birth_mutagen) {
          assert.match(
            palaceLine,
            new RegExp(`${star.name}[^、；\\n]*起盘年干化${star.birth_mutagen}`),
          );
        }
      }
      for (const mutagen of palace.self_mutagens ?? []) {
        assert.ok(palaceLine.includes(`自化${mutagen}`));
      }
      for (const item of palace.mutaged_palaces ?? []) {
        if (!item.palace_name) continue;
        const repeatedSelf =
          item.palace_name === palace.name && palace.self_mutagens?.includes(item.mutagen);
        assert.equal(palaceLine.includes(`化${item.mutagen}入${item.palace_name}`), !repeatedSelf);
      }
    }
  }

  const career = payload.palaces.find((palace) => palace.name === '官禄')!;
  const summary = buildPalaceSummary(payload, career);
  const index = buildPalaceIndex(payload).find((palace) => palace.宫位 === '官禄宫')!;
  assert.equal(summary.宫位关系, index.宫位关系);
  assert.match(summary.宫位关系, /对宫夫妻宫（戌）/);
  assert.doesNotMatch(summary.宫位关系, /迁移宫/);
  const focus = buildFocusTaskBundle(payload, { scope: 'origin', selectedTopic: 'career' });
  assert.ok(focus.focusPalaces.some((palace) => palace.name === '夫妻'));
  const related = focus.focusSummary.split('三方四正（')[1].split('）')[0];
  assert.match(related, /夫妻宫/);
  assert.doesNotMatch(related, /迁移/);
  const evidencePrompt = formatZiweiPayloadForPrompt(payload);
  for (const prompt of [evidencePrompt, formatZiweiEvidenceText(runtime)]) {
    assert.ok(prompt.includes(summary.宫位关系));
  }
  assert.ok(payload.evidence_pool.length > 0);
  for (const item of payload.evidence_pool.filter((fact) => fact.type === 'palace_major_stars')) {
    const palace = payload.palaces.find((candidate) => candidate.index === item.palace_indexes[0]);
    assert.ok(palace, item.title);
    const palaceLine = evidencePrompt
      .split('\n')
      .find((line) =>
        line.trimStart().startsWith(`${palace.name}${palace.name.endsWith('宫') ? '' : '宫'}`),
      );
    assert.ok(palaceLine?.includes('主星：'), item.title);
    for (const star of palace.major_stars) assert.ok(palaceLine.includes(star.name), item.title);
    assert.ok(!evidencePrompt.includes(`【${item.level}】${item.title}\n`), item.title);
  }
  for (const item of payload.evidence_pool) {
    assert.ok(!evidencePrompt.includes(`${item.title}：${item.title}：`), item.title);
  }
  const trineGroups = ['申子辰', '亥卯未', '寅午戌', '巳酉丑'];
  const oppositePairs = ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'];
  const reordered = { ...payload, palaces: [...payload.palaces].reverse() };
  for (const palace of payload.palaces) {
    const relation = formatPalaceRelations(reordered, palace);
    const expectedTrines = [...trineGroups.find((group) => group.includes(palace.earthly_branch))!]
      .filter((branch) => branch !== palace.earthly_branch)
      .sort();
    const trineText = relation.split('三合会照')[1].split('；')[0];
    assert.deepEqual(
      [...trineText.matchAll(/（(.)）/g)].map((match) => match[1]).sort(),
      expectedTrines,
    );
    const expectedOpposite = [
      ...oppositePairs.find((pair) => pair.includes(palace.earthly_branch))!,
    ].find((branch) => branch !== palace.earthly_branch);
    assert.ok(relation.split('对宫')[1].split('；')[0].includes(`（${expectedOpposite}）`));
    assert.equal(relation, formatPalaceRelations(payload, palace));
  }
});

test('跨时区星盘即时提示词携带四轴、十二宫、坐标及星体尊贵', () => {
  const chart = generateAstrolabe({
    year: '2026',
    month: '5',
    day: '18',
    hour: '22',
    minute: '30',
    latitude: '40.7128',
    longitude: '-74.0060',
    timezone: '-4',
    locationName: '纽约',
    useTrueSolarTime: false,
  });
  const prompt = buildInstantAstrolabePrompt(chart, '请解读当前事件。', '纽约当地时间');
  assert.match(prompt, /宫位制：普拉西德斯宫制/);
  assert.match(prompt, /普拉西德斯宫制（Placidus）/);
  assert.equal(chart.angles.length, 4);
  for (const point of chart.angles) {
    const label = point.name === 'Ascendant' ? '上升点' : point.label;
    assert.ok(prompt.includes(`${label}：${point.formatted}`), `缺少${label}的计算位置`);
  }
  assert.match(prompt, /观测坐标：北纬40\.7128°，西经74\.006°/);
  for (const house of chart.houses) {
    assert.ok(prompt.includes(`第${house.house}宫：${house.formatted}`));
  }
  for (const point of chart.planets.filter((item) => item.dignityLabel)) {
    assert.ok(prompt.includes(`${point.label}${point.formatted}，第${point.house}宫`));
    assert.ok(prompt.includes(`，${point.dignityLabel}`));
  }
});
