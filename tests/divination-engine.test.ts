import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDivinationSession } from '../src/lib/divination/engine';
import { buildTimeInfoText } from '../src/lib/divination/engine/formatters';
import type { QimenJiuGongGe } from '../packages/core/src/types/divination';
import { STEM_TOMB_MAP } from '../packages/core/src/divination/algorithms/qimen/helpers/_constants';
import {
  getClassicPatterns,
  getStemRelations,
} from '../packages/core/src/divination/algorithms/qimen/helpers/classic-patterns';
import type { ClassicPattern } from '../packages/core/src/divination/algorithms/qimen/helpers/classic-patterns';
import { getStemPairPattern } from '../packages/core/src/divination/algorithms/qimen/helpers/stem-pair-patterns';
import {
  buildPatternDetails,
  getQimenPatternTags,
} from '../packages/core/src/divination/algorithms/qimen/helpers/patterns';
import { detectQimenPatternCombos } from '../packages/core/src/divination/algorithms/qimen/helpers/pattern-combos';
import {
  buildDirectionAdvice,
  getPalaceScore,
} from '../packages/core/src/divination/algorithms/qimen/helpers/directions';
import {
  checkSpecialHourConditions,
  getZhiFuZhiShi,
} from '../packages/core/src/divination/algorithms/qimen/helpers/jushu';
import { arrangeJiuGongGe } from '../packages/core/src/divination/algorithms/qimen/helpers/layout';
import { estimateYingQi } from '../packages/core/src/divination/algorithms/qimen/helpers/ying-qi';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { generateQimen, resolveZhiShiLandingPalace } from 'mingyu-core/divination/qimen';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

type DivinationDraftInput = Parameters<typeof generateDivinationSession>[0];

function buildDraft(overrides: Partial<DivinationDraftInput>): DivinationDraftInput {
  return {
    method: 'liuyao',
    question: '这件事接下来该怎么推进？',
    questionSource: 'inspiration',
    gender: '',
    birthYear: '',
    meihuaMethod: 'time',
    meihuaNumber: '',
    xiaoliurenMethod: 'time',
    xiaoliurenNumber: '',
    meihuaFocus: 'general',
    xiaoliurenFocus: 'general',
    qimenFocus: 'general',
    liuyaoTemplate: 'general',
    liurenTemplate: 'general',
    tarotSpread: 'three',
    almanacTopic: 'move',
    almanacStartDate: '2026-06-01',
    almanacEndDate: '2026-06-05',
    almanacParticipants: [],
    lenormandSpread: 'three',
    astrolabeName: '本人',
    astrolabeGender: '女',
    astrolabeYear: '1995',
    astrolabeMonth: '5',
    astrolabeDay: '20',
    astrolabeHour: '12',
    astrolabeMinute: '30',
    astrolabeLatitude: '39.9042',
    astrolabeLongitude: '116.4074',
    astrolabeTimezone: '8',
    ...overrides,
  };
}

const qimenPalaceNameByGong: Record<number, string> = {
  1: '坎一宫',
  2: '坤二宫',
  3: '震三宫',
  4: '巽四宫',
  5: '中五宫',
  6: '乾六宫',
  7: '兑七宫',
  8: '艮八宫',
  9: '离九宫',
};

function buildQimenPalace(
  gong: number,
  heavenStem: string,
  overrides: Partial<Pick<QimenJiuGongGe, 'tianPan' | 'diPan' | 'renPan' | 'shenPan'>> = {},
): QimenJiuGongGe {
  return {
    gong,
    name: qimenPalaceNameByGong[gong] ?? `${gong}宫`,
    direction: '',
    element: '土',
    tianPan: overrides.tianPan ?? { star: '', stem: heavenStem },
    diPan: overrides.diPan ?? { stem: '甲' },
    renPan: overrides.renPan ?? { door: '' },
    shenPan: overrides.shenPan ?? { god: '' },
  };
}

function buildClassicPattern(overrides: Partial<ClassicPattern>): ClassicPattern {
  return {
    key: 'test-pattern',
    name: '测试格局',
    tone: 'neutral',
    score: 0,
    summary: '',
    modern: '',
    ...overrides,
  };
}

test('六爻算法会补出伏神结构，供提示词直接引用', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'));

  assert.ok(Array.isArray(data.hiddenSpirits));
  assert.ok(
    data.hiddenSpirits.every(
      (item) =>
        item.sixRelative &&
        item.najiaDizhi &&
        item.wuxing &&
        typeof item.position === 'number' &&
        item.underYao,
    ),
  );
});

test('奇门算法会补出时旬空亡与马星落宫', () => {
  const data = generateQimen(new Date('2025-01-01T08:00:00+08:00'));

  assert.ok(data.voidBranches?.length);
  assert.ok(data.voidPalaces?.length);
  assert.ok(data.voidPalaces.every((item) => item.branch && item.palace && item.name));
  assert.ok(data.horseStar?.branch);
  assert.ok(data.horseStar?.palace);
  assert.ok(data.horseStar?.name);
  assert.ok(data.horseStar?.sourceBranch);
});

test('奇门五不遇时应按日干克应判断，不只看时辰干支', () => {
  assert.equal(checkSpecialHourConditions('庚午', '甲戌').isWuBuYuShi, true);
  assert.equal(checkSpecialHourConditions('戊寅', '庚午').isWuBuYuShi, false);
  assert.equal(checkSpecialHourConditions('戊寅').isWuBuYuShi, false);

  const falsePositiveCase = generateQimen(new Date('2025-01-01T04:00:00+08:00'));
  assert.equal(falsePositiveCase.ganzhi.day, '庚午');
  assert.equal(falsePositiveCase.ganzhi.hour, '戊寅');
  assert.equal(falsePositiveCase.specialConditions?.isWuBuYuShi, false);

  const trueCase = generateQimen(new Date('2025-01-05T12:00:00+08:00'));
  assert.equal(trueCase.ganzhi.day, '甲戌');
  assert.equal(trueCase.ganzhi.hour, '庚午');
  assert.equal(trueCase.specialConditions?.isWuBuYuShi, true);
});

test('奇门时干入墓应按宝鉴校正时辰表判断', () => {
  for (const ganZhi of ['戊辰', '壬辰', '己未', '癸未', '辛丑']) {
    const conditions = checkSpecialHourConditions(ganZhi);
    assert.equal(conditions.isShiGanRuMu, true, `${ganZhi}应判为时干入墓`);
    assert.match(conditions.description, /时干入墓/);
  }

  for (const ganZhi of ['乙未', '丙戌', '丁丑']) {
    const conditions = checkSpecialHourConditions(ganZhi);
    assert.equal(conditions.isShiGanRuMu, true, `${ganZhi}应判为三奇日时干入墓`);
    assert.match(conditions.description, /三奇日时干入墓/);
  }

  const oldWrongCase = checkSpecialHourConditions('戊戌');
  assert.equal(oldWrongCase.isShiGanRuMu, false);
  assert.doesNotMatch(oldWrongCase.description, /时干入墓/);
});

test('奇门值符值使应按当前局地盘旬首落宫定位', () => {
  const yangNine = getZhiFuZhiShi('丙辰', '癸亥', { isYangDun: true, juShu: 9 });
  assert.equal(yangNine.zhiFu, '天禽');
  assert.equal(yangNine.zhiShi, '死门');
  assert.equal(yangNine.zhiFuPalace, 5);

  const yangNinePalaces = arrangeJiuGongGe(true, 9, yangNine.zhiFu, yangNine.zhiShi, {
    hour: '丙辰',
  });
  assert.equal(yangNinePalaces.find((gong) => gong.gong === 5)?.diPan.stem, '癸');
  assert.equal(yangNinePalaces.find((gong) => gong.tianPan.star === '天禽')?.gong, 7);

  const yinEight = getZhiFuZhiShi('辛未', '甲寅', { isYangDun: false, juShu: 8 });
  assert.equal(yinEight.zhiFu, '天任');
  assert.equal(yinEight.zhiFuPalace, 8);

  const yinEightPalaces = arrangeJiuGongGe(false, 8, yinEight.zhiFu, yinEight.zhiShi, {
    hour: '辛未',
  });
  assert.equal(yinEightPalaces.find((gong) => gong.gong === 5)?.diPan.stem, '辛');
  assert.equal(yinEightPalaces.find((gong) => gong.tianPan.star === '天任')?.gong, 5);
});

test('奇门八神应按宝鉴坎一起例分阳逆阴顺', () => {
  const godsByGong = (isYangDun: boolean) =>
    Object.fromEntries(
      arrangeJiuGongGe(isYangDun, 1, '天蓬', '休门', { hour: '甲子' })
        .filter((palace) => palace.shenPan.god)
        .map((palace) => [palace.gong, palace.shenPan.god]),
    );

  assert.deepEqual(godsByGong(true), {
    1: '值符',
    2: '玄武',
    3: '太阴',
    4: '六合',
    6: '九天',
    7: '九地',
    8: '螣蛇',
    9: '白虎',
  });
  assert.deepEqual(godsByGong(false), {
    1: '值符',
    2: '六合',
    3: '九地',
    4: '玄武',
    6: '螣蛇',
    7: '太阴',
    8: '九天',
    9: '白虎',
  });
});

test('奇门庚格应期应按日干阴阳判断，不应误用时干', () => {
  const result = estimateYingQi(
    [
      {
        gong: 1,
        tianPan: { stem: '庚', star: '' },
        diPan: { stem: '甲' },
      },
      {
        gong: 2,
        tianPan: { stem: '乙', star: '' },
        diPan: { stem: '庚' },
      },
    ],
    2,
    {
      dayGanZhi: '甲子',
      hourGanZhi: '乙丑',
    },
  );

  const sourcesText = result.sources.join('\n');
  assert.match(sourcesText, /阳日（甲日）见庚在地盘2宫/);
  assert.doesNotMatch(sourcesText, /阴日（乙日）见庚在天盘1宫/);
});

test('奇门应期内外宫应随阴阳遁切换', () => {
  const yangInner = estimateYingQi([], 8, {
    isYangDun: true,
    zhiFuLandingPalace: 8,
  });
  assert.equal(yangInner.rhythm, '快');
  assert.ok(yangInner.sources.some((source) => source.includes('阳遁内宫速应')));
  assert.ok(!yangInner.sources.some((source) => source.includes('外宫迟应')));
  assert.match(yangInner.description, /内宫用神/);
  assert.doesNotMatch(yangInner.description, /外宫用神/);

  const yinInner = estimateYingQi([], 9, {
    isYangDun: false,
    zhiFuLandingPalace: 9,
  });
  assert.equal(yinInner.rhythm, '快');
  assert.ok(yinInner.sources.some((source) => source.includes('阴遁内宫速应')));
  assert.match(yinInner.description, /内宫用神/);

  const yangOuter = estimateYingQi([], 9, {
    isYangDun: true,
    zhiFuLandingPalace: 9,
  });
  assert.equal(yangOuter.rhythm, '慢');
  assert.ok(yangOuter.sources.some((source) => source.includes('阳遁外宫迟应')));
  assert.match(yangOuter.description, /外宫用神/);
});

test('奇门应期空亡只应在用神落空时延迟', () => {
  const notVoid = generateQimen(new Date('2025-01-01T00:00:00+08:00'));
  const notVoidZhiFuPalace = notVoid.jiuGongGe.find(
    (palace) => palace.tianPan.star === notVoid.zhiFu,
  )?.gong;
  assert.equal(notVoid.ganzhi.hour, '丙子');
  assert.ok(!notVoid.voidPalaces?.some((item) => item.palace === notVoidZhiFuPalace));
  assert.ok(!notVoid.yingQi?.sources.some((source) => source.includes('空亡入局')));

  const voidHit = generateQimen(new Date('2025-01-01T04:00:00+08:00'));
  const voidHitZhiFuPalace = voidHit.jiuGongGe.find(
    (palace) => palace.tianPan.star === voidHit.zhiFu,
  )?.gong;
  assert.equal(voidHit.ganzhi.hour, '戊寅');
  assert.ok(voidHit.voidPalaces?.some((item) => item.palace === voidHitZhiFuPalace));
  assert.ok(voidHit.yingQi?.sources.some((source) => source.includes('空亡入局')));
  assert.ok(voidHit.yingQi?.sources.some((source) => source.includes('空亡在酉')));
  assert.ok(!voidHit.yingQi?.sources.some((source) => source.includes('空亡在申')));
});

test('奇门应期马星只应在命中值符或值使宫时加快', () => {
  const getZhiShiPalace = (data: ReturnType<typeof generateQimen>) =>
    data.jiuGongGe.find((palace) => palace.renPan.door === data.zhiShi)?.gong;

  const inactive = generateQimen(new Date('2025-01-01T00:00:00+08:00'));
  assert.notEqual(inactive.horseStar?.palace, getZhiShiPalace(inactive));
  assert.ok(!inactive.yingQi?.sources.some((source) => source.includes('驿马发动')));

  const active = generateQimen(new Date('2025-01-01T06:00:00+08:00'));
  assert.equal(active.horseStar?.palace, getZhiShiPalace(active));
  assert.ok(active.yingQi?.sources.some((source) => source.includes('驿马发动')));
  assert.ok(active.yingQi?.description.includes('马星冲动'));
});

test('奇门算法会输出节令背景与复合格局结构', () => {
  const data = generateQimen(new Date('2025-01-01T08:00:00+08:00'));

  assert.ok(data.seasonality);
  assert.equal(typeof data.seasonality.currentJieQi, 'string');
  assert.equal(typeof data.seasonality.seasonalElement, 'string');
  assert.equal(typeof data.seasonality.dayOfficer, 'string');
  assert.ok(Array.isArray(data.seasonality.ganzhiInteractions));

  assert.ok(Array.isArray(data.patternCombos));
  assert.ok(
    data.patternCombos.every(
      (combo) =>
        combo.key &&
        combo.name &&
        ['super-good', 'super-bad', 'mixed'].includes(combo.tone) &&
        typeof combo.score === 'number' &&
        Array.isArray(combo.sources),
    ),
  );
});

test('奇门复合格局应按同宫门神叠加识别', () => {
  const baihuPattern = buildClassicPattern({
    key: 'pattern:baihu:2',
    name: '白虎猖狂',
    tone: 'bad',
    score: -8,
    palace: 2,
  });
  const deShiPattern = buildClassicPattern({
    key: 'pattern:deShi:1',
    name: '日奇得使',
    tone: 'good',
    score: 8,
    palace: 1,
  });

  const combos = detectQimenPatternCombos({
    classicPatterns: [baihuPattern, deShiPattern],
    patternTags: ['门迫（坤二宫伤门）'],
    jiuGongGe: [
      buildQimenPalace(1, '乙', {
        renPan: { door: '开门' },
        shenPan: { god: '六合' },
      }),
      buildQimenPalace(2, '辛', {
        renPan: { door: '伤门' },
        shenPan: { god: '白虎' },
      }),
    ],
  });

  assert.ok(combos.some((combo) => combo.name === '白虎助凶' && combo.palace === 2));
  assert.ok(combos.some((combo) => combo.name === '迫上加凶' && combo.palace === 2));
  assert.ok(combos.some((combo) => combo.name === '吉门三奇' && combo.palace === 1));

  const crossPalace = detectQimenPatternCombos({
    classicPatterns: [baihuPattern, deShiPattern],
    patternTags: ['门迫（坤二宫伤门）'],
    jiuGongGe: [
      buildQimenPalace(1, '乙', {
        renPan: { door: '杜门' },
        shenPan: { god: '玄武' },
      }),
      buildQimenPalace(2, '辛', {
        renPan: { door: '开门' },
        shenPan: { god: '六合' },
      }),
      buildQimenPalace(3, '戊', {
        renPan: { door: '死门' },
        shenPan: { god: '白虎' },
      }),
    ],
  });

  assert.ok(!crossPalace.some((combo) => combo.name === '白虎助凶'));
  assert.ok(!crossPalace.some((combo) => combo.name === '迫上加凶'));
  assert.ok(!crossPalace.some((combo) => combo.name === '吉门三奇'));
});

test('奇门复合格局应按丁壬化木同宫门类输出用门提示', () => {
  const buildDingRenCombos = (door: string, palace = 4) =>
    detectQimenPatternCombos({
      classicPatterns: [
        buildClassicPattern({
          key: `pattern:dingRen:${door}`,
          name: '丁壬化木',
          tone: 'good',
          score: 4,
          palace,
        }),
      ],
      jiuGongGe: [
        buildQimenPalace(palace, '丁', {
          renPan: { door },
        }),
      ],
    });

  const hurtCombo = buildDingRenCombos('伤门').find(
    (combo) => combo.name === '丁壬逢伤杜' && combo.palace === 4,
  );
  assert.ok(hurtCombo);
  assert.match(hurtCombo.summary, /伤门/);
  assert.match(hurtCombo.summary, /防伤害|不宜强用/);

  const shengMenCombo = buildDingRenCombos('生门', 6).find(
    (combo) => combo.name === '丁壬生门利遁' && combo.palace === 6,
  );
  assert.ok(shengMenCombo);
  assert.match(shengMenCombo.summary, /逃亡绝迹/);

  const otherDoor = buildDingRenCombos('开门', 2);
  assert.ok(!otherDoor.some((combo) => combo.name === '丁壬逢伤杜'));
});

