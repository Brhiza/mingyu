import { applyOutputLanguageToPrompt, normalizeOutputLanguage } from './output-language';
import { applyPromptGuidance } from './prompt-guidance';
import { applyPromptProfileToPrompt, resolveEffectivePromptProfile } from './prompt-profile';
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
  const savedInput = data.input && typeof data.input === 'object' && !Array.isArray(data.input)
    ? (data.input as Record<string, unknown>)
    : undefined;
  const anchorRef =
    (typeof savedInput?.referenceTime === 'string' && savedInput.referenceTime.trim()
      ? savedInput.referenceTime
      : undefined)
    ?? (savedInput?.flow && typeof savedInput.flow === 'object' && typeof (savedInput.flow as { year?: unknown }).year === 'number'
      ? String((savedInput.flow as { year: number }).year)
      : undefined)
    ?? (savedInput?.target && typeof savedInput.target === 'object' && typeof (savedInput.target as { year?: unknown }).year === 'number'
      ? String((savedInput.target as { year: number }).year)
      : undefined)
    ?? currentTime;
  const promptProfile = resolveEffectivePromptProfile(promptOptions, context?.promptProfile);
  const includeClassics = Boolean(
    promptOptions
    && typeof promptOptions === 'object'
    && !Array.isArray(promptOptions)
    && (promptOptions as { includeClassics?: unknown }).includeClassics === true,
  );
  const skipGuidance = promptProfile === 'agent' || promptProfile === 'ultra-compact';
  const effectiveOutputLanguage = normalizeOutputLanguage(
    request.outputLanguage !== undefined ? request.outputLanguage : request.result.outputLanguage,
  );
  const prompt = applyOutputLanguageToPrompt(
    applyPromptProfileToPrompt(
      skipGuidance
        ? rawPrompt
        : applyPromptGuidance(
            guidanceMethod,
            rawPrompt,
            request.question,
            context?.promptGuidance,
            anchorRef,
          ),
      promptProfile,
      { includeClassics },
    ),
    effectiveOutputLanguage,
    guidanceMethod,
  );
  return {
    version: '2.0.0',
    method: request.method,
    currentTime,
    source: 'caller-supplied-result',
    prompt,
    ...(effectiveOutputLanguage ? { outputLanguage: effectiveOutputLanguage } : {}),
  };
}
