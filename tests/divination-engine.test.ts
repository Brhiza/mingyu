import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDivinationSession } from '../src/lib/divination/engine';
import { buildTimeInfoText, formatDivinationInfo } from '../src/lib/divination/engine/formatters';
import { getDivinationSummaryBlocks } from '../src/lib/divination/summary';
import { getMonthGeneralByZhongqi } from '../packages/core/src/calendar/month-general';
import {
  TAROT_SPREAD_INSPIRATION_QUESTIONS,
  resolveDivinationInspiredDraftPatch,
} from '../src/lib/divination/inspiration';
import type {
  LenormandData,
  QimenData,
  QimenJiuGongGe,
  SsgwData,
  TaiyiResult,
  TarotData,
} from '../packages/core/src/types/divination';
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
import { buildDirectionAdvice } from '../packages/core/src/divination/algorithms/qimen/helpers/directions';
import { createQimenPriorityPalaces } from '../packages/core/src/divination/algorithms/qimen/helpers/guidance';
import {
  checkSpecialHourConditions,
  getZhiFuZhiShi,
} from '../packages/core/src/divination/algorithms/qimen/helpers/jushu';
import { arrangeJiuGongGe } from '../packages/core/src/divination/algorithms/qimen/helpers/layout';
import { estimateYingQi } from '../packages/core/src/divination/algorithms/qimen/helpers/ying-qi';
import {
  hasTianPanStar,
  hasTianPanStem,
} from '../packages/core/src/divination/algorithms/qimen/helpers/palace-utils';
import {
  analyzeLiuyaoEvidence,
  conditionLiuyaoTraditionalText,
  generateLiuyao,
} from 'mingyu-core/divination/liuyao';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { analyzeSsgwEvidence, drawRandomSign } from 'mingyu-core/divination/ssgw';
import { SSGW_INTERPRETATION_FIELDS, SSGW_SIGNS } from '../packages/core/src/divination/ssgw-data';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import {
  analyzeQimenEvidence,
  conditionQimenTraditionalText,
  generateQimen,
  resolveZhiShiLandingPalace,
} from 'mingyu-core/divination/qimen';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

type DivinationDraftInput = Parameters<typeof generateDivinationSession>[0];

test('三山国王九十二签应逐签具备八类完整解读', () => {
  assert.equal(SSGW_SIGNS.length, 92);
  assert.deepEqual(
    SSGW_SIGNS.map((sign) => sign.id),
    Array.from({ length: 92 }, (_, index) => index + 1),
  );
  SSGW_SIGNS.forEach((sign) => {
    SSGW_INTERPRETATION_FIELDS.forEach((field) => {
      assert.ok(sign.details[field]?.trim(), `第${sign.id}签缺少${field}`);
    });
    assert.match(sign.details.核心寓意, /[\u4e00-\u9fff]/, `第${sign.id}签核心寓意无效`);
  });

  SSGW_INTERPRETATION_FIELDS.forEach((field) => {
    const values = SSGW_SIGNS.map((sign) => sign.details[field].trim());
    assert.equal(new Set(values).size, 92, `${field}存在重复套话，应按每支签诗单独编写`);
  });
});

test('三山国王九十二签进入证据提示词时不应保留绝对结果保证', () => {
  const forbidden = /必然(?:会|是|失败|走向|两败俱伤)|必定成功|必能|必败|必然后悔/;

  SSGW_SIGNS.forEach((sign) => {
    const analysis = analyzeSsgwEvidence({
      number: sign.id,
      title: sign.title,
      poem: sign.qianwen,
      story: sign.story,
      details: sign.details,
      timestamp: Date.now(),
      ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
    });
    assert.doesNotMatch(analysis.promptText, forbidden, `第${sign.id}签提示词仍含绝对结果保证`);
    assert.ok(analysis.interpretations.every((item) => !forbidden.test(item.promptText)));
  });
});

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
    liuyaoTemplate: 'general',
    liurenTemplate: 'general',
    tarotSpread: 'single',
    almanacTopic: 'custom',
    almanacStartDate: '2026-06-01',
    almanacEndDate: '2026-06-05',
    almanacParticipants: [],
    lenormandSpread: 'single',
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
    taiyiYear: '2004',
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

test('灵感问题只填问题，不自动改用户选择的牌阵', () => {
  const tarotQuestion = TAROT_SPREAD_INSPIRATION_QUESTIONS.love?.[0] ?? '我和TA的感情会如何发展？';
  const tarotPatch = resolveDivinationInspiredDraftPatch(
    buildDraft({ method: 'tarot', tarotSpread: 'single' }),
    tarotQuestion,
  );
  assert.equal(tarotPatch.question, tarotQuestion);
  assert.equal(tarotPatch.tarotSpread, 'single');
});

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

let qimenStemPairSamples:
  Map<string, { data: ReturnType<typeof generateQimen>; gong: number }> | undefined;

function findQimenStemPairSample(heaven: string, earth: string) {
  if (!qimenStemPairSamples) {
    qimenStemPairSamples = new Map();
    for (
      let cursor = new Date('2024-01-01T00:00:00+08:00');
      cursor < new Date('2024-01-10T00:00:00+08:00');
      cursor = new Date(cursor.getTime() + 2 * 60 * 60 * 1000)
    ) {
      const data = generateQimen(cursor);
      for (const palace of data.jiuGongGe) {
        for (const stem of [palace.tianPan.stem, palace.tianPan.companionStem].filter(Boolean)) {
          const key = `${stem}:${palace.diPan.stem}`;
          if (!qimenStemPairSamples.has(key)) {
            qimenStemPairSamples.set(key, { data, gong: palace.gong });
          }
        }
      }
    }
  }

  const sample = qimenStemPairSamples.get(`${heaven}:${earth}`);
  assert.ok(sample, `固定时间窗内未找到天盘${heaven}加地盘${earth}的真实转盘样本`);
  assert.ok(
    sample.data.jiuGongGe.some(
      (palace) =>
        palace.gong === sample.gong &&
        hasTianPanStem(palace, heaven) &&
        palace.diPan.stem === earth,
    ),
  );
  return sample;
}

function buildClassicPattern(overrides: Partial<ClassicPattern>): ClassicPattern {
  return {
    key: 'test-pattern',
    name: '测试格局',
    tone: 'neutral',
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

test('六爻页面资料与摘要应显示飞伏关系并兼容旧结果', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [8, 7, 7, 7, 7, 7],
  });
  const info = formatDivinationInfo('liuyao', data, '');
  const summary = getDivinationSummaryBlocks('liuyao', data);

  assert.match(info, /妻财伏第2爻.*伏于子孙辛亥水下（飞来生伏）/);
  assert.ok(summary.lines.some((line) => /妻财伏第2爻.*（飞来生伏）/.test(line)));

  const legacyData = {
    ...data,
    hiddenSpirits: data.hiddenSpirits?.map((item) => {
      const legacyItem = { ...item };
      delete legacyItem.conditionAnalysis;
      return legacyItem;
    }),
  };
  const legacyInfo = formatDivinationInfo('liuyao', legacyData, '');
  const legacySummary = getDivinationSummaryBlocks('liuyao', legacyData);

  assert.match(legacyInfo, /妻财伏第2爻.*（飞来生伏）/);
  assert.ok(legacySummary.lines.some((line) => /妻财伏第2爻.*（飞来生伏）/.test(line)));
  assert.doesNotMatch(legacyInfo, /undefined/);
  assert.ok(legacySummary.lines.every((line) => !line.includes('undefined')));
});

test('六爻证据应把六亲类象与现实结论分离', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'));
  const analysis = analyzeLiuyaoEvidence(data);
  const symbolItem = analysis.evidence.items.find(
    (item) => item.title === '六亲传统类象映射（非事实结论）',
  );

  assert.ok(analysis.traditionalSymbols.length > 0);
  assert.equal(analysis.lineFacts.length, 6);
  assert.equal(analysis.hiddenSpiritFacts.length, data.hiddenSpirits?.length ?? 0);
  assert.ok(
    analysis.lineFacts.every(
      (item) => item.sources.length > 0 && item.limitation.includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(
    analysis.traditionalSymbols.every(
      (item) =>
        item.originalText &&
        item.promptText &&
        item.source === '传统六亲类象表与当前六亲排布' &&
        item.limitation.includes('不证明现实身份'),
    ),
  );
  assert.equal(symbolItem?.level, '辅证');
  assert.match(symbolItem?.detail || '', /须先结合问题主题/);
  assert.match(symbolItem?.detail || '', /不证明现实身份、疾病、官非、财运或关系结果/);
  assert.equal(
    conditionLiuyaoTraditionalText('官鬼持世，主压力、疾病与官非，事体不虚'),
    '官鬼持世，传统类象提示压力、疾病与官非，传统上可作为事项线索',
  );
});

test('六爻页面资料不应把明动爻与日辰相冲写成日破', () => {
  const data = generateLiuyao(new Date('2025-05-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [8, 7, 8, 8, 7, 6],
  });
  const text = formatDivinationInfo('liuyao', data, '');
  const legacyText = formatDivinationInfo(
    'liuyao',
    {
      ...data,
      yaosDetail: data.yaosDetail.map((item, index) =>
        index === 5 ? { ...item, isDayClash: undefined, isDayBreak: true } : item,
      ),
      evidenceAnalysis: undefined,
    },
    '',
  );

  assert.match(text, /第6爻.*（与日辰相冲）/);
  assert.doesNotMatch(text, /日破/);
  assert.match(legacyText, /第6爻.*（与日辰相冲）/);
  assert.doesNotMatch(legacyText, /日破/);
});

test('六爻页面资料与摘要应重算动静结构并忽略派生字段污染', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [9, 8, 6, 8, 7, 8],
  });
  const tampered = {
    ...data,
    activityPattern: {
      kind: '全动卦' as const,
      movingCount: 6,
      movingPositions: [1, 2, 3, 4, 5, 6],
      stillPositions: [],
      guidance: '伪造的新派生说明',
    },
    specialPattern: '乾卦用九' as const,
    specialAdvice: '伪造的旧派生说明',
    isChaotic: true,
    chaoticReason: '伪造的乱动结论',
    evidenceAnalysis: undefined,
  };
  const info = formatDivinationInfo('liuyao', tampered, '');
  const summary = getDivinationSummaryBlocks('liuyao', tampered);

  assert.match(info, /动静结构多爻发动/);
  assert.match(info, /2爻明动，只登记多爻发动事实/);
  assert.ok(summary.lines.includes('动静结构：多爻发动'));
  assert.doesNotMatch([info, ...summary.lines].join('\n'), /伪造|乾卦用九|全动卦|乱动结论/);
});

