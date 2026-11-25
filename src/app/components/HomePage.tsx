import * as React from 'react';
import {
  ArrowUpRight,
  BookA,
  Bot,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  FolderOpen,
  Hash,
  Home as HomeIcon,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import {
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  PageHeader,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import {
  CUSTOM_SHORTCUT_CATALOG,
  HOME_CHART_ENTRY_CATALOG,
  HOME_INSTANT_CAST_CATALOG,
  HOME_INSTANT_CHIP_CATALOG,
  isHomeCustomizationModified,
  type HomeCustomizationState,
} from '../workspace-catalog';
import { AgentChatPanel, type AgentChatPanelProps } from './AgentChatPanel';
import { LocalAgentBar, type LocalAgentApplyPayload } from './LocalAgentBar';

export interface HomePageProps {
  homeInstantTimeStandard: 'beijing' | 'true-solar';
  homeInstantPlace: { displayName: string; longitude: number; latitude: number };
  homeCustomization: HomeCustomizationState;
  caseCount: number;
  birthPlaceModal: BirthPlaceModalController;
  chatModeActive?: boolean;
  homeVisitRevision?: number;
  agentChat?: Omit<AgentChatPanelProps, 'variant'>;
  onToggleTimeStandard: () => void;
  onUpdateInstantPlace: (place: {
    displayName: string;
    longitude: number;
    latitude: number;
  }) => void;
  onOneClickInstantCast: (itemId: string) => void;
  onOpenChartInput: (mode: 'single' | 'compat') => void;
  onOpenCasesDrawer: () => void;
  onOpenCustomShortcutTarget: (shortcutId: string) => void;
  onToggleHomeItem: (section: keyof HomeCustomizationState, id: string) => void;
  onResetHomeCustomization: () => void;
  onApplyLocalAgentRecommendation?: (payload: LocalAgentApplyPayload) => void | Promise<void>;
}

type HomePickerMode = 'instantCast' | 'chart' | 'cards' | null;

const NICHE_CARD_MARKS: Record<string, string> = {
  taiyi: '乙',
  'huangji-jingshi': '皇',
  'wuyun-liuqi': '运',
  zhuge: '诸',
};

const ACCENT_SOFT_CARD_IDS = new Set([
  'fortune',
  'almanac',
  'calendar',
  'residential',
  'name-char',
  'zhouyi',
  'number-energy',
  'taiyi',
  'huangji-jingshi',
  'wuyun-liuqi',
  'zhuge',
]);

function getShortcutIcon(id: string): React.ComponentType<{ className?: string }> {
  if (id === 'compatibility' || id === 'compat') return Users;
  if (id === 'cases') return FolderOpen;
  if (id === 'history') return Clock;
  if (id === 'connect') return Bot;
  if (id === 'almanac' || id === 'calendar' || id === 'fortune') return CalendarDays;
  if (id === 'residential') return HomeIcon;
  if (
    id === 'name-char' ||
    id === 'chinese-name' ||
    id === 'chinese-naming' ||
    id === 'character-query' ||
    id === 'zhouyi'
  ) {
    return BookA;
  }
  if (id === 'number-energy') return Hash;
  if (
    id === 'bazi' ||
    id === 'ziwei' ||
    id === 'bazi-ziwei' ||
    id === 'astrolabe' ||
    id === 'qizheng' ||
    id === 'qimen-lifetime' ||
    id === 'birth-range'
  ) {
    return Compass;
  }
  return Sparkles;
}

const STUDIO_TILE_CLS =
  'rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] shadow-[0_2px_10px_rgba(32,24,16,0.03)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_48%,var(--border-soft))] hover:bg-[var(--surface-panel)] hover:shadow-[0_8px_22px_rgba(32,24,16,0.06)]';

const REMOVE_BADGE_BTN_CLS =
  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-muted)] transition-colors cursor-pointer hover:border-[var(--danger-text)] hover:bg-[var(--danger-text)] hover:text-white';

const CORE_DIALOG_DIVINATION_IDS = new Set([
  'liuyao',
  'meihua',
  'qimen',
  'liuren',
  'tarot',
  'random-divination',
]);

