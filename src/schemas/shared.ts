import { z } from 'zod';

export const isoTime = z.iso.datetime({ offset: true });
export const wholeSecondIso = (message: string) =>
  isoTime.refine((value) => Date.parse(value) % 1000 === 0, message);

export function uniqueArray<T extends z.ZodTypeAny>(schema: z.ZodArray<T>, message: string) {
  return schema.refine((items) => new Set(items).size === items.length, message);
}

export const question = z.string().max(2000).optional();
export const requiredQuestion = z.string().trim().min(1).max(2000);
export const base = { question, currentTime: isoTime.optional() };
export const safeInteger = z.number().int().min(Number.MIN_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER);

export const calendarClock = z.object({
  year: z.number().int().min(1900).max(2200), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31),
  hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59), second: z.number().int().min(0).max(59).optional(),
  timezone: z.number().min(-12).max(14).optional(), timeZoneId: z.string().trim().min(1).max(100).optional(),
}).strict();

export const divinationPrompt = {
  topicId: z.string().optional().describe('主题 ID；需符合该术数的提示词目录。'),
  subtopicId: z.string().optional().describe('子主题 ID，需属于所选主题。'),
  scope: z.string().optional().describe('解读范围 ID，需符合该术数的提示词目录。'),
  includeClassics: z.boolean().optional(),
};

export const divinationRange = z.object({
  start: isoTime.describe('含起点，必须携带 UTC 偏移，精度为整秒。'),
  end: isoTime.describe('不含终点，必须携带 UTC 偏移，区间最长两小时。'),
  pillars: z.object({ year: z.string().length(2), month: z.string().length(2), day: z.string().length(2), hour: z.string().length(2) }).strict().optional().describe('可选的四柱来源；区间内所有盘面必须一致。'),
}).strict().refine(({ start, end }) => {
  const a = Date.parse(start), b = Date.parse(end);
  return Number.isSafeInteger(a) && Number.isSafeInteger(b) && a % 1000 === 0 && b % 1000 === 0 && b > a && b - a <= 7200_000;
}, '范围须为整秒、起点在前且不超过两小时的半开区间');

export const baziBirth = z.object({
  year: z.number().int().min(1900).max(2100), month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31),
  clock: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('exact'), hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59), second: z.number().int().min(0).max(59) }).strict(),
    z.object({ kind: z.literal('shichen'), index: z.number().int().min(0).max(12) }).strict().describe('当地民用钟表时辰，0 为 00:00–01:00，1 至 11 为 01:00–23:00 的两小时段，12 为 23:00–24:00。'),
    z.object({ kind: z.literal('unknown') }).strict(),
  ]),
  calendar: z.enum(['solar', 'lunar']).optional(), leapMonth: z.boolean().optional(),
  timezone: z.number().min(-12).max(14).optional(), timeZoneId: z.string().trim().min(1).max(100).optional(),
  timeStandard: z.enum(['civil', 'true-solar']).optional(), longitude: z.number().min(-180).max(180).optional(),
}).strict().refine((value) => value.timeStandard === 'true-solar' ? value.longitude !== undefined : value.longitude === undefined, '真太阳时须提供经度；民用时间不接受经度');

export const baziBirthRange = z.object({
  start: isoTime.describe('范围起点，含；需带 UTC 偏移，精度为整秒。'), end: isoTime.describe('范围终点，不含；需带 UTC 偏移，最长两小时。'),
  timezone: z.number().min(-12).max(14).optional(), timeZoneId: z.string().trim().min(1).max(100).optional(),
  timeStandard: z.enum(['civil', 'true-solar']).optional(), longitude: z.number().min(-180).max(180).optional(),
  pillars: z.object({ year: z.string().length(2), month: z.string().length(2), day: z.string().length(2), hour: z.string().length(2) }).strict().optional().describe('可选四柱反推来源，仅用于标准北京时间；整个范围须与来源一致。'),
}).strict().refine(({ start, end }) => {
  const a = Date.parse(start), b = Date.parse(end);
  return Number.isSafeInteger(a) && Number.isSafeInteger(b) && a % 1000 === 0 && b % 1000 === 0 && b > a && b - a <= 7_200_000;
}, '出生范围须为整秒、起点在前且不超过两小时的半开区间')
  .refine((value) => value.timeZoneId === undefined || value.timezone === undefined, '出生范围只能选择固定偏移或 IANA 时区')
  .refine((value) => value.timeStandard === 'true-solar' ? value.longitude !== undefined : value.longitude === undefined, '真太阳时须提供经度；民用时间不接受经度')
  .refine((value) => !value.pillars || (value.timeZoneId === undefined && (value.timezone === undefined || value.timezone === 8) && value.timeStandard !== 'true-solar'), '四柱反推来源仅支持标准北京时间');
