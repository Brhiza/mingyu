import { getClassicalReferences } from '../classics/prompt-references';
import { buildPromptSection } from './sections';

export {
  getClassicalReferences,
  supportsClassicalReferences,
  type ClassicalReference,
} from '../classics/prompt-references';

/** 只将书名、篇章、规则转述与适用条件写入完整任务书。 */
export function formatClassicalReferences(method: string): string {
  const references = getClassicalReferences(method);
  return buildPromptSection(
    '经典依据',
    references
      .map(
        (reference) =>
          `《${reference.book}》·${reference.chapter}：${reference.summary}\n适用条件：${reference.application}`,
      )
      .join('\n\n'),
  );
}

/** 经典依据默认关闭，开启后放在任务之前；重复包装保持同一份依据。 */
export function appendClassicalReferences(
  prompt: string,
  method: string,
  includeClassics = false,
): string {
  if (!includeClassics || !prompt.trim()) return prompt;
  const section = formatClassicalReferences(method);
  if (!section || prompt.includes(section)) return prompt;
  const taskIndex = prompt.search(/^【任务】$/mu);
  if (taskIndex === -1) return `${prompt.trimEnd()}\n\n${section}`;
  return `${prompt.slice(0, taskIndex).trimEnd()}\n\n${section}\n\n${prompt.slice(taskIndex)}`;
}
