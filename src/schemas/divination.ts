import { z } from 'zod';
import { randomDivinationMethods } from '../random-methods';
import { base, divinationPrompt, divinationRange, isoTime, requiredQuestion, safeInteger, uniqueArray } from './shared';

export const randomDivinationInput = z.object({
  ...base, question: requiredQuestion,
  methods: uniqueArray(z.array(z.enum(randomDivinationMethods)).min(1).max(randomDivinationMethods.length), '候选术数不能重复。').optional()
    .describe('可限定随机选择的术数；须已在当前服务启用。省略时使用已启用的全部可选术数。'),
}).strict().describe('明确要求随机选一种占法时使用；先选择已启用的术数，再按其默认方式起盘并返回完整结果。');

export const liuyaoInput = z.object({
  ...base, question: requiredQuestion, divinationTime: isoTime.optional(),
  range: divinationRange.optional().describe('不确定的起卦时间范围；所有分支使用同一次起卦结果。'),
  liuyao: z.object({
    method: z.enum(['time', 'manual', 'coins', 'yarrow']).optional().describe('默认 time：按时间戳确定性模拟三钱，并非线下实摇或按年月日时取数；manual 提供六爻值；coins 随机模拟或提交三钱结果；yarrow 随机模拟或提交蓍草分堆。'),
    yaos: z.array(z.number().int().min(6).max(9)).length(6).optional(),
    yarrowSplits: z.array(z.number().int().positive()).length(18).optional().describe('调用方提供的十八变左堆数；不提供时由程序模拟分堆。'),
    coinThrows: z.array(z.object({
      coins: z.array(z.union([z.literal(2), z.literal(3)])).length(3),
      total: z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]),
    }).strict()).length(6).optional().describe('调用方提供六次三钱结果；不提供时由程序模拟。'),
    timezoneOffsetMinutes: z.number().int().min(-720).max(840).optional().describe('民用时区偏移分钟数；默认 480。'),
    ziHourMode: z.enum(['23:00', '00:00']).optional().describe('早晚子时换日口径：默认 23:00（23点换日柱）；00:00 为0点换日柱。'),
    timeStandard: z.enum(['beijing', 'true-solar']).optional().describe('默认北京时间；true-solar 以经度校正日时，年月仍按实际瞬时。'),
    longitude: z.number().min(-180).max(180).optional().describe('真太阳时必填，经度东正西负。'),
  }).strict().refine((value) => value.timeStandard === 'true-solar' ? value.longitude !== undefined : value.longitude === undefined, '真太阳时必须提供经度；北京时间不接受经度').optional(),
  prompt: z.object({
    ...divinationPrompt,
    liuyaoTemplate: z.enum(['general', 'ganqing', 'shiye', 'caifu', 'guaishen']).optional(),
    schools: z.array(z.enum(['huozhulin', 'bushizhengzong', 'zengshanbuyi'])).max(3).optional(),
  }).strict().optional(),
}).strict().refine((value) => !value.range || !value.divinationTime, '范围起卦不能同时提供单一起卦时间').describe('六爻单事占问：支持手工爻值、三钱、蓍草和起卦时间范围；默认时间起卦是时间戳确定性模拟，不代表实摇或传统年月日时取数。');

export const liurenInput = z.object({
  ...base, question: requiredQuestion, divinationTime: isoTime.optional().describe('实际起课时刻；省略时使用本次 currentTime。'),
  range: divinationRange.optional(),
  liuren: z.object({
    timeStandard: z.enum(['beijing', 'true-solar']).optional().describe('默认北京时间；true-solar 以经度校正日时，节气和月将依据实际时刻。'),
    longitude: z.number().min(-180).max(180).optional().describe('真太阳时必填，经度东正西负。'),
    guiRenTable: z.enum(['jia-wu-geng-chou-wei', 'jia-yang-wu-geng-niu']).optional().describe('贵人起例口诀：默认 jia-wu-geng-chou-wei（甲戊庚牛羊）；jia-yang-wu-geng-niu 为古本甲羊戊庚牛。'),
  }).strict().refine((value) => value.timeStandard === 'true-solar' ? value.longitude !== undefined : value.longitude === undefined, '真太阳时必须提供经度；北京时间不接受经度').optional(),
  prompt: z.object({
    ...divinationPrompt,
    liurenTemplate: z.enum(['general', 'ganqing', 'shiye', 'caifu']).optional(),
    schools: z.array(z.enum(['keti', 'bifafu', 'leishen'])).max(3).optional(),
  }).strict().optional(),
}).strict().refine((value) => !value.range || !value.divinationTime, '范围起课不能同时提供单一占时').describe('大六壬单事占问：按指定或当前时刻排四课三传，支持真太阳时及起课时间范围。');

