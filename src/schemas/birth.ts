import { z } from 'zod';
import { base, baziBirth, baziBirthRange, isoTime, requiredQuestion, uniqueArray, wholeSecondIso } from './shared';
import { baziTopicIds, baziSchoolIds } from '../systems/bazi/prompt-options';

const qizhengPrompt = z.object({
  topicId: z.enum(['general', 'relationship', 'career', 'wealth', 'health', 'family', 'academic', 'timing']).optional(),
  subtopicId: z.string().trim().min(1).max(50).optional(),
  scope: z.enum(['natal', 'full', 'yearly', 'monthly', 'daily']).optional(),
  eventDetail: z.enum(['summary', 'full']).optional(),
  schools: uniqueArray(z.array(z.enum(['guolao', 'qintang'])).max(2), '解读流派不得重复。').optional(),
  includeClassics: z.boolean().optional(),
  includeStarMeanings: z.boolean().optional().describe('附加项目整理的十一曜传统取象参考；未经古籍原文校核。'),
}).strict().optional();

const qizhengBirth = z.object({
  year: z.number().int().min(1900).max(2200), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59), second: z.number().int().min(0).max(59).optional(),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  timezone: z.number().min(-12).max(14).optional(), timeZoneId: z.string().trim().min(1).max(100).optional(),
  timeStandard: z.enum(['civil', 'true-solar']).optional(),
}).strict().refine((birth) => birth.timezone !== undefined || birth.timeZoneId !== undefined, '需要明确固定时区或 IANA 时区。');

const qizhengFlow = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('year'), year: z.number().int().min(1900).max(2200) }).strict().describe('年度取立春交节瞬时。'),
  z.object({ kind: z.literal('month'), year: z.number().int().min(1900).max(2200), month: z.number().int().min(1).max(12) }).strict().describe('月度取当地 15 日正午。'),
  z.object({ kind: z.literal('day'), year: z.number().int().min(1900).max(2200), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31),
    clock: z.object({ hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59), second: z.number().int().min(0).max(59).optional() }).strict().optional(),
    timezone: z.number().min(-12).max(14).optional().describe('仅 IANA 时区存在回拨歧义时用于选择流曜时刻的偏移。') }).strict().describe('日度默认当地正午，可显式指定时分秒。'),
  z.object({ kind: z.literal('instant'), at: wholeSecondIso('流曜时刻须为整秒') }).strict(),
]);

const qizhengOptions = z.object({
  mingGongMethod: z.enum(['mao-palace', 'ascendant']).optional().describe('命宫推算口径：默认 mao-palace（传统太阳加生时顺数至卯安命）；ascendant 为按出生地地平真上升点（ASC）定命宫与命度。'),
  nodeModel: z.enum(['true', 'mean']).optional().describe('罗睺/计都交点模型：默认 true（真月交点）；mean 为 Moshier 平均月交点。'),
}).strict().optional();

export const qizhengInput = z.object({
  ...base, question: requiredQuestion,
  birth: qizhengBirth,
  gender: z.enum(['male', 'female']).optional().describe('与 flow 同时提供时计算小限与年分；缺少时仅计算流曜。'),
  flow: qizhengFlow.optional(),
  periodEvents: z.boolean().optional().describe('选择流曜时可启用周期事件扫描；年度开销较高。'),
  options: qizhengOptions,
  prompt: qizhengPrompt,
}).strict().refine((input) => !input.gender || !!input.flow, '性别用于行限，须同时提供 flow。')
  .refine((input) => !input.periodEvents || !!input.flow, '周期事件需要提供流曜时点。')
  .refine((input) => input.flow?.kind !== 'day' || input.flow.timezone === undefined || !!input.birth.timeZoneId, '流曜 timezone 仅用于选择 IANA 时区回拨时刻。')
  .describe('七政四余预览：本命、指定时点流曜、行限及可选周期事件。');

