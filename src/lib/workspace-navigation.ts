import type { DivinationMethodId } from 'mingyu-core/divination/config';
import type { PromptSourceKey } from '@/lib/query-state';

export type WorkspaceEntryId =
  | 'bazi'
  | 'ziwei'
  | 'bazi-ziwei'
  | 'astrolabe'
  | 'qizheng'
  | 'bazhai'
  | 'compatibility'
  | 'random'
  | 'liuyao'
  | 'meihua'
  | 'qimen'
  | 'liuren'
  | 'xiaoliuren'
  | 'jinkoujue'
  | 'taiyi'
  | 'ssgw'
  | 'tarot'
  | 'lenormand'
  | 'almanac';

export type WorkspaceHomePreference = 'unspecified' | WorkspaceEntryId;

export type WorkspaceNavigationItem = {
  id: WorkspaceEntryId;
  label: string;
  mark: string;
  kind: 'personal' | 'compatibility' | 'divination';
  promptSource?: PromptSourceKey;
  method?: DivinationMethodId;
};

export const WORKSPACE_NAVIGATION_ITEMS: readonly WorkspaceNavigationItem[] = [
  { id: 'bazi', label: '八字', mark: '八', kind: 'personal', promptSource: 'bazi' },
  { id: 'ziwei', label: '紫微斗数', mark: '紫', kind: 'personal', promptSource: 'ziwei' },
  {
    id: 'bazi-ziwei',
    label: '八字紫微合参',
    mark: '参',
    kind: 'personal',
    promptSource: 'bazi-ziwei',
  },
  { id: 'astrolabe', label: '西洋星盘', mark: '星', kind: 'personal', promptSource: 'astrolabe' },
  { id: 'qizheng', label: '七政四余', mark: '七', kind: 'personal', promptSource: 'qizheng' },
  { id: 'bazhai', label: '住宅风水', mark: '宅', kind: 'personal', promptSource: 'bazhai' },
  { id: 'compatibility', label: '合盘', mark: '合', kind: 'compatibility' },
  { id: 'random', label: '随机占卜', mark: '卜', kind: 'divination', method: 'random' },
  { id: 'liuyao', label: '六爻', mark: '六', kind: 'divination', method: 'liuyao' },
  { id: 'meihua', label: '梅花易数', mark: '梅', kind: 'divination', method: 'meihua' },
  { id: 'qimen', label: '奇门遁甲', mark: '奇', kind: 'divination', method: 'qimen' },
  { id: 'liuren', label: '大六壬', mark: '壬', kind: 'divination', method: 'liuren' },
  { id: 'xiaoliuren', label: '小六壬', mark: '小', kind: 'divination', method: 'xiaoliuren' },
  { id: 'jinkoujue', label: '金口诀', mark: '金', kind: 'divination', method: 'jinkoujue' },
  { id: 'taiyi', label: '太乙神数', mark: '太', kind: 'divination', method: 'taiyi' },
  { id: 'ssgw', label: '三山国王灵签', mark: '签', kind: 'divination', method: 'ssgw' },
  { id: 'tarot', label: '塔罗', mark: '塔', kind: 'divination', method: 'tarot' },
  { id: 'lenormand', label: '雷诺曼', mark: '雷', kind: 'divination', method: 'lenormand' },
  { id: 'almanac', label: '黄历择日', mark: '日', kind: 'divination', method: 'almanac' },
] as const;

export const DEFAULT_WORKSPACE_NAVIGATION_ORDER = WORKSPACE_NAVIGATION_ITEMS.map((item) => item.id);

const workspaceEntriesById = new Map(
  WORKSPACE_NAVIGATION_ITEMS.map((item) => [item.id, item] as const),
);

export function isWorkspaceEntryId(value: unknown): value is WorkspaceEntryId {
  return typeof value === 'string' && workspaceEntriesById.has(value as WorkspaceEntryId);
}

export function getWorkspaceNavigationItem(id: WorkspaceEntryId) {
  return workspaceEntriesById.get(id)!;
}

export function normalizeWorkspaceNavigationOrder(value: unknown): WorkspaceEntryId[] {
  const savedOrder = Array.isArray(value)
    ? value.filter(
        (item, index, items): item is WorkspaceEntryId =>
          isWorkspaceEntryId(item) && items.indexOf(item) === index,
      )
    : [];

  return [
    ...savedOrder,
    ...DEFAULT_WORKSPACE_NAVIGATION_ORDER.filter((item) => !savedOrder.includes(item)),
  ];
}

export function buildWorkspaceEntryPath(id: WorkspaceEntryId, draftId?: string) {
  const item = getWorkspaceNavigationItem(id);
  if (item.kind === 'divination') {
    return `/divination?method=${encodeURIComponent(item.method!)}`;
  }

  const params = new URLSearchParams();
  params.set('mode', item.kind === 'compatibility' ? 'compatibility' : 'single');
  if (item.promptSource) {
    params.set('source', item.promptSource);
  }
  if (draftId) {
    params.set('draft', draftId);
  }
  return `/?${params.toString()}`;
}

export function buildWorkspaceHomePath(home: WorkspaceHomePreference, draftId = 'home') {
  return home === 'unspecified'
    ? buildWorkspaceEntryPath('bazi', draftId)
    : buildWorkspaceEntryPath(home, draftId);
}