test('奇门复合格局应按白虎猖狂同宫门类输出强弱提示', () => {
  const buildBaihuCombos = (door: string, palace = 4) =>
    detectQimenPatternCombos({
      classicPatterns: [
        buildClassicPattern({
          key: `pattern:baihu:${door}`,
          name: '白虎猖狂',
          tone: 'bad',
          score: -8,
          palace,
        }),
      ],
      jiuGongGe: [
        buildQimenPalace(palace, '辛', {
          renPan: { door },
        }),
      ],
    });

  const kaiDoorCombo = buildBaihuCombos('开门').find(
    (combo) => combo.name === '白虎会开惊' && combo.palace === 4,
  );
  assert.ok(kaiDoorCombo);
  assert.match(kaiDoorCombo.summary, /开门/);
  assert.match(kaiDoorCombo.summary, /客势更锐/);

  const xiuDoorCombo = buildBaihuCombos('休门', 1).find(
    (combo) => combo.name === '白虎逢休门' && combo.palace === 1,
  );
  assert.ok(xiuDoorCombo);
  assert.match(xiuDoorCombo.summary, /休门/);

  const otherDoor = buildBaihuCombos('生门', 8);
  assert.ok(!otherDoor.some((combo) => combo.name === '白虎会开惊'));
});

test('奇门复合格局应按青龙返首飞鸟跌穴输出主客与生门提示', () => {
  const qingLongCombos = detectQimenPatternCombos({
    classicPatterns: [
      buildClassicPattern({
        name: '青龙返首',
        tone: 'good',
        score: 8,
        palace: 3,
      }),
    ],
    jiuGongGe: [buildQimenPalace(3, '戊', { renPan: { door: '开门' } })],
  });
  const qingLongHost = qingLongCombos.find((combo) => combo.name === '青龙返首利主');
  assert.equal(qingLongHost?.palace, 3);
  assert.match(qingLongHost?.summary || '', /甲加丙利为主/);

  const flyingBirdWithShengMen = detectQimenPatternCombos({
    classicPatterns: [
      buildClassicPattern({
        name: '飞鸟跌穴',
        tone: 'good',
        score: 8,
        palace: 4,
      }),
    ],
    jiuGongGe: [buildQimenPalace(4, '丙', { renPan: { door: '生门' } })],
  });
  const flyingBirdGuest = flyingBirdWithShengMen.find(
    (combo) => combo.name === '飞鸟跌穴利客',
  );
  assert.equal(flyingBirdGuest?.palace, 4);
  assert.match(flyingBirdGuest?.summary || '', /丙加甲利为客/);
  const flyingBirdShengMen = flyingBirdWithShengMen.find(
    (combo) => combo.name === '飞鸟会生门',
  );
  assert.match(flyingBirdShengMen?.summary || '', /会合生门相助/);

  const flyingBirdWithXiuMen = detectQimenPatternCombos({
    classicPatterns: [
      buildClassicPattern({
        name: '飞鸟跌穴',
        tone: 'good',
        score: 8,
        palace: 4,
      }),
    ],
    jiuGongGe: [buildQimenPalace(4, '丙', { renPan: { door: '休门' } })],
  });
  assert.ok(flyingBirdWithXiuMen.some((combo) => combo.name === '飞鸟跌穴利客'));
  assert.ok(!flyingBirdWithXiuMen.some((combo) => combo.name === '飞鸟会生门'));
});

test('奇门复合格局应按朱雀投江螣蛇夭矫输出主客守避提示', () => {
  const zhuqueCombos = detectQimenPatternCombos({
    classicPatterns: [
      buildClassicPattern({
        name: '朱雀投江',
        tone: 'bad',
        score: -7,
        palace: 7,
      }),
    ],
    jiuGongGe: [buildQimenPalace(7, '丁', { renPan: { door: '惊门' } })],
  });
  const zhuqueHost = zhuqueCombos.find((combo) => combo.name === '朱雀投江利主');
  assert.equal(zhuqueHost?.palace, 7);
  assert.match(zhuqueHost?.summary || '', /主胜客败/);

  const tengsheCombos = detectQimenPatternCombos({
    classicPatterns: [
      buildClassicPattern({
        name: '螣蛇夭矫',
        tone: 'bad',
        score: -7,
        palace: 1,
      }),
    ],
    jiuGongGe: [
      buildQimenPalace(1, '癸', { renPan: { door: '休门' } }),
      buildQimenPalace(8, '戊'),
      buildQimenPalace(2, '己'),
    ],
  });
  const tengsheHold = tengsheCombos.find((combo) => combo.name === '螣蛇夭矫宜守');
  assert.equal(tengsheHold?.palace, 1);
  assert.match(tengsheHold?.summary || '', /主军宜固守/);
  const tengsheMove = tengsheCombos.find((combo) => combo.name === '螣蛇迁戊己');
  assert.match(tengsheMove?.summary || '', /甲子戊、甲戌己两土宫/);
  assert.match(tengsheMove?.summary || '', /天盘戊所在艮八宫/);
});

test('奇门复合格局应按月令输出八门余气旺相休囚废', () => {
  const combos = detectQimenPatternCombos({
    monthBranch: '寅',
    jiuGongGe: [
      buildQimenPalace(1, '壬', { renPan: { door: '休门' } }),
      buildQimenPalace(3, '乙', { renPan: { door: '伤门' } }),
      buildQimenPalace(6, '庚', { renPan: { door: '开门' } }),
      buildQimenPalace(8, '戊', { renPan: { door: '生门' } }),
      buildQimenPalace(9, '丙', { renPan: { door: '景门' } }),
    ],
  });
  const doorSeasonQi = combos.find((combo) => combo.name === '八门余气');
  assert.equal(doorSeasonQi?.tone, 'mixed');
  assert.match(doorSeasonQi?.summary || '', /寅月属木/);
  assert.match(doorSeasonQi?.summary || '', /坎一宫休门属水为相/);
  assert.match(doorSeasonQi?.summary || '', /震三宫伤门属木为旺/);
  assert.match(doorSeasonQi?.summary || '', /乾六宫开门属金为休/);
  assert.match(doorSeasonQi?.summary || '', /艮八宫生门属土为囚/);
  assert.match(doorSeasonQi?.summary || '', /离九宫景门属火为废/);
  assert.match(doorSeasonQi?.summary || '', /我生者为相/);
  assert.match(doorSeasonQi?.summary || '', /生我者为废/);

  const noMonthBranch = detectQimenPatternCombos({
    jiuGongGe: [buildQimenPalace(1, '壬', { renPan: { door: '休门' } })],
  });
  assert.ok(!noMonthBranch.some((combo) => combo.name === '八门余气'));
});

test('奇门复合格局应输出射覆物象克应线索', () => {
  const combos = detectQimenPatternCombos({
    jiuGongGe: [
      buildQimenPalace(1, '壬', {
        tianPan: { stem: '壬', star: '天蓬' },
        renPan: { door: '休门' },
        shenPan: { god: '值符' },
      }),
      buildQimenPalace(9, '丙', {
        tianPan: { stem: '丙', star: '天英' },
        renPan: { door: '景门' },
        shenPan: { god: '九天' },
      }),
    ],
  });

  const objectClue = combos.find((combo) => combo.name === '射覆物象克应');
  assert.equal(objectClue?.tone, 'mixed');
  assert.match(objectClue?.summary || '', /坎一宫/);
  assert.match(objectClue?.summary || '', /天盘壬主水族纹曲/);
  assert.match(objectClue?.summary || '', /值符主贵物财帛/);
  assert.match(objectClue?.summary || '', /离九宫/);
  assert.match(objectClue?.summary || '', /天盘丙主火性尖斜华彩/);

  const noObjectClue = detectQimenPatternCombos({
    jiuGongGe: [buildQimenPalace(1, '', {})],
  });
  assert.ok(!noObjectClue.some((combo) => combo.name === '射覆物象克应'));
});

test('奇门复合格局应按明列宫位输出十干迫制', () => {
  const combos = detectQimenPatternCombos({
    jiuGongGe: [
      buildQimenPalace(6, '乙'),
      buildQimenPalace(1, '丙'),
      buildQimenPalace(3, '戊'),
      buildQimenPalace(9, '庚'),
      buildQimenPalace(2, '壬'),
    ],
  });

  const stemPressure = combos.find((combo) => combo.name === '十干迫制');
  assert.equal(stemPressure?.tone, 'mixed');
  assert.match(stemPressure?.summary || '', /乾六宫天盘乙属木临金宫，木被金克/);
  assert.match(stemPressure?.summary || '', /坎一宫天盘丙属火临水宫，火被水克/);
  assert.match(stemPressure?.summary || '', /震三宫天盘戊属土临木宫，土被木克/);
  assert.match(stemPressure?.summary || '', /离九宫天盘庚属金临火宫，金被火克/);
  assert.match(stemPressure?.summary || '', /坤二宫天盘壬属水临土宫，水被土克/);
  assert.match(stemPressure?.summary || '', /甲乙金宫/);
  assert.match(stemPressure?.summary || '', /壬癸生死方/);

  const noPressure = detectQimenPatternCombos({
    jiuGongGe: [
      buildQimenPalace(5, '壬'),
      buildQimenPalace(6, '丙'),
    ],
  });
  assert.ok(!noPressure.some((combo) => combo.name === '十干迫制'));
});

test('奇门复合格局应输出三胜地与五不击方位', () => {
  const combos = detectQimenPatternCombos({
    zhiFu: '天英',
    zhiShi: '开门',
    jiuGongGe: [
      buildQimenPalace(9, '丁', {
        tianPan: { star: '天英', stem: '丁' },
        renPan: { door: '景门' },
        shenPan: { god: '值符' },
      }),
      buildQimenPalace(1, '庚', {
        tianPan: { star: '天蓬', stem: '庚' },
        renPan: { door: '休门' },
        shenPan: { god: '玄武' },
      }),
      buildQimenPalace(4, '乙', {
        tianPan: { star: '天辅', stem: '乙' },
        renPan: { door: '杜门' },
        shenPan: { god: '九天' },
      }),
      buildQimenPalace(8, '戊', {
        tianPan: { star: '天任', stem: '戊' },
        renPan: { door: '生门' },
        shenPan: { god: '螣蛇' },
      }),
      buildQimenPalace(2, '己', {
        tianPan: { star: '天芮', stem: '己' },
        renPan: { door: '死门' },
        shenPan: { god: '九地' },
      }),
      buildQimenPalace(6, '辛', {
        tianPan: { star: '天心', stem: '辛' },
        renPan: { door: '开门' },
        shenPan: { god: '六合' },
      }),
    ],
  });

  const sanSheng = combos.find((combo) => combo.name === '三胜地');
  assert.equal(sanSheng?.tone, 'super-good');
  assert.ok(sanSheng?.sources.includes('值符星天英落离九宫'));

  const tianYiJiChong = combos.find((combo) => combo.name === '天乙击冲');
  assert.equal(tianYiJiChong?.tone, 'mixed');
  assert.equal(tianYiJiChong?.palace, 9);
  assert.match(tianYiJiChong?.summary || '', /击其对冲坎一宫/);

  const wuBuJi = combos.find((combo) => combo.name === '五不击');
  assert.equal(wuBuJi?.tone, 'mixed');
  assert.match(wuBuJi?.summary || '', /攻守禁忌/);
  assert.ok(wuBuJi?.sources.includes('值使开门：乾六宫'));
});

test('奇门复合格局应按值使落宫识别趋三避五', () => {
  const quSanCombos = detectQimenPatternCombos({
    zhiShi: '伤门',
    jiuGongGe: [
      buildQimenPalace(3, '庚', {
        renPan: { door: '伤门' },
      }),
      buildQimenPalace(4, '乙', {
        renPan: { door: '杜门' },
      }),
    ],
  });

  assert.ok(quSanCombos.some((combo) => combo.name === '趋三' && combo.palace === 3));
  assert.ok(!quSanCombos.some((combo) => combo.name === '避五'));

  const biWuCombos = detectQimenPatternCombos({
    zhiShi: '杜门',
    jiuGongGe: [
      buildQimenPalace(3, '庚', {
        renPan: { door: '伤门' },
      }),
      buildQimenPalace(4, '乙', {
        renPan: { door: '杜门' },
      }),
    ],
  });

  const biWu = biWuCombos.find((combo) => combo.name === '避五');
  assert.equal(biWu?.palace, 4);
  assert.equal(biWu?.tone, 'mixed');
  assert.match(biWu?.summary || '', /不作通用凶方扣分/);
  assert.ok(!biWuCombos.some((combo) => combo.name === '趋三'));
});

test('奇门复合格局应按值使门所在宫输出八将会门', () => {
  const combos = detectQimenPatternCombos({
    zhiShi: '伤门',
    jiuGongGe: [
      buildQimenPalace(7, '戊', {
        renPan: { door: '伤门' },
        shenPan: { god: '螣蛇' },
      }),
      buildQimenPalace(1, '乙', {
        renPan: { door: '休门' },
        shenPan: { god: '六合' },
      }),
    ],
  });

  const baJiang = combos.find((combo) => combo.name === '八将会门');
  assert.equal(baJiang?.tone, 'mixed');
  assert.equal(baJiang?.palace, 7);
  assert.match(baJiang?.summary || '', /螣蛇会伤门/);
  assert.match(baJiang?.summary || '', /收用天盘不用地盘/);
  assert.ok(baJiang?.sources.includes('值使伤门：兑七宫'));
  assert.ok(baJiang?.sources.includes('螣蛇会伤门'));

  const noZhiShi = detectQimenPatternCombos({
    jiuGongGe: [
      buildQimenPalace(7, '戊', {
        renPan: { door: '伤门' },
        shenPan: { god: '螣蛇' },
      }),
    ],
  });
  assert.ok(!noZhiShi.some((combo) => combo.name === '八将会门'));

  const noGod = detectQimenPatternCombos({
    zhiShi: '伤门',
    jiuGongGe: [
      buildQimenPalace(7, '戊', {
        renPan: { door: '伤门' },
      }),
    ],
  });
  assert.ok(!noGod.some((combo) => combo.name === '八将会门'));
});

test('奇门复合格局应按日干输出游都鲁都方位', () => {
  const jiuGongGe = [
    buildQimenPalace(1, '戊'),
    buildQimenPalace(2, '己'),
    buildQimenPalace(4, '辛'),
    buildQimenPalace(6, '壬'),
    buildQimenPalace(8, '癸'),
  ];

  const jiaCombos = detectQimenPatternCombos({
    dayStem: '甲',
    jiuGongGe,
  });
  const jiaYouDu = jiaCombos.find((combo) => combo.name === '游都鲁都');
  assert.match(jiaYouDu?.summary || '', /甲日游都在丑支艮八宫/);
  assert.match(jiaYouDu?.summary || '', /鲁都在未支坤二宫/);

  const dingCombos = detectQimenPatternCombos({
    dayStem: '丁',
    jiuGongGe,
  });
  const dingYouDu = dingCombos.find((combo) => combo.name === '游都鲁都');
  assert.match(dingYouDu?.summary || '', /丁日游都在巳支巽四宫/);
  assert.match(dingYouDu?.summary || '', /鲁都在亥支乾六宫/);

  const noDayStem = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noDayStem.some((combo) => combo.name === '游都鲁都'));
});

test('奇门复合格局应按日干输出攻方避忌', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const jiaCombos = detectQimenPatternCombos({
    dayStem: '甲',
    jiuGongGe,
  });
  const jiaAvoidance = jiaCombos.find((combo) => combo.name === '日干攻方避忌');
  assert.match(jiaAvoidance?.summary || '', /甲日不宜攻正西/);
  assert.match(jiaAvoidance?.summary || '', /兑七宫/);

  const renCombos = detectQimenPatternCombos({
    dayStem: '壬',
    jiuGongGe,
  });
  const renAvoidance = renCombos.find((combo) => combo.name === '日干攻方避忌');
  assert.match(renAvoidance?.summary || '', /壬日不宜攻四维/);
  assert.match(renAvoidance?.summary || '', /艮八宫、巽四宫、坤二宫、乾六宫/);

  const noDayStem = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noDayStem.some((combo) => combo.name === '日干攻方避忌'));
});

