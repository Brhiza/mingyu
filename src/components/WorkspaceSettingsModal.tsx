import { useState } from 'react';
import { WorkspaceButton, WorkspaceDialog } from './workspace/WorkspaceUI';
import {
  WORKSPACE_FEATURES,
  WORKSPACE_FEATURE_GROUPS,
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

function moveItemWithinGroup(
  order: WorkspaceFeatureId[],
  id: WorkspaceFeatureId,
  direction: -1 | 1,
) {
  const feature = getWorkspaceFeature(id);
  const groupOrder = order.filter((item) => getWorkspaceFeature(item).group === feature.group);
  const groupIndex = groupOrder.indexOf(id);
  const siblingId = groupOrder[groupIndex + direction];
  if (!siblingId) {
    return order;
  }
  const next = [...order];
  const currentIndex = next.indexOf(id);
  const siblingIndex = next.indexOf(siblingId);
  [next[currentIndex], next[siblingIndex]] = [next[siblingIndex], next[currentIndex]];
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
    <WorkspaceDialog
      className="workspace-settings-modal"
      backdropClassName="workspace-settings-backdrop"
      labelledBy="workspace-settings-title"
      onClose={onClose}
    >
      <header className="workspace-ui-dialog-header workspace-settings-head">
        <h2 id="workspace-settings-title">设置</h2>
        <WorkspaceButton variant="ghost" size="small" onClick={onClose}>
          关闭
        </WorkspaceButton>
      </header>

      <div className="workspace-settings-layout">
        <section className="workspace-settings-section">
          <h3>首页首选</h3>
          <label className="workspace-setting-field">
            <span>首选工具</span>
            <select
              className="workspace-ui-control"
              value={draft.defaultFeature}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  defaultFeature: event.target.value as WorkspaceFeatureId,
                }))
              }
            >
              {WORKSPACE_FEATURE_GROUPS.map((group) => (
                <optgroup label={group.label} key={group.id}>
                  {WORKSPACE_FEATURES.filter((feature) => feature.group === group.id).map(
                    (feature) => (
                      <option value={feature.id} key={feature.id}>
                        {feature.label}
                      </option>
                    ),
                  )}
                </optgroup>
              ))}
            </select>
          </label>

          <p className="workspace-setting-note">
            首页会优先打开该工具所在的模式，并标出首选项。已选择全局案例时，排盘会直接使用该案例。
          </p>

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
              <p>在各类工具内调整顺序；前 5 个占问会直接显示。</p>
            </div>
            <WorkspaceButton
              variant="ghost"
              size="small"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  navigationOrder: WORKSPACE_FEATURES.map((item) => item.id),
                }))
              }
            >
              恢复默认
            </WorkspaceButton>
          </div>

          <div className="workspace-order-list">
            {WORKSPACE_FEATURE_GROUPS.map((group) => {
              const ids = draft.navigationOrder.filter(
                (id) => getWorkspaceFeature(id).group === group.id,
              );
              return (
                <section className="workspace-order-group" key={group.id}>
                  <h4>{group.label}</h4>
                  {ids.map((id, index) => {
                    const feature = getWorkspaceFeature(id);
                    return (
                      <div className="workspace-order-item" key={id}>
                        <span className="workspace-order-mark">{feature.mark}</span>
                        <span className="workspace-order-name">{feature.label}</span>
                        <div className="workspace-order-actions">
                          <WorkspaceButton
                            variant="ghost"
                            size="small"
                            disabled={index === 0}
                            aria-label={`上移${feature.label}`}
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                navigationOrder: moveItemWithinGroup(
                                  current.navigationOrder,
                                  id,
                                  -1,
                                ),
                              }))
                            }
                          >
                            ↑
                          </WorkspaceButton>
                          <WorkspaceButton
                            variant="ghost"
                            size="small"
                            disabled={index === ids.length - 1}
                            aria-label={`下移${feature.label}`}
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                navigationOrder: moveItemWithinGroup(
                                  current.navigationOrder,
                                  id,
                                  1,
                                ),
                              }))
                            }
                          >
                            ↓
                          </WorkspaceButton>
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </section>
      </div>

      <footer className="workspace-ui-dialog-footer workspace-settings-actions">
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
