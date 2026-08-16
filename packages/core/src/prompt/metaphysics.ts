import { formatPromptCurrentTime } from './current-time';
import { buildPromptDocument, buildPromptSection, joinPromptSections } from './sections';
import { buildPromptGuidance } from './guidance';
import { buildPromptSchoolSection } from './schools';
import type { PromptBuildOptions, PromptDocument } from './types';

export const METAPHYSICS_PROMPT_METHODS = [
  'bazhai',
  'residential',
  'zodiac',
  'taiyi',
  'qizheng',
  'xuankong',
] as const;

export type MetaphysicsPromptMethod = (typeof METAPHYSICS_PROMPT_METHODS)[number];

export interface MetaphysicsPromptOptions extends PromptBuildOptions {
  method: MetaphysicsPromptMethod;
  measurement?: string;
  schools?: readonly string[];
}

/**
 * 将已经由算法生成的元学排盘正文包装成可直接交给在线 AI 的完整任务书。
 * 排盘算法和应用层的输入表单保持分离，调用方只需传入算法返回的正文。
 */
export function buildMetaphysicsPromptDocument(
  basePrompt: string,
  question: string | undefined,
  options: MetaphysicsPromptOptions,
): PromptDocument {
  const sections = [
    buildPromptGuidance(options.method),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    buildPromptSection('排盘资料', basePrompt),
    options.measurement ? buildPromptSection('测量换算', options.measurement) : '',
    buildPromptSchoolSection(options.method, options.schools),
    question?.trim() ? buildPromptSection('问题', question) : '',
    buildPromptSection(
      '任务',
      question?.trim() ? '请结合以上资料回答【问题】。' : '请结合以上资料完成解读。',
    ),
  ];

  return buildPromptDocument(joinPromptSections(sections));
}

export function buildMetaphysicsPrompt(
  basePrompt: string,
  question: string | undefined,
  options: MetaphysicsPromptOptions,
) {
  return buildMetaphysicsPromptDocument(basePrompt, question, options).text;
}
