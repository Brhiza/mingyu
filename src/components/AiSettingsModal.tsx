import { useState } from 'react';
import { WorkspaceButton, WorkspaceDialog } from './workspace/WorkspaceUI';
import { fetchAiModels } from '@/lib/ai/stream-client';
import {
  AI_PROVIDER_PRESETS,
  getServerBuiltinAiLabel,
  isServerBuiltinAiEnabled,
  type AiSettings,
} from '@/lib/ai/settings';

interface AiSettingsModalProps {
  settings: AiSettings;
  onApply: (settings: AiSettings) => void;
  onClose: () => void;
}

export function AiSettingsModal({ settings, onApply, onClose }: AiSettingsModalProps) {
  const [draft, setDraft] = useState(settings);
  const [modelStatus, setModelStatus] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const builtinEnabled = isServerBuiltinAiEnabled();
  const builtinLabel = getServerBuiltinAiLabel();
  const canFetchModels =
    draft.mode === 'builtin' || Boolean(draft.apiKey.trim() && draft.baseUrl.trim());

  function applyProvider(providerId: string) {
    const preset = AI_PROVIDER_PRESETS.find((item) => item.id === providerId);
    if (!preset) return;

    setDraft((current) => ({
      ...current,
      providerId: preset.id,
      baseUrl: preset.baseUrl,
      model: '',
    }));
    setModels([]);
    setModelStatus('');
  }

  async function handleFetchModels() {
    const config =
      draft.mode === 'builtin'
        ? ({ mode: 'builtin' } as const)
        : ({
            mode: 'custom',
            apiKey: draft.apiKey.trim(),
            baseUrl: draft.baseUrl.trim(),
          } as const);

    setModelStatus('正在获取模型…');
    setModels([]);
    try {
      const nextModels = await fetchAiModels(config);
      setModels(nextModels);
      setModelStatus(
        nextModels.length ? `已获取 ${nextModels.length} 个模型` : '服务商未返回模型列表',
      );
    } catch (error) {
      setModelStatus(error instanceof Error ? error.message : '获取模型失败');
    }
  }

  return (
    <WorkspaceDialog className="ai-settings-modal" labelledBy="ai-settings-title" onClose={onClose}>
      <header className="workspace-ui-dialog-header">
        <div>
          <h2 id="ai-settings-title">AI 设置</h2>
          <p>
            {builtinEnabled
              ? `打开后可使用${builtinLabel}；需要自己的接口时切换到“自行配置”。`
              : '填写 OpenAI 兼容接口后可使用 AI 解读。'}
          </p>
        </div>
        <WorkspaceButton variant="ghost" size="small" onClick={onClose}>
          关闭
        </WorkspaceButton>
      </header>

      <div className="workspace-ui-dialog-body ai-settings-grid">
        <section className="ai-settings-section">
          <label className="ai-settings-switch">
            <span>
              <strong>启用 AI 解读</strong>
              <small>关闭后页面仍显示提示词复制模式。</small>
            </span>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(event) =>
                setDraft((current) => ({ ...current, enabled: event.target.checked }))
              }
            />
          </label>

          {builtinEnabled ? (
            <div className="ai-settings-mode-row">
              <button
                type="button"
                className={`ai-settings-mode-btn ${draft.mode === 'builtin' ? 'is-active' : ''}`}
                onClick={() => setDraft((current) => ({ ...current, mode: 'builtin' }))}
              >
                {builtinLabel}
              </button>
              <button
                type="button"
                className={`ai-settings-mode-btn ${draft.mode === 'custom' ? 'is-active' : ''}`}
                onClick={() => setDraft((current) => ({ ...current, mode: 'custom' }))}
              >
                自行配置
              </button>
            </div>
          ) : null}
        </section>

        {draft.mode === 'custom' ? (
          <section className="ai-settings-section">
            <label className="workspace-ui-field">
              <span>服务商</span>
              <select
                className="workspace-ui-control"
                value={draft.providerId}
                onChange={(event) => applyProvider(event.target.value)}
              >
                {AI_PROVIDER_PRESETS.map((preset) => (
                  <option value={preset.id} key={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="workspace-ui-field">
              <span>接口地址</span>
              <input
                className="workspace-ui-control"
                value={draft.baseUrl}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, baseUrl: event.target.value }))
                }
              />
            </label>

            <label className="workspace-ui-field">
              <span>API Key</span>
              <input
                className="workspace-ui-control"
                type="password"
                value={draft.apiKey}
                placeholder="仅自行配置时填写，保存在本机浏览器"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, apiKey: event.target.value }))
                }
              />
            </label>

            <label className="workspace-ui-field">
              <span>模型</span>
              <input
                className="workspace-ui-control"
                value={draft.model}
                placeholder="点击获取模型后选择，或手动填写"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, model: event.target.value }))
                }
              />
            </label>

            <div className="ai-settings-model-actions">
              <WorkspaceButton size="small" onClick={handleFetchModels} disabled={!canFetchModels}>
                获取模型
              </WorkspaceButton>
              {modelStatus ? <span>{modelStatus}</span> : null}
            </div>

            {models.length ? (
              <div className="ai-settings-model-list workspace-ui-choice-grid">
                {models.map((model) => (
                  <button
                    type="button"
                    className={`workspace-ui-choice ${draft.model === model ? 'is-active' : ''}`}
                    onClick={() => setDraft((current) => ({ ...current, model }))}
                    key={model}
                  >
                    {model}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      <footer className="workspace-ui-dialog-footer">
        <WorkspaceButton onClick={onClose}>取消</WorkspaceButton>
        <WorkspaceButton
          variant="primary"
          onClick={() => {
            onApply(draft);
            onClose();
          }}
        >
          保存设置
        </WorkspaceButton>
      </footer>
    </WorkspaceDialog>
  );
}
