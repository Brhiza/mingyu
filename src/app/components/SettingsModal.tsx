import * as React from 'react';
import { BookOpen, Bot, Clock, Database, Palette } from 'lucide-react';
import {
  loadExternalAiQuickJumpSettings,
  saveExternalAiQuickJumpSettings,
  type ExternalAiQuickJumpSettings,
} from '../../external-ai-share';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import {
  getAssetOrigin,
  getRemoteSkins,
  loadAssetManifest,
  type RemoteSkinDefinition,
} from '../../remote-assets';
import {
  DEFAULT_GLOBAL_RULES,
  loadGlobalRules,
  type GlobalRulesSettings,
} from '../../web-settings';
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui';
import { warnDev } from '../../lib/dev-log';
import { cn } from '../../lib/utils';
import {
  applyWorkspaceTheme,
  getDisplayThemeMode,
  setDisplayThemeMode,
  type WorkspacePreferences,
} from '../workspace-catalog';
import { SettingsAiTab } from './settings/SettingsAiTab';
import { SettingsDataTab } from './settings/SettingsDataTab';
import { SettingsGeneralTab } from './settings/SettingsGeneralTab';
import { SettingsSchoolTab } from './settings/SettingsSchoolTab';
import { SettingsTimeTab } from './settings/SettingsTimeTab';

export interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: WorkspacePreferences;
  birthPlaceModal: BirthPlaceModalController;
  onSaveAll: (nextPrefs: WorkspacePreferences, nextRules: GlobalRulesSettings) => void;
  onOpenAiConnect: () => void;
}

type SettingsPageId = 'general' | 'ai' | 'time-casting' | 'calendar-school' | 'data';

const SETTINGS_PAGES: ReadonlyArray<{
  id: SettingsPageId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'general', label: '外观与常用', icon: Palette },
  { id: 'ai', label: 'AI 模型', icon: Bot },
  { id: 'time-casting', label: '时间与起卦', icon: Clock },
  { id: 'calendar-school', label: '历法与流派', icon: BookOpen },
  { id: 'data', label: '本地数据', icon: Database },
];

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
  const [colorScheme, setColorScheme] = React.useState<'light' | 'dark'>(() =>
    getDisplayThemeMode(),
  );
  const didSaveRef = React.useRef(false);
  const contentScrollRef = React.useRef<HTMLDivElement | null>(null);
  const [remoteSkins, setRemoteSkins] = React.useState<readonly RemoteSkinDefinition[]>(() =>
    getRemoteSkins(),
  );
  const [quickJumpDraft, setQuickJumpDraft] = React.useState<ExternalAiQuickJumpSettings>(() =>
    loadExternalAiQuickJumpSettings(),
  );
  const hasRemoteAssets = Boolean(getAssetOrigin());

  React.useEffect(() => {
    const onSkinsLoaded = () => setRemoteSkins([...getRemoteSkins()]);
    window.addEventListener('mingyu:remote-skins-loaded', onSkinsLoaded);
    return () => window.removeEventListener('mingyu:remote-skins-loaded', onSkinsLoaded);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    didSaveRef.current = false;
    setDraft({ ...preferences });
    setRulesDraft(loadGlobalRules());
    setColorScheme(getDisplayThemeMode());
    setRemoteSkins([...getRemoteSkins()]);
    setQuickJumpDraft(loadExternalAiQuickJumpSettings());
    if (getAssetOrigin() && getRemoteSkins().length === 0) {
      void loadAssetManifest().catch((err) => {
        warnDev('SettingsModal', '加载远程皮肤配置失败', err);
      });
    }
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

  const handleSave = () => {
    didSaveRef.current = true;
    saveExternalAiQuickJumpSettings(quickJumpDraft);
    onSaveAll(draft, rulesDraft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        className="workspace-settings-modal fixed inset-0 h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none border-0 sm:relative sm:inset-auto sm:h-[min(680px,86dvh)] sm:max-h-[86dvh] sm:w-[min(800px,calc(100vw-1.5rem))] sm:max-w-[800px] sm:rounded-2xl sm:border"
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
          className="flex shrink-0 flex-row items-center justify-between gap-0.5 overflow-x-auto border-b border-[var(--border-soft)] bg-[var(--surface-soft)] px-2 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:justify-start sm:gap-1 sm:px-4"
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
                  'flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg border-0 px-2 py-1.5 text-[11.5px] font-bold transition-colors cursor-pointer sm:gap-1.5 sm:px-3 sm:text-[12.5px]',
                  active
                    ? 'bg-[var(--state-selected-surface-strong)] text-[var(--state-selected-text)]'
                    : 'bg-transparent text-[var(--text-secondary)] hover:bg-[var(--state-hover-surface)] hover:text-[var(--text-strong)]',
                )}
              >
                <Icon className="hidden h-3.5 w-3.5 shrink-0 sm:inline-block" aria-hidden="true" />
                <span>{page.label}</span>
              </button>
            );
          })}
        </nav>

        {/* 固定高度滚动内容区 */}
        <div
          ref={contentScrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-10 sm:px-5 sm:pb-6"
        >
          {activePage === 'general' ? (
            <SettingsGeneralTab
              draft={draft}
              setDraft={setDraft}
              colorScheme={colorScheme}
              onToggleScheme={toggleScheme}
              remoteSkins={remoteSkins}
              hasRemoteAssets={hasRemoteAssets}
              rulesDraft={rulesDraft}
              onUpdateCastingRule={updateCastingRule}
            />
          ) : activePage === 'ai' ? (
            <SettingsAiTab
              open={open}
              quickJumpDraft={quickJumpDraft}
              setQuickJumpDraft={setQuickJumpDraft}
              onCloseModal={() => onOpenChange(false)}
              onOpenAiConnect={onOpenAiConnect}
            />
          ) : activePage === 'time-casting' ? (
            <SettingsTimeTab
              rulesDraft={rulesDraft}
              birthPlaceModal={birthPlaceModal}
              onUpdateTimeRule={updateTimeRule}
              onUpdateCastingRule={updateCastingRule}
              onApplyCastingPreset={applyCastingPreset}
              onUpdateDefaultPlace={(sel) => {
                setRulesDraft((prev) => ({
                  ...prev,
                  time: {
                    ...prev.time,
                    defaultPlaceDisplayName: sel.displayName,
                    defaultPlaceLongitude: sel.longitude,
                    defaultPlaceLatitude: sel.latitude,
                  },
                }));
              }}
            />
          ) : activePage === 'calendar-school' ? (
            <SettingsSchoolTab
              rulesDraft={rulesDraft}
              onUpdateSectionField={updateSectionField}
            />
          ) : (
            <SettingsDataTab
              open={open}
              hasRemoteAssets={hasRemoteAssets}
              onRulesRestored={setRulesDraft}
            />
          )}
        </div>

        <DialogFooter className="justify-between">
          <Button
            variant="ghost"
            size="md"
            onClick={() => setRulesDraft(structuredClone(DEFAULT_GLOBAL_RULES))}
          >
            恢复默认
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
