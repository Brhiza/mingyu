import * as React from 'react';
import {
  Bot,
  Check,
  ChevronDown,
  PlugZap,
  Plus,
  RefreshCw,
  X,
} from 'lucide-react';
import { BUILTIN_AI_HINT } from '../../brand-config';
import { listModels } from '../../ai';
import {
  AI_PROVIDER_PRESETS,
  activateWebAiProfile,
  deleteWebAiProfile,
  diagnoseWebAiConnection,
  fetchBuiltinAiStatus,
  getActiveWebAiProfileId,
  getWebAiMode,
  isWebAiEnabled,
  loadWebAiProfiles,
  readWebAiConfig,
  saveWebAiProfile,
  setWebAiEnabled,
  setWebAiMode,
  writeWebAiConfig,
  type AiConfigProfile,
  type WebAiMode,
} from '../../web-ai';
import { Button, Input, Switch } from '../../components/ui';
import { cn } from '../../lib/utils';

function formatWebAiConnectionError(err: unknown): string {
  const raw = err instanceof Error ? err.message : '';
  const lower = raw.toLowerCase();
  if (lower.includes('failed to fetch') || lower.includes('load failed') || lower.includes('networkerror')) {
    return '浏览器无法直连该接口（跨域拦截或网络不可达）。';
  }
  if (raw.includes('401') || raw.includes('403')) {
    return `认证失败（${raw}）：请检查 API 密钥是否正确或余额是否充足。`;
  }
  if (raw.includes('404')) {
    return `接口路径不存在（${raw}）：请检查地址是否需要以 /v1 结尾。`;
  }
  return raw || '获取失败，请检查接口地址、密钥或网络。';
}

export interface WebAiConfigFormProps {
  /** 紧凑模式（用于设置弹窗内嵌），默认 false（用于接入 AI 独立页） */
  compact?: boolean;
  onNavigateHome?: () => void;
}