export const qizhengRangeInput = z.object({
  ...base, question: requiredQuestion,
  birth: qizhengBirth,
  gender: qizhengInput.shape.gender,
  flow: qizhengFlow.optional().describe('可选指定流曜时点；逐秒比较本命候选对应的流曜与行限。'),
  periodEvents: z.boolean().optional().describe('逐候选扫描流曜周期事件，计算量较大；启用时每页默认 1 秒，最多 4 秒。'),
  options: qizhengOptions,
  range: z.object({
    start: wholeSecondIso('起点须为整秒。'),
    end: wholeSecondIso('终点须为整秒，不包含终点。'),
    cursor: z.number().int().min(0).optional().describe('从起点开始的秒数；使用上一页 nextCursor 续取。'),
    pageSize: z.number().int().min(1).max(30).optional().describe('每页计算的秒数；通常默认 30，启用周期事件时默认 1、最多 4。'),
  }).strict(),
  prompt: qizhengPrompt,
}).strict().refine((input) => !input.gender || !!input.flow, '性别用于行限，须同时提供 flow。')
  .refine((input) => !input.periodEvents || !!input.flow, '周期事件需要提供流曜时点。')
  .refine((input) => !input.periodEvents || (input.range.pageSize ?? 1) <= 4, '周期事件扫描每页最多 4 秒。')
  .refine((input) => input.flow?.kind !== 'day' || input.flow.timezone === undefined || !!input.birth.timeZoneId, '流曜 timezone 仅用于选择 IANA 时区回拨时刻。')
  .describe('七政四余出生范围：逐秒分页比较本命和指定时点流曜，终点不含，最多两小时。');

const ziweiTopics = z.enum(['life', 'destiny', 'relationship', 'relationship-push', 'relationship-decision', 'children', 'career-wealth', 'job-change', 'startup-partnership', 'investment-partnership', 'recent', 'family', 'home-move', 'settle-relocate', 'social', 'emotion', 'health', 'study', 'study-advance', 'exam-landing', 'reconciliation-decision', 'growth', 'talent', 'chat']);
const ziweiSchools = uniqueArray(z.array(z.enum(['sanhe', 'feixing', 'sihua', 'zhongzhou'])).max(4), '解读流派不得重复。');

export const ziweiIndependentInput = z.object({
  ...base, question: requiredQuestion,
  birth: baziBirth,
  gender: z.enum(['male', 'female']),
  referenceTime: isoTime.optional().describe('运限参考瞬时；按出生地时区转换为当地日期与时辰。'),
  includeTimeline: z.boolean().optional().describe('是否附带十二大限时间线；默认 false。'),
  rules: z.object({
    algorithm: z.enum(['default', 'zhongzhou', 'beipai']).optional().describe('安星流派：default 为通行全书版，zhongzhou 为中州派，beipai 为北派飞星精简。'),
    mutagenSchool: z.enum(['default', 'zhongzhou', 'quanshu', 'tianfu']).optional().describe('四化口诀流派：default 为通行/飞星主流，zhongzhou 为中州派（庚阳武同相），quanshu 为《全书》古法，tianfu 为天府化科派。'),
    fixLeap: z.boolean().optional(),
    leapMonthMode: z.enum(['split-15', 'same', 'next']).optional().describe('闰月折算口径：split-15 为十五日前按本月、后按下月（默认），same 为沿用本月，next 为闰月全按次月处理。'),
    plateType: z.enum(['heaven', 'earth', 'human']).optional().describe('天地人三盘：heaven 为天盘（命宫立极，默认），earth 为地盘（身宫立极），human 为人盘（福德宫立极）。'),
    tianmaMode: z.enum(['year', 'month']).optional().describe('天马起法：year 为按生年地支起年马（默认），month 为按生月地支起月马。'),
    yearDivide: z.enum(['normal', 'exact']).optional(),
    horoscopeDivide: z.enum(['normal', 'exact']).optional(),
    ageDivide: z.enum(['normal', 'birthday']).optional().describe('虚岁/小限年龄分界口径：normal 为按农历新年换岁（默认），birthday 为按公历出生日换岁。'),
    dayDivide: z.enum(['current', 'forward']).optional(),
  }).strict().optional(),
  prompt: z.object({
    scope: z.enum(['origin', 'full', 'decadal', 'yearly', 'monthly', 'daily', 'hourly', 'age']).optional(),
    topic: ziweiTopics.optional(),
    schools: ziweiSchools.optional(),
    includeClassics: z.boolean().optional(),
    candidateIndex: z.number().int().min(0).max(200).optional().describe('出生时间不确定时选择一个候选，省略时比较全部候选。'),
  }).strict().optional(),
}).strict().refine((input) => !input.prompt?.scope || input.prompt.scope === 'origin' || !!input.referenceTime, '选择运限层级必须提供 referenceTime。')
  .refine((input) => input.birth.clock.kind !== 'exact' || input.prompt?.candidateIndex === undefined, '精确出生不接受候选索引。')
  .describe('独立紫微预览：精确或不确定出生、本命十二宫、星曜四化和指定瞬时运限。');

