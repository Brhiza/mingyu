import {
  buildMetaphysicsPrompt as buildCoreMetaphysicsPrompt,
  type MetaphysicsPromptMethod,
} from 'mingyu-core/prompt';

export type { MetaphysicsPromptMethod };

export interface MetaphysicsPromptOptions {
  method: MetaphysicsPromptMethod;
  measurement?: string;
  schools?: readonly string[];
  currentTime?: Date;
}

/** 页面兼容入口；元学提示词包装统一由 mingyu-core 提供。 */
export function buildMetaphysicsPrompt(
  basePrompt: string,
  question: string | undefined,
  options: MetaphysicsPromptOptions,
): string {
  return buildCoreMetaphysicsPrompt(basePrompt, question, options);
}