export const jinkoujueInput = z.object({
  ...base, question: requiredQuestion, divinationTime: isoTime.optional().describe('实际起课时刻；省略时使用本次 currentTime。'),
  range: divinationRange.optional(),
  jinkoujue: z.object({
    method: z.enum(['time', 'branch', 'number', 'random']).optional(),
    branch: z.enum(['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']).optional(),
    number: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).optional(),
    timeStandard: z.enum(['beijing', 'true-solar']).optional().describe('默认北京时间；true-solar 以经度校正日时，节气和月将依据实际时刻。'),
    longitude: z.number().min(-180).max(180).optional().describe('真太阳时必填，经度东正西负。'),
    guiRenTable: z.enum(['jia-wu-geng-chou-wei', 'jia-yang-wu-geng-niu']).optional().describe('贵人起例口诀：默认 jia-wu-geng-chou-wei（甲戊庚牛羊）；jia-yang-wu-geng-niu 为古本甲羊戊庚牛。'),
  }).strict().refine((value) => {
    const method = value.method ?? 'time';
    return method === 'branch' ? value.branch !== undefined && value.number === undefined
      : method === 'number' ? value.number !== undefined && value.branch === undefined
      : value.branch === undefined && value.number === undefined;
  }, '指定地分或数字起课时须提供对应参数，其他起课方式不接受地分或数字')
    .refine((value) => value.timeStandard === 'true-solar' ? value.longitude !== undefined : value.longitude === undefined, '真太阳时必须提供经度；北京时间不接受经度').optional(),
  prompt: z.object({ ...divinationPrompt, schools: z.array(z.enum(['siwei', 'fayong', 'wudong'])).max(3).optional() }).strict().optional(),
}).strict().refine((value) => !value.range || !value.divinationTime, '范围起课不能同时提供单一占时').describe('金口诀单事占问：按时间、指定地分、数字或随机方式起课，支持真太阳时与起课时间范围。');

export function taiyiScopeMatches(chartScope: string, promptScope?: string) {
  const scopes: Record<string, string> = { year: 'yearly', month: 'monthly', day: 'daily', hour: 'hourly' };
  return promptScope === undefined || scopes[chartScope] === promptScope;
}

export const taiyiInput = z.object({
  ...base, question: requiredQuestion,
  range: divinationRange.optional(),
  taiyi: z.object({
    scope: z.enum(['year', 'month', 'day', 'hour']).optional(),
    year: z.number().int().min(1900).max(2200).optional(),
    date: isoTime.optional().describe('月、日、时计的起局时刻；省略时使用本次 currentTime，按北京时间计算。'),
    ganZhi: z.string().length(2).optional().describe('可选本计干支；须与所选年份或日期一致。'),
    timeStandard: z.enum(['beijing', 'true-solar']).optional().describe('月、日、时计可选择真太阳时；年月节气及阴阳遁仍按实际瞬时。'),
    longitude: z.number().min(-180).max(180).optional().describe('真太阳时必填，经度东正西负。'),
  }).strict().refine((value) => (value.scope ?? 'year') === 'year' ? value.year !== undefined && value.date === undefined && value.timeStandard === undefined && value.longitude === undefined : value.year === undefined, '年计须提供 year，不接受 date 或时间口径；月、日、时计不接受 year')
    .refine((value) => value.timeStandard === 'true-solar' ? value.longitude !== undefined : value.longitude === undefined, '真太阳时必须提供经度；北京时间不接受经度'),
  prompt: z.object({ ...divinationPrompt, schools: z.array(z.enum(['zhuke', 'gongwei', 'jisuan'])).max(3).optional() }).strict().optional(),
}).strict().refine((value) => taiyiScopeMatches(value.taiyi.scope ?? 'year', value.prompt?.scope), '提示词时间范围与太乙计式不一致')
  .refine((value) => !value.range || ((value.taiyi.scope ?? 'year') !== 'year' && !value.taiyi.date), '范围起局仅支持月、日、时计，不能同时提供单一日期').describe('太乙神数：按年、月、日、时计排盘；年计须提供年份，月日时计支持起局时间范围。');

