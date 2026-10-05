import { formatPromptCurrentTime } from './current-time';
import { buildPromptDocument, buildPromptSection, joinPromptSections } from './sections';
import { buildPromptGuidance, buildPromptTask } from './guidance';
import { buildPromptSchoolSection } from './schools';
import type { PromptBuildOptions, PromptDocument } from './types';
import {
  buildPromptSelectionTask,
  getPromptSelectionSection,
  requirePromptSelection,
} from './framework';

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
  topicId?: string;
  subtopicId?: string;
  scope?: string;
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
  const normalizedBase = basePrompt.trim();
  const selection =
    options.topicId !== undefined || options.subtopicId !== undefined || options.scope !== undefined
      ? requirePromptSelection({
          methodId: options.method,
          topicId: options.topicId,
          subtopicId: options.subtopicId,
          scope: options.scope,
        })
      : undefined;
  const hasCompleteXuanKongBase =
    options.method === 'xuankong' &&
    /^【任务】$/m.test(normalizedBase) &&
    /^【传统依据】$/m.test(normalizedBase);
  const fengshuiTask = /^【任务】\n([\s\S]*?)\n【盘面资料】\n/.exec(normalizedBase)?.[1];
  const fengshuiTradition = /\n【传统依据】\n([\s\S]*)$/.exec(normalizedBase)?.[1];
  const hasCompleteFengshuiBase =
    (options.method === 'bazhai' || options.method === 'residential') &&
    fengshuiTask !== undefined &&
    fengshuiTradition !== undefined;
  const hasCompleteBase = hasCompleteXuanKongBase || hasCompleteFengshuiBase;
  const taskAddition = [
    selection ? '请围绕【解读选择】所列主题和范围解释本次盘面。' : '',
    question?.trim() ? '请直接回答【问题】。' : '',
  ]
    .filter(Boolean)
    .join('');
  const baseSection = hasCompleteFengshuiBase
    ? normalizedBase
        .replace(
          /^【任务】\n[\s\S]*?\n【盘面资料】\n/,
          `【任务】\n${buildPromptTask([fengshuiTask, taskAddition].filter(Boolean).join('\n'), options.method)}\n【盘面资料】\n`,
        )
        .replace(/\n【传统依据】\n[\s\S]*$/, '')
    : normalizedBase.startsWith('【')
      ? normalizedBase
      : buildPromptSection('排盘资料', normalizedBase);
  const traditionSection = hasCompleteFengshuiBase
    ? buildPromptSection(
        '传统依据',
        [buildPromptGuidance(options.method).replace(/^【传统依据】\n/, ''), fengshuiTradition]
          .filter((item, index, items) => item && items.indexOf(item) === index)
          .join('\n'),
      )
    : hasCompleteXuanKongBase
      ? ''
      : buildPromptGuidance(options.method);
  const currentTimeSection = buildPromptSection(
    '当前时间',
    [
      options.method === 'zodiac'
        ? '时间身份：本节为提问时点的历法背景；生肖流年关系的参与资料为下列出生年支与目标流年干支。'
        : '',
      formatPromptCurrentTime(options.currentTime),
    ]
      .filter(Boolean)
      .join('\n'),
  );

  const sections = [
    traditionSection,
    hasCompleteXuanKongBase ? baseSection : currentTimeSection,
    hasCompleteXuanKongBase ? currentTimeSection : baseSection,
    options.measurement ? buildPromptSection('测量换算', options.measurement) : '',
    buildPromptSchoolSection(options.method, options.schools),
    selection
      ? buildPromptSection(
          '解读选择',
          [
            getPromptSelectionSection(selection),
            hasCompleteXuanKongBase ? buildPromptSelectionTask('', selection) : '',
          ]
            .filter(Boolean)
            .join('\n'),
        )
      : '',
    hasCompleteBase || (options.method === 'zodiac' && /^【任务】$/m.test(normalizedBase))
      ? ''
      : buildPromptSection(
          '任务',
          selection
            ? buildPromptSelectionTask(
                buildPromptTask(
                  question?.trim() ? '请结合以上资料回答【问题】。' : '请结合以上资料完成解读。',
                  options.method,
                ),
                selection,
              )
            : buildPromptTask(
                question?.trim() ? '请结合以上资料回答【问题】。' : '请结合以上资料完成解读。',
                options.method,
              ),
        ),
    question?.trim() ? buildPromptSection('问题', question) : '',
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
