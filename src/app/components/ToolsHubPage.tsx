import * as React from 'react';
import {
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  Dices,
  Home,
} from 'lucide-react';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import { Button, Card, PageHeader } from '../../components/ui';
import { HOME_INSTANT_CAST_CATALOG } from '../workspace-catalog';
import { getMethodIcon } from './shared/method-icons';

export interface ToolsHubPageProps {
  homeInstantTimeStandard: 'beijing' | 'true-solar';
  homeInstantPlace: { displayName: string; longitude: number; latitude: number };
  birthPlaceModal: BirthPlaceModalController;
  onToggleTimeStandard: () => void;
  onUpdateInstantPlace: (place: {
    displayName: string;
    longitude: number;
    latitude: number;
  }) => void;
  onOneClickInstantCast: (itemId: string) => void;
  onOpenShortcut: (shortcutId: string) => void;
}

const CALENDAR_MACRO_ITEMS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'almanac', label: '万年历' },
  { id: 'calendar', label: '天文历法' },
  { id: 'huangji-jingshi', label: '皇极经世' },
  { id: 'wuyun-liuqi', label: '五运六气' },
];

const FENGSHUI_ITEMS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'residential', label: '阳宅风水（八宅 / 玄空 / 户型）' },
];

const NAME_TEXT_ITEMS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'chinese-name', label: '姓名五格' },
  { id: 'chinese-naming', label: '起名方案' },
  { id: 'number-energy', label: '数字能量' },
  { id: 'character-query', label: '汉字字典' },
  { id: 'zhouyi', label: '周易经文' },
  { id: 'terms', label: '术语词典' },
];

function ToolTileButton({
  id,
  label,
  onClick,
}: {
  id: string;
  label: string;
  onClick: () => void;
}) {
  const Icon = getMethodIcon(id);
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 py-2 text-left transition-colors cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)]"
    >
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-soft)] text-[var(--accent-strong)]"
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <span className="truncate text-[12.5px] font-bold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
          {label}
        </span>
      </span>
      <ArrowUpRight
        className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-50 transition-opacity group-hover:text-[var(--accent-strong)] group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}

/** 工具箱聚合页：收纳即时起卦、历法宏观、阳宅风水及姓名经籍专业工具 */
export function ToolsHubPage({
  homeInstantTimeStandard,
  homeInstantPlace,
  birthPlaceModal,
  onToggleTimeStandard,
  onUpdateInstantPlace,
  onOneClickInstantCast,
  onOpenShortcut,
}: ToolsHubPageProps) {
  const instantItems = React.useMemo(
    () => HOME_INSTANT_CAST_CATALOG.filter((item) => item.group !== '宏观周期'),
    [],
  );

  return (
    <div
      data-testid="tools-hub-page"
      className="mx-auto flex w-full min-w-0 max-w-[960px] flex-col gap-3.5 pb-10"
    >
      <PageHeader title="工具箱" />

      {/* 1. 即时起卦 */}
      <Card className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"
            >
              <Dices className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h2 className="m-0 text-[14px] font-extrabold text-[var(--text-strong)]">即时起卦</h2>
          </div>

          <Button
            variant="secondary"
            size="xs"
            className="h-7 px-2.5 text-[11.5px] tabular-nums"
            onClick={onToggleTimeStandard}
          >
            {homeInstantTimeStandard === 'true-solar' ? '真太阳时' : '北京时间'}
          </Button>
        </div>

        {homeInstantTimeStandard === 'true-solar' ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-3 py-1.5 text-[12px]">
            <span className="text-[var(--text-muted)]">参考地</span>
            <button
              type="button"
              onClick={() => {
                birthPlaceModal.open({
                  purpose: 'observer',
                  initialPlace: homeInstantPlace.displayName,
                  onConfirm: (sel) => {
                    onUpdateInstantPlace({
                      displayName: sel.displayName,
                      longitude: sel.longitude,
                      latitude: sel.latitude,
                    });
                  },
                });
              }}
              className="truncate border-0 bg-transparent p-0 font-semibold text-[var(--accent-strong)] cursor-pointer hover:underline"
            >
              {homeInstantPlace.displayName} · 更换
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {instantItems.map((item) => (
            <ToolTileButton
              key={item.id}
              id={item.id}
              label={item.label}
              onClick={() => onOneClickInstantCast(item.id)}
            />
          ))}
        </div>
      </Card>

      {/* 2. 历法与宏观 */}
      <Card className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5 sm:p-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h2 className="m-0 text-[14px] font-extrabold text-[var(--text-strong)]">历法与宏观</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CALENDAR_MACRO_ITEMS.map((item) => (
            <ToolTileButton
              key={item.id}
              id={item.id}
              label={item.label}
              onClick={() => onOpenShortcut(item.id)}
            />
          ))}
        </div>
      </Card>

      {/* 3. 风水与空间 */}
      <Card className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5 sm:p-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          >
            <Home className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h2 className="m-0 text-[14px] font-extrabold text-[var(--text-strong)]">风水与空间</h2>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {FENGSHUI_ITEMS.map((item) => (
            <ToolTileButton
              key={item.id}
              id={item.id}
              label={item.label}
              onClick={() => onOpenShortcut(item.id)}
            />
          ))}
        </div>
      </Card>

      {/* 4. 姓名、数字与经籍 */}
      <Card className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-3.5 sm:p-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          >
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <h2 className="m-0 text-[14px] font-extrabold text-[var(--text-strong)]">姓名、数字与经籍</h2>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {NAME_TEXT_ITEMS.map((item) => (
            <ToolTileButton
              key={item.id}
              id={item.id}
              label={item.label}
              onClick={() => onOpenShortcut(item.id)}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

export default ToolsHubPage;
