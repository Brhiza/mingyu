import { z } from 'zod';
import { RESULT_DETAIL_MODES } from '../../src/lib/result-detail.js';

export const calculationDetailShape = {
  detailMode: z
    .enum(RESULT_DETAIL_MODES)
    .optional()
    .describe('返回细节：默认 compact 精简证据噪音；full 返回完整证据链和计算过程'),
};

export function withErrorOutputSchema<T extends z.ZodRawShape>(successShape: T) {
  const successSchema = z.strictObject(successShape);
  const optionalSuccessShape: Record<string, z.ZodType> = {};
  for (const [key, schema] of Object.entries(successShape)) {
    optionalSuccessShape[key] = z.optional(schema as z.ZodType);
  }

  return z
    .strictObject({
      ...optionalSuccessShape,
      error: z.string().optional().describe('业务错误信息'),
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
