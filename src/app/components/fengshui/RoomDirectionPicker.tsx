import * as React from 'react';
import { Trash2 } from 'lucide-react';
import { Badge, Button } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import { FLOOR_MARKER_META, type FloorMarkerKind } from './fengshui-store';

const ROOM_GRID_CELLS: ReadonlyArray<{ dir: string; label: string }> = [
  { dir: '西北', label: '西北' },
  { dir: '北', label: '正北' },
  { dir: '东北', label: '东北' },
  { dir: '西', label: '正西' },
  { dir: '中', label: '房子中心' },
  { dir: '东', label: '正东' },
  { dir: '西南', label: '西南' },
  { dir: '南', label: '正南' },
  { dir: '东南', label: '东南' },
];

export interface RoomDirectionPickerProps {
  roomPlacements: Partial<Record<FloorMarkerKind, string>>;
  facingSideDir: string;
  directionLabel: string;
  onChange: (next: Partial<Record<FloorMarkerKind, string>>) => void;
}

export function RoomDirectionPicker({
  roomPlacements,
  facingSideDir,
  directionLabel,
  onChange,
}: RoomDirectionPickerProps) {
  const [activeKind, setActiveKind] = React.useState<FloorMarkerKind>('door');
  const placedCount = Object.values(roomPlacements).filter(Boolean).length;

  const handleCellClick = (dir: string) => {
    const current = roomPlacements[activeKind];
    if (current === dir) {
      const next = { ...roomPlacements };
      delete next[activeKind];
      onChange(next);
      return;
    }
    onChange({ ...roomPlacements, [activeKind]: dir });
  };

  return (
    <div className="grid gap-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="选择要标记的房间">
          {FLOOR_MARKER_META.map((item) => {
            const active = activeKind === item.kind;
            const placedDir = roomPlacements[item.kind];
            return (
              <button
                key={item.kind}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveKind(item.kind)}
                className={cn('fs-profile-chip', active && 'is-active')}
              >
                <span>{item.label}</span>
                {placedDir ? (
                  <span className="rounded-full bg-[var(--accent-strong)] px-1.5 py-0 text-[10px] text-white">
                    {placedDir === '中' ? '中心' : placedDir}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {placedCount > 0 ? (
          <Button type="button" variant="ghost" size="xs" onClick={() => onChange({})}>
            <Trash2 className="h-3.5 w-3.5" />
            <span>清空</span>
          </Button>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--text-muted)]">
        <span>{directionLabel}</span>
        <span>上北下南</span>
      </div>

      <div className="fs-room-grid" role="grid" aria-label="房间方位点选网格">
        {ROOM_GRID_CELLS.map((cell) => {
          const placedHere = FLOOR_MARKER_META.filter(
            (m) => roomPlacements[m.kind] === cell.dir,
          );
          const isFacingSide = cell.dir === facingSideDir;
          const isActiveTarget = roomPlacements[activeKind] === cell.dir;

          return (
            <button
              key={cell.dir}
              type="button"
              onClick={() => handleCellClick(cell.dir)}
              className={cn(
                'fs-room-cell',
                cell.dir === '中' && 'is-center',
                isActiveTarget && 'is-selected',
              )}
            >
              <div className="flex w-full items-center justify-between gap-1">
                <strong className="text-[12.5px] font-extrabold text-[var(--text-strong)]">
                  {cell.label}
                </strong>
                {isFacingSide ? <Badge variant="accent">朝向面</Badge> : null}
              </div>

              <div className="flex flex-wrap gap-1">
                {placedHere.length > 0 ? (
                  placedHere.map((m) => (
                    <span key={m.kind} className="fs-mini-tag is-good">
                      {m.label}
                    </span>
                  ))
                ) : (
                  <span className="text-[10.5px] text-[var(--text-soft)]">点击放置</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
