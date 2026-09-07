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

  const nameNumberTupleMatch = id.match(/generated-character-tuples-(\d+)\.(?:ts|js)$/);
  if (nameNumberTupleMatch) {
    return `name-number-data-${nameNumberTupleMatch[1]}`;
  }

  if (
    id.includes('packages/core/src/ziwei/iztro/pattern-detection.ts') ||
    id.includes('packages/core/dist/ziwei/iztro/pattern-detection.js')
  ) {
    return 'ziwei-patterns';
  }

  const astrologyDataMatch = id.match(/astrology[\\/]vendor[\\/]caelus[\\/]([^\\/]+)\.js$/);
  if (astrologyDataMatch) {
    return `astrology-data-${astrologyDataMatch[1].replace('_cheb', '')}`;
  }

  if (id.includes('packages/core/src/calendar/') || id.includes('packages/core/dist/calendar/')) {
    return 'calendar-engine';
  }

  if (id.includes('packages/core/src/ganzhi/') || id.includes('packages/core/dist/ganzhi/')) {
    return 'ganzhi-engine';
  }

  if (
    id.includes('packages/core/src/prompt-evidence/') ||
    id.includes('packages/core/dist/prompt-evidence/')
  ) {
    return 'prompt-evidence';
  }

  if (
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
