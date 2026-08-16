import { z } from 'zod';
import {
  formatPromptSchoolGuidance,
  getPromptSchoolSectionTitle,
  getPromptSchoolIds,
  insertPromptSectionBeforeHeading,
  normalizePromptSchoolIds,
  type PromptSchoolId,
  type PromptSchoolMethod,
} from 'mingyu-core/prompt';

export function createPromptSchoolsShape<Method extends PromptSchoolMethod>(method: Method) {
  const allowed = getPromptSchoolIds(method);
  const schoolSchema = z.enum(allowed as [PromptSchoolId<Method>, ...PromptSchoolId<Method>[]]);
  return {
    schools: z
      .array(schoolSchema)
      .min(1)
      .max(3)
      .refine((values) => new Set(values).size === values.length, '不能选择重复解读口径')
      .optional()
      .describe(
        `解读流派、断法或侧重；选择两个或三个时生成多口径合参。可选值：${allowed.join('、')}`,
      ),
  };
}

export function applyPromptSchools(
  prompt: string,
  method: PromptSchoolMethod,
  schools?: readonly string[],
) {
  if (!schools?.length) return prompt;
  const selected = normalizePromptSchoolIds(method, schools);
  const guidance = formatPromptSchoolGuidance(method, selected);
  return guidance
    ? insertPromptSectionBeforeHeading(
        prompt,
        '【问题】',
        `【${getPromptSchoolSectionTitle(method, selected)}】\n${guidance}`,
      )
    : prompt;
}