export const wuyunInput = z.object({
  ...base, question: requiredQuestion,
  wuyun: z.object({
    year: z.number().int().min(1).max(9999).optional().describe('公历年；按该年年中对应的年柱计算。'),
    yearGanZhi: z.string().trim().length(2).optional().describe('年干支；与年份至少提供一项，同时提供时须一致。'),
  }).strict().refine((value) => value.year !== undefined || value.yearGanZhi !== undefined, '必须提供公历年份或年干支'),
  prompt: z.object({ ...divinationPrompt, schools: z.array(z.enum(['yunqi', 'sitian', 'kezhu'])).max(3).optional() }).strict()
    .refine((value) => value.scope === undefined || value.scope === 'yearly', '五运六气只支持年度分析范围').optional(),
}).strict().describe('五运六气：按公历年份或年干支计算年度五运、六气与司天在泉。');

export const huangjiInput = z.object({
  ...base, question: requiredQuestion,
  range: divinationRange.optional(),
  huangji: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('year'), year: safeInteger.refine((value) => value !== 0, '通行公元纪年没有公元 0 年') }).strict(),
    z.object({ mode: z.literal('datetime'), date: isoTime.optional().describe('实际起盘时刻，须包含时区偏移；范围起盘不提供单一时刻。'),
      timeStandard: z.enum(['beijing', 'true-solar']).optional(), longitude: z.number().min(-180).max(180).optional().describe('真太阳时必填，经度东正西负。'),
    }).strict().refine((value) => value.timeStandard === 'true-solar' ? value.longitude !== undefined : value.longitude === undefined, '真太阳时必须提供经度；北京时间不接受经度'),
    z.object({ mode: z.literal('coordinate'), epochYear: safeInteger, year: safeInteger.optional(), elapsedYears: safeInteger.min(0).optional() }).strict()
      .refine((value) => (value.year === undefined) !== (value.elapsedYears === undefined), '自定义纪元须且只能提供目标年坐标或已过年数'),
    z.object({
      mode: z.literal('six-day'), dateTime: z.string().min(1).max(100),
      calendarModel: z.enum(['six-day-seven-part', 'six-day-explicit-epoch']),
      epochDateTime: z.string().min(1).max(100).optional(),
      timezone: z.number().min(-12).max(14).optional(), timeZoneId: z.string().min(1).max(100).optional(),
    }).strict().refine((value) => value.calendarModel === 'six-day-explicit-epoch' ? value.epochDateTime !== undefined : value.epochDateTime === undefined, '显式历元模型须提供 epochDateTime；现代比例模型不接受该字段'),
    z.object({
      mode: z.literal('reference'), table: z.enum(['sound-rhythm', 'animal-plant', 'historical-era']),
      shiIndex: z.number().int().min(2149).max(2208).optional(),
    }).strict().refine((value) => value.table === 'historical-era' ? value.shiIndex !== undefined : value.shiIndex === undefined, '历史纪年表须提供经辰序号，其他资料表不接受经辰序号'),
  ]),
  prompt: z.object({ ...divinationPrompt, schools: z.array(z.enum(['yuanhui', 'guaqi'])).max(2).optional() }).strict()
    .refine((value) => value.scope === undefined || value.scope === 'cycle', '皇极经世仅支持周期分析范围').optional(),
}).strict().refine((value) => value.huangji.mode !== 'reference' || !value.prompt || Object.keys(value.prompt).length === 0, '资料表查询不接受排盘主题、流派或时间范围选项')
  .refine((value) => value.huangji.mode === 'datetime' ? Boolean(value.range) !== Boolean(value.huangji.date) : !value.range, '年月日时模式须且只能提供单一时刻或范围；其他模式不接受范围').describe('皇极经世：计算值年、年月日时、自定义纪元或六日逐爻，也可查询固定资料表。');

