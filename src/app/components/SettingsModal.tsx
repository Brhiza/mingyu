import * as React from 'react';
import {
  BookOpen,
  Bot,
  ChevronRight,
  Clock,
  Database,
  Download,
  MapPin,
  Moon,
  Palette,
  RotateCcw,
  Sparkles,
  Sun,
  Upload,
} from 'lucide-react';
import { WebAiConfigForm } from './WebAiConfigForm';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import { downloadLocalDataBackup, importLocalDataBackup } from '../../v2-ui/data-backup';
import {
  DEFAULT_LOCAL_ROUTER_SETTINGS,
  ROUTER_METHOD_CATALOG,
  loadLocalRouterSettings,
  resetLocalRouterPreferences,
  saveLocalRouterSettings,
  type LocalRouterSettings,
  type RouterMethodItem,
  type RouterPreferenceWeight,
} from '../../router-model/local-preferences';
import type { MethodId as RouterMethodId, TraditionPref } from '../../router-model/features';
import type { DivinationFormMethod } from '../../v2-ui/divination-forms';
import { PERSONAL_CHART_TABS, type PersonalChartTabId } from '../../v2-ui/result-page';
import {
  DEFAULT_GLOBAL_RULES,
  GLOBAL_RULE_SECTIONS,
  TAROT_DECK_OPTIONS,
  loadGlobalRules,
  type GlobalRuleFieldDescriptor,
  type GlobalRulesSettings,
} from '../../web-settings';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  Switch,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import {
  DIVINATION_METHOD_OPTIONS,
  WORKSPACE_THEME_DEFINITIONS,
  applyWorkspaceTheme,
  getDisplayThemeMode,
  setDisplayThemeMode,
  type HomePinActionMode,
  type WorkspacePreferences,
} from '../workspace-catalog';

export interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: WorkspacePreferences;
  homePinActionMode: HomePinActionMode;
  birthPlaceModal: BirthPlaceModalController;
  onHomePinActionModeChange: (mode: HomePinActionMode) => void;
  onSaveAll: (nextPrefs: WorkspacePreferences, nextRules: GlobalRulesSettings) => void;
  onOpenAiConnect: () => void;
}

type SettingsPageId = 'general' | 'router' | 'ai' | 'time-casting' | 'calendar-school' | 'data';

const SETTINGS_PAGES: ReadonlyArray<{
  id: SettingsPageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'general', label: '外观与常用', icon: Palette },
  { id: 'router', label: '小模型路由', icon: Sparkles },
  { id: 'ai', label: 'AI 模型', icon: Bot },
  { id: 'time-casting', label: '时间与起卦', icon: Clock },
  { id: 'calendar-school', label: '历法与流派', icon: BookOpen },
  { id: 'data', label: '本地数据', icon: Database },
];

const DIVINATION_DEFAULT_CHOICES = DIVINATION_METHOD_OPTIONS.filter(
  (o) => o.id !== 'almanac' && o.id !== 'residential',
);

function getItemIds(item: RouterMethodItem): RouterMethodId[] {
  return [item.id, ...(item.linkedIds ?? [])];
}