const ziweiIndependentPerson = z.object({
  name: z.string().trim().min(1).max(100).optional(), birth: ziweiIndependentInput.shape.birth,
  gender: ziweiIndependentInput.shape.gender, rules: ziweiIndependentInput.shape.rules,
  candidateIndex: z.number().int().min(0).max(200).optional().describe('可选：聚焦出生时段候选；精确出生不接受。'),
}).strict().refine((person) => person.birth.clock.kind !== 'exact' || person.candidateIndex === undefined, '精确出生不接受候选索引。');

const syncYearsSchema = z.object({
  startYear: z.number().int().min(1900).max(2100),
  endYear: z.number().int().min(1900).max(2100),
}).strict().refine((v) => v.endYear >= v.startYear && v.endYear - v.startYear <= 9, '流年同步范围须在 1 至 10 年之间。');

export const ziweiSynastryIndependentInput = z.object({
  ...base, question: requiredQuestion, person1: ziweiIndependentPerson, person2: ziweiIndependentPerson,
  relationship: z.enum(['marriage', 'career', 'friendship', 'children', 'parents', 'siblings']).optional(),
  referenceTime: isoTime.optional().describe('运限合参参考瞬时；按双方出生地时区转换为当地日期与时辰。'),
  syncYears: syncYearsSchema.optional().describe('可选双人多年流年与大限同步对比（最多 10 年）；须选定双方出生盘。'),
  compareCandidates: z.boolean().optional().describe('比较全部出生候选组合；一方未指定候选时默认启用。'),
  comparisonPage: z.object({ offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(200).optional() }).strict().optional().describe('候选变化事实分页；默认从 0 开始，每页 100 条。'),
  prompt: z.object({ schools: ziweiSchools.optional(), detailMode: z.enum(['compact', 'full']).optional(), includeClassics: z.boolean().optional() }).strict().optional(),
}).strict().refine((input) => input.compareCandidates !== false || [input.person1, input.person2].every((person) => person.birth.clock.kind === 'exact' || person.candidateIndex !== undefined), '不比较全部候选时，每位出生时间不确定的人须指定 candidateIndex。')
  .refine((input) => input.compareCandidates !== false || input.comparisonPage === undefined, '关闭候选比较时不能提供比较分页。')
  .describe('独立紫微双盘：双方同支宫位、生年四化跨盘定位与出生候选组合比较。');

export const baziZiweiIndependentInput = z.object({
  ...base, question: requiredQuestion, birth: baziBirth, gender: z.enum(['male', 'female']),
  referenceTime: wholeSecondIso('运限参考时刻须为整秒。').optional(),
  ziweiRules: ziweiIndependentInput.shape.rules,
  prompt: z.object({
    topic: z.enum(['overview', 'character', 'career', 'wealth', 'relationships', 'family', 'wellbeing', 'mobility', 'inner-world', 'timing']).optional(),
    detailLevel: z.enum(['concise', 'standard', 'professional']).optional(),
    baziSchools: uniqueArray(z.array(z.enum(['ziping', 'mangpai', 'xinpai', 'tiaohou', 'geju'])).max(5), '八字流派不得重复。').optional(),
    ziweiSchools: uniqueArray(z.array(z.enum(['sanhe', 'feixing', 'sihua', 'zhongzhou'])).max(4), '紫微流派不得重复。').optional(),
    includeClassics: z.boolean().optional(),
    candidateIndex: z.number().int().min(0).max(200).optional().describe('出生时段不确定时聚焦一个八字、紫微时间交集候选。'),
  }).strict().optional(),
}).strict().refine((input) => input.birth.clock.kind !== 'exact' || input.prompt?.candidateIndex === undefined, '精确出生不接受候选索引。')
  .describe('独立八字紫微合参：共用出生瞬时，未知时辰按两套分段的真实时间交集匹配。');