export const tarotInput = z.object({
  ...base, question: requiredQuestion,
  tarot: z.object({
    spread: z.enum(['single', 'three', 'love', 'career', 'decision', 'celtic', 'chakra', 'year', 'mindBodySpirit', 'horseshoe', 'holyTriangle', 'universal', 'fourElements', 'hexagram', 'relationship', 'wealth', 'problemSolving', 'twelveHouses']).optional(),
    deckScope: z.enum(['all', 'major']).optional().describe('牌组范围：默认 all（78张全牌）；major 为仅使用 22 张大阿卡纳。'),
    reversalMode: z.enum(['realistic', 'balanced', 'upright-only']).optional().describe('洗牌正逆位模式：默认 realistic（约 30% 逆位，贴近现实洗牌手感）；balanced（经典对半 50%）；upright-only（仅正位，0% 逆位）。'),
    manualCards: z.array(z.object({ id: z.number().int().min(1).max(78), reversed: z.boolean() }).strict()).optional().describe('按牌位顺序提供已选择的牌号 1–78 和正逆位；也可由交互界面逐张选择后提交。'),
    selectionMode: z.enum(['manual', 'interactive']).optional().describe('选择牌面时记录来自手工录入还是界面逐张抽取；不传牌面时省略。'),
  }).strict().refine((value) => !value.selectionMode || !!value.manualCards, '指定选牌方式时必须提供牌面').optional(),
  prompt: z.object({ ...divinationPrompt, schools: z.array(z.enum(['rws', 'yuansu', 'narrative', 'marseille'])).max(4).optional() }).strict().optional(),
}).strict().describe('塔罗占问：选择牌阵，可随机抽牌或按牌位提供已选牌号与正逆位。');

export const lenormandInput = z.object({
  ...base, question: requiredQuestion,
  lenormand: z.object({
    spread: z.enum(['single', 'three', 'five', 'relationship', 'decision', 'nine', 'element', 'grandTableau']).optional(),
    manualCardIds: z.array(z.number().int().min(1).max(36)).optional().describe('按牌位顺序提供已选择的牌号 1–36，不可重复；也可由交互界面逐张选择后提交。'),
    selectionMode: z.enum(['manual', 'interactive']).optional().describe('选择牌面时记录来自手工录入还是界面逐张抽取；不传牌面时省略。'),
  }).strict().refine((value) => !value.selectionMode || !!value.manualCardIds, '指定选牌方式时必须提供牌面').optional(),
  prompt: z.object({ ...divinationPrompt, schools: z.array(z.enum(['combination', 'eventline', 'significator'])).max(3).optional() }).strict().optional(),
}).strict().describe('雷诺曼占问：选择牌阵，可随机抽牌或按牌位提供已选牌号。');

export const xiaoliurenInput = z.object({
  ...base, question: requiredQuestion, divinationTime: isoTime.optional(),
  xiaoliuren: z.object({
    rule: z.enum(['common', 'duoneng']).optional().describe('common 为通行掌诀；duoneng 按《多能鄙事》月宫下一宫起初一。'),
    ziHourMode: z.enum(['00:00', '23:00']).optional().describe('晚子时（23:00–24:00）换日口径：默认 00:00（民用零点换日）；23:00 为晚子时换入次日农历日期。'),
    leapMonthMode: z.enum(['same', 'next', 'split-15']).optional().describe('农历闰月折算口径：默认 same（闰月沿用同名月序）；next 为按下一月算；split-15 为前十五日按本月、十五日后按下月。'),
    numbers: z.tuple([z.number().int().positive(), z.number().int().positive(), z.number().int().positive()]).optional().describe('三数起课法：提供三个正整数直接起月宫、日宫、时宫。'),
    timeStandard: z.enum(['beijing', 'true-solar']).optional().describe('默认北京时间；true-solar 以经度校正日时、农历日与时辰。'),
    longitude: z.number().min(-180).max(180).optional().describe('真太阳时必填，经度东正西负。'),
  }).strict().refine((value) => value.timeStandard === 'true-solar' ? value.longitude !== undefined : value.longitude === undefined, '真太阳时必须提供经度；北京时间不接受经度').optional(),
  prompt: z.object({ ...divinationPrompt, schools: z.array(z.enum(['shunshu', 'gongjue', 'daoliu'])).max(3).optional() }).strict().optional(),
}).strict().describe('小六壬占问：按指定或当前时刻（或三数活起）起课，支持通行或多能鄙事口径、晚子时换日与闰月折算。');