test('六爻页面资料与摘要应重算反吟伏吟并忽略派生字段污染', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [9, 7, 7, 9, 7, 7],
  });
  const tampered = {
    ...data,
    changingYaos: [],
    fanfuRelations: {
      fanyin: [],
      fuyin: [
        {
          kind: '伏吟' as const,
          scope: '内卦' as const,
          label: '伪造伏吟',
          description: '伪造的反吟伏吟说明',
        },
      ],
      labels: ['伪造伏吟'],
    },
    evidenceAnalysis: undefined,
  };
  const info = formatDivinationInfo('liuyao', tampered, '');
  const summary = getDivinationSummaryBlocks('liuyao', tampered);
  const combined = [info, ...summary.tags, ...summary.lines].join('\n');

  assert.match(info, /内外反吟（内卦乾变巽，外卦乾变巽/);
  assert.ok(summary.tags.includes('反伏：内外反吟'));
  assert.doesNotMatch(combined, /伪造伏吟|伪造的反吟伏吟说明/);
});

test('六爻页面资料应显示月卦身不入卦与同支多现，并忽略派生字段污染', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const qian = generateLiuyao(date, {
    method: 'manual',
    yaos: [7, 7, 7, 7, 7, 7],
  });
  const lin = generateLiuyao(date, {
    method: 'manual',
    yaos: [7, 7, 8, 8, 8, 8],
  });
  const tamperedQian = {
    ...qian,
    guaShen: {
      branch: '伪',
      status: '入卦' as const,
      matches: [{ position: 1, sixRelative: '伪造六亲' }],
      position: 1,
      sixRelative: '伪造六亲',
    },
    evidenceAnalysis: undefined,
  };
  const qianText = formatDivinationInfo('liuyao', tamperedQian, '');
  const linText = formatDivinationInfo('liuyao', lin, '');

  assert.match(qianText, /月卦身为巳.+不入卦/);
  assert.doesNotMatch(qianText, /月卦身为伪|伪造六亲/);
  assert.match(linText, /月卦身为丑，入卦于第3、4爻/);
});

test('六爻页面资料只输出满足边界的三刑结构，不附加强现实类象', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [9, 8, 7, 8, 8, 7],
  });
  const text = formatDivinationInfo('liuyao', data, '');

  assert.match(text, /三刑结构：/);
  assert.match(text, /子卯相刑/);
  assert.match(text, /关系涉及世爻/);
  assert.doesNotMatch(text, /传统类象为纠缠、对立或反复/);
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

  const yangNinePalaces = arrangeJiuGongGe(
    true,
    9,
    yangNine.zhiFu,
    yangNine.zhiShi,
    { hour: '丙辰' },
    'feipan',
  );
  assert.equal(yangNinePalaces.find((gong) => gong.gong === 5)?.diPan.stem, '癸');
  assert.equal(yangNinePalaces.find((gong) => gong.tianPan.star === '天禽')?.gong, 7);

  const yinEight = getZhiFuZhiShi('辛未', '甲寅', { isYangDun: false, juShu: 8 });
  assert.equal(yinEight.zhiFu, '天任');
  assert.equal(yinEight.zhiFuPalace, 8);

  const yinEightPalaces = arrangeJiuGongGe(
    false,
    8,
    yinEight.zhiFu,
    yinEight.zhiShi,
    { hour: '辛未' },
    'feipan',
  );
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

test('奇门应期快慢条件并见时应保留冲突并返回中等节奏', () => {
  const result = estimateYingQi([], 9, {
    isYangDun: true,
    zhiFuLandingPalace: 8,
    isFuyin: true,
  });

  assert.equal(result.rhythm, '中');
  assert.ok(result.sources.some((source) => source.includes('外宫迟应')));
  assert.ok(result.sources.some((source) => source.includes('值符落8宫')));
  assert.ok(result.sources.some((source) => source.includes('伏吟局')));
  assert.doesNotMatch(result.description, /事在近期|事在远日|应期较快/);
});

test('奇门应期空亡只应在用神落空时延迟', () => {
  const notVoid = generateQimen(new Date('2024-01-01T00:00:00+08:00'));
  const notVoidZhiFuPalace = notVoid.jiuGongGe.find((palace) =>
    hasTianPanStar(palace, notVoid.zhiFu),
  )?.gong;
  assert.equal(notVoid.ganzhi.hour, '甲子');
  assert.ok(!notVoid.voidPalaces?.some((item) => item.palace === notVoidZhiFuPalace));
  assert.ok(!notVoid.yingQi?.sources.some((source) => source.includes('空亡入局')));

  const voidHit = generateQimen(new Date('2024-01-01T17:00:00+08:00'));
  const voidHitZhiFuPalace = voidHit.jiuGongGe.find((palace) =>
    hasTianPanStar(palace, voidHit.zhiFu),
  )?.gong;
  assert.equal(voidHit.ganzhi.hour, '癸酉');
  assert.ok(voidHit.voidPalaces?.some((item) => item.palace === voidHitZhiFuPalace));
  assert.ok(voidHit.yingQi?.sources.some((source) => source.includes('空亡入局')));
  const hitBranches =
    voidHit.voidPalaces
      ?.filter((item) => item.palace === voidHitZhiFuPalace)
      .map((item) => item.branch) ?? [];
  assert.ok(hitBranches.length > 0);
  assert.ok(
    voidHit.yingQi?.sources.some((source) =>
      hitBranches.every((branch) => source.includes(branch)),
    ),
  );
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

test('奇门应期只输出相对节奏与触发条件，不机械换算天数或百分比', () => {
  const data = generateQimen(new Date('2025-01-01T06:00:00+08:00'));
  const yingQi = data.yingQi;

  assert.ok(yingQi);
  assert.equal(yingQi.minDays, undefined);
  assert.equal(yingQi.maxDays, undefined);
  assert.ok(yingQi.triggerConditions.length > 0);
  assert.ok(yingQi.limitations.some((item) => item.includes('不对应固定日数')));
  assert.doesNotMatch(
    [yingQi.description, ...yingQi.sources].join('\n'),
    /应期约\s*\d|加快约\s*\d+%|延迟约\s*\d+%|基线\s*\d/,
  );
});

test('奇门应期按格局类别列出支持与限制，不读取内部评分强弱', () => {
  const yingQi = estimateYingQi([], 5, {
    classicPatterns: [
      { name: '青龙返首', tone: 'good' },
      { name: '白虎猖狂', tone: 'bad' },
      { name: '一般格局', tone: 'neutral' },
    ],
  });
  const text = yingQi.sources.join('\n');
  assert.match(text, /支持与限制并见/);
  assert.match(text, /支持格局：青龙返首/);
  assert.match(text, /限制格局：白虎猖狂/);
  assert.doesNotMatch(text, /大吉格|大凶格|显著加快|显著延迟|评分|分值/);
});

test('奇门算法会输出节令背景与已校勘组合规则且不生成叠加等级', () => {
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
        combo.tone === 'mixed' &&
        combo.score === undefined &&
        Array.isArray(combo.sources),
    ),
  );
  const info = formatDivinationInfo('qimen', data, '');
  assert.match(info, /已校勘组合规则：[\s\S]*需结合原始条件/);
  assert.doesNotMatch(info, /已校勘组合规则：[^\n]*支持与限制并见/);
});