test('奇门复合格局应按月支输出雄雌方位', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const springCombos = detectQimenPatternCombos({
    monthBranch: '寅',
    jiuGongGe,
  });
  const springXiongCi = springCombos.find((combo) => combo.name === '雄雌方');
  assert.match(springXiongCi?.summary || '', /寅月以寅支艮八宫为雄/);
  assert.match(springXiongCi?.summary || '', /申支坤二宫为雌/);

  const autumnCombos = detectQimenPatternCombos({
    monthBranch: '酉',
    jiuGongGe,
  });
  const autumnXiongCi = autumnCombos.find((combo) => combo.name === '雄雌方');
  assert.match(autumnXiongCi?.summary || '', /酉月以申支坤二宫为雄/);
  assert.match(autumnXiongCi?.summary || '', /寅支艮八宫为雌/);

  const noMonthBranch = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noMonthBranch.some((combo) => combo.name === '雄雌方'));
});

test('奇门复合格局应按日支输出五将方', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const yinCombos = detectQimenPatternCombos({
    dayBranch: '寅',
    jiuGongGe,
  });
  const yinWuJiang = yinCombos.find((combo) => combo.name === '五将方');
  assert.equal(yinWuJiang?.palace, 3);
  assert.match(yinWuJiang?.summary || '', /寅日五将方在东方/);
  assert.match(yinWuJiang?.summary || '', /震三宫/);

  const siCombos = detectQimenPatternCombos({
    dayBranch: '巳',
    jiuGongGe,
  });
  const siWuJiang = siCombos.find((combo) => combo.name === '五将方');
  assert.equal(siWuJiang?.palace, 1);
  assert.match(siWuJiang?.summary || '', /巳日五将方在北方/);
  assert.match(siWuJiang?.summary || '', /坎一宫/);

  const noDayBranch = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noDayBranch.some((combo) => combo.name === '五将方'));
});

test('奇门复合格局应按年支输出大将军方', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const yinCombos = detectQimenPatternCombos({
    yearBranch: '寅',
    jiuGongGe,
  });
  const yinDaJiangJun = yinCombos.find((combo) => combo.name === '大将军方');
  assert.equal(yinDaJiangJun?.palace, 4);
  assert.match(yinDaJiangJun?.summary || '', /寅年大将军在巳支巽四宫/);

  const haiCombos = detectQimenPatternCombos({
    yearBranch: '亥',
    jiuGongGe,
  });
  const haiDaJiangJun = haiCombos.find((combo) => combo.name === '大将军方');
  assert.equal(haiDaJiangJun?.palace, 7);
  assert.match(haiDaJiangJun?.summary || '', /亥年大将军在酉支兑七宫/);

  const noYearBranch = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noYearBranch.some((combo) => combo.name === '大将军方'));
});

test('奇门复合格局应按年支与月支输出太岁方和月建方', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const combos = detectQimenPatternCombos({
    yearBranch: '子',
    monthBranch: '卯',
    jiuGongGe,
  });
  const taiSui = combos.find((combo) => combo.name === '太岁方');
  assert.equal(taiSui?.palace, 1);
  assert.match(taiSui?.summary || '', /子年太岁在地盘子支坎一宫/);

  const yueJian = combos.find((combo) => combo.name === '月建方');
  assert.equal(yueJian?.palace, 3);
  assert.match(yueJian?.summary || '', /卯月月建在地盘卯支震三宫/);

  const noBranches = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noBranches.some((combo) => combo.name === '太岁方'));
  assert.ok(!noBranches.some((combo) => combo.name === '月建方'));
});

test('奇门复合格局应输出太阴方与河魁方', () => {
  const godByGong: Record<number, string> = {
    3: '九天',
    4: '太阴',
    6: '六合',
    7: '九地',
  };
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) =>
    buildQimenPalace(gong, '戊', {
      shenPan: { god: godByGong[gong] || '' },
    }),
  );

  const combos = detectQimenPatternCombos({
    jiuGongGe,
  });
  const taiYin = combos.find((combo) => combo.name === '太阴方');
  assert.equal(taiYin?.palace, 4);
  assert.match(taiYin?.summary || '', /八神太阴在巽四宫/);

  const fourGods = combos.find((combo) => combo.name === '四神用方');
  assert.match(fourGods?.summary || '', /九天在震三宫宜扬兵/);
  assert.match(fourGods?.summary || '', /太阴在巽四宫宜伏兵/);

  const heKui = combos.find((combo) => combo.name === '河魁方');
  assert.equal(heKui?.palace, 6);
  assert.match(heKui?.summary || '', /河魁为戌支/);

  const noTaiYin = detectQimenPatternCombos({
    jiuGongGe: [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊')),
  });
  assert.ok(!noTaiYin.some((combo) => combo.name === '太阴方'));
});

test('奇门复合格局应按当前局六甲旬输出天目地耳', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const jiaZiXunCombos = detectQimenPatternCombos({
    activeGanZhi: '乙丑',
    jiuGongGe,
  });
  const jiaZiTianMuDiEr = jiaZiXunCombos.find((combo) => combo.name === '天目地耳');
  assert.match(jiaZiTianMuDiEr?.summary || '', /乙丑属甲子旬/);
  assert.match(jiaZiTianMuDiEr?.summary || '', /天目为庚午（离九宫）/);
  assert.match(jiaZiTianMuDiEr?.summary || '', /地耳为戊辰（巽四宫）/);

  const jiaYinXunCombos = detectQimenPatternCombos({
    activeGanZhi: '癸亥',
    jiuGongGe,
  });
  const jiaYinTianMuDiEr = jiaYinXunCombos.find((combo) => combo.name === '天目地耳');
  assert.match(jiaYinTianMuDiEr?.summary || '', /癸亥属甲寅旬/);
  assert.match(jiaYinTianMuDiEr?.summary || '', /天目为庚申（坤二宫）/);
  assert.match(jiaYinTianMuDiEr?.summary || '', /地耳为戊午（离九宫）/);

  const noActiveGanZhi = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noActiveGanZhi.some((combo) => combo.name === '天目地耳'));
});

test('奇门复合格局应按当前局六甲旬输出孤虚方位', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const jiaZiXunCombos = detectQimenPatternCombos({
    activeGanZhi: '乙丑',
    jiuGongGe,
  });
  const jiaZiGuXu = jiaZiXunCombos.find((combo) => combo.name === '孤虚');
  assert.match(jiaZiGuXu?.summary || '', /乙丑属甲子旬/);
  assert.match(jiaZiGuXu?.summary || '', /孤在戌支乾六宫、亥支乾六宫/);
  assert.match(jiaZiGuXu?.summary || '', /虚在辰支巽四宫、巳支巽四宫/);
  assert.match(jiaZiGuXu?.summary || '', /背孤击虚/);

  const jiaYinXunCombos = detectQimenPatternCombos({
    activeGanZhi: '癸亥',
    jiuGongGe,
  });
  const jiaYinGuXu = jiaYinXunCombos.find((combo) => combo.name === '孤虚');
  assert.match(jiaYinGuXu?.summary || '', /癸亥属甲寅旬/);
  assert.match(jiaYinGuXu?.summary || '', /孤在子支坎一宫、丑支艮八宫/);
  assert.match(jiaYinGuXu?.summary || '', /虚在午支离九宫、未支坤二宫/);

  const noActiveGanZhi = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noActiveGanZhi.some((combo) => combo.name === '孤虚'));
});

test('奇门复合格局应按月将时支输出天三门地四户', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const zhengYueWuShiCombos = detectQimenPatternCombos({
    monthBranch: '寅',
    hourBranch: '午',
    jiuGongGe,
  });
  const zhengYueWuShi = zhengYueWuShiCombos.find(
    (combo) => combo.name === '天三门地四户',
  );
  assert.match(zhengYueWuShi?.summary || '', /寅月午时以月将亥加时支/);
  assert.match(zhengYueWuShi?.summary || '', /天三门为太冲在戌支乾六宫、小吉在寅支艮八宫、从魁在辰支巽四宫/);
  assert.match(zhengYueWuShi?.summary || '', /地四户为除在未支坤二宫、定在戌支乾六宫、危在丑支艮八宫、开在辰支巽四宫/);
  assert.match(zhengYueWuShi?.summary || '', /遇三奇吉门更佳/);

  const jiuYueSiShiCombos = detectQimenPatternCombos({
    monthBranch: '戌',
    hourBranch: '巳',
    jiuGongGe,
  });
  const jiuYueSiShi = jiuYueSiShiCombos.find((combo) => combo.name === '天三门地四户');
  assert.match(jiuYueSiShi?.summary || '', /戌月巳时以月将卯加时支/);
  assert.match(jiuYueSiShi?.summary || '', /地四户为除在午支离九宫、定在酉支兑七宫、危在子支坎一宫、开在卯支震三宫/);

  const noMonthBranch = detectQimenPatternCombos({
    hourBranch: '午',
    jiuGongGe,
  });
  assert.ok(!noMonthBranch.some((combo) => combo.name === '天三门地四户'));

  const noHourBranch = detectQimenPatternCombos({
    monthBranch: '寅',
    jiuGongGe,
  });
  assert.ok(!noHourBranch.some((combo) => combo.name === '天三门地四户'));
});

test('奇门复合格局应按月将贵人排十二天将输出地私门', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const yangNobleCombos = detectQimenPatternCombos({
    dayGanZhi: '甲辰',
    monthBranch: '寅',
    hourBranch: '辰',
    jiuGongGe,
  });
  const yangNoble = yangNobleCombos.find((combo) => combo.name === '地私门');
  assert.match(yangNoble?.summary || '', /甲辰日取阳贵未/);
  assert.match(yangNoble?.summary || '', /寅月辰时以月将亥加时支/);
  assert.match(yangNoble?.summary || '', /贵人落子支坎一宫，顺行排十二天将/);
  assert.match(yangNoble?.summary || '', /地私门为六合在卯支震三宫、太常在申支坤二宫、太阴在戌支乾六宫/);

  const yinNobleCombos = detectQimenPatternCombos({
    dayStem: '甲',
    dayBranch: '午',
    monthBranch: '寅',
    hourBranch: '辰',
    jiuGongGe,
  });
  const yinNoble = yinNobleCombos.find((combo) => combo.name === '地私门');
  assert.match(yinNoble?.summary || '', /甲午日取阴贵丑/);
  assert.match(yinNoble?.summary || '', /贵人落午支离九宫，逆行排十二天将/);
  assert.match(yinNoble?.summary || '', /地私门为六合在卯支震三宫、太常在戌支乾六宫、太阴在申支坤二宫/);

  const noDay = detectQimenPatternCombos({
    monthBranch: '寅',
    hourBranch: '辰',
    jiuGongGe,
  });
  assert.ok(!noDay.some((combo) => combo.name === '地私门'));

  const noMonthBranch = detectQimenPatternCombos({
    dayGanZhi: '甲辰',
    hourBranch: '辰',
    jiuGongGe,
  });
  assert.ok(!noMonthBranch.some((combo) => combo.name === '地私门'));

  const noHourBranch = detectQimenPatternCombos({
    dayGanZhi: '甲辰',
    monthBranch: '寅',
    jiuGongGe,
  });
  assert.ok(!noHourBranch.some((combo) => combo.name === '地私门'));
});

test('奇门复合格局应按月将时支输出太冲天马方', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const zhengYueZiShiCombos = detectQimenPatternCombos({
    monthBranch: '寅',
    hourBranch: '子',
    jiuGongGe,
  });
  const zhengYueZiShi = zhengYueZiShiCombos.find((combo) => combo.name === '天马方');
  assert.match(zhengYueZiShi?.summary || '', /寅月子时以月将亥加时支/);
  assert.match(zhengYueZiShi?.summary || '', /太冲天马方：太冲天马在辰支巽四宫/);
  assert.match(zhengYueZiShi?.summary || '', /急难逃避与出行择方参考/);

  const zhengYueWuShiCombos = detectQimenPatternCombos({
    monthBranch: '寅',
    hourBranch: '午',
    jiuGongGe,
  });
  const zhengYueWuShi = zhengYueWuShiCombos.find((combo) => combo.name === '天马方');
  assert.match(zhengYueWuShi?.summary || '', /太冲天马方：太冲天马在戌支乾六宫/);

  const noMonthBranch = detectQimenPatternCombos({
    hourBranch: '子',
    jiuGongGe,
  });
  assert.ok(!noMonthBranch.some((combo) => combo.name === '天马方'));

  const noHourBranch = detectQimenPatternCombos({
    monthBranch: '寅',
    jiuGongGe,
  });
  assert.ok(!noHourBranch.some((combo) => combo.name === '天马方'));
});

test('奇门复合格局应按月将时支输出天罡斗星方', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const zhengYueWuShiCombos = detectQimenPatternCombos({
    monthBranch: '寅',
    hourBranch: '午',
    jiuGongGe,
  });
  const zhengYueWuShi = zhengYueWuShiCombos.find((combo) => combo.name === '天罡时');
  assert.match(zhengYueWuShi?.summary || '', /寅月午时以月将亥加时支/);
  assert.match(zhengYueWuShi?.summary || '', /斗星方：斗星天罡在亥支乾六宫/);
  assert.match(zhengYueWuShi?.summary || '', /行兵破阵与择方参考/);

  const jiuYueSiShiCombos = detectQimenPatternCombos({
    monthBranch: '戌',
    hourBranch: '巳',
    jiuGongGe,
  });
  const jiuYueSiShi = jiuYueSiShiCombos.find((combo) => combo.name === '天罡时');
  assert.match(jiuYueSiShi?.summary || '', /戌月巳时以月将卯加时支/);
  assert.match(jiuYueSiShi?.summary || '', /斗星方：斗星天罡在午支离九宫/);

  const noMonthBranch = detectQimenPatternCombos({
    hourBranch: '午',
    jiuGongGe,
  });
  assert.ok(!noMonthBranch.some((combo) => combo.name === '天罡时'));

  const noHourBranch = detectQimenPatternCombos({
    monthBranch: '寅',
    jiuGongGe,
  });
  assert.ok(!noHourBranch.some((combo) => combo.name === '天罡时'));
});

test('奇门复合格局应按月将时支输出迷路法路向', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const mengCombos = detectQimenPatternCombos({
    monthBranch: '寅',
    hourBranch: '午',
    jiuGongGe,
  });
  const meng = mengCombos.find((combo) => combo.name === '迷路法');
  assert.match(meng?.summary || '', /寅月午时以月将亥加时支/);
  assert.match(meng?.summary || '', /天罡临亥支乾六宫，属孟位，左路通/);
  assert.match(meng?.summary || '', /行军迷路、择道参考/);

  const zhongCombos = detectQimenPatternCombos({
    monthBranch: '戌',
    hourBranch: '巳',
    jiuGongGe,
  });
  const zhong = zhongCombos.find((combo) => combo.name === '迷路法');
  assert.match(zhong?.summary || '', /戌月巳时以月将卯加时支/);
  assert.match(zhong?.summary || '', /天罡临午支离九宫，属仲位，中道通/);

  const jiCombos = detectQimenPatternCombos({
    monthBranch: '戌',
    hourBranch: '午',
    jiuGongGe,
  });
  const ji = jiCombos.find((combo) => combo.name === '迷路法');
  assert.match(ji?.summary || '', /戌月午时以月将卯加时支/);
  assert.match(ji?.summary || '', /天罡临未支坤二宫，属季位，右路通/);

  const noMonthBranch = detectQimenPatternCombos({
    hourBranch: '午',
    jiuGongGe,
  });
  assert.ok(!noMonthBranch.some((combo) => combo.name === '迷路法'));

  const noHourBranch = detectQimenPatternCombos({
    monthBranch: '寅',
    jiuGongGe,
  });
  assert.ok(!noHourBranch.some((combo) => combo.name === '迷路法'));
});

test('奇门复合格局应按月将时支输出亭亭白奸方位', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const zhengYueWuShiCombos = detectQimenPatternCombos({
    monthBranch: '寅',
    hourBranch: '午',
    jiuGongGe,
  });
  const zhengYueWuShi = zhengYueWuShiCombos.find((combo) => combo.name === '亭亭白奸');
  assert.match(zhengYueWuShi?.summary || '', /寅月午时以月将亥加时支/);
  assert.match(zhengYueWuShi?.summary || '', /亭亭方：亭亭（神后）在未支坤二宫/);
  assert.match(zhengYueWuShi?.summary || '', /白奸方：白奸功曹在酉支兑七宫、白奸胜光在丑支艮八宫、白奸天罡在亥支乾六宫/);
  assert.match(zhengYueWuShi?.summary || '', /背亭亭击白奸/);

  const jiuYueSiShiCombos = detectQimenPatternCombos({
    monthBranch: '戌',
    hourBranch: '巳',
    jiuGongGe,
  });
  const jiuYueSiShi = jiuYueSiShiCombos.find((combo) => combo.name === '亭亭白奸');
  assert.match(jiuYueSiShi?.summary || '', /戌月巳时以月将卯加时支/);
  assert.match(jiuYueSiShi?.summary || '', /亭亭方：亭亭（神后）在寅支艮八宫/);
  assert.match(jiuYueSiShi?.summary || '', /白奸方：白奸功曹在辰支巽四宫、白奸胜光在申支坤二宫、白奸天罡在午支离九宫/);

  const noMonthBranch = detectQimenPatternCombos({
    hourBranch: '午',
    jiuGongGe,
  });
  assert.ok(!noMonthBranch.some((combo) => combo.name === '亭亭白奸'));

  const noHourBranch = detectQimenPatternCombos({
    monthBranch: '寅',
    jiuGongGe,
  });
  assert.ok(!noHourBranch.some((combo) => combo.name === '亭亭白奸'));
});

