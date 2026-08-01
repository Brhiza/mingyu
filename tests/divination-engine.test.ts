import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDivinationPrompt, generateDivinationSession } from '../src/lib/divination/engine';
import { buildTimeInfoText, formatDivinationInfo } from '../src/lib/divination/engine/formatters';
import { getDivinationSummaryBlocks } from '../src/lib/divination/summary';
import { getMonthGeneralByZhongqi } from '../packages/core/src/calendar/month-general';
import {
  TAROT_SPREAD_INSPIRATION_QUESTIONS,
  resolveDivinationInspiredDraftPatch,
} from '../src/lib/divination/inspiration';
import type {
  LenormandData,
  AstrolabeData,
  QimenData,
  QimenJiuGongGe,
  SsgwData,
  TaiyiResult,
  TarotData,
} from '../packages/core/src/types/divination';
import { jiazi } from '../packages/core/src/divination/divination-data';
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
  checkSpecialHourConditions,
  getZhiFuZhiShi,
} from '../packages/core/src/divination/algorithms/qimen/helpers/jushu';
import { arrangeJiuGongGe } from '../packages/core/src/divination/algorithms/qimen/helpers/layout';
import {
  getDunJiaStem,
  hasTianPanStar,
  hasTianPanStem,
  getTianPanStems,
} from '../packages/core/src/divination/algorithms/qimen/helpers/palace-utils';
import {
  analyzeLiuyaoEvidence,
  conditionLiuyaoTraditionalText,
  generateLiuyao,
} from 'mingyu-core/divination/liuyao';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import {
  analyzeSsgwEvidence,
  conditionSsgwInterpretation,
  drawRandomSign,
  rebuildAuditedSsgwData,
  resolveSignByNumber,
} from 'mingyu-core/divination/ssgw';
import { SSGW_INTERPRETATION_FIELDS, SSGW_SIGNS } from '../packages/core/src/divination/ssgw-data';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { generateTaiyi } from 'mingyu-core/taiyi';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import {
  analyzeQimenEvidence,
  conditionQimenTraditionalText,
  generateQimen,
  resolveZhiShiLandingPalace,
} from 'mingyu-core/divination/qimen';
import { assertPromptIsPortableTaskText } from './prompt-assertions';

type DivinationDraftInput = Parameters<typeof generateDivinationSession>[0];

test('三山国王灵签在签谱来源闭合前只保留九十二个签号', () => {
  assert.equal(SSGW_SIGNS.length, 92);
  assert.deepEqual(
    SSGW_SIGNS.map((sign) => sign.id),
    Array.from({ length: 92 }, (_, index) => index + 1),
  );
  SSGW_SIGNS.forEach((sign) => {
    assert.equal(sign.title, `第${sign.id}签（签谱待校）`);
    assert.equal(sign.qianwen, '');
    assert.equal(sign.story, '');
    SSGW_INTERPRETATION_FIELDS.forEach((field) => {
      assert.equal(sign.details[field], '', `第${sign.id}签不应公开待校${field}`);
    });
  });
});

