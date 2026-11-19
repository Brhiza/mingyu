import type { z } from 'zod';
import type { RuntimeContext } from '../runtime-context';
import type { repromptInput } from '../schema';

type Request = z.output<typeof repromptInput>;
export type RepromptArgs = { request: Request; data: Request['result']['data']; currentTime: string; promptOptions: unknown; context?: RuntimeContext };
export type RepromptHandler = (args: RepromptArgs) => Promise<{ text: string }>;

export function requireSavedInput(data: Record<string, unknown>, message: string): asserts data is Record<string, unknown> & { input: Record<string, unknown> } {
  if (!data.input || typeof data.input !== 'object' || Array.isArray(data.input)) throw new Error(message);
}

export function rejectPromptOptions(value: unknown, message: string) {
  if (value !== undefined) throw new Error(message);
}