export function WebAiConfigForm({ compact = false, onNavigateHome }: WebAiConfigFormProps) {
  const [webAiEnabled, setWebAiEnabledState] = React.useState(() => isWebAiEnabled());
  const [aiMode, setAiMode] = React.useState<WebAiMode>(() => getWebAiMode());
  const [builtinStatus, setBuiltinStatus] = React.useState<{ builtinEnabled: boolean; model?: string }>({
    builtinEnabled: false,
  });
  const savedInit = React.useMemo(() => {
    const raw = readWebAiConfig();
    return raw.baseUrl === 'builtin://site' ? { baseUrl: '', apiKey: '', model: '' } : raw;
  }, []);
  const [baseUrl, setBaseUrl] = React.useState(savedInit.baseUrl);
  const [apiKey, setApiKey] = React.useState(savedInit.apiKey ?? '');
  const [model, setModel] = React.useState(savedInit.model);
  const [modelHint, setModelHint] = React.useState('输入或选择模型名称');
  const [availableModels, setAvailableModels] = React.useState<string[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
  const [modelFilterActive, setModelFilterActive] = React.useState(false);
  const modelPickerRef = React.useRef<HTMLDivElement | null>(null);
  const [fetchingModels, setFetchingModels] = React.useState(false);
  const [testingConn, setTestingConn] = React.useState(false);
  const [profiles, setProfiles] = React.useState<AiConfigProfile[]>(() => loadWebAiProfiles());
  const [activeProfileId, setActiveProfileId] = React.useState<string | null>(() =>
    getActiveWebAiProfileId(),
  );
  const [webAiMsg, setWebAiMsg] = React.useState('');
  const [webAiMsgTone, setWebAiMsgTone] = React.useState<'muted' | 'good' | 'warn'>('muted');
  const [webAiSaved, setWebAiSaved] = React.useState(false);
  const modelInputId = React.useId();

  React.useEffect(() => {
    if (!BUILTIN_AI_HINT && getWebAiMode() !== 'builtin') return;
    void fetchBuiltinAiStatus().then(setBuiltinStatus);
  }, []);

  React.useEffect(() => {
    const sync = () => {
      setWebAiEnabledState(isWebAiEnabled());
      setAiMode(getWebAiMode());
      setProfiles(loadWebAiProfiles());
      setActiveProfileId(getActiveWebAiProfileId());
      const cfg = readWebAiConfig();
      if (cfg.baseUrl !== 'builtin://site') {
        setBaseUrl(cfg.baseUrl);
        setApiKey(cfg.apiKey ?? '');
        setModel(cfg.model);
      }
    };
    window.addEventListener('mingyu:web-ai-changed', sync);
    return () => window.removeEventListener('mingyu:web-ai-changed', sync);
  }, []);

  React.useEffect(() => {
    if (!modelMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModelMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [modelMenuOpen]);

  const handleSaveWebAi = (asNewProfile = false) => {
    const cleanUrl = baseUrl.trim();
    const cleanModel = model.trim();
    if (!cleanUrl) {
      setWebAiSaved(false);
      setWebAiMsgTone('warn');
      setWebAiMsg('请先选择预设或填写接口地址');
      return;
    }
    if (!cleanModel) {
      setWebAiSaved(false);
      setWebAiMsgTone('warn');
      setWebAiMsg('请先填写或选择模型名称');
      return;
    }
    setBaseUrl(cleanUrl);
    setModel(cleanModel);
    const savedProfile = saveWebAiProfile({
      id: asNewProfile ? undefined : (activeProfileId ?? undefined),
      baseUrl: cleanUrl,
      apiKey,
      model: cleanModel,
    });
    setProfiles(loadWebAiProfiles());
    setActiveProfileId(savedProfile.id);
    setWebAiEnabled(true);
    setWebAiEnabledState(true);
    setWebAiSaved(true);
    setWebAiMsgTone('good');
    setWebAiMsg(
      asNewProfile
        ? `已存为新方案「${savedProfile.name}」`
        : `已保存方案「${savedProfile.name}」`,
    );
  };

  const handleFetchModels = async () => {
    setFetchingModels(true);
    setWebAiSaved(false);
    setWebAiMsgTone('muted');
    setWebAiMsg('获取中…');
    try {
      const models = await listModels({ baseUrl, apiKey }, fetch);
      setAvailableModels(models);
      setModelFilterActive(false);
      if (models.length && !model.trim()) {
        setModel(models[0]);
        writeWebAiConfig({ model: models[0] });
      }
      if (models.length > 1) {
        setModelMenuOpen(true);
      }
      setWebAiMsgTone(models.length ? 'good' : 'muted');
      setWebAiMsg(models.length ? `已获取 ${models.length} 个模型` : '已连通，请手动填写模型名');
    } catch (err) {
      setWebAiMsgTone('warn');
      setWebAiMsg(formatWebAiConnectionError(err));
    } finally {
      setFetchingModels(false);
    }
  };

  const handleTestWebAiConnection = async () => {
    setTestingConn(true);
    setWebAiMsgTone('muted');
    setWebAiMsg('检测中…');
    try {
      const diag = await diagnoseWebAiConnection({ baseUrl, apiKey, model }, fetch);
      setWebAiMsgTone(diag.ok ? 'good' : 'warn');
      setWebAiMsg(diag.hint ? `${diag.message} ${diag.hint}` : diag.message);
    } finally {
      setTestingConn(false);
    }
  };

  const normalizedCurUrl = baseUrl.trim().replace(/\/+$/, '');
  const trimmedModelQuery = model.trim().toLowerCase();
  const displayedModels =
    modelFilterActive && trimmedModelQuery
      ? availableModels.filter((m) => m.toLowerCase().includes(trimmedModelQuery))
      : availableModels;

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          {!compact ? (
            <span className="inline-flex size-8 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <Bot className="h-4 w-4" aria-hidden="true" />
            </span>
          ) : null}
          <h3
            className={cn(
              'm-0 font-sans font-extrabold text-[var(--text-strong)]',
              compact ? 'text-[13px]' : 'text-[15.5px]',
            )}
          >
            网页内 AI 对话
          </h3>
        </div>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-1.5 text-xs font-bold text-[var(--text-strong)]">
          <Switch
            checked={webAiEnabled}
            onCheckedChange={(checked) => {
              setWebAiEnabled(checked);
              setWebAiEnabledState(checked);
            }}
          />
          <span className="whitespace-nowrap">{webAiEnabled ? '已开启' : '未开启'}</span>
        </label>
      </div>

      {webAiEnabled ? (
        <div className="grid min-w-0 grid-cols-1 gap-3 border-t border-[var(--border-soft)] pt-3">
          {builtinStatus.builtinEnabled ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-2.5 py-2">
              <Button
                variant={aiMode === 'builtin' ? 'pillActive' : 'pill'}
                size="xs"
                onClick={() => {
                  setWebAiMode('builtin');
                  setAiMode('builtin');
                  setWebAiMsgTone('good');
                  setWebAiMsg(
                    builtinStatus.model
                      ? `已切换站内内置 AI（${builtinStatus.model}）`
                      : '已切换站内内置 AI（免配置 Key）',
                  );
                }}
              >
                站内内置 AI（免 Key）
              </Button>
              <Button
                variant={aiMode === 'custom' ? 'pillActive' : 'pill'}
                size="xs"
                onClick={() => {
                  setWebAiMode('custom');
                  setAiMode('custom');
                }}
              >
                自定义模型接口
              </Button>
            </div>
          ) : null}

          {aiMode === 'builtin' && builtinStatus.builtinEnabled ? (
            <p className="m-0 text-xs text-[var(--text-secondary)]">
              {builtinStatus.model
                ? `当前使用站内内置模型：${builtinStatus.model}`
                : '当前使用站内内置模型服务'}
            </p>
          ) : (
          <>
          {profiles.length > 0 ? (
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-2.5 py-2">
              <span className="whitespace-nowrap text-[11.5px] font-bold text-[var(--text-muted)]">
                方案：
              </span>
              {profiles.map((prof) => {
                const isActive = prof.id === activeProfileId;
                return (
                  <span key={prof.id} className="inline-flex items-center gap-0.5">
                    <Button
                      variant={isActive ? 'pillActive' : 'pill'}
                      size="xs"
                      onClick={() => {
                        const activated = activateWebAiProfile(prof.id);
                        if (activated) {
                          setActiveProfileId(activated.id);
                          setBaseUrl(activated.baseUrl);
                          setApiKey(activated.apiKey);
                          setModel(activated.model);
                          setWebAiSaved(true);
                          setWebAiMsgTone('good');
                          setWebAiMsg(`已切换「${activated.name}」`);
                        }
                      }}
                    >
                      {prof.name}
                    </Button>
                    {profiles.length > 1 ? (
                      <button
                        type="button"
                        aria-label={`删除方案 ${prof.name}`}
                        title="删除此方案"
                        onClick={() => {
                          const next = deleteWebAiProfile(prof.id);
                          setProfiles(next);
                          setActiveProfileId(getActiveWebAiProfileId());
                          const nextCfg = readWebAiConfig();
                          setBaseUrl(nextCfg.baseUrl);
                          setApiKey(nextCfg.apiKey ?? '');
                          setModel(nextCfg.model);
                        }}
                        className="inline-flex h-5 w-5 items-center justify-center rounded-full border-0 bg-transparent text-[var(--text-muted)] hover:bg-[var(--state-hover-surface)] hover:text-[var(--danger-text)] cursor-pointer"
                      >
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    ) : null}
                  </span>
                );
              })}
              <Button variant="ghost" size="xs" onClick={() => handleSaveWebAi(true)}>
                <Plus className="h-3 w-3" aria-hidden="true" />
                <span>新方案</span>
              </Button>
            </div>
          ) : null}

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {AI_PROVIDER_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                variant={normalizedCurUrl === preset.baseUrl ? 'pillActive' : 'pill'}
                size="xs"
                onClick={() => {
                  setBaseUrl(preset.baseUrl);
                  setModelHint(preset.modelHint);
                  setWebAiSaved(false);
                  writeWebAiConfig({ baseUrl: preset.baseUrl });
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div
            className={cn(
              'grid min-w-0 grid-cols-1 gap-3',
              compact ? 'sm:grid-cols-2' : 'md:grid-cols-3',
            )}
          >
            <label
              className={cn(
                'grid min-w-0 gap-1 text-xs font-semibold text-[var(--text-secondary)]',
                compact && 'sm:col-span-2',
              )}
            >
              <span>接口地址</span>
              <Input
                type="url"
                value={baseUrl}
                placeholder="https://api.deepseek.com/v1"
                onChange={(e) => {
                  setBaseUrl(e.target.value);
                  setWebAiSaved(false);
                  writeWebAiConfig({ baseUrl: e.target.value });
                }}
              />
            </label>

            <label className="grid min-w-0 gap-1 text-xs font-semibold text-[var(--text-secondary)]">
              <span>API 密钥</span>
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                placeholder="仅存本地浏览器"
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setWebAiSaved(false);
                  writeWebAiConfig({ apiKey: e.target.value });
                }}
              />
            </label>

            <div
              ref={modelPickerRef}
              className="relative grid min-w-0 gap-1 text-xs font-semibold text-[var(--text-secondary)]"
            >
              <label htmlFor={modelInputId} className="m-0">
                模型名称
              </label>
              <div className="relative min-w-0">
                <Input
                  id={modelInputId}
                  type="text"
                  autoComplete="off"
                  value={model}
                  placeholder={modelHint}
                  className={cn(availableModels.length > 0 && 'pr-9')}
                  onFocus={() => {
                    if (availableModels.length > 0) {
                      setModelFilterActive(false);
                      setModelMenuOpen(true);
                    }
                  }}
                  onClick={() => {
                    if (availableModels.length > 0) {
                      setModelFilterActive(false);
                      setModelMenuOpen(true);
                    }
                  }}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setModel(nextVal);
                    setWebAiSaved(false);
                    writeWebAiConfig({ model: nextVal });
                    if (availableModels.length > 0) {
                      setModelFilterActive(true);
                      setModelMenuOpen(true);
                    }
                  }}
                />
                {availableModels.length > 0 ? (
                  <button
                    type="button"
                    aria-label={modelMenuOpen ? '收起模型列表' : '展开模型列表'}
                    aria-expanded={modelMenuOpen}
                    onClick={() => {
                      setModelFilterActive(false);
                      setModelMenuOpen((prev) => !prev);
                    }}
                    className="absolute right-1.5 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border-0 bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text-strong)] cursor-pointer"
                  >
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform duration-150', modelMenuOpen && 'rotate-180')}
                      aria-hidden="true"
                    />
                  </button>
                ) : null}
              </div>

              {modelMenuOpen && availableModels.length > 0 ? (
                <div
                  role="listbox"
                  aria-label="可选模型列表"
                  className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated-strong)] p-1 shadow-[0_10px_28px_rgba(32,24,16,0.14)]"
                >
                  {displayedModels.length > 0 ? (
                    displayedModels.map((m) => {
                      const isSelected = model === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setModel(m);
                            setWebAiSaved(false);
                            writeWebAiConfig({ model: m });
                            setModelFilterActive(false);
                            setModelMenuOpen(false);
                          }}
                          className={cn(
                            'flex min-h-[34px] w-full items-center justify-between gap-2 rounded-lg border-0 px-2.5 py-1 text-left font-mono text-xs transition-colors cursor-pointer',
                            isSelected
                              ? 'bg-[var(--state-selected-surface)] font-bold text-[var(--state-selected-text)]'
                              : 'bg-transparent font-medium text-[var(--text-primary)] hover:bg-[var(--state-hover-surface)]',
                          )}
                        >
                          <span className="min-w-0 truncate">{m}</span>
                          {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
                        </button>
                      );
                    })
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setModelFilterActive(false);
                        setModelMenuOpen(false);
                      }}
                      className="flex min-h-[34px] w-full items-center rounded-lg border-0 bg-transparent px-2.5 py-1 text-left text-xs text-[var(--text-muted)] cursor-pointer hover:bg-[var(--state-hover-surface)]"
                    >
                      <span className="truncate">使用：{model}</span>
                    </button>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={fetchingModels}
                onClick={() => void handleFetchModels()}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', fetchingModels && 'animate-spin')} />
                <span>获取模型</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={testingConn}
                onClick={() => void handleTestWebAiConnection()}
              >
                <PlugZap className="h-3.5 w-3.5" />
                <span>{testingConn ? '测试中…' : '测试连通'}</span>
              </Button>
            </div>

            <Button
              variant="primary"
              size="sm"
              className="shrink-0"
              onClick={() => handleSaveWebAi(false)}
            >
              {webAiSaved ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
              <span>{webAiSaved ? '已保存' : '保存模型'}</span>
            </Button>
          </div>

          {webAiMsg ? (
            <p
              role="status"
              className={cn(
                'm-0 text-xs font-medium',
                webAiMsgTone === 'good'
                  ? 'text-[var(--state-selected-text)]'
                  : webAiMsgTone === 'warn'
                    ? 'text-[var(--danger-text)]'
                    : 'text-[var(--text-muted)]',
              )}
            >
              {webAiMsg}
            </p>
          ) : null}
          </>
          )}
        </div>
      ) : null}
    </div>
  );
}