const astroBirth = z.object({
  name: z.string().max(100).optional(), gender: z.enum(['male', 'female']).optional(),
  year: z.number().int(), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59), second: z.number().int().min(0).max(59).optional(),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  timezone: z.number().min(-12).max(14).optional(), timeZoneId: z.string().min(1).optional(),
  locationName: z.string().max(200).optional(), useTrueSolarTime: z.boolean().optional(),
  coordinateAccuracy: z.enum(['user-provided', 'administrative-center', 'province-approximation', 'mixed']).optional(),
}).strict().refine((value) => value.timezone !== undefined || value.timeZoneId !== undefined, '需要提供时区偏移或 IANA 时区名');
const astroSchools = z.array(z.enum(['modern', 'traditional', 'hellenistic', 'timing'])).max(4).optional();
const astroTopics = z.enum(['life', 'career', 'job-change', 'startup-partnership', 'investment-partnership', 'wealth', 'relationship', 'relationship-push', 'relationship-decision', 'reconciliation-decision', 'marriage', 'children', 'family', 'home-move', 'settle-relocate', 'social', 'emotion', 'growth', 'talent', 'health', 'study', 'study-advance', 'exam-landing', 'recent', 'chat']);

const astroHouseSystems = z.enum(['placidus', 'whole_sign', 'equal', 'koch', 'porphyry', 'regiomontanus', 'campanus', 'alcabitius', 'morinus', 'meridian', 'polich_page', 'vehlow']);

export const astrolabeIndependentInput = z.object({
  ...base, question: requiredQuestion,
  birth: astroBirth.refine((value) => value.year >= 1900 && value.year <= 2100, '本命预览支持 1900 至 2100 年。'),
  options: z.object({ houseSystem: astroHouseSystems.optional(), includeAsteroids: z.boolean().optional() }).strict().optional(),
  flow: z.object({
    reference: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('instant'), at: wholeSecondIso('参考时刻须精确到秒。') }).strict(),
      z.object({ kind: z.literal('year'), year: z.number().int().min(1900).max(2100) }).strict(),
      z.object({ kind: z.literal('month'), year: z.number().int().min(1900).max(2100), month: z.number().int().min(1).max(12) }).strict(),
      z.object({ kind: z.literal('day'), year: z.number().int().min(1900).max(2100), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) }).strict(),
    ]),
    techniques: uniqueArray(z.array(z.enum(['transit', 'solar-return', 'secondary', 'solar-arc'])).min(1).max(4), '推运方法不能重复。').optional(),
    solarReturnLocation: z.object({ latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180) }).strict().optional().describe('返照盘使用的地点经纬度；省略时使用出生地。仅影响返照盘宫位，不改变返照瞬时。'),
    period: z.object({
      start: wholeSecondIso('周期起点须精确到秒。'),
      end: wholeSecondIso('周期终点须精确到秒，不含终点。'),
      cursor: wholeSecondIso('续取游标须精确到秒。').optional(),
      pageDays: z.number().int().min(1).max(7).optional().describe('每页最多 7 个 UTC 日；用 nextCursor 续取。'),
      kinds: uniqueArray(z.array(z.enum(['transit_aspect', 'sky_aspect', 'station', 'sign_ingress', 'house_ingress', 'moon_phase', 'eclipse'])).min(1).max(7), '事件类型不能重复。').optional(),
      bodies: uniqueArray(z.array(z.enum(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'true_node'])).min(1).max(11), '流运行星不能重复。').optional(),
    }).strict().optional().describe('可选周期扫描，半开窗口最多 370 日，每页最多 7 日。'),
  }).strict().refine((value) => !value.solarReturnLocation || !value.techniques || value.techniques.includes('solar-return'), '返照地点仅适用于选择太阳返照的推运。').optional(),
  prompt: z.object({ topic: astroTopics.optional(), schools: astroSchools, eventDetail: z.enum(['summary', 'full']).optional(), includeClassics: z.boolean().optional() }).strict().optional(),
}).strict().describe('独立西洋星盘预览：本命与指定参考时点的行运、返照、次限和太阳弧。');

