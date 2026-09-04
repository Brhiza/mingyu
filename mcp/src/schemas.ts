import { z } from 'zod';
import { RESULT_DETAIL_MODES } from '../../src/lib/result-detail.js';

export const calculationDetailShape = {
  detailMode: z
    .enum(RESULT_DETAIL_MODES)
    .optional()
    .describe('返回细节：默认 compact 精简证据噪音；full 返回完整证据链和计算过程'),
};

/**
 * 统一出生参数输入契约 (BirthInputSchema)
 */
export const birthInputShape = {
  year: z.number().int().min(1900).max(2100).describe('出生年份（公历或农历年份，四位数字）'),
  month: z.number().int().min(1).max(12).describe('出生月份（1-12）'),
  day: z.number().int().min(1).max(31).describe('出生日期（1-31）'),
  dateType: z
    .enum(['solar', 'lunar'])
    .optional()
    .describe('历法类型：solar 公历（默认），lunar 农历'),
  isLeapMonth: z.boolean().optional().describe('是否为农历闰月，默认 false'),
  gender: z.enum(['male', 'female', '男', '女']).optional().describe('性别：male/男 或 female/女'),
  timeIndex: z
    .number()
    .int()
    .min(0)
    .max(12)
    .optional()
    .describe('出生时辰序号（0-12），未知时可省略以进行三柱降级分析'),
  birthHour: z.number().int().min(0).max(23).optional().describe('出生小时（0-23）'),
  birthMinute: z.number().int().min(0).max(59).optional().describe('出生分钟（0-59）'),
  birthLongitude: z.number().min(-180).max(180).optional().describe('出生地经度（-180至180）'),
  birthLatitude: z.number().min(-90).max(90).optional().describe('出生地纬度（-90至90）'),
  birthPlace: z.string().optional().describe('出生地地名（如“北京市东城区”）'),
  timezone: z.number().min(-12).max(14).optional().describe('时区偏移量（默认 8）'),
  timeZoneId: z.string().optional().describe('IANA 时区标识符（如 Asia/Shanghai）'),
  useTrueSolarTime: z.boolean().optional().describe('是否启用真太阳时校正，默认 false'),
  applyChinaDst: z.boolean().optional().describe('是否考虑中国历史夏令时，默认 false'),
};

export const birthInputSchema = z.object(birthInputShape);

export function withErrorOutputSchema<T extends z.ZodRawShape>(successShape: T) {
  const enhancedSuccessShape: z.ZodRawShape = {
    ...successShape,
    meta: z.record(z.string(), z.unknown()).optional().describe('元数据（耗时、工具名称、版本等）'),
    warnings: z.array(z.string()).optional().describe('非阻断性预警或降级说明'),
  };
  const successSchema = z.strictObject(enhancedSuccessShape);
  const optionalSuccessShape: Record<string, z.ZodTypeAny> = {};
  for (const [key, schema] of Object.entries(enhancedSuccessShape)) {
    optionalSuccessShape[key] = z.optional(schema as z.ZodTypeAny);
  }

  return z
    .strictObject({
      ...optionalSuccessShape,
      error: z.string().optional().describe('业务错误信息'),
      code: z.string().optional().describe('结构化业务错误码'),
      missingFields: z.array(z.string()).optional().describe('缺失的必填字段列表'),
      retryable: z.boolean().optional().describe('是否支持带参重试'),
      fallback: z.string().optional().describe('业务降级建议或后备策略说明'),
    })
    .refine(
      (value) => {
        const record = value as Record<string, unknown>;
        if (typeof record.error === 'string') {
          return Object.keys(successShape).every((key) => !(key in value));
        }
        return successSchema.safeParse(value).success;
      },
      { message: '输出必须是完整成功结果或仅包含 error 的业务错误' },
    );
}

export const resultOutputSchema = withErrorOutputSchema({
  result: z.unknown().describe('工具返回的结构化结果'),
});

export const promptOutputSchema = withErrorOutputSchema({
  prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
});

export const ziweiOutputSchema = withErrorOutputSchema({
  basicInfo: z.record(z.string(), z.unknown()).describe('紫微命盘基础信息'),
  calculationConfig: z.record(z.string(), z.unknown()).describe('本次实际采用的紫微排盘口径'),
  scopeNames: z.array(z.string()).describe('本次返回包含的运限范围'),
  payloadByScope: z.record(z.string(), z.unknown()).describe('按运限范围组织的紫微分析载荷'),
  trueSolarEvidence: z.unknown().optional().describe('真太阳时校正证据'),
  birthMutagens: z.record(z.string(), z.string()).optional().describe('生年四化'),
  fourMutagens: z.record(z.string(), z.string()).optional().describe('命宫四化'),
  gongList: z.array(z.record(z.string(), z.unknown())).optional().describe('十二宫星曜列表'),
  命宫: z.string().optional().describe('命宫宫名'),
  身宫: z.string().optional().describe('身宫宫名'),
  五行局: z.string().optional().describe('五行局'),
  四化: z.record(z.string(), z.string()).optional().describe('生年四化映射'),
});
