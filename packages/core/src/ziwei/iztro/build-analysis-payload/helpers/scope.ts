import type { IztroHoroscope, IztroHoroscopeScope } from '../../../../types/iztro';
import type { ScopeType } from '../../../../types/analysis';

export type HoroscopeScopeItem = IztroHoroscopeScope;

export const VALID_SCOPE_TYPES: readonly ScopeType[] = [
  'origin',
  'decadal',
  'yearly',
  'monthly',
  'daily',
  'hourly',
  'age',
];

export function assertScopeType(value: unknown): asserts value is ScopeType {
  if (typeof value !== 'string' || !VALID_SCOPE_TYPES.includes(value as ScopeType)) {
    throw new Error('紫微分析范围必须是 origin、decadal、yearly、monthly、daily、hourly 或 age。');
  }
}

export function mapScopeLabel(scope: ScopeType): string {
  assertScopeType(scope);

  switch (scope) {
    case 'origin':
      return '本命';
    case 'decadal':
      return '大限';
    case 'yearly':
      return '流年';
    case 'monthly':
      return '流月';
    case 'daily':
      return '流日';
    case 'hourly':
      return '流时';
    case 'age':
      return '小限';
  }
}

export function resolveScopeLabel(currentScope: ScopeType, currentScopeItem?: HoroscopeScopeItem) {
  if (currentScope !== 'origin' && currentScopeItem?.name) {
    return currentScopeItem.name;
  }

  return mapScopeLabel(currentScope);
}

export function getCurrentScopeItem(
  horoscope: IztroHoroscope,
  currentScope: ScopeType,
): HoroscopeScopeItem | undefined {
  assertScopeType(currentScope);

  switch (currentScope) {
    case 'decadal':
      return horoscope.decadal;
    case 'yearly':
      return horoscope.yearly;
    case 'monthly':
      return horoscope.monthly;
    case 'daily':
      return horoscope.daily;
    case 'hourly':
      return horoscope.hourly;
    case 'age':
      return horoscope.age;
    case 'origin':
      return undefined;
  }
}
