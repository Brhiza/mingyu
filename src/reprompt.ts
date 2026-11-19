import { applyPromptGuidance } from './prompt-guidance';
import { repromptInput, type Method } from './schema';
import type { RuntimeContext } from './runtime-context';
import { referenceHandlers } from './reprompt/reference';
import { birthHandlers } from './reprompt/birth';
import { divinationHandlers } from './reprompt/divination';
import type { RepromptHandler } from './reprompt/shared';

const handlers = { ...referenceHandlers, ...birthHandlers, ...divinationHandlers } satisfies Record<Method, RepromptHandler>;

export async function reprompt(value: unknown, context?: RuntimeContext) {
  const request = repromptInput.parse(value);
  if (request.method !== request.result.method) throw new Error('术数与已有结果不一致。');
  const data = request.result.data;
  const currentTime = request.currentTime ?? new Date().toISOString();
  const promptOptions = request.prompt === undefined ? request.result.promptOptions : request.prompt;
  const rawPrompt = await handlers[request.method]({ request, data, currentTime, promptOptions, context });
  const guidanceMethod: Method =
    request.method === 'random-divination' && typeof data.selectedMethod === 'string'
      ? (data.selectedMethod as Method)
      : request.method;
  const prompt = applyPromptGuidance(
    guidanceMethod,
    rawPrompt,
    request.question,
    context?.promptGuidance,
  );
  return { version: '2.0.0', method: request.method, currentTime, source: 'caller-supplied-result', prompt };
}