test('奇门复合格局应按天盘干与六甲旬输出天门地户太阴青龙用方', () => {
  const jiuGongGe = [
    buildQimenPalace(1, '戊'),
    buildQimenPalace(2, '己'),
    buildQimenPalace(3, '丁'),
    buildQimenPalace(4, '癸'),
    buildQimenPalace(6, '乙'),
    buildQimenPalace(7, '丙'),
    buildQimenPalace(8, '庚'),
    buildQimenPalace(9, '辛'),
  ];

  const jiaZiXunCombos = detectQimenPatternCombos({
    activeGanZhi: '乙丑',
    jiuGongGe,
  });
  const jiaZiAdvice = jiaZiXunCombos.find((combo) => combo.name === '天门地户太阴青龙');
  assert.match(jiaZiAdvice?.summary || '', /乙丑属甲子旬/);
  assert.match(jiaZiAdvice?.summary || '', /出天门取天盘戊所在坎一宫/);
  assert.match(jiaZiAdvice?.summary || '', /入地户取天盘己所在坤二宫/);
  assert.match(jiaZiAdvice?.summary || '', /过太阴取天盘丁所在震三宫/);
  assert.match(jiaZiAdvice?.summary || '', /居青龙取本旬六甲遁戊所在坎一宫/);

  const jiaYinXunCombos = detectQimenPatternCombos({
    activeGanZhi: '癸亥',
    jiuGongGe,
  });
  const jiaYinAdvice = jiaYinXunCombos.find((combo) => combo.name === '天门地户太阴青龙');
  assert.match(jiaYinAdvice?.summary || '', /癸亥属甲寅旬/);
  assert.match(jiaYinAdvice?.summary || '', /居青龙取本旬六甲遁癸所在巽四宫/);

  const noActiveGanZhi = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noActiveGanZhi.some((combo) => combo.name === '天门地户太阴青龙'));
});

test('奇门复合格局应按天盘干与六甲旬输出下营法分工', () => {
  const jiuGongGe = [
    buildQimenPalace(1, '戊'),
    buildQimenPalace(2, '己'),
    buildQimenPalace(3, '丁'),
    buildQimenPalace(4, '癸'),
    buildQimenPalace(5, '壬'),
    buildQimenPalace(6, '乙'),
    buildQimenPalace(7, '丙'),
    buildQimenPalace(8, '庚'),
    buildQimenPalace(9, '辛'),
  ];

  const jiaZiXunCombos = detectQimenPatternCombos({
    activeGanZhi: '乙丑',
    jiuGongGe,
  });
  const jiaZiCampLayout = jiaZiXunCombos.find((combo) => combo.name === '下营法');
  assert.match(jiaZiCampLayout?.summary || '', /乙丑属甲子旬/);
  assert.match(jiaZiCampLayout?.summary || '', /大将取本旬六甲遁戊所在坎一宫/);
  assert.match(jiaZiCampLayout?.summary || '', /旗鼓取天盘乙所在乾六宫/);
  assert.match(jiaZiCampLayout?.summary || '', /士卒取天盘丙所在兑七宫/);
  assert.match(jiaZiCampLayout?.summary || '', /伏兵取天盘丁所在震三宫/);
  assert.match(jiaZiCampLayout?.summary || '', /判断取天盘辛所在离九宫/);
  assert.match(jiaZiCampLayout?.summary || '', /囚系粮储取天盘壬所在中五宫/);
  assert.match(jiaZiCampLayout?.summary || '', /所藏取天盘癸所在巽四宫/);

  const jiaYinXunCombos = detectQimenPatternCombos({
    activeGanZhi: '癸亥',
    jiuGongGe,
  });
  const jiaYinCampLayout = jiaYinXunCombos.find((combo) => combo.name === '下营法');
  assert.match(jiaYinCampLayout?.summary || '', /癸亥属甲寅旬/);
  assert.match(jiaYinCampLayout?.summary || '', /大将取本旬六甲遁癸所在巽四宫/);

  const noActiveGanZhi = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noActiveGanZhi.some((combo) => combo.name === '下营法'));
});

test('奇门复合格局应按日支与时支识别时中将星', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const shenMaoCombos = detectQimenPatternCombos({
    dayBranch: '申',
    hourBranch: '卯',
    jiuGongGe,
  });
  const shenMaoJiangXing = shenMaoCombos.find((combo) => combo.name === '时中将星');
  assert.match(shenMaoJiangXing?.summary || '', /申日逢卯时/);

  const siZiCombos = detectQimenPatternCombos({
    dayBranch: '巳',
    hourBranch: '子',
    jiuGongGe,
  });
  const siZiJiangXing = siZiCombos.find((combo) => combo.name === '时中将星');
  assert.match(siZiJiangXing?.summary || '', /巳日逢子时/);

  const mismatch = detectQimenPatternCombos({
    dayBranch: '申',
    hourBranch: '午',
    jiuGongGe,
  });
  assert.ok(!mismatch.some((combo) => combo.name === '时中将星'));

  const noHourBranch = detectQimenPatternCombos({
    dayBranch: '申',
    jiuGongGe,
  });
  assert.ok(!noHourBranch.some((combo) => combo.name === '时中将星'));
});

test('奇门复合格局应按时干输出五阳五阴主客取向', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const yangCombos = detectQimenPatternCombos({
    hourStem: '甲',
    jiuGongGe,
  });
  const yangAdvice = yangCombos.find((combo) => combo.name === '五阳五阴主客');
  assert.match(yangAdvice?.summary || '', /甲时属五阳时/);
  assert.match(yangAdvice?.summary || '', /利客、宜先举/);
  assert.match(yangAdvice?.summary || '', /天盘奇仪星门/);

  const yinCombos = detectQimenPatternCombos({
    hourStem: '辛',
    jiuGongGe,
  });
  const yinAdvice = yinCombos.find((combo) => combo.name === '五阳五阴主客');
  assert.match(yinAdvice?.summary || '', /辛时属五阴时/);
  assert.match(yinAdvice?.summary || '', /利主、宜后应/);
  assert.match(yinAdvice?.summary || '', /地盘奇仪星门/);

  const noHourStem = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noHourStem.some((combo) => combo.name === '五阳五阴主客'));
});

test('奇门复合格局应按值符星落宫输出开通闭塞', () => {
  const openPalaces = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) =>
    buildQimenPalace(gong, '戊', {
      tianPan: { star: gong === 1 ? '天蓬' : '', stem: '戊' },
    }),
  );
  const openCombos = detectQimenPatternCombos({
    zhiFu: '天蓬',
    jiuGongGe: openPalaces,
  });
  const openClose = openCombos.find((combo) => combo.name === '值符开通闭塞');
  assert.equal(openClose?.palace, 1);
  assert.match(openClose?.summary || '', /值符星天蓬落坎一宫/);
  assert.match(openClose?.summary || '', /符临1宫为开通/);
  assert.match(openClose?.summary || '', /宜主动推进/);

  const closedPalaces = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) =>
    buildQimenPalace(gong, '戊', {
      tianPan: { star: gong === 9 ? '天英' : '', stem: '戊' },
    }),
  );
  const closedCombos = detectQimenPatternCombos({
    zhiFu: '天英',
    jiuGongGe: closedPalaces,
  });
  const closedOpenClose = closedCombos.find((combo) => combo.name === '值符开通闭塞');
  assert.equal(closedOpenClose?.palace, 9);
  assert.match(closedOpenClose?.summary || '', /值符星天英落离九宫/);
  assert.match(closedOpenClose?.summary || '', /符临9宫为闭塞/);
  assert.match(closedOpenClose?.summary || '', /宜守势等待/);

  const missingZhiFuPalace = detectQimenPatternCombos({
    zhiFu: '天任',
    jiuGongGe: openPalaces,
  });
  assert.ok(!missingZhiFuPalace.some((combo) => combo.name === '值符开通闭塞'));
});

test('奇门复合格局应按九星与宫位五行关系输出星宫主客', () => {
  const jiuGongGe = [
    buildQimenPalace(2, '戊', {
      tianPan: { star: '天冲', stem: '戊' },
    }),
    buildQimenPalace(8, '戊', {
      tianPan: { star: '天蓬', stem: '戊' },
    }),
    buildQimenPalace(6, '戊', {
      tianPan: { star: '天英', stem: '戊' },
    }),
    buildQimenPalace(7, '戊', {
      tianPan: { star: '天心', stem: '戊' },
    }),
    buildQimenPalace(5, '戊', {
      tianPan: { star: '天任', stem: '戊' },
    }),
  ];

  const combos = detectQimenPatternCombos({ jiuGongGe });
  const hostGuest = combos.find((combo) => combo.name === '星宫主客');
  assert.match(hostGuest?.summary || '', /天冲木落坤二宫（土），星克宫，利客/);
  assert.match(hostGuest?.summary || '', /天蓬水落艮八宫（土），宫克星，利主/);
  assert.match(hostGuest?.summary || '', /天英火落乾六宫（土），星生宫，利主/);
  assert.match(hostGuest?.summary || '', /天心金落兑七宫（土），宫生星，利客/);
  assert.match(hostGuest?.summary || '', /天任土落中五宫（土），星宫比和，势均/);
  assert.match(hostGuest?.summary || '', /宫为主，星为客/);

  const missingStar = detectQimenPatternCombos({
    jiuGongGe: [
      buildQimenPalace(2, '戊', {
        tianPan: { star: '', stem: '戊' },
      }),
    ],
  });
  assert.ok(!missingStar.some((combo) => combo.name === '星宫主客'));
});

test('奇门复合格局应按八门与宫位五行关系输出门宫主客', () => {
  const jiuGongGe = [
    buildQimenPalace(2, '戊', {
      renPan: { door: '伤门' },
    }),
    buildQimenPalace(8, '戊', {
      renPan: { door: '休门' },
    }),
    buildQimenPalace(6, '戊', {
      renPan: { door: '景门' },
    }),
    buildQimenPalace(7, '戊', {
      renPan: { door: '开门' },
    }),
    buildQimenPalace(5, '戊', {
      renPan: { door: '生门' },
    }),
  ];

  const combos = detectQimenPatternCombos({ jiuGongGe });
  const hostGuest = combos.find((combo) => combo.name === '门宫主客');
  assert.match(hostGuest?.summary || '', /伤门木落坤二宫（土），门克宫，利客/);
  assert.match(hostGuest?.summary || '', /休门水落艮八宫（土），宫克门，利主/);
  assert.match(hostGuest?.summary || '', /景门火落乾六宫（土），门生宫，利主/);
  assert.match(hostGuest?.summary || '', /开门金落兑七宫（土），宫生门，利客/);
  assert.match(hostGuest?.summary || '', /生门土落中五宫（土），门宫比和，势均/);
  assert.match(hostGuest?.summary || '', /宫为主，门为客/);

  const missingDoor = detectQimenPatternCombos({
    jiuGongGe: [
      buildQimenPalace(2, '戊', {
        renPan: { door: '' },
      }),
    ],
  });
  assert.ok(!missingDoor.some((combo) => combo.name === '门宫主客'));
});

test('奇门复合格局应按同宫星门一克一生输出主客互伤', () => {
  const jiuGongGe = [
    buildQimenPalace(2, '戊', {
      tianPan: { star: '天冲', stem: '戊' },
      renPan: { door: '景门' },
    }),
    buildQimenPalace(6, '戊', {
      tianPan: { star: '天英', stem: '戊' },
      renPan: { door: '伤门' },
    }),
  ];

  const combos = detectQimenPatternCombos({ jiuGongGe });
  const injury = combos.find((combo) => combo.name === '星门主客互伤');
  assert.match(injury?.summary || '', /坤二宫：天冲木星克宫利客，景门火门生宫利主/);
  assert.match(injury?.summary || '', /乾六宫：天英火星生宫利主，伤门木门克宫利客/);
  assert.match(injury?.summary || '', /一克一生，主客互伤/);
  assert.match(injury?.summary || '', /宫为主，星门为客/);

  const sameKind = detectQimenPatternCombos({
    jiuGongGe: [
      buildQimenPalace(2, '戊', {
        tianPan: { star: '天冲', stem: '戊' },
        renPan: { door: '伤门' },
      }),
    ],
  });
  assert.ok(!sameKind.some((combo) => combo.name === '星门主客互伤'));
});

test('奇门复合格局应按节气时支与值符星输出刑德开阖', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const deCombos = detectQimenPatternCombos({
    solarTerm: '小寒',
    hourGanZhi: '乙卯',
    hourBranch: '卯',
    zhiFu: '天蓬',
    jiuGongGe,
  });
  const deKaiHe = deCombos.find((combo) => combo.name === '刑德开阖');
  assert.match(deKaiHe?.summary || '', /小寒属冬至三气，德在卯、刑在酉/);
  assert.match(deKaiHe?.summary || '', /乙卯时支卯为德在门/);
  assert.match(deKaiHe?.summary || '', /值符天蓬为阳星，判为尽开，宜动宜战/);

  const xingCombos = detectQimenPatternCombos({
    solarTerm: '大寒',
    hourGanZhi: '丁酉',
    hourBranch: '酉',
    zhiFu: '天英',
    jiuGongGe,
  });
  const xingKaiHe = xingCombos.find((combo) => combo.name === '刑德开阖');
  assert.match(xingKaiHe?.summary || '', /丁酉时支酉为刑在门/);
  assert.match(xingKaiHe?.summary || '', /值符天英为阴星，判为尽阖，宜静宜守/);

  const normalCombos = detectQimenPatternCombos({
    solarTerm: '立春',
    hourGanZhi: '甲子',
    hourBranch: '子',
    zhiFu: '天心',
    jiuGongGe,
  });
  const normalKaiHe = normalCombos.find((combo) => combo.name === '刑德开阖');
  assert.match(normalKaiHe?.summary || '', /立春属立春三气，德在辰、刑在戌/);
  assert.match(normalKaiHe?.summary || '', /甲子时支子为不当刑德/);

  const missingContext = detectQimenPatternCombos({
    hourBranch: '卯',
    zhiFu: '天蓬',
    jiuGongGe,
  });
  assert.ok(!missingContext.some((combo) => combo.name === '刑德开阖'));
});

test('奇门复合格局应按日干支识别旬中地丙日', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));

  const bingYinCombos = detectQimenPatternCombos({
    dayGanZhi: '丙寅',
    jiuGongGe,
  });
  const bingYinDiBing = bingYinCombos.find((combo) => combo.name === '旬中地丙日');
  assert.match(bingYinDiBing?.summary || '', /丙寅为甲子旬寅日/);
  assert.match(bingYinDiBing?.summary || '', /将兵者不宜用/);

  const bingZiCombos = detectQimenPatternCombos({
    dayStem: '丙',
    dayBranch: '子',
    jiuGongGe,
  });
  const bingZiDiBing = bingZiCombos.find((combo) => combo.name === '旬中地丙日');
  assert.match(bingZiDiBing?.summary || '', /丙子为甲戌旬子日/);

  const dingMaoCombos = detectQimenPatternCombos({
    dayGanZhi: '丁卯',
    jiuGongGe,
  });
  assert.ok(!dingMaoCombos.some((combo) => combo.name === '旬中地丙日'));

  const noDayGanZhi = detectQimenPatternCombos({
    jiuGongGe,
  });
  assert.ok(!noDayGanZhi.some((combo) => combo.name === '旬中地丙日'));
});

test('奇门默认使用转盘法，飞盘法九星完整且可区分', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const defaultData = generateQimen(date);
  const zhuanpanData = generateQimen(date, 'zhuanpan');
  const feipanData = generateQimen(date, 'feipan');

  assert.deepEqual(defaultData.jiuGongGe, zhuanpanData.jiuGongGe);
  assert.deepEqual(defaultData.patternTags, zhuanpanData.patternTags);

  const zhuanpanStars = zhuanpanData.jiuGongGe.map((gong) => gong.tianPan.star);
  const feipanStars = feipanData.jiuGongGe.map((gong) => gong.tianPan.star);
  assert.notDeepEqual(feipanStars, zhuanpanStars);

  const expectedStars = ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心', '天禽'];
  assert.equal(new Set(feipanStars).size, 9);
  assert.ok(expectedStars.every((star) => feipanStars.includes(star)));

  const feipanDoors = feipanData.jiuGongGe.map((gong) => gong.renPan.door).filter(Boolean);
  assert.equal(feipanDoors.length, 8);
  assert.equal(new Set(feipanDoors).size, 8);
  assert.equal(feipanData.jiuGongGe.find((gong) => gong.gong === 5)?.renPan.door, '');

  const expectedZhiShiPalace = resolveZhiShiLandingPalace(
    feipanData.isYangDun,
    feipanData.zhiShi,
    feipanData.ganzhi.hour,
  );
  const actualZhiShiPalace = feipanData.jiuGongGe.find(
    (gong) => gong.renPan.door === feipanData.zhiShi,
  )?.gong;
  assert.equal(actualZhiShiPalace, expectedZhiShiPalace);
});

