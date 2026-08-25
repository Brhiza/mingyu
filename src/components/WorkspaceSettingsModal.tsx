import { useEffect, useRef, useState } from 'react';
import { WorkspaceButton, WorkspaceDialog } from './workspace/WorkspaceUI';
import {
  DEFAULT_WORKSPACE_PREFERENCES,
  HOME_MODE_DEFINITIONS,
  WORKSPACE_FEATURES,
  WORKSPACE_FEATURE_GROUPS,
  WORKSPACE_THEME_DEFINITIONS,
  applyWorkspaceTheme,
  getWorkspaceFeature,
  type HomeModeId,
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

function moveHomeMode(order: HomeModeId[], id: HomeModeId, direction: -1 | 1) {
  const currentIndex = order.indexOf(id);
  const siblingIndex = currentIndex + direction;
  if (currentIndex < 0 || siblingIndex < 0 || siblingIndex >= order.length) {
    return order;
  }
  const next = [...order];
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
  const didApplyRef = useRef(false);

  useEffect(() => {
    applyWorkspaceTheme(draft.theme);
  }, [draft.theme]);

  useEffect(
    () => () => {
      if (!didApplyRef.current) {
        applyWorkspaceTheme(preferences.theme);
      }
    },
    [preferences.theme],
  );

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
        <section className="workspace-settings-section workspace-settings-primary-section">
          <div className="workspace-theme-setting">
            <div className="workspace-order-heading">
              <div>
                <h3>主题色</h3>
                <p>选择后立即预览。</p>
              </div>
            </div>
            <div className="workspace-theme-options" role="radiogroup" aria-label="主题色">
              {WORKSPACE_THEME_DEFINITIONS.map((theme) => {
                const isActive = draft.theme === theme.id;
                return (
                  <button
                    type="button"
                    className={`workspace-theme-option${isActive ? ' is-active' : ''}`}
                    role="radio"
                    aria-checked={isActive}
                    key={theme.id}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        theme: theme.id,
                      }))
                    }
                  >
                    <span className="workspace-theme-swatches" aria-hidden="true">
                      {theme.swatches.map((color) => (
                        <i key={color} style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span>{theme.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="workspace-order-heading">
            <div>
              <h3>首页模式顺序</h3>
              <p>第一项会作为首页默认模式。</p>
            </div>
            <WorkspaceButton
              variant="ghost"
              size="small"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  homeModeOrder: [...DEFAULT_WORKSPACE_PREFERENCES.homeModeOrder],
                }))
              }
            >
              恢复默认
            </WorkspaceButton>
          </div>

          <div className="workspace-home-mode-order-list">
            {draft.homeModeOrder.map((id, index) => {
              const mode = HOME_MODE_DEFINITIONS.find((item) => item.id === id);
              if (!mode) return null;
              return (
                <div className="workspace-order-item" key={id}>
                  <span className="workspace-order-mark">{mode.mark}</span>
                  <span className="workspace-order-name">{mode.label}</span>
                  <div className="workspace-order-actions">
                    <WorkspaceButton
                      variant="ghost"
                      size="small"
                      disabled={index === 0}
                      aria-label={`上移${mode.label}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          homeModeOrder: moveHomeMode(current.homeModeOrder, id, -1),
                        }))
                      }
                    >
                      ↑
                    </WorkspaceButton>
                    <WorkspaceButton
                      variant="ghost"
                      size="small"
                      disabled={index === draft.homeModeOrder.length - 1}
                      aria-label={`下移${mode.label}`}
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          homeModeOrder: moveHomeMode(current.homeModeOrder, id, 1),
                        }))
                      }
                    >
                      ↓
                    </WorkspaceButton>
                  </div>
                </div>
              );
            })}
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
            didApplyRef.current = true;
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
