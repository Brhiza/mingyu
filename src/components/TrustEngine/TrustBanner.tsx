import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useTrustBanner } from './useTrustBanner';

/**
 * 信任横幅 — 信任漏斗的可见层。
 * 按当前层级（T0–T6）显示一句话的信任承诺，6 秒后自动淡出，可手动关闭。
 * T2（隐私政策页）不显示，避免自我指涉。
 *
 * 挂载方式：
 * - App.tsx 全局挂载（无 extras）：覆盖 T1 教程 / T6 结果·记录；
 * - InputPage 单独挂载（带 inputMode 与 inputHasContent）：覆盖 T0/T3/T4/T5。
 * 两处同时存在时，各自按自己的层级判定，互不干扰（首页时全局实例判定为 null 不显示）。
 */
export function TrustBanner({
  inputMode,
  inputHasContent,
}: {
  inputMode?: 'single' | 'compatibility' | 'divination' | 'almanac';
  inputHasContent?: boolean;
}) {
  const { t } = useI18n();
  const { tier, visible, copy, dismiss } = useTrustBanner(
    inputMode !== undefined || inputHasContent !== undefined
      ? { inputMode, inputHasContent }
      : undefined,
  );

  if (!visible || !copy) {
    return null;
  }

  return (
    <div className={`trust-banner trust-banner--${tier ?? 'none'}`} role="status" aria-live="polite">
      <span className="trust-badge" aria-hidden="true">
        {tier}
      </span>
      <span className="trust-copy">{copy}</span>
      {tier === 'T0' ? (
        <Link className="trust-link" to="/tutorial">
          {t('nav.tutorial')}
        </Link>
      ) : null}
      <button type="button" className="trust-close" onClick={dismiss} aria-label="关闭">
        ×
      </button>
    </div>
  );
}
