import { z } from 'zod';
import { base, baziBirth, baziBirthRange, calendarClock, requiredQuestion, uniqueArray, wholeSecondIso } from './shared';

export const zhouyiInput = z.object({
  ...base,
  query: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('hexagram'), id: z.number().int().min(1).max(64).optional(), name: z.string().trim().min(1).max(12).optional(),
      line: z.number().int().min(1).max(6).optional().describe('仅返回指定爻位，从初爻到上爻依次为 1–6。') }).strict()
      .refine((value) => (value.id === undefined) !== (value.name === undefined), '卦序与卦名须且只能提供一项。'),
    z.object({ kind: z.literal('search'), text: z.string().trim().min(1).max(50), offset: z.number().int().min(0).max(64).optional(), limit: z.number().int().min(1).max(20).optional() }).strict(),
    z.object({
      kind: z.literal('wings'),
      wing: z.string().trim().min(1).max(20).optional().describe('十翼篇名，如：文言传、系辞上传、系辞下传、说卦传、序卦传、杂卦传（亦支持简称如“文言”“说卦”）。'),
      chapter: z.string().trim().min(1).max(20).optional().describe('章节名，如：乾文言、坤文言、第一章、上经、全篇。'),
      trigram: z.string().trim().min(1).max(8).optional().describe('八卦名，如：乾、坤、震、巽、坎、离、艮、兑。'),
      text: z.string().trim().min(1).max(50).optional().describe('按十翼原文关键词检索。'),
      offset: z.number().int().min(0).max(100).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    }).strict(),
  ]),
}).strict().describe('查询周易六十四卦的卦辞、彖辞、大象、爻辞、小象与乾坤用辞，按原文检索，或检索《文言》《系辞》《说卦》《序卦》《杂卦》十翼原文。');

export const calendarInput = z.object({
  ...base,
  calendar: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('solar-term'), year: z.number().int().min(1900).max(2200), index: z.number().int().min(0).max(23).optional().describe('单个节气索引；0 是序列起点冬至，通常位于上一公历年。省略时返回公历年份的 24 个节气。') }).strict()
      .refine((value) => value.index !== undefined || value.year <= 2199, '全年节气仅支持 1900 至 2199 年。'),
    z.object({ kind: z.literal('moon-phase'), at: wholeSecondIso('月相时刻须精确到整秒。') }).strict(),
    z.object({ kind: z.literal('time-scales'), time: calendarClock.refine((value) => value.timezone !== undefined || value.timeZoneId !== undefined, '时间尺度须提供固定时区或 IANA 时区。') }).strict(),
    z.object({ kind: z.literal('true-solar'), birth: calendarClock.extend({ calendar: z.enum(['solar', 'lunar']).optional(), leapMonth: z.boolean().optional() }).strict(), longitude: z.number().min(-180).max(180) }).strict(),
    z.object({ kind: z.literal('solar-illumination'), time: calendarClock.refine((value) => value.timezone !== undefined || value.timeZoneId !== undefined, '太阳光照须提供固定时区或 IANA 时区。'), latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).strict(),
  ]),
}).strict().describe('历法与天文资料：节气、月相、时间尺度、真太阳时和太阳光照。');

export const instantInput = z.object({
  ...base, question: requiredQuestion,
  type: z.enum(['bazi', 'ziwei', 'bazi-ziwei', 'astrolabe', 'qizheng']).describe('按同一即时起盘，结果不代表个人出生盘。'),
  at: wholeSecondIso('起盘时刻须精确到整秒。').optional().describe('不填则采用调用当刻的整秒。'),
  timeStandard: z.enum(['beijing', 'true-solar']).optional(),
  observer: z.object({ longitude: z.number().min(-180).max(180), latitude: z.number().min(-90).max(90).optional(),
    timezone: z.number().min(-12).max(14).optional(), timeZoneId: z.string().trim().min(1).max(100).optional(), locationName: z.string().trim().min(1).max(100).optional(),
  }).strict().refine((value) => value.timezone !== undefined || value.timeZoneId !== undefined, '观测地点须提供固定时区或 IANA 时区。').optional(),
  ziweiAlgorithm: z.enum(['default', 'zhongzhou', 'beipai']).optional(),
}).strict().refine((value) => value.timeStandard !== 'true-solar' || !!value.observer, '真太阳时须提供观测地点。')
  .refine((value) => !['astrolabe', 'qizheng'].includes(value.type) || value.observer?.latitude !== undefined, '西洋星盘和七政四余即时盘须提供观测地点的经纬度与时区。')
  .refine((value) => value.ziweiAlgorithm === undefined || ['ziwei', 'bazi-ziwei'].includes(value.type), '排星算法仅适用于紫微即时盘。')
  .describe('即时起盘：按当前或指定时刻计算，不是个人出生盘。');

