import { z } from 'zod';

export const resultOutputSchema = {
  result: z.unknown().describe('工具返回的结构化结果'),
};

export const promptOutputSchema = {
  result: z.unknown().describe('工具返回的结构化结果'),
  prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
};

export const ziweiOutputSchema = {
  generation: z.record(z.string(), z.unknown()).describe('紫微可信出生来源、排盘口径与生成上下文'),
  basicInfo: z.record(z.string(), z.unknown()).describe('紫微命盘基础信息'),
  calculationConfig: z.record(z.string(), z.unknown()).describe('本次实际采用的紫微排盘口径'),
  scopeNames: z.array(z.string()).describe('本次返回包含的运限范围'),
  payloadByScope: z.record(z.string(), z.unknown()).describe('按运限范围组织的紫微分析载荷'),
  birthMutagens: z.record(z.string(), z.string()).optional().describe('生年四化'),
  fourMutagens: z.record(z.string(), z.string()).optional().describe('命宫四化'),
  gongList: z.array(z.record(z.string(), z.unknown())).optional().describe('十二宫星曜列表'),
  命宫: z.string().optional().describe('命宫宫名'),
  身宫: z.string().optional().describe('身宫宫名'),
  五行局: z.string().optional().describe('五行局'),
  四化: z.record(z.string(), z.string()).optional().describe('生年四化映射'),
};
