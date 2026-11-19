import { z } from 'zod';
import { base, baziBirth, requiredQuestion, uniqueArray } from './shared';

const degreeMeasurement = <T extends [string, ...string[]]>(readingValues: T) => z.object({
  kind: z.literal('degree'),
  reading: z.enum(readingValues),
  degree: z.number().min(0).max(360),
  northReference: z.enum(['unspecified', 'true', 'magnetic']).optional(),
  magneticDeclinationDegrees: z.number().min(-30).max(30).optional(),
  uncertaintyDegrees: z.number().min(0).max(45).optional(),
}).strict();

export const almanacInput = z.object({
  ...base, question: requiredQuestion,
  topic: z.enum(['move', 'marriage', 'opening', 'contract', 'travel', 'medical', 'study', 'burial', 'renovation', 'custom']),
  customKeyword: z.string().trim().min(1).max(20).optional().describe('自定义事项在黄历宜忌中的匹配词；仅 topic 为 custom 时提供。'),
  startDate: z.iso.date(), endDate: z.iso.date(),
  page: z.object({ offset: z.number().int().min(0).max(179).optional(), limit: z.number().int().min(1).max(180).optional() }).strict().optional().describe('按日期分页；offset 从 0 开始，limit 默认 7。省略 page 返回完整范围。'),
  participants: z.array(z.object({ name: z.string().trim().min(1).max(100), birth: baziBirth, gender: z.enum(['male', 'female']).optional() }).strict()).max(30).optional().describe('参与人的出生资料，年支与日支用于候选日及时辰冲突核对。'),
  includeBaziMatch: z.boolean().optional().describe('按需结合参与人精确出生八字喜用五行与避忌五行，匹配候选日与时辰干支五行并参与排序。'),
  includeMoonPhase: z.boolean().optional().describe('按需计算每日北京时间正午的月相背景；不参与择日初筛。'),
  weekendPreference: z.enum(['any', 'prefer', 'avoid']).optional(),
  timePreferences: uniqueArray(z.array(z.enum(['work-hours', 'morning', 'afternoon'])).max(3), '时段偏好不得重复').optional(),
  prompt: z.object({
    dates: uniqueArray(z.array(z.iso.date()).min(1).max(180), '日期不得重复').optional().describe('仅将选定日期写入提示词；分页时必须属于当前页，不改变计算结果。'),
    detailMode: z.enum(['compact', 'full']).optional().describe('compact 汇总各时辰初筛，full 展开全部依据；默认超过 7 天使用 compact。'),
    schools: uniqueArray(z.array(z.enum(['xiejibianfang', 'tongshu'])).max(2), '解读流派不得重复。').optional(),
    includeClassics: z.boolean().optional(),
  }).strict().optional(),
}).strict().refine((input) => input.topic === 'custom' ? input.customKeyword !== undefined : input.customKeyword === undefined, '仅自定义事项需要且允许提供 customKeyword').describe('黄历择日：综合宜忌、神煞、建除黄黑道、时段偏好、参与人关系及优选/次选/慎用分级；可按 page 分页，依据 nextOffset 获取全部日期。');

export const bazhaiInput = z.object({
  ...base, question: requiredQuestion,
  person: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('gua'), mingGua: z.enum(['坎', '艮', '震', '巽', '离', '坤', '兑', '乾']) }).strict(),
    z.object({ kind: z.literal('birth'), year: z.number().int().min(1900).max(2100), gender: z.enum(['male', 'female']), month: z.number().int().min(1).max(12).optional(), day: z.number().int().min(1).max(31).optional(),
      clock: z.object({ hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59), second: z.number().int().min(0).max(59) }).strict().optional(),
      timezone: z.number().min(-12).max(14).optional(), timeZoneId: z.string().trim().min(1).max(100).optional() }).strict(),
  ]),
  house: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('mountain'), sitMountain: z.string().length(1) }).strict(),
    z.object({ kind: z.literal('measurement'), reading: z.enum(['sit', 'door-to-interior']), degree: z.number().min(0).max(360), northReference: z.enum(['unspecified', 'true', 'magnetic']).optional(), magneticDeclinationDegrees: z.number().min(-30).max(30).optional(), uncertaintyDegrees: z.number().min(0).max(45).optional() }).strict(),
  ]).optional(),
  prompt: z.object({
    schools: uniqueArray(z.array(z.enum(['bazhaimingjing', 'yangzhaisanyao'])).max(2), '解读流派不得重复。').optional(),
    includeClassics: z.boolean().optional(),
  }).strict().optional(),
}).strict().describe('八宅预览：命卦、大游年、坐山和测量误差候选；不包含玄空与形峦。');

export const xuankongInput = z.object({
  ...base, question: requiredQuestion,
  construction: z.object({ year: z.number().int().min(1900).max(2100), month: z.number().int().min(1).max(12).optional(), day: z.number().int().min(1).max(31).optional() }).strict().describe('建造或起运公历年份；提供月日时以北京时间当地日核对立春。'),
  orientation: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('mountain'), sitMountain: z.string().length(1) }).strict(),
    degreeMeasurement(['sit', 'facing']),
  ]),
  mode: z.enum(['下卦', '替卦']).optional(),
  confirmJianXiang: z.boolean().optional().describe('替卦需显式确认已核定兼向；角度输入还须确保整个误差范围处于外侧三度。'),
  flow: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('year'), year: z.number().int().min(1900).max(2100) }).strict(),
    z.object({
      kind: z.literal('date'),
      year: z.number().int().min(1900).max(2100),
      month: z.number().int().min(1).max(12),
      day: z.number().int().min(1).max(31),
      hour: z.number().int().min(0).max(23).optional().describe('可选流时小时（0-23）；提供时同步排出流时紫白飞星。'),
    }).strict(),
  ]).optional(),
  prompt: z.object({
    schools: uniqueArray(z.array(z.enum(['shenshi', 'wuchang'])).max(2), '解读流派不得重复。').optional(),
    includeClassics: z.boolean().optional(),
  }).strict().optional(),
}).strict().describe('玄空飞星预览：下卦或已核定兼向替卦，支持坐向候选和流年流月；不含形峦或完整住宅合参。');

export const residentialInput = z.object({
  ...base, question: requiredQuestion, person: bazhaiInput.shape.person.optional(),
  orientation: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('mountain'), sitMountain: z.string().length(1) }).strict(),
    degreeMeasurement(['sit', 'facing', 'door-to-interior']),
  ]).optional(),
  construction: xuankongInput.shape.construction.optional(), mode: xuankongInput.shape.mode,
  confirmJianXiang: xuankongInput.shape.confirmJianXiang, flow: xuankongInput.shape.flow,
  prompt: z.object({
    schools: uniqueArray(z.array(z.enum(['bazhaimingjing', 'shenshi', 'hecan'])).max(3), '解读流派不得重复。').optional(),
    includeClassics: z.boolean().optional(),
  }).strict().optional(),
}).strict().refine((value) => value.person !== undefined || value.orientation !== undefined, '须提供居住人资料或住宅坐向。')
  .describe('住宅风水预览：组合八宅与玄空，建造年未知时不排玄空；不计算综合吉凶总分。');