test('年家奇门应按实际年份区分同一甲子的三元周期', () => {
  const year1924 = generateQimen(new Date('1924-07-01T08:00:00+08:00'), 'zhuanpan', 'year');
  const year1984 = generateQimen(new Date('1984-07-01T08:00:00+08:00'), 'zhuanpan', 'year');
  const year2044 = generateQimen(new Date('2044-07-01T08:00:00+08:00'), 'zhuanpan', 'year');

  assert.equal(year1924.ganzhi.year, '甲子');
  assert.equal(year1984.ganzhi.year, '甲子');
  assert.equal(year2044.ganzhi.year, '甲子');

  assert.equal(year1924.timeInfo.epoch, '中元');
  assert.equal(year1924.isYangDun, false);
  assert.equal(year1984.timeInfo.epoch, '下元');
  assert.equal(year1984.isYangDun, true);
  assert.equal(year2044.timeInfo.epoch, '上元');
  assert.equal(year2044.isYangDun, true);
});

test('年家奇门在年初干支未切换时应沿用匹配干支的三元周期年', () => {
  const beforeYearChange = generateQimen(new Date('2025-01-01T08:00:00+08:00'), 'zhuanpan', 'year');
  const sameGanzhiYear = generateQimen(new Date('2024-07-01T08:00:00+08:00'), 'zhuanpan', 'year');

  assert.equal(beforeYearChange.ganzhi.year, '甲辰');
  assert.equal(sameGanzhiYear.ganzhi.year, '甲辰');
  assert.equal(beforeYearChange.timeInfo.epoch, sameGanzhiYear.timeInfo.epoch);
  assert.equal(beforeYearChange.isYangDun, sameGanzhiYear.isYangDun);
});

test('奇门天地盘干入墓关系与统一天干入墓表一致', () => {
  for (const [stem, tomb] of Object.entries(STEM_TOMB_MAP)) {
    const relations = getStemRelations([buildQimenPalace(tomb.palace, stem)]);

    assert.ok(
      relations.some(
        (relation) =>
          relation.heaven === stem && relation.type === '入墓' && relation.palace === tomb.palace,
      ),
      `${stem}应在${tomb.palace}宫/${tomb.branch}支入墓`,
    );
  }
});

test('奇门三奇入墓应使用三奇专门墓宫', () => {
  const yiAtKun = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(2, '乙')],
    zhiFu: '',
    zhiShi: '',
  });
  assert.ok(
    yiAtKun.some(
      (pattern) =>
        pattern.name === '日奇入墓' &&
        pattern.palace === 2 &&
        pattern.summary.includes('三奇墓在未'),
    ),
  );

  const yiAtQian = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(6, '乙')],
    zhiFu: '',
    zhiShi: '',
  });
  assert.ok(!yiAtQian.some((pattern) => pattern.name === '日奇入墓'));

  const bingAtQian = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(6, '丙')],
    zhiFu: '',
    zhiShi: '',
  });
  assert.ok(bingAtQian.some((pattern) => pattern.name === '月奇入墓' && pattern.palace === 6));

  const dingAtGen = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(8, '丁')],
    zhiFu: '',
    zhiShi: '',
  });
  assert.ok(dingAtGen.some((pattern) => pattern.name === '星奇入墓' && pattern.palace === 8));
});

test('奇门三奇受制应按乙临金宫与丙丁临坎宫判定', () => {
  const cases = [
    { gong: 6, stem: '乙', name: '日奇受制', score: -4, reason: '木入金乡' },
    { gong: 7, stem: '乙', name: '日奇受制', score: -4, reason: '木入金乡' },
    { gong: 1, stem: '丙', name: '月奇受制', score: -5, reason: '火入水乡' },
    { gong: 1, stem: '丁', name: '星奇受制', score: -4, reason: '火入水乡' },
  ];

  for (const item of cases) {
    const patterns = getClassicPatterns({
      jiuGongGe: [buildQimenPalace(item.gong, item.stem)],
      zhiFu: '',
      zhiShi: '',
    });
    assert.ok(
      patterns.some(
        (pattern) =>
          pattern.name === item.name &&
          pattern.palace === item.gong &&
          pattern.score === item.score &&
          pattern.summary.includes(item.reason),
      ),
      `${item.stem}奇落${item.gong}宫应输出${item.name}`,
    );
  }

  const noShouZhi = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(4, '乙'), buildQimenPalace(9, '丙')],
    zhiFu: '',
    zhiShi: '',
  });
  assert.ok(!noShouZhi.some((pattern) => pattern.name.includes('受制')));
});

test('奇门经典格局应识别三诈', () => {
  const patterns = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(1, '乙', {
        renPan: { door: '开门' },
        shenPan: { god: '太阴' },
      }),
      buildQimenPalace(2, '丙', {
        renPan: { door: '休门' },
        shenPan: { god: '九地' },
      }),
      buildQimenPalace(3, '丁', {
        renPan: { door: '生门' },
        shenPan: { god: '六合' },
      }),
    ],
    zhiFu: '',
    zhiShi: '',
  });

  assert.ok(patterns.some((pattern) => pattern.name === '真诈' && pattern.palace === 1));
  assert.ok(patterns.some((pattern) => pattern.name === '重诈' && pattern.palace === 2));
  assert.ok(patterns.some((pattern) => pattern.name === '休诈' && pattern.palace === 3));

  const noGoodDoor = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(4, '乙', {
        renPan: { door: '杜门' },
        shenPan: { god: '太阴' },
      }),
    ],
    zhiFu: '',
    zhiShi: '',
  });
  assert.ok(!noGoodDoor.some((pattern) => ['真诈', '重诈', '休诈'].includes(pattern.name)));
});

test('奇门经典格局应识别可稳定表达的五假与神假', () => {
  const patterns = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(1, '乙', {
        renPan: { door: '景门' },
        shenPan: { god: '九天' },
      }),
      buildQimenPalace(3, '癸', {
        renPan: { door: '杜门' },
        shenPan: { god: '九地' },
      }),
      buildQimenPalace(2, '壬', {
        renPan: { door: '惊门' },
        shenPan: { god: '玄武' },
      }),
      buildQimenPalace(6, '丁', {
        diPan: { stem: '己' },
        renPan: { door: '杜门' },
        shenPan: { god: '太阴' },
      }),
      buildQimenPalace(7, '己', {
        renPan: { door: '死门' },
        shenPan: { god: '九地' },
      }),
      buildQimenPalace(4, '庚', {
        renPan: { door: '伤门' },
        shenPan: { god: '玄武' },
      }),
    ],
    zhiFu: '',
    zhiShi: '',
  });

  assert.ok(patterns.some((pattern) => pattern.name === '天假' && pattern.palace === 1));
  assert.ok(patterns.some((pattern) => pattern.name === '地假' && pattern.palace === 3));
  assert.ok(patterns.some((pattern) => pattern.name === '人假' && pattern.palace === 2));
  assert.ok(patterns.some((pattern) => pattern.name === '物假' && pattern.palace === 6));
  assert.ok(patterns.some((pattern) => pattern.name === '鬼假' && pattern.palace === 7));
  assert.ok(patterns.some((pattern) => pattern.name === '神假' && pattern.palace === 4));
  assert.ok(!patterns.some((pattern) => pattern.name === '地假' && pattern.palace === 6));

  const noStableJia = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(8, '己', {
        renPan: { door: '死门' },
        shenPan: { god: '白虎' },
      }),
      buildQimenPalace(8, '庚', {
        renPan: { door: '伤门' },
        shenPan: { god: '玄武' },
      }),
    ],
    zhiFu: '',
    zhiShi: '',
  });
  assert.ok(!noStableJia.some((pattern) => pattern.name === '鬼假'));
  assert.ok(!noStableJia.some((pattern) => pattern.name === '神假'));
});

test('奇门小格应按庚临壬判定，不应误判壬己', () => {
  assert.equal(getStemPairPattern('庚', '壬')?.name, '小格');
  assert.notEqual(getStemPairPattern('壬', '己')?.name, '小格');
});

test('奇门天地盘干命名格局应进入实际排盘输出', () => {
  const data = generateQimen(new Date('2025-01-01T02:00:00+08:00'));

  assert.equal(data.ganzhi.hour, '丁丑');
  assert.ok(
    data.classicPatterns?.some(
      (pattern) => pattern.name === '白虎猖狂' && pattern.palaces.includes(6),
    ),
  );
  assert.ok(data.classicPatterns?.some((pattern) => pattern.name === '太白入荧'));
  assert.ok(
    data.stemRelations?.some(
      (relation) => relation.relation === '命名格局' && relation.pattern?.includes('白虎猖狂'),
    ),
  );
});

test('奇门乙加乙应识别为日奇伏刑，不应退化为比和', () => {
  assert.equal(getStemPairPattern('乙', '乙')?.name, '日奇伏刑');

  const data = generateQimen(new Date('2025-01-01T05:00:00+08:00'));

  assert.equal(data.ganzhi.hour, '己卯');
  assert.ok(
    data.classicPatterns?.some(
      (pattern) => pattern.name === '日奇伏刑' && pattern.palaces.includes(6),
    ),
  );
  assert.ok(
    data.stemRelations?.some(
      (relation) =>
        relation.gong === 6 &&
        relation.relation === '命名格局' &&
        relation.pattern?.includes('日奇伏刑'),
    ),
  );
  assert.ok(
    !data.stemRelations?.some(
      (relation) => relation.gong === 6 && relation.relation === '比和',
    ),
  );
});

test('奇门丙加辛、丁加辛和乙加丁应按多书互证命名格局输出', () => {
  assert.equal(getStemPairPattern('丙', '辛')?.name, '月精合佑');
  assert.equal(getStemPairPattern('丁', '辛')?.name, '朱雀入狱');
  assert.equal(getStemPairPattern('乙', '丁')?.name, '朱雀入江');

  const zhuQueRuJiang = generateQimen(new Date('2025-01-01T23:00:00+08:00'));
  assert.ok(
    zhuQueRuJiang.classicPatterns?.some(
      (pattern) => pattern.name === '朱雀入江' && pattern.palaces.includes(4),
    ),
  );
  assert.ok(
    zhuQueRuJiang.stemRelations?.some(
      (relation) =>
        relation.gong === 4 &&
        relation.relation === '命名格局' &&
        relation.pattern?.includes('朱雀入江'),
    ),
  );
});

test('奇门乙组天地盘干克应应按古籍格局输出', () => {
  const cases = [
    {
      heaven: '乙',
      earth: '戊',
      name: '阴中返阳',
      time: '2025-01-01T08:00:00+08:00',
      hour: '庚辰',
      gong: 7,
      oldRelation: '克下',
    },
    {
      heaven: '乙',
      earth: '丙',
      name: '奇仪得顺',
      time: '2025-01-01T03:00:00+08:00',
      hour: '戊寅',
      gong: 5,
      oldRelation: '生下',
    },
    {
      heaven: '乙',
      earth: '庚',
      name: '日奇受刑',
      time: '2025-01-01T11:00:00+08:00',
      hour: '壬午',
      gong: 9,
      oldPattern: '仁义之合',
    },
    {
      heaven: '乙',
      earth: '壬',
      name: '万事皆屯',
      time: '2025-01-01T01:00:00+08:00',
      hour: '丁丑',
      gong: 2,
      oldRelation: '入墓',
    },
    {
      heaven: '乙',
      earth: '癸',
      name: '日入天网',
      time: '2025-01-01T00:00:00+08:00',
      hour: '丙子',
      gong: 3,
      oldRelation: '生上',
    },
  ];

  for (const item of cases) {
    assert.equal(getStemPairPattern(item.heaven, item.earth)?.name, item.name);

    const data = generateQimen(new Date(item.time));
    assert.equal(data.ganzhi.hour, item.hour);
    assert.ok(
      data.classicPatterns?.some(
        (pattern) => pattern.name === item.name && pattern.palaces.includes(item.gong),
      ),
    );
    assert.ok(
      data.stemRelations?.some(
        (relation) =>
          relation.gong === item.gong &&
          relation.relation === '命名格局' &&
          relation.pattern?.includes(item.name),
      ),
    );
    if (item.oldRelation) {
      assert.ok(
        !data.stemRelations?.some(
          (relation) => relation.gong === item.gong && relation.relation === item.oldRelation,
        ),
      );
    }
    if (item.oldPattern) {
      assert.ok(
        !data.stemRelations?.some(
          (relation) => relation.gong === item.gong && relation.pattern?.includes(item.oldPattern),
        ),
      );
    }
  }
});

test('奇门丙加乙丙丁己辛壬癸应按宝鉴丙组格局输出', () => {
  const cases = [
    {
      heaven: '丙',
      earth: '乙',
      name: '月奇浮云',
      time: '2025-01-01T07:00:00+08:00',
      hour: '庚辰',
      gong: 6,
      oldRelation: '入墓',
      oldPatterns: ['为人遁'],
    },
    {
      heaven: '丙',
      earth: '丙',
      name: '月奇勃格',
      time: '2025-01-01T05:00:00+08:00',
      hour: '己卯',
      gong: 5,
      oldRelation: '比和',
      oldPatterns: ['奇中有奇'],
    },
    {
      heaven: '丙',
      earth: '丁',
      name: '奇入朱雀',
      time: '2025-01-01T03:00:00+08:00',
      hour: '戊寅',
      gong: 4,
      oldRelation: '比和',
      oldPatterns: ['奇日太阴'],
    },
    {
      heaven: '丙',
      earth: '己',
      name: '火孛入刑',
      time: '2025-01-01T11:00:00+08:00',
      hour: '壬午',
      gong: 8,
      oldPatterns: ['月奇入雾', '火入勾陈'],
    },
    {
      heaven: '丙',
      earth: '辛',
      name: '月精合佑',
      time: '2025-01-01T01:00:00+08:00',
      hour: '丁丑',
      gong: 1,
      oldPatterns: ['威权之合', '朱雀入狱'],
    },
    {
      heaven: '丙',
      earth: '壬',
      name: '孛乱来临',
      time: '2025-01-01T00:00:00+08:00',
      hour: '丙子',
      gong: 2,
      oldRelation: '克上',
      oldPatterns: ['丁壬化木'],
    },
    {
      heaven: '丙',
      earth: '癸',
      name: '华盖孛师',
      time: '2025-01-01T23:00:00+08:00',
      hour: '戊子',
      gong: 3,
      oldPatterns: ['火入泉池', '朱雀沉吟'],
    },
  ];

  for (const item of cases) {
    assert.equal(getStemPairPattern(item.heaven, item.earth)?.name, item.name);

    const data = generateQimen(new Date(item.time));
    assert.equal(data.ganzhi.hour, item.hour);
    assert.ok(
      data.classicPatterns?.some(
        (pattern) => pattern.name === item.name && pattern.palaces.includes(item.gong),
      ),
    );
    assert.ok(
      data.stemRelations?.some(
        (relation) =>
          relation.gong === item.gong &&
          relation.relation === '命名格局' &&
          relation.pattern?.includes(item.name),
      ),
    );
    if (item.oldRelation) {
      assert.ok(
        !data.stemRelations?.some(
          (relation) => relation.gong === item.gong && relation.relation === item.oldRelation,
        ),
      );
    }
    for (const oldPattern of item.oldPatterns ?? []) {
      assert.ok(
        !data.stemRelations?.some(
          (relation) => relation.gong === item.gong && relation.pattern?.includes(oldPattern),
        ),
      );
    }
  }
});