export const astrolabeRangeInput = z.object({
  ...base, question: requiredQuestion,
  birth: astrolabeIndependentInput.shape.birth,
  options: astrolabeIndependentInput.shape.options,
  flow: astrolabeIndependentInput.shape.flow,
  prompt: astrolabeIndependentInput.shape.prompt,
  range: z.object({
    start: wholeSecondIso('范围起点须精确到秒。'),
    end: wholeSecondIso('范围终点须精确到秒，不含终点。'),
    cursor: z.number().int().min(0).optional().describe('从起点算起的秒数，使用返回的 nextCursor。'),
    pageSize: z.number().int().min(1).max(20).optional().describe('本命每页最多 20 秒；推运最多 2 秒，周期事件最多 1 秒。'),
  }).strict(),
}).strict().refine((value) => !value.flow || (value.range.pageSize ?? 1) <= 2, '出生范围附加推运时每页最多 2 秒。')
  .refine((value) => !value.flow?.period || (value.range.pageSize ?? 1) === 1, '出生范围附加周期事件时每页只能计算 1 秒。')
  .refine((value) => !value.flow?.period || value.flow.period.pageDays === 1, '出生范围附加周期事件时，period.pageDays 须为 1。')
  .describe('西洋星盘出生范围逐秒分页；连续变化与离散分支分开记录。');

const astroPointId = z.enum(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'chiron', 'ceres', 'pallas', 'juno', 'vesta', 'true_node', 'south_node', 'true_lilith', 'fortune', 'spirit', 'asc', 'mc', 'desc', 'ic']);
export const astrolabeSynastryIndependentInput = z.object({
  ...base, question: requiredQuestion,
  person1: astrolabeIndependentInput.shape.birth, person2: astrolabeIndependentInput.shape.birth,
  referenceTime: wholeSecondIso('推运参考时刻须精确到秒。').optional().describe('可选双人行运参考时刻；提供时计算该时刻流年天象（Transit）并分别比对双方本命计算点。'),
  syncYears: syncYearsSchema.optional().describe('可选双人多年外行星行运同步对比（最多 10 年）。'),
  options: z.object({
    houseSystem: astroHouseSystems.optional(),
    points: uniqueArray(z.array(astroPointId).min(1).max(24), '计算点不能重复。').optional(),
    aspectOrbs: z.object({ conjunction: z.number().positive().max(15).optional(), sextile: z.number().positive().max(15).optional(), square: z.number().positive().max(15).optional(), trine: z.number().positive().max(15).optional(), opposition: z.number().positive().max(15).optional() }).strict().optional(),
    includeHouseOverlays: z.boolean().optional(),
    includeComposite: z.boolean().optional().describe('是否计算双方最短圆弧中点组合盘（Composite Chart）及组合盘内部相位；默认开启。'),
    maxAspects: z.number().int().min(1).max(200).optional(),
  }).strict().optional(),
  prompt: z.object({ schools: astroSchools, includeClassics: z.boolean().optional() }).strict().optional(),
}).strict().describe('独立西洋双盘：五种跨盘相位、双向落宫、传统入庙互溶与接纳、组合中点盘及可选双人行运合参。');

