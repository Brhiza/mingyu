import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDivinationSession } from '../src/lib/divination/engine';
import { buildTimeInfoText } from '../src/lib/divination/engine/formatters';
import type { QimenJiuGongGe } from '../packages/core/src/types/divination';
import { STEM_TOMB_MAP } from '../packages/core/src/divination/algorithms/qimen/helpers/_constants';
import { getStemRelations } from '../packages/core/src/divination/algorithms/qimen/helpers/classic-patterns';
import { checkSpecialHourConditions } from '../packages/core/src/divination/algorithms/qimen/helpers/jushu';
import { estimateYingQi } from '../packages/core/src/divination/algorithms/qimen/helpers/ying-qi';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { generateQimen, resolveZhiShiLandingPalace } from 'mingyu-core/divination/qimen';

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

function buildQimenPalace(gong: number, heavenStem: string): QimenJiuGongGe {
  return {
    gong,
    name: qimenPalaceNameByGong[gong] ?? `${gong}宫`,
    direction: '',
    element: '土',
    tianPan: { star: '', stem: heavenStem },
    diPan: { stem: '甲' },
    renPan: { door: '' },
    shenPan: { god: '' },
  };
}

test('各占卜方式都可以直接使用当前项目本地算法生成会话', async () => {
  const methods = [
    'liuyao',
    'meihua',
    'xiaoliuren',
    'qimen',
    'liuren',
    'tarot',
    'ssgw',
    'almanac',
    'lenormand',
    'astrolabe',
  ] as const;

  for (const method of methods) {
    const session = await generateDivinationSession(
      buildDraft({
        method,
        gender: '男',
        birthYear: '1995',
        meihuaMethod: 'number',
        meihuaNumber: '123',
        almanacEndDate: '2026-06-07',
        almanacParticipants: [
          {
            id: 'p1',
            name: '本人',
            gender: '男',
            year: '1995',
            month: '5',
            day: '20',
            timeIndex: '6',
            dateType: 'solar',
          },
        ],
        astrolabeGender: '男',
      }),
    );

    assert.equal(session.method, method);
    assert.equal(typeof session.prompt, 'string');
    assert.ok(session.prompt.includes(method === 'liuren' ? '【排盘信息】' : '【占卜信息】'));
    assert.ok(session.prompt.includes('【输出要求】'));
    assert.equal(typeof session.data.timestamp, 'number');
  }
});

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
  assert.match(session.prompt, /初筛结论：当前排序第一为/);
  assert.match(session.prompt, /取舍证据：首选/);
  assert.match(session.prompt, /备选/);
  assert.match(session.prompt, /慎用/);
  assert.match(session.prompt, /只在候选日期范围内排序/);
  assert.doesNotMatch(session.prompt, /关键提示：当前排序第一为/);
  assert.match(session.prompt, /参与人八字参考：/);
  assert.match(session.prompt, /本人：男/);
  assert.match(session.prompt, /伴侣：女/);
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

test('雷诺曼与星盘可以生成适合复制给 AI 的结构化提示词', async () => {
  const lenormand = await generateDivinationSession(
    buildDraft({
      method: 'lenormand',
      question: '这段关系接下来会如何发展？',
      lenormandSpread: 'relationship',
    }),
  );

  assert.equal(lenormand.method, 'lenormand');
  assert.match(lenormand.prompt, /占法：雷诺曼/);
  assert.match(lenormand.prompt, /牌阵/);
  assert.ok('cards' in lenormand.data && lenormand.data.cards.length >= 5);

  const astrolabe = await generateDivinationSession(
    buildDraft({
      method: 'astrolabe',
      question: '请看我的事业天赋和未来方向。',
    }),
  );

  assert.equal(astrolabe.method, 'astrolabe');
  assert.match(astrolabe.prompt, /占法：星盘/);
  assert.match(astrolabe.prompt, /上升/);
  assert.doesNotMatch(astrolabe.prompt, /真太阳时/);
  assert.doesNotMatch(astrolabe.prompt, /干支/);
  assert.doesNotMatch(astrolabe.prompt, /节气：/);
  assert.doesNotMatch(astrolabe.prompt, /农历/);
  assert.ok('planets' in astrolabe.data && astrolabe.data.planets.length >= 10);
  assert.ok('houses' in astrolabe.data && astrolabe.data.houses.length === 12);
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
