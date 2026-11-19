import * as React from 'react';
import { ChevronRight, Download, MapPin, Moon, Sun, Upload } from 'lucide-react';
import type { BirthPlaceModalController } from '../../v2-ui/birth-place-modal';
import { downloadLocalDataBackup, importLocalDataBackup } from '../../v2-ui/data-backup';
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
  SegmentedTabs,
  Select,
  Switch,
} from '../../components/ui';
import { cn } from '../../lib/utils';
import {
  DIVINATION_METHOD_OPTIONS,
  WORKSPACE_THEME_DEFINITIONS,
  applyWorkspaceTheme,
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

const DIVINATION_DEFAULT_CHOICES = DIVINATION_METHOD_OPTIONS.filter(
  (o) => o.id !== 'almanac' && o.id !== 'residential',
);

export function SettingsModal({
  open,
  onOpenChange,
  preferences,
  homePinActionMode,
  birthPlaceModal,
  onHomePinActionModeChange,
  onSaveAll,
  onOpenAiConnect,
}: SettingsModalProps) {
  const [draft, setDraft] = React.useState<WorkspacePreferences>(() => ({ ...preferences }));
  const [rulesDraft, setRulesDraft] = React.useState<GlobalRulesSettings>(() => loadGlobalRules());
  const [rulesTab, setRulesTab] = React.useState<'time-casting' | 'calendar-school'>('time-casting');
  const [colorScheme, setColorScheme] = React.useState<'light' | 'dark'>(() =>
    document.documentElement.dataset.theme === 'dark' ||
    (!document.documentElement.dataset.theme &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches)
      ? 'dark'
      : 'light',
  );
  const didSaveRef = React.useRef(false);
  const backupFileInputRef = React.useRef<HTMLInputElement | null>(null);
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
    setColorScheme(
      document.documentElement.dataset.theme === 'dark' ||
        (!document.documentElement.dataset.theme &&
          window.matchMedia?.('(prefers-color-scheme: dark)').matches)
        ? 'dark'
        : 'light',
    );
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
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('mingyu.v2.theme', next);
    } catch {}
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
    onSaveAll(draft, rulesDraft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent
        className="workspace-settings-modal max-w-[960px]"
        showClose={false}
        aria-labelledby="workspace-settings-title"
      >
        <DialogHeader className="workspace-settings-head">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle id="workspace-settings-title">工作台与术数口径设置</DialogTitle>
            <Button variant="ghost" size="sm" onClick={handleClose}>
              关闭
            </Button>
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-5 py-4 md:grid-cols-[310px_minmax(0,1fr)]">
          {/* 左侧：外观主题 · 默认算法 · 主页布局 */}
          <section className="flex flex-col gap-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="m-0 text-sm font-extrabold text-[var(--text-strong)]">主题色与外观</h3>
              </div>
              <Button variant="ghost" size="xs" onClick={toggleScheme}>
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

            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="主题色">
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
                      'flex flex-col items-center gap-1 rounded-lg border px-1.5 py-2 text-xs cursor-pointer transition-all',
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
                    <span className="text-[11px]">{theme.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-2.5 border-t border-[var(--border-soft)] pt-3">
              <div>
                <h3 className="m-0 text-sm font-extrabold text-[var(--text-strong)]">默认偏好与主页</h3>
                <p className="m-0 mt-0.5 text-xs text-[var(--text-muted)]">首页与常用入口默认行为</p>
              </div>

              <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                <span>个人命盘默认盘面</span>
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
                <span>占卜默认术数</span>
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

              <div className="grid gap-1.5 border-t border-[var(--border-soft)] pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-[var(--text-strong)]">
                    塔罗牌面套牌
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">默认蛋姐的豹</span>
                </div>
                <div
                  className="grid grid-cols-2 gap-1.5"
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
                          'flex items-center gap-2 rounded-lg border p-1.5 text-left transition-all cursor-pointer',
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
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-[11px] font-bold text-[var(--text-strong)]">
                            {deck.label.replace('（默认）', '')}
                          </strong>
                          <span className="block truncate text-[10px] text-[var(--text-muted)]">
                            {deck.id === 'danjie-leopard' ? '默认套牌' : deck.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="mt-auto grid gap-2">
              <div className="grid gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-3">
                <div className="grid gap-0.5">
                  <strong className="text-[12.5px] font-bold text-[var(--text-strong)]">
                    本地数据备份与恢复
                  </strong>
                  <small className="text-[11px] leading-snug text-[var(--text-muted)]">
                    备份个人档案、合盘、占卜历史与设置（不含 AI 密钥），换设备或清缓存前建议导出
                  </small>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
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
                              : `当前暂无可备份数据，已生成空备份：${fileName}`,
                        });
                      } catch (err) {
                        setBackupNotice({
                          tone: 'warn',
                          text: err instanceof Error ? err.message : '导出备份失败，请稍后重试。',
                        });
                      }
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />
                    导出备份
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => backupFileInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    导入恢复
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
                          text: `导入成功：新增档案 ${res.personalCasesAdded} 条、合盘 ${res.compatibilityAdded} 条、历史 ${res.historyAdded} 条、对话 ${res.chatSessionsAdded} 条`,
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
                      'm-0 text-[11px] leading-snug',
                      backupNotice.tone === 'good'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-amber-700 dark:text-amber-400',
                    )}
                  >
                    {backupNotice.text}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={() => {
                  onOpenChange(false);
                  onOpenAiConnect();
                }}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3.5 py-2.5 text-left cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--state-hover-surface)]"
              >
                <span className="grid gap-0.5">
                  <strong className="text-[13px] font-bold text-[var(--text-strong)]">AI 解读设置</strong>
                  <small className="text-[11.5px] text-[var(--text-muted)]">
                    配置 API 接口、模型与连接方式
                  </small>
                </span>
                <ChevronRight className="h-4 w-4 text-[var(--text-muted)]" />
              </button>
            </div>
          </section>

          {/* 右侧：排盘与起卦口径配置 */}
          <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border-soft)] pb-3">
              <div>
                <h3 className="m-0 text-sm font-extrabold text-[var(--text-strong)]">排盘与起卦偏好口径</h3>
                <p className="m-0 mt-0.5 text-xs text-[var(--text-muted)]">
                  配置默认时间制、手自动起卦习惯、历法分界与流派规则
                </p>
              </div>
              <SegmentedTabs
                value={rulesTab}
                onValueChange={setRulesTab}
                ariaLabel="规则口径切换"
                options={[
                  { id: 'time-casting', label: '时间与起卦偏好' },
                  { id: 'calendar-school', label: '历法分界与流派规则' },
                ]}
              />
            </div>

            <div className="grid gap-4 overflow-y-auto pr-1">
              {rulesTab === 'time-casting' ? (
                <>
                  <div className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                    <h4 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                      全局时间、真太阳时与参考地理坐标
                    </h4>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>占卜起卦默认时间</span>
                        <Select
                          value={rulesDraft.time.defaultDivinationTimeMode}
                          onChange={(e) =>
                            updateTimeRule(
                              'defaultDivinationTimeMode',
                              e.target.value as GlobalRulesSettings['time']['defaultDivinationTimeMode'],
                            )
                          }
                        >
                          <option value="current">当前此刻（自动随实时更新）</option>
                          <option value="custom">自定指定时间（打开即填写）</option>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>默认时间制式（即时/起卦）</span>
                        <Select
                          value={rulesDraft.time.defaultTimeStandard}
                          onChange={(e) =>
                            updateTimeRule(
                              'defaultTimeStandard',
                              e.target.value as GlobalRulesSettings['time']['defaultTimeStandard'],
                            )
                          }
                        >
                          <option value="beijing">北京时间（东八区标准时间）</option>
                          <option value="true-solar">真太阳时（按参考城市经度校正）</option>
                        </Select>
                      </label>

                      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 sm:col-span-2">
                        <div className="grid gap-0.5">
                          <span className="text-xs font-bold text-[var(--text-strong)]">
                            个人命盘默认开启真太阳时
                          </span>
                          <small className="text-[11px] text-[var(--text-muted)]">
                            新建空白临时命盘时，自动附带参考地点并启用真太阳时换算
                          </small>
                        </div>
                        <Switch
                          checked={rulesDraft.time.defaultBirthUseTrueSolar}
                          onCheckedChange={(val) =>
                            updateTimeRule('defaultBirthUseTrueSolar', val)
                          }
                          aria-label="个人命盘默认开启真太阳时"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2.5 sm:col-span-2">
                        <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                          <MapPin className="h-4 w-4 text-[var(--accent-strong)]" />
                          <span>
                            默认参考坐标：{rulesDraft.time.defaultPlaceDisplayName}（东经{' '}
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
                  </div>

                  <div className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                        起卦、抽牌与取象默认模式
                      </h4>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant={
                            rulesDraft.casting.preferManualMode === 'manual'
                              ? 'primary'
                              : 'secondary'
                          }
                          size="xs"
                          onClick={() => applyCastingPreset('manual')}
                        >
                          一键全部偏手动
                        </Button>
                        <Button
                          variant={
                            rulesDraft.casting.preferManualMode === 'auto'
                              ? 'primary'
                              : 'secondary'
                          }
                          size="xs"
                          onClick={() => applyCastingPreset('auto')}
                        >
                          一键全部偏自动
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>六爻默认起卦</span>
                        <Select
                          value={rulesDraft.casting.liuyaoDefaultMethod}
                          onChange={(e) =>
                            updateCastingRule(
                              'liuyaoDefaultMethod',
                              e.target.value as GlobalRulesSettings['casting']['liuyaoDefaultMethod'],
                            )
                          }
                        >
                          <option value="coins">手动摇三钱（逐爻点击）</option>
                          <option value="yarrow">蓍草起卦（古法模拟）</option>
                          <option value="time">自动按时间起卦</option>
                          <option value="manual">手动指定本变卦象</option>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>梅花易数默认起卦</span>
                        <Select
                          value={rulesDraft.casting.meihuaDefaultMethod}
                          onChange={(e) =>
                            updateCastingRule(
                              'meihuaDefaultMethod',
                              e.target.value as GlobalRulesSettings['casting']['meihuaDefaultMethod'],
                            )
                          }
                        >
                          <option value="number">数字报数起卦</option>
                          <option value="time">自动按时间起卦</option>
                          <option value="character">测字起卦</option>
                          <option value="sound">声音起卦</option>
                          <option value="direction">方位起卦</option>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>金口诀默认立课</span>
                        <Select
                          value={rulesDraft.casting.jinkoujueDefaultMethod}
                          onChange={(e) =>
                            updateCastingRule(
                              'jinkoujueDefaultMethod',
                              e.target.value as GlobalRulesSettings['casting']['jinkoujueDefaultMethod'],
                            )
                          }
                        >
                          <option value="time">自动按时间定地分</option>
                          <option value="random">随机取地分</option>
                          <option value="number">数字报数定地分</option>
                          <option value="branch">手动点选地分方位</option>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>塔罗牌默认抽牌</span>
                        <Select
                          value={rulesDraft.casting.tarotDefaultDrawMode}
                          onChange={(e) =>
                            updateCastingRule(
                              'tarotDefaultDrawMode',
                              e.target.value as GlobalRulesSettings['casting']['tarotDefaultDrawMode'],
                            )
                          }
                        >
                          <option value="random">自动随机抽取牌阵</option>
                          <option value="interactive">手动洗牌切牌交互抽牌</option>
                          <option value="manual">手动自选牌面</option>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>雷诺曼默认抽牌</span>
                        <Select
                          value={rulesDraft.casting.lenormandDefaultDrawMode}
                          onChange={(e) =>
                            updateCastingRule(
                              'lenormandDefaultDrawMode',
                              e.target.value as GlobalRulesSettings['casting']['lenormandDefaultDrawMode'],
                            )
                          }
                        >
                          <option value="random">自动随机抽取牌阵</option>
                          <option value="interactive">手动洗牌互动抽牌</option>
                          <option value="manual">手动自选牌面组成牌阵</option>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>三山国王灵签默认求签</span>
                        <Select
                          value={rulesDraft.casting.ssgwDefaultMode}
                          onChange={(e) =>
                            updateCastingRule(
                              'ssgwDefaultMode',
                              e.target.value as GlobalRulesSettings['casting']['ssgwDefaultMode'],
                            )
                          }
                        >
                          <option value="interactive">手动摇签筒求签</option>
                          <option value="random">自动一键求签</option>
                          <option value="manual">手动输入指定签号</option>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>诸葛神数默认起卦</span>
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
                          <option value="manual">手动输入三字 / 报数</option>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>奇门遁甲默认盘式</span>
                        <Select
                          value={rulesDraft.casting.qimenDefaultMethod}
                          onChange={(e) =>
                            updateCastingRule(
                              'qimenDefaultMethod',
                              e.target.value as GlobalRulesSettings['casting']['qimenDefaultMethod'],
                            )
                          }
                        >
                          <option value="zhuanpan">转盘奇门（主流默认）</option>
                          <option value="feipan">飞盘奇门</option>
                        </Select>
                      </label>

                      <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
                        <span>小六壬默认掌诀</span>
                        <Select
                          value={rulesDraft.casting.xiaoliurenDefaultRule}
                          onChange={(e) =>
                            updateCastingRule(
                              'xiaoliurenDefaultRule',
                              e.target.value as GlobalRulesSettings['casting']['xiaoliurenDefaultRule'],
                            )
                          }
                        >
                          <option value="common">六宫通行版（主流默认）</option>
                          <option value="duoneng">九宫《多能鄙事》版</option>
                        </Select>
                      </label>
                    </div>
                  </div>
                </>
              ) : (
                GLOBAL_RULE_SECTIONS.map((section) => (
                  <div
                    key={section.title}
                    className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5"
                  >
                    <h4 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
                      {section.title}
                    </h4>
                    {section.desc && (
                      <p className="m-0 text-xs text-[var(--text-muted)]">
                        {section.desc}
                      </p>
                    )}
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
                  </div>
                ))
              )}
            </div>
          </section>
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