export function SettingsModal({
  open,
  onOpenChange,
  preferences,
  birthPlaceModal,
  onSaveAll,
  onOpenAiConnect,
}: SettingsModalProps) {
  const [activePage, setActivePage] = React.useState<SettingsPageId>('general');
  const [draft, setDraft] = React.useState<WorkspacePreferences>(() => ({ ...preferences }));
  const [rulesDraft, setRulesDraft] = React.useState<GlobalRulesSettings>(() => loadGlobalRules());
  const [routerSettings, setRouterSettings] = React.useState<LocalRouterSettings>(() =>
    loadLocalRouterSettings(),
  );
  const [colorScheme, setColorScheme] = React.useState<'light' | 'dark'>(() =>
    getDisplayThemeMode(),
  );
  const didSaveRef = React.useRef(false);
  const backupFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const contentScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [backupNotice, setBackupNotice] = React.useState<{
    tone: 'good' | 'warn';
    text: string;
  } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    didSaveRef.current = false;
    setDraft({
      ...preferences,
      homeModeOrder: [...preferences.homeModeOrder],
      navigationOrder: [...preferences.navigationOrder],
    });
    setRulesDraft(loadGlobalRules());
    setRouterSettings(loadLocalRouterSettings());
    setBackupNotice(null);
    setColorScheme(getDisplayThemeMode());
  }, [open, preferences]);

  const handleClose = () => {
    if (!didSaveRef.current) {
      applyWorkspaceTheme(preferences.theme);
    }
    onOpenChange(false);
  };

  const toggleScheme = () => {
    const next = colorScheme === 'dark' ? 'light' : 'dark';
    setColorScheme(next);
    setDisplayThemeMode(next);
  };

  const updateTimeRule = <K extends keyof GlobalRulesSettings['time']>(
    key: K,
    value: GlobalRulesSettings['time'][K],
  ) => {
    setRulesDraft((prev) => ({
      ...prev,
      time: { ...prev.time, [key]: value },
    }));
  };

  const updateCastingRule = <K extends keyof GlobalRulesSettings['casting']>(
    key: K,
    value: GlobalRulesSettings['casting'][K],
  ) => {
    setRulesDraft((prev) => ({
      ...prev,
      casting: { ...prev.casting, [key]: value },
    }));
  };

  const applyCastingPreset = (mode: 'manual' | 'auto') => {
    setRulesDraft((prev) => ({
      ...prev,
      casting: {
        ...prev.casting,
        preferManualMode: mode,
        liuyaoDefaultMethod: mode === 'manual' ? 'coins' : 'time',
        meihuaDefaultMethod: mode === 'manual' ? 'number' : 'time',
        jinkoujueDefaultMethod: mode === 'manual' ? 'branch' : 'time',
        tarotDefaultDrawMode: mode === 'manual' ? 'interactive' : 'random',
        lenormandDefaultDrawMode: mode === 'manual' ? 'interactive' : 'random',
        ssgwDefaultMode: mode === 'manual' ? 'interactive' : 'random',
        kongmingDefaultMode: mode === 'manual' ? 'manual' : 'random',
      },
    }));
  };

  const updateSectionField = (
    group: keyof GlobalRulesSettings,
    key: string,
    value: unknown,
  ) => {
    setRulesDraft((prev) => ({
      ...prev,
      [group]: {
        ...(prev[group] as Record<string, unknown>),
        [key]: value,
      },
    }));
  };

  const toggleRouterMethodItem = (item: RouterMethodItem) => {
    const ids = getItemIds(item);
    setRouterSettings((prev) => {
      const nextSet = new Set(prev.disabledMethods);
      const isEnabled = !nextSet.has(item.id);
      if (isEnabled) {
        for (const id of ids) nextSet.add(id);
      } else {
        for (const id of ids) nextSet.delete(id);
      }
      return {
        ...prev,
        preferredChart:
          prev.preferredChart && nextSet.has(prev.preferredChart) ? null : prev.preferredChart,
        preferredDivination:
          prev.preferredDivination && nextSet.has(prev.preferredDivination)
            ? null
            : prev.preferredDivination,
        disabledMethods: [...nextSet],
      };
    });
  };

  const toggleRouterCategory = (items: readonly RouterMethodItem[], enableAll: boolean) => {
    setRouterSettings((prev) => {
      const nextSet = new Set(prev.disabledMethods);
      for (const item of items) {
        for (const id of getItemIds(item)) {
          if (enableAll) nextSet.delete(id);
          else nextSet.add(id);
        }
      }
      return {
        ...prev,
        preferredChart:
          prev.preferredChart && nextSet.has(prev.preferredChart) ? null : prev.preferredChart,
        preferredDivination:
          prev.preferredDivination && nextSet.has(prev.preferredDivination)
            ? null
            : prev.preferredDivination,
        disabledMethods: [...nextSet],
      };
    });
  };

  const handleSave = () => {
    didSaveRef.current = true;
    saveLocalRouterSettings(routerSettings);
    onSaveAll(draft, rulesDraft);
    onOpenChange(false);
  };

  const disabledSet = React.useMemo(
    () => new Set(routerSettings.disabledMethods),
    [routerSettings.disabledMethods],
  );

  const totalCatalogCount = React.useMemo(
    () => ROUTER_METHOD_CATALOG.reduce((sum, cat) => sum + cat.items.length, 0),
    [],
  );
  const enabledCatalogCount = React.useMemo(
    () =>
      ROUTER_METHOD_CATALOG.reduce(
        (sum, cat) => sum + cat.items.filter((item) => !disabledSet.has(item.id)).length,
        0,
      ),
    [disabledSet],
  );

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        className="workspace-settings-modal h-[min(680px,86dvh)] max-h-[86dvh] w-[min(800px,calc(100vw-1.5rem))] max-w-[800px]"
        showClose={false}
        aria-labelledby="workspace-settings-title"
      >
        <DialogHeader className="workspace-settings-head px-5 py-3.5 pr-5">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle id="workspace-settings-title">设置</DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              关闭
            </Button>
          </div>
        </DialogHeader>

        {/* 顶部横向分页切换 */}
        <nav
          aria-label="设置分页"
          className="flex shrink-0 flex-row items-center gap-1 overflow-x-auto border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {SETTINGS_PAGES.map((page) => {
            const Icon = page.icon;
            const active = activePage === page.id;
            return (
              <button
                key={page.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => {
                  setActivePage(page.id);
                  contentScrollRef.current?.scrollTo({ top: 0 });
                }}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border-0 px-3 py-1.5 text-[12.5px] font-bold transition-colors cursor-pointer',
                  active
                    ? 'bg-[var(--state-selected-surface-strong)] text-[var(--state-selected-text)]'
                    : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--state-hover-surface)] hover:text-[var(--text-strong)]',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{page.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 固定高度滚动内容区 */}
        <div
          ref={contentScrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5"
        >
            {activePage === 'general' ? (
              <div className="grid gap-4">
                {/* 主题色与明暗 */}
                <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                      主题色与明暗
                    </h3>
                    <Button variant="secondary" size="xs" onClick={toggleScheme}>
                      {colorScheme === 'dark' ? (
                        <>
                          <Sun className="h-3.5 w-3.5" />
                          <span>亮色</span>
                        </>
                      ) : (
                        <>
                          <Moon className="h-3.5 w-3.5" />
                          <span>暗色</span>
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="主题色">
                    {WORKSPACE_THEME_DEFINITIONS.map((theme) => {
                      const active = draft.theme === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => {
                            setDraft((prev) => ({ ...prev, theme: theme.id }));
                            applyWorkspaceTheme(theme.id);
                          }}
                          className={cn(
                            'flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs cursor-pointer transition-all',
                            active
                              ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface)] font-bold text-[var(--state-selected-text)]'
                              : 'border-[var(--border-soft)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                          )}
                        >
                          <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                            {theme.swatches.map((hex) => (
                              <i
                                key={hex}
                                className="block h-2.5 w-2.5 rounded-full border border-black/10"
                                style={{ backgroundColor: hex }}
                              />
                            ))}
                          </span>
                          <span className="whitespace-nowrap text-[11.5px]">{theme.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* 默认排盘与起卦 */}
                <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                  <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                    默认术数
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>常用排盘</span>
                      <Select
                        value={draft.defaultChartFeature}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            defaultChartFeature: e.target.value as PersonalChartTabId,
                          }))
                        }
                      >
                        {PERSONAL_CHART_TABS.map((tab) => (
                          <option key={tab.id} value={tab.id}>
                            {tab.label}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>常用起卦</span>
                      <Select
                        value={draft.defaultDivinationFeature}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            defaultDivinationFeature: e.target.value as DivinationFormMethod,
                          }))
                        }
                      >
                        {DIVINATION_DEFAULT_CHOICES.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </label>
                  </div>
                </section>

                {/* 塔罗牌面套牌 */}
                <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                  <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                    塔罗牌面套牌
                  </h3>
                  <div
                    className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                    role="radiogroup"
                    aria-label="选择塔罗牌面套牌"
                  >
                    {TAROT_DECK_OPTIONS.map((deck) => {
                      const isSelected = rulesDraft.casting.tarotDeck === deck.id;
                      return (
                        <button
                          key={deck.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => updateCastingRule('tarotDeck', deck.id)}
                          className={cn(
                            'flex items-center gap-2 rounded-lg border p-2 text-left transition-all cursor-pointer',
                            isSelected
                              ? 'border-[var(--accent)] bg-[var(--state-selected-surface)] shadow-xs'
                              : 'border-[var(--border-soft)] bg-[var(--surface-base)] hover:border-[var(--border-contrast)]',
                          )}
                        >
                          <span className="h-9 w-6 shrink-0 overflow-hidden rounded bg-[var(--surface-soft)]">
                            <img
                              src={`/card-decks/tarot/${deck.id}/000.webp`}
                              alt={deck.label}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          </span>
                          <strong className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--text-strong)]">
                            {deck.label.replace('（默认）', '')}
                          </strong>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>
            ) : activePage === 'router' ? (
              <div className="grid gap-4">
                {/* 路由偏好权重 */}
                <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                      路由权重与倾向
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        resetLocalRouterPreferences();
                        setRouterSettings({
                          ...DEFAULT_LOCAL_ROUTER_SETTINGS,
                          disabledMethods: [...DEFAULT_LOCAL_ROUTER_SETTINGS.disabledMethods],
                        });
                      }}
                    >
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />
                      <span>恢复默认</span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>默认排盘</span>
                      <Select
                        value={routerSettings.preferredChart ?? ''}
                        onChange={(e) => {
                          const val = (e.target.value || null) as RouterMethodId | null;
                          setRouterSettings((prev) => {
                            const nextDisabled = val
                              ? prev.disabledMethods.filter(
                                  (m) =>
                                    m !== val &&
                                    !(val === 'astrolabe' && m === 'astrolabe-range') &&
                                    !(val === 'qizheng' && m === 'qizheng-range'),
                                )
                              : prev.disabledMethods;
                            return { ...prev, preferredChart: val, disabledMethods: nextDisabled };
                          });
                        }}
                      >
                        <option value="">不限</option>
                        {PERSONAL_CHART_TABS.map((tab) => (
                          <option key={tab.id} value={tab.id}>
                            {tab.label}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>默认起卦</span>
                      <Select
                        value={routerSettings.preferredDivination ?? ''}
                        onChange={(e) => {
                          const val = (e.target.value || null) as RouterMethodId | null;
                          setRouterSettings((prev) => ({
                            ...prev,
                            preferredDivination: val,
                            disabledMethods: val
                              ? prev.disabledMethods.filter((m) => m !== val)
                              : prev.disabledMethods,
                          }));
                        }}
                      >
                        <option value="">不限</option>
                        {DIVINATION_DEFAULT_CHOICES.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>默认权重强度</span>
                      <Select
                        value={routerSettings.preferenceWeight}
                        onChange={(e) =>
                          setRouterSettings((prev) => ({
                            ...prev,
                            preferenceWeight: e.target.value as RouterPreferenceWeight,
                          }))
                        }
                      >
                        <option value="off">关闭</option>
                        <option value="mild">温和优先</option>
                        <option value="strong">强优先</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>体系倾向</span>
                      <Select
                        value={routerSettings.traditionPref}
                        onChange={(e) =>
                          setRouterSettings((prev) => ({
                            ...prev,
                            traditionPref: e.target.value as TraditionPref,
                          }))
                        }
                      >
                        <option value="any">不限</option>
                        <option value="eastern">偏东方传统</option>
                        <option value="western_cards">偏西洋星盘与牌阵</option>
                        <option value="folk_signs">偏民俗灵签</option>
                      </Select>
                    </label>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 sm:col-span-2">
                      <span className="text-xs font-semibold text-[var(--text-strong)]">
                        按使用习惯微调权重
                      </span>
                      <Switch
                        checked={routerSettings.learnFromHistory}
                        onCheckedChange={(val) =>
                          setRouterSettings((prev) => ({ ...prev, learnFromHistory: val }))
                        }
                        aria-label="按使用习惯微调权重"
                      />
                    </div>
                  </div>
                </section>

                {/* 全量术数逐项启用开关 */}
                <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                        可路由术数
                      </h3>
                      <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-base)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-muted)]">
                        {enabledCatalogCount}/{totalCatalogCount}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() =>
                          setRouterSettings((prev) => ({ ...prev, disabledMethods: [] }))
                        }
                      >
                        全部启用
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() =>
                          setRouterSettings((prev) => ({
                            ...prev,
                            disabledMethods: [...DEFAULT_LOCAL_ROUTER_SETTINGS.disabledMethods],
                          }))
                        }
                      >
                        默认范围
                      </Button>
                    </div>
                  </div>

                  <div className="grid gap-2.5">
                    {ROUTER_METHOD_CATALOG.map((cat) => {
                      const allEnabled = cat.items.every((item) => !disabledSet.has(item.id));
                      return (
                        <div
                          key={cat.id}
                          className="grid gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-extrabold text-[var(--text-strong)]">
                              {cat.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRouterCategory(cat.items, !allEnabled)}
                              className="whitespace-nowrap border-0 bg-transparent p-0 text-[11px] font-semibold text-[var(--accent-strong)] cursor-pointer hover:underline"
                            >
                              {allEnabled ? '全关' : '全选'}
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {cat.items.map((item) => {
                              const enabled = !disabledSet.has(item.id);
                              return (
                                <Button
                                  key={item.id}
                                  type="button"
                                  variant={enabled ? 'pillActive' : 'pill'}
                                  size="xs"
                                  aria-pressed={enabled}
                                  onClick={() => toggleRouterMethodItem(item)}
                                >
                                  {item.label}
                                </Button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            ) : activePage === 'ai' ? (
              <div className="grid gap-4">
                <section className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                  <WebAiConfigForm compact />
                </section>

                <button
                  type="button"
                  onClick={() => {
                    onOpenChange(false);
                    onOpenAiConnect();
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] px-4 py-3 text-left cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-hover-surface)]"
                >
                  <strong className="text-xs font-bold text-[var(--text-secondary)]">
                    外部客户端接入（MCP / REST / Skill）
                  </strong>
                  <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
                </button>
              </div>
            ) : activePage === 'time-casting' ? (
              <div className="grid gap-4">
                <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                  <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                    时间与地理坐标
                  </h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>占卜默认时间</span>
                      <Select
                        value={rulesDraft.time.defaultDivinationTimeMode}
                        onChange={(e) =>
                          updateTimeRule(
                            'defaultDivinationTimeMode',
                            e.target.value as GlobalRulesSettings['time']['defaultDivinationTimeMode'],
                          )
                        }
                      >
                        <option value="current">当前此刻</option>
                        <option value="custom">自定义时间</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>默认时间制式</span>
                      <Select
                        value={rulesDraft.time.defaultTimeStandard}
                        onChange={(e) =>
                          updateTimeRule(
                            'defaultTimeStandard',
                            e.target.value as GlobalRulesSettings['time']['defaultTimeStandard'],
                          )
                        }
                      >
                        <option value="beijing">北京时间</option>
                        <option value="true-solar">真太阳时</option>
                      </Select>
                    </label>

                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 sm:col-span-2">
                      <span className="text-xs font-bold text-[var(--text-strong)]">
                        个人命盘默认开启真太阳时
                      </span>
                      <Switch
                        checked={rulesDraft.time.defaultBirthUseTrueSolar}
                        onCheckedChange={(val) => updateTimeRule('defaultBirthUseTrueSolar', val)}
                        aria-label="个人命盘默认开启真太阳时"
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 sm:col-span-2">
                      <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <MapPin className="h-4 w-4 shrink-0 text-[var(--accent-strong)]" />
                        <span>
                          {rulesDraft.time.defaultPlaceDisplayName}（东经{' '}
                          {rulesDraft.time.defaultPlaceLongitude.toFixed(2)}° · 北纬{' '}
                          {rulesDraft.time.defaultPlaceLatitude.toFixed(2)}°）
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          birthPlaceModal.open({
                            purpose: 'observer',
                            initialPlace: rulesDraft.time.defaultPlaceDisplayName,
                            onConfirm: (sel) => {
                              setRulesDraft((prev) => ({
                                ...prev,
                                time: {
                                  ...prev.time,
                                  defaultPlaceDisplayName: sel.displayName,
                                  defaultPlaceLongitude: sel.longitude,
                                  defaultPlaceLatitude: sel.latitude,
                                },
                              }));
                            },
                          });
                        }}
                      >
                        选择参考城市
                      </Button>
                    </div>
                  </div>
                </section>

                <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                      起卦与抽牌方式
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant={
                          rulesDraft.casting.preferManualMode === 'manual' ? 'primary' : 'secondary'
                        }
                        size="xs"
                        onClick={() => applyCastingPreset('manual')}
                      >
                        全部偏手动
                      </Button>
                      <Button
                        variant={
                          rulesDraft.casting.preferManualMode === 'auto' ? 'primary' : 'secondary'
                        }
                        size="xs"
                        onClick={() => applyCastingPreset('auto')}
                      >
                        全部偏自动
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>六爻起卦</span>
                      <Select
                        value={rulesDraft.casting.liuyaoDefaultMethod}
                        onChange={(e) =>
                          updateCastingRule(
                            'liuyaoDefaultMethod',
                            e.target.value as GlobalRulesSettings['casting']['liuyaoDefaultMethod'],
                          )
                        }
                      >
                        <option value="coins">手动摇三钱</option>
                        <option value="yarrow">蓍草起卦</option>
                        <option value="time">自动按时间</option>
                        <option value="manual">手动指定卦象</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>梅花易数</span>
                      <Select
                        value={rulesDraft.casting.meihuaDefaultMethod}
                        onChange={(e) =>
                          updateCastingRule(
                            'meihuaDefaultMethod',
                            e.target.value as GlobalRulesSettings['casting']['meihuaDefaultMethod'],
                          )
                        }
                      >
                        <option value="number">数字报数</option>
                        <option value="time">自动按时间</option>
                        <option value="character">测字起卦</option>
                        <option value="sound">声音起卦</option>
                        <option value="direction">方位起卦</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>金口诀</span>
                      <Select
                        value={rulesDraft.casting.jinkoujueDefaultMethod}
                        onChange={(e) =>
                          updateCastingRule(
                            'jinkoujueDefaultMethod',
                            e.target.value as GlobalRulesSettings['casting']['jinkoujueDefaultMethod'],
                          )
                        }
                      >
                        <option value="time">自动按时间</option>
                        <option value="random">随机地分</option>
                        <option value="number">数字报数</option>
                        <option value="branch">手动点选地分</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>塔罗抽牌</span>
                      <Select
                        value={rulesDraft.casting.tarotDefaultDrawMode}
                        onChange={(e) =>
                          updateCastingRule(
                            'tarotDefaultDrawMode',
                            e.target.value as GlobalRulesSettings['casting']['tarotDefaultDrawMode'],
                          )
                        }
                      >
                        <option value="random">自动随机抽取</option>
                        <option value="interactive">手动洗牌抽牌</option>
                        <option value="manual">手动自选牌面</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>塔罗逆位概率</span>
                      <Select
                        value={rulesDraft.casting.tarotReversalMode}
                        onChange={(e) =>
                          updateCastingRule(
                            'tarotReversalMode',
                            e.target.value as GlobalRulesSettings['casting']['tarotReversalMode'],
                          )
                        }
                      >
                        <option value="realistic">约 30% 逆位</option>
                        <option value="balanced">50% 对半</option>
                        <option value="upright-only">仅正位</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>雷诺曼抽牌</span>
                      <Select
                        value={rulesDraft.casting.lenormandDefaultDrawMode}
                        onChange={(e) =>
                          updateCastingRule(
                            'lenormandDefaultDrawMode',
                            e.target.value as GlobalRulesSettings['casting']['lenormandDefaultDrawMode'],
                          )
                        }
                      >
                        <option value="random">自动随机抽取</option>
                        <option value="interactive">手动洗牌抽牌</option>
                        <option value="manual">手动自选牌面</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>三山国王灵签</span>
                      <Select
                        value={rulesDraft.casting.ssgwDefaultMode}
                        onChange={(e) =>
                          updateCastingRule(
                            'ssgwDefaultMode',
                            e.target.value as GlobalRulesSettings['casting']['ssgwDefaultMode'],
                          )
                        }
                      >
                        <option value="interactive">手动摇签筒</option>
                        <option value="random">自动一键求签</option>
                        <option value="manual">手动指定签号</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>诸葛神数</span>
                      <Select
                        value={rulesDraft.casting.kongmingDefaultMode}
                        onChange={(e) =>
                          updateCastingRule(
                            'kongmingDefaultMode',
                            e.target.value as GlobalRulesSettings['casting']['kongmingDefaultMode'],
                          )
                        }
                      >
                        <option value="random">自动摇钱起卦</option>
                        <option value="manual">手动三字 / 报数</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>奇门盘式</span>
                      <Select
                        value={rulesDraft.casting.qimenDefaultMethod}
                        onChange={(e) =>
                          updateCastingRule(
                            'qimenDefaultMethod',
                            e.target.value as GlobalRulesSettings['casting']['qimenDefaultMethod'],
                          )
                        }
                      >
                        <option value="zhuanpan">转盘奇门</option>
                        <option value="feipan">飞盘奇门</option>
                      </Select>
                    </label>

                    <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                      <span>小六壬掌诀</span>
                      <Select
                        value={rulesDraft.casting.xiaoliurenDefaultRule}
                        onChange={(e) =>
                          updateCastingRule(
                            'xiaoliurenDefaultRule',
                            e.target.value as GlobalRulesSettings['casting']['xiaoliurenDefaultRule'],
                          )
                        }
                      >
                        <option value="common">六宫通行版</option>
                        <option value="duoneng">九宫《多能鄙事》版</option>
                      </Select>
                    </label>
                  </div>
                </section>
              </div>
            ) : activePage === 'calendar-school' ? (
              <div className="grid gap-4">
                {GLOBAL_RULE_SECTIONS.map((section) => (
                  <section
                    key={section.title}
                    className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5"
                  >
                    <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                      {section.title}
                    </h3>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {(section.fields as ReadonlyArray<GlobalRuleFieldDescriptor>).map((field) => {
                        const bucket = rulesDraft[field.group] as Record<string, unknown>;
                        const cur = bucket[field.key];
                        if (field.kind === 'checkbox') {
                          return (
                            <div
                              key={field.id}
                              className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2"
                            >
                              <span className="text-xs font-semibold text-[var(--text-strong)]">
                                {field.label}
                              </span>
                              <Switch
                                checked={Boolean(cur)}
                                onCheckedChange={(val) =>
                                  updateSectionField(field.group, field.key, val)
                                }
                              />
                            </div>
                          );
                        }
                        if (field.kind === 'textarea') {
                          return (
                            <label
                              key={field.id}
                              className="grid gap-1.5 text-xs font-semibold text-[var(--text-secondary)] sm:col-span-2"
                            >
                              <span>{field.label}</span>
                              <textarea
                                id={field.id}
                                rows={field.rows ?? 4}
                                value={String(cur ?? '')}
                                placeholder={field.placeholder}
                                onChange={(e) =>
                                  updateSectionField(field.group, field.key, e.target.value)
                                }
                                className="w-full rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2 text-xs leading-relaxed text-[var(--text-strong)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                              />
                            </label>
                          );
                        }
                        return (
                          <label
                            key={field.id}
                            className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]"
                          >
                            <span>{field.label}</span>
                            <Select
                              value={String(cur ?? '')}
                              onChange={(e) =>
                                updateSectionField(field.group, field.key, e.target.value)
                              }
                            >
                              {field.options.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </Select>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid gap-4">
                <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                  <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                    本地数据
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        try {
                          const { fileName, itemCount } = downloadLocalDataBackup();
                          setBackupNotice({
                            tone: 'good',
                            text:
                              itemCount > 0
                                ? `已导出备份：${fileName}`
                                : `已生成空备份：${fileName}`,
                          });
                        } catch (err) {
                          setBackupNotice({
                            tone: 'warn',
                            text: err instanceof Error ? err.message : '导出备份失败。',
                          });
                        }
                      }}
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>导出备份</span>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => backupFileInputRef.current?.click()}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>导入恢复</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        resetLocalRouterPreferences();
                        setRouterSettings({
                          ...DEFAULT_LOCAL_ROUTER_SETTINGS,
                          disabledMethods: [...DEFAULT_LOCAL_ROUTER_SETTINGS.disabledMethods],
                        });
                        setBackupNotice({
                          tone: 'good',
                          text: '已重置小模型偏好与路由范围。',
                        });
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>重置小模型偏好</span>
                    </Button>
                    <input
                      ref={backupFileInputRef}
                      type="file"
                      accept="application/json,.json"
                      hidden
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        try {
                          const text = await file.text();
                          const res = importLocalDataBackup(text);
                          setRulesDraft(loadGlobalRules());
                          setBackupNotice({
                            tone: 'good',
                            text: `导入成功：档案 ${res.personalCasesAdded} · 合盘 ${res.compatibilityAdded} · 历史 ${res.historyAdded} · 对话 ${res.chatSessionsAdded}`,
                          });
                        } catch (err) {
                          setBackupNotice({
                            tone: 'warn',
                            text: err instanceof Error ? err.message : '导入备份失败。',
                          });
                        }
                      }}
                    />
                  </div>
                  {backupNotice ? (
                    <p
                      className={cn(
                        'm-0 text-xs',
                        backupNotice.tone === 'good'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-amber-700 dark:text-amber-400',
                      )}
                    >
                      {backupNotice.text}
                    </p>
                  ) : null}
                </section>
              </div>
            )}
        </div>

        <DialogFooter className="justify-between">
          <Button
            variant="ghost"
            size="md"
            onClick={() => setRulesDraft(structuredClone(DEFAULT_GLOBAL_RULES))}
          >
            恢复默认口径
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="md" onClick={handleClose}>
              取消
            </Button>
            <Button variant="primary" size="md" onClick={handleSave}>
              保存设置
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