export function HomePage({
  homeInstantTimeStandard,
  homeInstantPlace,
  homeCustomization,
  caseCount,
  birthPlaceModal,
  chatModeActive = false,
  homeVisitRevision = 0,
  agentChat,
  onToggleTimeStandard,
  onUpdateInstantPlace,
  onOneClickInstantCast,
  onOpenChartInput,
  onOpenCasesDrawer,
  onOpenCustomShortcutTarget,
  onToggleHomeItem,
  onResetHomeCustomization,
  onApplyLocalAgentRecommendation,
}: HomePageProps) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [pickerMode, setPickerMode] = React.useState<HomePickerMode>(null);
  const [showAllTraditionalTools, setShowAllTraditionalTools] = React.useState(false);

  React.useEffect(() => {
    setShowAllTraditionalTools(false);
    setIsEditing(false);
    setPickerMode(null);
  }, [homeVisitRevision]);

  const now = new Date();
  const dateStr = now.toLocaleDateString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
  });
  const clockStr = now.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const isModified = React.useMemo(
    () => isHomeCustomizationModified(homeCustomization),
    [homeCustomization],
  );

  const visibleInstantCastItems = React.useMemo(
    () =>
      homeCustomization.instantCastIds
        .map((id) => HOME_INSTANT_CAST_CATALOG.find((item) => item.id === id))
        .filter((item): item is (typeof HOME_INSTANT_CAST_CATALOG)[number] => Boolean(item)),
    [homeCustomization.instantCastIds],
  );

  const visibleChartEntries = React.useMemo(
    () =>
      homeCustomization.chartEntryIds
        .map((id) => HOME_CHART_ENTRY_CATALOG.find((item) => item.id === id))
        .filter((item): item is (typeof HOME_CHART_ENTRY_CATALOG)[number] => Boolean(item)),
    [homeCustomization.chartEntryIds],
  );

  const primaryChartEntry = visibleChartEntries.find((item) => item.id === 'single') ?? null;
  const secondaryChartEntries = visibleChartEntries.filter((item) => item.id !== 'single');

  const visibleInstantChips = React.useMemo(
    () =>
      homeCustomization.instantChipIds
        .map((id) => HOME_INSTANT_CHIP_CATALOG.find((item) => item.id === id))
        .filter((item): item is (typeof HOME_INSTANT_CHIP_CATALOG)[number] => Boolean(item)),
    [homeCustomization.instantChipIds],
  );

  const visibleHomeCards = React.useMemo(
    () =>
      homeCustomization.cardIds
        .map((id) => CUSTOM_SHORTCUT_CATALOG.find((item) => item.id === id))
        .filter((item): item is (typeof CUSTOM_SHORTCUT_CATALOG)[number] => Boolean(item)),
    [homeCustomization.cardIds],
  );

  const handleChartEntryClick = (entryId: string) => {
    if (entryId === 'single') {
      onOpenChartInput('single');
      return;
    }
    if (entryId === 'compat') {
      onOpenChartInput('compat');
      return;
    }
    if (entryId === 'cases') {
      onOpenCasesDrawer();
      return;
    }
    onOpenCustomShortcutTarget(entryId);
  };

  const pickerGroups = React.useMemo(() => {
    if (pickerMode === 'instantCast') {
      return (['常用占卜', '专项与即时'] as const).map((group) => ({
        title: group,
        section: 'instantCastIds' as const,
        selectedIds: homeCustomization.instantCastIds,
        options: HOME_INSTANT_CAST_CATALOG.filter((o) => o.group === group),
      }));
    }
    if (pickerMode === 'chart') {
      return [
        {
          title: '命盘入口',
          section: 'chartEntryIds' as const,
          selectedIds: homeCustomization.chartEntryIds,
          options: HOME_CHART_ENTRY_CATALOG,
        },
        {
          title: '当下即时',
          section: 'instantChipIds' as const,
          selectedIds: homeCustomization.instantChipIds,
          options: HOME_INSTANT_CHIP_CATALOG,
        },
      ];
    }
    if (pickerMode === 'cards') {
      return (['命盘', '占卜', '工具'] as const).map((group) => ({
        title: group,
        section: 'cardIds' as const,
        selectedIds: homeCustomization.cardIds,
        options: CUSTOM_SHORTCUT_CATALOG.filter((o) => o.group === group),
      }));
    }
    return [];
  }, [pickerMode, homeCustomization]);

  const pickerMeta =
    pickerMode === 'instantCast'
      ? {
          title: '编辑「即时起卦」图标',
          description: '选择要在「即时起卦」卡片中显示的项目，点击即可添加或移除',
          ariaLabel: '编辑即时起卦图标',
        }
      : pickerMode === 'chart'
        ? {
            title: '编辑「命盘排盘」图标',
            description: '选择要在「命盘排盘」卡片中显示的入口与当下即时项目',
            ariaLabel: '编辑命盘排盘图标',
          }
        : {
            title: '添加快捷卡片',
            description: '选择常用功能添加到首页，点击即可添加或移除',
            ariaLabel: '添加主页快捷卡片',
          };

  const editControls = isEditing ? (
    <div className="flex items-center gap-2">
      {isModified ? (
        <Button
          variant="outline"
          size="xs"
          onClick={onResetHomeCustomization}
          className="h-7.5 rounded-full px-2.5 text-xs"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>恢复默认</span>
        </Button>
      ) : null}
      <Button
        variant="primary"
        size="xs"
        onClick={() => setIsEditing(false)}
        className="h-7.5 rounded-full px-3 text-xs"
      >
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        <span>完成</span>
      </Button>
    </div>
  ) : (
    <Button
      variant="outline"
      size="icon"
      aria-label="编辑首页"
      title="编辑首页"
      onClick={() => setIsEditing(true)}
      className="h-8 w-8 rounded-full border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-muted)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  );

  const showDialogHome = Boolean(chatModeActive && agentChat);
  const hasChatMessages = Boolean(agentChat?.session.messages.length);
  const coreQuickDivinationItems = visibleInstantCastItems.filter((item) =>
    CORE_DIALOG_DIVINATION_IDS.has(item.id),
  );
  const coreQuickChartEntries = visibleChartEntries.filter(
    (entry) => entry.id === 'single' || entry.id === 'compat',
  );

  return (
    <div
      className={cn(
        'workspace-home-page w-full min-w-0 py-0.5 min-[680px]:py-1',
        showDialogHome ? 'pb-36 min-[680px]:pb-10' : 'pb-4 min-[680px]:pb-10',
      )}
    >
      <div className="mx-auto grid w-full max-w-[var(--ws-canvas,1120px)] gap-2.5 min-[680px]:gap-3.5">
        {showDialogHome && agentChat ? (
          <>
            {/* 1. 对话模式大对话框（桌面居中，移动端自动停靠底部） */}
            <AgentChatPanel variant="home-hero" {...agentChat} />

            {/* 2. 精简核心入口（其余低频功能由 AI Agent 调用或点「更多工具」展开） */}
            {!hasChatMessages || showAllTraditionalTools ? (
              <div
                aria-label="常用快捷入口"
                className="mx-auto flex w-full max-w-[780px] flex-wrap items-center justify-center gap-1.5 px-1"
              >
                {coreQuickChartEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleChartEntryClick(entry.id)}
                    className="inline-flex h-7.5 items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--text-strong)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)] hover:text-[var(--accent-strong)]"
                  >
                    <span>{entry.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => onOpenCustomShortcutTarget('fortune')}
                  className="inline-flex h-7.5 items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--text-strong)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)] hover:text-[var(--accent-strong)]"
                >
                  <span>日/月/年运势</span>
                </button>
                {coreQuickDivinationItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onOneClickInstantCast(item.id)}
                    className="inline-flex h-7.5 items-center gap-1 rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 text-[12px] font-semibold text-[var(--text-strong)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)] hover:text-[var(--accent-strong)]"
                  >
                    <span>{item.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  aria-expanded={showAllTraditionalTools}
                  onClick={() => setShowAllTraditionalTools((v) => !v)}
                  className="inline-flex h-7.5 items-center gap-1 rounded-full border border-dashed border-[var(--border-contrast)] bg-transparent px-3 text-[12px] font-semibold text-[var(--text-muted)] cursor-pointer transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                >
                  <span>{showAllTraditionalTools ? '收起工具' : '更多工具'}</span>
                  {showAllTraditionalTools ? (
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            ) : null}

            {/* 3. 按需展开完整传统排盘与快捷工具 */}
            {showAllTraditionalTools ? (
              <section aria-label="传统排盘与快捷工具" className="grid gap-2.5 pt-1">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <div className="flex items-center gap-2">
                    <h2 className="m-0 text-xs font-extrabold tracking-wide text-[var(--text-muted)]">
                      传统排盘与快捷工具
                    </h2>
                    <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
                      {dateStr} · {clockStr}
                    </span>
                  </div>
                  {editControls}
                </div>

                {/* 紧凑双栏：左即时起卦 · 右命盘排盘 */}
              <div className="grid grid-cols-1 gap-2.5 min-[680px]:grid-cols-12">
                {/* 紧凑即时起卦 */}
                <Card
                  className={cn(
                    'flex flex-col justify-start gap-2 rounded-xl border bg-[var(--surface-elevated-strong)] p-3 shadow-xs min-[680px]:col-span-6',
                    isEditing
                      ? 'border-dashed border-[color-mix(in_srgb,var(--accent)_55%,var(--border-soft))]'
                      : 'border-[var(--border-soft)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex size-5.5 shrink-0 items-center justify-center rounded-md bg-[var(--accent-strong)] font-serif text-[11px] font-bold text-white">
                        卦
                      </span>
                      <strong className="text-[13px] font-extrabold text-[var(--text-strong)]">
                        即时起卦
                      </strong>
                    </div>
                    <Button
                      variant="secondary"
                      size="xs"
                      className="h-6.5 px-2 text-[11px] tabular-nums"
                      onClick={onToggleTimeStandard}
                    >
                      {homeInstantTimeStandard === 'true-solar' ? '真太阳时' : '北京时间'}
                    </Button>
                  </div>

                  {homeInstantTimeStandard === 'true-solar' ? (
                    <div className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2.5 py-1 text-[11px]">
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

                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {visibleInstantCastItems.map((item) =>
                      isEditing ? (
                        <div
                          key={item.id}
                          className="flex h-8 items-center justify-between gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2"
                        >
                          <span className="truncate text-[11.5px] font-bold text-[var(--text-strong)]">
                            {item.label}
                          </span>
                          <button
                            type="button"
                            aria-label={`移除即时起卦 ${item.label}`}
                            onClick={() => onToggleHomeItem('instantCastIds', item.id)}
                            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border-0 bg-[var(--surface-elevated)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--danger-text)] hover:text-white"
                          >
                            <X className="h-2.5 w-2.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onOneClickInstantCast(item.id)}
                          className="group flex h-8 items-center gap-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-2 text-left transition-colors cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)]"
                        >
                          <span className="inline-flex size-4.5 shrink-0 items-center justify-center rounded bg-[var(--surface-soft)] font-serif text-[10px] font-bold text-[var(--text-muted)] group-hover:text-[var(--accent-strong)]">
                            {item.mark}
                          </span>
                          <span className="truncate text-[11.5px] font-bold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                            {item.label}
                          </span>
                        </button>
                      ),
                    )}

                    {isEditing ? (
                      <button
                        type="button"
                        aria-label="添加即时起卦图标"
                        onClick={() => setPickerMode('instantCast')}
                        className="flex h-8 items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated)]/55 px-2 text-[11px] font-semibold text-[var(--text-muted)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>添加</span>
                      </button>
                    ) : null}
                  </div>
                </Card>

                {/* 紧凑命盘排盘 */}
                <Card
                  aria-label="命盘排盘与档案"
                  className={cn(
                    'flex flex-col justify-between gap-2 rounded-xl border bg-[var(--surface-elevated-strong)] p-3 shadow-xs min-[680px]:col-span-6',
                    isEditing
                      ? 'border-dashed border-[color-mix(in_srgb,var(--accent)_55%,var(--border-soft))]'
                      : 'border-[var(--border-soft)]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex size-5.5 shrink-0 items-center justify-center rounded-md bg-[var(--accent-strong)] font-serif text-[11px] font-bold text-white">
                        盘
                      </span>
                      <strong className="text-[13px] font-extrabold text-[var(--text-strong)]">
                        命盘排盘
                      </strong>
                    </div>
                    <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--text-muted)]">
                      {caseCount > 0 ? `${caseCount} 份档案` : '八字 · 紫微 · 星盘'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    {visibleChartEntries.map((entry) => {
                      const Icon = getShortcutIcon(entry.id);
                      const isPrimary = entry.id === 'single';
                      return isEditing ? (
                        <div
                          key={entry.id}
                          className="flex h-9 items-center justify-between gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-soft)] px-2"
                        >
                          <span className="truncate text-[11.5px] font-bold text-[var(--text-strong)]">
                            {entry.label}
                          </span>
                          <button
                            type="button"
                            aria-label={`移除 ${entry.label}`}
                            onClick={() => onToggleHomeItem('chartEntryIds', entry.id)}
                            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full border-0 bg-[var(--surface-elevated)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--danger-text)] hover:text-white"
                          >
                            <X className="h-2.5 w-2.5" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => handleChartEntryClick(entry.id)}
                          className={cn(
                            'group flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-left transition-colors cursor-pointer',
                            isPrimary
                              ? 'border-[color-mix(in_srgb,var(--accent)_35%,var(--border-soft))] bg-[var(--state-selected-surface)] text-[var(--state-selected-text)] hover:border-[var(--accent)]'
                              : 'border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-strong)] hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)]',
                          )}
                        >
                          {isPrimary ? (
                            <User className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                          ) : (
                            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--accent-strong)]" />
                          )}
                          <span className="truncate text-[12px] font-bold">{entry.label}</span>
                        </button>
                      );
                    })}

                    {isEditing ? (
                      <button
                        type="button"
                        aria-label="添加命盘排盘入口"
                        onClick={() => setPickerMode('chart')}
                        className="flex h-9 items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated)]/55 px-2 text-[11px] font-semibold text-[var(--text-muted)] cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                      >
                        <Plus className="h-3 w-3" aria-hidden="true" />
                        <span>添加</span>
                      </button>
                    ) : null}
                  </div>

                  {visibleInstantChips.length > 0 || isEditing ? (
                    <div className="flex flex-wrap items-center justify-between gap-1.5 border-t border-[var(--border-soft)]/70 pt-1.5">
                      <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                        当下即时
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {visibleInstantChips.map((chip) =>
                          isEditing ? (
                            <div
                              key={chip.id}
                              className="inline-flex items-center gap-1 rounded-md border border-[var(--border-soft)] bg-[var(--surface-soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--text-strong)]"
                            >
                              <span>{chip.label}</span>
                              <button
                                type="button"
                                aria-label={`移除当下即时 ${chip.label}`}
                                onClick={() => onToggleHomeItem('instantChipIds', chip.id)}
                                className="inline-flex size-3.5 items-center justify-center rounded-full border-0 bg-[var(--surface-elevated)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--danger-text)] hover:text-white"
                              >
                                <X className="h-2 w-2" aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <button
                              key={chip.id}
                              type="button"
                              onClick={() => onOneClickInstantCast(chip.id)}
                              className="rounded-md border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-2 py-0.5 text-[11px] font-bold text-[var(--text-strong)] cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)] hover:text-[var(--accent-strong)]"
                            >
                              {chip.label}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                  ) : null}
                </Card>
              </div>

              {/* 紧凑快捷功能条 */}
              <div
                aria-label="首页快捷功能"
                className="grid grid-cols-3 gap-1.5 min-[680px]:grid-cols-4 lg:grid-cols-6 min-[680px]:gap-2"
              >
                {visibleHomeCards.map((card) => {
                  const nicheMark = NICHE_CARD_MARKS[card.id];
                  const Icon = getShortcutIcon(card.id);
                  const useAccentSoft = ACCENT_SOFT_CARD_IDS.has(card.id);
                  const iconBadge = (
                    <span
                      className={cn(
                        'inline-flex size-6.5 shrink-0 items-center justify-center rounded-lg text-[var(--accent-strong)]',
                        useAccentSoft ? 'bg-[var(--accent-soft)]' : 'bg-[var(--surface-soft)]',
                        nicheMark && 'font-serif text-xs font-bold',
                      )}
                    >
                      {nicheMark ?? <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                  );

                  if (isEditing) {
                    return (
                      <div
                        key={card.id}
                        className="flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-dashed border-[color-mix(in_srgb,var(--accent)_45%,var(--border-soft))] bg-[var(--surface-elevated-strong)] px-2.5 py-1.5"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          {iconBadge}
                          <strong className="truncate text-[12px] font-bold text-[var(--text-strong)]">
                            {card.label}
                          </strong>
                        </span>
                        <button
                          type="button"
                          aria-label={`移除快捷卡片 ${card.label}`}
                          onClick={() => onToggleHomeItem('cardIds', card.id)}
                          className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border-0 bg-[var(--surface-soft)] text-[var(--text-muted)] cursor-pointer hover:bg-[var(--danger-text)] hover:text-white"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => onOpenCustomShortcutTarget(card.id)}
                      className="group flex min-h-[44px] items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] px-2.5 py-1.5 text-left transition-all cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--surface-panel)]"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        {iconBadge}
                        <strong className="truncate text-[12px] font-bold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                          {card.label}
                        </strong>
                      </span>
                      <ArrowUpRight
                        className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] opacity-50 group-hover:text-[var(--accent-strong)] group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPickerMode('cards')}
                  className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated)]/45 px-2.5 py-1.5 text-[12px] font-semibold text-[var(--text-muted)] opacity-80 transition-all cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent-strong)] hover:opacity-100"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>添加卡片</span>
                </button>
              </div>
            </section>
            ) : null}
          </>
        ) : (
          <>
            <div className="hidden min-[680px]:block">
              <PageHeader
                title="命语"
                rightSlot={editControls}
              />
            </div>

            {onApplyLocalAgentRecommendation ? (
              <LocalAgentBar onApplyRecommendation={onApplyLocalAgentRecommendation} />
            ) : null}

        {/* 1. 顶部 7:5 错落主区：左「即时起卦」，右统一「命盘排盘」整合卡片 */}
        <section
          aria-label="核心起卦与排盘区"
          className="grid grid-cols-1 gap-2.5 min-[680px]:grid-cols-12 min-[680px]:gap-4 min-[680px]:items-stretch"
        >
          {/* 左侧 7 列：即时起卦 */}
          <Card
            className={cn(
              'relative flex flex-col justify-start gap-2.5 min-[680px]:gap-3 overflow-hidden rounded-xl min-[680px]:rounded-2xl border bg-gradient-to-br from-[var(--surface-elevated-strong)] via-[var(--surface-elevated-strong)] to-[color-mix(in_srgb,var(--accent-soft)_32%,var(--surface-base))] p-3 min-[680px]:p-4 sm:p-5 shadow-[0_2px_12px_rgba(32,24,16,0.035)] min-[680px]:col-span-7',
              isEditing
                ? 'border-dashed border-[color-mix(in_srgb,var(--accent)_55%,var(--border-soft))]'
                : 'border-[var(--border-soft)]',
            )}
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex size-6.5 min-[680px]:size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-strong)] font-serif text-xs font-bold text-white shadow-xs">
                    卦
                  </span>
                  <h2 className="m-0 whitespace-nowrap text-[14.5px] min-[680px]:text-[15.5px] font-extrabold tracking-[-0.01em] text-[var(--text-strong)]">
                    即时起卦
                  </h2>
                  <span className="whitespace-nowrap font-mono text-[11px] min-[680px]:text-[12px] font-medium tabular-nums text-[var(--text-muted)]">
                    {dateStr} · {clockStr}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="secondary"
                    size="xs"
                    className="h-6.5 min-[680px]:h-7 min-w-[66px] min-[680px]:min-w-[74px] shrink-0 justify-center px-2 text-[11px] tabular-nums"
                    onClick={onToggleTimeStandard}
                  >
                    {homeInstantTimeStandard === 'true-solar' ? '真太阳时' : '北京时间'}
                  </Button>
                  <div className="min-[680px]:hidden">{editControls}</div>
                </div>
              </div>

              {homeInstantTimeStandard === 'true-solar' ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)]/85 px-3 py-1.5 text-xs">
                  <span className="whitespace-nowrap text-[var(--text-muted)]">真太阳时参考地</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 max-w-[200px] truncate px-2 font-semibold text-[var(--accent-strong)]"
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
                  >
                    {homeInstantPlace.displayName} · 更换
                  </Button>
                </div>
              ) : null}
            </div>

            {visibleInstantCastItems.length === 0 && !isEditing ? (
              <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-elevated)]/45 px-4 text-xs text-[var(--text-muted)]">
                暂无即时起卦项目，点击右上角编辑图标添加
              </div>
            ) : (
              <div
                className="grid grid-cols-3 gap-1.5 min-[680px]:grid-cols-3 min-[680px]:gap-2"
                role="group"
                aria-label="点击直接按当下时间起卦"
              >
                {visibleInstantCastItems.map((item) =>
                  isEditing ? (
                    <div
                      key={item.id}
                      className="flex h-9 min-[680px]:h-10 items-center justify-between gap-1 rounded-lg min-[680px]:rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)]/95 px-2 min-[680px]:px-2.5"
                    >
                      <span className="flex min-w-0 items-center gap-1.5 min-[680px]:gap-2">
                        <span className="inline-flex size-5 min-[680px]:size-5.5 shrink-0 items-center justify-center rounded-md bg-[var(--surface-soft)] font-serif text-[11px] min-[680px]:text-[11.5px] font-bold text-[var(--text-muted)]">
                          {item.mark}
                        </span>
                        <span className="truncate text-[12px] min-[680px]:text-[13px] font-bold text-[var(--text-strong)]">
                          {item.label}
                        </span>
                      </span>
                      <button
                        type="button"
                        aria-label={`移除即时起卦 ${item.label}`}
                        title={`移除 ${item.label}`}
                        onClick={() => onToggleHomeItem('instantCastIds', item.id)}
                        className="inline-flex size-4.5 shrink-0 items-center justify-center rounded-full border-0 bg-[var(--surface-soft)] text-[var(--text-muted)] transition-colors cursor-pointer hover:bg-[var(--danger-text)] hover:text-white"
                      >
                        <X className="h-2.5 w-2.5" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOneClickInstantCast(item.id)}
                      className="group flex h-9 min-[680px]:h-10 items-center gap-1.5 min-[680px]:gap-2 rounded-lg min-[680px]:rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)]/90 px-2 min-[680px]:px-2.5 text-left transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--surface-elevated-strong)] hover:shadow-xs"
                    >
                      <span className="inline-flex size-5 min-[680px]:size-5.5 shrink-0 items-center justify-center rounded-md bg-[var(--surface-soft)] font-serif text-[11px] min-[680px]:text-[11.5px] font-bold text-[var(--text-muted)] transition-colors group-hover:bg-[var(--state-selected-surface)] group-hover:text-[var(--accent-strong)]">
                        {item.mark}
                      </span>
                      <span className="truncate text-[12px] min-[680px]:text-[13px] font-bold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                        {item.label}
                      </span>
                    </button>
                  ),
                )}

                {isEditing ? (
                  <button
                    type="button"
                    aria-label="添加即时起卦图标"
                    onClick={() => setPickerMode('instantCast')}
                    className="flex h-9 min-[680px]:h-10 items-center justify-center gap-1 rounded-lg min-[680px]:rounded-xl border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated)]/55 px-2 text-[12px] font-semibold text-[var(--text-muted)] transition-colors cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--surface-elevated)] hover:text-[var(--accent-strong)]"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>添加</span>
                  </button>
                ) : null}
              </div>
            )}
          </Card>

          {/* 右侧 5 列：命盘排盘统一整合大卡片 */}
          <Card
            aria-label="命盘排盘与档案"
            className={cn(
              'relative flex flex-col justify-between gap-2.5 min-[680px]:gap-3 overflow-hidden rounded-xl min-[680px]:rounded-2xl border bg-gradient-to-br from-[var(--surface-elevated-strong)] via-[var(--surface-elevated-strong)] to-[color-mix(in_srgb,var(--accent-soft)_26%,var(--surface-base))] p-3 min-[680px]:p-4 sm:p-5 shadow-[0_2px_12px_rgba(32,24,16,0.035)] min-[680px]:col-span-5',
              isEditing
                ? 'border-dashed border-[color-mix(in_srgb,var(--accent)_55%,var(--border-soft))]'
                : 'border-[var(--border-soft)]',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-strong)] font-serif text-xs font-bold text-white shadow-xs">
                  盘
                </span>
                <h2 className="m-0 whitespace-nowrap text-[15.5px] font-extrabold tracking-[-0.01em] text-[var(--text-strong)]">
                  命盘排盘
                </h2>
              </div>
              <span className="whitespace-nowrap rounded-full border border-[var(--border-soft)] bg-[var(--surface-elevated)]/90 px-2.5 py-0.5 text-[11.5px] font-semibold text-[var(--text-muted)]">
                {caseCount > 0 ? `${caseCount} 份档案` : '八字 · 紫微 · 星盘'}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2.5">
              {visibleChartEntries.length === 0 && !isEditing ? (
                <div className="flex flex-1 min-h-[120px] items-center justify-center rounded-xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-elevated)]/45 px-4 text-xs text-[var(--text-muted)]">
                  暂无排盘入口，点击右上角编辑图标添加
                </div>
              ) : (
                <>
                  {primaryChartEntry
                    ? isEditing
                      ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-[color-mix(in_srgb,var(--accent)_26%,var(--border-soft))] bg-gradient-to-br from-[color-mix(in_srgb,var(--state-selected-surface)_72%,var(--surface-elevated-strong))] to-[var(--surface-elevated-strong)] px-4 py-3 text-left">
                          <span className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-strong)] text-white shadow-xs">
                              <User className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="flex min-w-0 flex-col">
                              <strong className="text-[15px] font-extrabold tracking-[-0.01em] text-[var(--text-strong)]">
                                {primaryChartEntry.label}
                              </strong>
                              <span className="truncate text-[11.5px] text-[var(--text-muted)]">
                                {primaryChartEntry.hint}
                              </span>
                            </span>
                          </span>
                          <button
                            type="button"
                            aria-label={`移除 ${primaryChartEntry.label}`}
                            title={`移除 ${primaryChartEntry.label}`}
                            onClick={() => onToggleHomeItem('chartEntryIds', primaryChartEntry.id)}
                            className={REMOVE_BADGE_BTN_CLS}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        )
                      : (
                        <button
                          type="button"
                          onClick={() => handleChartEntryClick(primaryChartEntry.id)}
                          className="group flex items-center justify-between gap-2.5 rounded-xl border border-[color-mix(in_srgb,var(--accent)_26%,var(--border-soft))] bg-gradient-to-br from-[color-mix(in_srgb,var(--state-selected-surface)_72%,var(--surface-elevated-strong))] to-[var(--surface-elevated-strong)] px-3 py-2.5 min-[680px]:px-4 min-[680px]:py-3 text-left transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-xs"
                        >
                          <span className="flex min-w-0 items-center gap-2.5 min-[680px]:gap-3">
                            <span className="inline-flex size-8 min-[680px]:size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-strong)] text-white shadow-xs">
                              <User className="h-4 w-4" aria-hidden="true" />
                            </span>
                            <span className="flex min-w-0 flex-col">
                              <strong className="text-[14px] min-[680px]:text-[15px] font-extrabold tracking-[-0.01em] text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                                {primaryChartEntry.label}
                              </strong>
                              <span className="truncate text-[11px] min-[680px]:text-[11.5px] text-[var(--text-muted)]">
                                {primaryChartEntry.hint}
                              </span>
                            </span>
                          </span>
                          <ArrowUpRight
                            className="h-4 w-4 shrink-0 text-[var(--accent-strong)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                            aria-hidden="true"
                          />
                        </button>
                        )
                    : null}

                  {(secondaryChartEntries.length > 0 || isEditing) ? (
                    <div className="grid flex-1 grid-cols-2 gap-2.5">
                      {secondaryChartEntries.map((sub) => {
                        const Icon = getShortcutIcon(sub.id);
                        return isEditing ? (
                          <div
                            key={sub.id}
                            className="flex flex-col justify-between gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)]/92 p-3 text-left"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex size-7.5 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              </span>
                              <button
                                type="button"
                                aria-label={`移除 ${sub.label}`}
                                title={`移除 ${sub.label}`}
                                onClick={() => onToggleHomeItem('chartEntryIds', sub.id)}
                                className={REMOVE_BADGE_BTN_CLS}
                              >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                            <div className="min-w-0">
                              <strong className="block truncate text-[13.5px] font-extrabold text-[var(--text-strong)]">
                                {sub.label}
                              </strong>
                              <span className="block truncate text-[11px] text-[var(--text-muted)]">
                                {sub.hint}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleChartEntryClick(sub.id)}
                            className="group flex flex-col justify-between gap-1.5 min-[680px]:gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)]/92 p-2.5 min-[680px]:p-3 text-left transition-all duration-150 cursor-pointer hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--surface-elevated-strong)] hover:shadow-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="inline-flex size-6.5 min-[680px]:size-7.5 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              </span>
                              <ArrowUpRight
                                className="h-3.5 w-3.5 text-[var(--text-muted)] opacity-55 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--accent-strong)] group-hover:opacity-100"
                                aria-hidden="true"
                              />
                            </div>
                            <div className="min-w-0">
                              <strong className="block truncate text-[13px] min-[680px]:text-[13.5px] font-extrabold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                                {sub.label}
                              </strong>
                              <span className="hidden min-[680px]:block truncate text-[11px] text-[var(--text-muted)]">
                                {sub.hint}
                              </span>
                            </div>
                          </button>
                        );
                      })}

                      {isEditing ? (
                        <button
                          type="button"
                          aria-label="添加命盘排盘入口"
                          onClick={() => setPickerMode('chart')}
                          className="flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated)]/50 p-3 text-[12px] font-semibold text-[var(--text-muted)] transition-colors cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--surface-elevated)] hover:text-[var(--accent-strong)]"
                        >
                          <Plus className="h-4 w-4" aria-hidden="true" />
                          <span>添加入口</span>
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {(visibleInstantChips.length > 0 || isEditing) ? (
              <div className="flex items-center justify-between gap-2 border-t border-[var(--border-soft)]/80 pt-2.5">
                <span className="whitespace-nowrap text-[11.5px] font-semibold text-[var(--text-muted)]">
                  当下即时
                </span>
                <div
                  className="flex flex-wrap items-center justify-end gap-1.5"
                  role="group"
                  aria-label="当下时刻即时排盘"
                >
                  {visibleInstantChips.map((chip) =>
                    isEditing ? (
                      <div
                        key={chip.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated)] py-0.5 pl-2.5 pr-1 text-[12px] font-bold text-[var(--text-strong)]"
                      >
                        <span>{chip.label}</span>
                        <button
                          type="button"
                          aria-label={`移除当下即时 ${chip.label}`}
                          title={`移除 ${chip.label}`}
                          onClick={() => onToggleHomeItem('instantChipIds', chip.id)}
                          className="inline-flex size-4 items-center justify-center rounded-full border-0 bg-[var(--surface-soft)] text-[var(--text-muted)] transition-colors cursor-pointer hover:bg-[var(--danger-text)] hover:text-white"
                        >
                          <X className="h-2.5 w-2.5" aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => onOneClickInstantCast(chip.id)}
                        className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-2.5 py-1 text-[12px] font-bold text-[var(--text-strong)] transition-colors cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-selected-surface)] hover:text-[var(--accent-strong)]"
                      >
                        {chip.label}
                      </button>
                    ),
                  )}
                  {isEditing ? (
                    <button
                      type="button"
                      aria-label="添加当下即时项目"
                      title="添加当下即时项目"
                      onClick={() => setPickerMode('chart')}
                      className="inline-flex h-6.5 items-center gap-0.5 rounded-lg border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated)]/60 px-2 text-[11.5px] font-semibold text-[var(--text-muted)] transition-colors cursor-pointer hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" />
                      <span>添加</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Card>
        </section>

        {/* 2. 首页快捷功能卡片区（4 列网格，常规模式统一无删除键，编辑模式可增删全部卡片） */}
        <section
          aria-label="首页快捷功能"
          className="grid grid-cols-2 gap-2 min-[680px]:grid-cols-4 min-[680px]:gap-3.5"
        >
          {visibleHomeCards.map((card) => {
            const nicheMark = NICHE_CARD_MARKS[card.id];
            const Icon = getShortcutIcon(card.id);
            const useAccentSoft = ACCENT_SOFT_CARD_IDS.has(card.id);
            const iconBadge = (
              <span
                className={cn(
                  'inline-flex size-9 items-center justify-center rounded-xl text-[var(--accent-strong)]',
                  useAccentSoft ? 'bg-[var(--accent-soft)]' : 'bg-[var(--surface-soft)]',
                  nicheMark && 'font-serif text-sm font-bold',
                )}
              >
                {nicheMark ?? <Icon className="h-4 w-4" aria-hidden="true" />}
              </span>
            );

            if (isEditing) {
              return (
                <div
                  key={card.id}
                  className={cn(
                    STUDIO_TILE_CLS,
                    'flex min-h-[104px] flex-col justify-between gap-3 border-dashed border-[color-mix(in_srgb,var(--accent)_45%,var(--border-soft))] p-4 sm:p-5 text-left hover:translate-y-0',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    {iconBadge}
                    <button
                      type="button"
                      aria-label={`移除快捷卡片 ${card.label}`}
                      title="移除此卡片"
                      onClick={() => onToggleHomeItem('cardIds', card.id)}
                      className={REMOVE_BADGE_BTN_CLS}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <strong className="truncate text-[15px] font-extrabold text-[var(--text-strong)]">
                    {card.label}
                  </strong>
                </div>
              );
            }

            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onOpenCustomShortcutTarget(card.id)}
                className={cn(
                  STUDIO_TILE_CLS,
                  'group flex min-h-[104px] flex-col justify-between gap-3 p-4 sm:p-5 text-left cursor-pointer',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  {iconBadge}
                  <ArrowUpRight
                    className="h-4 w-4 shrink-0 text-[var(--text-muted)] opacity-55 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--accent-strong)] group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </div>
                <strong className="truncate text-[15px] font-extrabold text-[var(--text-strong)] group-hover:text-[var(--accent-strong)]">
                  {card.label}
                </strong>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setPickerMode('cards')}
            className="flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border-contrast)] bg-[var(--surface-elevated)]/45 p-4 text-[13px] font-semibold text-[var(--text-muted)] opacity-75 transition-all cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--surface-elevated)]/85 hover:text-[var(--accent-strong)] hover:opacity-100"
          >
            <Plus className="h-4.5 w-4.5" aria-hidden="true" />
            <span>添加快捷卡片</span>
          </button>
        </section>
          </>
        )}
      </div>

      {/* 首页图标与卡片编辑弹窗 */}
      <Dialog
        open={pickerMode !== null}
        onOpenChange={(open) => {
          if (!open) setPickerMode(null);
        }}
      >
        <DialogContent className="max-w-lg" aria-label={pickerMeta.ariaLabel}>
          <DialogHeader>
            <DialogTitle>{pickerMeta.title}</DialogTitle>
            <DialogDescription>{pickerMeta.description}</DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto px-5 py-4">
            {pickerGroups.map((group) => (
              <div key={group.title} className="grid gap-2">
                <span className="text-xs font-extrabold text-[var(--text-muted)]">
                  {group.title}
                </span>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((opt) => {
                    const added = group.selectedIds.includes(opt.id);
                    return (
                      <Button
                        key={opt.id}
                        variant={added ? 'pillActive' : 'pill'}
                        size="sm"
                        onClick={() => onToggleHomeItem(group.section, opt.id)}
                      >
                        {added ? `✓ ${opt.label}` : `+ ${opt.label}`}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button variant="primary" size="md" onClick={() => setPickerMode(null)}>
              完成
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