export const numberEnergyInput = z.object({
  ...base, question: requiredQuestion, value: z.string().min(1).max(64).describe('号码或数字字母串；保留未参与运算的标记。'),
  purpose: z.enum(['phone', 'plate', 'general']).optional().describe('手机号、车牌或一般编号；默认一般编号。'),
  prompt: z.object({ topicId: z.literal('general').optional(), subtopicId: z.literal('number-energy').optional(), scope: z.literal('custom').optional() }).strict().optional(),
}).strict().describe('数字能量：后天卦数、八宅变卦、夹数和八十数理，作为传统民俗取象。');

export const baziReverseInput = z.object({
  ...base,
  pillars: z.object({ year: z.string().trim().length(2), month: z.string().trim().length(2), day: z.string().trim().length(2), hour: z.string().trim().length(2) }).strict().describe('完整年、月、日、时四柱；须符合五虎遁与五鼠遁。'),
  startYear: z.number().int().min(1).max(2100).describe('查询的公历起始年，包含。'),
  endYear: z.number().int().min(1).max(2100).describe('查询的公历结束年，包含。'),
  longitude: z.number().min(-180).max(180).optional().describe('可选出生地经度（东正西负）；提供时按真太阳时反推对应的北京时间范围。'),
  applyChinaDst: z.boolean().optional().describe('可选标注 1986–1991 年中国历史夏令时期间对应的拨快 1 小时民用钟表范围。'),
}).strict().refine((value) => value.startYear <= value.endYear, '起始年不能晚于结束年')
  .describe('从四柱反推公历候选时间范围；默认按标准北京时间和 23 点换日，可选按出生地经度真太阳时反推或标注中国历史夏令时。');

export const characterQueryInput = z.object({
  ...base, question: requiredQuestion,
  query: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), text: z.string().trim().min(1).refine((value) => [...value].length <= 20 && [...value].every((char) => /\p{Script=Han}/u.test(char)), '请输入 1 至 20 个汉字'), includeReferences: z.boolean().optional().describe('是否加载收录的康熙字典原文；默认加载。') }).strict(),
    z.object({ kind: z.literal('search'), strokes: z.number().int().min(1).max(64).optional(), strokesMin: z.number().int().min(1).max(64).optional(), strokesMax: z.number().int().min(1).max(64).optional(), wuxing: z.enum(['金', '木', '水', '火', '土']).optional(), radical: z.string().trim().min(1).max(8).optional(), pinyin: z.string().trim().min(1).max(20).optional(), commonOnly: z.boolean().optional(), offset: z.number().int().min(0).max(10000).optional(), limit: z.number().int().min(1).max(100).optional() }).strict(),
  ]),
}).strict().describe('查询汉字字形、笔画、释义和收录的字典原文，或按笔画、五行及拼音筛选。');

const namingElements = uniqueArray(z.array(z.enum(['金', '木', '水', '火', '土'])).max(5), '五行不能重复');
const namingBirth = baziBirth.optional().describe('可选出生资料；缺失时辰须明确标为 unknown，结果保留条件候选。');

export const chineseNameInput = z.object({
  ...base, question: requiredQuestion, fullName: z.string().trim().min(2).max(8),
  surnameLength: z.union([z.literal(1), z.literal(2)]).optional(), preferredElements: namingElements.optional(), birth: namingBirth, birthRange: baziBirthRange.optional(),
  prompt: z.object({ topicId: z.literal('general').optional(), subtopicId: z.literal('name-analysis').optional(), scope: z.enum(['natal', 'event', 'custom']).optional() }).strict().optional(),
}).strict().refine((value) => !value.birth || !value.birthRange, '出生资料与出生范围不能同时提供').describe('姓名字形、五格三才和数理分析；可结合用户指定五行或出生资料。');

export const chineseNamingInput = z.object({
  ...base, question: requiredQuestion, surname: z.string().trim().min(1).max(4),
  gender: z.enum(['male', 'female', 'general']).optional(), givenNameLength: z.union([z.literal(1), z.literal(2)]).optional(),
  preferredElements: namingElements.optional(), preferredCharacters: z.string().trim().max(100).optional(), forbiddenCharacters: z.string().trim().max(100).optional(),
  generationCharacter: z.string().trim().max(2).optional(), generationPosition: z.enum(['first', 'second']).optional(),
  limit: z.number().int().min(1).max(50).optional(), birth: namingBirth, birthRange: baziBirthRange.optional(),
  prompt: z.object({ topicId: z.literal('general').optional(), subtopicId: z.literal('naming').optional(), scope: z.enum(['natal', 'event', 'custom']).optional() }).strict().optional(),
}).strict().refine((value) => !value.birth || !value.birthRange, '出生资料与出生范围不能同时提供').describe('依姓氏、偏好、忌用字和辈分字生成候选，并计算五格与三才。');