test('三山国王签谱来源未闭合时不得软化后继续输出任何旧解释', () => {
  const forbidden = /必然(?:会|是|失败|走向|两败俱伤)|必定成功|必能|必败|必然后悔/;

  ['所求之事必定成功，无需多虑。', '结果必然失败。', '此签提醒谨慎推进。'].forEach((text) => {
    assert.equal(
      conditionSsgwInterpretation(text),
      '未采用签谱解释；当前签谱来源未闭合，只保留签号与抽取轨迹',
    );
  });
  assert.equal(conditionSsgwInterpretation(''), '');

  SSGW_SIGNS.forEach((sign) => {
    const analysis = resolveSignByNumber(
      sign.id,
      new Date('2025-01-01T00:00:00+08:00'),
    ).evidenceAnalysis!;
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

test('六爻证据不得把未校六亲类象软化后继续输出', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'));
  const analysis = analyzeLiuyaoEvidence(data);
  const symbolItem = analysis.evidence.items.find((item) => item.title === '六亲计算标签与爻位');

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
        item.source === '当前本卦与伏神六亲排布' &&
        item.limitation.includes('不证明现实身份'),
    ),
  );
  assert.equal(symbolItem?.level, '辅证');
  assert.match(symbolItem?.detail || '', /未提供来源闭合的事项类象解释/);
  assert.match(symbolItem?.detail || '', /不证明现实身份、疾病、官非、财运或关系结果/);
  assert.equal(
    conditionLiuyaoTraditionalText('官鬼持世，主压力、疾病与官非，事体不虚'),
    '未采用传统解释；当前只保留可复算盘面事实',
  );
  assert.doesNotMatch(
    analysis.traditionalSymbols
      .map((item) => `${item.originalText}；${item.promptText}`)
      .join('；'),
    /文书|消息|房屋|长辈|竞争|朋友|疾病|官非|财物|伴侣|子女|医药|财源|传统常取/,
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

test('大六壬提示词与摘要应从时间戳重建完整课盘并忽略全部旧派生字段污染', () => {
  const data = generateLiuren(new Date('2025-06-18T10:30:00+08:00'));
  const cleanInfo = formatDivinationInfo('liuren', data, '');
  const cleanSummary = getDivinationSummaryBlocks('liuren', data);
  const cleanPrompt = buildDivinationPrompt('liuren', '核对课盘', data, undefined, {
    isCustomQuestion: true,
  });
  const polluted = structuredClone(data);
  Object.assign(polluted as unknown as Record<string, unknown>, {
    dayNight: '伪造昼夜',
    monthLeader: '伪',
    divinationBranch: '造',
    noblemanBranch: '伪',
    noblemanGroundBranch: '造',
    xunKong: ['伪', '造'],
    transmissionRule: '伪造必胜取传法',
    transmissionPattern: '伪造传态',
    transmissionDetail: '保证现实成功',
    earthlyPlate: ['伪'],
    dayStemResidence: '造',
    heavenlyPlate: [{ branch: '伪', under: '造', god: '伪神' }],
    fourLessons: [],
    threeTransmissions: [],
    patternTags: ['伪造大吉课体'],
    classicalRules: [
      { source: '伪造古籍', rule: '伪造规则', category: '伪造分类', summary: '必然成功' },
    ],
    lessonSummary: '伪造四课结论',
    transmissionSummary: '伪造三传结论',
    guaTi: ['伪造课体'],
    guaTiFacts: [],
    shenShaSummary: ['伪造神煞在伪'],
    shenShaFacts: [],
    tianJiangProps: { 伪神: { wuxing: '伪', yinYang: '伪', category: '必胜' } },
    focusEvidence: [],
    timingEvidence: ['伪造固定应期'],
    evidenceAnalysis: { promptText: '伪造证据' },
  });

  const rebuiltInfo = formatDivinationInfo('liuren', polluted, '');
  const rebuiltSummary = getDivinationSummaryBlocks('liuren', polluted);
  const rebuiltPrompt = buildDivinationPrompt('liuren', '核对课盘', polluted, undefined, {
    isCustomQuestion: true,
  });

  assert.equal(rebuiltInfo, cleanInfo);
  assert.deepEqual(rebuiltSummary, cleanSummary);
  assert.equal(rebuiltPrompt, cleanPrompt);
  assert.doesNotMatch(
    [rebuiltInfo, rebuiltPrompt, ...rebuiltSummary.tags, ...rebuiltSummary.lines].join('\n'),
    /伪造|必胜|保证现实成功|固定应期|伪神/,
  );
});

test('奇门算法只补出两个时旬空并关闭自动马星', () => {
  const data = generateQimen(new Date('2025-01-01T08:00:00+08:00'));

  assert.equal(data.voidBranches?.length, 2);
  assert.equal(new Set(data.voidBranches).size, 2);
  assert.ok(data.voidPalaces?.length);
  assert.ok(data.voidPalaces.every((item) => item.branch && item.palace && item.name));
  assert.equal(data.horseStar, undefined);
  assert.ok(data.patternTags?.every((tag) => !tag.includes('马星')));
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

test('奇门六十时柱全部关闭三奇与时干入墓自动标记', () => {
  for (const ganZhi of jiazi) {
    const conditions = checkSpecialHourConditions(ganZhi);
    assert.equal(conditions.isShiGanRuMu, false, `${ganZhi}不得自动判为时干入墓`);
    assert.doesNotMatch(conditions.description, /三奇.*入墓|时干入墓|十干入墓/);
  }
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

test('奇门通用排盘不自动生成应期快慢、触发事件或固定日期', () => {
  const data = generateQimen(new Date('2025-01-01T06:00:00+08:00'));
  const runtimeData = data as unknown as Record<string, unknown>;

  assert.equal(runtimeData.yingQi, undefined);
  assert.equal(data.evidenceAnalysis?.timingSummaryFact.rhythm, null);
  assert.equal(data.evidenceAnalysis?.timingSummaryFact.status, '仅有期限边界');
  assert.match(
    data.evidenceAnalysis?.timingSummaryFact.promptText ?? '',
    /待明确具体底本版本、事项角色、完整取用规则、已指定用神对象并取得目标期限/,
  );
  assert.doesNotMatch(
    data.evidenceAnalysis?.promptText ?? '',
    /内宫速应|外宫迟应|应期虽快|事在近期|事在远日|待填实.*方应/,
  );
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
  assert.match(info, /已校勘组合规则：[\s\S]*传统分类：中性，不等于现实吉凶/);
  assert.doesNotMatch(info, /已校勘组合规则：[^\n]*支持与限制并见/);
});

test('奇门定局、值符值使、宫间作用与应期前提应进入统一证据条目', () => {
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
        item.limitation.includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(analysis.calculationFacts.some((item) => /阴遁|阳遁/.test(item)));
  assert.ok(analysis.calculationFacts.some((item) => item.includes(`${data.juShu}局`)));
  assert.ok(analysis.calculationFacts.some((item) => item.includes(data.timeInfo.solarTerm)));
  assert.ok(analysis.calculationFacts.some((item) => item.includes(data.timeInfo.epoch)));
  assert.ok(analysis.ruleSources.some((item) => item.includes('旬首值符值使规则')));
  assert.equal(analysis.calculationEvidenceFacts.length, 6);
  assert.deepEqual(
    analysis.calculationEvidenceFacts.map((item) => item.stage),
    ['排盘范围', '定局', '值符定位', '值使定位', '四柱背景', '固定干支条件'],
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
  assert.ok(analysis.ruleSourceFacts.length >= 21);
  assert.equal(
    new Set(analysis.ruleSourceFacts.map((item) => item.key)).size,
    analysis.ruleSourceFacts.length,
  );
  assert.ok(
    analysis.ruleSourceFacts.some(
      (item) =>
        item.key === 'rule:qimen:classic-pattern-audit-boundary' &&
        item.promptText.includes('十一项固定格') &&
        item.promptText.includes('伏干格、飞干格、岁格') &&
        item.promptText.includes('乙奇到震三/丙奇到离九/丁奇到兑七') &&
        item.promptText.includes('真诈/重诈/休诈') &&
        item.promptText.includes('天假/严格地假/鬼假') &&
        item.promptText.includes('月干/月朔干') &&
        item.promptText.includes('不得从原始盘面自动补算'),
    ),
  );
  assert.ok(
    analysis.ruleSourceFacts.some(
      (item) =>
        item.key === 'rule:qimen:audited-wu-jia-position' &&
        item.category === '条件一致五假位置规则' &&
        item.promptText.includes('天假要求天盘乙丙丁任一、景门与九天同宫') &&
        item.promptText.includes('地假只采用天盘丁己癸任一、杜门与九地同宫的严格条件') &&
        item.promptText.includes('鬼假要求天盘丁己癸任一、死门与九地同宫') &&
        item.promptText.includes('人假、物假、神假及地假太阴/六合扩展存在版本冲突'),
    ),
  );
  assert.ok(
    analysis.ruleSourceFacts.some(
      (item) =>
        item.key === 'rule:qimen:nine-escapes-version-boundary' &&
        item.category === '九遁版本冲突边界' &&
        item.promptText.includes('天遁至少存在地盘丁与地盘戊两本') &&
        item.promptText.includes('只能引用当前宫天盘干、地盘干、门、神和宫位事实'),
    ),
  );
  assert.ok(
    analysis.ruleSourceFacts.some(
      (item) =>
        item.key === 'rule:qimen:san-qi-de-shi-version-boundary' &&
        item.category === '三奇得使版本冲突边界' &&
        item.rule.includes('三奇游六仪') &&
        item.promptText.includes('乙配甲戌/甲午') &&
        item.promptText.includes('开休生之值使门') &&
        item.promptText.includes('不得继承“百事吉”等断语'),
    ),
  );
  assert.ok(
    analysis.ruleSourceFacts.some(
      (item) =>
        item.key === 'rule:qimen:retained-combo-versions' &&
        item.promptText.includes('五态月令版') &&
        item.promptText.includes('不混用《奇门宝鉴御定》') &&
        item.promptText.includes('十干迫制') &&
        item.promptText.includes('年命宫') &&
        item.promptText.includes('双方旺衰') &&
        item.promptText.includes('不得仅凭奇仪落宫受克自动命名'),
    ),
  );
  assert.ok(
    analysis.ruleSourceFacts.some(
      (item) =>
        item.key === 'rule:qimen:direction-boundary' &&
        item.promptText.includes('不得仅凭开休生门') &&
        item.promptText.includes('条件不足时明确不下方位结论'),
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
  assert.equal(analysis.palaceRelations.length, 36);
  assert.ok(
    analysis.palaceRelations.every(
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
        item.limitation.includes('不得把单项位置限制直接写成现实失败'),
    ),
  );
  assert.ok(analysis.timingFacts.length > 0);
  assert.ok(
    analysis.timingFacts.every(
      (item) =>
        item.key.startsWith('qimen:timing:') &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不生成相对节奏'),
    ),
  );
  assert.equal(analysis.timingSummaryFact.factKeys.length, analysis.timingFacts.length);
  assert.equal(analysis.directionBoundaryFact.status, '仅保留九宫方向');
  assert.match(analysis.directionBoundaryFact.promptText, /不生成吉方、避方或候选方向/);

  const setupItem = items.find((item) => item.title === '定局计算事实');
  assert.equal(setupItem?.level, '辅证');
  assert.match(setupItem?.detail ?? '', /时家奇门.*(阴遁|阳遁)\d局/s);

  const leadersItem = items.find((item) => item.title === '值符值使定位事实');
  assert.equal(leadersItem?.level, '主证');
  assert.match(leadersItem?.detail ?? '', new RegExp(`${data.zhiFu}落`));
  assert.match(leadersItem?.detail ?? '', new RegExp(`${data.zhiShi}落`));

  assert.ok(items.some((item) => item.tags?.includes('宫间关系')));
  assert.ok(items.some((item) => item.level === '应期' && item.title.includes('推算前提')));
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

  assert.throws(
    () =>
      analyzeQimenEvidence({
        ...data,
        jiuGongGe: data.jiuGongGe.filter((item) => item.gong !== 5),
        evidenceAnalysis: undefined,
      }),
    /需要一至九宫各一项；当前8项，缺少5.*已禁止计算派生规则/,
  );
});

test('奇门证据与最终提示资料应重算派生字段并拒绝旧缓存污染', () => {
  const data = generateQimen(new Date('2025-01-01T08:00:00+08:00'));
  assert.ok(data.seasonality);
  const polluted = {
    ...data,
    patternTags: ['污染标签天遁'],
    patternDetails: [{ tag: '污染标签天遁', summary: '污染现实断语' }],
    classicPatterns: [
      {
        name: '污染经典格局',
        type: 'good',
        summary: '污染经典格局必定成功',
        palaces: [1],
      },
    ],
    patternCombos: [
      {
        key: 'polluted-combo',
        name: '污染组合',
        tone: 'super-good',
        summary: '污染组合保证获利',
        palace: 1,
        sources: ['污染来源'],
      },
    ],
    palaceInsights: [{ gong: 1, name: '坎一宫', level: '有利', summary: '污染有利评级' }],
    directions: {
      goodDirections: [
        {
          gong: 1,
          name: '坎一宫',
          direction: '污染吉方',
          use: '污染吉方行动',
          reasons: ['污染方向依据'],
        },
      ],
      avoidDirections: [],
    },
    stemRelations: [
      {
        gong: 1,
        heavenStem: '甲',
        earthStem: '乙',
        relation: '命名格局',
        pattern: '污染未审核命名格',
      },
    ],
    specialConditions: {
      isLiuJiaHour: false,
      isLiuGuiHour: true,
      isShiGanRuMu: false,
      isWuBuYuShi: false,
      description: '污染天网四张，宜静不宜动',
    },
    voidBranches: ['污染空亡'],
    voidPalaces: [{ branch: '污染空亡', palace: 1, name: '污染空亡宫' }],
    horseStar: {
      sourceBranch: '污染马星来源',
      branch: '污染马星',
      palace: 1,
      name: '污染马星宫',
    },
    seasonality: {
      ...data.seasonality,
      currentJieQi: '污染节气',
      dayOfficer: '污染建除',
      dayOfficerFortuneLabel: '吉',
      dayOfficerAdvice: '污染建除行动建议',
      seasonRelationDescription: '污染节令吉凶断语',
      ganzhiInteractions: [
        {
          type: '六合',
          pillars: ['year', 'month'],
          values: ['污染', '互动'],
          description: '污染四柱现实断语',
        },
      ],
    },
    evidenceAnalysis: { promptText: '污染伪造证据' },
    yingQi: { description: '污染固定三天应验' },
  } as unknown as QimenData;

  const cleanEvidence = analyzeQimenEvidence(data);
  const pollutedEvidence = analyzeQimenEvidence(polluted);
  const cleanInfo = formatDivinationInfo('qimen', data, '');
  const pollutedInfo = formatDivinationInfo('qimen', polluted, '');

  assert.equal(pollutedEvidence.promptText, cleanEvidence.promptText);
  assert.equal(pollutedInfo, cleanInfo);
  const serialized = JSON.stringify({ pollutedEvidence, pollutedInfo });
  [
    '污染标签天遁',
    '污染现实断语',
    '污染经典格局',
    '污染组合',
    '污染有利评级',
    '污染吉方',
    '污染未审核命名格',
    '污染天网四张',
    '污染空亡',
    '污染马星',
    '污染节气',
    '污染建除',
    '污染四柱现实断语',
    '污染伪造证据',
    '污染固定三天应验',
  ].forEach((marker) => assert.doesNotMatch(serialized, new RegExp(marker)));
});

test('奇门传统格局应保留原文并对高风险解释失败关闭', () => {
  const original = '乙加地盘癸为日入天网，主官事破财，万事破伤；凶期百日而后或有舒情。';
  const conditioned = conditionQimenTraditionalText(original);

  assert.match(original, /主官事破财|万事破伤|凶期百日/);
  assert.equal(conditioned, '未采用传统解释；当前只保留可复算盘面事实');

  const safeFact = '天盘乙加地盘癸于坎一宫；这里只记录天地盘干命中条件。';
  assert.equal(conditionQimenTraditionalText(safeFact), safeFact);

  for (const heavenStem of '甲乙丙丁戊己庚辛壬癸') {
    for (const earthStem of '甲乙丙丁戊己庚辛壬癸') {
      const pattern = getStemPairPattern(heavenStem, earthStem);
      if (!pattern) continue;
      const promptText = conditionQimenTraditionalText(pattern.summary);
      const containsHighRiskInterpretation =
        /凶期百日|百事(?:吉昌|称心|顺遂|可为|凶)|凡百遂心|万事(?:破伤|皆屯)|谋为成功|事成|必然|必定|大吉|大凶|(^|[，；。])主(?!(?:动|客|轴|证|判|要))|古法主(?!(?:动|客))/.test(
          pattern.summary,
        );
      assert.equal(
        promptText,
        containsHighRiskInterpretation
          ? '未采用传统解释；当前只保留可复算盘面事实'
          : pattern.summary,
        `${heavenStem}加${earthStem}不得通过改写继续输出高风险解释`,
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

test('八门余气应穷举八门十二月支且每组唯一落入五态之一', () => {
  const expectedStates: Record<string, Record<string, string>> = {
    休门: {
      子: '旺',
      丑: '囚',
      寅: '相',
      卯: '相',
      辰: '囚',
      巳: '休',
      午: '休',
      未: '囚',
      申: '废',
      酉: '废',
      戌: '囚',
      亥: '旺',
    },
    生门: {
      子: '休',
      丑: '旺',
      寅: '囚',
      卯: '囚',
      辰: '旺',
      巳: '废',
      午: '废',
      未: '旺',
      申: '相',
      酉: '相',
      戌: '旺',
      亥: '休',
    },
    伤门: {
      子: '废',
      丑: '休',
      寅: '旺',
      卯: '旺',
      辰: '休',
      巳: '相',
      午: '相',
      未: '休',
      申: '囚',
      酉: '囚',
      戌: '休',
      亥: '废',
    },
    杜门: {
      子: '废',
      丑: '休',
      寅: '旺',
      卯: '旺',
      辰: '休',
      巳: '相',
      午: '相',
      未: '休',
      申: '囚',
      酉: '囚',
      戌: '休',
      亥: '废',
    },
    景门: {
      子: '囚',
      丑: '相',
      寅: '废',
      卯: '废',
      辰: '相',
      巳: '旺',
      午: '旺',
      未: '相',
      申: '休',
      酉: '休',
      戌: '相',
      亥: '囚',
    },
    死门: {
      子: '休',
      丑: '旺',
      寅: '囚',
      卯: '囚',
      辰: '旺',
      巳: '废',
      午: '废',
      未: '旺',
      申: '相',
      酉: '相',
      戌: '旺',
      亥: '休',
    },
    惊门: {
      子: '相',
      丑: '废',
      寅: '休',
      卯: '休',
      辰: '废',
      巳: '囚',
      午: '囚',
      未: '废',
      申: '旺',
      酉: '旺',
      戌: '废',
      亥: '相',
    },
    开门: {
      子: '相',
      丑: '废',
      寅: '休',
      卯: '休',
      辰: '废',
      巳: '囚',
      午: '囚',
      未: '废',
      申: '旺',
      酉: '旺',
      戌: '废',
      亥: '相',
    },
  };

  for (const [door, branchStates] of Object.entries(expectedStates)) {
    for (const [monthBranch, expectedState] of Object.entries(branchStates)) {
      const combos = detectQimenPatternCombos({
        monthBranch,
        jiuGongGe: [buildQimenPalace(1, '戊', { renPan: { door } })],
      });
      const matched = combos.filter((combo) => combo.name === '八门余气');
      assert.equal(matched.length, 1, `${door}在${monthBranch}月应且只应输出一项八门余气`);
      assert.match(matched[0].summary, new RegExp(`${door}属.+为${expectedState}`));
      const states = [
        ...matched[0].summary.matchAll(new RegExp(`${door}属[^；。]+为([旺相休囚废])`, 'g')),
      ].map((item) => item[1]);
      assert.deepEqual(states, [expectedState], `${door}在${monthBranch}月只能落入一种状态`);
    }
  }
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

test('十干九宫组合在缺少年命与旺衰前提时应全部关闭自动迫制名称', () => {
  for (const stem of '甲乙丙丁戊己庚辛壬癸') {
    for (let gong = 1; gong <= 9; gong += 1) {
      const palace = buildQimenPalace(gong, stem);
      assert.deepEqual(getTianPanStems(palace), [stem], `${stem}临${gong}宫的原始天盘干应保留`);
      const combos = detectQimenPatternCombos({ jiuGongGe: [palace] });
      assert.ok(
        !combos.some((combo) => combo.name === '十干迫制'),
        `${stem}临${gong}宫不得在缺少年命与旺衰时自动命名十干迫制`,
      );
    }
  }
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
  assert.equal(year1924.juShu, 4);
  assert.equal(year1984.timeInfo.epoch, '下元');
  assert.equal(year1984.isYangDun, false);
  assert.equal(year1984.juShu, 7);
  assert.equal(year2044.timeInfo.epoch, '上元');
  assert.equal(year2044.isYangDun, false);
  assert.equal(year2044.juShu, 1);
});

test('年家奇门在年初干支未切换时应沿用匹配干支的三元周期年', () => {
  const beforeYearChange = generateQimen(new Date('2025-01-01T08:00:00+08:00'), 'zhuanpan', 'year');
  const sameGanzhiYear = generateQimen(new Date('2024-07-01T08:00:00+08:00'), 'zhuanpan', 'year');

  assert.equal(beforeYearChange.ganzhi.year, '甲辰');
  assert.equal(sameGanzhiYear.ganzhi.year, '甲辰');
  assert.equal(beforeYearChange.timeInfo.epoch, sameGanzhiYear.timeInfo.epoch);
  assert.equal(beforeYearChange.isYangDun, sameGanzhiYear.isYangDun);
  assert.equal(beforeYearChange.juShu, sameGanzhiYear.juShu);
});

test('奇门九干乘九宫全部关闭未经版本选择的入墓关系', () => {
  const stems = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];
  for (const stem of stems) {
    for (let gong = 1; gong <= 9; gong += 1) {
      const relations = getStemRelations([buildQimenPalace(gong, stem)]);
      assert.ok(
        !relations.some((relation) => relation.type === '入墓'),
        `天盘${stem}落${gong}宫不得自动标记入墓`,
      );
    }
  }
});

test('奇门未审核三奇及人假物假神假与五假冲突扩展即使条件齐全也应失败关闭', () => {
  const patterns = getClassicPatterns({
    jiuGongGe: [
      buildQimenPalace(1, '乙', {
        tianPan: { star: '天蓬', stem: '乙' },
        renPan: { door: '开门' },
        shenPan: { god: '太阴' },
      }),
      buildQimenPalace(2, '丙', { renPan: { door: '休门' }, shenPan: { god: '九地' } }),
      buildQimenPalace(3, '丁', { renPan: { door: '生门' }, shenPan: { god: '六合' } }),
      buildQimenPalace(4, '庚', { renPan: { door: '伤门' }, shenPan: { god: '玄武' } }),
      buildQimenPalace(6, '丁', { diPan: { stem: '己' }, renPan: { door: '杜门' } }),
      buildQimenPalace(7, '己', { renPan: { door: '死门' }, shenPan: { god: '九地' } }),
    ],
    zhiFu: '',
    zhiShi: '休门',
    yearGanZhi: '辛丑',
    monthGanZhi: '甲子',
    dayStem: '甲',
    dayGanZhi: '甲子',
    hourGanZhi: '甲戌',
    scope: 'hour',
  });
  const patternNames = patterns.map((pattern) => pattern.name);

  ['日奇入墓', '月奇入墓', '星奇入墓', '三奇受制', '三奇会甲', '人假', '物假', '神假'].forEach(
    (name) => assert.ok(!patternNames.includes(name), `${name}不得作为格局命中`),
  );
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

test('奇门未审核符使、飞宫伏宫、月格时格与普通勃格规则不得进入经典格局', () => {
  const contexts = [
    {
      jiuGongGe: [
        buildQimenPalace(2, '庚', { tianPan: { star: '天芮', stem: '庚' }, diPan: { stem: '丙' } }),
        buildQimenPalace(3, '丙', { diPan: { stem: '戊' } }),
        buildQimenPalace(4, '壬', { diPan: { stem: '己' } }),
        buildQimenPalace(6, '乙', { diPan: { stem: '庚' } }),
      ],
      zhiFu: '天芮',
      zhiShi: '休门',
      yearGanZhi: '辛丑',
      monthGanZhi: '甲子',
      dayStem: '甲',
      dayGanZhi: '甲子',
      hourGanZhi: '甲戌',
    },
    {
      jiuGongGe: arrangeJiuGongGe(true, 1, '天蓬', '休门', { hour: '庚午' }),
      zhiFu: '天蓬',
      zhiShi: '休门',
      dayStem: '己',
      dayGanZhi: '己巳',
      hourGanZhi: '甲子',
    },
  ];
  const serialized = JSON.stringify(contexts.flatMap((context) => getClassicPatterns(context)));

  [
    '天乙飞宫',
    '天乙伏宫',
    '月格',
    '时格',
    '勃格',
    '地罗遮蔽',
    '相佐',
    '守户',
    '玉女守门',
    '天辅时',
    '五合时',
  ].forEach((name) => assert.doesNotMatch(serialized, new RegExp(name)));
});

test('奇门六癸时只登记固定干支条件，不自动生成天网行动规则', () => {
  const lowNet = generateQimen(new Date('2024-01-06T17:00:00+08:00'));
  assert.equal(lowNet.specialConditions?.isLiuGuiHour, true);
  assert.match(lowNet.specialConditions?.description ?? '', /六癸时辰，癸为阴干之末/);

  const highNet = generateQimen(new Date('2024-01-01T17:00:00+08:00'));
  assert.equal(highNet.specialConditions?.isLiuGuiHour, true);
  assert.match(highNet.specialConditions?.description ?? '', /六癸时辰，癸为阴干之末/);
  assert.doesNotMatch(
    `${lowNet.specialConditions?.description}${highNet.specialConditions?.description}`,
    /天网|可出|不可出|隐避|宜静|不宜举事|天盘癸落/,
  );
});

test('奇门基础标签只保留可复算位置事实并关闭未审核格局旁路', () => {
  const palaces = [
    buildQimenPalace(1, '乙', { renPan: { door: '休门' }, shenPan: { god: '六合' } }),
    buildQimenPalace(2, '丙', { renPan: { door: '死门' }, shenPan: { god: '白虎' } }),
    buildQimenPalace(3, '丁', { renPan: { door: '开门' }, shenPan: { god: '太阴' } }),
  ];
  const tags = getQimenPatternTags({
    zhiFu: '天蓬',
    zhiShi: '休门',
    zhiFuLandingPalace: 1,
    zhiShiLandingPalace: 1,
    jiuGongGe: palaces,
    hourGanForFind: '戊',
  });
  const serialized = JSON.stringify(tags);

  assert.doesNotMatch(serialized, /三奇得|三奇游六仪|符使同宫|宝鉴三奇/);
  assert.ok(tags.every((tag) => /伏吟|反吟|门克宫|击刑落宫/.test(tag)));
  assert.ok(
    buildPatternDetails(tags).every((detail) => /只记录|不得|需结合具体用神/.test(detail.summary)),
  );
});

test('奇门跨年跨月跨时辰与两种排盘法只输出已审核格局事实', () => {
  const allowedClassicPatterns = new Set([
    '青龙返首',
    '飞鸟跌穴',
    '青龙逃走',
    '白虎猖狂',
    '朱雀投江',
    '螣蛇跃蹻',
    '荧入太白',
    '太白入荧',
    '大格',
    '刑格',
    '小格',
    '伏干格',
    '飞干格',
    '岁格',
    '格勃',
    '乙奇升殿',
    '丙奇升殿',
    '丁奇升殿',
    '真诈',
    '重诈',
    '休诈',
    '天假',
    '地假',
    '鬼假',
    '玉女守门',
  ]);
  const retiredPattern =
    /九遁|天遁|地遁|人遁|神遁|鬼遁|龙遁|虎遁|风遁|云遁|三奇得|三奇游六仪|三诈|真诈|重诈|休诈|人假|物假|神假|升殿|奇入墓|奇受制|三奇会甲|符使同宫|相佐|守户|天乙飞宫|天乙伏宫|月格|时格|勃格|地罗遮蔽|天辅时|五合时|玉女守门/;

  for (const method of ['zhuanpan', 'feipan'] as const) {
    for (const year of [2024, 2025, 2026, 2027]) {
      for (let month = 0; month < 12; month += 1) {
        for (const day of [1, 15]) {
          for (let hour = 0; hour < 24; hour += 2) {
            const data = generateQimen(new Date(year, month, day, hour), method);
            const names = (data.classicPatterns ?? []).map((pattern) => pattern.name);
            const dayDunStem = getDunJiaStem(data.ganzhi.day);
            const expectedDayStemPatterns = new Set<string>();
            data.jiuGongGe.forEach((palace) => {
              for (const heavenStem of new Set(getTianPanStems(palace))) {
                if (heavenStem === '庚' && palace.diPan.stem === dayDunStem) {
                  expectedDayStemPatterns.add(`伏干格:${palace.gong}`);
                }
                if (heavenStem === dayDunStem && palace.diPan.stem === '庚') {
                  expectedDayStemPatterns.add(`飞干格:${palace.gong}`);
                }
              }
            });
            const actualDayStemPatterns = new Set(
              (data.classicPatterns ?? [])
                .filter((pattern) => pattern.name === '伏干格' || pattern.name === '飞干格')
                .flatMap((pattern) => pattern.palaces.map((palace) => `${pattern.name}:${palace}`)),
            );

            assert.ok(
              names.every((name) => allowedClassicPatterns.has(name)),
              `${method} ${year}-${month + 1}-${day} ${hour}时输出未审核格局：${names.join('、')}`,
            );
            assert.deepEqual(
              actualDayStemPatterns,
              expectedDayStemPatterns,
              `${method} ${year}-${month + 1}-${day} ${hour}时伏干飞干命中不完整`,
            );
            assert.doesNotMatch(JSON.stringify(data.patternTags), retiredPattern);
            assert.ok(
              (data.patternTags ?? []).every(
                (tag) => !tag.startsWith('门生宫') && !tag.startsWith('宫生门'),
              ),
            );
            assert.equal((data as unknown as Record<string, unknown>).directions, undefined);
            assert.equal((data as unknown as Record<string, unknown>).palaceInsights, undefined);
            assert.equal((data as unknown as Record<string, unknown>).yingQi, undefined);
            assert.equal(data.evidenceAnalysis?.timingSummaryFact.rhythm, null);
          }
        }
      }
    }
  }
});

test('月家与年家奇门不外推时家上下文格、三奇升殿、三诈与三项条件一致五假位置结构', () => {
  const hourOnlyPatternNames = new Set([
    '伏干格',
    '飞干格',
    '岁格',
    '格勃',
    '乙奇升殿',
    '丙奇升殿',
    '丁奇升殿',
    '真诈',
    '重诈',
    '休诈',
    '天假',
    '地假',
    '鬼假',
  ]);
  for (const scope of ['month', 'year'] as const) {
    for (const method of ['zhuanpan', 'feipan'] as const) {
      for (let month = 0; month < 12; month += 1) {
        const data = generateQimen(new Date(2025, month, 15, 12), method, scope);
        assert.ok(
          (data.classicPatterns ?? []).every((pattern) => !hourOnlyPatternNames.has(pattern.name)),
          `${scope}/${method}/${month + 1}月不应外推时家结构`,
        );
      }
    }
  }
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

test('三山国王灵签应保留可重放签号并失败关闭待校签谱与掷筊规则', () => {
  const confirmed = drawRandomSign(new Date('2025-01-01T00:00:00+08:00'), {
    replay: [0.1, 0.1, 0.9],
  });
  assert.equal(confirmed.ritual, undefined);
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
        item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)) &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明神意来源'),
    ),
  );
  assert.equal(confirmed.evidenceAnalysis?.drawFact.status, '可核验');
  assert.equal(confirmed.evidenceAnalysis?.signFact.status, '签诗为空');
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
  assert.equal(confirmed.evidenceAnalysis?.ritualFact.status, '缺少记录');
  assert.deepEqual(confirmed.evidenceAnalysis?.ritualFact.throws, []);
  assert.deepEqual(confirmed.evidenceAnalysis?.ritualThrowFacts, []);
  assert.match(confirmed.evidenceAnalysis?.ritualFact.limitation || '', /不证明神意/);
  assert.equal(confirmed.evidenceAnalysis?.randomFact.status, '可重放');
  assert.equal(confirmed.evidenceAnalysis?.randomFact.mode, 'replay');
  assert.equal(confirmed.evidenceAnalysis?.randomFact.sampleCount, 1);
  assert.deepEqual(confirmed.evidenceAnalysis?.randomFact.samples, [0.1]);
  assert.ok(confirmed.evidenceAnalysis?.drawFacts.some((item) => item.includes('随机索引')));
  assert.match(confirmed.evidenceAnalysis?.promptText || '', /签谱状态：来源尚未闭合/);
  assert.doesNotMatch(confirmed.evidenceAnalysis?.promptText || '', /明月千山|朱买臣|大吉之兆/);
  assert.ok(
    confirmed.evidenceAnalysis?.interpretations.every(
      (item) => item.originalText && item.promptText && item.limitation.includes('不是事实结论'),
    ),
  );
  assert.match(confirmed.evidenceAnalysis?.promptText || '', /随机过程可以重放，不证明预测有效性/);
  assert.deepEqual(
    confirmed.evidenceAnalysis?.counterEvidenceFacts.map((item) => [item.type, item.status]),
    [
      ['签诗覆盖', '存在缺口'],
      ['典故覆盖', '存在缺口'],
      ['分类释义覆盖', '存在缺口'],
      ['抽签索引', '可核验'],
      ['仪式确认', '缺少记录'],
      ['随机轨迹', '可重放'],
    ],
  );
  assert.equal(confirmed.evidenceAnalysis?.counterSummaryFact.status, '存在需保留反证');
  assert.equal(confirmed.evidenceAnalysis?.counterSummaryFact.factKeys.length, 4);
  assert.equal(confirmed.evidenceAnalysis?.limitationFacts.length, 6);
  assert.equal(confirmed.evidenceAnalysis?.summaryFact.key, 'ssgw:evidence-summary');
  assert.equal(confirmed.evidenceAnalysis?.summaryFact.status, '证据链有缺口');
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
        ['已声明', '待校'].includes(item.status) &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation,
    ),
  );
  const confirmedItems = confirmed.evidenceAnalysis?.evidence.items ?? [];
  const confirmedRitual = confirmedItems.find((item) => item.title === '掷筊规则待校');
  const confirmedRandom = confirmedItems.find((item) => item.title === '随机过程重放记录');
  assert.equal(confirmedRitual?.level, '反证');
  assert.match(confirmedRitual?.detail || '', /来源未闭合.*不自动模拟/);
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

  assert.match(
    confirmed.evidenceAnalysis?.promptText || '',
    /掷筊流程、杯象判定与终止规则来源未闭合/,
  );
  assert.match(confirmed.evidenceAnalysis?.promptText || '', /不自动模拟/);
  assert.doesNotMatch(
    confirmed.evidenceAnalysis?.promptText || '',
    /第\d+次.*(?:圣杯|笑杯|阴杯)|已出现圣杯|未获圣杯|连续十二次/,
  );
});

test('三山国王九十二签应逐签失败关闭并忽略外部文本与干支污染', () => {
  const date = new Date('2025-01-01T00:00:00+08:00');
  SSGW_SIGNS.forEach((reference) => {
    const manual = resolveSignByNumber(reference.id, date);
    const rebuilt = rebuildAuditedSsgwData({
      ...manual,
      title: `污染签题${reference.id}`,
      poem: `污染签诗${reference.id}`,
      story: `污染典故${reference.id}`,
      details: { 污染字段: `污染释义${reference.id}` },
      ganzhi: { year: '甲子', month: '甲子', day: '甲子', hour: '甲子' },
      evidenceAnalysis: undefined,
    });
    assert.equal(rebuilt.title, reference.title);
    assert.equal(rebuilt.poem, reference.qianwen);
    assert.equal(rebuilt.story, reference.story);
    assert.deepEqual(rebuilt.details, reference.details);
    assert.notEqual(rebuilt.details, reference.details);
    assert.deepEqual(rebuilt.ganzhi, manual.ganzhi);
    assert.deepEqual(rebuilt.draw, {
      method: 'manual',
      poolSize: 92,
      selectedIndex: null,
      selectedNumber: reference.id,
    });
    assert.equal(rebuilt.ritual, undefined);
    assert.equal(rebuilt.meta?.random, undefined);
    assert.equal(rebuilt.evidenceAnalysis?.signFact.number, reference.id);
  });
});

test('三山国王灵签随机来源应只按首个样本重放签号并清除旧仪式污染', () => {
  const date = new Date('2025-01-01T00:00:00+08:00');
  const confirmed = drawRandomSign(date, { replay: [0.1, 0.1, 0.9] });
  const reference = SSGW_SIGNS[confirmed.number - 1];
  const polluted = {
    ...confirmed,
    title: '污染签题',
    poem: '污染签诗',
    story: '污染典故',
    details: Object.fromEntries(SSGW_INTERPRETATION_FIELDS.map((field) => [field, `污染${field}`])),
    ganzhi: { year: '甲子', month: '甲子', day: '甲子', hour: '甲子' },
    draw: { method: 'random' as const, poolSize: 1, selectedIndex: 91, selectedNumber: 92 },
    ritual: {
      throws: [
        { result: '笑杯' as const, firstFace: '阳面' as const, secondFace: '阳面' as const },
      ],
      confirmed: false,
      rejected: true,
      reason: '污染仪式结论',
    },
    evidenceAnalysis: undefined,
  } satisfies SsgwData;
  const rebuilt = rebuildAuditedSsgwData(polluted);
  assert.equal(rebuilt.title, reference.title);
  assert.equal(rebuilt.poem, reference.qianwen);
  assert.equal(rebuilt.story, reference.story);
  assert.deepEqual(rebuilt.details, reference.details);
  assert.deepEqual(rebuilt.draw, confirmed.draw);
  assert.equal(rebuilt.ritual, undefined);
  assert.deepEqual(rebuilt.meta?.random?.samples, [0.1]);

  const info = formatDivinationInfo('ssgw', polluted, '测试问题');
  const summary = getDivinationSummaryBlocks('ssgw', polluted);
  assert.match(info, /签号：第\d+签/);
  assert.match(info, /签谱状态：来源尚未完成校勘/);
  assert.doesNotMatch(info, /污染签题|污染签诗|污染典故|污染核心寓意|污染仪式结论/);
  assert.ok(summary.tags.includes('签谱待校'));
  assert.match(summary.lines.join('\n'), /只保留签号与抽取记录/);
  assert.doesNotMatch(summary.lines.join('\n'), /污染签题|污染签诗|污染典故|污染核心寓意/);

  assert.throws(
    () => rebuildAuditedSsgwData({ ...confirmed, number: confirmed.number + 1 }),
    /与随机轨迹重放得到的第\d+签不一致/,
  );
  const normalized = rebuildAuditedSsgwData({
    ...confirmed,
    meta: {
      ...confirmed.meta!,
      random: { mode: 'replay', samples: [0.1, 0.1, 0.9] },
    },
  });
  assert.deepEqual(normalized.meta?.random?.samples, [0.1]);
  assert.throws(
    () =>
      rebuildAuditedSsgwData({
        ...confirmed,
        meta: {
          ...confirmed.meta!,
          random: { mode: 'replay', samples: [] },
        },
      }),
    /至少需要1个抽签样本/,
  );

  const seeded = drawRandomSign(date, { seed: '灵签轨迹核验' });
  assert.throws(
    () =>
      rebuildAuditedSsgwData({
        ...seeded,
        meta: {
          ...seeded.meta!,
          random: {
            ...seeded.meta!.random!,
            samples: seeded.meta!.random!.samples.map((sample, index) =>
              index === 0 ? (sample + 0.5) % 1 : sample,
            ),
          },
        },
      }),
    /样本与种子不一致/,
  );
});

test('三山国王灵签应拒绝来源矛盾、缺失轨迹与无效时间', () => {
  const date = new Date('2025-01-01T00:00:00+08:00');
  const manual = resolveSignByNumber(1, date);
  const random = drawRandomSign(date, { replay: [0.1, 0.1, 0.9] });
  assert.throws(
    () =>
      rebuildAuditedSsgwData({
        ...manual,
        meta: random.meta,
      }),
    /手工录入不能同时携带随机轨迹/,
  );
  const manualWithLegacyRitual = rebuildAuditedSsgwData({
    ...manual,
    ritual: {
      throws: [{ result: '圣杯' }],
      confirmed: true,
      rejected: false,
    },
  });
  assert.equal(manualWithLegacyRitual.ritual, undefined);
  assert.throws(() => rebuildAuditedSsgwData({ ...random, meta: undefined }), /缺少完整随机轨迹/);
  assert.throws(
    () => rebuildAuditedSsgwData({ ...manual, timestamp: Number.MAX_SAFE_INTEGER }),
    /时间戳无效/,
  );
  assert.throws(() => rebuildAuditedSsgwData({ ...manual, number: 0 }), /签号需为1至92/);
});

test('三山国王灵签条件化工具与公开证据入口都应失败关闭旧派生字段污染', () => {
  [
    '所求之事必定成功，无需多虑。',
    '明知风险仍投入，结果必然失败。',
    '互不相让必然两败俱伤。',
  ].forEach((text) => {
    assert.equal(
      conditionSsgwInterpretation(text),
      '未采用签谱解释；当前签谱来源未闭合，只保留签号与抽取轨迹',
    );
  });

  const canonical = resolveSignByNumber(1, new Date('2025-01-01T00:00:00+08:00'));
  const analysis = analyzeSsgwEvidence({
    ...canonical,
    title: '污染签题',
    poem: '',
    story: '污染典故',
    details: Object.fromEntries(SSGW_INTERPRETATION_FIELDS.map((field) => [field, `污染${field}`])),
    ganzhi: { year: '甲子', month: '甲子', day: '甲子', hour: '甲子' },
    evidenceAnalysis: undefined,
  });
  const reference = SSGW_SIGNS[0];
  assert.deepEqual(analysis.signText, {
    number: reference.id,
    title: reference.title,
    poem: reference.qianwen,
  });
  assert.equal(analysis.story, undefined);
  assert.equal(analysis.signFact.status, '签诗为空');
  assert.equal(analysis.coverageFact.status, '存在缺口');
  assert.equal(analysis.missingFields.length, SSGW_INTERPRETATION_FIELDS.length);
  assert.doesNotMatch(analysis.promptText, /污染签题|污染典故|污染核心寓意/);
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

test('黄历页面资料与摘要只凭原始择日输入重建并忽略旧结果污染', () => {
  const clean = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
  });
  const polluted = structuredClone(clean);
  polluted.topic = 'custom';
  polluted.topicLabel = '伪造事项';
  polluted.startDate = '2000-01-01';
  polluted.endDate = '2000-01-01';
  polluted.days[0].date = '2000-01-01';
  polluted.days[0].ganzhi.day = '伪造干支';
  polluted.days[0].recommends = ['伪造宜项'];
  polluted.days[0].avoids = ['伪造忌项'];
  polluted.days[0].highlights = ['伪造现实支持'];
  polluted.days[0].cautions = ['伪造现实风险'];
  polluted.evidenceAnalysis!.promptText = '伪造旧证据';

  const cleanInfo = formatDivinationInfo('almanac', clean);
  const rebuiltInfo = formatDivinationInfo('almanac', polluted);
  const cleanSummary = getDivinationSummaryBlocks('almanac', clean);
  const rebuiltSummary = getDivinationSummaryBlocks('almanac', polluted);

  assert.equal(rebuiltInfo, cleanInfo);
  assert.deepEqual(rebuiltSummary, cleanSummary);
  assert.doesNotMatch(
    [rebuiltInfo, ...rebuiltSummary.tags, ...rebuiltSummary.lines].join('\n'),
    /伪造|2000-01-01/,
  );
});

test('太乙页面资料与摘要只凭原始年份重建并忽略旧盘污染', () => {
  const clean = generateTaiyi({ year: 2004 });
  const polluted = structuredClone(clean);
  polluted.scope = 'month';
  polluted.ganZhi = '伪造干支';
  polluted.dateTime = '伪造时间';
  polluted.bureau = 72;
  polluted.yinYang = '阴遁';
  polluted.taiyiPosition = '伪造太乙位';
  polluted.wenChangPosition = '伪造文昌位';
  polluted.shiJiPosition = '伪造始击位';
  polluted.jiShenPosition = '伪造计神位';
  polluted.lordCount = -1;
  polluted.guestCount = -1;
  polluted.setCount = -1;
  polluted.judgments = ['伪造现实断语'];
  polluted.model.name = '伪造模型';
  polluted.evidenceAnalysis.promptText = '伪造旧证据';

  const cleanInfo = formatDivinationInfo('taiyi', clean);
  const rebuiltInfo = formatDivinationInfo('taiyi', polluted);
  const cleanSummary = getDivinationSummaryBlocks('taiyi', clean);
  const rebuiltSummary = getDivinationSummaryBlocks('taiyi', polluted);

  assert.equal(rebuiltInfo, cleanInfo);
  assert.deepEqual(rebuiltSummary, cleanSummary);
  assert.doesNotMatch(
    [rebuiltInfo, ...rebuiltSummary.tags, ...rebuiltSummary.lines].join('\n'),
    /伪造|现实断语/,
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

test('塔罗与雷诺曼提示词应只保留原始抽牌资料且不混入工程证据话术', async () => {
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
  assert.match(
    lenormandSession.prompt,
    /牌义状态：关键词、单牌牌义、固定组合、相邻合读和布局解释均待具体版本校勘/,
  );
  assert.doesNotMatch(lenormandSession.prompt, /关键词：|牌义：|组合明细：/);
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

test('星盘提示词、页面资料与摘要只凭原始出生来源重建', () => {
  const data = generateAstrolabe({
    name: '本人',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
    locationName: '北京',
  });
  data.generation.timestamp = Date.parse('2025-01-01T08:30:00+08:00');
  const cleanInfo = formatDivinationInfo('astrolabe', data, '');
  const cleanSummary = getDivinationSummaryBlocks('astrolabe', data);
  const cleanPrompt = buildDivinationPrompt('astrolabe', '请分析整体星盘。', data);
  const polluted = structuredClone(data) as AstrolabeData;
  polluted.birth.name = '伪造姓名';
  polluted.birth.dateTime = '2099-12-31 23:59';
  polluted.planets = [];
  polluted.angles = [];
  polluted.houses = [];
  polluted.aspects = [];
  polluted.summary.retrograde = ['伪造逆行'];
  polluted.summary.patterns = ['伪造格局'];
  polluted.timestamp = Date.parse('2099-12-31T00:00:00+08:00');
  polluted.evidenceAnalysis!.promptText = '伪造旧星盘证据';

  assert.equal(formatDivinationInfo('astrolabe', polluted, ''), cleanInfo);
  assert.deepEqual(getDivinationSummaryBlocks('astrolabe', polluted), cleanSummary);
  assert.equal(buildDivinationPrompt('astrolabe', '请分析整体星盘。', polluted), cleanPrompt);
  assert.match(cleanPrompt, /【当前时间】\n公历：2025年1月1日 8时30分/);
  assert.doesNotMatch(cleanPrompt, /2099|伪造/);
  assert.match(buildTimeInfoText(polluted), /公历：2025年1月1日 8时30分/);
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

test('小六壬只按时间起课，并只向提示词提供原始时间事实', async () => {
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
  assert.match(timeSession.prompt, /时辰序号：\d+（子1至亥12）/);
  assert.match(timeSession.prompt, /证据链有缺口/);
  assert.match(timeSession.prompt, /本次不自动顺数、不提供落宫结论或六宫歌诀/);
  assert.doesNotMatch(timeSession.prompt, /顺数轨迹：|占得宫：|歌诀原文：/);
  assert.doesNotMatch(timeSession.prompt, /核心结构：起因|五行推进：|月令旺衰：|日干六亲：/);
});

test('小六壬底层算法应拒绝已移除的数字起课', () => {
  assert.throws(
    () => generateXiaoliuren({ method: 'number' as never }),
    /只保留时间原始事实，不支持其他起课方式/,
  );
});
