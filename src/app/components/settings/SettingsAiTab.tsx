import * as React from 'react';
import { Check, ChevronRight, Edit3, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { Button, Input, Switch } from '../../../components/ui';
import {
  createDefaultExternalAiQuickJumpSettings,
  isSafeExternalAppUrl,
  isSafeExternalWebUrl,
  type ExternalAiClientConfig,
  type ExternalAiQuickJumpSettings,
} from '../../../external-ai-share';
import { WebAiConfigForm } from '../WebAiConfigForm';

function splitClientUrls(client: Pick<ExternalAiClientConfig, 'appUrl' | 'webUrl' | 'url'>): {
  appUrl: string;
  webUrl: string;
} {
  const rawApp = typeof client.appUrl === 'string' ? client.appUrl.trim() : '';
  const rawWeb = typeof client.webUrl === 'string' ? client.webUrl.trim() : '';
  const legacyUrl = typeof client.url === 'string' ? client.url.trim() : '';
  return {
    appUrl: rawApp || (!rawApp && legacyUrl && isSafeExternalAppUrl(legacyUrl) ? legacyUrl : ''),
    webUrl: rawWeb || (!rawWeb && legacyUrl && isSafeExternalWebUrl(legacyUrl) ? legacyUrl : ''),
  };
}

function validateQuickJumpClientInputs(
  rawLabel: string,
  rawAppUrl: string,
  rawWebUrl: string,
): { error?: string; label: string; appUrl: string; webUrl: string; url: string } {
  const label = rawLabel.trim();
  const appUrl = rawAppUrl.trim();
  const webUrl = rawWebUrl.trim();
  if (!label) {
    return { error: '请填写客户端名称', label, appUrl, webUrl, url: '' };
  }
  if (!appUrl && !webUrl) {
    return { error: '请至少填写 APP 链接或网页链接', label, appUrl, webUrl, url: '' };
  }
  if (appUrl && !isSafeExternalAppUrl(appUrl)) {
    return { error: 'APP 链接请使用应用协议（如 doubao://）', label, appUrl, webUrl, url: '' };
  }
  if (webUrl && !isSafeExternalWebUrl(webUrl)) {
    return { error: '网页链接请以 https:// 开头', label, appUrl, webUrl, url: '' };
  }
  return {
    label: label.slice(0, 24),
    appUrl,
    webUrl,
    url: appUrl || webUrl,
  };
}

export interface SettingsAiTabProps {
  open: boolean;
  quickJumpDraft: ExternalAiQuickJumpSettings;
  setQuickJumpDraft: React.Dispatch<React.SetStateAction<ExternalAiQuickJumpSettings>>;
  onCloseModal: () => void;
  onOpenAiConnect: () => void;
}

export function SettingsAiTab({
  open,
  quickJumpDraft,
  setQuickJumpDraft,
  onCloseModal,
  onOpenAiConnect,
}: SettingsAiTabProps) {
  const [addingClient, setAddingClient] = React.useState(false);
  const [newClientLabel, setNewClientLabel] = React.useState('');
  const [newClientAppUrl, setNewClientAppUrl] = React.useState('');
  const [newClientWebUrl, setNewClientWebUrl] = React.useState('');
  const [editingClientId, setEditingClientId] = React.useState<string | null>(null);
  const [editClientLabel, setEditClientLabel] = React.useState('');
  const [editClientAppUrl, setEditClientAppUrl] = React.useState('');
  const [editClientWebUrl, setEditClientWebUrl] = React.useState('');
  const [quickJumpError, setQuickJumpError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setAddingClient(false);
    setNewClientLabel('');
    setNewClientAppUrl('');
    setNewClientWebUrl('');
    setEditingClientId(null);
    setQuickJumpError(null);
  }, [open]);

  return (
    <div className="grid gap-4">
      <section className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
        <WebAiConfigForm compact />
      </section>

      <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
            复制后快速跳转
          </h3>
          <Switch
            checked={quickJumpDraft.enabled}
            aria-label="开启复制后快速跳转按钮"
            onCheckedChange={(checked) => {
              setQuickJumpError(null);
              setQuickJumpDraft((prev) => ({ ...prev, enabled: checked }));
            }}
          />
        </div>

        {quickJumpDraft.enabled ? (
          <div className="grid gap-2">
            {quickJumpDraft.clients.map((client) => {
              const isEditing = editingClientId === client.id;
              const { appUrl, webUrl } = splitClientUrls(client);
              return (
                <div
                  key={client.id}
                  className="grid gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 py-2"
                >
                  {isEditing ? (
                    <div className="grid gap-2">
                      <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                        <Input
                          type="text"
                          value={editClientLabel}
                          placeholder="客户端名称"
                          aria-label="编辑客户端名称"
                          onChange={(e) => setEditClientLabel(e.target.value)}
                        />
                        <Input
                          type="text"
                          value={editClientAppUrl}
                          placeholder="APP 原生链接（优先，如 doubao://）"
                          aria-label="编辑 APP 原生链接"
                          onChange={(e) => setEditClientAppUrl(e.target.value)}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="text"
                          value={editClientWebUrl}
                          placeholder="网页链接（回退，如 https://...）"
                          aria-label="编辑网页链接"
                          className="min-w-0 flex-1"
                          onChange={(e) => setEditClientWebUrl(e.target.value)}
                        />
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="primary"
                            size="xs"
                            onClick={() => {
                              const validated = validateQuickJumpClientInputs(
                                editClientLabel,
                                editClientAppUrl,
                                editClientWebUrl,
                              );
                              if (validated.error) {
                                setQuickJumpError(validated.error);
                                return;
                              }
                              setQuickJumpError(null);
                              setQuickJumpDraft((prev) => ({
                                ...prev,
                                clients: prev.clients.map((item) =>
                                  item.id === client.id
                                    ? {
                                        ...item,
                                        label: validated.label,
                                        appUrl: validated.appUrl,
                                        webUrl: validated.webUrl,
                                        url: validated.url,
                                      }
                                    : item,
                                ),
                              }));
                              setEditingClientId(null);
                            }}
                          >
                            <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>确定</span>
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              setEditingClientId(null);
                              setQuickJumpError(null);
                            }}
                          >
                            取消
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 grid gap-0.5">
                        <div className="truncate text-xs font-bold text-[var(--text-strong)]">
                          {client.label}
                        </div>
                        {appUrl ? (
                          <div className="truncate font-mono text-[10.5px] text-[var(--text-muted)]">
                            APP · {appUrl}
                          </div>
                        ) : null}
                        {webUrl ? (
                          <div className="truncate font-mono text-[10.5px] text-[var(--text-muted)]">
                            网页 · {webUrl}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          aria-label={`编辑 ${client.label}`}
                          onClick={() => {
                            setQuickJumpError(null);
                            setEditingClientId(client.id);
                            setEditClientLabel(client.label);
                            setEditClientAppUrl(appUrl);
                            setEditClientWebUrl(webUrl);
                          }}
                        >
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                        </Button>
                        {!client.builtIn ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            aria-label={`删除 ${client.label}`}
                            onClick={() => {
                              setQuickJumpDraft((prev) => ({
                                ...prev,
                                clients: prev.clients.filter((item) => item.id !== client.id),
                              }));
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--danger-text)]" aria-hidden="true" />
                          </Button>
                        ) : null}
                        <Switch
                          checked={client.enabled}
                          aria-label={`显示 ${client.label}`}
                          onCheckedChange={(checked) =>
                            setQuickJumpDraft((prev) => ({
                              ...prev,
                              clients: prev.clients.map((item) =>
                                item.id === client.id ? { ...item, enabled: checked } : item,
                              ),
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {quickJumpError ? (
              <div className="text-[11px] font-semibold text-[var(--danger-text)]">
                {quickJumpError}
              </div>
            ) : null}

            {addingClient ? (
              <div className="grid gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-base)] p-2.5">
                <div className="grid gap-2 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <Input
                    type="text"
                    value={newClientLabel}
                    placeholder="客户端名称（如 智谱清言）"
                    aria-label="新客户端名称"
                    onChange={(e) => setNewClientLabel(e.target.value)}
                  />
                  <Input
                    type="text"
                    value={newClientAppUrl}
                    placeholder="APP 原生链接（优先，如 chatglm://）"
                    aria-label="新客户端 APP 原生链接"
                    onChange={(e) => setNewClientAppUrl(e.target.value)}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="text"
                    value={newClientWebUrl}
                    placeholder="网页链接（回退，如 https://...）"
                    aria-label="新客户端网页链接"
                    className="min-w-0 flex-1"
                    onChange={(e) => setNewClientWebUrl(e.target.value)}
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="primary"
                      size="xs"
                      onClick={() => {
                        const validated = validateQuickJumpClientInputs(
                          newClientLabel,
                          newClientAppUrl,
                          newClientWebUrl,
                        );
                        if (validated.error) {
                          setQuickJumpError(validated.error);
                          return;
                        }
                        setQuickJumpError(null);
                        const id = `custom-${Date.now().toString(36)}`;
                        setQuickJumpDraft((prev) => ({
                          ...prev,
                          clients: [
                            ...prev.clients,
                            {
                              id,
                              label: validated.label,
                              appUrl: validated.appUrl,
                              webUrl: validated.webUrl,
                              url: validated.url,
                              enabled: true,
                            },
                          ],
                        }));
                        setAddingClient(false);
                        setNewClientLabel('');
                        setNewClientAppUrl('');
                        setNewClientWebUrl('');
                      }}
                    >
                      添加
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setAddingClient(false);
                        setNewClientLabel('');
                        setNewClientAppUrl('');
                        setNewClientWebUrl('');
                        setQuickJumpError(null);
                      }}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={() => {
                    setQuickJumpError(null);
                    setAddingClient(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>添加客户端</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => {
                    setQuickJumpError(null);
                    setEditingClientId(null);
                    setAddingClient(false);
                    setQuickJumpDraft(createDefaultExternalAiQuickJumpSettings());
                  }}
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>恢复默认</span>
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </section>

      <button
        type="button"
        onClick={() => {
          onCloseModal();
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
  );
}
