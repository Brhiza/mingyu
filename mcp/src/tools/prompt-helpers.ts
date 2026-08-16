import { buildDivinationPrompt } from '../../../src/lib/divination/engine/index.js';
import type { AstrolabePromptTopic } from '../../../src/lib/astrolabe-prompts.js';
import type { DivinationMethodId } from '@core/divination/config';
import type { PromptMode } from '../../../src/lib/public-api/prompt-builders.js';
import type {
  DivinationData,
  LiuyaoTemplateType,
  LiurenTemplateType,
  SupplementaryInfo,
} from '../../../src/types/divination.js';

export function buildDivinationPromptText(params: {
  method: Exclude<DivinationMethodId, 'random'>;
  question: string;
  data: unknown;
  supplementaryInfo?: SupplementaryInfo;
  liuyaoTemplate?: LiuyaoTemplateType;
  liurenTemplate?: LiurenTemplateType;
  promptMode?: PromptMode;
  astrolabeTopic?: AstrolabePromptTopic;
  astrolabeScopeText?: string;
  schools?: readonly string[];
}) {
  return buildDivinationPrompt(
    params.method,
    params.question,
    params.data as DivinationData,
    params.supplementaryInfo,
    {
      isCustomQuestion: params.promptMode === 'custom',
      liuyaoTemplate: params.liuyaoTemplate,
      liurenTemplate: params.liurenTemplate,
      astrolabeTopic: params.astrolabeTopic,
      astrolabeScopeText: params.astrolabeScopeText,
      schools: params.schools,
    },
  );
}