export const baziIndependentInput = z.object({
  ...base, question: requiredQuestion,
  birth: baziBirth.optional(),
  birthRange: baziBirthRange.optional().describe('出生时间半开范围，最长两小时；可直接使用四柱反推结果。'),
  gender: z.enum(['male', 'female']).optional().describe('提供精确出生时分秒及性别时计算大运；元辰神煞需提供性别。'),
  referenceTime: isoTime.optional().describe('整秒运限参考时刻；须有性别与精确出生时间。'),
  timelineYear: z.number().int().min(1900).max(2199).optional().describe('可选按立春年查询一年的流月与大运；须提供性别和精确出生时间。'),
  rules: z.object({
    yearBoundary: z.enum(['lichun', 'lunar-new-year', 'dongzhi']).optional().describe('年柱换年口径：默认 lichun（立春换年）；lunar-new-year 为正月初一；dongzhi 为冬至换年。'),
    ziHourMode: z.enum(['23:00', 'split-zi']).optional().describe('早晚子时换日口径：默认 23:00（23点换次日日柱）；split-zi 为分早晚子时（23–24点晚子保留当日日柱，时干按五鼠遁）。'),
    nightZiStemMode: z.enum(['next-day', 'current-day']).optional().describe('晚子时（23–24点）五鼠遁起时干口径：默认 next-day（按次日日干）；current-day 为按当日日干起时干。'),
    solarTermMode: z.enum(['exact-instant', 'civil-day']).optional().describe('节气历法口径：默认 exact-instant（定气交节精确瞬时）；civil-day 为交节当日整日换月。'),
    patternMode: z.enum(['standard', 'main-qi-first', 'special-first']).optional().describe('格局取法口径：默认 standard（先特殊格后普通格）；main-qi-first 为月令本气优先；special-first 为外格优先。'),
    includeExtraPalaces: z.boolean().optional().describe('是否计算八字命宫、身宫、胎元与胎息（默认开启）。'),
    mingGongMethod: z.enum(['traditional', 'solar-position']).optional().describe('命宫推算口径：默认 traditional（卯宫安命）；solar-position 为按太阳过宫校正。'),
    kongWangMode: z.enum(['day', 'day-and-year']).optional().describe('旬空查法：默认 day（仅以日柱查旬空）；day-and-year 为年日互换兼查年柱旬空。'),
    fortuneRule: z.enum(['exact-3days', 'round-day']).optional().describe('大运起运折算口径：默认 exact-3days（按交节时差精确到分秒折算）；round-day 为按整日取整折算（三日一年，不计余时）。'),
    yangRenMode: z.enum(['all-stems', 'yang-only', 'all-stems-guandai']).optional().describe('羊刃查法口径：默认 all-stems（十干皆按阳顺阴逆帝旺位取刃）；yang-only 为子平正统五阳干有刃、五阴干无刃；all-stems-guandai 为五阴干顺取冠带位（辰未戌丑）。'),
    commanderMode: z.enum(['standard', 'yuanhai']).optional().describe('月令人元司令分野表：默认 standard（通会/滴天髓折中表）；yuanhai 为《渊海子平·详论节气歌》古法（四孟月 7/5/18）。'),
    earthRule: z.enum(['follow-fire', 'follow-water', 'independent']).optional().describe('十二长生土行寄生口径：默认 follow-fire（火土同宫）；follow-water 为水土同宫（戊申己卯）；independent 为土独立顺行。'),
  }).strict().optional(),
  prompt: z.object({ topic: z.enum(baziTopicIds).optional(), schools: z.array(z.enum(baziSchoolIds)).max(5).optional(), detailMode: z.enum(['compact', 'full']).optional(), includeClassics: z.boolean().optional(),
    scope: z.enum(['natal', 'full', 'dayun', 'year', 'month', 'day', 'hour']).optional().describe('默认 full；选择具体岁运层级需要已保存的 referenceTime。') }).strict().optional(),
}).strict().refine((value) => !!value.birth !== !!value.birthRange, '出生资料与出生范围必须且只能提供一种')
  .refine((value) => !value.referenceTime || (value.gender !== undefined && value.birth?.clock.kind === 'exact' && Date.parse(value.referenceTime) % 1000 === 0), '指定岁运时刻需要性别、精确出生时分秒和整秒参考时刻')
  .refine((value) => value.timelineYear === undefined || (value.gender !== undefined && value.birth?.clock.kind === 'exact'), '查询流月时间线需要性别和精确出生时分秒')
  .describe('八字排盘：birth 与 birthRange 必须且只能提供一种；支持四柱、十神、旺衰格局、调候用神裁定、大运流年流月与 55 项本命神煞（出生范围不计算精确起运及岁运）。');