test('奇门丁加乙丙丁戊己庚辛壬癸应按宝鉴丁组格局输出', () => {
  const cases = [
    {
      heaven: '丁',
      earth: '乙',
      name: '为人遁',
      time: '2025-01-01T09:00:00+08:00',
      hour: '辛巳',
      gong: 6,
    },
    {
      heaven: '丁',
      earth: '丙',
      name: '加中复奇',
      time: '2025-01-01T07:00:00+08:00',
      hour: '庚辰',
      gong: 5,
      oldRelation: '比和',
    },
    {
      heaven: '丁',
      earth: '丁',
      name: '奇入太阴',
      time: '2025-01-01T05:00:00+08:00',
      hour: '己卯',
      gong: 4,
      oldRelation: '比和',
    },
    {
      heaven: '丁',
      earth: '戊',
      name: '青龙得光',
      time: '2025-01-01T11:00:00+08:00',
      hour: '壬午',
      gong: 7,
    },
    {
      heaven: '丁',
      earth: '己',
      name: '火入勾神',
      time: '2025-01-01T13:00:00+08:00',
      hour: '癸未',
      gong: 8,
      oldPatterns: ['星奇入雾'],
    },
    {
      heaven: '丁',
      earth: '庚',
      name: '织女寻牛',
      time: '2025-01-01T01:00:00+08:00',
      hour: '丁丑',
      gong: 9,
    },
    {
      heaven: '丁',
      earth: '辛',
      name: '朱雀入狱',
      time: '2025-01-01T00:00:00+08:00',
      hour: '丙子',
      gong: 1,
    },
    {
      heaven: '丁',
      earth: '壬',
      name: '丁壬化木',
      time: '2025-01-01T23:00:00+08:00',
      hour: '戊子',
      gong: 2,
      oldPatterns: ['日月并行'],
    },
    {
      heaven: '丁',
      earth: '癸',
      name: '朱雀投江',
      time: '2025-01-01T03:00:00+08:00',
      hour: '戊寅',
      gong: 3,
    },
  ];

  for (const item of cases) {
    assert.equal(getStemPairPattern(item.heaven, item.earth)?.name, item.name);

    const data = generateQimen(new Date(item.time));
    assert.equal(data.ganzhi.hour, item.hour);
    assert.ok(
      data.classicPatterns?.some(
        (pattern) => pattern.name === item.name && pattern.palaces.includes(item.gong),
      ),
    );
    assert.ok(
      data.stemRelations?.some(
        (relation) =>
          relation.gong === item.gong &&
          relation.relation === '命名格局' &&
          relation.pattern?.includes(item.name),
      ),
    );
    if (item.oldRelation) {
      assert.ok(
        !data.stemRelations?.some(
          (relation) => relation.gong === item.gong && relation.relation === item.oldRelation,
        ),
      );
    }
    for (const oldPattern of item.oldPatterns ?? []) {
      assert.ok(
        !data.stemRelations?.some(
          (relation) => relation.gong === item.gong && relation.pattern?.includes(oldPattern),
        ),
      );
    }
  }
});

test('奇门己加甲乙丙丁己庚辛壬癸应按宝鉴己组格局输出', () => {
  const cases = [
    {
      heaven: '己',
      earth: '戊',
      name: '伏格青龙',
      time: '2025-01-01T03:00:00+08:00',
      hour: '戊寅',
      gong: 7,
      oldRelation: '比和',
    },
    {
      heaven: '己',
      earth: '乙',
      name: '墓入不明',
      time: '2025-01-01T23:00:00+08:00',
      hour: '戊子',
      gong: 6,
      oldRelation: '奇仪相合',
    },
    {
      heaven: '己',
      earth: '丙',
      name: '孛师',
      time: '2025-01-01T00:00:00+08:00',
      hour: '丙子',
      gong: 5,
      oldRelation: '生上',
    },
    {
      heaven: '己',
      earth: '丁',
      name: '奇入墓',
      time: '2025-01-01T01:00:00+08:00',
      hour: '丁丑',
      gong: 4,
      oldRelation: '入墓',
    },
    {
      heaven: '己',
      earth: '己',
      name: '地户逢鬼',
      time: '2025-01-01T05:00:00+08:00',
      hour: '己卯',
      gong: 8,
      oldRelation: '比和',
    },
    {
      heaven: '己',
      earth: '庚',
      name: '刑格',
      time: '2025-01-01T07:00:00+08:00',
      hour: '庚辰',
      gong: 9,
      oldRelation: '生下',
    },
    {
      heaven: '己',
      earth: '辛',
      name: '魂神入墓',
      time: '2025-01-01T09:00:00+08:00',
      hour: '辛巳',
      gong: 1,
      oldRelation: '生下',
    },
    {
      heaven: '己',
      earth: '壬',
      name: '刑网高张',
      time: '2025-01-01T11:00:00+08:00',
      hour: '壬午',
      gong: 2,
      oldRelation: '击刑',
    },
    {
      heaven: '己',
      earth: '癸',
      name: '地刑玄武',
      time: '2025-01-01T13:00:00+08:00',
      hour: '癸未',
      gong: 3,
      oldRelation: '克下',
    },
  ];

  for (const item of cases) {
    assert.equal(getStemPairPattern(item.heaven, item.earth)?.name, item.name);

    const data = generateQimen(new Date(item.time));
    assert.equal(data.ganzhi.hour, item.hour);
    assert.ok(
      data.classicPatterns?.some(
        (pattern) => pattern.name === item.name && pattern.palaces.includes(item.gong),
      ),
    );
    assert.ok(
      data.stemRelations?.some(
        (relation) =>
          relation.gong === item.gong &&
          relation.relation === '命名格局' &&
          relation.pattern?.includes(item.name),
      ),
    );
    assert.ok(
      !data.stemRelations?.some(
        (relation) => relation.gong === item.gong && relation.relation === item.oldRelation,
      ),
    );
  }
});

test('奇门甲子戊组天地盘干克应应按宝鉴六甲格局输出', () => {
  const cases = [
    {
      heaven: '戊',
      earth: '戊',
      name: '青龙出地',
      time: '2025-01-01T05:00:00+08:00',
      hour: '己卯',
      gong: 7,
    },
    {
      heaven: '戊',
      earth: '乙',
      name: '青龙入云',
      time: '2025-01-01T03:00:00+08:00',
      hour: '戊寅',
      gong: 6,
    },
    {
      heaven: '戊',
      earth: '丙',
      name: '青龙返首',
      time: '2025-01-02T00:00:00+08:00',
      hour: '戊子',
      gong: 5,
    },
    {
      heaven: '戊',
      earth: '丁',
      name: '青龙耀明',
      time: '2025-01-01T00:00:00+08:00',
      hour: '丙子',
      gong: 4,
    },
    {
      heaven: '戊',
      earth: '己',
      name: '青龙合灵',
      time: '2025-01-01T07:00:00+08:00',
      hour: '庚辰',
      gong: 8,
    },
    {
      heaven: '戊',
      earth: '庚',
      name: '青龙符格',
      time: '2025-01-01T09:00:00+08:00',
      hour: '辛巳',
      gong: 9,
      oldPatterns: ['天乙飞宫'],
    },
    {
      heaven: '戊',
      earth: '辛',
      name: '青龙失惊',
      time: '2025-01-01T11:00:00+08:00',
      hour: '壬午',
      gong: 1,
    },
    {
      heaven: '戊',
      earth: '壬',
      name: '青龙网罗',
      time: '2025-01-01T13:00:00+08:00',
      hour: '癸未',
      gong: 2,
    },
    {
      heaven: '戊',
      earth: '癸',
      name: '青龙华盖',
      time: '2025-01-01T01:00:00+08:00',
      hour: '丁丑',
      gong: 3,
    },
  ];

  for (const item of cases) {
    assert.equal(getStemPairPattern(item.heaven, item.earth)?.name, item.name);

    const data = generateQimen(new Date(item.time));
    assert.equal(data.ganzhi.hour, item.hour);
    assert.ok(
      data.classicPatterns?.some(
        (pattern) => pattern.name === item.name && pattern.palaces.includes(item.gong),
      ),
    );
    assert.ok(
      data.stemRelations?.some(
        (relation) =>
          relation.gong === item.gong &&
          relation.relation === '命名格局' &&
          relation.pattern?.includes(item.name),
      ),
    );
    for (const oldPattern of item.oldPatterns ?? []) {
      assert.ok(
        !data.classicPatterns?.some(
          (pattern) => pattern.name === oldPattern && pattern.palaces.includes(item.gong),
        ),
      );
      assert.ok(
        !data.stemRelations?.some(
          (relation) => relation.gong === item.gong && relation.pattern?.includes(oldPattern),
        ),
      );
    }
  }
});

test('奇门庚加甲乙丁庚辛应按宝鉴庚组格局输出', () => {
  const cases = [
    {
      heaven: '庚',
      earth: '戊',
      name: '刑青龙格',
      time: '2025-01-01T23:00:00+08:00',
      hour: '戊子',
      gong: 7,
      oldPatterns: ['天乙太白'],
    },
    {
      heaven: '庚',
      earth: '乙',
      name: '日合六格',
      time: '2025-01-01T00:00:00+08:00',
      hour: '丙子',
      gong: 6,
      oldRelation: '克下',
    },
    {
      heaven: '庚',
      earth: '丁',
      name: '亭亭',
      time: '2025-01-01T13:00:00+08:00',
      hour: '癸未',
      gong: 4,
      oldRelation: '克上',
    },
    {
      heaven: '庚',
      earth: '庚',
      name: '太白',
      time: '2025-01-01T05:00:00+08:00',
      hour: '己卯',
      gong: 9,
      oldRelation: '比和',
    },
    {
      heaven: '庚',
      earth: '辛',
      name: '干格白虎',
      time: '2025-01-01T07:00:00+08:00',
      hour: '庚辰',
      gong: 1,
      oldRelation: '比和',
    },
  ];

  for (const item of cases) {
    assert.equal(getStemPairPattern(item.heaven, item.earth)?.name, item.name);

    const data = generateQimen(new Date(item.time));
    assert.equal(data.ganzhi.hour, item.hour);
    assert.ok(
      data.classicPatterns?.some(
        (pattern) => pattern.name === item.name && pattern.palaces.includes(item.gong),
      ),
    );
    assert.ok(
      data.stemRelations?.some(
        (relation) =>
          relation.gong === item.gong &&
          relation.relation === '命名格局' &&
          relation.pattern?.includes(item.name),
      ),
    );
    if (item.oldRelation) {
      assert.ok(
        !data.stemRelations?.some(
          (relation) => relation.gong === item.gong && relation.relation === item.oldRelation,
        ),
      );
    }
    for (const oldPattern of item.oldPatterns ?? []) {
      assert.ok(
        !data.classicPatterns?.some(
          (pattern) => pattern.name === oldPattern && pattern.palaces.includes(item.gong),
        ),
      );
      assert.ok(
        !data.stemRelations?.some(
          (relation) => relation.gong === item.gong && relation.pattern?.includes(oldPattern),
        ),
      );
    }
  }
});

test('奇门辛壬癸组天地盘干克应应按宝鉴逐干格局输出', () => {
  const cases = [
    {
      heaven: '辛',
      earth: '戊',
      name: '龙困遭伤',
      time: '2025-01-01T00:00:00+08:00',
      hour: '丙子',
      gong: 7,
    },
    {
      heaven: '辛',
      earth: '丙',
      name: '干合荧惑',
      time: '2025-01-01T13:00:00+08:00',
      hour: '癸未',
      gong: 5,
    },
    {
      heaven: '辛',
      earth: '丁',
      name: '狱神入奇',
      time: '2025-01-01T11:00:00+08:00',
      hour: '壬午',
      gong: 4,
    },
    {
      heaven: '辛',
      earth: '己',
      name: '刑狱之格',
      time: '2025-01-01T23:00:00+08:00',
      hour: '戊子',
      gong: 8,
    },
    {
      heaven: '辛',
      earth: '庚',
      name: '白虎伤格',
      time: '2025-01-01T03:00:00+08:00',
      hour: '戊寅',
      gong: 9,
    },
    {
      heaven: '辛',
      earth: '辛',
      name: '狱入自刑',
      time: '2025-01-01T05:00:00+08:00',
      hour: '己卯',
      gong: 1,
    },
    {
      heaven: '辛',
      earth: '壬',
      name: '蛇入狱刑',
      time: '2025-01-01T07:00:00+08:00',
      hour: '庚辰',
      gong: 2,
    },
    {
      heaven: '辛',
      earth: '癸',
      name: '直格华盖',
      time: '2025-01-01T09:00:00+08:00',
      hour: '辛巳',
      gong: 3,
    },
    {
      heaven: '壬',
      earth: '戊',
      name: '蛇化为龙',
      time: '2025-01-01T01:00:00+08:00',
      hour: '丁丑',
      gong: 7,
    },
    {
      heaven: '壬',
      earth: '乙',
      name: '小蛇',
      time: '2025-01-01T13:00:00+08:00',
      hour: '癸未',
      gong: 6,
    },
    {
      heaven: '壬',
      earth: '丙',
      name: '蛇入冶炉',
      time: '2025-01-01T11:00:00+08:00',
      hour: '壬午',
      gong: 5,
    },
    {
      heaven: '壬',
      earth: '丁',
      name: '干合蛇刑',
      time: '2025-01-01T09:00:00+08:00',
      hour: '辛巳',
      gong: 4,
    },
    {
      heaven: '壬',
      earth: '己',
      name: '蛇凶入狱',
      time: '2025-01-01T00:00:00+08:00',
      hour: '丙子',
      gong: 8,
    },
    {
      heaven: '壬',
      earth: '庚',
      name: '太白骑蛇',
      time: '2025-01-01T23:00:00+08:00',
      hour: '戊子',
      gong: 9,
    },
    {
      heaven: '壬',
      earth: '辛',
      name: '螣蛇格干',
      time: '2025-01-01T03:00:00+08:00',
      hour: '戊寅',
      gong: 1,
    },
    {
      heaven: '壬',
      earth: '癸',
      name: '螣蛇飞空',
      time: '2025-01-01T07:00:00+08:00',
      hour: '庚辰',
      gong: 3,
    },
    {
      heaven: '癸',
      earth: '戊',
      name: '罗网青龙',
      time: '2025-01-01T13:00:00+08:00',
      hour: '癸未',
      gong: 7,
    },
    {
      heaven: '癸',
      earth: '乙',
      name: '华盖逢星',
      time: '2025-01-01T11:00:00+08:00',
      hour: '壬午',
      gong: 6,
    },
    {
      heaven: '癸',
      earth: '丙',
      name: '盖遇孛师',
      time: '2025-01-01T09:00:00+08:00',
      hour: '辛巳',
      gong: 5,
    },
    {
      heaven: '癸',
      earth: '己',
      name: '华盖地户',
      time: '2025-01-01T01:00:00+08:00',
      hour: '丁丑',
      gong: 8,
    },
    {
      heaven: '癸',
      earth: '庚',
      name: '大格飞名',
      time: '2025-01-01T00:00:00+08:00',
      hour: '丙子',
      gong: 9,
    },
    {
      heaven: '癸',
      earth: '辛',
      name: '狱入天牢',
      time: '2025-01-01T23:00:00+08:00',
      hour: '戊子',
      gong: 1,
    },
    {
      heaven: '癸',
      earth: '壬',
      name: '复见螣蛇',
      time: '2025-01-01T03:00:00+08:00',
      hour: '戊寅',
      gong: 2,
    },
  ];

  for (const item of cases) {
    assert.equal(getStemPairPattern(item.heaven, item.earth)?.name, item.name);

    const data = generateQimen(new Date(item.time));
    assert.equal(data.ganzhi.hour, item.hour);
    assert.ok(
      data.classicPatterns?.some(
        (pattern) => pattern.name === item.name && pattern.palaces.includes(item.gong),
      ),
    );
    assert.ok(
      data.stemRelations?.some(
        (relation) =>
          relation.gong === item.gong &&
          relation.relation === '命名格局' &&
          relation.pattern?.includes(item.name),
      ),
    );
  }
});

test('奇门天乙飞宫伏宫应按当前值符所带天盘干判定', () => {
  const feiGong = generateQimen(new Date('2025-01-01T08:00:00+08:00')).classicPatterns ?? [];
  assert.ok(
    feiGong.some(
      (pattern) =>
        pattern.name === '天乙飞宫格' &&
        pattern.summary.includes('所携己加地盘庚') &&
        pattern.summary.includes('天乙飞宫格') &&
        pattern.summary.includes('天乙行符与太白格'),
    ),
  );

  const fuGong = generateQimen(new Date('2025-01-01T04:00:00+08:00')).classicPatterns ?? [];
  assert.ok(
    fuGong.some(
      (pattern) =>
        pattern.name === '天乙伏宫格' &&
        pattern.summary.includes('天盘庚加地盘值符') &&
        pattern.summary.includes('所携己') &&
        pattern.summary.includes('天乙伏宫格') &&
        pattern.summary.includes('天乙留符格'),
    ),
  );

  const falsePositive = generateQimen(new Date('2025-01-01T02:00:00+08:00')).classicPatterns ?? [];
  assert.ok(!falsePositive.some((pattern) => pattern.name.startsWith('天乙')));
});

test('奇门日干飞伏格应按当天日干判定并处理甲遁六仪', () => {
  const yiDayPatterns = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(3, '庚', { diPan: { stem: '乙' } }),
      buildQimenPalace(6, '乙', { diPan: { stem: '庚' } }),
    ],
    zhiFu: '',
    zhiShi: '',
    dayStem: '乙',
    dayGanZhi: '乙丑',
  });

  const yiFuGan = yiDayPatterns.find((pattern) => pattern.name === '伏干格');
  assert.equal(yiFuGan?.palace, 3);
  assert.match(yiFuGan?.summary || '', /六庚加日干为伏干格/);

  const yiFeiGan = yiDayPatterns.find((pattern) => pattern.name === '飞干格');
  assert.equal(yiFeiGan?.palace, 6);
  assert.match(yiFeiGan?.summary || '', /日干加六庚为飞干格/);

  const jiaDayPatterns = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(2, '庚', { diPan: { stem: '戊' } }),
      buildQimenPalace(7, '戊', { diPan: { stem: '庚' } }),
    ],
    zhiFu: '',
    zhiShi: '',
    dayStem: '甲',
    dayGanZhi: '甲子',
  });
  assert.ok(
    jiaDayPatterns.some(
      (pattern) =>
        pattern.name === '伏干格' &&
        pattern.palace === 2 &&
        pattern.summary.includes('甲子遁戊'),
    ),
  );

  const noDayContext = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(3, '庚', { diPan: { stem: '乙' } })],
    zhiFu: '',
    zhiShi: '',
  });
  assert.ok(!noDayContext.some((pattern) => pattern.name === '伏干格'));
});

