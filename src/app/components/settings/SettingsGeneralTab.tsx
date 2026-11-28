import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button, Select } from '../../../components/ui';
import { cn } from '../../../lib/utils';
import {
  getSkinLogoUrl,
  getSkinTarotCardUrl,
  isSkinThemeId,
  packageIdForSkinTheme,
  packageIdForTarotDeck,
  resolveRemoteAssetUrl,
  warmAssetPackageInBackground,
  type RemoteSkinDefinition,
} from '../../../remote-assets';
import {
  PERSONAL_CHART_TABS,
  type DivinationFormMethod,
  type PersonalChartTabId,
} from '../../../v2-ui/chart-tabs';
import { TAROT_DECK_OPTIONS, type GlobalRulesSettings } from '../../../web-settings';
import {
  DIVINATION_FLAT_ITEMS,
  WORKSPACE_THEME_DEFINITIONS,
  applyWorkspaceTheme,
  type WorkspacePreferences,
} from '../../workspace-catalog';

const DIVINATION_CENTER_DEFAULT_CHOICES = DIVINATION_FLAT_ITEMS.filter(
  (o): o is { id: DivinationFormMethod; label: string } => o.id !== 'number-energy',
);

export interface SettingsGeneralTabProps {
  draft: WorkspacePreferences;
  setDraft: React.Dispatch<React.SetStateAction<WorkspacePreferences>>;
  colorScheme: 'light' | 'dark';
  onToggleScheme: () => void;
  remoteSkins: readonly RemoteSkinDefinition[];
  hasRemoteAssets: boolean;
  rulesDraft: GlobalRulesSettings;
  onUpdateCastingRule: <K extends keyof GlobalRulesSettings['casting']>(
    key: K,
    value: GlobalRulesSettings['casting'][K],
  ) => void;
}

export function SettingsGeneralTab({
  draft,
  setDraft,
  colorScheme,
  onToggleScheme,
  remoteSkins,
  hasRemoteAssets,
  rulesDraft,
  onUpdateCastingRule,
}: SettingsGeneralTabProps) {
  const [failedThemeLogos, setFailedThemeLogos] = React.useState<Record<string, boolean>>({});

  return (
    <div className="grid gap-4">
      {/* 主题颜色与明暗 */}
      <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
            主题颜色
          </h3>
          <Button variant="secondary" size="xs" onClick={onToggleScheme}>
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

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="radiogroup" aria-label="主题颜色">
          {WORKSPACE_THEME_DEFINITIONS.map((theme) => {
            const active = draft.theme === theme.id;
            const [primaryHex, secondaryHex, paperHex] = theme.swatches;
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
                  'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs cursor-pointer transition-all',
                  active
                    ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface)] font-bold text-[var(--state-selected-text)] shadow-xs'
                    : 'border-[var(--border-soft)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                )}
              >
                <span
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-black/10 px-2 py-1"
                  style={{ backgroundColor: paperHex }}
                  aria-hidden="true"
                >
                  <i
                    className="block h-3 w-3 rounded-full"
                    style={{ backgroundColor: primaryHex }}
                  />
                  <i
                    className="block h-2 w-2 rounded-full opacity-90"
                    style={{ backgroundColor: secondaryHex }}
                  />
                </span>
                <span className="whitespace-nowrap text-[11.5px]">{theme.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 主题皮肤（仅在部署启用远程资源时展示） */}
      {remoteSkins.length > 0 ? (
        <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
          <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
            主题皮肤
          </h3>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="主题皮肤">
            {remoteSkins.map((skin) => {
              const active = draft.theme === skin.id;
              const [primaryHex, secondaryHex, paperHex] = skin.swatches;
              const skinLogoUrl = getSkinLogoUrl(skin.id);
              const showLogo = Boolean(skinLogoUrl && !failedThemeLogos[skin.id]);
              return (
                <button
                  key={skin.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, theme: skin.id }));
                    applyWorkspaceTheme(skin.id);
                    const pkgId = packageIdForSkinTheme(skin.id);
                    if (pkgId) void warmAssetPackageInBackground(pkgId);
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-xs cursor-pointer transition-all',
                    active
                      ? 'border-[var(--accent-strong)] bg-[var(--state-selected-surface)] font-bold text-[var(--state-selected-text)] shadow-xs'
                      : 'border-[var(--border-soft)] bg-[var(--surface-base)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
                  )}
                >
                  {showLogo && skinLogoUrl ? (
                    <img
                      src={skinLogoUrl}
                      alt=""
                      loading="lazy"
                      className="h-7 w-7 rounded-lg border border-black/10 object-cover"
                      onError={() =>
                        setFailedThemeLogos((prev) => ({ ...prev, [skin.id]: true }))
                      }
                    />
                  ) : (
                    <span
                      className="inline-flex h-7 items-center gap-1 rounded-full border border-black/10 px-2 py-1"
                      style={{ backgroundColor: paperHex }}
                      aria-hidden="true"
                    >
                      <i
                        className="block h-3 w-3 rounded-full"
                        style={{ backgroundColor: primaryHex }}
                      />
                      <i
                        className="block h-2 w-2 rounded-full opacity-90"
                        style={{ backgroundColor: secondaryHex }}
                      />
                    </span>
                  )}
                  <span className="whitespace-nowrap text-[11.5px]">{skin.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 默认排盘与起卦 */}
      <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
        <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
          默认术数
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-[var(--text-secondary)]">
            <span>常用排盘</span>
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
            <span>常用起卦</span>
            <Select
              value={draft.defaultDivinationFeature}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  defaultDivinationFeature: e.target.value as DivinationFormMethod,
                }))
              }
            >
              {DIVINATION_CENTER_DEFAULT_CHOICES.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </section>

      {/* 塔罗牌面套牌（仅启用远程素材库时显示） */}
      {hasRemoteAssets ? (
        <section className="grid gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3.5">
          <h3 className="m-0 text-[13px] font-extrabold text-[var(--text-strong)]">
            塔罗牌面套牌
          </h3>
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-3"
            role="radiogroup"
            aria-label="选择塔罗牌面套牌"
          >
            {TAROT_DECK_OPTIONS.map((deck) => {
              const isSelected = rulesDraft.casting.tarotDeck === deck.id;
              const previewSrc =
                deck.id === 'skin' && isSkinThemeId(draft.theme)
                  ? (getSkinTarotCardUrl(draft.theme, 0) ?? '/cards/tarot/000.webp')
                  : deck.id === 'skin' || deck.id === 'danjie-leopard'
                    ? '/cards/tarot/000.webp'
                    : resolveRemoteAssetUrl(`/card-decks/tarot/${deck.id}/000.webp`);
              return (
                <button
                  key={deck.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => {
                    onUpdateCastingRule('tarotDeck', deck.id);
                    if (deck.id !== 'skin' && deck.id !== 'danjie-leopard') {
                      void warmAssetPackageInBackground(packageIdForTarotDeck(deck.id));
                    }
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border p-2 text-left transition-all cursor-pointer',
                    isSelected
                      ? 'border-[var(--accent)] bg-[var(--state-selected-surface)] shadow-xs'
                      : 'border-[var(--border-soft)] bg-[var(--surface-base)] hover:border-[var(--border-contrast)]',
                  )}
                >
                  <span className="h-9 w-6 shrink-0 overflow-hidden rounded bg-[var(--surface-soft)]">
                    <img
                      src={previewSrc}
                      alt={deck.label}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </span>
                  <strong className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--text-strong)]">
                    {deck.label.replace('（默认）', '')}
                  </strong>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