const baziIndependentPerson = baziBirth.safeExtend({
  name: z.string().trim().min(1).max(100).optional(),
  gender: z.enum(['male', 'female']).optional().describe('可选；用于本命神煞中的元辰，不提供时元辰未计算。'),
  candidateIndex: z.number().int().min(0).optional().describe('可选：从 0 开始选择出生时段候选；不选择时比较全部候选，精确时刻不可提供。'),
}).refine((value) => value.clock.kind !== 'exact' || value.candidateIndex === undefined, '精确时刻不接受候选索引。');

export const baziSynastryIndependentInput = z.object({
  ...base, question: requiredQuestion, person1: baziIndependentPerson, person2: baziIndependentPerson,
  relationship: z.enum(['marriage', 'career', 'friendship', 'children', 'parents', 'siblings']).optional(),
  referenceTime: wholeSecondIso('运限参考时刻须为整秒。').optional().describe('可选岁运合参参考时刻；须双方均提供精确出生时分秒与性别。'),
  syncYears: z.object({
    startYear: z.number().int().min(1900).max(2100),
    endYear: z.number().int().min(1900).max(2100),
  }).strict().refine((v) => v.endYear >= v.startYear && v.endYear - v.startYear <= 9, '流年同步范围须在 1 至 10 年之间。').optional().describe('可选双人多年流年同步对比（最多 10 年）；须双方均提供精确出生时分秒与性别。'),
  compareCandidates: z.boolean().optional().describe('比较双方全部出生候选组合；一方未选择候选或提供 comparisonPage 时默认启用。'),
  comparisonPage: z.object({ offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(200).optional() }).strict().optional().describe('候选变化事实分页；默认从 0 开始，每页 100 条。'),
  prompt: z.object({ schools: z.array(z.enum(baziSchoolIds)).max(5).optional(), detailMode: z.enum(['compact', 'full']).optional(), includeClassics: z.boolean().optional() }).strict().optional(),
}).strict().refine((input) => input.compareCandidates !== false || [input.person1, input.person2].every((person) => person.clock.kind === 'exact' || person.candidateIndex !== undefined), '关闭全部候选比较时，每位出生时间不确定的人须指定 candidateIndex。')
  .refine((input) => input.compareCandidates !== false || input.comparisonPage === undefined, '关闭候选比较时不能提供比较分页。')
  .refine((input) => !input.referenceTime || ([input.person1, input.person2].every((person) => person.clock.kind === 'exact' && person.gender !== undefined)), '指定双人岁运参考时刻需要双方均提供性别与精确出生时分秒。')
  .refine((input) => !input.syncYears || ([input.person1, input.person2].every((person) => person.clock.kind === 'exact' && person.gender !== undefined)), '指定双人流年同步范围需要双方均提供性别与精确出生时分秒。')
  .describe('独立八字双人合盘预览：精确时刻或出生候选组合比较，支持双方用神覆盖与可选岁运合参。');