test('奇门定局、值符值使、宫间作用与触发条件应进入统一证据条目', () => {
  const data = generateQimen(new Date('2025-01-01T08:00:00+08:00'));
  const analysis = data.evidenceAnalysis;
  const items = analysis?.evidence.items ?? [];

  assert.ok(analysis);
  assert.equal(analysis.palaceCoverageFact.status, '完整');
  assert.deepEqual(analysis.palaceCoverageFact.actualGongs, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(analysis.palaceCoverageFact.missingGongs, []);
  assert.equal(analysis.palaceFacts.length, data.jiuGongGe.length);
  assert.ok(
    analysis.palaceFacts.every(
      (item) =>
        item.status === '已计算' &&
        item.sources.length > 0 &&
        item.patternFactKeys.every((key) =>
          analysis.patternFacts.some((fact) => fact.key === key),
        ) &&
        item.stemRelationFacts.every(
          (fact) =>
            fact.ownerPalaceFactKey === item.key &&
            fact.status === '已计算' &&
            fact.sources.length > 0 &&
            fact.limitation.includes('不单独证明现实吉凶'),
        ) &&
        item.insights.every(
          (fact) =>
            fact.ownerPalaceFactKey === item.key &&
            fact.status === '已命中' &&
            fact.originalText &&
            fact.promptText &&
            fact.sources.length > 0,
        ) &&
        item.limitation.includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(analysis.calculationFacts.some((item) => /阴遁|阳遁/.test(item)));
  assert.ok(analysis.calculationFacts.some((item) => item.includes(`${data.juShu}局`)));
  assert.ok(analysis.calculationFacts.some((item) => item.includes(data.timeInfo.solarTerm)));
  assert.ok(analysis.calculationFacts.some((item) => item.includes(data.timeInfo.epoch)));
  assert.ok(analysis.ruleSources.some((item) => item.includes('旬首值符值使规则')));
  assert.equal(analysis.calculationEvidenceFacts.length, 5);
  assert.deepEqual(
    analysis.calculationEvidenceFacts.map((item) => item.stage),
    ['排盘范围', '定局', '值符定位', '值使定位', '四柱背景'],
  );
  assert.ok(
    analysis.calculationEvidenceFacts.every(
      (item) =>
        item.key.startsWith('qimen:calculation:') &&
        item.status === '已确定' &&
        item.promptText &&
        item.sourceKeys.length > 0 &&
        item.limitation.includes('不证明现实吉凶'),
    ),
  );
  assert.equal(analysis.ruleSourceFacts.length, 6);
  assert.ok(
    analysis.ruleSourceFacts.some(
      (item) =>
        item.key === 'rule:qimen:retained-combo-versions' &&
        item.promptText.includes('五态月令版') &&
        item.promptText.includes('不混用《奇门宝鉴御定》') &&
        item.promptText.includes('十干迫制'),
    ),
  );
  assert.ok(
    analysis.ruleSourceFacts.some(
      (item) =>
        item.key === 'rule:qimen:special-context-boundary' &&
        item.promptText.includes('三岔迷路') &&
        item.promptText.includes('刑德开阖主客版本相反'),
    ),
  );
  assert.ok(
    analysis.ruleSourceFacts.every(
      (item) =>
        item.key.startsWith('rule:qimen:') &&
        item.status === '已声明' &&
        item.rule &&
        item.appliesTo.length > 0 &&
        item.sources.length > 0 &&
        item.promptText &&
        item.limitation.includes('不等于现代实证验证'),
    ),
  );
  assert.ok(
    analysis.calculationEvidenceFacts.every((item) =>
      item.sourceKeys.every((key) => analysis.ruleSourceFacts.some((source) => source.key === key)),
    ),
  );
  assert.equal(
    analysis.patternFacts.length,
    (data.patternDetails?.length ?? 0) +
      (data.classicPatterns?.length ?? 0) +
      (data.patternCombos?.length ?? 0),
  );
  assert.ok(
    analysis.patternFacts.every(
      (item) =>
        item.status === '已命中' &&
        item.originalText &&
        item.promptText &&
        item.limitation.includes('不是现实结果'),
    ),
  );
  assert.equal(analysis.relations.length, Math.max(0, analysis.candidates.length - 1));
  assert.ok(
    analysis.relations.every(
      (item) =>
        item.key.startsWith('qimen:relation:') &&
        analysis.palaceFacts.some((fact) => fact.key === item.fromPalaceFactKey) &&
        analysis.palaceFacts.some((fact) => fact.key === item.toPalaceFactKey) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实中的支持'),
    ),
  );
  assert.equal(analysis.counterSummaryFact.factKeys.length, analysis.counterEvidenceFacts.length);
  assert.ok(
    analysis.counterEvidenceFacts.every(
      (item) =>
        item.key.startsWith('qimen:counter:') &&
        item.status === '已触发' &&
        analysis.palaceFacts.some((fact) => fact.key === item.ownerPalaceFactKey) &&
        item.sources.length > 0 &&
        item.limitation.includes('不得把单项限制直接写成现实失败'),
    ),
  );
  assert.ok(analysis.timingFacts.length > 0);
  assert.ok(
    analysis.timingFacts.every(
      (item) =>
        item.key.startsWith('qimen:timing:') &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不得换算唯一日期'),
    ),
  );
  assert.equal(analysis.timingSummaryFact.factKeys.length, analysis.timingFacts.length);
  assert.ok(analysis.directionFacts.length > 0);
  assert.ok(
    analysis.directionFacts.every(
      (item) =>
        item.key.startsWith('qimen:direction:') &&
        analysis.palaceFacts.some((fact) => fact.key === item.palaceFactKey) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('必须核实现实路线'),
    ),
  );
  assert.equal(
    analysis.directionSummaryFact.candidateFactKeys.length,
    Math.min(4, analysis.candidates.length),
  );

  const setupItem = items.find((item) => item.title === '定局计算事实');
  assert.equal(setupItem?.level, '辅证');
  assert.match(setupItem?.detail ?? '', /时家奇门.*(阴遁|阳遁)\d局/s);

  const leadersItem = items.find((item) => item.title === '值符值使定位事实');
  assert.equal(leadersItem?.level, '主证');
  assert.match(leadersItem?.detail ?? '', new RegExp(`${data.zhiFu}落`));
  assert.match(leadersItem?.detail ?? '', new RegExp(`${data.zhiShi}落`));

  assert.ok(items.some((item) => item.tags?.includes('宫间关系')));
  assert.ok(items.some((item) => item.level === '应期' && item.title.includes('触发')));
  assert.ok(items.some((item) => item.level === '辅证' && item.title.includes('方位')));
  assert.ok(items.some((item) => item.title === '节令与四柱背景事实'));
  assert.ok(
    (data.patternCombos?.length ?? 0) === 0 ||
      items.some(
        (item) => item.tags?.includes('已校勘组合规则') && item.detail?.includes('组成来源'),
      ),
  );
  assert.doesNotMatch(
    JSON.stringify(analysis.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
  assert.doesNotMatch(
    analysis.promptText,
    /项目以|项目规则|项目计算|命语|本项目|项目统一|工程|算法结果/,
  );
  assertPromptIsPortableTaskText(analysis.promptText);

  const incomplete = analyzeQimenEvidence({
    ...data,
    jiuGongGe: data.jiuGongGe.filter((item) => item.gong !== 5),
    evidenceAnalysis: undefined,
  });
  assert.equal(incomplete.palaceCoverageFact.status, '缺少宫位');
  assert.equal(incomplete.summaryFact.status, '部分资料缺失');
  assert.equal(incomplete.summaryFact.palaceFactCount, 8);
  assert.deepEqual(incomplete.palaceCoverageFact.missingGongs, [5]);
  assert.match(incomplete.palaceCoverageFact.promptText, /不得补造缺失宫位内容/);
});

test('奇门传统格局应保留原文并为提示词生成条件化副本', () => {
  const original = '乙加地盘癸为日入天网，主官事破财，万事破伤；凶期百日而后或有舒情。';
  const conditioned = conditionQimenTraditionalText(original);

  assert.match(original, /主官事破财|万事破伤|凶期百日/);
  assert.match(conditioned, /传统象意提示官事破财/);
  assert.match(conditioned, /传统象意提示多重阻碍/);
  assert.match(conditioned, /不得据此输出固定日期/);
  assert.doesNotMatch(conditioned, /万事破伤|凶期百日|本项目|当前项目|工程|算法结果/);

  for (const heavenStem of '甲乙丙丁戊己庚辛壬癸') {
    for (const earthStem of '甲乙丙丁戊己庚辛壬癸') {
      const pattern = getStemPairPattern(heavenStem, earthStem);
      if (!pattern) continue;
      const promptText = conditionQimenTraditionalText(pattern.summary);
      assert.doesNotMatch(
        promptText,
        /百事(?:吉昌|称心|顺遂|可为)|万事(?:破伤|皆屯)|凶期百日|(^|[，；。])主(?!(?:动|客|轴|证|判|要))|大吉|大凶/,
        `${heavenStem}加${earthStem}的条件化文本仍含绝对传统断语`,
      );
    }
  }
});

test('奇门复合格局不得把基础事实二次拼成无独立依据的新格名', () => {
  const specs: Array<[string, 'good' | 'bad', number]> = [
    ['乙奇升殿', 'good', 2],
    ['丙奇升殿', 'good', 2],
    ['丁奇升殿', 'good', 2],
    ['日奇入墓', 'bad', 3],
    ['月奇入墓', 'bad', 3],
    ['月奇悖师', 'bad', 3],
    ['星奇入墓', 'bad', 3],
    ['天遁', 'good', 1],
    ['青龙返首', 'good', 1],
    ['白虎猖狂', 'bad', 2],
    ['太白入荧', 'bad', 5],
    ['荧入太白', 'bad', 5],
    ['丁壬化木', 'good', 4],
    ['玉女守门', 'good', 6],
    ['人遁', 'good', 6],
    ['日奇得使', 'good', 1],
  ];
  const classicPatterns = specs.map(([name, tone, palace], index) =>
    buildClassicPattern({ key: `pattern:legacy-combo:${index}`, name, tone, palace }),
  );
  const legacyContext = {
    classicPatterns,
    patternTags: ['门迫（坤二宫伤门）', '星伏吟', '门反吟'],
    voidPalaces: [{ branch: '子', palace: 1, name: '坎一宫' }],
    horseStar: { branch: '寅', palace: 8, name: '艮八宫' },
    jiuGongGe: [
      buildQimenPalace(1, '乙', {
        renPan: { door: '开门' },
        shenPan: { god: '六合' },
      }),
      buildQimenPalace(2, '辛', {
        renPan: { door: '伤门' },
        shenPan: { god: '白虎' },
      }),
      buildQimenPalace(3, '丙'),
      buildQimenPalace(4, '丁', { renPan: { door: '生门' } }),
      buildQimenPalace(5, '庚'),
      buildQimenPalace(6, '己'),
    ],
  };

  const combos = detectQimenPatternCombos(legacyContext);
  const serialized = JSON.stringify(combos);
  const forbiddenNames = [
    '吉凶混杂',
    '吉格逢空',
    '三奇齐升',
    '三奇齐困',
    '遁格返首叠加',
    '白虎助凶',
    '月奇双困',
    '主客互攻',
    '丁壬逢伤杜',
    '丁壬生门利遁',
    '阴德相扶',
    '伏吟带凶',
    '反吟翻覆',
    '迫上加凶',
    '吉门三奇',
    '静中藏动',
    '动荡翻滚',
  ];
  const forbiddenKeys = [
    'combo:mixed:',
    'combo:goodVoid:',
    'combo:sanQiAllGood',
    'combo:sanQiAllBad',
    'combo:dunPlusReturning',
    'combo:baihuPlusKill',
    'combo:bingDoubleBad',
    'combo:bingGengDual',
    'combo:dingRenBlocked:',
    'combo:dingRenShengMen:',
    'combo:yunvPlusYinDe',
    'combo:fuyinPlusBad',
    'combo:fanyinPlusBad',
    'combo:menpoPlusBad',
    'combo:luckPlusQi',
    'combo:fuyinPlusHorse',
    'combo:fanyinPlusHorse',
  ];

  forbiddenNames.forEach((name) => assert.doesNotMatch(serialized, new RegExp(name)));
  forbiddenKeys.forEach((key) => assert.ok(!combos.some((combo) => combo.key.startsWith(key))));
  assert.deepEqual(
    classicPatterns.map((pattern) => pattern.name),
    specs.map(([name]) => name),
  );
  assert.ok(combos.every((combo) => !('score' in combo) && !('weight' in combo)));
});

test('奇门复合格局不应按同宫吉凶格数量创造三吉三凶名称', () => {
  const buildPatterns = (tone: 'good' | 'bad') =>
    ['甲格', '乙格', '丙格'].map((name, index) =>
      buildClassicPattern({
        key: `pattern:${tone}:${index}`,
        name,
        tone,
        palace: 2,
      }),
    );

  for (const classicPatterns of [buildPatterns('good'), buildPatterns('bad')]) {
    const legacyContext = {
      classicPatterns,
      jiuGongGe: [buildQimenPalace(2, '辛')],
    };
    const combos = detectQimenPatternCombos(legacyContext);
    assert.ok(!combos.some((combo) => /三吉聚气|三凶集结/.test(combo.name)));
  }
});

test('奇门通用盘即使注入旧条件也不得恢复兵事迷路下营等专项推断', () => {
  const legacyContext = {
    classicPatterns: [
      buildClassicPattern({ key: 'legacy:baihu', name: '白虎猖狂', tone: 'bad', palace: 1 }),
      buildClassicPattern({ key: 'legacy:qinglong', name: '青龙返首', tone: 'good', palace: 2 }),
      buildClassicPattern({ key: 'legacy:flyingBird', name: '飞鸟跌穴', tone: 'good', palace: 3 }),
      buildClassicPattern({ key: 'legacy:zhuque', name: '朱雀投江', tone: 'bad', palace: 4 }),
      buildClassicPattern({ key: 'legacy:tengshe', name: '螣蛇跃蹻', tone: 'bad', palace: 6 }),
    ],
    activeGanZhi: '甲子',
    zhiFu: '天蓬',
    zhiShi: '生门',
    dayGanZhi: '丙寅',
    yearBranch: '寅',
    dayStem: '甲',
    dayBranch: '申',
    monthBranch: '寅',
    monthGeneral: '亥',
    solarTerm: '立春',
    epoch: '上元',
    hourGanZhi: '甲子',
    hourStem: '甲',
    hourBranch: '卯',
    jiuGongGe: [
      buildQimenPalace(1, '戊', {
        tianPan: { stem: '戊', star: '天蓬' },
        renPan: { door: '开门' },
        shenPan: { god: '值符' },
      }),
      buildQimenPalace(2, '己', {
        tianPan: { stem: '己', star: '天任' },
        renPan: { door: '生门' },
        shenPan: { god: '九天' },
      }),
      buildQimenPalace(3, '庚', {
        tianPan: { stem: '庚', star: '天冲' },
        renPan: { door: '惊门' },
        shenPan: { god: '九地' },
      }),
      buildQimenPalace(4, '辛', {
        tianPan: { stem: '辛', star: '天辅' },
        renPan: { door: '休门' },
        shenPan: { god: '太阴' },
      }),
      buildQimenPalace(6, '壬', {
        tianPan: { stem: '壬', star: '天心' },
        renPan: { door: '杜门' },
        shenPan: { god: '六合' },
      }),
      buildQimenPalace(7, '癸', { tianPan: { stem: '癸', star: '天柱' } }),
      buildQimenPalace(8, '乙', { tianPan: { stem: '乙', star: '天芮' } }),
      buildQimenPalace(9, '丙', { tianPan: { stem: '丙', star: '天英' } }),
    ],
  };
  const combos = detectQimenPatternCombos(legacyContext);
  const names = new Set(combos.map((combo) => combo.name));
  const forbiddenNames = [
    '白虎会开惊',
    '白虎逢休门',
    '青龙返首利主',
    '飞鸟跌穴利客',
    '飞鸟会生门',
    '朱雀投江利主',
    '螣蛇跃蹻宜守',
    '螣蛇迁戊己',
    '刑德开阖',
    '值符开通闭塞',
    '三胜地',
    '天乙击冲',
    '五不击',
    '趋三',
    '避五',
    '八将会门',
    '游都鲁都',
    '天目地耳',
    '孤虚',
    '天马方',
    '天罡时',
    '迷路法',
    '天三门地四户',
    '天门地户太阴青龙',
    '下营法',
    '五阳五阴主客',
    '旬中地丙日',
    '大将军方',
    '太岁方',
    '月建方',
    '太阴方',
    '四神用方',
    '河魁方',
    '五将方',
    '时中将星',
    '雄雌方',
    '日干攻方避忌',
    '星宫主客',
    '门宫主客',
    '星门主客互伤',
  ];

  forbiddenNames.forEach((name) => assert.ok(!names.has(name), `不得恢复专项规则：${name}`));
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
  assert.match(doorSeasonQi?.summary || '', /《奇门遁甲统宗》卷十二/);
  assert.match(doorSeasonQi?.summary || '', /五态月令版/);
  assert.match(doorSeasonQi?.summary || '', /不混用《奇门宝鉴御定》.*八态版/);
  assert.ok(doorSeasonQi?.sources.some((source) => source.includes('五态月令版')));

  const noMonthBranch = detectQimenPatternCombos({
    jiuGongGe: [buildQimenPalace(1, '壬', { renPan: { door: '休门' } })],
  });
  assert.ok(!noMonthBranch.some((combo) => combo.name === '八门余气'));
});

test('奇门通用盘不得在缺少射覆专项情境时输出物象克应', () => {
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
  assert.ok(!combos.some((combo) => combo.name === '射覆物象克应'));
  assert.ok(!combos.some((combo) => /物形|颜色|材质/.test(combo.summary)));
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
  assert.match(stemPressure?.summary || '', /《奇门遁甲统宗》卷十二/);
  assert.match(stemPressure?.summary || '', /只作奇仪落宫受克的结构事实/);
  assert.ok(stemPressure?.sources.some((source) => source.includes('十干迫制固定表')));

  const noPressure = detectQimenPatternCombos({
    jiuGongGe: [buildQimenPalace(5, '壬'), buildQimenPalace(6, '丙')],
  });
  assert.ok(!noPressure.some((combo) => combo.name === '十干迫制'));
});

test('公共月将按实际中气切换且奇门通用盘不再消费专项月将规则', () => {
  const beforeYushui = getMonthGeneralByZhongqi({
    year: 2026,
    month: 2,
    day: 10,
    hour: 12,
  });
  const afterYushui = getMonthGeneralByZhongqi({
    year: 2026,
    month: 2,
    day: 20,
    hour: 12,
  });
  assert.deepEqual(beforeYushui, { activeZhongqi: '大寒', monthGeneral: '子' });
  assert.deepEqual(afterYushui, { activeZhongqi: '雨水', monthGeneral: '亥' });

  for (const date of [
    new Date('2026-02-10T12:00:00+08:00'),
    new Date('2026-02-20T12:00:00+08:00'),
  ]) {
    const names = new Set(generateQimen(date).patternCombos?.map((combo) => combo.name));
    assert.ok(!names.has('天马方'));
    assert.ok(!names.has('天罡时'));
    assert.ok(!names.has('迷路法'));
    assert.ok(!names.has('天三门地四户'));
  }
});

test('奇门地私门在贵人阴阳取法原文矛盾未闭合时应失败关闭', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));
  const legacyContext = {
    dayGanZhi: '丁亥',
    monthBranch: '寅',
    monthGeneral: '亥',
    hourBranch: '辰',
    jiuGongGe,
  };
  const combos = detectQimenPatternCombos(legacyContext);
  assert.ok(!combos.some((combo) => combo.name === '地私门'));
  assert.ok(!combos.some((combo) => /阳贵|阴贵/.test(combo.summary)));
});

test('奇门亭亭白奸在白奸异表与适用条件未闭合时应失败关闭', () => {
  const jiuGongGe = [1, 2, 3, 4, 6, 7, 8, 9].map((gong) => buildQimenPalace(gong, '戊'));
  const legacyContext = {
    monthGeneral: '亥',
    hourBranch: '午',
    jiuGongGe,
  };
  const combos = detectQimenPatternCombos(legacyContext);
  assert.ok(!combos.some((combo) => combo.name === '亭亭白奸'));
  assert.ok(!combos.some((combo) => /白奸功曹|白奸胜光|白奸天罡/.test(combo.summary)));
});

test('奇门默认使用转盘法，飞盘法九星完整且可区分', () => {
  const date = new Date('2025-01-01T08:00:00+08:00');
  const defaultData = generateQimen(date);
  const zhuanpanData = generateQimen(date, 'zhuanpan');
  const feipanData = generateQimen(date, 'feipan');

  assert.equal(defaultData.method, 'zhuanpan');
  assert.equal(zhuanpanData.method, 'zhuanpan');
  assert.equal(feipanData.method, 'feipan');
  assert.ok(
    zhuanpanData.evidenceAnalysis?.ruleSourceFacts.some((item) =>
      item.promptText.includes('转盘法九宫规则'),
    ),
  );
  assert.ok(
    feipanData.evidenceAnalysis?.ruleSourceFacts.some((item) =>
      item.promptText.includes('飞盘法九宫规则'),
    ),
  );
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
    { gong: 6, stem: '乙', name: '日奇受制', reason: '木入金乡' },
    { gong: 7, stem: '乙', name: '日奇受制', reason: '木入金乡' },
    { gong: 1, stem: '丙', name: '月奇受制', reason: '火入水乡' },
    { gong: 1, stem: '丁', name: '星奇受制', reason: '火入水乡' },
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
  const baiHu = findQimenStemPairSample('辛', '乙');
  const taiBai = findQimenStemPairSample('庚', '丙');

  assert.ok(
    baiHu.data.classicPatterns?.some(
      (pattern) => pattern.name === '白虎猖狂' && pattern.palaces.includes(baiHu.gong),
    ),
  );
  assert.ok(taiBai.data.classicPatterns?.some((pattern) => pattern.name === '太白入荧'));
  assert.ok(
    baiHu.data.stemRelations?.some(
      (relation) =>
        relation.gong === baiHu.gong &&
        relation.relation === '命名格局' &&
        relation.pattern?.includes('白虎猖狂'),
    ),
  );
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
        pattern.name === '伏干格' && pattern.palace === 2 && pattern.summary.includes('甲子遁戊'),
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
        pattern.name === '月格' && pattern.palace === 3 && pattern.summary.includes('甲子遁戊'),
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
        pattern.name === '时格' && pattern.palace === 4 && pattern.summary.includes('甲戌遁己'),
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
        pattern.name === '日干勃格' && pattern.palace === 3 && pattern.summary.includes('甲子遁戊'),
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
        pattern.name === '时干勃格' && pattern.palace === 4 && pattern.summary.includes('甲戌遁己'),
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
        pattern.name === '地罗遮蔽' && pattern.palace === 8 && pattern.summary.includes('甲戌遁己'),
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
  assert.ok(geBo && !('score' in geBo));
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
  assert.ok(boGe && !('score' in boGe));
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
        pattern.name === '守户' && pattern.palace === 2 && pattern.summary.includes('地盘丁奇'),
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
  const lowNet = generateQimen(new Date('2024-01-06T17:00:00+08:00'));
  assert.equal(lowNet.specialConditions?.isLiuGuiHour, true);
  assert.match(lowNet.specialConditions?.description ?? '', /天盘癸落坤二宫/);
  assert.match(lowNet.specialConditions?.description ?? '', /天网临一至三宫为低/);

  const tombNet = generateQimen(new Date('2024-01-04T05:00:00+08:00'));
  assert.match(tombNet.specialConditions?.description ?? '', /天网临巽四宫为入墓/);

  const highNet = generateQimen(new Date('2024-01-01T17:00:00+08:00'));
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

test('奇门方位应以三吉门为主证，不把有奇无门当作吉方', () => {
  const noDoorPalace = buildQimenPalace(3, '乙');
  noDoorPalace.renPan.door = '杜门';

  const goodDoorPalace = buildQimenPalace(1, '乙');
  goodDoorPalace.renPan.door = '休门';

  const directions = buildDirectionAdvice([noDoorPalace, goodDoorPalace]);
  const goodDirection = directions.goodDirections.find((item) => item.gong === 1);
  const noDoorDirection = directions.goodDirections.find((item) => item.gong === 3);

  assert.ok(goodDirection?.reasons.includes('乙奇合休门'));
  assert.ok(!(noDoorDirection?.reasons ?? []).some((reason) => reason.includes('奇')));
});

test('奇门方位应把每个有明确难门或难神的宫位列为避方', () => {
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
  assert.equal(directions.avoidDirections[1]?.gong, 3);
  assert.ok(directions.avoidDirections[0]?.reasons.includes('死门'));
  assert.ok(directions.avoidDirections[0]?.reasons.includes('白虎'));
});

test('奇门避方没有明确难门、难神或空亡时不应凭内部排序生成', () => {
  const neutralPalace = buildQimenPalace(3, '戊', {
    renPan: { door: '杜门' },
    tianPan: { star: '天冲', stem: '戊' },
    shenPan: { god: '' },
  });
  const anotherNeutralPalace = buildQimenPalace(4, '己', {
    renPan: { door: '杜门' },
    tianPan: { star: '天英', stem: '己' },
    shenPan: { god: '' },
  });

  const directions = buildDirectionAdvice([neutralPalace, anotherNeutralPalace]);

  assert.deepEqual(directions.goodDirections, []);
  assert.deepEqual(directions.avoidDirections, []);
});

test('奇门吉方的空亡、难神和凶格限制不应被其他吉项抵消', () => {
  const voidPalace = buildQimenPalace(1, '乙', {
    renPan: { door: '休门' },
    shenPan: { god: '六合' },
  });
  const difficultGodPalace = buildQimenPalace(3, '丙', {
    renPan: { door: '开门' },
    shenPan: { god: '白虎' },
  });
  const badPatternPalace = buildQimenPalace(4, '丁', {
    renPan: { door: '生门' },
    shenPan: { god: '太阴' },
  });
  const patterns = [
    buildClassicPattern({
      name: '门迫',
      tone: 'bad',
      palace: 4,
    }),
    buildClassicPattern({
      name: '测试吉格',
      tone: 'good',
      palace: 4,
    }),
  ];

  const directions = buildDirectionAdvice(
    [voidPalace, difficultGodPalace, badPatternPalace],
    ['子'],
    patterns,
  );

  assert.deepEqual(directions.goodDirections, []);
  assert.ok(
    directions.avoidDirections.some((item) => item.gong === 1 && item.reasons.includes('空亡')),
  );
  assert.ok(
    directions.avoidDirections.some((item) => item.gong === 3 && item.reasons.includes('白虎')),
  );
  assert.ok(
    directions.avoidDirections.some(
      (item) => item.gong === 4 && item.reasons.includes('凶格:门迫'),
    ),
  );
});

test('奇门五不遇时即使三奇合吉门也不输出通用吉方', () => {
  const palace = buildQimenPalace(1, '乙', {
    renPan: { door: '休门' },
    shenPan: { god: '六合' },
  });

  const directions = buildDirectionAdvice([palace], [], [], { isWuBuYuShi: true });

  assert.deepEqual(directions.goodDirections, []);
});

test('奇门重点宫位应按证据来源归集，不生成综合分数', () => {
  const attentionPalace = buildQimenPalace(1, '乙');
  const riskPalace = buildQimenPalace(2, '辛');
  const data = {
    jiuGongGe: [riskPalace, attentionPalace],
    palaceInsights: [
      { gong: 2, name: riskPalace.name, level: '风险', summary: '死门同宫' },
      { gong: 1, name: attentionPalace.name, level: '关注', summary: '值符落宫' },
    ],
    classicPatterns: [{ name: '门迫', type: 'bad', summary: '门克宫', palaces: [2] }],
  } as QimenData;

  const priorities = createQimenPriorityPalaces(data);

  assert.deepEqual(
    priorities.map((item) => item.gong),
    [1, 2],
  );
  assert.ok(priorities.every((item) => !('score' in item)));
  assert.ok(priorities[1]?.reasons.includes('凶格:门迫'));
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
  assert.ok(baoJianPattern && !('score' in baoJianPattern));
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
  const deShi = generateQimen(new Date('2024-01-01T03:00:00+08:00'));
  assert.ok(deShi.patternTags.some((tag) => tag.startsWith('三奇得使（乙奇（日奇）')));
  assert.ok(
    deShi.patternDetails
      .filter((detail) => detail.tag.startsWith('三奇得使'))
      .every((detail) => !detail.summary.includes('临值使门')),
  );
  assert.ok((deShi.classicPatterns ?? []).some((pattern) => pattern.name === '日奇得使'));
  assert.ok(deShi.patternTags.some((tag) => tag.startsWith('三奇得使（丁奇（星奇）')));
  assert.ok((deShi.classicPatterns ?? []).some((pattern) => pattern.name === '星奇得使'));

  const falsePositive = generateQimen(new Date('2024-01-01T00:00:00+08:00'));
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
  assert.ok(jiaXuTags.includes('三奇游六仪（甲戌己值符加乙奇（日奇）于离九宫，游甲午辛）'));

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

  assert.ok(!names('2024-01-01T00:00:00+08:00').includes('天遁'));

  assert.ok(names('2024-01-06T17:00:00+08:00').includes('天遁'));

  assert.ok(names('2024-01-03T05:00:00+08:00').includes('地遁'));

  assert.ok(!names('2024-01-01T00:00:00+08:00').includes('鬼遁'));

  assert.ok(names('2024-01-01T13:00:00+08:00').includes('鬼遁'));
});

test('时间型占卜算法应拒绝无效自定义时间对象', () => {
  const invalidDate = new Date(Number.NaN);

  assert.throws(() => generateLiuyao(invalidDate), /自定义时间不是有效日期/);
  assert.throws(() => generateMeihua(invalidDate), /自定义时间不是有效日期/);
  assert.throws(() => generateQimen(invalidDate), /自定义时间不是有效日期/);
  assert.throws(() => generateLiuren(invalidDate), /自定义时间不是有效日期/);
  assert.throws(() => generateXiaoliuren({ customDate: invalidDate }), /自定义时间不是有效日期/);
  assert.throws(() => drawRandomSign(invalidDate), /自定义时间不是有效日期/);
});

test('三山国王灵签应区分签诗主证、典故辅证与可重放掷筊仪式', () => {
  const confirmed = drawRandomSign(new Date('2025-01-01T00:00:00+08:00'), {
    replay: [0.1, 0.1, 0.9],
  });
  assert.equal(confirmed.ritual?.confirmed, true);
  assert.deepEqual(
    confirmed.ritual?.throws.map((item) => item.result),
    ['圣杯'],
  );
  assert.deepEqual(
    confirmed.ritual?.throws.map((item) => [item.firstFace, item.secondFace]),
    [['阳面', '阴面']],
  );
  assert.equal(confirmed.draw?.poolSize, 92);
  assert.equal(confirmed.draw?.selectedNumber, confirmed.number);
  assert.equal(confirmed.evidenceAnalysis?.key, 'ssgw:evidence');
  assert.equal(confirmed.evidenceAnalysis?.status, '已计算');
  assert.equal(confirmed.evidenceAnalysis?.calculationSteps.length, 8);
  assert.equal(
    confirmed.evidenceAnalysis?.calculationChain.length,
    confirmed.evidenceAnalysis?.calculationSteps.length,
  );
  const calculationStepKeys = new Set(
    confirmed.evidenceAnalysis?.calculationSteps.map((item) => item.key),
  );
  assert.ok(
    confirmed.evidenceAnalysis?.calculationSteps.every(
      (item) =>
        item.status === '已计算' &&
        item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)) &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明神意来源'),
    ),
  );
  assert.equal(confirmed.evidenceAnalysis?.drawFact.status, '可核验');
  assert.equal(confirmed.evidenceAnalysis?.signFact.status, '完整');
  assert.equal(confirmed.evidenceAnalysis?.signFact.number, confirmed.number);
  assert.equal(confirmed.evidenceAnalysis?.coverageFact.key, 'ssgw:interpretation-coverage');
  assert.ok(
    confirmed.evidenceAnalysis?.interpretationFacts.every(
      (item) => item.key && item.status === '已收录' && item.sources.length > 0,
    ),
  );
  assert.equal(confirmed.evidenceAnalysis?.drawFact.poolSize, 92);
  assert.match(confirmed.evidenceAnalysis?.drawFact.promptText || '', /随机索引/);
  assert.match(confirmed.evidenceAnalysis?.drawFact.limitation || '', /不证明签文有效性/);
  assert.equal(confirmed.evidenceAnalysis?.ritualFact.status, '已确认');
  assert.equal(confirmed.evidenceAnalysis?.ritualFact.throws.length, 1);
  assert.deepEqual(confirmed.evidenceAnalysis?.ritualFact.throws[0], {
    attempt: 1,
    firstFace: '阳面',
    secondFace: '阴面',
    result: '圣杯',
    promptText: '第1次阳面+阴面=圣杯',
  });
  assert.equal(confirmed.evidenceAnalysis?.ritualThrowFacts[0]?.key, 'ssgw:ritual-throw:1');
  assert.equal(confirmed.evidenceAnalysis?.ritualThrowFacts[0]?.status, '已记录');
  assert.equal(confirmed.evidenceAnalysis?.ritualThrowFacts[0]?.ritualFactKey, '仪式:掷筊确认');
  assert.ok((confirmed.evidenceAnalysis?.ritualThrowFacts[0]?.sources.length ?? 0) > 0);
  assert.match(confirmed.evidenceAnalysis?.ritualFact.limitation || '', /不证明疾病/);
  assert.equal(confirmed.evidenceAnalysis?.randomFact.status, '可重放');
  assert.equal(confirmed.evidenceAnalysis?.randomFact.mode, 'replay');
  assert.equal(confirmed.evidenceAnalysis?.randomFact.sampleCount, 3);
  assert.deepEqual(confirmed.evidenceAnalysis?.randomFact.samples, [0.1, 0.1, 0.9]);
  assert.ok(confirmed.evidenceAnalysis?.drawFacts.some((item) => item.includes('随机索引')));
  assert.match(confirmed.evidenceAnalysis?.promptText || '', /签诗原文/);
  assert.match(confirmed.evidenceAnalysis?.promptText || '', /典故/);
  assert.ok(
    confirmed.evidenceAnalysis?.interpretations.every(
      (item) => item.originalText && item.promptText && item.limitation.includes('不是事实结论'),
    ),
  );
  assert.match(confirmed.evidenceAnalysis?.promptText || '', /随机过程可以重放，不证明预测有效性/);
  assert.deepEqual(
    confirmed.evidenceAnalysis?.counterEvidenceFacts.map((item) => [item.type, item.status]),
    [
      ['签诗覆盖', '已覆盖'],
      ['典故覆盖', '已覆盖'],
      ['分类释义覆盖', '已覆盖'],
      ['抽签索引', '可核验'],
      ['仪式确认', '已确认'],
      ['随机轨迹', '可重放'],
    ],
  );
  assert.equal(confirmed.evidenceAnalysis?.counterSummaryFact.status, '未见额外反证');
  assert.equal(confirmed.evidenceAnalysis?.counterSummaryFact.factKeys.length, 0);
  assert.equal(confirmed.evidenceAnalysis?.limitationFacts.length, 6);
  assert.equal(confirmed.evidenceAnalysis?.summaryFact.key, 'ssgw:evidence-summary');
  assert.equal(confirmed.evidenceAnalysis?.summaryFact.status, '证据链完整');
  assert.equal(
    confirmed.evidenceAnalysis?.summaryFact.interpretationFactCount,
    confirmed.evidenceAnalysis?.interpretationFacts.length,
  );
  assert.equal(
    confirmed.evidenceAnalysis?.summaryFact.missingFieldFactCount,
    confirmed.evidenceAnalysis?.missingFieldFacts.length,
  );
  assert.equal(
    confirmed.evidenceAnalysis?.summaryFact.ritualThrowFactCount,
    confirmed.evidenceAnalysis?.ritualThrowFacts.length,
  );
  assert.equal(
    confirmed.evidenceAnalysis?.summaryFact.counterEvidenceCount,
    confirmed.evidenceAnalysis?.counterEvidenceFacts.length,
  );
  assert.equal(
    confirmed.evidenceAnalysis?.summaryFact.sourceFactCount,
    confirmed.evidenceAnalysis?.sourceFacts.length,
  );
  const factKeys = new Set([
    confirmed.evidenceAnalysis?.summaryFact.key,
    ...(confirmed.evidenceAnalysis?.summaryFact.factKeys ?? []),
  ]);
  assert.ok(
    confirmed.evidenceAnalysis?.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.equal(
    confirmed.evidenceAnalysis?.limitations.length,
    confirmed.evidenceAnalysis?.limitationFacts.length,
  );
  assert.doesNotMatch(
    confirmed.evidenceAnalysis?.promptText || '',
    /项目模拟|项目资料|按项目仪式规则|命语|本项目|项目统一|工程|算法结果/,
  );
  assert.match(
    confirmed.evidenceAnalysis?.promptText || '',
    /计算链：[\s\S]*证据汇总：[\s\S]*解释限制：/,
  );
  assertPromptIsPortableTaskText(confirmed.evidenceAnalysis?.promptText || '');
  assert.ok(
    confirmed.evidenceAnalysis?.sourceFacts.every(
      (item) =>
        item.key &&
        item.status === '已声明' &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation,
    ),
  );
  const confirmedItems = confirmed.evidenceAnalysis?.evidence.items ?? [];
  const confirmedRitual = confirmedItems.find((item) => item.title === '模拟求签仪式完成记录');
  const confirmedRandom = confirmedItems.find((item) => item.title === '随机过程重放记录');
  assert.equal(confirmedRitual?.level, '辅证');
  assert.notEqual(confirmedRitual?.level, '主证');
  assert.match(confirmedRitual?.detail || '', /已出现圣杯/);
  assert.equal(confirmedRandom?.level, '辅证');
  assert.match(confirmedRandom?.detail || '', /随机种子与原始样本保留在可重放记录中/);
  assert.match(confirmedRandom?.detail || '', /不表示可信度、神意或预测有效性/);

  const seeded = drawRandomSign(new Date('2025-01-01T00:00:00+08:00'), {
    seed: '灵签证据样例',
  });
  assert.ok(
    seeded.evidenceAnalysis?.randomFacts.some((item) => item.includes('随机种子：灵签证据样例')),
  );
  assert.equal(seeded.evidenceAnalysis?.randomFact.seed, '灵签证据样例');
  assert.doesNotMatch(seeded.evidenceAnalysis?.randomFact.promptText || '', /灵签证据样例/);
  assert.doesNotMatch(seeded.evidenceAnalysis?.promptText || '', /灵签证据样例/);

  const rejected = drawRandomSign(new Date('2025-01-01T00:00:00+08:00'), {
    replay: [0.1, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9],
  });
  assert.equal(rejected.ritual?.rejected, true);
  assert.deepEqual(
    rejected.ritual?.throws.map((item) => item.result),
    ['阴杯', '阴杯', '阴杯'],
  );
  assert.match(rejected.ritual?.reason || '', /拒绝起签/);
  assert.equal(rejected.evidenceAnalysis?.ritualFact.status, '未确认');
  assert.equal(rejected.evidenceAnalysis?.ritualFact.throws.length, 3);
  assert.equal(rejected.evidenceAnalysis?.summaryFact.status, '证据链有缺口');
  assert.equal(rejected.evidenceAnalysis?.calculationSteps[5]?.status, '资料不足');
  assert.equal(rejected.evidenceAnalysis?.calculationSteps[7]?.status, '资料不足');
  const rejectedRitual = rejected.evidenceAnalysis?.evidence.items.find(
    (item) => item.title === '模拟求签仪式未完成',
  );
  assert.equal(rejectedRitual?.level, '反证');
  assert.match(rejectedRitual?.detail || '', /未获圣杯/);
});

test('三山国王灵签分类释义应保留原文并对提示词绝对断语作条件化处理', () => {
  const analysis = analyzeSsgwEvidence({
    number: 1,
    title: '条件化测试',
    poem: '测试签诗原文',
    details: {
      核心寓意: '所求之事必定成功，无需多虑。',
      事业: '明知风险仍投入，结果必然失败。',
      感情: '互不相让必然两败俱伤。',
    },
    timestamp: Date.now(),
    ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
  });

  assert.match(analysis.interpretations[0].originalText, /必定成功/);
  assert.equal(analysis.interpretations[0].text, analysis.interpretations[0].originalText);
  assert.match(analysis.interpretations[0].promptText, /较有机会成功/);
  assert.match(analysis.interpretations[1].promptText, /失败风险很高/);
  assert.match(analysis.interpretations[2].promptText, /容易两败俱伤/);
  assert.doesNotMatch(analysis.promptText, /必定成功|必然失败|必然两败俱伤/);
  assert.match(analysis.promptText, /非事实结论/);
  assert.equal(analysis.coverageFact.status, '存在缺口');
  assert.deepEqual(
    analysis.missingFieldFacts.map((item) => item.field),
    ['财运', '学业', '健康', '行动建议', '风险提醒'],
  );
  assert.ok(
    analysis.missingFieldFacts.every(
      (item) => item.key && item.status === '缺失' && item.sources.length > 0,
    ),
  );
  assert.equal(analysis.counterEvidenceFacts.length, 6);
  assert.equal(analysis.counterSummaryFact.status, '存在需保留反证');
  assert.equal(analysis.counterSummaryFact.factKeys.length, 5);
  assert.equal(analysis.summaryFact.status, '证据链有缺口');
  assert.equal(analysis.calculationSteps[1]?.status, '资料不足');
  assert.equal(analysis.calculationSteps[3]?.status, '资料不足');
  assert.equal(analysis.calculationSteps[4]?.status, '资料不足');
  assert.equal(analysis.calculationSteps[5]?.status, '资料不足');
  assert.equal(analysis.calculationSteps[7]?.status, '资料不足');
  assert.equal(analysis.limitationFacts.length, 6);
  assert.equal(analysis.limitations.length, analysis.limitationFacts.length);

  const emptyPoemAnalysis = analyzeSsgwEvidence({
    number: 1,
    title: '缺失签诗测试',
    poem: '',
    story: '测试典故',
    details: Object.fromEntries(SSGW_INTERPRETATION_FIELDS.map((field) => [field, '测试释义'])),
    timestamp: Date.now(),
    ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
  });
  assert.equal(emptyPoemAnalysis.signFact.status, '签诗为空');
  assert.equal(emptyPoemAnalysis.coverageFact.status, '存在缺口');
  assert.equal(emptyPoemAnalysis.summaryFact.status, '证据链有缺口');
  assert.equal(emptyPoemAnalysis.calculationSteps[2]?.status, '资料不足');
  assert.equal(emptyPoemAnalysis.calculationSteps[7]?.status, '资料不足');
  assert.ok(emptyPoemAnalysis.counterEvidence.some((item) => item.includes('不得补造签诗')));
});

test('占卜时间格式化遇到无法转换为 Date 的时间戳时应回退当前时间', () => {
  assert.doesNotThrow(() =>
    buildTimeInfoText({
      timestamp: Number.MAX_VALUE,
    } as Parameters<typeof buildTimeInfoText>[0]),
  );
});

test('前端占卜草稿可把自定北京时间传给时间种子模拟方法', async () => {
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

test('太乙神数作为占卜方法应生成完整年计盘与时间层级提示', async () => {
  const session = await generateDivinationSession(
    buildDraft({
      method: 'taiyi',
      taiyiYear: '2004',
      question: '这一年更适合主动推进还是稳守？',
    }),
  );

  const data = session.data as TaiyiResult;
  assert.equal(session.method, 'taiyi');
  assert.equal(data.scope, 'year');
  assert.equal(data.bureau, 33);
  assert.match(session.prompt, /占法：太乙神数（年计）/);
  assert.match(session.prompt, /阳遁第33局/);
  assert.match(session.prompt, /太乙：艮（第3宫/);
  assert.match(session.prompt, /主客定算：主算24/);
  assert.doesNotMatch(session.prompt, /结构化证据|证据汇总|计算链|解释限制/);
  assert.match(session.prompt, /当前只解读已完成历法链校勘的年计字段/);
  assert.match(session.prompt, /判断年度气运、动静、攻守与时宜/);
  assert.doesNotMatch(session.prompt, /尚未计算|月计、日计或时计/);
  assert.match(
    session.prompt,
    /【当前时间】[\s\S]*【占卜信息】[\s\S]*【问题】[\s\S]*【任务】[\s\S]*【输出要求】/,
  );
});

test('太乙神数占卜入口应拒绝空年份和超出网页支持范围的年份', async () => {
  for (const value of ['', '1899', '2201']) {
    await assert.rejects(
      () => generateDivinationSession(buildDraft({ method: 'taiyi', taiyiYear: value })),
      /太乙年计年份/,
    );
  }
});

test('太乙神数占卜入口应拒绝尚未校勘的月日时计', async () => {
  for (const scope of ['month', 'day', 'hour'] as const) {
    await assert.rejects(
      () =>
        generateDivinationSession(
          buildDraft({
            method: 'taiyi',
            taiyiScope: scope,
            taiyiYear: '2026',
          }),
        ),
      /古籍历法链校勘.*只开放年计/,
    );
  }
});

test('塔罗与雷诺曼提示词应保留牌面资料且不混入工程证据话术', async () => {
  const tarotSession = await generateDivinationSession(
    buildDraft({ method: 'tarot', tarotSpread: 'three', question: '接下来应如何推进？' }),
  );
  assert.match(tarotSession.prompt, /占法：塔罗/);
  assert.match(tarotSession.prompt, /牌位顺序：/);
  assert.match(tarotSession.prompt, /牌位明细：/);
  assert.doesNotMatch(tarotSession.prompt, /结构化证据|证据汇总|计算链|解释限制/);
  assert.doesNotMatch(tarotSession.prompt, /成功率为\d|吉凶总分[：=]\d|能量分数[：=]\d/);
  const tarotData = tarotSession.data as TarotData;
  const tarotItems = tarotData.evidenceAnalysis?.evidence.items ?? [];
  assert.equal(tarotData.draw?.deckSize, 78);
  assert.equal(tarotData.draw?.order.length, 3);
  assert.deepEqual(
    tarotData.draw?.order.map((item) => [item.position, item.cardName, item.orientation]),
    tarotData.cards.map((item) => [item.position, item.name, item.reversed ? '逆位' : '正位']),
  );
  assert.ok(tarotData.evidenceAnalysis?.drawFacts.some((item) => item.includes('Fisher-Yates')));
  assert.equal(tarotData.evidenceAnalysis?.drawFact.status, '可核验');
  assert.equal(tarotData.evidenceAnalysis?.drawFact.deckSize, 78);
  assert.equal(tarotData.evidenceAnalysis?.drawFact.order.length, 3);
  assert.equal(tarotData.evidenceAnalysis?.drawFact.recordedCardCount, 3);
  assert.ok((tarotData.evidenceAnalysis?.drawFact.sources.length ?? 0) >= 2);
  assert.match(tarotData.evidenceAnalysis?.drawFact.limitation || '', /不表示牌义可信度/);
  assert.ok(tarotItems.some((item) => item.title === '洗牌、抽取顺序与正逆位事实'));
  assert.equal(tarotItems.find((item) => item.title.startsWith('牌阵结构：'))?.level, '辅证');
  assert.equal(tarotItems.find((item) => item.title === '牌位顺序推进')?.level, '辅证');
  const tarotRandom = tarotItems.find((item) => item.title === '随机过程重放记录');
  assert.equal(tarotRandom?.level, '辅证');
  assert.match(tarotRandom?.detail || '', /不表示可信度或预测有效性/);
  assert.equal(tarotData.evidenceAnalysis?.randomFact.status, '可重放');
  assert.equal(
    tarotData.evidenceAnalysis?.randomFact.sampleCount,
    tarotData.meta?.random?.samples.length,
  );
  assert.ok((tarotData.evidenceAnalysis?.randomFact.sources.length ?? 0) >= 2);
  assert.ok(tarotData.evidenceAnalysis?.randomFacts.some((item) => item.includes('随机模式')));

  const lenormandSession = await generateDivinationSession(
    buildDraft({ method: 'lenormand', lenormandSpread: 'nine', question: '事情有哪些线索？' }),
  );
  assert.match(lenormandSession.prompt, /占法：雷诺曼/);
  assert.match(lenormandSession.prompt, /牌位顺序：/);
  assert.match(lenormandSession.prompt, /牌位明细：/);
  assert.doesNotMatch(lenormandSession.prompt, /结构化证据|证据汇总|计算链|解释限制/);
  assert.doesNotMatch(lenormandSession.prompt, /成功率为\d|成功率提升至|吉凶总分[：=]\d/);
});

test('六爻提示词应写出动爻、变爻与日辰月建形成的三合局', async () => {
  const session = await generateDivinationSession(
    buildDraft({
      method: 'liuyao',
      divinationTimeMode: 'custom',
      customDivinationDate: '2025-01-01',
      customDivinationTime: '00:21',
      liuyaoMethod: 'manual',
      liuyaoYaos: [6, 6, 6, 6, 6, 6],
    }),
  );
  const data = session.data as ReturnType<typeof generateLiuyao>;

  assert.equal(data.sanheWithDay?.group, '火局');
  assert.equal(data.sanheWithMonth?.group, '水局');
  assert.match(session.prompt, /日辰午补足寅、午、戌火局/);
  assert.match(session.prompt, /月建子补足申、子、辰水局/);
  assert.match(session.prompt, /当前用神五行未定，不判原神、用神、忌神或仇神方向/);
  assert.match(session.prompt, /状态(?:成立|待填实|待冲墓|待填实并冲墓)/);
});

test('前端占卜链路应把手动六爻爻值原样传入核心算法', async () => {
  const session = await generateDivinationSession(
    buildDraft({
      method: 'liuyao',
      liuyaoMethod: 'manual',
      liuyaoYaos: [6, 7, 8, 9, 7, 8],
    }),
  );
  const data = session.data as ReturnType<typeof generateLiuyao>;

  assert.deepEqual(data.yaoArray, [6, 7, 8, 9, 7, 8]);
  assert.equal(data.generation?.method, 'manual');
  assert.deepEqual(
    data.changingYaos.map((item) => item.position),
    [1, 4],
  );
});

test('前端占卜链路应把逐爻手摇记录原样传入核心算法', async () => {
  const coinThrows = [
    { coins: [2, 2, 2], total: 6 },
    { coins: [2, 2, 3], total: 7 },
    { coins: [2, 3, 3], total: 8 },
    { coins: [3, 3, 3], total: 9 },
    { coins: [2, 2, 3], total: 7 },
    { coins: [2, 3, 3], total: 8 },
  ] as const;
  const session = await generateDivinationSession(
    buildDraft({
      method: 'liuyao',
      liuyaoMethod: 'coins',
      liuyaoCoinThrows: coinThrows.map((item) => ({
        coins: [...item.coins],
        total: item.total,
      })),
    }),
  );
  const data = session.data as ReturnType<typeof generateLiuyao>;

  assert.deepEqual(data.yaoArray, [6, 7, 8, 9, 7, 8]);
  assert.deepEqual(data.generation.coinThrows, coinThrows);
  assert.equal(data.meta.random, undefined);
});

test('前端占卜链路应使用逐张抽取样本复算塔罗和雷诺曼牌阵', async () => {
  const tarotSamples = [0, 0.75, 0.5, 0.25, 0.999, 0.75];
  const tarotSession = await generateDivinationSession(
    buildDraft({
      method: 'tarot',
      tarotSpread: 'three',
      tarotMethod: 'interactive',
      tarotInteractiveSamples: tarotSamples,
    }),
  );
  const tarot = tarotSession.data as TarotData;
  assert.equal(new Set(tarot.cards.map((card) => card.id)).size, 3);
  assert.deepEqual(tarot.meta?.random?.samples, tarotSamples);
  assert.equal(tarot.evidenceAnalysis?.randomFact.status, '可重放');

  const lenormandSamples = [0, 0.5, 0.999];
  const lenormandSession = await generateDivinationSession(
    buildDraft({
      method: 'lenormand',
      lenormandSpread: 'three',
      lenormandMethod: 'interactive',
      lenormandInteractiveSamples: lenormandSamples,
    }),
  );
  const lenormand = lenormandSession.data as LenormandData;
  assert.equal(new Set(lenormand.cards.map((card) => card.id)).size, 3);
  assert.deepEqual(lenormand.meta?.random?.samples, lenormandSamples);
  assert.equal(lenormand.evidenceAnalysis?.randomFact.status, '可重放');
});

test('前端占卜链路应支持手动塔罗、雷诺曼与灵签', async () => {
  const tarotSession = await generateDivinationSession(
    buildDraft({
      method: 'tarot',
      tarotSpread: 'three',
      tarotMethod: 'manual',
      tarotManualCards: [
        { id: 1, reversed: false },
        { id: 22, reversed: true },
        { id: 78, reversed: false },
      ],
    }),
  );
  const tarot = tarotSession.data as TarotData;
  assert.deepEqual(
    tarot.cards.map((card) => card.id),
    [1, 22, 78],
  );
  assert.equal(tarot.evidenceAnalysis?.randomFact.status, '不适用');

  const lenormandSession = await generateDivinationSession(
    buildDraft({
      method: 'lenormand',
      lenormandSpread: 'three',
      lenormandMethod: 'manual',
      lenormandManualCardIds: [1, 24, 36],
    }),
  );
  const lenormand = lenormandSession.data as LenormandData;
  assert.deepEqual(
    lenormand.cards.map((card) => card.id),
    [1, 24, 36],
  );
  assert.equal(lenormand.evidenceAnalysis?.randomFact.status, '不适用');

  const ssgwSession = await generateDivinationSession(
    buildDraft({ method: 'ssgw', ssgwMethod: 'manual', ssgwNumber: '36' }),
  );
  const ssgw = ssgwSession.data as SsgwData;
  assert.equal(ssgw.number, 36);
  assert.equal(ssgw.draw?.method, 'manual');
  assert.equal(ssgw.meta?.random, undefined);
  assert.equal(ssgw.evidenceAnalysis?.randomFact.status, '不适用');
  assert.equal(ssgw.evidenceAnalysis?.ritualFact.status, '缺少记录');
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
      almanacTopic: 'move',
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
  assert.match(session.prompt, /同组按日期先后列出，不按证据数量生成名次/);
  assert.doesNotMatch(session.prompt, /首选日期：|第\d+候选/);
  assert.match(session.prompt, /候选日期明细：/);
  assert.doesNotMatch(session.prompt, /结构化证据|证据汇总|计算链|解释限制|传统硬限制/);
  assert.match(session.prompt, /参与人八字参考：/);
  assert.match(session.prompt, /本人：男/);
  assert.ok('days' in session.data && session.data.days.length === 5);
});

test('黄历择日提示词应保留超过八天的全部候选日期', async () => {
  const session = await generateDivinationSession(
    buildDraft({
      method: 'almanac',
      almanacTopic: 'contract',
      almanacEndDate: '2026-06-10',
    }),
  );

  assert.ok('days' in session.data && session.data.days.length === 10);
  for (let day = 1; day <= 10; day += 1) {
    assert.match(session.prompt, new RegExp(`候选日期：2026-06-${String(day).padStart(2, '0')}`));
  }
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

test('占卜引擎梅花数字起卦只接受十进制正整数文本', async () => {
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
});

test('小六壬只按时间起课，并生成可复核顺数与时宫提示词', async () => {
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
  assert.match(timeSession.prompt, /顺数轨迹：月宫.*；日宫.*；时宫/);
  assert.match(timeSession.prompt, /占得宫：/);
  assert.match(timeSession.prompt, /歌诀原文：/);
  assert.match(timeSession.prompt, /计算链：/);
  assert.match(timeSession.prompt, /解释限制：/);
  assert.doesNotMatch(timeSession.prompt, /核心结构：起因|五行推进：|月令旺衰：|日干六亲：/);
});

test('小六壬底层算法应拒绝已移除的数字起课', () => {
  assert.throws(
    () => generateXiaoliuren({ method: 'number' as never }),
    /当前仅保留有明确顺数规则的时间起课/,
  );
});
