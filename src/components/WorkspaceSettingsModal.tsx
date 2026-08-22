import { useState } from 'react';
import {
  WORKSPACE_FEATURES,
  getWorkspaceFeature,
  type WorkspaceFeatureId,
  type WorkspacePreferences,
} from '@/lib/workspace';

type WorkspaceSettingsModalProps = {
  preferences: WorkspacePreferences;
  onApply: (preferences: WorkspacePreferences) => void;
  onOpenAiSettings: () => void;
  onClose: () => void;
};

function moveItem(order: WorkspaceFeatureId[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= order.length) {
    return order;
  }
  const next = [...order];
  [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
  return next;
}

export function WorkspaceSettingsModal({
  preferences,
  onApply,
  onOpenAiSettings,
  onClose,
}: WorkspaceSettingsModalProps) {
  const [draft, setDraft] = useState(preferences);

  return (
    <div className="modal-backdrop workspace-settings-backdrop" onClick={onClose}>
      <div
        className="modal-card workspace-settings-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="workspace-settings-head">
          <div>
            <span className="workspace-eyebrow">工作区设置</span>
            <h2>按你的习惯安排工具</h2>
          </div>
          <button type="button" className="workspace-icon-button" onClick={onClose}>
            关闭
          </button>
        </header>

        <div className="workspace-settings-layout">
          <section className="workspace-settings-section">
            <h3>启动方式</h3>
            <label className="workspace-setting-field">
              <span>默认工具</span>
              <select
                value={draft.defaultFeature}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    defaultFeature: event.target.value as WorkspaceFeatureId,
                  }))
                }
              >
                {WORKSPACE_FEATURES.map((feature) => (
                  <option value={feature.id} key={feature.id}>
                    {feature.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="workspace-setting-field">
              <span>打开命语时</span>
              <div className="workspace-choice-grid">
                <button
                  type="button"
                  className={draft.startBehavior === 'new' ? 'is-active' : ''}
                  onClick={() => setDraft((current) => ({ ...current, startBehavior: 'new' }))}
                >
                  <strong>每次新建</strong>
                  <small>进入空白录入页</small>
                </button>
                <button
                  type="button"
                  className={draft.startBehavior === 'recent' ? 'is-active' : ''}
                  onClick={() => setDraft((current) => ({ ...current, startBehavior: 'recent' }))}
                >
                  <strong>继续最近</strong>
                  <small>有记录时直接打开</small>
                </button>
              </div>
            </div>

            <button type="button" className="workspace-ai-setting-entry" onClick={onOpenAiSettings}>
              <span>
                <strong>AI 解读设置</strong>
                <small>启用内置服务或配置自己的模型</small>
              </span>
              <span aria-hidden="true">›</span>
            </button>
          </section>

          <section className="workspace-settings-section workspace-order-section">
            <div className="workspace-order-heading">
              <div>
                <h3>侧栏顺序</h3>
                <p>排在最前的工具会优先显示。</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    navigationOrder: WORKSPACE_FEATURES.map((item) => item.id),
                  }))
                }
              >
                恢复默认
              </button>
            </div>

            <div className="workspace-order-list">
              {draft.navigationOrder.map((id, index) => {
                const feature = getWorkspaceFeature(id);
                return (
                  <div className="workspace-order-item" key={id}>
                    <span className="workspace-order-mark">{feature.mark}</span>
                    <span className="workspace-order-name">{feature.label}</span>
                    <div className="workspace-order-actions">
                      <button
                        type="button"
                        disabled={index === 0}
                        aria-label={`上移${feature.label}`}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            navigationOrder: moveItem(current.navigationOrder, index, -1),
                          }))
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={index === draft.navigationOrder.length - 1}
                        aria-label={`下移${feature.label}`}
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            navigationOrder: moveItem(current.navigationOrder, index, 1),
                          }))
                        }
                      >
                        ↓
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="workspace-settings-actions">
          <button type="button" className="secondary-page-button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            保存设置
          </button>
        </footer>
      </div>
    </div>
  );
}