export const mingluInput = z.object({
  ...base,
  question: requiredQuestion,
  birth: baziBirth.optional(),
  birthRange: baziBirthRange.optional(),
  gender: z.enum(['male', 'female']).optional(),
  referenceTime: isoTime.optional(),
  timelineYear: z.number().int().min(1900).max(2199).optional(),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    locationName: z.string().max(200).optional(),
  }).strict().optional().describe('可选出生地经纬度；提供精确公历出生与经纬度时自动聚合西洋星盘。'),
  ziweiRules: ziweiIndependentInput.shape.rules,
  house: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('mountain'), sitMountain: z.string().length(1) }).strict(),
    z.object({ kind: z.literal('measurement'), reading: z.enum(['sit', 'door-to-interior']), degree: z.number().min(0).max(360), northReference: z.enum(['unspecified', 'true', 'magnetic']).optional(), magneticDeclinationDegrees: z.number().min(-30).max(30).optional(), uncertaintyDegrees: z.number().min(0).max(45).optional() }).strict(),
  ]).optional(),
  include: z.object({
    all: z.boolean().optional().describe('一键启用全部可算体系（八字、紫微、西洋星盘、七政四余、奇门终身局、八宅命卦）。'),
    ziwei: z.boolean().optional(),
    astrolabe: z.boolean().optional(),
    qizheng: z.boolean().optional(),
    qimenLifetime: z.boolean().optional(),
    bazhai: z.boolean().optional(),
  }).strict().optional(),
  prompt: z.object({
    topic: z.enum(['overview', 'career', 'wealth', 'relationships', 'family', 'health', 'timing']).optional(),
    detailMode: z.enum(['compact', 'full']).optional(),
    includeClassics: z.boolean().optional(),
  }).strict().optional(),
}).strict()
  .refine((value) => !!value.birth !== !!value.birthRange, '出生资料与出生范围必须且只能提供一种')
  .refine((value) => !value.referenceTime || (value.gender !== undefined && value.birth?.clock.kind === 'exact' && Date.parse(value.referenceTime) % 1000 === 0), '指定岁运时刻需要性别、精确出生时分秒和整秒参考时刻')
  .refine((value) => value.timelineYear === undefined || (value.gender !== undefined && value.birth?.clock.kind === 'exact'), '查询流月时间线需要性别和精确出生时分秒')
  .describe('命录综合资料：以八字为基础，按实际资料按需聚合紫微、西洋星盘与八宅命卦，生成分节 Markdown 与提示词；不生成旧版加权评分。');

export const fortuneInput = z.object({
  ...base,
  question: requiredQuestion,
  scope: z.enum(['daily', 'monthly', 'yearly']).optional().describe('运势周期：daily 日运（默认）、monthly 月运、yearly 年运。'),
  target: z.object({
    year: z.number().int().min(1900).max(2100),
    month: z.number().int().min(1).max(12).optional(),
    day: z.number().int().min(1).max(31).optional(),
  }).strict().optional().describe('目标公历日期/月份/年份；省略时按当前北京时间定位。'),
  birth: baziBirth.optional().describe('可选个人出生资料；提供时生成结合个人命局喜忌、紫微流运与星盘行运的定制运势。'),
  birthRange: baziBirthRange.optional().describe('可选出生时间范围；提供时对各候选时段比较通用共性与差异。'),
  gender: z.enum(['male', 'female']).optional(),
  caseName: z.string().trim().min(1).max(100).optional().describe('可选案例名称，用于定制化报告与提示词称呼。'),
  location: z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    locationName: z.string().trim().min(1).max(200).optional(),
  }).strict().optional().describe('可选出生地经纬度；提供精确公历出生与经纬度时叠加西洋星盘行运。'),
  prompt: z.object({
    topic: z.enum(['general', 'career', 'wealth', 'relationship', 'academic', 'health', 'decision']).optional(),
    detailMode: z.enum(['compact', 'full']).optional(),
    includeClassics: z.boolean().optional(),
  }).strict().optional(),
}).strict()
  .refine((value) => !(value.birth && value.birthRange), '出生资料与出生范围不能同时提供')
  .refine((value) => {
    if (!value.target) return true;
    const scope = value.scope ?? 'daily';
    if (scope === 'daily') return value.target.month !== undefined && value.target.day !== undefined;
    if (scope === 'monthly') return value.target.month !== undefined;
    return true;
  }, '日运目标需提供年/月/日，月运目标需提供年/月')
  .describe('运势推演（日运/月运/年运）：支持通用流时运势与选择个人案例的定制化运势，提供本地算法五维速览、时间轴趋势与定制 AI 报告提示词。');