export const ssgwInput = z.object({
  ...base, question: requiredQuestion, divinationTime: isoTime.optional(),
  ssgw: z.object({
    method: z.enum(['random', 'manual']).optional(),
    number: z.number().int().min(1).max(92).optional(),
  }).strict().refine((value) => value.method === 'manual' ? value.number !== undefined : value.number === undefined, '指定签号须选择手工求签；随机求签不接受签号').optional(),
  prompt: z.object({ ...divinationPrompt }).strict().optional(),
}).strict().describe('三山国王灵签：随机求签或输入 1 至 92 的指定签号，返回签文和解读提示词。');

export const zhugeInput = z.object({
  ...base,
  question: requiredQuestion,
  zhuge: z.object({
    method: z.enum(['text', 'numbers', 'coins']).optional().describe('起卦方式：text（汉字三字取数，默认）、numbers（三组数字取签）、coins（五枚铜钱起卦，对应三十二课）。'),
    text: z.string().trim().refine((value) => [...value].length === 3, '汉字取签需输入恰好三个汉字').optional().describe('method=text 时提供的三个汉字，须收录在当前康熙笔画资料中。'),
    numbers: z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative(), z.number().int().nonnegative()]).optional().describe('method=numbers 时提供的三个非负整数（各自取个位合算第 1–384 签）。'),
    pattern: z.string().trim().regex(/^[●○阳阴正反公字10]{5}$/u, '五枚铜钱需按顺序输入五个阴阳结果').optional().describe('method=coins 时五枚铜钱结果，可用 ●○、阳阴、正反、公字或 10；省略则随机投掷。'),
  }).strict().superRefine((value, ctx) => {
    const mode = value.method ?? (value.pattern !== undefined ? 'coins' : value.numbers !== undefined ? 'numbers' : 'text');
    if (mode === 'text' && !value.text) {
      ctx.addIssue({ code: 'custom', message: '诸葛神数汉字取签需提供恰好三个汉字 text' });
    }
    if (mode === 'text' && (value.numbers !== undefined || value.pattern !== undefined)) {
      ctx.addIssue({ code: 'custom', message: '汉字取签不接受 numbers 或 pattern 参数' });
    }
    if (mode === 'numbers' && !value.numbers) {
      ctx.addIssue({ code: 'custom', message: '诸葛神数数字取签需提供三个数字 numbers' });
    }
    if (mode === 'numbers' && (value.text !== undefined || value.pattern !== undefined)) {
      ctx.addIssue({ code: 'custom', message: '数字取签不接受 text 或 pattern 参数' });
    }
    if (mode === 'coins' && (value.text !== undefined || value.numbers !== undefined)) {
      ctx.addIssue({ code: 'custom', message: '五枚铜钱起卦不接受 text 或 numbers 参数' });
    }
  }),
  prompt: z.object({ ...divinationPrompt }).strict().optional(),
}).strict().describe('诸葛神数：统一支持汉字三字、三数字取签（第 1–384 签）与五枚铜钱起卦（三十二课），切换 zhuge.method 即可。');

