import { useState } from 'react';
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
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card ai-settings-modal" onClick={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <div>
            <h2>AI 设置</h2>
            <p>
              {builtinEnabled
                ? `打开后可使用${builtinLabel}，也可以填写自己的 OpenAI 兼容接口。`
                : '填写 OpenAI 兼容接口后可使用 AI 解读。'}
            </p>
          </div>
          <button className="modal-btn modal-btn-secondary" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="ai-settings-grid">
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

          <section className="ai-settings-section">
            <label className="field-card">
              <div className="field-header">
                <span>服务商</span>
              </div>
              <select
                value={draft.providerId}
                onChange={(event) => applyProvider(event.target.value)}
                disabled={draft.mode === 'builtin'}
              >
                {AI_PROVIDER_PRESETS.map((preset) => (
                  <option value={preset.id} key={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-card">
              <div className="field-header">
                <span>接口地址</span>
              </div>
              <input
                value={draft.baseUrl}
                disabled={draft.mode === 'builtin'}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, baseUrl: event.target.value }))
                }
              />
            </label>

            <label className="field-card">
              <div className="field-header">
                <span>API Key</span>
              </div>
              <input
                type="password"
                value={draft.apiKey}
                disabled={draft.mode === 'builtin'}
                placeholder="仅自行配置时填写，保存在本机浏览器"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, apiKey: event.target.value }))
                }
              />
            </label>

            <label className="field-card">
              <div className="field-header">
                <span>模型</span>
              </div>
              <input
                value={draft.model}
                placeholder="点击获取模型后选择，或手动填写"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, model: event.target.value }))
                }
              />
            </label>

            <div className="ai-settings-model-actions">
              <button
                type="button"
                className="modal-btn modal-btn-secondary"
                onClick={handleFetchModels}
                disabled={!canFetchModels}
              >
                获取模型
              </button>
              {modelStatus ? <span>{modelStatus}</span> : null}
            </div>

            {models.length ? (
              <div className="ai-settings-model-list">
                {models.map((model) => (
                  <button
                    type="button"
                    className={`quick-chip ${draft.model === model ? 'is-active' : ''}`}
                    onClick={() => setDraft((current) => ({ ...current, model }))}
                    key={model}
                  >
                    {model}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <div className="modal-actions">
          <button className="modal-btn modal-btn-secondary" type="button" onClick={onClose}>
            取消
          </button>
          <button
            className="modal-btn modal-btn-primary"
            type="button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