test('奇门岁格月格时格应按六庚加年月时干判定', () => {
  const suiGe = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(1, '庚', { diPan: { stem: '辛' } })],
    zhiFu: '',
    zhiShi: '',
    yearGanZhi: '辛丑',
  });
  assert.ok(
    suiGe.some(
      (pattern) =>
        pattern.name === '岁格' &&
        pattern.palace === 1 &&
        pattern.summary.includes('天盘庚加岁干辛'),
    ),
  );

  const noRawJiaMonth = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(2, '庚', { diPan: { stem: '甲' } })],
    zhiFu: '',
    zhiShi: '',
    monthGanZhi: '甲子',
  });
  assert.ok(!noRawJiaMonth.some((pattern) => pattern.name === '月格'));

  const jiaMonth = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(3, '庚', { diPan: { stem: '戊' } })],
    zhiFu: '',
    zhiShi: '',
    monthGanZhi: '甲子',
  });
  assert.ok(
    jiaMonth.some(
      (pattern) =>
        pattern.name === '月格' &&
        pattern.palace === 3 &&
        pattern.summary.includes('甲子遁戊'),
    ),
  );

  const shiGe = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(4, '庚', { diPan: { stem: '己' } })],
    zhiFu: '',
    zhiShi: '',
    hourGanZhi: '甲戌',
  });
  assert.ok(
    shiGe.some(
      (pattern) =>
        pattern.name === '时格' &&
        pattern.palace === 4 &&
        pattern.summary.includes('甲戌遁己'),
    ),
  );

  const dayOnly = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(5, '庚', { diPan: { stem: '乙' } })],
    zhiFu: '',
    zhiShi: '',
    dayStem: '乙',
    dayGanZhi: '乙丑',
  });
  assert.ok(dayOnly.some((pattern) => pattern.name === '伏干格'));
  assert.ok(!dayOnly.some((pattern) => pattern.name === '日格'));
});

test('奇门丙奇临年月日时干应输出勃格类风险', () => {
  const suiGanBoGe = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(1, '丙', { diPan: { stem: '辛' } })],
    zhiFu: '',
    zhiShi: '',
    yearGanZhi: '辛丑',
  });
  assert.ok(
    suiGanBoGe.some(
      (pattern) =>
        pattern.name === '岁干勃格' &&
        pattern.palace === 1 &&
        pattern.summary.includes('天盘丙加岁干辛'),
    ),
  );

  const noRawJiaDay = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(2, '丙', { diPan: { stem: '甲' } })],
    zhiFu: '',
    zhiShi: '',
    dayGanZhi: '甲子',
  });
  assert.ok(!noRawJiaDay.some((pattern) => pattern.name === '日干勃格'));

  const jiaDayBoGe = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(3, '丙', { diPan: { stem: '戊' } })],
    zhiFu: '',
    zhiShi: '',
    dayGanZhi: '甲子',
  });
  assert.ok(
    jiaDayBoGe.some(
      (pattern) =>
        pattern.name === '日干勃格' &&
        pattern.palace === 3 &&
        pattern.summary.includes('甲子遁戊'),
    ),
  );

  const shiGanBoGe = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(4, '丙', { diPan: { stem: '己' } })],
    zhiFu: '',
    zhiShi: '',
    hourGanZhi: '甲戌',
  });
  assert.ok(
    shiGanBoGe.some(
      (pattern) =>
        pattern.name === '时干勃格' &&
        pattern.palace === 4 &&
        pattern.summary.includes('甲戌遁己'),
    ),
  );
});

test('奇门六壬临时干应输出地罗遮蔽', () => {
  const diLuo = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(6, '壬', { diPan: { stem: '壬' } })],
    zhiFu: '',
    zhiShi: '',
    hourGanZhi: '壬申',
  });
  assert.ok(
    diLuo.some(
      (pattern) =>
        pattern.name === '地罗遮蔽' &&
        pattern.palace === 6 &&
        pattern.summary.includes('天盘壬加时干壬') &&
        pattern.summary.includes('地网'),
    ),
  );

  const noRawJiaHour = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(7, '壬', { diPan: { stem: '甲' } })],
    zhiFu: '',
    zhiShi: '',
    hourGanZhi: '甲戌',
  });
  assert.ok(!noRawJiaHour.some((pattern) => pattern.name === '地罗遮蔽'));

  const jiaHourDiLuo = getClassicPatterns({
    jiuGongGe: [buildQimenPalace(8, '壬', { diPan: { stem: '己' } })],
    zhiFu: '',
    zhiShi: '',
    hourGanZhi: '甲戌',
  });
  assert.ok(
    jiaHourDiLuo.some(
      (pattern) =>
        pattern.name === '地罗遮蔽' &&
        pattern.palace === 8 &&
        pattern.summary.includes('甲戌遁己'),
    ),
  );
});

test('奇门六庚值符临丙应输出格勃而不替代太白入荧', () => {
  const patterns = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(2, '庚', {
        tianPan: { star: '天芮', stem: '庚' },
        diPan: { stem: '丙' },
      }),
    ],
    zhiFu: '天芮',
    zhiShi: '',
  });

  const geBo = patterns.find((pattern) => pattern.name === '格勃');
  assert.equal(geBo?.tone, 'bad');
  assert.equal(geBo?.score, -8);
  assert.equal(geBo?.palace, 2);
  assert.match(geBo?.summary || '', /值符天芮携六庚加地盘丙/);
  assert.match(geBo?.summary || '', /飞勃/);
  assert.ok(patterns.some((pattern) => pattern.name === '太白入荧' && pattern.palace === 2));

  const noGengZhiFu = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(2, '庚', {
        tianPan: { star: '天芮', stem: '庚' },
        diPan: { stem: '丙' },
      }),
    ],
    zhiFu: '天蓬',
    zhiShi: '',
  });
  assert.ok(!noGengZhiFu.some((pattern) => pattern.name === '格勃'));

  const noBingEarth = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(2, '庚', {
        tianPan: { star: '天芮', stem: '庚' },
        diPan: { stem: '丁' },
      }),
    ],
    zhiFu: '天芮',
    zhiShi: '',
  });
  assert.ok(!noBingEarth.some((pattern) => pattern.name === '格勃'));
});

test('奇门六庚值符遇丙加庚应输出勃格而不替代荧入太白', () => {
  const patterns = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(2, '庚', {
        tianPan: { star: '天芮', stem: '庚' },
        diPan: { stem: '丁' },
      }),
      buildQimenPalace(6, '丙', {
        tianPan: { star: '天辅', stem: '丙' },
        diPan: { stem: '庚' },
      }),
    ],
    zhiFu: '天芮',
    zhiShi: '',
  });

  const boGe = patterns.find((pattern) => pattern.name === '勃格');
  assert.equal(boGe?.tone, 'bad');
  assert.equal(boGe?.score, -8);
  assert.equal(boGe?.palace, 6);
  assert.match(boGe?.summary || '', /天盘丙加地盘直符庚/);
  assert.match(boGe?.summary || '', /值符天芮携六庚/);
  assert.ok(patterns.some((pattern) => pattern.name === '荧入太白' && pattern.palace === 6));

  const noGengZhiFu = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(2, '己', {
        tianPan: { star: '天芮', stem: '己' },
        diPan: { stem: '丁' },
      }),
      buildQimenPalace(6, '丙', {
        tianPan: { star: '天辅', stem: '丙' },
        diPan: { stem: '庚' },
      }),
    ],
    zhiFu: '天芮',
    zhiShi: '',
  });
  assert.ok(!noGengZhiFu.some((pattern) => pattern.name === '勃格'));
  assert.ok(noGengZhiFu.some((pattern) => pattern.name === '荧入太白' && pattern.palace === 6));
});

test('奇门相佐与守户应按值符值使加地盘丙丁判定', () => {
  for (const earthStem of ['丙', '丁']) {
    const patterns = getClassicPatterns({
      jiuGongGe: [
        buildQimenPalace(1, '戊', {
          tianPan: { star: '天蓬', stem: '戊' },
          diPan: { stem: earthStem },
        }),
      ],
      zhiFu: '天蓬',
      zhiShi: '',
    });

    assert.ok(
      patterns.some(
        (pattern) =>
          pattern.name === '相佐' &&
          pattern.palace === 1 &&
          pattern.summary.includes(`地盘${earthStem}`),
      ),
    );
  }

  const noXiangZuo = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(1, '丙', {
        tianPan: { star: '天蓬', stem: '丙' },
        diPan: { stem: '庚' },
      }),
    ],
    zhiFu: '天蓬',
    zhiShi: '',
  });
  assert.ok(!noXiangZuo.some((pattern) => pattern.name === '相佐'));

  const shouHu = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(2, '己', {
        diPan: { stem: '丁' },
        renPan: { door: '杜门' },
      }),
    ],
    zhiFu: '',
    zhiShi: '杜门',
  });
  assert.ok(
    shouHu.some(
      (pattern) =>
        pattern.name === '守户' &&
        pattern.palace === 2 &&
        pattern.summary.includes('地盘丁奇'),
    ),
  );
  assert.ok(
    shouHu.some(
      (pattern) =>
        pattern.name === '玉女守门' &&
        pattern.palace === 2 &&
        pattern.summary.includes('杜门非三吉门'),
    ),
  );

  const noShouHu = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(2, '己', {
        diPan: { stem: '庚' },
        renPan: { door: '杜门' },
      }),
    ],
    zhiFu: '',
    zhiShi: '杜门',
  });
  assert.ok(!noShouHu.some((pattern) => pattern.name === '守户'));
});

test('奇门玉女守门应按值使门加地盘丁判定', () => {
  const palaces = arrangeJiuGongGe(true, 1, '天蓬', '休门', { hour: '庚午' });
  const duiPalace = palaces.find((palace) => palace.gong === 7);

  assert.equal(duiPalace?.diPan.stem, '丁');
  assert.equal(duiPalace?.renPan.door, '休门');
  assert.notEqual(duiPalace?.tianPan.stem, '丁');

  const patterns = getClassicPatterns({
    jiuGongGe: palaces,
    zhiFu: '天蓬',
    zhiShi: '休门',
    dayStem: '甲',
  });

  assert.ok(
    patterns.some(
      (pattern) =>
        pattern.name === '玉女守门' &&
        pattern.palace === 7 &&
        pattern.summary.includes('地盘丁奇') &&
        pattern.summary.includes('休门三吉门'),
    ),
  );
});

test('奇门六癸时应按天盘癸落宫区分天网高低', () => {
  const lowNet = generateQimen(new Date('2025-01-07T09:00:00+08:00'));
  assert.equal(lowNet.specialConditions?.isLiuGuiHour, true);
  assert.match(lowNet.specialConditions?.description ?? '', /天盘癸落坎一宫/);
  assert.match(lowNet.specialConditions?.description ?? '', /天网临一至三宫为低/);

  const tombNet = generateQimen(new Date('2025-01-04T02:00:00+08:00'));
  assert.match(tombNet.specialConditions?.description ?? '', /天网临巽四宫为入墓/);

  const highNet = generateQimen(new Date('2025-01-01T14:00:00+08:00'));
  assert.match(highNet.specialConditions?.description ?? '', /天盘癸落兑七宫/);
  assert.match(highNet.specialConditions?.description ?? '', /天网临七至九宫为高，古称天网四张/);
});

test('奇门三奇得基础标签应以三奇合吉门为准', () => {
  const noDoorPalace = buildQimenPalace(3, '乙');
  noDoorPalace.renPan.door = '杜门';

  const noDoorTags = getQimenPatternTags({
    zhiFu: '天蓬',
    zhiShi: '休门',
    zhiFuLandingPalace: 2,
    zhiShiLandingPalace: 2,
    jiuGongGe: [noDoorPalace],
    hourGanForFind: '戊',
  });

  assert.ok(!noDoorTags.some((tag) => tag.startsWith('三奇得（')));

  const goodDoorPalace = buildQimenPalace(1, '乙');
  goodDoorPalace.renPan.door = '休门';

  const goodDoorTags = getQimenPatternTags({
    zhiFu: '天蓬',
    zhiShi: '休门',
    zhiFuLandingPalace: 2,
    zhiShiLandingPalace: 2,
    jiuGongGe: [goodDoorPalace],
    hourGanForFind: '戊',
  });

  assert.ok(goodDoorTags.includes('三奇得（乙奇（日奇）合休门于坎一宫）'));
});

test('奇门方位评分不应把有奇无门当作吉方依据', () => {
  const noDoorPalace = buildQimenPalace(3, '乙');
  noDoorPalace.renPan.door = '杜门';

  assert.equal(getPalaceScore(noDoorPalace), 0);

  const goodDoorPalace = buildQimenPalace(1, '乙');
  goodDoorPalace.renPan.door = '休门';

  assert.equal(getPalaceScore(goodDoorPalace), 5);

  const directions = buildDirectionAdvice([noDoorPalace, goodDoorPalace]);
  const goodDirection = directions.goodDirections.find((item) => item.gong === 1);
  const noDoorDirection = directions.goodDirections.find((item) => item.gong === 3);

  assert.ok(goodDirection?.reasons.includes('乙奇合休门'));
  assert.ok(!(noDoorDirection?.reasons ?? []).some((reason) => reason.includes('奇')));
});

test('奇门方位建议不应把负分宫位输出为吉方', () => {
  const worstPalace = buildQimenPalace(2, '辛');
  worstPalace.renPan.door = '死门';
  worstPalace.shenPan.god = '白虎';
  worstPalace.tianPan.star = '天芮';

  const badPalace = buildQimenPalace(3, '庚');
  badPalace.renPan.door = '伤门';
  badPalace.shenPan.god = '螣蛇';
  badPalace.tianPan.star = '天蓬';

  const directions = buildDirectionAdvice([worstPalace, badPalace]);

  assert.deepEqual(directions.goodDirections, []);
  assert.equal(directions.avoidDirections[0]?.gong, 2);
  assert.ok(directions.avoidDirections[0]?.reasons.includes('死门'));
  assert.ok(directions.avoidDirections[0]?.reasons.includes('白虎'));
});

test('奇门宝鉴三奇得使应按值使吉门加三奇判定', () => {
  const zhiShiPalace = buildQimenPalace(1, '乙', {
    renPan: { door: '休门' },
  });
  const otherGoodDoorPalace = buildQimenPalace(3, '丙', {
    renPan: { door: '开门' },
  });
  const jiuGongGe = [zhiShiPalace, otherGoodDoorPalace];

  const tags = getQimenPatternTags({
    zhiFu: '',
    zhiShi: '休门',
    zhiFuLandingPalace: 1,
    zhiShiLandingPalace: 1,
    jiuGongGe,
    hourGanForFind: '戊',
  });

  assert.ok(tags.includes('三奇得（乙奇（日奇）合休门于坎一宫）'));
  assert.ok(tags.includes('三奇得（丙奇（月奇）合开门于震三宫）'));
  assert.ok(tags.includes('宝鉴三奇得使（值使休门加乙奇（日奇）于坎一宫）'));
  assert.ok(!tags.some((tag) => tag.includes('值使开门加丙奇')));

  const details = buildPatternDetails(tags);
  const baoJianDetail = details.find((detail) => detail.tag.startsWith('宝鉴三奇得使'));
  assert.match(baoJianDetail?.summary || '', /值使吉门加临三奇/);

  const classicPatterns = getClassicPatterns({
    jiuGongGe,
    zhiFu: '',
    zhiShi: '休门',
  });
  const baoJianPattern = classicPatterns.find((pattern) => pattern.name === '宝鉴三奇得使');
  assert.equal(baoJianPattern?.score, 9);
  assert.match(baoJianPattern?.summary || '', /得三吉门、直使加奇/);
  assert.match(baoJianPattern?.summary || '', /谋为尤利/);

  const noZhiShiMatch = getClassicPatterns({
    jiuGongGe,
    zhiFu: '',
    zhiShi: '生门',
  });
  assert.ok(!noZhiShiMatch.some((pattern) => pattern.name === '宝鉴三奇得使'));
});

