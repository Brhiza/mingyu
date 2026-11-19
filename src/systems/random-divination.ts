import type { z } from 'zod';
import type { randomDivinationInput } from '../schema';
import { randomDivinationLabels, randomDivinationMethods } from '../random-methods';
import type { RuntimeContext } from '../runtime-context';
import { randomContext } from './random';

type Input = z.infer<typeof randomDivinationInput>;
export type RandomDivinationMethod = typeof randomDivinationMethods[number];
type Prompt = { text: string };
type SelectedResult = { version: string; method: string; currentTime: string; data: object; summary: { lines: string[] } };
type RandomResult = { data: { selectedMethod: RandomDivinationMethod; candidates: RandomDivinationMethod[]; result: SelectedResult }; summary: { title: string; lines: string[] }; prompt: Prompt };
type Executor = (method: RandomDivinationMethod, input: unknown, context?: RuntimeContext) => Promise<SelectedResult & { prompt: Prompt }>;

export function randomCandidates(input: Input, context?: RuntimeContext) {
  const enabled = context?.enabledMethods;
  if (input.methods && enabled && input.methods.some((method) => !enabled.includes(method))) {
    throw new Error('候选术数包含当前服务未启用的方法。');
  }
  const candidates = (input.methods ?? randomDivinationMethods).filter((method) => !enabled || enabled.includes(method));
  if (!candidates.length) throw new Error('当前服务没有启用可供随机选择的术数。');
  return candidates;
}

export async function randomDivination(input: Input, currentTime: string, context: RuntimeContext | undefined, execute: Executor, randomSource?: () => number): Promise<RandomResult> {
  const candidates = randomCandidates(input, context);
  const selectedMethod = candidates[randomContext(randomSource).integer(candidates.length)];
  const common = { question: input.question, currentTime };
  // 太乙随机选择沿用年计，以北京时间所在公历年起局。
  const selectedInput = selectedMethod === 'taiyi'
    ? { ...common, taiyi: { scope: 'year', year: new Date(Date.parse(currentTime) + 8 * 3_600_000).getUTCFullYear() } }
    : common;
  const { prompt, ...result } = await execute(selectedMethod, selectedInput, context);
  return { data: { selectedMethod, candidates, result },
    summary: { title: `随机选用${randomDivinationLabels[selectedMethod]}`, lines: result.summary.lines }, prompt };
}
