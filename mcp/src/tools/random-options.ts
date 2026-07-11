import { z } from 'zod';
import type { RandomOptions } from 'mingyu-core/types';

export const randomOptionShape = {
  seed: z
    .union([z.string().min(1).max(256), z.number().finite()])
    .optional()
    .describe('随机种子'),
  replay: z
    .array(z.number().min(0).lt(1))
    .min(1)
    .max(256)
    .optional()
    .describe('从结果 meta.random.samples 保存的样本，用于完整重放'),
};

export function readMcpRandomOptions(args: {
  seed?: string | number;
  replay?: number[];
}): RandomOptions | undefined {
  if (args.seed !== undefined && args.replay !== undefined) {
    throw new Error('seed 与 replay 只能提供一个。');
  }
  return args.seed !== undefined || args.replay !== undefined
    ? { seed: args.seed, replay: args.replay }
    : undefined;
}

export function assertMcpNoRandomOptions(
  args: { seed?: string | number; replay?: number[] },
  message: string,
): void {
  if (args.seed !== undefined || args.replay !== undefined) throw new Error(message);
}