test('奇门三奇得使应按六甲旬首所遁六仪判定', () => {
  const deShi = generateQimen(new Date('2025-01-01T22:00:00+08:00'));
  assert.ok(deShi.patternTags.includes('三奇得使（乙奇（日奇）加甲戌/甲午所遁辛于坎一宫）'));
  assert.ok(
    deShi.patternDetails
      .filter((detail) => detail.tag.startsWith('三奇得使'))
      .every((detail) => !detail.summary.includes('临值使门')),
  );
  assert.ok((deShi.classicPatterns ?? []).some((pattern) => pattern.name === '日奇得使'));

  const dingQiDeShi = generateQimen(new Date('2025-01-02T02:00:00+08:00'));
  assert.ok(dingQiDeShi.patternTags.includes('三奇得使（丁奇（星奇）加甲辰/甲寅所遁癸于震三宫）'));
  assert.ok((dingQiDeShi.classicPatterns ?? []).some((pattern) => pattern.name === '星奇得使'));

  const falsePositive = generateQimen(new Date('2025-01-01T00:00:00+08:00'));
  assert.ok(!falsePositive.patternTags.some((tag) => tag.startsWith('三奇得使（')));
});

test('奇门三奇游六仪应按当旬值符所带六仪加地盘三奇判定', () => {
  const jiaXuCase = arrangeJiuGongGe(true, 1, '天芮', '死门', { hour: '乙亥' });
  const jiaXuPatterns = getClassicPatterns({
    jiuGongGe: jiaXuCase,
    zhiFu: '天芮',
    zhiShi: '死门',
  });

  assert.ok(
    jiaXuPatterns.some(
      (pattern) =>
        pattern.name === '三奇游六仪' &&
        pattern.palace === 9 &&
        pattern.summary.includes('甲戌己值符加地盘乙奇') &&
        pattern.summary.includes('游于甲午辛'),
    ),
  );

  const jiaXuTags = getQimenPatternTags({
    zhiFu: '天芮',
    zhiShi: '死门',
    zhiFuLandingPalace: 9,
    zhiShiLandingPalace: 3,
    jiuGongGe: jiaXuCase,
    hourGanForFind: '乙',
  });
  assert.ok(
    jiaXuTags.includes('三奇游六仪（甲戌己值符加乙奇（日奇）于离九宫，游甲午辛）'),
  );

  const jiaWuCase = arrangeJiuGongGe(true, 1, '天辅', '杜门', { hour: '乙未' });
  const jiaWuPatterns = getClassicPatterns({
    jiuGongGe: jiaWuCase,
    zhiFu: '天辅',
    zhiShi: '杜门',
  });

  assert.ok(
    jiaWuPatterns.some(
      (pattern) =>
        pattern.name === '三奇游六仪' &&
        pattern.palace === 9 &&
        pattern.summary.includes('甲午辛值符加地盘乙奇') &&
        pattern.summary.includes('游于甲戌己'),
    ),
  );

  const bingDingCases = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(6, '戊', {
        tianPan: { star: '天心', stem: '戊' },
        diPan: { stem: '丙' },
      }),
      buildQimenPalace(7, '癸', {
        tianPan: { star: '天柱', stem: '癸' },
        diPan: { stem: '丁' },
      }),
    ],
    zhiFu: '天心',
    zhiShi: '',
  });
  assert.ok(
    bingDingCases.some(
      (pattern) => pattern.name === '三奇游六仪' && pattern.summary.includes('月奇游于甲申庚'),
    ),
  );
  assert.ok(!bingDingCases.some((pattern) => pattern.summary.includes('星奇游于甲辰壬')));

  const dingCase = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(7, '癸', {
        tianPan: { star: '天柱', stem: '癸' },
        diPan: { stem: '丁' },
      }),
    ],
    zhiFu: '天柱',
    zhiShi: '',
  });
  assert.ok(
    dingCase.some(
      (pattern) => pattern.name === '三奇游六仪' && pattern.summary.includes('星奇游于甲辰壬'),
    ),
  );

  const noCurrentZhiFu = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(9, '己', {
        tianPan: { star: '天芮', stem: '己' },
        diPan: { stem: '乙' },
      }),
    ],
    zhiFu: '天蓬',
    zhiShi: '',
  });
  assert.ok(!noCurrentZhiFu.some((pattern) => pattern.name === '三奇游六仪'));
});

test('奇门天辅时主口径应按宝鉴六甲时识别，别传口径单独标注', () => {
  const names = (time: string) =>
    generateQimen(new Date(time)).classicPatterns?.map((pattern) => pattern.name) ?? [];

  const sixJiaCase = generateQimen(new Date('2025-01-25T19:00:00+08:00'));
  assert.equal(sixJiaCase.ganzhi.hour, '甲戌');
  assert.ok(names('2025-01-25T19:00:00+08:00').includes('天辅时'));
  assert.ok(
    sixJiaCase.classicPatterns?.some(
      (pattern) => pattern.name === '天辅时' && pattern.summary.includes('甲戌时'),
    ),
  );

  const variantCase = generateQimen(new Date('2025-01-05T09:00:00+08:00'));
  assert.ok(!names('2025-01-05T09:00:00+08:00').includes('天辅时'));
  assert.ok(names('2025-01-05T09:00:00+08:00').includes('天辅时（别传）'));
  assert.ok(
    variantCase.classicPatterns?.some(
      (pattern) => pattern.name === '天辅时（别传）' && pattern.summary.includes('《遁甲演义》'),
    ),
  );
});

test('奇门五合时应按日干与时干五合独立输出', () => {
  const jiaJi = getClassicPatterns({
    jiuGongGe: [],
    zhiFu: '',
    zhiShi: '',
    dayStem: '甲',
    hourGanZhi: '己巳',
  });

  assert.ok(
    jiaJi.some(
      (pattern) =>
        pattern.name === '五合时' &&
        pattern.summary.includes('日干与时干五合') &&
        pattern.summary.includes('同，但宜谋和合、隐秘诸事'),
    ),
  );

  const jiJia = getClassicPatterns({
    jiuGongGe: [],
    zhiFu: '',
    zhiShi: '',
    dayStem: '己',
    hourGanZhi: '甲子',
  });
  assert.ok(jiJia.some((pattern) => pattern.name === '五合时'));

  const notWuHe = getClassicPatterns({
    jiuGongGe: [],
    zhiFu: '',
    zhiShi: '',
    dayStem: '甲',
    hourGanZhi: '庚午',
  });
  assert.ok(!notWuHe.some((pattern) => pattern.name === '五合时'));
});

test('奇门三遁与鬼遁应按门奇仪神组合判定', () => {
  const names = (time: string) =>
    generateQimen(new Date(time)).classicPatterns?.map((pattern) => pattern.name) ?? [];

  assert.ok(!names('2025-01-04T01:00:00+08:00').includes('天遁'));

  assert.ok(names('2025-01-07T23:00:00+08:00').includes('天遁'));

  assert.ok(names('2025-01-13T13:00:00+08:00').includes('地遁'));

  assert.ok(!names('2025-01-05T15:00:00+08:00').includes('鬼遁'));

  assert.ok(names('2025-01-03T23:00:00+08:00').includes('鬼遁'));
});

test('时间型占卜算法应拒绝无效自定义时间对象', () => {
  const invalidDate = new Date(Number.NaN);

  assert.throws(() => generateLiuyao(invalidDate), /自定义时间不是有效日期/);
  assert.throws(() => generateQimen(invalidDate), /自定义时间不是有效日期/);
});

test('占卜时间格式化遇到无法转换为 Date 的时间戳时应回退当前时间', () => {
  assert.doesNotThrow(() =>
    buildTimeInfoText({
      timestamp: Number.MAX_VALUE,
    } as Parameters<typeof buildTimeInfoText>[0]),
  );
});

test('前端占卜草稿可把自定北京时间传给按时间起卦的方法', async () => {
  const session = await generateDivinationSession(
    buildDraft({
      method: 'qimen',
      divinationTimeMode: 'custom',
      customDivinationDate: '2025-01-01',
      customDivinationTime: '08:30',
    }),
  );

  assert.equal(session.method, 'qimen');
  assert.equal(session.data.timestamp, new Date('2025-01-01T08:30:00+08:00').getTime());
  assert.match(session.prompt, /2025年1月1日 8时30分/);
});

test('六爻提示词应同时写出日辰和月建参与的三合局', async () => {
  const session = await generateDivinationSession(
    buildDraft({
      method: 'liuyao',
      divinationTimeMode: 'custom',
      customDivinationDate: '2025-01-01',
      customDivinationTime: '00:00',
    }),
  );
  const data = session.data as ReturnType<typeof generateLiuyao>;

  assert.equal(data.sanheWithDay?.group, '火局');
  assert.equal(data.sanheWithMonth?.group, '水局');
  assert.match(session.prompt, /日辰午引动火局（寅、午、戌）/);
  assert.match(session.prompt, /月建子引动水局（申、子、辰）/);
});

test('自定起卦时间缺少日期或时间时应明确提示', async () => {
  await assert.rejects(
    () =>
      generateDivinationSession(
        buildDraft({
          method: 'liuyao',
          divinationTimeMode: 'custom',
          customDivinationDate: '2025-01-01',
          customDivinationTime: '',
        }),
      ),
    /自定起卦时间需要填写日期和时间/,
  );
});

test('占卜自定义问题只保留基础信息与用户问题，不强塞任务和输出要求', async () => {
  const session = await generateDivinationSession(
    buildDraft({
      method: 'meihua',
      question: '我自己只想问这个具体情况。',
      questionSource: 'custom',
    }),
  );

  assert.ok(session.prompt.includes('【占卜信息】'));
  assert.ok(session.prompt.includes('【问题】'));
  assert.ok(session.prompt.includes('我自己只想问这个具体情况。'));
  assert.ok(!session.prompt.includes('【任务】'));
  assert.ok(!session.prompt.includes('【输出要求】'));
});

test('黄历择日会结合可选事项、日期范围和多位出生信息生成提示词', async () => {
  const session = await generateDivinationSession(
    buildDraft({
      method: 'almanac',
      question: '我们准备搬家，想选一个兼顾两个人的日子。',
      almanacParticipants: [
        {
          id: 'self',
          name: '本人',
          gender: '男',
          year: '1990',
          month: '1',
          day: '1',
          timeIndex: '12',
          dateType: 'solar',
        },
        {
          id: 'partner',
          name: '伴侣',
          gender: '女',
          year: '1992',
          month: '6',
          day: '8',
          timeIndex: '5',
          dateType: 'solar',
        },
      ],
    }),
  );

  assert.equal(session.method, 'almanac');
  assert.match(session.prompt, /占法：黄历择日/);
  assert.match(session.prompt, /择日事项：搬家入宅/);
  assert.match(session.prompt, /候选日期：2026-06-01 至 2026-06-05/);
  assert.match(session.prompt, /取舍证据：首选/);
  assert.match(session.prompt, /慎用/);
  assert.match(session.prompt, /只在候选日期范围内排序/);
  assert.match(session.prompt, /参与人八字参考：/);
  assert.match(session.prompt, /本人：男/);
  assert.ok('days' in session.data && session.data.days.length === 5);
});

test('黄历择日不强制填写问题，空补充时仍生成完整择日提示词和历史标题', async () => {
  const session = await generateDivinationSession(
    buildDraft({
      method: 'almanac',
      question: '',
      questionSource: 'custom',
      almanacTopic: 'contract',
      almanacEndDate: '2026-06-03',
    }),
  );

  assert.equal(session.method, 'almanac');
  assert.equal(session.question, '黄历择日：签约合作（2026-06-01 至 2026-06-03）');
  assert.match(session.prompt, /【占卜信息】/);
  assert.match(session.prompt, /【任务】/);
  assert.match(session.prompt, /【输出要求】/);
  assert.doesNotMatch(session.prompt, /【问题】/);
});

test('占卜引擎黄历择日应在本地拒绝无效日期范围', async () => {
  const invalidCases: Array<[Partial<DivinationDraftInput>, RegExp]> = [
    [{ almanacStartDate: '2026/06/01', almanacEndDate: '2026-06-05' }, /startDate 需要使用/],
    [
      { almanacStartDate: '0000-06-01', almanacEndDate: '0000-06-05' },
      /startDate 年份需在 1900-2100 之间/,
    ],
    [
      { almanacStartDate: '9999-06-01', almanacEndDate: '9999-06-05' },
      /startDate 年份需在 1900-2100 之间/,
    ],
    [{ almanacStartDate: '2026-06-31', almanacEndDate: '2026-07-02' }, /startDate 不是有效日期/],
    [
      { almanacStartDate: '2026-06-05', almanacEndDate: '2026-06-01' },
      /endDate 不能早于 startDate/,
    ],
    [{ almanacStartDate: '2026-06-01', almanacEndDate: '2026-07-10' }, /最多比较 31 天/],
  ];

  for (const [overrides, messagePattern] of invalidCases) {
    await assert.rejects(
      () =>
        generateDivinationSession(
          buildDraft({
            method: 'almanac',
            question: '',
            ...overrides,
          }),
        ),
      messagePattern,
    );
  }
});

test('黄历择日应拒绝资料完整但字段非法的参与人出生信息', async () => {
  const invalidCases: Array<
    [Partial<DivinationDraftInput['almanacParticipants'][number]>, RegExp]
  > = [
    [{ day: '31', month: '2' }, /参与人出生日期需在 1-28 之间/],
    [{ timeIndex: ' ' }, /参与人出生时辰必须是 0-12 的整数/],
    [{ timeIndex: '13' }, /参与人出生时辰必须是 0-12 的整数/],
  ];

  for (const [participantOverrides, messagePattern] of invalidCases) {
    await assert.rejects(
      () =>
        generateDivinationSession(
          buildDraft({
            method: 'almanac',
            question: '',
            almanacParticipants: [
              {
                id: 'self',
                name: '本人',
                gender: '男',
                year: '1990',
                month: '5',
                day: '20',
                timeIndex: '6',
                dateType: 'solar',
                ...participantOverrides,
              },
            ],
          }),
        ),
      messagePattern,
    );
  }
});

test('占卜引擎星盘应在本地拒绝无效出生时间和经纬度', async () => {
  const invalidCases: Array<[Partial<DivinationDraftInput>, RegExp]> = [
    [{ astrolabeDay: '31', astrolabeMonth: '2' }, /日期需在 1-28 之间/],
    [{ astrolabeHour: '24' }, /出生小时不能大于 23/],
    [{ astrolabeMinute: '60' }, /出生分钟不能大于 59/],
    [{ astrolabeLatitude: '0x10' }, /出生地纬度必须是数字/],
    [{ astrolabeLatitude: '100' }, /出生地纬度不能大于 90/],
    [{ astrolabeLongitude: '1e2' }, /出生地经度必须是数字/],
    [{ astrolabeLongitude: '181' }, /出生地经度不能大于 180/],
    [{ astrolabeTimezone: 'Infinity' }, /时区必须是数字/],
    [{ astrolabeTimezone: '99' }, /时区不能大于 14/],
  ];

  for (const [overrides, messagePattern] of invalidCases) {
    await assert.rejects(
      () =>
        generateDivinationSession(
          buildDraft({
            method: 'astrolabe',
            ...overrides,
          }),
        ),
      messagePattern,
    );
  }
});

test('占卜引擎数字起卦只接受十进制正整数文本', async () => {
  await assert.rejects(
    () =>
      generateDivinationSession(
        buildDraft({
          method: 'meihua',
          meihuaMethod: 'number',
          meihuaNumber: '0x10',
        }),
      ),
    /数字起卦需要填写正整数/,
  );

  await assert.rejects(
    () =>
      generateDivinationSession(
        buildDraft({
          method: 'xiaoliuren',
          xiaoliurenMethod: 'number',
          xiaoliurenNumber: '1e2',
        }),
      ),
    /小六壬数字起课需要填写正整数/,
  );
});

test('小六壬支持时间起课与数字起课，并生成适合复制给 AI 的提示词', async () => {
  const timeSession = await generateDivinationSession(
    buildDraft({
      method: 'xiaoliuren',
      question: '这件事现在该不该继续推进？',
      almanacStartDate: '',
      almanacEndDate: '',
    }),
  );

  assert.equal(timeSession.method, 'xiaoliuren');
  assert.match(timeSession.prompt, /占法：小六壬/);
  assert.match(timeSession.prompt, /起因/);
  assert.match(timeSession.prompt, /过程/);
  assert.match(timeSession.prompt, /结果/);

  const numberSession = await generateDivinationSession(
    buildDraft({
      method: 'xiaoliuren',
      question: '这件事现在该不该继续推进？',
      xiaoliurenMethod: 'number',
      xiaoliurenNumber: '18',
      almanacStartDate: '',
      almanacEndDate: '',
    }),
  );

  assert.equal(numberSession.method, 'xiaoliuren');
  assert.match(numberSession.prompt, /起课方式数字起课/);
});

test('小六壬数字起课底层算法缺少数字时应明确失败', () => {
  assert.throws(() => generateXiaoliuren({ method: 'number' }), /小六壬数字起课必须提供正整数/);
});
