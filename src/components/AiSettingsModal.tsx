import { useState } from 'react';
import { GENERAL_DIVINATION_METHOD_OPTIONS } from 'mingyu-core/divination/config';
import { useAppPreferences } from '@/hooks/useAppPreferences';
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
  const [appPreferences, setAppPreferences] = useAppPreferences();
  const [draft, setDraft] = useState(settings);
  const [preferencesDraft, setPreferencesDraft] = useState(appPreferences);
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
            <h2>设置</h2>
            <p>调整首页、案例和占卜偏好，也可以配置 AI 解读。</p>
          </div>
          <button className="modal-btn modal-btn-secondary" type="button" onClick={onClose}>
            关闭
          </button>
        </div>

        <div className="ai-settings-grid">
          <section className="ai-settings-section app-settings-preferences">
            <div className="app-settings-section-head">
              <strong>使用偏好</strong>
              <small>未指定主页时，每次从空白排盘输入页开始。</small>
            </div>

            <div className="app-settings-preference-grid">
              <label className="field-card">
                <div className="field-header">
                  <span>默认主页</span>
                </div>
                <select
                  value={preferencesDraft.home}
                  onChange={(event) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      home: event.target.value as typeof current.home,
                    }))
                  }
                >
                  <option value="unspecified">未指定（空白输入页）</option>
                  <option value="dashboard">首页</option>
                  <option value="single">个人排盘</option>
                  <option value="compatibility">合盘</option>
                  <option value="divination">占卜</option>
                  <option value="almanac">择日</option>
                </select>
              </label>

              <label className="field-card">
                <div className="field-header">
                  <span>默认占卜算法</span>
                </div>
                <select
                  value={preferencesDraft.defaultDivinationMethod}
                  onChange={(event) =>
                    setPreferencesDraft((current) => ({
                      ...current,
                      defaultDivinationMethod: event.target
                        .value as typeof current.defaultDivinationMethod,
                    }))
                  }
                >
                  {GENERAL_DIVINATION_METHOD_OPTIONS.map((item) => (
                    <option value={item.value} key={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="app-settings-case-preference">
              <span>从导航打开个人排盘或合盘时</span>
              <div className="ai-settings-mode-row">
                <button
                  type="button"
                  className={`ai-settings-mode-btn ${preferencesDraft.caseEntry === 'recent' ? 'is-active' : ''}`}
                  onClick={() =>
                    setPreferencesDraft((current) => ({ ...current, caseEntry: 'recent' }))
                  }
                >
                  直接查看最近排盘
                </button>
                <button
                  type="button"
                  className={`ai-settings-mode-btn ${preferencesDraft.caseEntry === 'new' ? 'is-active' : ''}`}
                  onClick={() =>
                    setPreferencesDraft((current) => ({ ...current, caseEntry: 'new' }))
                  }
                >
                  新建空白案例
                </button>
              </div>
            </div>
          </section>

          <section className="ai-settings-section">
            <div className="app-settings-section-head">
              <strong>AI 解读</strong>
              <small>
                {builtinEnabled
                  ? `可使用${builtinLabel}，也可以切换到自己的接口。`
                  : '填写 OpenAI 兼容接口后可使用。'}
              </small>
            </div>
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
              <label className="field-card">
                <div className="field-header">
                  <span>服务商</span>
                </div>
                <select
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

              <label className="field-card">
                <div className="field-header">
                  <span>接口地址</span>
                </div>
                <input
                  value={draft.baseUrl}
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
          ) : null}
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
              setAppPreferences(preferencesDraft);
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
