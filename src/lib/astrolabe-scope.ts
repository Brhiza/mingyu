export * from 'mingyu-core/divination/astrolabe-scope';

import type { AstrolabeFullScopeContexts } from 'mingyu-core/divination/astrolabe-scope';

/** 统一拼接完整星盘范围资料，供页面、公开接口与本地 Worker 共用。 */
export function buildAstrolabeFullScopePromptText(fullContexts: AstrolabeFullScopeContexts) {
  const contexts = [
    fullContexts.natal,
    fullContexts.yearly,
    fullContexts.monthly,
    fullContexts.daily,
  ];
  const lines = contexts
    .map((context) => context.promptText)
    .filter(Boolean)
    .map((line, index) => `${index + 1}. ${line}`);

  return ['分析对象：本命盘与完整行运资料。', '完整星盘行运资料：', ...lines].join('\n');
}
