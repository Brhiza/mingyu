export function getManualChunk(id: string) {
  if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
    return 'react-vendor';
  }

  if (id.includes('node_modules/react-router') || id.includes('node_modules/react-router-dom')) {
    return 'router-vendor';
  }

  if (id.includes('node_modules/iztro')) {
    return 'iztro-vendor';
  }

  if (id.includes('node_modules/tyme4ts')) {
    return 'tyme-vendor';
  }

  if (
    id.includes('packages/core/src/ziwei/iztro/pattern-detection.ts') ||
    id.includes('packages/core/dist/ziwei/iztro/pattern-detection.js')
  ) {
    return 'ziwei-patterns';
  }

  if (
    id.includes('packages/core/src/calendar/') ||
    id.includes('packages/core/dist/calendar/') ||
    id.includes('packages/core/src/ganzhi/') ||
    id.includes('packages/core/dist/ganzhi/') ||
    id.includes('packages/core/src/prompt-evidence/') ||
    id.includes('packages/core/dist/prompt-evidence/') ||
    id.includes('packages/core/src/shared/') ||
    id.includes('packages/core/dist/shared/') ||
    id.includes('packages/core/src/wuxing.ts') ||
    id.includes('packages/core/dist/wuxing.js')
  ) {
    return 'core-shared';
  }

  if (
    id.includes('packages/core/src/bazi') ||
    id.includes('packages/core/dist/bazi') ||
    id.includes('src/lib/full-chart-engine/bazi.ts')
  ) {
    return 'bazi-engine';
  }

  if (
    id.includes('packages/core/src/ziwei/iztro') ||
    id.includes('packages/core/dist/ziwei/iztro') ||
    id.includes('src/lib/ziwei-') ||
    id.includes('src/lib/full-chart-engine/ziwei.ts')
  ) {
    return 'ziwei-engine';
  }

  if (
    id.includes('src/lib/full-chart-engine.ts') ||
    id.includes('src/lib/full-chart-engine/index.ts') ||
    id.includes('src/lib/time-policy.ts') ||
    id.includes('src/types/analysis.ts') ||
    id.includes('src/utils/dateUtils.ts')
  ) {
    return 'chart-engine-shared';
  }

  if (id.includes('src/lib/prompt-engine.ts') || id.includes('src/utils/ai')) {
    return 'prompt-engine';
  }

  if (id.includes('src/components/BaziFortuneTools/')) {
    return 'bazi-fortune-ui';
  }

  return undefined;
}