export const meihuaInput = z.object({
  ...base, question: requiredQuestion, divinationTime: isoTime.optional(),
  meihua: z.object({
    method: z.enum(['time', 'number', 'sound', 'character', 'direction', 'random']).optional().describe('时间、数字、声音、文字、方位物象或随机起卦；默认时间起卦。'),
    number: z.number().int().positive().optional().describe('数字起卦时提供正整数。'), soundCount: z.number().int().positive().optional().describe('声音起卦时提供声音次数。'),
    characterText: z.string().min(1).max(200).optional().describe('文字起卦原文；按 Unicode 字符计数。'), characterCount: z.number().int().min(1).max(100).optional().describe('未提供原文时可提供字数；一字提供左右笔画，二至三字提供逐字笔画，四至十字提供传统声数。'),
    characterTones: z.array(z.number().int().min(1).max(4)).max(100).optional().describe('传统平、上、去、入声数 1–4，不等同于普通话四声。'),
    characterStrokeCounts: z.array(z.number().int().positive()).max(100).optional(),
    characterLeftStrokes: z.number().int().positive().optional(), characterRightStrokes: z.number().int().positive().optional(),
    direction: z.enum(['northwest', 'west', 'south', 'east', 'southeast', 'north', 'northeast', 'southwest']).optional(),
    objectType: z.enum(['heaven', 'lake', 'fire', 'thunder', 'wind', 'water', 'mountain', 'earth']).optional(),
    timeStandard: z.enum(['beijing', 'true-solar']).optional().describe('默认北京时间；true-solar 以经度校正日时、农历日与时辰取数，年月仍按实际瞬时。'),
    longitude: z.number().min(-180).max(180).optional().describe('真太阳时必填，经度东正西负。'),
  }).strict().refine((value) => value.timeStandard === 'true-solar' ? value.longitude !== undefined : value.longitude === undefined, '真太阳时必须提供经度；北京时间不接受经度').optional(),
  prompt: z.object({ ...divinationPrompt, schools: z.array(z.enum(['tiyong', 'xiangshu', 'yaoci'])).max(3).optional() }).strict().optional(),
}).strict().describe('梅花易数占问：按时间、数字、声音、文字、方位物象或随机方式起卦。');

export function qimenScopeMatches(chartScope: string, promptScope?: string) {
  const expected: Record<string, string> = { hour: 'hourly', day: 'daily', month: 'monthly', year: 'yearly' };
  return !promptScope || !Object.values(expected).includes(promptScope) || expected[chartScope] === promptScope;
}

export const qimenInput = z.object({
  ...base, question: requiredQuestion, divinationTime: isoTime.optional(),
  range: divinationRange.optional(),
  qimen: z.object({
    method: z.enum(['zhuanpan', 'feipan']).optional(),
    feipanMode: z.enum(['star-only', 'all-fly']).optional().describe('飞盘细分子口径（仅 method=feipan 适用）：默认 star-only（九星飞宫、八门八神环转）；all-fly 为九星、八门、九神皆按洛书九宫飞布。'),
    scope: z.enum(['hour', 'day', 'month', 'year']).optional().describe('hour、day、month、year 分别是时家、日家、月家、年家。'),
    juMethod: z.enum(['chaibu', 'zhirun', 'maoshan']).optional().describe('拆补、置闰或茅山道人法，仅时家和日家可选。'),
    centerPalace: z.enum(['kun2', 'yang-gen8-yin-kun2']).optional().describe('中五宫寄宫口径：默认 kun2（一律寄坤二）；yang-gen8-yin-kun2 为阳遁寄艮八、阴遁寄坤二。'),
    timeStandard: z.enum(['beijing', 'civil', 'true-solar']).optional().describe('默认北京时间；civil 使用指定时区；true-solar 使用经度校正日、时干支，节气仍按真实瞬时确定。'),
    longitude: z.number().min(-180).max(180).optional().describe('真太阳时必填，经度东正西负。'),
    timezone: z.number().min(-12).max(14).refine((value) => Math.abs(value * 60 - Math.round(value * 60)) < 1e-8, '时区偏移须精确到整分钟。').optional().describe('civil 模式可指定固定 UTC 偏移小时，与 timeZoneId 二选一。'),
    timeZoneId: z.string().trim().min(1).max(100).optional().describe('civil 模式可指定 IANA 时区，自动处理夏令时，与 timezone 二选一。'),
  }).strict().refine((value) => !value.feipanMode || value.method === 'feipan', 'feipanMode 仅适用于飞盘法（method=feipan）')
    .refine((value) => !value.juMethod || !['month', 'year'].includes(value.scope ?? 'hour'), '月家和年家不能指定拆补或置闰')
    .refine((value) => value.timeStandard === 'true-solar' ? value.longitude !== undefined : value.longitude === undefined, '真太阳时必须提供经度；其他口径不接受经度')
    .refine((value) => value.timeStandard === 'civil' ? (value.timezone !== undefined) !== (value.timeZoneId !== undefined) : value.timezone === undefined && value.timeZoneId === undefined, 'civil 模式需要且只能提供 timezone 或 timeZoneId；其他口径不接受时区参数').optional(),
  prompt: z.object({ ...divinationPrompt, schools: z.array(z.enum(['gongwei', 'geju', 'zhuke'])).max(3).optional() }).strict().optional(),
}).strict().refine((value) => qimenScopeMatches(value.qimen?.scope ?? 'hour', value.prompt?.scope), '提示词时间范围与奇门盘层级不一致')
  .refine((value) => !value.range || !value.divinationTime, '范围起局不能同时提供单一占时').describe('奇门遁甲时局：按年、月、日、时及转盘或飞盘排局，支持地方时、真太阳时和时间范围。');

