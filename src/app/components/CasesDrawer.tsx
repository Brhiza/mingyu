import * as React from 'react';
import { FolderPlus, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { formatBirthTimeText, sortPersonalCases, type PersonalCase } from '../../v2-ui/cases-store';
import type { PersonRole } from '../../v2-ui/person-form';
import {
  Badge,
  Button,
  DockedSidePanel,
  Drawer,
  DrawerContent,
  DrawerHeader,
  Input,
  PanelDescription,
  PanelTitle,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import { ConfirmDialog } from './ConfirmDialog';

export interface CaseFillTarget {
  role: PersonRole;
  applyCase: (person: PersonalCase, isTemporary: boolean) => void;
}

export interface CasesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDock?: boolean;
  isDocked?: boolean;
  onToggleDock?: () => void;
  cases: PersonalCase[];
  fillTarget: CaseFillTarget | null;
  onNewCase: () => void;
  onEditCase: (record: PersonalCase) => void;
  onFillCase: (record: PersonalCase) => void;
  onOpenChart: (record: PersonalCase) => void;
  onTogglePin: (id: string) => void;
  onDeleteCase: (record: PersonalCase) => void;
}

export function CasesDrawer({
  open,
  onOpenChange,
  canDock = false,
  isDocked = false,
  onToggleDock,
  cases,
  fillTarget,
  onNewCase,
  onEditCase,
  onFillCase,
  onOpenChart,
  onTogglePin,
  onDeleteCase,
}: CasesDrawerProps) {
  const [keyword, setKeyword] = React.useState('');
  const [pendingDelete, setPendingDelete] = React.useState<PersonalCase | null>(null);

  React.useEffect(() => {
    if (!open) setKeyword('');
  }, [open]);

  const sortedCases = React.useMemo(() => sortPersonalCases(cases, 'recent'), [cases]);
  const kw = keyword.trim().toLowerCase();
  const filtered = React.useMemo(
    () =>
      sortedCases.filter((c) =>
        `${c.name} ${c.birthText} ${c.birthPlace}`.toLowerCase().includes(kw),
      ),
    [sortedCases, kw],
  );

  const dockActive = open && canDock && isDocked;

  const dockToggleAction =
    canDock && onToggleDock ? (
      <button
        type="button"
        onClick={onToggleDock}
        title={isDocked ? '取消右侧固定' : '固定在右侧'}
        aria-label={isDocked ? '取消右侧固定' : '固定在右侧'}
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-0 cursor-pointer transition-colors',
          isDocked
            ? 'bg-[var(--state-selected-surface)] text-[var(--accent-strong)]'
            : 'bg-[var(--surface-soft)] text-[var(--text-muted)] hover:bg-[var(--state-hover-surface)] hover:text-[var(--text-strong)]',
        )}
      >
        {isDocked ? <Pin className="h-4 w-4 fill-current" /> : <PinOff className="h-4 w-4" />}
      </button>
    ) : null;

  const panelBody = (
    <>
      <DrawerHeader
        isDocked={dockActive}
        onClose={() => onOpenChange(false)}
        actions={dockToggleAction}
      >
        <PanelTitle isDocked={dockActive}>个人档案</PanelTitle>
        <PanelDescription isDocked={dockActive}>点击档案直接进入排盘</PanelDescription>
      </DrawerHeader>

      <div className="flex shrink-0 flex-col gap-2.5 border-b border-[var(--border-soft)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            type="search"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索姓名或生辰..."
            className="flex-1"
          />
          <Button
            variant="primary"
            size="sm"
            className="workspace-drawer-new-btn shrink-0"
            onClick={onNewCase}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            <span>新建档案</span>
          </Button>
        </div>

        {fillTarget ? (
          <div className="rounded-lg border border-[color-mix(in_srgb,var(--accent)_24%,transparent)] bg-[var(--state-selected-surface)] px-3 py-2 text-xs leading-relaxed text-[var(--state-selected-text)]">
            正在为「{fillTarget.role === 'partner' ? '命主二' : '当前表单'}」选择档案，点击即可填入。
          </div>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-soft)] px-5 py-10 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--state-selected-surface)] font-serif text-lg font-bold text-[var(--accent-strong)]">
              档
            </span>
            <strong className="text-sm font-bold text-[var(--text-strong)]">
              {sortedCases.length ? '没有匹配的个人档案' : '尚未保存个人档案'}
            </strong>
            <p className="m-0 max-w-[260px] text-xs leading-relaxed text-[var(--text-muted)]">
              {sortedCases.length
                ? '请换个姓名或日期关键词试试'
                : '保存常用生辰后，可点击随时排盘'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filtered.map((record) => {
              const dateModeLabel = record.reverseSource
                ? '四柱'
                : record.calendar === 'lunar'
                  ? '农历'
                  : '公历';
              const birthSummary = `${dateModeLabel} ${record.birthText} ${formatBirthTimeText(record)}`;
              return (
                <article
                  key={record.id}
                  className={cn(
                    'workspace-drawer-flat-row group flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-colors',
                    record.pinned
                      ? 'is-pinned border-[color-mix(in_srgb,var(--accent)_30%,var(--border-soft))] bg-[color-mix(in_srgb,var(--state-selected-surface)_55%,var(--surface-elevated))]'
                      : 'border-[var(--border-soft)] bg-[var(--surface-elevated)] hover:border-[var(--border-contrast)] hover:bg-[var(--surface-base)]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => (fillTarget ? onFillCase(record) : onOpenChart(record))}
                    className="flex min-w-0 flex-1 flex-col items-start gap-1 border-0 bg-transparent p-0 text-left cursor-pointer"
                  >
                    <div className="flex max-w-full flex-wrap items-center gap-1.5">
                      <strong className="truncate text-[13.5px] font-bold text-[var(--text-strong)]">
                        {record.name}
                      </strong>
                      <Badge
                        variant={record.gender === 'male' ? 'outline' : 'accent'}
                        className="px-1.5 py-0 text-[10.5px]"
                      >
                        {record.gender === 'male' ? '男' : '女'}
                      </Badge>
                    </div>
                    <span className="max-w-full truncate text-[12px] text-[var(--text-muted)]">
                      {birthSummary}
                    </span>
                  </button>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {fillTarget ? (
                      <Button
                        variant="primary"
                        size="xs"
                        onClick={() => onFillCase(record)}
                      >
                        填入
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[var(--text-muted)]"
                      title="编辑档案"
                      aria-label="编辑档案"
                      onClick={() => onEditCase(record)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'h-7 w-7',
                        record.pinned
                          ? 'text-[var(--accent-strong)]'
                          : 'text-[var(--text-muted)]',
                      )}
                      title={record.pinned ? '取消置顶' : '置顶档案'}
                      aria-label={record.pinned ? '取消置顶' : '置顶档案'}
                      onClick={() => onTogglePin(record.id)}
                    >
                      {record.pinned ? (
                        <Pin className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <PinOff className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[var(--danger-text)] hover:bg-[color-mix(in_srgb,var(--danger-text)_10%,transparent)]"
                      title="删除档案"
                      aria-label="删除档案"
                      onClick={() => setPendingDelete(record)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {dockActive ? (
        <DockedSidePanel data-testid="cases-drawer" aria-label="个人生辰档案面板">
          {panelBody}
        </DockedSidePanel>
      ) : (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent data-testid="cases-drawer" aria-label="个人生辰档案抽屉">
            {panelBody}
          </DrawerContent>
        </Drawer>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title="删除个人档案"
        message={
          pendingDelete ? `确定删除“${pendingDelete.name}”吗？删除后无法恢复。` : ''
        }
        onConfirm={() => {
          if (pendingDelete) onDeleteCase(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
