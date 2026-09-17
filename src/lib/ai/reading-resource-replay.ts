import type { ReadingAction } from './reading-workflow';

/** 历史只保存补算动作；出生资料仍由保存的主体快照锁定。 */
export type ReadingResourceReplay = {
  key: string;
  action: Exclude<ReadingAction, { kind: 'schema' }>;
};

export function isReadingResourceReplays(value: unknown): value is ReadingResourceReplay[] {
  if (!Array.isArray(value)) return false;
  const keys = new Set<string>();
  return value.every((item: unknown) => {
    if (!item || typeof item !== 'object') return false;
    const entry = item as Partial<ReadingResourceReplay>;
    if (typeof entry.key !== 'string' || !entry.key || keys.has(entry.key)) return false;
    keys.add(entry.key);
    const action = entry.action;
    if (
      !action ||
      typeof action !== 'object' ||
      typeof action.method !== 'string' ||
      !action.method
    )
      return false;
    if (action.kind === 'classic')
      return typeof action.query === 'string' && Boolean(action.query.trim());
    return (
      action.kind === 'calculate' &&
      (action.target === undefined || action.target === 'primary' || action.target === 'partner') &&
      Boolean(action.input && typeof action.input === 'object' && !Array.isArray(action.input))
    );
  });
}