const lifetimeTopics = ['career', 'wealth', 'marriage', 'health', 'academic', 'relocation', 'family', 'children', 'partnership'] as const;
const lifetimeAnchor = z.enum(['birthInstant', 'solarTermBoundary', 'lunarNewYear']).optional();
const lifetimeAge = z.enum(['fullYears', 'nominalAge']).optional();
export const qimenLifetimeInput = z.object({
  ...base, question: requiredQuestion, name: z.string().trim().min(1).max(100).optional(),
  birth: z.object({
    year: z.number().int().min(1900).max(2200), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31),
    hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59), second: z.number().int().min(0).max(59),
    calendar: z.enum(['solar', 'lunar']).optional(), leapMonth: z.boolean().optional(),
    timezone: z.number().min(-12).max(14).optional(), timeZoneId: z.string().trim().min(1).max(100).optional(),
    timeStandard: z.enum(['civil', 'true-solar']).optional(), longitude: z.number().min(-180).max(180).optional(),
  }).strict().describe('精确出生钟表时间；默认北京时间。IANA 时区的夏令时回拨需同时指定正确的 timezone。'),
  birthRange: z.object({
    start: isoTime, end: isoTime, index: z.number().int().min(0).optional(),
  }).strict().refine(({ start, end, index }) => {
    const a = Date.parse(start), b = Date.parse(end);
    return Number.isSafeInteger(a) && Number.isSafeInteger(b) && a % 1000 === 0 && b % 1000 === 0 && b > a && b - a <= 7200_000 && (index ?? 0) < (b - a) / 1000;
  }, '出生范围须为整秒、最长两小时的半开区间，索引须在范围内').optional().describe('可选出生范围；birth 必须对应起点，每次计算 index 指定的候选秒。'),
  gender: z.enum(['male', 'female']).optional().describe('九宫巡行和十年干支大运需要提供。'),
  method: z.enum(['zhuanpan', 'feipan']).optional(), juMethod: z.enum(['chaibu', 'zhirun']).optional(),
  topics: z.array(z.enum(lifetimeTopics)).max(9).optional(),
  periodRange: z.object({ startDate: z.iso.date(), endDate: z.iso.date() }).strict().optional().describe('动态扫描的当地公历日期，两端包含，最多连续 31 个年份。'),
  stagePolicy: z.discriminatedUnion('model', [
    z.object({ model: z.literal('pillarFourLimits'), anchorRule: lifetimeAnchor, ageSystem: lifetimeAge }).strict(),
    z.object({ model: z.literal('palaceWalk'), anchorRule: lifetimeAnchor, ageSystem: lifetimeAge, yearsPerStage: z.number().int().min(1).max(100).optional() }).strict(),
    z.object({ model: z.literal('fushiAlternating'), anchorRule: lifetimeAnchor, ageSystem: lifetimeAge }).strict(),
    z.object({ model: z.literal('decadalGanzhi'), ageSystem: lifetimeAge }).strict(),
  ]).optional(),
  prompt: z.object({
    scope: z.enum(['full', 'natal', 'stage']).optional(), stageIndex: z.number().int().min(0).optional(),
    detailMode: z.enum(['compact', 'full']).optional().describe('动态日支日期：compact 汇总数量，full 列出全部实际命中日期。'),
    schools: z.array(z.enum(['gongwei', 'geju', 'zhuke'])).max(3).optional(), includeClassics: z.boolean().optional(),
  }).strict().refine((value) => value.scope === 'stage' ? value.stageIndex !== undefined : value.stageIndex === undefined, '选择单一阶段时必须提供 stageIndex，其他范围不能提供').optional(),
}).strict().describe('奇门终身局预览：支持精确出生或出生区间候选秒、本命盘、阶段与可选动态日期扫描。');
